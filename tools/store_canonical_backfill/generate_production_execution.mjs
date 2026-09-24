import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  CANONICAL_BACKFILL_PROFILE,
  buildHistoricalStoreActualPlan,
  sha256,
} from "./prepare_historical_store_actuals.mjs";

export const EXECUTION_PROFILE = Object.freeze({
  approvalGateSetting: "app.store_operations_canonical_backfill_approval",
  approvalGateValue: "OWNER_APPROVAL_REQUIRED_AFTER_FIXED_SHA_REVIEW",
  mappingSourceSystem: "store_ops_retail_purchase_20260921_v1",
  sourceSystem: "pos_canonical_store_actual_backfill_v1",
  sourceType: "pos_canonical_historical_backfill_v1",
  sourceFileName: "POS_Canonical_Store_Monthly_Actual.csv",
  expectedCompanyMappings: 6,
  expectedStoreMappings: 21,
  expectedMappings: 27,
  expectedDefinitions: 9,
  expectedUnchanged: 4192,
  expectedCorrections: 227,
  expectedWriteRows: 9230,
  expectedWriteMonths: 83,
});

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function sql(value) {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonSql(value) {
  return `${sql(JSON.stringify(value))}::jsonb`;
}

function candidatePayload(candidate) {
  return {
    fiscal_month: candidate.fiscal_month,
    company_id: candidate.company_id,
    company_mapping_entity_key: `company:${candidate.source_company_no}`,
    store_id: candidate.store_id,
    store_mapping_entity_key: candidate.store_mapping_entity_key,
    source_unit_key: candidate.source_unit_key,
    metric_code: candidate.metric_code,
    value_kind: candidate.value_kind,
    value: candidate.value,
    source_value: candidate.source_value,
    definition_version: candidate.definition_version,
    canonical_record_id: candidate.canonical_record_id,
    canonical_source_sha256: candidate.canonical_source_sha256,
    source_file_name: candidate.source_file_name,
    source_sheet: candidate.source_sheet,
    source_cell: candidate.source_cell,
    source_period: candidate.source_period,
    source_validation_status: candidate.source_validation_status,
  };
}

function expectedValues(plan) {
  return plan.candidates.map(({ candidate, fingerprintSha256 }) => {
    const payload = candidatePayload(candidate);
    return `(${sql(candidate.fiscal_month)}::date,${sql(candidate.company_id)}::uuid,${sql(candidate.store_id)}::uuid,${sql(candidate.metric_code)},${sql(candidate.value_kind)},${sql(candidate.value)}::numeric,${sql(candidate.classification)},${jsonSql(payload)},${sql(sha256(Buffer.from(JSON.stringify(payload), "utf8")).toLowerCase())},${sql(fingerprintSha256.toLowerCase())})`;
  }).join(",\n    ");
}

export function buildProductionExecutionSql(plan, profile = EXECUTION_PROFILE) {
  assert(plan?.databaseWriteCapability === false, "WRITE_INCAPABLE_PLAN_REQUIRED");
  assert(plan.candidates.length === CANONICAL_BACKFILL_PROFILE.expectedCandidates, "EXECUTION_CANDIDATE_COUNT_MISMATCH");
  const expected = expectedValues(plan);
  const actor = CANONICAL_BACKFILL_PROFILE.actorEmployeeId;
  const csvSha = CANONICAL_BACKFILL_PROFILE.canonicalCsvSha256.toLowerCase();
  const metrics = Object.freeze(["TOTAL_SALES", "TECHNICAL_SALES", "RETAIL_SALES", "TOTAL_CUSTOMERS", "NEW_CUSTOMERS", "TOTAL_UNIT_PRICE", "TECHNICAL_UNIT_PRICE", "TOTAL_PRODUCTIVITY", "TECHNICAL_PRODUCTIVITY"]);
  const metricList = metrics.map(sql).join(",");

  return `-- EXECUTION PACKAGE. DO NOT RUN WITHOUT A SEPARATE OWNER APPROVAL FOR THIS FILE SHA.
-- Production project: ${CANONICAL_BACKFILL_PROFILE.projectRef}
-- Fixed canonical CSV SHA-256: ${CANONICAL_BACKFILL_PROFILE.canonicalCsvSha256}
-- Fixed retail mapping package SHA-256: ${CANONICAL_BACKFILL_PROFILE.retailPackageSha256}
-- Planned missing-grain inserts: ${CANONICAL_BACKFILL_PROFILE.expectedInsert}; append-only corrections: ${profile.expectedCorrections}; exact unchanged: ${profile.expectedUnchanged}; unavailable preserved: ${CANONICAL_BACKFILL_PROFILE.expectedUnavailable}
-- Corrected facts are appended with lineage after the prior active version is invalidated. No fact value is updated or deleted.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '180s';
select pg_advisory_xact_lock(hashtextextended('store-operations-canonical-history-backfill-v1', 0));

do $approval$
begin
  if current_setting(${sql(profile.approvalGateSetting)}, true) is distinct from ${sql(profile.approvalGateValue)} then
    raise exception 'OWNER_APPROVAL_SETTING_REQUIRED_FOR_FIXED_EXECUTION_SHA';
  end if;
end
$approval$;

create temporary table expected_pos_canonical_backfill_v1 (
  fiscal_month date not null,
  company_id uuid not null,
  store_id uuid not null,
  metric_code text not null,
  value_kind text not null check (value_kind in ('amount','quantity')),
  expected_value numeric not null,
  classification text not null check (classification in ('insert','existing')),
  payload jsonb not null,
  payload_sha256 text not null,
  candidate_fingerprint_sha256 text not null,
  primary key (fiscal_month,company_id,store_id,metric_code)
) on commit drop;

insert into expected_pos_canonical_backfill_v1
  (fiscal_month,company_id,store_id,metric_code,value_kind,expected_value,classification,
   payload,payload_sha256,candidate_fingerprint_sha256)
values
    ${expected};

do $baseline$
declare
  actor_count integer; definition_count integer; mapping_count integer;
  company_count integer; store_count integer; source_count integer; batch_count integer;
  expected_count integer; insert_count integer; existing_count integer;
  existing_match_count integer; existing_mismatch_count integer; existing_missing_count integer; insert_collision_count integer;
begin
  select count(*) into actor_count from public.employees where id=${sql(actor)}::uuid and is_active;
  select count(*) into definition_count from dbf_ingest.metric_definitions
    where metric_code in (${metricList}) and definition_version='v1' and is_active;
  select count(*) into mapping_count from dbf_ingest.entity_mappings
    where source_system=${sql(profile.mappingSourceSystem)} and status='active';
  select count(*) into company_count from dbf_ingest.entity_mappings
    where source_system=${sql(profile.mappingSourceSystem)} and entity_type='company' and status='active';
  select count(*) into store_count from dbf_ingest.entity_mappings
    where source_system=${sql(profile.mappingSourceSystem)} and entity_type='store' and status='active';
  select count(*) into source_count from dbf_ingest.source_files
    where source_system=${sql(profile.sourceSystem)} and sha256=${sql(csvSha)};
  select count(*) into batch_count from dbf_ingest.import_batches b join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)};
  select count(*),count(*) filter (where classification='insert'),count(*) filter (where classification='existing')
  into expected_count,insert_count,existing_count
  from expected_pos_canonical_backfill_v1;
  select count(*) into existing_match_count
  from expected_pos_canonical_backfill_v1 e
  join public.dbf_store_monthly_metric_facts f
    on f.fiscal_month=e.fiscal_month and f.company_id=e.company_id and f.store_id=e.store_id
   and f.metric_code=e.metric_code and f.is_active
  where e.classification='existing'
    and case e.value_kind when 'amount' then f.amount when 'quantity' then f.quantity end = e.expected_value;
  select count(*) into existing_mismatch_count
  from expected_pos_canonical_backfill_v1 e
  join public.dbf_store_monthly_metric_facts f
    on f.fiscal_month=e.fiscal_month and f.company_id=e.company_id and f.store_id=e.store_id
   and f.metric_code=e.metric_code and f.is_active
  where e.classification='existing'
    and case e.value_kind when 'amount' then f.amount when 'quantity' then f.quantity end is distinct from e.expected_value;
  select count(*) into existing_missing_count
  from expected_pos_canonical_backfill_v1 e
  left join public.dbf_store_monthly_metric_facts f
    on f.fiscal_month=e.fiscal_month and f.company_id=e.company_id and f.store_id=e.store_id
   and f.metric_code=e.metric_code and f.is_active
  where e.classification='existing' and f.id is null;
  select count(*) into insert_collision_count
  from expected_pos_canonical_backfill_v1 e join public.dbf_store_monthly_metric_facts f
    on f.fiscal_month=e.fiscal_month and f.company_id=e.company_id and f.store_id=e.store_id
   and f.metric_code=e.metric_code and f.is_active
  where e.classification='insert';
  if actor_count<>1 or definition_count<>${profile.expectedDefinitions} or mapping_count<>${profile.expectedMappings}
     or company_count<>${profile.expectedCompanyMappings} or store_count<>${profile.expectedStoreMappings}
     or source_count<>0 or batch_count<>0 or expected_count<>${CANONICAL_BACKFILL_PROFILE.expectedCandidates}
     or insert_count<>${CANONICAL_BACKFILL_PROFILE.expectedInsert} or existing_count<>${CANONICAL_BACKFILL_PROFILE.expectedExisting}
     or existing_match_count<>${profile.expectedUnchanged} or existing_mismatch_count<>${profile.expectedCorrections}
     or existing_missing_count<>0 or insert_collision_count<>0 then
    raise exception 'CANONICAL_BACKFILL_BASELINE_FAILED actor=% definitions=% mappings=% companies=% stores=% source=% batches=% expected=% insert=% existing=% existing_match=% correction=% missing=% collision=%',
      actor_count,definition_count,mapping_count,company_count,store_count,source_count,batch_count,
      expected_count,insert_count,existing_count,existing_match_count,existing_mismatch_count,existing_missing_count,insert_collision_count;
  end if;
end
$baseline$;

create temporary table write_pos_canonical_backfill_v1 on commit drop as
select e.*,f.id as prior_fact_id,f.version as prior_version,
  case when e.classification='insert' then 'insert' else 'correction' end as write_action,
  row_number() over (partition by e.fiscal_month order by e.store_id,e.metric_code)::integer as source_row_number
from expected_pos_canonical_backfill_v1 e
left join public.dbf_store_monthly_metric_facts f
  on f.fiscal_month=e.fiscal_month and f.company_id=e.company_id and f.store_id=e.store_id
 and f.metric_code=e.metric_code and f.is_active
where e.classification='insert'
   or (e.classification='existing' and case e.value_kind when 'amount' then f.amount when 'quantity' then f.quantity end is distinct from e.expected_value);

do $write_plan_gate$
declare write_count integer; correction_count integer; write_month_count integer;
begin
  select count(*),count(*) filter (where write_action='correction'),count(distinct fiscal_month)
    into write_count,correction_count,write_month_count from write_pos_canonical_backfill_v1;
  if write_count<>${profile.expectedWriteRows} or correction_count<>${profile.expectedCorrections}
     or write_month_count<>${profile.expectedWriteMonths} then
    raise exception 'CANONICAL_BACKFILL_WRITE_PLAN_FAILED write=% correction=% months=%',write_count,correction_count,write_month_count;
  end if;
end
$write_plan_gate$;

insert into dbf_ingest.source_files
  (sha256,byte_size,original_file_name,media_type,source_system,received_by_employee_id,received_via)
values (${sql(csvSha)},${CANONICAL_BACKFILL_PROFILE.canonicalCsvByteSize},${sql(profile.sourceFileName)},
  'text/csv',${sql(profile.sourceSystem)},${sql(actor)}::uuid,'owner_fixed_sha_package');

with source as (
  select id from dbf_ingest.source_files where source_system=${sql(profile.sourceSystem)} and sha256=${sql(csvSha)}
), months as (
  select distinct fiscal_month from write_pos_canonical_backfill_v1
)
insert into dbf_ingest.import_batches
  (source_file_id,fact_kind,fiscal_month,source_type,status,revision,
   created_by_employee_id,approved_by_employee_id,approved_at)
select source.id,'store_operating_result',months.fiscal_month,${sql(profile.sourceType)},'approved',1,
  ${sql(actor)}::uuid,${sql(actor)}::uuid,statement_timestamp()
from source cross join months;

with source as (
  select id from dbf_ingest.source_files where source_system=${sql(profile.sourceSystem)} and sha256=${sql(csvSha)}
)
insert into dbf_ingest.raw_rows(batch_id,source_row_number,payload,payload_sha256)
select b.id,w.source_row_number,w.payload,w.payload_sha256
from write_pos_canonical_backfill_v1 w cross join source
join dbf_ingest.import_batches b on b.source_file_id=source.id and b.fiscal_month=w.fiscal_month
  and b.fact_kind='store_operating_result' and b.source_type=${sql(profile.sourceType)}
;

with source as (
  select id from dbf_ingest.source_files where source_system=${sql(profile.sourceSystem)} and sha256=${sql(csvSha)}
), candidate as (
  select rr.*,b.fiscal_month
  from source join dbf_ingest.import_batches b on b.source_file_id=source.id
    and b.fact_kind='store_operating_result' and b.source_type=${sql(profile.sourceType)}
  join dbf_ingest.raw_rows rr on rr.batch_id=b.id
)
insert into dbf_ingest.staging_rows
  (batch_id,raw_row_id,company_mapping_id,store_mapping_id,company_id,store_id,
   metric_code,amount,quantity,source_row_category,mapping_status,validation_status,normalized_payload)
select candidate.batch_id,candidate.id,company_map.id,store_map.id,
  (candidate.payload->>'company_id')::uuid,(candidate.payload->>'store_id')::uuid,
  candidate.payload->>'metric_code',
  case when candidate.payload->>'value_kind'='amount' then (candidate.payload->>'value')::numeric end,
  case when candidate.payload->>'value_kind'='quantity' then (candidate.payload->>'value')::numeric end,
  'detail','resolved','valid',candidate.payload
from candidate
join dbf_ingest.entity_mappings company_map
  on company_map.source_system=${sql(profile.mappingSourceSystem)} and company_map.entity_type='company'
 and company_map.source_key=candidate.payload->>'company_mapping_entity_key' and company_map.status='active'
join dbf_ingest.entity_mappings store_map
  on store_map.source_system=${sql(profile.mappingSourceSystem)} and store_map.entity_type='store'
 and store_map.source_key=candidate.payload->>'store_mapping_entity_key' and store_map.status='active';

do $promotion_gate$
declare raw_count integer; stage_count integer; invalid_count integer;
begin
  select count(*) into raw_count from dbf_ingest.raw_rows rr join dbf_ingest.import_batches b on b.id=rr.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)};
  select count(*) into stage_count from dbf_ingest.staging_rows s join dbf_ingest.import_batches b on b.id=s.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)};
  select count(*) into invalid_count from dbf_ingest.staging_rows s join dbf_ingest.import_batches b on b.id=s.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)}
      and (s.mapping_status<>'resolved' or s.validation_status<>'valid'
        or (s.amount is null)=(s.quantity is null));
  if raw_count<>${profile.expectedWriteRows} or stage_count<>${profile.expectedWriteRows} or invalid_count<>0 then
    raise exception 'CANONICAL_BACKFILL_PROMOTION_GATE_FAILED raw=% stage=% invalid=%',raw_count,stage_count,invalid_count;
  end if;
end
$promotion_gate$;

update public.dbf_store_monthly_metric_facts old
set is_active=false,superseded_at=statement_timestamp()
from write_pos_canonical_backfill_v1 w
where w.write_action='correction' and old.id=w.prior_fact_id and old.is_active;

insert into public.dbf_store_monthly_metric_facts
  (fiscal_month,company_id,store_id,metric_code,amount,quantity,definition_version,source_type,
   source_file_id,batch_id,imported_by_employee_id,version,status,is_active,
   correction_of_fact_id,correction_reason)
select b.fiscal_month,s.company_id,s.store_id,s.metric_code,s.amount,s.quantity,'v1',${sql(profile.sourceType)},
  b.source_file_id,b.id,${sql(actor)}::uuid,coalesce(w.prior_version+1,1),'confirmed',true,
  w.prior_fact_id,case when w.write_action='correction' then 'LATEST_CANONICAL_SOURCE_RECONCILIATION' end
from dbf_ingest.staging_rows s
join dbf_ingest.import_batches b on b.id=s.batch_id
join dbf_ingest.source_files f on f.id=b.source_file_id
join write_pos_canonical_backfill_v1 w
  on w.fiscal_month=b.fiscal_month and w.company_id=s.company_id and w.store_id=s.store_id and w.metric_code=s.metric_code
where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)}
  and s.mapping_status='resolved' and s.validation_status='valid'
on conflict (fiscal_month,company_id,store_id,metric_code) where is_active do nothing;

insert into dbf_ingest.import_events
  (batch_id,event_type,from_status,to_status,actor_employee_id,reason_code,summary)
select b.id,'store_operations_canonical_history_promoted','approved','promoted',${sql(actor)}::uuid,
  'OWNER_APPROVED_FIXED_PACKAGE',jsonb_build_object('canonical_csv_sha256',${sql(csvSha)},'write_count',${profile.expectedWriteRows},'correction_count',${profile.expectedCorrections})
from dbf_ingest.import_batches b join dbf_ingest.source_files f on f.id=b.source_file_id
where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)};

update dbf_ingest.import_batches b
set status='promoted',promoted_at=statement_timestamp()
from dbf_ingest.source_files f
where f.id=b.source_file_id and f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)};

do $readback$
declare source_count integer; batch_count integer; raw_count integer; stage_count integer;
  inserted_count integer; correction_count integer; superseded_count integer;
  all_match_count integer; mismatch_count integer; duplicate_count integer;
begin
  select count(*) into source_count from dbf_ingest.source_files
    where source_system=${sql(profile.sourceSystem)} and sha256=${sql(csvSha)};
  select count(*) into batch_count from dbf_ingest.import_batches b join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)} and b.status='promoted';
  select count(*) into raw_count from dbf_ingest.raw_rows rr join dbf_ingest.import_batches b on b.id=rr.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)};
  select count(*) into stage_count from dbf_ingest.staging_rows s join dbf_ingest.import_batches b on b.id=s.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id where f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)};
  select count(*) into inserted_count from public.dbf_store_monthly_metric_facts fact join dbf_ingest.source_files f on f.id=fact.source_file_id
    where fact.is_active and f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)};
  select count(*) into correction_count from public.dbf_store_monthly_metric_facts fact join dbf_ingest.source_files f on f.id=fact.source_file_id
    where fact.is_active and fact.correction_of_fact_id is not null
      and f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)};
  select count(*) into superseded_count from public.dbf_store_monthly_metric_facts old
    join public.dbf_store_monthly_metric_facts replacement on replacement.correction_of_fact_id=old.id
    join dbf_ingest.source_files f on f.id=replacement.source_file_id
    where not old.is_active and old.superseded_at is not null and replacement.is_active
      and f.source_system=${sql(profile.sourceSystem)} and f.sha256=${sql(csvSha)};
  select count(*) into all_match_count from expected_pos_canonical_backfill_v1 e
    join public.dbf_store_monthly_metric_facts f on f.fiscal_month=e.fiscal_month and f.company_id=e.company_id
     and f.store_id=e.store_id and f.metric_code=e.metric_code and f.is_active
    where case e.value_kind when 'amount' then f.amount when 'quantity' then f.quantity end=e.expected_value;
  select count(*) into mismatch_count from expected_pos_canonical_backfill_v1 e
    left join public.dbf_store_monthly_metric_facts f on f.fiscal_month=e.fiscal_month and f.company_id=e.company_id
     and f.store_id=e.store_id and f.metric_code=e.metric_code and f.is_active
    where f.id is null or case e.value_kind when 'amount' then f.amount when 'quantity' then f.quantity end is distinct from e.expected_value;
  select count(*) into duplicate_count from (
    select fiscal_month,company_id,store_id,metric_code,count(*) from public.dbf_store_monthly_metric_facts
    where metric_code in (${metricList}) and is_active
    group by fiscal_month,company_id,store_id,metric_code having count(*)<>1
  ) d;
  if source_count<>1 or batch_count<>${profile.expectedWriteMonths} or raw_count<>${profile.expectedWriteRows}
     or stage_count<>${profile.expectedWriteRows} or inserted_count<>${profile.expectedWriteRows}
     or correction_count<>${profile.expectedCorrections} or superseded_count<>${profile.expectedCorrections}
     or all_match_count<>${CANONICAL_BACKFILL_PROFILE.expectedCandidates} or mismatch_count<>0 or duplicate_count<>0 then
    raise exception 'CANONICAL_BACKFILL_READBACK_FAILED source=% batches=% raw=% stage=% inserted=% correction=% superseded=% all_match=% mismatch=% duplicate=%',
      source_count,batch_count,raw_count,stage_count,inserted_count,correction_count,superseded_count,all_match_count,mismatch_count,duplicate_count;
  end if;
end
$readback$;

commit;

select
  (select count(*) from public.dbf_store_monthly_metric_facts f join dbf_ingest.source_files sf on sf.id=f.source_file_id
    where f.is_active and sf.source_system=${sql(profile.sourceSystem)} and sf.sha256=${sql(csvSha)}) as inserted_facts,
  (select count(*) from dbf_ingest.import_batches b join dbf_ingest.source_files sf on sf.id=b.source_file_id
    where sf.source_system=${sql(profile.sourceSystem)} and sf.sha256=${sql(csvSha)} and b.status='promoted') as promoted_batches;
`;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) args[argv[index]?.replace(/^--/u, "")] = argv[index + 1];
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  assert(args.csv && args.retail && args.out, "USAGE: --csv <canonical.csv> --retail <retail.json> --out <directory>");
  const csvBytes = readFileSync(args.csv);
  const retailBytes = readFileSync(args.retail);
  assert(csvBytes.length === CANONICAL_BACKFILL_PROFILE.canonicalCsvByteSize, "CANONICAL_CSV_BYTE_SIZE_MISMATCH");
  assert(sha256(csvBytes) === CANONICAL_BACKFILL_PROFILE.canonicalCsvSha256, "CANONICAL_CSV_SHA256_MISMATCH");
  assert(retailBytes.length === CANONICAL_BACKFILL_PROFILE.retailPackageByteSize, "RETAIL_PACKAGE_BYTE_SIZE_MISMATCH");
  assert(sha256(retailBytes) === CANONICAL_BACKFILL_PROFILE.retailPackageSha256, "RETAIL_PACKAGE_SHA256_MISMATCH");
  const plan = buildHistoricalStoreActualPlan(csvBytes.toString("utf8"), JSON.parse(retailBytes.toString("utf8")));
  const executionSql = buildProductionExecutionSql(plan);
  mkdirSync(args.out, { recursive: true });
  const sqlPath = join(args.out, "store-operations-canonical-history-backfill-v1.execution.sql");
  const manifestPath = join(args.out, "store-operations-canonical-history-backfill-v1.execution-manifest.json");
  writeFileSync(sqlPath, executionSql, "utf8");
  const manifest = {
    generatedAt: new Date().toISOString(),
    status: "AWAITING_SEPARATE_OWNER_PRODUCTION_EXECUTION_APPROVAL",
    productionProjectRef: CANONICAL_BACKFILL_PROFILE.projectRef,
    productionWriteExecuted: false,
    deployExecuted: false,
    canonicalCsvSha256: CANONICAL_BACKFILL_PROFILE.canonicalCsvSha256,
    canonicalCsvByteSize: CANONICAL_BACKFILL_PROFILE.canonicalCsvByteSize,
    retailPackageSha256: CANONICAL_BACKFILL_PROFILE.retailPackageSha256,
    sqlSha256: sha256(Buffer.from(executionSql, "utf8")),
    sqlByteSize: Buffer.byteLength(executionSql, "utf8"),
    planned: {
      sourceFiles: 1,
      importBatches: EXECUTION_PROFILE.expectedWriteMonths,
      rawRows: EXECUTION_PROFILE.expectedWriteRows,
      stagingRows: EXECUTION_PROFILE.expectedWriteRows,
      canonicalInserts: CANONICAL_BACKFILL_PROFILE.expectedInsert,
      correctionInserts: EXECUTION_PROFILE.expectedCorrections,
      exactUnchanged: EXECUTION_PROFILE.expectedUnchanged,
      unavailablePreserved: CANONICAL_BACKFILL_PROFILE.expectedUnavailable,
      supersede: EXECUTION_PROFILE.expectedCorrections,
      updateExistingFactValues: 0,
      deleteExistingFact: 0,
    },
    unavailable: plan.unavailable,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}
