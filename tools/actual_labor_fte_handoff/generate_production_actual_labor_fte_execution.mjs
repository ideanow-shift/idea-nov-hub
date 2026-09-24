import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import {
  KYARA_HALF_OWNER_DECISION,
  PRODUCTION_ACTUAL_LABOR_FTE_PROFILE,
  buildProductionActualLaborFteLoadPlan,
} from "./prepare_production_actual_labor_fte_load.mjs";

export const EXECUTION_PROFILE = Object.freeze({
  approvalGateSetting: "app.store_operations_actual_labor_fte_execution_approval",
  approvalGateValue: "OWNER_APPROVAL_REQUIRED_AFTER_CORRECTED_FIXED_SHA_REVIEW",
  mappingSourceSystem: "store_ops_actual_labor_fte_20260924_v2",
  sourceSystem: "actual_labor_fte_handoff_v1",
  sourceType: "actual_labor_fte_handoff_v1",
  sourceFileName: "01_実労働FTE_CORE_DB引継ぎパッケージ.json",
  expectedCompanyMappings: 6,
  expectedStoreMappings: 20,
  expectedMonths: 36,
  expectedCandidates: 671,
  supersededExecutedFailedSqlSha256: "76CD092C7D3CBE3756FBA6DC2D97C044652052623D59EDFB3BF1911DA8BDB7E6",
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

export function buildProductionActualLaborFteExecutionSql(plan, profile = EXECUTION_PROFILE) {
  assert(plan?.databaseWriteCapability === false, "REVIEWED_WRITE_INCAPABLE_PLAN_REQUIRED");
  const candidates = sortedRows(plan);
  assert(candidates.length === profile.expectedCandidates, "EXECUTION_CANDIDATE_COUNT_MISMATCH");
  const kyaraDecision = plan.ownerDecisions?.kyaraHalfCorporateAffiliation;
  assert(kyaraDecision?.decisionId === KYARA_HALF_OWNER_DECISION.decisionId
    && kyaraDecision.canonicalRows === 36
    && kyaraDecision.promotedLegacyStagingOnlyRows === 5, "EXECUTION_KYARA_HALF_OWNER_DECISION_MISSING");
  const storeMasterResolution = plan.productionStoreMasterResolution;
  assert(storeMasterResolution?.stableKey === "store_no+corporation_id"
    && storeMasterResolution.exactMatches === 20
    && storeMasterResolution.missingMatches === 0
    && storeMasterResolution.ambiguousMatches === 0
    && storeMasterResolution.correctedUuidCount === 18,
  "EXECUTION_PRODUCTION_STORE_MASTER_RESOLUTION_INVALID");

  const companies = new Map();
  const stores = new Map();
  const monthOrdinals = new Map();
  const rows = candidates.map((candidate) => {
    const priorCompany = companies.get(candidate.company_mapping_entity_key);
    assert(!priorCompany || priorCompany.companyId === candidate.company_id, "EXECUTION_COMPANY_MAPPING_CONFLICT");
    companies.set(candidate.company_mapping_entity_key, {
      companyId: candidate.company_id,
      companyNo: candidate.source_company_no,
    });
    const priorStore = stores.get(candidate.store_mapping_entity_key);
    assert(!priorStore || (priorStore.storeId === candidate.store_id && priorStore.companyId === candidate.company_id), "EXECUTION_STORE_MAPPING_CONFLICT");
    stores.set(candidate.store_mapping_entity_key, {
      storeId: candidate.store_id,
      companyId: candidate.company_id,
      storeCode: candidate.source_store_code,
      label: candidate.source_unit_key,
    });
    const ordinal = (monthOrdinals.get(candidate.fiscal_month) ?? 0) + 1;
    monthOrdinals.set(candidate.fiscal_month, ordinal);
    return { candidate, ordinal };
  });
  assert(companies.size === profile.expectedCompanyMappings, "EXECUTION_COMPANY_MAPPING_COUNT_MISMATCH");
  assert(stores.size === profile.expectedStoreMappings, "EXECUTION_STORE_MAPPING_COUNT_MISMATCH");
  assert(monthOrdinals.size === profile.expectedMonths, "EXECUTION_MONTH_COUNT_MISMATCH");

  const actor = PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.actorEmployeeId;
  const packageSha = PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.handoffPackageSha256.toLowerCase();
  const workbookSha = PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.sourceWorkbookSha256;
  const julyRows = candidates.filter((row) => row.fiscal_month === "2026-07-01");
  const julyStoredQuantity = julyRows.reduce((sum, row) => sum + row.quantity, 0).toFixed(4);
  const julySourceQuantity = julyRows.reduce((sum, row) => sum + row.source_value_quantity, 0).toFixed(10);

  const companyValues = [...companies.entries()].sort().map(([sourceKey, value]) =>
    `(${sql(profile.mappingSourceSystem)},'company',${sql(sourceKey)},${sql(value.companyNo)},${sql(value.companyId)}::uuid,null::uuid,${sql(mappingEvidence("company", sourceKey, value.companyId))},'active',${sql(actor)}::uuid,statement_timestamp())`
  ).join(",\n    ");
  const storeValues = [...stores.entries()].sort().map(([sourceKey, value]) =>
    `(${sql(profile.mappingSourceSystem)},'store',${sql(sourceKey)},${sql(value.label)},null::uuid,${sql(value.storeId)}::uuid,${sql(mappingEvidence("store", sourceKey, value.storeId))},'active',${sql(actor)}::uuid,statement_timestamp())`
  ).join(",\n    ");
  const companyBaselineValues = [...companies.values()].sort((a, b) => a.companyNo.localeCompare(b.companyNo))
    .map((value) => `(${sql(value.companyNo)},${sql(value.companyId)}::uuid)`).join(",\n      ");
  const storeBaselineValues = [...stores.values()].sort((a, b) => a.storeCode.localeCompare(b.storeCode))
    .map((value) => `(${sql(value.storeId)}::uuid,${sql(value.storeCode)},${sql(value.companyId)}::uuid)`).join(",\n      ");
  const storeKeyBaselineValues = [...stores.values()].sort((a, b) => a.storeCode.localeCompare(b.storeCode))
    .map((value) => `(${sql(value.storeCode)},${sql(value.companyId)}::uuid)`).join(",\n      ");
  const batchValues = [...monthOrdinals.keys()].sort().map((month) =>
    `(${sql(month)}::date,${sql(actor)}::uuid,${sql(actor)}::uuid)`).join(",\n    ");
  const rawValues = rows.map(({ candidate, ordinal }) =>
    `(${sql(candidate.fiscal_month)}::date,${ordinal},${jsonSql(candidate)},${sql(sha256(Buffer.from(JSON.stringify(candidate), "utf8")).toLowerCase())})`
  ).join(",\n    ");

  return `-- CORRECTED EXECUTION PACKAGE V2. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL FOR THIS FILE SHA.
-- Supersedes executed-failed SQL SHA-256: ${profile.supersededExecutedFailedSqlSha256}
-- Prior attempt stopped at PRODUCTION_BASELINE_GATE_FAILED and rolled back atomically; Production write rows: 0.
-- Production project: ${PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.projectRef}
-- Fixed aggregate handoff SHA-256: ${PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.handoffPackageSha256}
-- Fixed source workbook SHA-256: ${PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.sourceWorkbookSha256}
-- Planned ACTUAL_LABOR_FTE inserts: ${profile.expectedCandidates}; employee audit rows included: 0.
-- Owner decision: ${kyaraDecision.decisionId}; confirmed ${kyaraDecision.confirmedDate}.
-- KYARA HALF is an IDEA NOV directly managed store for all 36 months from 2023-09 through 2026-08.
-- The five months 2023-09 through 2024-01 are canonical under this Owner-confirmed affiliation.
-- Store UUIDs were resolved read-only from active Production master rows by store_no + corporation_id; names were not used.
-- Resolution: exact=20 missing=0 ambiguous=0 corrected_uuid=18 unchanged_uuid=2.
-- This file is atomic. Any failed gate rolls the entire transaction back.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
select pg_advisory_xact_lock(hashtextextended('store-operations-actual-labor-fte-20260924-v2', 0));

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
  fact_count integer;
  source_count integer;
  mapping_count integer;
  company_count integer;
  store_key_count integer;
  store_count integer;
  kyara_master_count integer;
begin
  select count(*) into actor_count from public.employees
    where id=${sql(actor)}::uuid and is_active;
  select count(*) into definition_count from dbf_ingest.metric_definitions
    where metric_code='ACTUAL_LABOR_FTE';
  select count(*) into fact_count from public.dbf_store_monthly_metric_facts
    where metric_code='ACTUAL_LABOR_FTE' and is_active;
  select count(*) into source_count from dbf_ingest.source_files
    where source_system=${sql(profile.sourceSystem)} and sha256=${sql(packageSha)};
  select count(*) into mapping_count from dbf_ingest.entity_mappings
    where source_system=${sql(profile.mappingSourceSystem)};
  select count(*) into company_count
  from public.corporations c
  join (values
      ${companyBaselineValues}
  ) v(corporation_no,id) on c.corporation_no=v.corporation_no and c.id=v.id;
  select count(*) into store_count
  from public.stores s
  join (values
      ${storeBaselineValues}
  ) v(id,store_no,corporation_id)
    on s.id=v.id and s.store_no=v.store_no and s.corporation_id=v.corporation_id
  where s.is_active and s.store_no<>'0000';
  select count(*) into store_key_count
  from (
    select v.store_no,v.corporation_id,count(s.id) as active_match_count
    from (values
      ${storeKeyBaselineValues}
    ) v(store_no,corporation_id)
    left join public.stores s
      on s.store_no=v.store_no and s.corporation_id=v.corporation_id and s.is_active
    group by v.store_no,v.corporation_id
    having count(s.id)=1
  ) exact_stable_keys;
  select count(*) into kyara_master_count from public.stores
    where id=${sql(kyaraDecision.storeId)}::uuid
      and store_no=${sql(kyaraDecision.storeCode)}
      and corporation_id=${sql(kyaraDecision.companyId)}::uuid
      and store_type=${sql(kyaraDecision.storeType)}
      and is_active;
  if actor_count<>1 or definition_count<>0 or fact_count<>0
     or source_count<>0 or mapping_count<>0
     or company_count<>${profile.expectedCompanyMappings}
     or store_key_count<>${profile.expectedStoreMappings} or store_count<>${profile.expectedStoreMappings}
     or kyara_master_count<>1 then
    raise exception 'PRODUCTION_BASELINE_GATE_FAILED actor=% definition=% fact=% source=% mapping=% company=% store_key=% store=% kyara_master=%',
      actor_count,definition_count,fact_count,source_count,mapping_count,company_count,store_key_count,store_count,kyara_master_count;
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
    'RETAIL_PURCHASE_RATE','RETAIL_PURCHASE_CUSTOMER_VISITS','OPERATING_PROFIT','ACTUAL_LABOR_FTE'
  ));
insert into dbf_ingest.metric_definitions
  (metric_code,definition_version,value_kind,display_name,description,is_active)
values ('ACTUAL_LABOR_FTE','ACTUAL_LABOR_FTE_173_76_V1','quantity',
  '実労働FTE（換算人数）','タイムカード実績を同月の正本FTE店舗配属比で店舗配賦した労働時間を173.76時間で除した月次FTE。欠損は0にせず行なし。',true);

insert into dbf_ingest.entity_mappings
  (source_system,entity_type,source_key,source_label,company_id,store_id,
   canonical_evidence_sha256,status,confirmed_by_employee_id,confirmed_at)
values
    ${companyValues},
    ${storeValues};

insert into dbf_ingest.source_files
  (sha256,byte_size,original_file_name,media_type,source_system,received_by_employee_id,received_via)
values (${sql(packageSha)},${PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.handoffPackageByteSize},${sql(profile.sourceFileName)},
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
  'ACTUAL_LABOR_FTE',(candidate.payload->>'quantity')::numeric,
  'detail','resolved','valid',candidate.payload
from candidate
join dbf_ingest.entity_mappings company_map
  on company_map.source_system=${sql(profile.mappingSourceSystem)} and company_map.entity_type='company'
  and company_map.source_key=candidate.payload->>'company_mapping_entity_key' and company_map.status='active'
join dbf_ingest.entity_mappings store_map
  on store_map.source_system=${sql(profile.mappingSourceSystem)} and store_map.entity_type='store'
  and store_map.source_key=candidate.payload->>'store_mapping_entity_key' and store_map.status='active'
where candidate.payload->>'source_scope'='STORE'
  and candidate.payload->>'metric_code'='ACTUAL_LABOR_FTE'
  and candidate.payload->>'definition_version'='ACTUAL_LABOR_FTE_173_76_V1'
  and candidate.payload->>'source_workbook_sha256'=${sql(workbookSha)}
  and (candidate.payload->>'actual_punch_store')::boolean=false
  and (candidate.payload->>'shift_backfill')::boolean=false;

do $promotion_gate$
declare
  raw_count integer;
  stage_count integer;
  invalid_count integer;
  duplicate_count integer;
  hq_count integer;
  kyara_count integer;
  kyara_promoted_count integer;
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
      and (s.mapping_status<>'resolved' or s.validation_status<>'valid' or s.quantity<=0
        or s.normalized_payload->>'source_scope'<>'STORE'
        or s.normalized_payload->>'metric_code'<>'ACTUAL_LABOR_FTE'
        or s.normalized_payload->>'definition_version'<>'ACTUAL_LABOR_FTE_173_76_V1'
        or s.normalized_payload->>'source_workbook_sha256'<>${sql(workbookSha)}
        or (s.normalized_payload->>'actual_punch_store')::boolean
        or (s.normalized_payload->>'shift_backfill')::boolean
        or abs((s.normalized_payload->>'allocated_actual_work_hours')::numeric
          - (s.normalized_payload->>'allocated_actual_work_minutes')::numeric/60)>0.000001
        or abs((s.normalized_payload->>'source_value_quantity')::numeric
          - (s.normalized_payload->>'allocated_actual_work_hours')::numeric/173.76)>0.000000001
        or abs(s.quantity-(s.normalized_payload->>'source_value_quantity')::numeric)>0.00005);
  select count(*) into duplicate_count from (
    select b.fiscal_month,s.company_id,s.store_id,s.metric_code,count(*)
    from dbf_ingest.staging_rows s
    join dbf_ingest.import_batches b on b.id=s.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)}
    group by b.fiscal_month,s.company_id,s.store_id,s.metric_code having count(*)<>1
  ) d;
  select count(*) into hq_count from dbf_ingest.staging_rows s
    join public.stores st on st.id=s.store_id
    join dbf_ingest.import_batches b on b.id=s.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)}
      and st.store_no='0000';
  select count(*),count(*) filter (where b.fiscal_month in (
      '2023-09-01'::date,'2023-10-01'::date,'2023-11-01'::date,'2023-12-01'::date,'2024-01-01'::date
    )) into kyara_count,kyara_promoted_count
  from dbf_ingest.staging_rows s
  join dbf_ingest.import_batches b on b.id=s.batch_id
  join dbf_ingest.source_files f on f.id=b.source_file_id
  where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)}
    and s.normalized_payload->>'source_unit_key'=${sql(kyaraDecision.unitKey)}
    and s.normalized_payload->>'source_company_no'=${sql(kyaraDecision.companyNo)}
    and s.normalized_payload->>'company_id'=${sql(kyaraDecision.companyId)}
    and s.normalized_payload->>'store_id'=${sql(kyaraDecision.storeId)}
    and s.normalized_payload->>'canonical_store_type'=${sql(kyaraDecision.storeType)}
    and s.normalized_payload->>'corporate_affiliation_basis'=${sql(kyaraDecision.decisionId)};
  if raw_count<>${profile.expectedCandidates} or stage_count<>${profile.expectedCandidates}
     or invalid_count<>0 or duplicate_count<>0 or hq_count<>0
     or kyara_count<>${kyaraDecision.expectedCanonicalRows}
     or kyara_promoted_count<>${kyaraDecision.promotedLegacyStagingOnlyRows} then
    raise exception 'PRODUCTION_PROMOTION_GATE_FAILED raw=% stage=% invalid=% duplicate=% hq=% kyara=% kyara_promoted=%',
      raw_count,stage_count,invalid_count,duplicate_count,hq_count,kyara_count,kyara_promoted_count;
  end if;
end
$promotion_gate$;

insert into public.dbf_store_monthly_metric_facts
  (fiscal_month,company_id,store_id,metric_code,quantity,definition_version,source_type,
   source_file_id,batch_id,imported_by_employee_id,version,status,is_active)
select b.fiscal_month,s.company_id,s.store_id,'ACTUAL_LABOR_FTE',s.quantity,
  'ACTUAL_LABOR_FTE_173_76_V1',${sql(profile.sourceType)},b.source_file_id,b.id,
  ${sql(actor)}::uuid,1,'confirmed',true
from dbf_ingest.staging_rows s
join dbf_ingest.import_batches b on b.id=s.batch_id
join dbf_ingest.source_files f on f.id=b.source_file_id
where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)}
  and s.mapping_status='resolved' and s.validation_status='valid';

insert into dbf_ingest.import_events
  (batch_id,event_type,from_status,to_status,actor_employee_id,reason_code,summary)
select b.id,'store_operations_actual_labor_fte_promoted','approved','promoted',${sql(actor)}::uuid,
  'OWNER_APPROVED_FIXED_PACKAGE',
  jsonb_build_object('package_sha256',${sql(packageSha)},'source_workbook_sha256',${sql(workbookSha)},'metric_code','ACTUAL_LABOR_FTE')
from dbf_ingest.import_batches b join dbf_ingest.source_files f on f.id=b.source_file_id
where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)};

update dbf_ingest.import_batches b
set status='promoted',promoted_at=statement_timestamp()
from dbf_ingest.source_files f
where f.id=b.source_file_id and f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)};

do $readback$
declare
  definition_count integer;
  fact_count integer;
  source_count integer;
  batch_count integer;
  raw_count integer;
  stage_count integer;
  event_count integer;
  duplicate_count integer;
  mapping_count integer;
  store_count integer;
  july_count integer;
  july_quantity numeric;
begin
  select count(*) into definition_count from dbf_ingest.metric_definitions
    where metric_code='ACTUAL_LABOR_FTE' and definition_version='ACTUAL_LABOR_FTE_173_76_V1';
  select count(*) into fact_count from public.dbf_store_monthly_metric_facts f
    join dbf_ingest.source_files sf on sf.id=f.source_file_id
    where f.metric_code='ACTUAL_LABOR_FTE' and f.is_active
      and sf.source_system=${sql(profile.sourceSystem)} and sf.sha256=${sql(packageSha)};
  select count(*) into source_count from dbf_ingest.source_files
    where source_system=${sql(profile.sourceSystem)} and sha256=${sql(packageSha)};
  select count(*) into batch_count from dbf_ingest.import_batches b join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)} and b.status='promoted';
  select count(*) into raw_count from dbf_ingest.raw_rows rr join dbf_ingest.import_batches b on b.id=rr.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)};
  select count(*) into stage_count from dbf_ingest.staging_rows s join dbf_ingest.import_batches b on b.id=s.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)};
  select count(*) into event_count from dbf_ingest.import_events e join dbf_ingest.import_batches b on b.id=e.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(packageSha)}
      and e.event_type='store_operations_actual_labor_fte_promoted';
  select count(*) into duplicate_count from (
    select fiscal_month,company_id,store_id,metric_code,count(*)
    from public.dbf_store_monthly_metric_facts
    where metric_code='ACTUAL_LABOR_FTE' and is_active
    group by fiscal_month,company_id,store_id,metric_code having count(*)<>1
  ) d;
  select count(*) into mapping_count from dbf_ingest.entity_mappings
    where source_system=${sql(profile.mappingSourceSystem)} and status='active';
  select count(distinct store_id) into store_count from public.dbf_store_monthly_metric_facts
    where metric_code='ACTUAL_LABOR_FTE' and is_active;
  select count(*),sum(quantity) into july_count,july_quantity
    from public.dbf_store_monthly_metric_facts
    where metric_code='ACTUAL_LABOR_FTE' and is_active and fiscal_month='2026-07-01'::date;
  if definition_count<>1 or fact_count<>${profile.expectedCandidates} or source_count<>1
     or batch_count<>${profile.expectedMonths} or raw_count<>${profile.expectedCandidates}
     or stage_count<>${profile.expectedCandidates} or event_count<>${profile.expectedMonths}
     or duplicate_count<>0 or mapping_count<>${profile.expectedCompanyMappings + profile.expectedStoreMappings}
     or store_count<>${profile.expectedStoreMappings} or july_count<>20 or july_quantity<>${julyStoredQuantity}::numeric then
    raise exception 'PRODUCTION_READBACK_GATE_FAILED definition=% fact=% source=% batch=% raw=% stage=% event=% duplicate=% mapping=% store=% july_count=% july_quantity=%',
      definition_count,fact_count,source_count,batch_count,raw_count,stage_count,event_count,duplicate_count,mapping_count,store_count,july_count,july_quantity;
  end if;
end
$readback$;

commit;

select
  (select count(*) from public.dbf_store_monthly_metric_facts where metric_code='ACTUAL_LABOR_FTE' and is_active) as actual_labor_fte_facts,
  (select count(distinct store_id) from public.dbf_store_monthly_metric_facts where metric_code='ACTUAL_LABOR_FTE' and is_active) as visible_stores,
  (select sum(quantity) from public.dbf_store_monthly_metric_facts where metric_code='ACTUAL_LABOR_FTE' and is_active and fiscal_month='2026-07-01'::date) as july_2026_stored_fte,
  ${julySourceQuantity}::numeric as july_2026_source_fte_before_storage_rounding;
`;
}

export function generateProductionActualLaborFteExecution({ sourcePath, sqlPath, manifestPath }) {
  const bytes = readFileSync(sourcePath);
  assert(bytes.length === PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.handoffPackageByteSize, "ACTUAL_LABOR_FTE_PACKAGE_BYTE_SIZE_MISMATCH");
  assert(sha256(bytes) === PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.handoffPackageSha256, "ACTUAL_LABOR_FTE_PACKAGE_SHA256_MISMATCH");
  const plan = buildProductionActualLaborFteLoadPlan(JSON.parse(bytes.toString("utf8")));
  const executionSql = buildProductionActualLaborFteExecutionSql(plan);
  const candidateRootSha256 = sha256(Buffer.from(plan.candidates.map((row) => row.fingerprintSha256).sort().join("\n"), "utf8"));
  const manifest = {
    status: "AWAITING_SEPARATE_OWNER_PRODUCTION_EXECUTION_APPROVAL",
    productionProjectRef: PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.projectRef,
    sourceMainSha: "4f81fd455dead5911b1c63cbf8bf8c17c0550bbe",
    fixedInputSha256: PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.handoffPackageSha256,
    fixedInputByteSize: PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.handoffPackageByteSize,
    sourceWorkbookSha256: PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.sourceWorkbookSha256,
    correctedWorkbookSha256: PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.correctedWorkbookSha256,
    packageRootSha256: PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.packageRootSha256,
    sqlSha256: sha256(Buffer.from(executionSql, "utf8")),
    sqlByteSize: Buffer.byteLength(executionSql, "utf8"),
    candidateRootSha256,
    ownerDecision: plan.ownerDecisions.kyaraHalfCorporateAffiliation,
    productionStoreMasterResolution: plan.productionStoreMasterResolution,
    correction: {
      version: 2,
      supersedesExecutedFailedSqlSha256: EXECUTION_PROFILE.supersededExecutedFailedSqlSha256,
      priorExecution: {
        result: "PRODUCTION_BASELINE_GATE_FAILED",
        observedCounts: { actor: 1, definition: 0, fact: 0, source: 0, mapping: 0, company: 6, store: 2, kyaraMaster: 1 },
        transactionOutcome: "ATOMIC_ROLLBACK",
        productionWriteRows: 0,
      },
    },
    planned: {
      metricDefinitions: 1,
      companyMappings: EXECUTION_PROFILE.expectedCompanyMappings,
      storeMappings: EXECUTION_PROFILE.expectedStoreMappings,
      sourceFiles: 1,
      importBatches: EXECUTION_PROFILE.expectedMonths,
      rawRows: EXECUTION_PROFILE.expectedCandidates,
      stagingRows: EXECUTION_PROFILE.expectedCandidates,
      canonicalInserts: EXECUTION_PROFILE.expectedCandidates,
      canonicalSupersedes: 0,
      canonicalUnchanged: 0,
      employeeAuditRows: 0,
      headquartersRows: 0,
      unmatchedRows: 0,
      ambiguousRows: 0,
    },
    july2026: {
      stores: 20,
      sourceMinutes: PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.expectedJuly2026Minutes,
      sourceHours: PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.expectedJuly2026Hours,
      sourceFte: PRODUCTION_ACTUAL_LABOR_FTE_PROFILE.expectedJuly2026FteSource,
      storedFteAfterNumeric20_4Rounding: Number(
        plan.candidates
          .filter(({ candidate }) => candidate.fiscal_month === "2026-07-01")
          .reduce((sum, { candidate }) => sum + candidate.quantity, 0)
          .toFixed(4),
      ),
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
  assert(args.source && args.sql && args.manifest, "ACTUAL_LABOR_FTE_SOURCE_SQL_MANIFEST_PATHS_REQUIRED");
  process.stdout.write(`${JSON.stringify(generateProductionActualLaborFteExecution({
    sourcePath: args.source,
    sqlPath: args.sql,
    manifestPath: args.manifest,
  }), null, 2)}\n`);
}
