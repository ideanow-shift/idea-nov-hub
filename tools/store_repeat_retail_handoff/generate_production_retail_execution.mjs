import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import {
  PRODUCTION_RETAIL_PROFILE,
  buildProductionRetailLoadPlan,
} from "./prepare_production_retail_load.mjs";

export const EXECUTION_PROFILE = Object.freeze({
  approvalGateSetting: "app.store_operations_retail_execution_approval",
  approvalGateValue: "OWNER_APPROVAL_REQUIRED_AFTER_FIXED_SHA_REVIEW",
  mappingSourceSystem: "store_ops_retail_purchase_20260921_v1",
  sourceSystem: "pos_retail_purchase_handoff_v1",
  sourceType: "pos_retail_purchase_customer_count_v1",
  sourceFileName: "02_店販購買客数_CORE_DB引継ぎパッケージ.json",
  expectedCompanyMappings: 6,
  expectedStoreMappings: 21,
  expectedMonths: 92,
  expectedCandidates: 1492,
  expectedExistingRates: 4,
});

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sql(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    assert(Number.isFinite(value), "NON_FINITE_SQL_NUMBER");
    return String(value);
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSql(value) {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function mappingEvidence(entityType, sourceKey, canonicalId) {
  return sha256(Buffer.from(JSON.stringify({ entityType, sourceKey, canonicalId }), "utf8")).toLowerCase();
}

function sortedRows(plan) {
  return [...plan.candidates]
    .map((row) => row.candidate)
    .sort((left, right) => left.fiscal_month.localeCompare(right.fiscal_month)
      || left.source_unit_key.localeCompare(right.source_unit_key, "ja")
      || left.raw_record_id.localeCompare(right.raw_record_id, "en"));
}

export function buildProductionRetailExecutionSql(plan, profile = EXECUTION_PROFILE) {
  assert(plan?.databaseWriteCapability === false, "REVIEWED_WRITE_INCAPABLE_PLAN_REQUIRED");
  const candidates = sortedRows(plan);
  assert(candidates.length === profile.expectedCandidates, "EXECUTION_CANDIDATE_COUNT_MISMATCH");

  const companies = new Map();
  const stores = new Map();
  const monthOrdinals = new Map();
  const rows = candidates.map((candidate) => {
    const companyKey = `company:${candidate.source_company_no}`;
    const priorCompany = companies.get(companyKey);
    assert(!priorCompany || priorCompany.companyId === candidate.company_id, "EXECUTION_COMPANY_MAPPING_CONFLICT");
    companies.set(companyKey, { companyId: candidate.company_id, label: candidate.source_company_no });

    const storeKey = candidate.store_mapping_entity_key;
    const priorStore = stores.get(storeKey);
    assert(!priorStore || priorStore.storeId === candidate.store_id, "EXECUTION_STORE_MAPPING_CONFLICT");
    stores.set(storeKey, { storeId: candidate.store_id, label: candidate.source_unit_key });

    const ordinal = (monthOrdinals.get(candidate.fiscal_month) ?? 0) + 1;
    monthOrdinals.set(candidate.fiscal_month, ordinal);
    return { candidate, companyKey, storeKey, ordinal };
  });
  assert(companies.size === profile.expectedCompanyMappings, "EXECUTION_COMPANY_MAPPING_COUNT_MISMATCH");
  assert(stores.size === profile.expectedStoreMappings, "EXECUTION_STORE_MAPPING_COUNT_MISMATCH");
  assert(monthOrdinals.size === profile.expectedMonths, "EXECUTION_MONTH_COUNT_MISMATCH");

  const actor = PRODUCTION_RETAIL_PROFILE.actorEmployeeId;
  const packageSha = PRODUCTION_RETAIL_PROFILE.retailPackageSha256.toLowerCase();
  const companyValues = [...companies.entries()].map(([sourceKey, value]) =>
    `(${sql(profile.mappingSourceSystem)},'company',${sql(sourceKey)},${sql(value.label)},${sql(value.companyId)}::uuid,null::uuid,${sql(mappingEvidence("company", sourceKey, value.companyId))},'active',${sql(actor)}::uuid,statement_timestamp())`
  ).join(",\n    ");
  const storeValues = [...stores.entries()].map(([sourceKey, value]) =>
    `(${sql(profile.mappingSourceSystem)},'store',${sql(sourceKey)},${sql(value.label)},null::uuid,${sql(value.storeId)}::uuid,${sql(mappingEvidence("store", sourceKey, value.storeId))},'active',${sql(actor)}::uuid,statement_timestamp())`
  ).join(",\n    ");
  const batchValues = [...monthOrdinals.keys()].sort().map((month) =>
    `(${sql(month)}::date,${sql(actor)}::uuid,${sql(actor)}::uuid)`).join(",\n    ");
  const rawValues = rows.map(({ candidate, companyKey, storeKey, ordinal }) => {
    const payload = {
      ...candidate,
      company_mapping_entity_key: companyKey,
      store_mapping_entity_key: storeKey,
    };
    return `(${sql(candidate.fiscal_month)}::date,${ordinal},${jsonSql(payload)},${sql(sha256(Buffer.from(JSON.stringify(payload), "utf8")).toLowerCase())})`;
  }).join(",\n    ");

  return `-- EXECUTION PACKAGE. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL FOR THIS FILE SHA.
-- Production project: ${PRODUCTION_RETAIL_PROFILE.projectRef}
-- Fixed retail package SHA-256: ${PRODUCTION_RETAIL_PROFILE.retailPackageSha256}
-- Planned STORE inserts: ${profile.expectedCandidates}; existing RETAIL_PURCHASE_RATE rows unchanged: ${profile.expectedExistingRates}
-- This file is atomic. Any failed gate rolls the entire transaction back.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
select pg_advisory_xact_lock(hashtextextended('store-operations-retail-purchase-20260921-v1', 0));

do $approval$
begin
  if current_setting(${sql(profile.approvalGateSetting)}, true) is distinct from ${sql(profile.approvalGateValue)} then
    raise exception 'OWNER_APPROVAL_SETTING_REQUIRED_FOR_FIXED_EXECUTION_SHA';
  end if;
end
$approval$;

do $baseline$
declare
  actor_count integer;
  definition_count integer;
  quantity_count integer;
  rate_count integer;
  source_count integer;
  mapping_count integer;
  company_count integer;
  store_count integer;
begin
  select count(*) into actor_count from public.employees
    where id=${sql(actor)}::uuid and is_active;
  select count(*) into definition_count from dbf_ingest.metric_definitions
    where metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS';
  select count(*) into quantity_count from public.dbf_store_monthly_metric_facts
    where metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS' and is_active;
  select count(*) into rate_count from public.dbf_store_monthly_metric_facts
    where metric_code='RETAIL_PURCHASE_RATE' and is_active;
  select count(*) into source_count from dbf_ingest.source_files
    where source_system=${sql(profile.sourceSystem)} and sha256=${sql(packageSha)};
  select count(*) into mapping_count from dbf_ingest.entity_mappings
    where source_system=${sql(profile.mappingSourceSystem)};
  select count(*) into company_count from public.corporations
    where (corporation_no,id) in (
      ('0001','e4059116-bdb3-4e13-9763-bbc77bdfe062'::uuid),
      ('0002','f0d56e0d-62e1-4eba-a37a-17e396ab0b61'::uuid),
      ('0003','becb6f4b-2222-406d-8315-1eed48717327'::uuid),
      ('0004','127b2041-a61c-498e-9040-a9d0a8146182'::uuid),
      ('0005','2dcb7eb1-3aa9-4f75-a439-471da534b2fb'::uuid),
      ('0006','34afa056-2d7c-413a-b6ea-80e2620e003c'::uuid));
  select count(*) into store_count from public.stores
    where id in (${[...stores.values()].map((value) => `${sql(value.storeId)}::uuid`).join(",")});
  if actor_count<>1 or definition_count<>0 or quantity_count<>0
     or rate_count<>${profile.expectedExistingRates} or source_count<>0 or mapping_count<>0
     or company_count<>${profile.expectedCompanyMappings} or store_count<>${profile.expectedStoreMappings} then
    raise exception 'PRODUCTION_BASELINE_GATE_FAILED actor=% definition=% quantity=% rate=% source=% mapping=% company=% store=%',
      actor_count,definition_count,quantity_count,rate_count,source_count,mapping_count,company_count,store_count;
  end if;
end
$baseline$;

alter table dbf_ingest.metric_definitions
  drop constraint metric_definitions_metric_code_check;
alter table dbf_ingest.metric_definitions
  add constraint metric_definitions_metric_code_check check (metric_code in (
    'TOTAL_SALES','TECHNICAL_SALES','RETAIL_SALES','MID_SALES','EC_ALLOCATED_SALES',
    'TOTAL_CUSTOMERS','NEW_CUSTOMERS','EXISTING_CUSTOMERS','TOTAL_UNIT_PRICE',
    'TECHNICAL_UNIT_PRICE','TOTAL_REPEAT_RATE','NEW_REPEAT_RATE','SECOND_REPEAT_RATE',
    'THIRD_REPEAT_RATE','FIXED_REPEAT_RATE','TOTAL_PRODUCTIVITY','TECHNICAL_PRODUCTIVITY',
    'RETAIL_PURCHASE_RATE','RETAIL_PURCHASE_CUSTOMER_VISITS','OPERATING_PROFIT'
  ));
insert into dbf_ingest.metric_definitions
  (metric_code,definition_version,value_kind,display_name,description,is_active)
values ('RETAIL_PURCHASE_CUSTOMER_VISITS','POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1','quantity',
  '店販購買客数','POS月報の店販行にある客数。0は正式な0、NULLは欠損。技術施術と同時購入を含む。',true);

insert into dbf_ingest.entity_mappings
  (source_system,entity_type,source_key,source_label,company_id,store_id,
   canonical_evidence_sha256,status,confirmed_by_employee_id,confirmed_at)
values
    ${companyValues},
    ${storeValues};

insert into dbf_ingest.source_files
  (sha256,byte_size,original_file_name,media_type,source_system,received_by_employee_id,received_via)
values (${sql(packageSha)},${PRODUCTION_RETAIL_PROFILE.retailPackageByteSize},${sql(profile.sourceFileName)},
  'application/json',${sql(profile.sourceSystem)},${sql(actor)}::uuid,'nov_hub_secure_session');

with source as (
  select id from dbf_ingest.source_files where source_system=${sql(profile.sourceSystem)} and sha256=${sql(packageSha)}
), v(fiscal_month,created_by,approved_by) as (values
    ${batchValues}
)
insert into dbf_ingest.import_batches
  (source_file_id,fact_kind,fiscal_month,source_type,status,revision,
   created_by_employee_id,approved_by_employee_id,approved_at)
select source.id,'store_operating_result',v.fiscal_month,${sql(profile.sourceType)},'approved',1,
  v.created_by,v.approved_by,statement_timestamp()
from source cross join v;

with source as (
  select id from dbf_ingest.source_files where source_system=${sql(profile.sourceSystem)} and sha256=${sql(packageSha)}
), v(fiscal_month,row_number,payload,payload_sha) as (values
    ${rawValues}
)
insert into dbf_ingest.raw_rows(batch_id,source_row_number,payload,payload_sha256)
select b.id,v.row_number,v.payload,v.payload_sha
from v cross join source join dbf_ingest.import_batches b
  on b.source_file_id=source.id and b.fact_kind='store_operating_result'
  and b.fiscal_month=v.fiscal_month and b.source_type=${sql(profile.sourceType)};

with source as (
  select id from dbf_ingest.source_files where source_system=${sql(profile.sourceSystem)} and sha256=${sql(packageSha)}
), candidate as (
  select rr.*,b.fiscal_month
  from source join dbf_ingest.import_batches b on b.source_file_id=source.id
    and b.fact_kind='store_operating_result' and b.source_type=${sql(profile.sourceType)}
  join dbf_ingest.raw_rows rr on rr.batch_id=b.id
)
insert into dbf_ingest.staging_rows
  (batch_id,raw_row_id,company_mapping_id,store_mapping_id,company_id,store_id,
   metric_code,quantity,source_row_category,mapping_status,validation_status,normalized_payload)
select candidate.batch_id,candidate.id,company_map.id,store_map.id,
  (candidate.payload->>'company_id')::uuid,(candidate.payload->>'store_id')::uuid,
  'RETAIL_PURCHASE_CUSTOMER_VISITS',(candidate.payload->>'quantity')::numeric,
  'detail','resolved','valid',candidate.payload
from candidate
join dbf_ingest.entity_mappings company_map
  on company_map.source_system=${sql(profile.mappingSourceSystem)} and company_map.entity_type='company'
  and company_map.source_key=candidate.payload->>'company_mapping_entity_key' and company_map.status='active'
join dbf_ingest.entity_mappings store_map
  on store_map.source_system=${sql(profile.mappingSourceSystem)} and store_map.entity_type='store'
  and store_map.source_key=candidate.payload->>'store_mapping_entity_key' and store_map.status='active'
where candidate.payload->>'source_scope_type'='SALON'
  and candidate.payload->>'promotion_status'='READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH'
  and candidate.payload->>'metric_code'='RETAIL_PURCHASE_CUSTOMER_VISITS';

do $promotion_gate$
declare raw_count integer; stage_count integer; invalid_count integer; rate_count integer;
begin
  select count(*) into raw_count from dbf_ingest.raw_rows rr
    join dbf_ingest.import_batches b on b.id=rr.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)};
  select count(*) into stage_count from dbf_ingest.staging_rows s
    join dbf_ingest.import_batches b on b.id=s.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)};
  select count(*) into invalid_count from dbf_ingest.staging_rows s
    join dbf_ingest.import_batches b on b.id=s.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)}
      and (s.mapping_status<>'resolved' or s.validation_status<>'valid' or s.quantity<0
        or nullif(s.normalized_payload->>'total_customer_visits_for_validation','')::numeric<s.quantity);
  select count(*) into rate_count from public.dbf_store_monthly_metric_facts
    where metric_code='RETAIL_PURCHASE_RATE' and is_active;
  if raw_count<>${profile.expectedCandidates} or stage_count<>${profile.expectedCandidates}
     or invalid_count<>0 or rate_count<>${profile.expectedExistingRates} then
    raise exception 'PRODUCTION_PROMOTION_GATE_FAILED raw=% stage=% invalid=% rate=%',raw_count,stage_count,invalid_count,rate_count;
  end if;
end
$promotion_gate$;

insert into public.dbf_store_monthly_metric_facts
  (fiscal_month,company_id,store_id,metric_code,quantity,definition_version,source_type,
   source_file_id,batch_id,imported_by_employee_id,version,status,is_active)
select b.fiscal_month,s.company_id,s.store_id,'RETAIL_PURCHASE_CUSTOMER_VISITS',s.quantity,
  'POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1',${sql(profile.sourceType)},b.source_file_id,b.id,
  ${sql(actor)}::uuid,1,'confirmed',true
from dbf_ingest.staging_rows s
join dbf_ingest.import_batches b on b.id=s.batch_id
join dbf_ingest.source_files f on f.id=b.source_file_id
where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)}
  and s.mapping_status='resolved' and s.validation_status='valid'
on conflict (fiscal_month,company_id,store_id,metric_code) where is_active do nothing;

insert into dbf_ingest.import_events
  (batch_id,event_type,from_status,to_status,actor_employee_id,reason_code,summary)
select b.id,'store_operations_retail_purchase_promoted','approved','promoted',${sql(actor)}::uuid,
  'OWNER_APPROVED_FIXED_PACKAGE',jsonb_build_object('package_sha256',${sql(packageSha)},'metric_code','RETAIL_PURCHASE_CUSTOMER_VISITS')
from dbf_ingest.import_batches b join dbf_ingest.source_files f on f.id=b.source_file_id
where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)};

update dbf_ingest.import_batches b
set status='promoted',promoted_at=statement_timestamp()
from dbf_ingest.source_files f
where f.id=b.source_file_id and f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)};

do $readback$
declare
  definition_count integer; quantity_count integer; rate_count integer;
  source_count integer; batch_count integer; raw_count integer; stage_count integer;
  duplicate_count integer; mapping_count integer;
begin
  select count(*) into definition_count from dbf_ingest.metric_definitions
    where metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS' and definition_version='POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1';
  select count(*) into quantity_count from public.dbf_store_monthly_metric_facts f
    join dbf_ingest.source_files sf on sf.id=f.source_file_id
    where f.metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS' and f.is_active
      and sf.source_system=${sql(profile.sourceSystem)} and sf.sha256=${sql(packageSha)};
  select count(*) into rate_count from public.dbf_store_monthly_metric_facts
    where metric_code='RETAIL_PURCHASE_RATE' and is_active;
  select count(*) into source_count from dbf_ingest.source_files
    where source_system=${sql(profile.sourceSystem)} and sha256=${sql(packageSha)};
  select count(*) into batch_count from dbf_ingest.import_batches b join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)} and b.status='promoted';
  select count(*) into raw_count from dbf_ingest.raw_rows rr join dbf_ingest.import_batches b on b.id=rr.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)};
  select count(*) into stage_count from dbf_ingest.staging_rows s join dbf_ingest.import_batches b on b.id=s.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)};
  select count(*) into duplicate_count from (
    select fiscal_month,company_id,store_id,metric_code,count(*) from public.dbf_store_monthly_metric_facts
    where metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS' and is_active
    group by fiscal_month,company_id,store_id,metric_code having count(*)<>1
  ) d;
  select count(*) into mapping_count from dbf_ingest.entity_mappings
    where source_system=${sql(profile.mappingSourceSystem)} and status='active';
  if definition_count<>1 or quantity_count<>${profile.expectedCandidates} or rate_count<>${profile.expectedExistingRates}
     or source_count<>1 or batch_count<>${profile.expectedMonths} or raw_count<>${profile.expectedCandidates}
     or stage_count<>${profile.expectedCandidates} or duplicate_count<>0
     or mapping_count<>${profile.expectedCompanyMappings + profile.expectedStoreMappings} then
    raise exception 'PRODUCTION_READBACK_GATE_FAILED definition=% quantity=% rate=% source=% batch=% raw=% stage=% duplicate=% mapping=%',
      definition_count,quantity_count,rate_count,source_count,batch_count,raw_count,stage_count,duplicate_count,mapping_count;
  end if;
end
$readback$;

commit;

select
  (select count(*) from public.dbf_store_monthly_metric_facts where metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS' and is_active) as retail_purchase_customer_visits,
  (select count(*) from public.dbf_store_monthly_metric_facts where metric_code='RETAIL_PURCHASE_RATE' and is_active) as unchanged_retail_purchase_rate,
  (select count(*) from dbf_ingest.import_batches b join dbf_ingest.source_files f on f.id=b.source_file_id where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)} and b.status='promoted') as promoted_batches;
`;
}

export function generateProductionRetailExecution({ retailPath, sqlPath, manifestPath }) {
  const bytes = readFileSync(retailPath);
  assert(bytes.length === PRODUCTION_RETAIL_PROFILE.retailPackageByteSize, "RETAIL_PACKAGE_BYTE_SIZE_MISMATCH");
  assert(sha256(bytes) === PRODUCTION_RETAIL_PROFILE.retailPackageSha256, "RETAIL_PACKAGE_SHA256_MISMATCH");
  const plan = buildProductionRetailLoadPlan(JSON.parse(bytes.toString("utf8")));
  const executionSql = buildProductionRetailExecutionSql(plan);
  const candidateRootSha256 = sha256(Buffer.from(plan.candidates.map((row) => row.fingerprintSha256).sort().join("\n"), "utf8"));
  const manifest = {
    status: "AWAITING_SEPARATE_OWNER_PRODUCTION_EXECUTION_APPROVAL",
    productionProjectRef: PRODUCTION_RETAIL_PROFILE.projectRef,
    sourceMainSha: "d77e0213b354c39d855993cd6fd5a93e8da10bf0",
    fixedInputSha256: PRODUCTION_RETAIL_PROFILE.retailPackageSha256,
    packageRootSha256: PRODUCTION_RETAIL_PROFILE.packageRootSha256,
    sqlSha256: sha256(Buffer.from(executionSql, "utf8")),
    sqlByteSize: Buffer.byteLength(executionSql, "utf8"),
    candidateRootSha256,
    planned: {
      metricDefinitions: 1,
      companyMappings: EXECUTION_PROFILE.expectedCompanyMappings,
      storeMappings: EXECUTION_PROFILE.expectedStoreMappings,
      sourceFiles: 1,
      importBatches: EXECUTION_PROFILE.expectedMonths,
      rawRows: EXECUTION_PROFILE.expectedCandidates,
      stagingRows: EXECUTION_PROFILE.expectedCandidates,
      canonicalInserts: EXECUTION_PROFILE.expectedCandidates,
      existingRateUnchanged: EXECUTION_PROFILE.expectedExistingRates,
      rateInsert: 0,
      rateUpdate: 0,
      companyFactInsert: 0,
      nonSalonInsert: 0,
    },
    approvalGate: {
      setting: EXECUTION_PROFILE.approvalGateSetting,
      requiredValue: EXECUTION_PROFILE.approvalGateValue,
      suppliedByArtifact: false,
    },
    productionWriteExecuted: false,
    deployExecuted: false,
  };
  mkdirSync(dirname(sqlPath), { recursive: true });
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(sqlPath, executionSql, "utf8");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) result[argv[index]?.replace(/^--/u, "")] = argv[index + 1];
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  assert(args.retail && args.sql && args.manifest, "RETAIL_SQL_MANIFEST_PATHS_REQUIRED");
  process.stdout.write(`${JSON.stringify(generateProductionRetailExecution({
    retailPath: args.retail,
    sqlPath: args.sql,
    manifestPath: args.manifest,
  }), null, 2)}\n`);
}
