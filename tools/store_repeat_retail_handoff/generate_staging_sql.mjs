import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

import { validateHandoffFiles } from "./validate_handoff_packages.mjs";

export const STAGING_PROFILE = Object.freeze({
  projectRef: "zgkoofphhivesclehrom",
  actorEmployeeId: "369d9cd5-f6ba-4e53-9428-f631f0893469",
  companyRepeatId: "e4059116-bdb3-4e13-9763-bbc77bdfe062",
  repeatPackageSha256: "ec6446d0fed94cc0494e8aa47320309ee931de65f52a54157172d3bb8852eb9a",
  retailPackageSha256: "ef2c56108baced3f1999f6903c681b8d7be963a50707388dc84bea2bbfa68942",
  packageRootSha256: "94ca104e062e3bcb2cb47910aa47f95f578c1bf9463196a2a4d9304e5a4abbba",
  retailByteSize: 3252873,
  unchangedRepeatUnitKey: "SALON:久米川",
  chunkSize: 500,
});

const COMPANY_IDS = Object.freeze({
  "0001": "e4059116-bdb3-4e13-9763-bbc77bdfe062",
  "0002": "f0d56e0d-62e1-4eba-a37a-17e396ab0b61",
  "0003": "becb6f4b-2222-406d-8315-1eed48717327",
  "0004": "127b2041-a61c-498e-9040-a9d0a8146182",
  "0005": "2dcb7eb1-3aa9-4f75-a439-471da534b2fb",
  "0006": "34afa056-2d7c-413a-b6ea-80e2620e003c",
});

const STORE_MAP = Object.freeze({
  "SALON:アネックス": ["2980442d-294c-4aae-a9bb-78f530a3a20a", "annex"],
  "SALON:上石神井": ["1bcba30a-d063-4cdb-be74-425e250aeb25", "kamishakujii"],
  "SALON:下井草": ["fec1e181-ca5b-482d-a865-3f488f19128f", "shimoigusa"],
  "SALON:久米川": ["3ba5e54d-5f39-4bcd-b917-7daaea34a8e9", "kumegawa"],
  "SALON:保谷": ["73ee82b5-86fa-42e7-ab03-0e075d218dc3", "hoya"],
  "SALON:国分寺": ["71551fcf-853f-4cad-ac94-82b93e75de82", "kokubunnji"],
  "SALON:所沢": ["1285ac70-9181-44db-9443-cbd043ab908b", "tokorozawa"],
  "SALON:新所沢": ["acc91785-3bb5-49f0-a2f6-0be6e5d511eb", "shintokorozawa"],
  "SALON:東久留米": ["02d29285-6df0-44b2-bca8-4d61bfe1f5a8", "higashikurume"],
  "SALON:東大和": ["e7bab6a5-9a8c-4f46-abde-e839ce5bf5e6", "higashiyamato"],
  "SALON:江古田": ["4e5526cc-9ec7-42aa-ac60-579b6c438c88", "ekoda"],
  "SALON:池袋": ["36c222de-0554-4265-b177-3b68285cc4a4", "ikebukuro"],
  "SALON:石神井公園": ["ad931406-22de-4ba7-a6eb-4502d5c50a91", "shakujiikoen"],
  "SALON:立川": ["5f66193f-d360-4967-b9c7-a100c8ee5e94", "tachikawa"],
  "SALON:花小金井": ["e7ecb022-6b19-4952-bf4b-fbf5f4c53895", "hanakoganei"],
  "SALON:野方": ["b898c63f-1cc1-42c5-be4f-916f24f49cb6", "nogata"],
  "SALON:高田馬場": ["887da14c-2c0d-46b3-8953-962c7c8dd590", "takadanobaba"],
  "SALON:鷺ノ宮": ["b5a206dc-4a1f-4eb4-9b14-a6f3e5cb2b2c", "saginomiya"],
  "SALON:RoanebyBASSA": ["62070a3c-c484-4a9b-bc06-c3904b27f2c0", "roane"],
});

const STORE_REPEAT_METRIC = Object.freeze({
  TOTAL: "TOTAL_REPEAT_RATE",
  NEW: "NEW_REPEAT_RATE",
  RETURNING: "RETURNING_REPEAT_RATE",
  SEMI_FIXED: "SEMI_FIXED_REPEAT_RATE",
  FIXED: "FIXED_REPEAT_RATE",
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sql(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    assert(Number.isFinite(value), "NON_FINITE_SQL_NUMBER");
    return String(value);
  }
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function jsonSql(value) {
  return sql(JSON.stringify(value)) + "::jsonb";
}

function monthDate(month) {
  return month + "-01";
}

function chunks(rows, size) {
  const result = [];
  for (let index = 0; index < rows.length; index += size) result.push(rows.slice(index, index + size));
  return result;
}

export function resolveStore(unitKey, month) {
  if (unitKey === "SALON:KYARAHALF") {
    return month < "2024-02"
      ? ["a1997308-a402-4ddb-a3f7-8b70a75b054c", "kyarahalf"]
      : ["ac20934d-ef15-4363-8c2f-759193c7fcc7", "kyarahalf"];
  }
  const result = STORE_MAP[unitKey];
  assert(result, "STORE_MAPPING_MISSING:" + unitKey);
  return result;
}

function canonicalSourceMetric(fact) {
  const metric = STORE_REPEAT_METRIC[fact.customer_segment];
  assert(metric, "REPEAT_SEGMENT_MAPPING_MISSING:" + fact.customer_segment);
  return metric;
}

function buildBootstrap(repeatFacts, retailMonths, repeatFileName, retailFileName) {
  const repeatFiles = new Map();
  for (const fact of repeatFacts) {
    const key = fact.source_sha256.toLowerCase();
    const prior = repeatFiles.get(key);
    assert(!prior || prior === fact.source_file, "REPEAT_SOURCE_SHA_NAME_CONFLICT:" + key);
    repeatFiles.set(key, fact.source_file);
  }
  const fingerprint = sha256("STAGING|" + STAGING_PROFILE.repeatPackageSha256 + "|" + STAGING_PROFILE.packageRootSha256);
  const repeatFileValues = [...repeatFiles].map(([sourceSha, name]) =>
    `(${sql(name)},${sql(sourceSha)},null::timestamptz,null::bigint,true)`).join(",\n    ");
  const retailBatchValues = retailMonths.map((month) =>
    `('store_operating_result',${sql(monthDate(month))}::date,'pos_retail_purchase_customer_count_v1','received',1,${sql(STAGING_PROFILE.actorEmployeeId)}::uuid)`).join(",\n    ");
  return `begin;
insert into dbf_ingest.store_repeat_rate_import_batches
  (request_fingerprint,idempotency_key,package_sha256,workbook_sha256,source_package_sha256,
   definition_version,expected_fact_count,status,created_by_employee_id)
values (${sql(fingerprint)},'repeat-retail-20260921-staging-v1',
  ${sql(STAGING_PROFILE.repeatPackageSha256)},${sql(STAGING_PROFILE.repeatPackageSha256)},
  ${sql(STAGING_PROFILE.packageRootSha256)},'POS_REPEAT_COHORT_4M_CUMULATIVE_V1',7480,'staged',
  ${sql(STAGING_PROFILE.actorEmployeeId)}::uuid)
on conflict (package_sha256) do nothing;

with b as (
  select id from dbf_ingest.store_repeat_rate_import_batches
  where package_sha256=${sql(STAGING_PROFILE.repeatPackageSha256)}
)
insert into dbf_ingest.store_repeat_rate_source_files
  (batch_id,source_file_name,source_sha256,source_exported_at,source_size_bytes,is_selected_as_canonical)
select b.id,v.* from (values
    ${repeatFileValues}
) as v(source_file_name,source_sha256,source_exported_at,source_size_bytes,is_selected_as_canonical)
cross join b
on conflict (batch_id,source_sha256) do nothing;

insert into dbf_ingest.source_files
  (sha256,byte_size,original_file_name,media_type,source_system,received_by_employee_id,received_via)
values (${sql(STAGING_PROFILE.retailPackageSha256)},${STAGING_PROFILE.retailByteSize},
  ${sql(retailFileName)},'application/json','pos_retail_purchase_handoff_v1',
  ${sql(STAGING_PROFILE.actorEmployeeId)}::uuid,'nov_hub_secure_session')
on conflict (source_system,sha256,byte_size) do nothing;

with s as (
  select id from dbf_ingest.source_files
  where source_system='pos_retail_purchase_handoff_v1'
    and sha256=${sql(STAGING_PROFILE.retailPackageSha256)}
    and byte_size=${STAGING_PROFILE.retailByteSize}
)
insert into dbf_ingest.import_batches
  (source_file_id,fact_kind,fiscal_month,source_type,status,revision,created_by_employee_id)
select s.id,v.* from (values
    ${retailBatchValues}
) as v(fact_kind,fiscal_month,source_type,status,revision,created_by_employee_id)
cross join s
on conflict (source_file_id,fact_kind,fiscal_month,source_type) do nothing;
commit;`;
}

function repeatTuple(fact, ordinal) {
  const companyId = fact.scope_type === "COMPANY_TOTAL"
    ? COMPANY_IDS[fact.company_no]
    : COMPANY_IDS[fact.operator_no_at_visit_month];
  assert(companyId, "REPEAT_COMPANY_MAPPING_MISSING:" + (fact.company_no ?? fact.operator_no_at_visit_month));
  const store = fact.scope_type === "STORE" ? resolveStore(fact.unit_key, fact.visit_month) : null;
  const values = {
    ordinal,
    sourceSha: fact.source_sha256.toLowerCase(),
    unitKey: fact.unit_key,
    storeName: fact.store_name_raw,
    storeId: store?.[0],
    companyNo: fact.company_no ?? fact.operator_no_at_visit_month,
    companyId,
    visitMonth: monthDate(fact.visit_month),
    calculationMonth: monthDate(fact.calculation_month),
    segment: fact.customer_segment,
    canonicalMetric: fact.scope_type === "STORE" ? canonicalSourceMetric(fact) : null,
    sourceMetric: fact.metric_code_candidate,
    denominator: fact.denominator_visit_count,
    numerator: fact.numerator_cumulative_repeat_count,
    displayRate: fact.pos_display_rate,
    exactRate: fact.exact_rate,
    rowSha: sha256(JSON.stringify(fact)),
  };
  return values;
}

function buildRepeatChunk(rows, chunkNumber) {
  const storeRows = rows.filter((row) => row.fact.scope_type === "STORE"
    && row.fact.unit_key !== STAGING_PROFILE.unchangedRepeatUnitKey);
  const companyRows = rows.filter((row) => row.fact.scope_type === "COMPANY_TOTAL");
  const statements = ["begin;"];
  if (storeRows.length) {
    const tuples = storeRows.map(({ fact, ordinal }) => {
      const v = repeatTuple(fact, ordinal);
      return `(${v.ordinal},${sql(v.sourceSha)},${sql(v.unitKey)},${sql(v.storeName)},${sql(v.storeId)}::uuid,${sql(v.companyNo)},${sql(v.companyId)}::uuid,${sql(v.visitMonth)}::date,${sql(v.calculationMonth)}::date,${sql(v.segment)},${sql(v.canonicalMetric)},${sql(v.sourceMetric)},${v.denominator},${v.numerator},${sql(v.displayRate)}::numeric,${sql(v.exactRate)}::numeric,${sql(v.rowSha)})`;
    }).join(",\n");
    statements.push(`with b as (
  select id from dbf_ingest.store_repeat_rate_import_batches where package_sha256=${sql(STAGING_PROFILE.repeatPackageSha256)}
), v(row_ordinal,source_sha,unit_key,store_name_raw,store_id,company_no,company_id,visit_month,calculation_month,segment,canonical_metric,source_metric,denominator,numerator,display_rate,exact_rate,row_sha) as (
  values ${tuples}
)
insert into dbf_ingest.store_repeat_rate_staging_rows
  (batch_id,source_file_id,row_ordinal,scope_type,unit_key,store_name_raw,store_id,
   company_no_at_visit_month,company_id,visit_month,calculation_month,horizon_months,
   customer_segment,canonical_metric_code,source_metric_code_candidate,definition_version,
   denominator_visit_count,numerator_cumulative_repeat_count,pos_display_rate,exact_rate,
   mapping_status,validation_status,issue_code,raw_payload_sha256)
select b.id,sf.id,v.row_ordinal,'STORE',v.unit_key,v.store_name_raw,v.store_id,
  v.company_no,v.company_id,v.visit_month,v.calculation_month,4,v.segment,v.canonical_metric,
  v.source_metric,'POS_REPEAT_COHORT_4M_CUMULATIVE_V1',v.denominator,v.numerator,
  v.display_rate,v.exact_rate,'resolved','valid',null,v.row_sha
from v cross join b
join dbf_ingest.store_repeat_rate_source_files sf on sf.batch_id=b.id and sf.source_sha256=v.source_sha
on conflict (batch_id,unit_key,visit_month,customer_segment,definition_version) do nothing;`);
  }
  if (companyRows.length) {
    const tuples = companyRows.map(({ fact, ordinal }) => {
      const v = repeatTuple(fact, ordinal);
      return `(${v.ordinal},${sql(v.sourceSha)},${sql(v.companyNo)},${sql(v.companyId)}::uuid,${sql(v.visitMonth)}::date,${sql(v.calculationMonth)}::date,${sql(v.segment)},${v.denominator},${v.numerator},${sql(v.displayRate)}::numeric,${sql(v.exactRate)}::numeric,${sql(v.rowSha)})`;
    }).join(",\n");
    statements.push(`with b as (
  select id from dbf_ingest.store_repeat_rate_import_batches where package_sha256=${sql(STAGING_PROFILE.repeatPackageSha256)}
), v(row_ordinal,source_sha,company_no,company_id,visit_month,calculation_month,segment,denominator,numerator,display_rate,exact_rate,row_sha) as (
  values ${tuples}
)
insert into dbf_ingest.company_repeat_rate_staging_rows
  (batch_id,source_file_id,row_ordinal,scope_type,source_company_no,company_id,
   visit_month,calculation_month,horizon_months,customer_segment,definition_version,
   denominator_visit_count,numerator_cumulative_repeat_count,pos_display_rate,exact_rate,
   mapping_status,validation_status,issue_code,raw_payload_sha256)
select b.id,sf.id,v.row_ordinal,'COMPANY_TOTAL',v.company_no,v.company_id,
  v.visit_month,v.calculation_month,4,v.segment,'POS_REPEAT_COHORT_4M_CUMULATIVE_V1',
  v.denominator,v.numerator,v.display_rate,v.exact_rate,'resolved','valid',null,v.row_sha
from v cross join b
join dbf_ingest.store_repeat_rate_source_files sf on sf.batch_id=b.id and sf.source_sha256=v.source_sha
on conflict (batch_id,source_company_no,visit_month,customer_segment,definition_version) do nothing;`);
  }
  statements.push(`select ${chunkNumber} as repeat_chunk, ${storeRows.length} as planned_store_rows, ${companyRows.length} as planned_company_rows;\ncommit;`);
  return statements.join("\n\n");
}

function augmentRetailFact(fact) {
  const promotable = fact.scope_type === "SALON"
    && fact.promotion_status === "READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH";
  const companyTotal = fact.scope_type === "COMPANY_TOTAL";
  let companyId = null;
  let storeId = null;
  let storeMappingKey = null;
  if (promotable) {
    companyId = COMPANY_IDS[fact.company_no_at_month];
    assert(companyId, "RETAIL_COMPANY_MAPPING_MISSING:" + fact.company_no_at_month);
    [storeId, storeMappingKey] = resolveStore(fact.unit_key, fact.fiscal_month);
  } else if (companyTotal) {
    companyId = COMPANY_IDS[fact.company_no_at_month];
    assert(companyId, "RETAIL_COMPANY_TOTAL_MAPPING_MISSING");
  }
  return { ...fact, resolved_company_id: companyId, resolved_store_id: storeId, store_mapping_source_key: storeMappingKey };
}

function buildRetailChunk(rows, chunkNumber) {
  const rawValues = rows.map((row) =>
    `(${sql(monthDate(row.fact.fiscal_month))}::date,${row.monthOrdinal},${jsonSql(augmentRetailFact(row.fact))},${sql(sha256(JSON.stringify(row.fact)))})`
  ).join(",\n");
  const keyValues = rows.map((row) =>
    `(${sql(monthDate(row.fact.fiscal_month))}::date,${row.monthOrdinal})`
  ).join(",\n");
  return `begin;
with s as (
  select id from dbf_ingest.source_files
  where source_system='pos_retail_purchase_handoff_v1'
    and sha256=${sql(STAGING_PROFILE.retailPackageSha256)}
    and byte_size=${STAGING_PROFILE.retailByteSize}
), v(fiscal_month,row_number,payload,payload_sha) as (
  values ${rawValues}
)
insert into dbf_ingest.raw_rows(batch_id,source_row_number,payload,payload_sha256)
select b.id,v.row_number,v.payload,v.payload_sha
from v cross join s join dbf_ingest.import_batches b
  on b.source_file_id=s.id and b.fact_kind='store_operating_result'
  and b.fiscal_month=v.fiscal_month and b.source_type='pos_retail_purchase_customer_count_v1'
on conflict (batch_id,source_row_number) do nothing;

with s as (
  select id from dbf_ingest.source_files
  where source_system='pos_retail_purchase_handoff_v1'
    and sha256=${sql(STAGING_PROFILE.retailPackageSha256)}
    and byte_size=${STAGING_PROFILE.retailByteSize}
), k(fiscal_month,row_number) as (values ${keyValues}),
r as (
  select rr.*,b.fiscal_month
  from k join dbf_ingest.import_batches b
    on b.fiscal_month=k.fiscal_month and b.fact_kind='store_operating_result'
    and b.source_type='pos_retail_purchase_customer_count_v1'
  join s on s.id=b.source_file_id
  join dbf_ingest.raw_rows rr on rr.batch_id=b.id and rr.source_row_number=k.row_number
)
insert into dbf_ingest.staging_rows
  (batch_id,raw_row_id,company_mapping_id,store_mapping_id,company_id,store_id,
   metric_code,quantity,source_row_category,mapping_status,validation_status,normalized_payload)
select r.batch_id,r.id,
  case when r.payload->>'resolved_company_id' is not null then (
    select em.id from dbf_ingest.entity_mappings em
    where em.source_system='store_ops_historical_master_v1' and em.entity_type='company'
      and em.source_key=r.payload->>'company_no_at_month' and em.status='active' limit 1) end,
  case when r.payload->>'resolved_store_id' is not null then (
    select em.id from dbf_ingest.entity_mappings em
    where em.source_system='store_ops_historical_master_v1' and em.entity_type='store'
      and em.source_key=r.payload->>'store_mapping_source_key' and em.status='active' limit 1) end,
  nullif(r.payload->>'resolved_company_id','')::uuid,
  nullif(r.payload->>'resolved_store_id','')::uuid,
  'RETAIL_PURCHASE_CUSTOMER_VISITS',(r.payload->>'quantity')::numeric,
  case when r.payload->>'scope_type'='COMPANY_TOTAL' then 'aggregate' else 'detail' end,
  case when r.payload->>'resolved_company_id' is not null then 'resolved' else 'quarantined' end,
  case when r.payload->>'promotion_status' in ('READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH','SEPARATE_COMPANY_SCOPE_DESIGN_REQUIRED') then 'valid'
       when r.payload->>'promotion_status'='EXCLUDED_OUTSIDE_CANONICAL_OPERATION_PERIOD' then 'quarantined'
       else 'warning' end,
  r.payload
from r
on conflict (batch_id,raw_row_id) do nothing;
select ${chunkNumber} as retail_chunk, ${rows.length} as planned_rows;
commit;`;
}

function buildPromotion() {
  const actor = sql(STAGING_PROFILE.actorEmployeeId) + "::uuid";
  const repeatSha = sql(STAGING_PROFILE.repeatPackageSha256);
  const retailSha = sql(STAGING_PROFILE.retailPackageSha256);
  return `begin;
do $guard$
declare store_stage integer; company_stage integer; retail_stage integer; unchanged_repeat integer;
begin
  select count(*) into store_stage from dbf_ingest.store_repeat_rate_staging_rows s
    join dbf_ingest.store_repeat_rate_import_batches b on b.id=s.batch_id
    where b.package_sha256=${repeatSha};
  select count(*) into company_stage from dbf_ingest.company_repeat_rate_staging_rows s
    join dbf_ingest.store_repeat_rate_import_batches b on b.id=s.batch_id
    where b.package_sha256=${repeatSha};
  select count(*) into retail_stage from dbf_ingest.staging_rows s
    join dbf_ingest.import_batches b on b.id=s.batch_id
    join dbf_ingest.source_files f on f.id=b.source_file_id
    where f.sha256=${retailSha} and f.source_system='pos_retail_purchase_handoff_v1';
  select count(*) into unchanged_repeat from public.dbf_store_monthly_repeat_rate_facts
    where source_unit_key=${sql(STAGING_PROFILE.unchangedRepeatUnitKey)}
      and definition_version='POS_REPEAT_COHORT_4M_CUMULATIVE_V1' and is_active;
  if store_stage<>6600 or company_stage<>440 or retail_stage<>2476 or unchanged_repeat<>440 then
    raise exception 'STAGING_GATE_FAILED store=% company=% retail=% unchanged=%',
      store_stage,company_stage,retail_stage,unchanged_repeat;
  end if;
end $guard$;

insert into public.dbf_store_monthly_repeat_rate_facts
  (store_id,company_id,source_unit_key,source_company_no,visit_month,calculation_month,
   horizon_months,customer_segment,metric_code,definition_version,denominator_visit_count,
   numerator_cumulative_repeat_count,pos_display_rate,exact_rate,source_file_id,batch_id,
   imported_by_employee_id,version,status,is_active)
select s.store_id,s.company_id,s.unit_key,s.company_no_at_visit_month,s.visit_month,s.calculation_month,
  s.horizon_months,s.customer_segment,s.canonical_metric_code,s.definition_version,
  s.denominator_visit_count,s.numerator_cumulative_repeat_count,s.pos_display_rate,s.exact_rate,
  s.source_file_id,s.batch_id,${actor},1,'confirmed',true
from dbf_ingest.store_repeat_rate_staging_rows s
join dbf_ingest.store_repeat_rate_import_batches b on b.id=s.batch_id
where b.package_sha256=${repeatSha} and s.mapping_status='resolved' and s.validation_status='valid'
on conflict (store_id,visit_month,customer_segment,definition_version) where is_active do nothing;

insert into public.dbf_company_monthly_repeat_rate_facts
  (company_id,source_company_no,visit_month,calculation_month,horizon_months,customer_segment,
   definition_version,denominator_visit_count,numerator_cumulative_repeat_count,pos_display_rate,
   exact_rate,source_file_id,batch_id,imported_by_employee_id,version,status,is_active)
select s.company_id,s.source_company_no,s.visit_month,s.calculation_month,s.horizon_months,
  s.customer_segment,s.definition_version,s.denominator_visit_count,s.numerator_cumulative_repeat_count,
  s.pos_display_rate,s.exact_rate,s.source_file_id,s.batch_id,${actor},1,'confirmed',true
from dbf_ingest.company_repeat_rate_staging_rows s
join dbf_ingest.store_repeat_rate_import_batches b on b.id=s.batch_id
where b.package_sha256=${repeatSha} and s.mapping_status='resolved' and s.validation_status='valid'
on conflict (company_id,visit_month,customer_segment,definition_version) where is_active do nothing;

insert into public.dbf_store_monthly_metric_facts
  (fiscal_month,company_id,store_id,metric_code,quantity,definition_version,source_type,
   source_file_id,batch_id,imported_by_employee_id,version,status,is_active)
select b.fiscal_month,s.company_id,s.store_id,'RETAIL_PURCHASE_CUSTOMER_VISITS',s.quantity,
  'POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1','pos_retail_purchase_customer_count_v1',
  b.source_file_id,b.id,${actor},1,'confirmed',true
from dbf_ingest.staging_rows s
join dbf_ingest.import_batches b on b.id=s.batch_id
join dbf_ingest.source_files f on f.id=b.source_file_id
where f.sha256=${retailSha} and f.source_system='pos_retail_purchase_handoff_v1'
  and s.normalized_payload->>'promotion_status'='READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH'
  and s.mapping_status='resolved' and s.validation_status='valid'
on conflict (fiscal_month,company_id,store_id,metric_code) where is_active do nothing;

insert into public.dbf_company_monthly_retail_purchase_facts
  (company_id,source_company_no,fiscal_month,metric_code,definition_version,quantity,
   total_customer_visits_for_validation,retail_purchase_rate_exact_candidate,
   source_file_id,batch_id,imported_by_employee_id,version,status,is_active)
select s.company_id,s.normalized_payload->>'company_no_at_month',b.fiscal_month,
  'RETAIL_PURCHASE_CUSTOMER_VISITS','POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1',s.quantity,
  nullif(s.normalized_payload->>'total_customer_visits_for_validation','')::numeric,
  nullif(s.normalized_payload->>'retail_purchase_rate_exact_candidate','')::numeric,
  b.source_file_id,b.id,${actor},1,'confirmed',true
from dbf_ingest.staging_rows s
join dbf_ingest.import_batches b on b.id=s.batch_id
join dbf_ingest.source_files f on f.id=b.source_file_id
where f.sha256=${retailSha} and f.source_system='pos_retail_purchase_handoff_v1'
  and s.normalized_payload->>'scope_type'='COMPANY_TOTAL'
  and s.mapping_status='resolved' and s.validation_status='valid'
on conflict (company_id,fiscal_month,metric_code,definition_version) where is_active do nothing;

update dbf_ingest.store_repeat_rate_import_batches
set status='promoted',validated_at=coalesce(validated_at,statement_timestamp()),
  approved_by_employee_id=coalesce(approved_by_employee_id,${actor}),
  approved_at=coalesce(approved_at,statement_timestamp()),
  promoted_at=coalesce(promoted_at,statement_timestamp())
where package_sha256=${repeatSha} and status<>'promoted';

update dbf_ingest.import_batches b
set status='promoted',approved_by_employee_id=coalesce(approved_by_employee_id,${actor}),
  approved_at=coalesce(approved_at,statement_timestamp()),
  promoted_at=coalesce(promoted_at,statement_timestamp())
from dbf_ingest.source_files f
where f.id=b.source_file_id and f.sha256=${retailSha}
  and f.source_system='pos_retail_purchase_handoff_v1' and b.status<>'promoted';

do $verify$
declare sr integer; cr integer; sm integer; cm integer;
begin
  select count(*) into sr from public.dbf_store_monthly_repeat_rate_facts
    where definition_version='POS_REPEAT_COHORT_4M_CUMULATIVE_V1' and is_active;
  select count(*) into cr from public.dbf_company_monthly_repeat_rate_facts
    where definition_version='POS_REPEAT_COHORT_4M_CUMULATIVE_V1' and is_active;
  select count(*) into sm from public.dbf_store_monthly_metric_facts
    where metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS'
      and definition_version='POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1' and is_active;
  select count(*) into cm from public.dbf_company_monthly_retail_purchase_facts
    where metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS'
      and definition_version='POS_RETAIL_PURCHASE_CUSTOMER_COUNT_V1' and is_active;
  if sr<>7040 or cr<>440 or sm<>1492 or cm<>92 then
    raise exception 'CANONICAL_GATE_FAILED sr=% cr=% sm=% cm=%',sr,cr,sm,cm;
  end if;
end $verify$;
commit;
select
  (select count(*) from public.dbf_store_monthly_repeat_rate_facts where definition_version='POS_REPEAT_COHORT_4M_CUMULATIVE_V1' and is_active) as store_repeat,
  (select count(*) from public.dbf_company_monthly_repeat_rate_facts where definition_version='POS_REPEAT_COHORT_4M_CUMULATIVE_V1' and is_active) as company_repeat,
  (select count(*) from public.dbf_store_monthly_metric_facts where metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS' and is_active) as store_retail,
  (select count(*) from public.dbf_company_monthly_retail_purchase_facts where metric_code='RETAIL_PURCHASE_CUSTOMER_VISITS' and is_active) as company_retail;`;
}

export function generateStagingSql({ repeatPath, retailPath, outDir }) {
  const validation = validateHandoffFiles({ repeatPath, retailPath });
  const repeatPackage = JSON.parse(readFileSync(repeatPath, "utf8"));
  const retailPackage = JSON.parse(readFileSync(retailPath, "utf8"));
  const repeatRows = repeatPackage.facts.map((fact, index) => ({ fact, ordinal: index + 1 }));
  const monthOrdinals = new Map();
  const retailRows = retailPackage.facts.map((fact) => {
    const ordinal = (monthOrdinals.get(fact.fiscal_month) ?? 0) + 1;
    monthOrdinals.set(fact.fiscal_month, ordinal);
    return { fact, monthOrdinal: ordinal };
  });
  const planned = {
    repeatStoreInsert: repeatRows.filter((row) => row.fact.scope_type === "STORE"
      && row.fact.unit_key !== STAGING_PROFILE.unchangedRepeatUnitKey).length,
    repeatStoreUnchanged: repeatRows.filter((row) => row.fact.scope_type === "STORE"
      && row.fact.unit_key === STAGING_PROFILE.unchangedRepeatUnitKey).length,
    repeatCompanyInsert: repeatRows.filter((row) => row.fact.scope_type === "COMPANY_TOTAL").length,
    retailStoreInsert: retailRows.filter((row) => row.fact.promotion_status === "READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH").length,
    retailRejected: retailRows.filter((row) => row.fact.promotion_status === "EXCLUDED_OUTSIDE_CANONICAL_OPERATION_PERIOD").length,
    retailCompanyInsert: retailRows.filter((row) => row.fact.scope_type === "COMPANY_TOTAL").length,
    retailNonSalonStagingOnly: retailRows.filter((row) => ["EC","HQ"].includes(row.fact.scope_type)).length,
  };
  assert(JSON.stringify(planned) === JSON.stringify({
    repeatStoreInsert: 6600, repeatStoreUnchanged: 440, repeatCompanyInsert: 440,
    retailStoreInsert: 1492, retailRejected: 62, retailCompanyInsert: 92,
    retailNonSalonStagingOnly: 830,
  }), "PLANNED_COUNTS_MISMATCH:" + JSON.stringify(planned));
  for (const row of repeatRows.filter((item) => item.fact.scope_type === "STORE")) {
    resolveStore(row.fact.unit_key, row.fact.visit_month);
  }
  for (const row of retailRows.filter((item) => item.fact.scope_type === "SALON"
      && item.fact.promotion_status === "READY_AFTER_CORE_DB_STORE_ID_EXACT_MATCH")) {
    resolveStore(row.fact.unit_key, row.fact.fiscal_month);
  }
  mkdirSync(outDir, { recursive: true });
  const files = [];
  const emit = (name, content) => {
    writeFileSync(join(outDir, name), content + "\n", "utf8");
    files.push({ name, sha256: sha256(Buffer.from(content + "\n", "utf8")), bytes: Buffer.byteLength(content + "\n") });
  };
  const retailMonths = [...monthOrdinals.keys()].sort();
  emit("001_bootstrap.sql", buildBootstrap(repeatPackage.facts, retailMonths, basename(repeatPath), basename(retailPath)));
  chunks(repeatRows.filter((row) => row.fact.scope_type === "COMPANY_TOTAL"
      || row.fact.unit_key !== STAGING_PROFILE.unchangedRepeatUnitKey), STAGING_PROFILE.chunkSize)
    .forEach((rows, index) => emit(`repeat_${String(index + 1).padStart(3,"0")}.sql`, buildRepeatChunk(rows, index + 1)));
  chunks(retailRows, STAGING_PROFILE.chunkSize)
    .forEach((rows, index) => emit(`retail_${String(index + 1).padStart(3,"0")}.sql`, buildRetailChunk(rows, index + 1)));
  emit("999_promote_and_verify.sql", buildPromotion());
  const manifest = {
    status: "PASS",
    stagingProjectRef: STAGING_PROFILE.projectRef,
    productionWriteCount: 0,
    validation,
    planned,
    files,
  };
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return manifest;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) args[argv[index].slice(2)] = argv[index + 1];
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  assert(args.repeat && args.retail && args.out, "USAGE:--repeat PATH --retail PATH --out DIR");
  process.stdout.write(JSON.stringify(generateStagingSql({
    repeatPath: args.repeat,
    retailPath: args.retail,
    outDir: args.out,
  }), null, 2) + "\n");
}
