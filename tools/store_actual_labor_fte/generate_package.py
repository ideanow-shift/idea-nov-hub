#!/usr/bin/env python3
"""Generate fixed Actual Labor FTE review artifacts; never executes SQL."""
from __future__ import annotations

import argparse
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
from typing import Any
import uuid

PROJECT_REF = "nkmxevmioczcmnldreyo"
ACTOR = "369d9cd5-f6ba-4e53-9428-f631f0893469"
INPUT_SHA = "3D456AF80CFC2D60873A34E82F4A370CDE491884C604C3EB4ADBDC4777AF4157"
INPUT_BYTES = 689_484
WORKBOOK_SHA = "7E04D2107876FCA9902D07F9CB548403B51529591CB431239399912A77BC3E16"
METRIC = "ACTUAL_LABOR_FTE"
VERSION = "ACTUAL_LABOR_FTE_173_76_V1"
FACTS, PROMOTABLE, OPERATOR_UNRESOLVED = 671, 666, 5
UNALLOCATED, MONTHS, STORES = 445, 36, 20
MAPPING_SOURCE = "pos-canonical-store-actual-v1"
SOURCE_SYSTEM = "timecard_actual_labor_fte_handoff_v1"
SOURCE_TYPE = "timecard_actual_labor_fte_173_76_v1"
QUARANTINE_SOURCE_TYPE = "timecard_actual_labor_fte_operator_quarantine_v1"
APPROVAL_SETTING = "app.store_operations_actual_labor_fte_execution_approval"
APPROVAL_VALUE = "OWNER_APPROVAL_REQUIRED_AFTER_FIXED_SHA_REVIEW"

STORE_IDS = {
    "SALON:KYARAHALF": "ac20934d-ef15-4363-8c2f-759193c7fcc7",
    "SALON:RoanebyBASSA": "62070a3c-c484-4a9b-bc06-c3904b27f2c0",
    "SALON:アネックス": "2980442d-294c-4aae-a9bb-78f530a3a20a",
    "SALON:上石神井": "1bcba30a-d063-4cdb-be74-425e250aeb25",
    "SALON:下井草": "fec1e181-ca5b-482d-a865-3f488f19128f",
    "SALON:久米川": "3ba5e54d-5f39-4bcd-b917-7daaea34a8e9",
    "SALON:保谷": "73ee82b5-86fa-42e7-ab03-0e075d218dc3",
    "SALON:国分寺": "71551fcf-853f-4cad-ac94-82b93e75de82",
    "SALON:所沢": "1285ac70-9181-44db-9443-cbd043ab908b",
    "SALON:新所沢": "acc91785-3bb5-49f0-a2f6-0be6e5d511eb",
    "SALON:東久留米": "02d29285-6df0-44b2-bca8-4d61bfe1f5a8",
    "SALON:東大和": "e7bab6a5-9a8c-4f46-abde-e839ce5bf5e6",
    "SALON:江古田": "4e5526cc-9ec7-42aa-ac60-579b6c438c88",
    "SALON:池袋": "36c222de-0554-4265-b177-3b68285cc4a4",
    "SALON:石神井公園": "ad931406-22de-4ba7-a6eb-4502d5c50a91",
    "SALON:立川": "5f66193f-d360-4967-b9c7-a100c8ee5e94",
    "SALON:花小金井": "e7ecb022-6b19-4952-bf4b-fbf5f4c53895",
    "SALON:野方": "b898c63f-1cc1-42c5-be4f-916f24f49cb6",
    "SALON:高田馬場": "887da14c-2c0d-46b3-8953-962c7c8dd590",
    "SALON:鷺ノ宮": "b5a206dc-4a1f-4eb4-9b14-a6f3e5cb2b2c",
}
CODES = ("TOTAL_SALES","TECHNICAL_SALES","RETAIL_SALES","MID_SALES","EC_ALLOCATED_SALES",
    "TOTAL_CUSTOMERS","NEW_CUSTOMERS","EXISTING_CUSTOMERS","TOTAL_UNIT_PRICE","TECHNICAL_UNIT_PRICE",
    "TOTAL_REPEAT_RATE","NEW_REPEAT_RATE","SECOND_REPEAT_RATE","THIRD_REPEAT_RATE","FIXED_REPEAT_RATE",
    "TOTAL_PRODUCTIVITY","TECHNICAL_PRODUCTIVITY","RETAIL_PURCHASE_RATE","RETAIL_PURCHASE_CUSTOMER_VISITS",
    "ACTUAL_LABOR_FTE","OPERATING_PROFIT")
OPERATOR_UNRESOLVED_GRAINS = {
    (month, "SALON:KYARAHALF")
    for month in ("2023-09", "2023-10", "2023-11", "2023-12", "2024-01")
}

def fail(code: str) -> None: raise ValueError(code)
def sha(data: bytes) -> str: return hashlib.sha256(data).hexdigest().upper()
def compact(value: Any) -> str: return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
def quote(value: Any) -> str: return "'" + str(value).replace("'", "''") + "'"

def validate(path: Path) -> list[dict[str, str]]:
    raw = path.read_bytes()
    if len(raw) != INPUT_BYTES or sha(raw) != INPUT_SHA: fail("FIXED_INPUT_MISMATCH")
    package = json.loads(raw)
    if package.get("package_version") != "2026-09-24.2" or package.get("production_write_authorized") is not False:
        fail("PACKAGE_CONTRACT_MISMATCH")
    if package.get("source_workbook_sha256") != WORKBOOK_SHA: fail("WORKBOOK_SHA_MISMATCH")
    if len(package.get("unallocated_employee_month_audit", [])) != UNALLOCATED: fail("UNALLOCATED_COUNT_MISMATCH")
    source = package.get("canonical_store_month_facts", [])
    if len(source) != FACTS: fail("FACT_COUNT_MISMATCH")
    result, keys, months, stores = [], set(), set(), set()
    for item in source:
        unit, month = str(item.get("unit_key", "")), str(item.get("fiscal_month", ""))
        if unit not in STORE_IDS or not re.fullmatch(r"20\d{2}-(0[1-9]|1[0-2])", month): fail("UNMAPPED_GRAIN")
        if item.get("scope") != "STORE" or item.get("metric_code") != METRIC or item.get("definition_version") != VERSION:
            fail("METRIC_CONTRACT_MISMATCH")
        if item.get("source_workbook_sha256") != WORKBOOK_SHA: fail("ROW_SHA_MISMATCH")
        if item.get("actual_punch_store") is not False or item.get("shift_backfill") is not False: fail("FORBIDDEN_OVERRIDE")
        minutes, hours, fte = map(Decimal, map(str, (item["allocated_actual_work_minutes"], item["allocated_actual_work_hours"], item["value_quantity"])))
        if Decimal(str(item["reference_hours"])) != Decimal("173.76") or min(minutes, hours, fte) < 0: fail("VALUE_CONTRACT_MISMATCH")
        if abs(hours-minutes/60) > Decimal("0.000000001") or abs(fte-hours/Decimal("173.76")) > Decimal("0.000000001"): fail("RECALCULATION_MISMATCH")
        if (month, unit) in keys: fail("DUPLICATE_GRAIN")
        keys.add((month, unit)); months.add(month); stores.add(unit)
        row = {"fiscal_month": month, "unit_key": unit, "store_name": str(item["store_name"]),
            "store_id": STORE_IDS[unit], "value_quantity": str(fte),
            "allocated_actual_work_minutes": str(minutes), "allocated_actual_work_hours": str(hours),
            "reference_hours": "173.76", "source_workbook_sha256": WORKBOOK_SHA}
        row["fingerprint_sha256"] = sha(compact(row).encode()).lower()
        result.append(row)
    if len(months) != MONTHS or len(stores) != STORES: fail("COVERAGE_MISMATCH")
    if not OPERATOR_UNRESOLVED_GRAINS.issubset(keys): fail("OPERATOR_QUARANTINE_GRAIN_MISMATCH")
    july = [row for row in result if row["fiscal_month"] == "2026-07"]
    if len(july) != STORES or abs(sum(Decimal(row["value_quantity"]) for row in july)-Decimal("163.14159376918352")) > Decimal("0.000000001"): fail("JULY_MISMATCH")
    return sorted(result, key=lambda row: (row["fiscal_month"], row["unit_key"]))

def facts_json(rows: list[dict[str, str]]) -> str: return compact(rows)
def store_array() -> str: return "array[" + ",".join(quote(v)+"::uuid" for v in sorted(STORE_IDS.values())) + "]::uuid[]"
def records(json_text: str) -> str:
    return f"""(
select to_date(j.fiscal_month,'YYYY-MM') fiscal_month,j.unit_key,j.store_name,
 j.store_id,j.value_quantity,j.allocated_actual_work_minutes,
 j.allocated_actual_work_hours,j.reference_hours,j.source_workbook_sha256,
 j.fingerprint_sha256
from jsonb_to_recordset({quote(json_text)}::jsonb) as j(
 fiscal_month text,unit_key text,store_name text,store_id uuid,value_quantity numeric,
 allocated_actual_work_minutes numeric,allocated_actual_work_hours numeric,
 reference_hours numeric,source_workbook_sha256 text,fingerprint_sha256 text)
) as e"""

def dry_run(rows: list[dict[str, str]]) -> str:
    rec = records(facts_json(rows))
    return f"""-- READ ONLY. No DDL/DML.
with expected as (select * from {rec}),
operators as (
 select * from public.store_corporation_effective_operator_range_read_v1('2023-09-01','2025-08-01',{store_array()})
 union all
 select * from public.store_corporation_effective_operator_range_read_v1('2025-09-01','2026-08-01',{store_array()})
),
resolved as (select e.*,op.corporation_id,op.corporation_no,sm.id store_map,cm.id company_map,
 f.id fact_id,f.definition_version fact_version,f.quantity fact_quantity from expected e
 left join operators op on op.fiscal_month=e.fiscal_month and op.store_id=e.store_id
 left join dbf_ingest.entity_mappings sm on sm.source_system='{MAPPING_SOURCE}' and sm.entity_type='store' and sm.source_key=e.unit_key and sm.store_id=e.store_id and sm.status='active'
 left join dbf_ingest.entity_mappings cm on cm.source_system='{MAPPING_SOURCE}' and cm.entity_type='company' and cm.source_key=op.corporation_no and cm.company_id=op.corporation_id and cm.status='active'
 left join public.dbf_store_monthly_metric_facts f on f.fiscal_month=e.fiscal_month and f.company_id=op.corporation_id and f.store_id=e.store_id and f.metric_code='{METRIC}' and f.is_active)
select {FACTS} expected_rows,count(*) filter(where store_map is null) unresolved_store_mapping,
 count(*) filter(where corporation_id is null or company_map is null) unresolved_company_operator,
 count(*) filter(where fact_id is null and store_map is not null and company_map is not null) planned_insert,
 count(*) filter(where fact_id is not null and fact_version='{VERSION}' and fact_quantity=round(value_quantity,4)) unchanged,
 count(*) filter(where fact_id is not null and not(fact_version='{VERSION}' and fact_quantity=round(value_quantity,4))) conflict,
 (select count(*) from dbf_ingest.metric_definitions where metric_code='{METRIC}') existing_definition_count,
 (select count(*) from dbf_ingest.source_files where source_system='{SOURCE_SYSTEM}') existing_source_count from resolved;
"""

def stable_id(label: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"idea-nov:{SOURCE_SYSTEM}:{label}"))

def execution(rows: list[dict[str, str]], source_sha: str, source_size: int) -> str:
    row_json = facts_json(rows)
    rec = records(row_json)
    months = sorted({row["fiscal_month"] for row in rows})
    batch_json = compact([
        {"fiscal_month": month, "batch_id": stable_id(f"batch:{month}")} for month in months
    ])
    quarantine_batch_json = compact([
        {"fiscal_month": month, "batch_id": stable_id(f"quarantine:{month}")}
        for month, _ in sorted(OPERATOR_UNRESOLVED_GRAINS)
    ])
    source_id = stable_id(f"source:{source_sha}")
    codes_sql = ",".join(quote(code) + "::text" for code in CODES)
    return f"""-- REVIEW-ONLY until a separate fixed-SHA Production execution approval.
-- Project: {PROJECT_REF}
-- Sanitized canonical source SHA-256: {source_sha}
-- Planned: definition=1, source=1, batches={MONTHS + OPERATOR_UNRESOLVED},
-- raw={FACTS}, staging={FACTS}, canonical={PROMOTABLE},
-- operator-unresolved staging-only={OPERATOR_UNRESOLVED}.
do $approval_gate$
begin
  if current_setting('{APPROVAL_SETTING}', true) is distinct from '{APPROVAL_VALUE}' then
    raise exception using errcode='42501', message='OWNER_APPROVAL_GATE_REQUIRED';
  end if;
end
$approval_gate$;

begin;
set local statement_timeout = '10min';
set local lock_timeout = '15s';
select pg_advisory_xact_lock(hashtextextended('{SOURCE_SYSTEM}:{source_sha}',0));
create temp table expected_actual_labor_fte (
  fiscal_month date not null, unit_key text not null, store_name text not null,
  store_id uuid not null, value_quantity numeric not null,
  allocated_actual_work_minutes numeric not null,
  allocated_actual_work_hours numeric not null, reference_hours numeric not null,
  source_workbook_sha256 text not null, fingerprint_sha256 text not null
) on commit drop;
insert into expected_actual_labor_fte select * from {rec};
create temp table expected_actual_labor_fte_operator (
  fiscal_month date not null, store_id uuid not null,
  corporation_id uuid not null, corporation_no text not null,
  primary key (fiscal_month,store_id)
) on commit drop;
insert into expected_actual_labor_fte_operator
select * from public.store_corporation_effective_operator_range_read_v1(
  '2023-09-01','2025-08-01',{store_array()});
insert into expected_actual_labor_fte_operator
select * from public.store_corporation_effective_operator_range_read_v1(
  '2025-09-01','2026-08-01',{store_array()});

do $preflight$
declare
  v_count integer;
begin
  if not exists (select 1 from public.employees where id='{ACTOR}'::uuid and is_active) then
    raise exception using errcode='22023',message='ACTOR_NOT_ACTIVE';
  end if;
  if exists (
    select 1 from dbf_ingest.metric_definitions where metric_code='{METRIC}'
      and not (definition_version='{VERSION}' and value_kind='quantity'
        and display_name='実労働FTE（換算人数）' and is_active)
  ) then
    raise exception using errcode='22023',message='METRIC_DEFINITION_CONFLICT';
  end if;
  with expected as (select * from pg_temp.expected_actual_labor_fte)
  select count(*) into v_count from expected e
  join dbf_ingest.entity_mappings m on m.source_system='{MAPPING_SOURCE}'
    and m.entity_type='store' and m.source_key=e.unit_key and m.store_id=e.store_id
    and m.status='active';
  if v_count <> {FACTS} then
    raise exception using errcode='22023',message='STORE_MAPPING_MISMATCH';
  end if;
  with expected as (select * from pg_temp.expected_actual_labor_fte),
  op as (select * from pg_temp.expected_actual_labor_fte_operator)
  select count(*) into v_count from expected e join op
    on op.fiscal_month=e.fiscal_month and op.store_id=e.store_id
  join dbf_ingest.entity_mappings cm on cm.source_system='{MAPPING_SOURCE}'
    and cm.entity_type='company' and cm.source_key=op.corporation_no
    and cm.company_id=op.corporation_id and cm.status='active';
  if v_count <> {PROMOTABLE} then
    raise exception using errcode='22023',message='EFFECTIVE_OPERATOR_OR_COMPANY_MAPPING_MISMATCH';
  end if;
  with expected as (select * from pg_temp.expected_actual_labor_fte),
  op as (select * from pg_temp.expected_actual_labor_fte_operator)
  select count(*) into v_count from expected e left join op
    on op.fiscal_month=e.fiscal_month and op.store_id=e.store_id
  where op.corporation_id is null
    and not (e.unit_key='SALON:KYARAHALF'
      and e.fiscal_month between date '2023-09-01' and date '2024-01-01');
  if v_count <> 0 then
    raise exception using errcode='22023',message='UNEXPECTED_OPERATOR_GRAIN_MISSING';
  end if;
  if (select count(*) from dbf_ingest.source_files where source_system='{SOURCE_SYSTEM}') > 1 then
    raise exception using errcode='22023',message='SOURCE_SYSTEM_DUPLICATE';
  end if;
  if exists (
    select 1 from dbf_ingest.source_files where source_system='{SOURCE_SYSTEM}'
      and (id <> '{source_id}'::uuid or sha256 <> lower('{source_sha}')
        or byte_size <> {source_size})
  ) then
    raise exception using errcode='22023',message='SOURCE_IDENTITY_CONFLICT';
  end if;
  if not exists (
    select 1 from dbf_ingest.source_files where source_system='{SOURCE_SYSTEM}'
  ) and exists (
    select 1 from public.dbf_store_monthly_metric_facts
    where metric_code='{METRIC}' and is_active
  ) then
    raise exception using errcode='23505',message='ACTIVE_FACTS_ALREADY_EXIST';
  end if;
end
$preflight$;

do $definition$
begin
  if not exists (
    select 1 from dbf_ingest.metric_definitions
    where metric_code='{METRIC}' and definition_version='{VERSION}'
      and value_kind='quantity' and display_name='実労働FTE（換算人数）' and is_active
  ) then
    execute 'alter table dbf_ingest.metric_definitions drop constraint metric_definitions_metric_code_check';
    execute $ddl$alter table dbf_ingest.metric_definitions
      add constraint metric_definitions_metric_code_check
      check (metric_code = any (array[{codes_sql}]))$ddl$;
    insert into dbf_ingest.metric_definitions
      (metric_code,definition_version,value_kind,display_name,description,is_active)
    values ('{METRIC}','{VERSION}','quantity','実労働FTE（換算人数）',
      'タイムカード社員月総実労働時間を同月の正式な店舗配置FTE比率で配賦し、173.76時間を1.0FTEとして算出。実際の打刻店舗・応援先を示さず、実勤怠なしはNULL。',
      true);
  end if;
end
$definition$;

do $load$
declare
  v_actor constant uuid := '{ACTOR}'::uuid;
  v_source constant uuid := '{source_id}'::uuid;
  v_batch record;
  v_result jsonb;
  v_count integer;
begin
  if exists (select 1 from dbf_ingest.source_files where id=v_source) then
    with expected as (select * from pg_temp.expected_actual_labor_fte),
    op as (select * from pg_temp.expected_actual_labor_fte_operator)
    select count(*) into v_count from expected e join op
      on op.fiscal_month=e.fiscal_month and op.store_id=e.store_id
    join public.dbf_store_monthly_metric_facts f
      on f.fiscal_month=e.fiscal_month and f.company_id=op.corporation_id
      and f.store_id=e.store_id and f.metric_code='{METRIC}'
      and f.quantity=round(e.value_quantity,4) and f.definition_version='{VERSION}'
      and f.source_file_id=v_source and f.status='confirmed' and f.is_active;
    if v_count <> {PROMOTABLE}
       or (select count(*) from dbf_ingest.import_batches
           where source_file_id=v_source and fact_kind='store_operating_result'
             and source_type='{SOURCE_TYPE}' and status='promoted') <> {MONTHS}
       or (select count(*) from dbf_ingest.import_batches
           where source_file_id=v_source and fact_kind='store_operating_result'
             and source_type='{QUARANTINE_SOURCE_TYPE}' and status='mapping_required')
          <> {OPERATOR_UNRESOLVED}
       or (select count(*) from dbf_ingest.raw_rows r join dbf_ingest.import_batches b
           on b.id=r.batch_id where b.source_file_id=v_source) <> {FACTS}
       or (select count(*) from dbf_ingest.staging_rows s join dbf_ingest.import_batches b
           on b.id=s.batch_id where b.source_file_id=v_source) <> {FACTS} then
      raise exception using errcode='22023',message='EXISTING_PACKAGE_READBACK_MISMATCH';
    end if;
    return;
  end if;

  insert into dbf_ingest.source_files
    (id,sha256,byte_size,original_file_name,media_type,source_system,
     received_by_employee_id,received_via)
  values (v_source,lower('{source_sha}'),{source_size},
    'actual-labor-fte-canonical-20260924.json','application/json',
    '{SOURCE_SYSTEM}',v_actor,'nov_hub_secure_session');

  for v_batch in
    select * from jsonb_to_recordset({quote(batch_json)}::jsonb)
      as b(fiscal_month date,batch_id uuid)
    order by fiscal_month
  loop
    insert into dbf_ingest.import_batches
      (id,source_file_id,fact_kind,fiscal_month,source_type,status,revision,
       created_by_employee_id)
    values (v_batch.batch_id,v_source,'store_operating_result',
      v_batch.fiscal_month,'{SOURCE_TYPE}','owner_review',1,v_actor);

    with expected as (
      select e.*,row_number() over(order by e.unit_key)::integer source_row_number
      from pg_temp.expected_actual_labor_fte e where e.fiscal_month=v_batch.fiscal_month
        and not (e.unit_key='SALON:KYARAHALF'
          and e.fiscal_month between date '2023-09-01' and date '2024-01-01')
    )
    insert into dbf_ingest.raw_rows
      (batch_id,source_row_number,payload,payload_sha256)
    select v_batch.batch_id,source_row_number,
      jsonb_build_object(
        'fiscalMonth',to_char(fiscal_month,'YYYY-MM'),
        'unitKey',unit_key,'storeName',store_name,'storeId',store_id,
        'metricCode','{METRIC}','definitionVersion','{VERSION}',
        'valueQuantityExact',value_quantity::text,
        'allocatedActualWorkMinutesExact',allocated_actual_work_minutes::text,
        'allocatedActualWorkHoursExact',allocated_actual_work_hours::text,
        'referenceHoursExact',reference_hours::text,
        'sourceWorkbookSha256',source_workbook_sha256,
        'fingerprintSha256',fingerprint_sha256),
      fingerprint_sha256
    from expected order by source_row_number;

    with expected as (
      select e.*,row_number() over(order by e.unit_key)::integer source_row_number
      from pg_temp.expected_actual_labor_fte e where e.fiscal_month=v_batch.fiscal_month
        and not (e.unit_key='SALON:KYARAHALF'
          and e.fiscal_month between date '2023-09-01' and date '2024-01-01')
    ),
    op as (
      select * from pg_temp.expected_actual_labor_fte_operator
      where fiscal_month=v_batch.fiscal_month
    )
    insert into dbf_ingest.staging_rows(
      batch_id,raw_row_id,company_mapping_id,store_mapping_id,company_id,store_id,
      metric_code,amount,quantity,rate,source_row_category,mapping_status,
      validation_status,normalized_payload
    )
    select v_batch.batch_id,r.id,cm.id,sm.id,op.corporation_id,e.store_id,
      '{METRIC}',null,round(e.value_quantity,4),null,'detail','resolved','valid',
      jsonb_build_object(
        'definitionVersion','{VERSION}','confirmationStatus','confirmed',
        'valueQuantityExact',e.value_quantity::text,
        'allocatedActualWorkMinutesExact',e.allocated_actual_work_minutes::text,
        'allocatedActualWorkHoursExact',e.allocated_actual_work_hours::text,
        'referenceHoursExact',e.reference_hours::text,
        'allocationMethod','SAME_MONTH_OFFICIAL_FTE_PLACEMENT_RATIO',
        'actualPunchStore',false,'shiftBackfill',false,
        'sourceWorkbookSha256',e.source_workbook_sha256,
        'fingerprintSha256',e.fingerprint_sha256)
    from expected e
    join dbf_ingest.raw_rows r on r.batch_id=v_batch.batch_id
      and r.source_row_number=e.source_row_number
    join op on op.fiscal_month=e.fiscal_month and op.store_id=e.store_id
    join dbf_ingest.entity_mappings sm on sm.source_system='{MAPPING_SOURCE}'
      and sm.entity_type='store' and sm.source_key=e.unit_key
      and sm.store_id=e.store_id and sm.status='active'
    join dbf_ingest.entity_mappings cm on cm.source_system='{MAPPING_SOURCE}'
      and cm.entity_type='company' and cm.source_key=op.corporation_no
      and cm.company_id=op.corporation_id and cm.status='active';

    if (select count(*) from dbf_ingest.staging_rows
        where batch_id=v_batch.batch_id and mapping_status='resolved'
          and validation_status='valid') <> (select count(*) from dbf_ingest.raw_rows
        where batch_id=v_batch.batch_id) then
      raise exception using errcode='22023',message='MONTH_STAGE_COUNT_MISMATCH';
    end if;

    insert into dbf_ingest.import_events(
      batch_id,event_type,from_status,to_status,actor_employee_id,summary
    ) values
      (v_batch.batch_id,'SOURCE_PARSED','received','parsed',v_actor,
       jsonb_build_object('rowCount',(select count(*) from dbf_ingest.raw_rows
         where batch_id=v_batch.batch_id),'sourceSha256','{source_sha}')),
      (v_batch.batch_id,'VALIDATION_COMPLETED','parsed','owner_review',v_actor,
       jsonb_build_object('errorCount',0,'warningCount',0));

    v_result := public.dbf_import_approve_v1(v_actor,v_batch.batch_id);
    if v_result->>'status' <> 'approved' then
      raise exception using errcode='22023',message='APPROVAL_RESULT_MISMATCH';
    end if;
    v_result := public.dbf_import_promote_v1(v_actor,v_batch.batch_id);
    if v_result->>'status' <> 'promoted' then
      raise exception using errcode='22023',message='PROMOTION_RESULT_MISMATCH';
    end if;
  end loop;

  for v_batch in
    select * from jsonb_to_recordset({quote(quarantine_batch_json)}::jsonb)
      as b(fiscal_month date,batch_id uuid)
    order by fiscal_month
  loop
    insert into dbf_ingest.import_batches
      (id,source_file_id,fact_kind,fiscal_month,source_type,status,revision,
       created_by_employee_id)
    values (v_batch.batch_id,v_source,'store_operating_result',
      v_batch.fiscal_month,'{QUARANTINE_SOURCE_TYPE}','mapping_required',1,v_actor);

    with expected as (
      select e.*,1::integer source_row_number
      from pg_temp.expected_actual_labor_fte e
      where e.fiscal_month=v_batch.fiscal_month and e.unit_key='SALON:KYARAHALF'
    )
    insert into dbf_ingest.raw_rows
      (batch_id,source_row_number,payload,payload_sha256)
    select v_batch.batch_id,source_row_number,
      jsonb_build_object(
        'fiscalMonth',to_char(fiscal_month,'YYYY-MM'),
        'unitKey',unit_key,'storeName',store_name,'storeId',store_id,
        'metricCode','{METRIC}','definitionVersion','{VERSION}',
        'valueQuantityExact',value_quantity::text,
        'allocatedActualWorkMinutesExact',allocated_actual_work_minutes::text,
        'allocatedActualWorkHoursExact',allocated_actual_work_hours::text,
        'referenceHoursExact',reference_hours::text,
        'sourceWorkbookSha256',source_workbook_sha256,
        'fingerprintSha256',fingerprint_sha256),
      fingerprint_sha256
    from expected;

    with expected as (
      select e.*,1::integer source_row_number
      from pg_temp.expected_actual_labor_fte e
      where e.fiscal_month=v_batch.fiscal_month and e.unit_key='SALON:KYARAHALF'
    )
    insert into dbf_ingest.staging_rows(
      batch_id,raw_row_id,company_mapping_id,store_mapping_id,company_id,store_id,
      metric_code,amount,quantity,rate,source_row_category,mapping_status,
      validation_status,normalized_payload
    )
    select v_batch.batch_id,r.id,null,sm.id,null,e.store_id,
      '{METRIC}',null,round(e.value_quantity,4),null,'detail',
      'quarantined','quarantined',
      jsonb_build_object(
        'definitionVersion','{VERSION}',
        'valueQuantityExact',e.value_quantity::text,
        'allocatedActualWorkMinutesExact',e.allocated_actual_work_minutes::text,
        'allocatedActualWorkHoursExact',e.allocated_actual_work_hours::text,
        'referenceHoursExact',e.reference_hours::text,
        'allocationMethod','SAME_MONTH_OFFICIAL_FTE_PLACEMENT_RATIO',
        'actualPunchStore',false,'shiftBackfill',false,
        'reasonCode','MISSING_EFFECTIVE_OPERATOR',
        'sourceWorkbookSha256',e.source_workbook_sha256,
        'fingerprintSha256',e.fingerprint_sha256)
    from expected e
    join dbf_ingest.raw_rows r on r.batch_id=v_batch.batch_id
      and r.source_row_number=e.source_row_number
    join dbf_ingest.entity_mappings sm on sm.source_system='{MAPPING_SOURCE}'
      and sm.entity_type='store' and sm.source_key=e.unit_key
      and sm.store_id=e.store_id and sm.status='active';

    if (select count(*) from dbf_ingest.staging_rows
        where batch_id=v_batch.batch_id and mapping_status='quarantined'
          and validation_status='quarantined'
          and normalized_payload->>'reasonCode'='MISSING_EFFECTIVE_OPERATOR') <> 1 then
      raise exception using errcode='22023',message='QUARANTINE_STAGE_COUNT_MISMATCH';
    end if;

    insert into dbf_ingest.import_events(
      batch_id,event_type,from_status,to_status,actor_employee_id,reason_code,summary
    ) values
      (v_batch.batch_id,'SOURCE_PARSED','received','parsed',v_actor,null,
       jsonb_build_object('rowCount',1,'sourceSha256','{source_sha}')),
      (v_batch.batch_id,'MAPPING_REQUIRED','parsed','mapping_required',v_actor,
       'MISSING_EFFECTIVE_OPERATOR',
       jsonb_build_object('rowCount',1,'canonicalPromotion',false));
  end loop;

  with expected as (select * from pg_temp.expected_actual_labor_fte),
  op as (select * from pg_temp.expected_actual_labor_fte_operator)
  select count(*) into v_count from expected e join op
    on op.fiscal_month=e.fiscal_month and op.store_id=e.store_id
  join public.dbf_store_monthly_metric_facts f
    on f.fiscal_month=e.fiscal_month and f.company_id=op.corporation_id
    and f.store_id=e.store_id and f.metric_code='{METRIC}'
    and f.quantity=round(e.value_quantity,4) and f.definition_version='{VERSION}'
    and f.source_file_id=v_source and f.status='confirmed' and f.is_active;
  if v_count <> {PROMOTABLE}
     or (select count(*) from dbf_ingest.import_batches
         where source_file_id=v_source and fact_kind='store_operating_result'
           and source_type='{SOURCE_TYPE}' and status='promoted') <> {MONTHS}
     or (select count(*) from dbf_ingest.import_batches
         where source_file_id=v_source and fact_kind='store_operating_result'
           and source_type='{QUARANTINE_SOURCE_TYPE}' and status='mapping_required')
        <> {OPERATOR_UNRESOLVED}
     or (select count(*) from dbf_ingest.raw_rows r join dbf_ingest.import_batches b
         on b.id=r.batch_id where b.source_file_id=v_source) <> {FACTS}
     or (select count(*) from dbf_ingest.staging_rows s join dbf_ingest.import_batches b
         on b.id=s.batch_id where b.source_file_id=v_source) <> {FACTS}
     or (select count(*) from dbf_ingest.import_events ev join dbf_ingest.import_batches b
         on b.id=ev.batch_id where b.source_file_id=v_source)
        <> {MONTHS * 4 + OPERATOR_UNRESOLVED * 2}
     or (select count(*) from dbf_ingest.staging_rows s
         join dbf_ingest.import_batches b on b.id=s.batch_id
         where b.source_file_id=v_source
           and b.source_type='{QUARANTINE_SOURCE_TYPE}'
           and s.mapping_status='quarantined'
           and s.validation_status='quarantined'
           and s.normalized_payload->>'reasonCode'='MISSING_EFFECTIVE_OPERATOR')
        <> {OPERATOR_UNRESOLVED}
     or exists (
       select 1 from public.dbf_store_monthly_metric_facts f
       where f.metric_code='{METRIC}' and f.is_active
         and f.source_file_id <> v_source
     ) then
    raise exception using errcode='22023',message='FINAL_READBACK_MISMATCH';
  end if;
end
$load$;

commit;
"""

def validate_dry_run_result(value: dict[str, Any]) -> dict[str, int]:
    expected = {
        "expected_rows": FACTS,
        "unresolved_store_mapping": 0,
        "unresolved_company_operator": OPERATOR_UNRESOLVED,
        "planned_insert": PROMOTABLE,
        "unchanged": 0,
        "conflict": 0,
        "existing_definition_count": 0,
        "existing_source_count": 0,
    }
    normalized = {key: int(value.get(key, -1)) for key in expected}
    if normalized != expected:
        fail("PRODUCTION_DRY_RUN_RESULT_MISMATCH")
    return normalized

def write_package(input_path: Path, output_dir: Path, dry_run_result_path: Path | None = None) -> dict[str, Any]:
    rows = validate(input_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    canonical_path = output_dir / "actual-labor-fte-canonical-20260924.json"
    unresolved_path = output_dir / "actual-labor-fte-operator-unresolved-20260924.json"
    dry_path = output_dir / "actual-labor-fte-production-dry-run.sql"
    execution_path = output_dir / "actual-labor-fte-production.execution.sql"
    manifest_path = output_dir / "actual-labor-fte-production.manifest.json"
    readiness_path = output_dir / "actual-labor-fte-production-readiness-20260924.md"
    dry_result_path = output_dir / "actual-labor-fte-production-dry-run-result.json"

    canonical_bytes = (facts_json(rows) + "\n").encode("utf-8")
    canonical_path.write_bytes(canonical_bytes)
    unresolved_rows = [
        row for row in rows
        if (row["fiscal_month"], row["unit_key"]) in OPERATOR_UNRESOLVED_GRAINS
    ]
    if len(unresolved_rows) != OPERATOR_UNRESOLVED:
        fail("OPERATOR_QUARANTINE_COUNT_MISMATCH")
    unresolved_path.write_text(
        json.dumps(unresolved_rows, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8", newline="\n"
    )
    canonical_sha = sha(canonical_bytes)
    dry_path.write_text(dry_run(rows), encoding="utf-8", newline="\n")
    execution_path.write_text(
        execution(rows, canonical_sha, len(canonical_bytes)), encoding="utf-8", newline="\n"
    )

    dry_result: dict[str, Any] = {"executed": False}
    if dry_run_result_path is not None:
        dry_result = {"executed": True, **validate_dry_run_result(
            json.loads(dry_run_result_path.read_text(encoding="utf-8"))
        )}
        dry_result_path.write_text(
            json.dumps(dry_result, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8", newline="\n"
        )
    elif dry_result_path.exists():
        dry_result_path.unlink()

    artifacts = {}
    for path in (canonical_path, unresolved_path, dry_path, execution_path):
        artifacts[path.name] = {
            "sha256": sha(path.read_bytes()),
            "byteSize": path.stat().st_size,
        }
    if dry_result_path.exists():
        artifacts[dry_result_path.name] = {
            "sha256": sha(dry_result_path.read_bytes()),
            "byteSize": dry_result_path.stat().st_size,
        }
    manifest = {
        "status": "AWAITING_SEPARATE_PRODUCTION_DB_EXECUTION_APPROVAL",
        "productionExecuted": False,
        "projectRef": PROJECT_REF,
        "portfolioLockId": "CTO-PORTFOLIO-EXECUTION-ORDER-2026-09-21-V5",
        "currentPhase": "PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1",
        "sourceMainSha": "d83600fe64bcef2d6d000a27777cfe4889d7142c",
        "fixedInput": {
            "sha256": INPUT_SHA,
            "byteSize": INPUT_BYTES,
            "sourceWorkbookSha256": WORKBOOK_SHA,
        },
        "sanitizedCanonicalSource": {
            "sha256": canonical_sha,
            "byteSize": len(canonical_bytes),
            "containsEmployeeIdentifiers": False,
        },
        "metric": {
            "metricCode": METRIC,
            "definitionVersion": VERSION,
            "valueKind": "quantity",
            "displayName": "実労働FTE（換算人数）",
            "referenceHours": "173.76",
        },
        "executionApprovalGate": {
            "setting": APPROVAL_SETTING,
            "requiredValue": APPROVAL_VALUE,
        },
        "planned": {
            "metricDefinitionsInsert": 1,
            "sourceFilesInsert": 1,
            "importBatchesInsert": MONTHS + OPERATOR_UNRESOLVED,
            "rawRowsInsert": FACTS,
            "stagingRowsInsert": FACTS,
            "canonicalFactsInsert": PROMOTABLE,
            "importEventsInsert": MONTHS * 4 + OPERATOR_UNRESOLVED * 2,
            "storeMappingsInsert": 0,
            "companyMappingsInsert": 0,
            "factUpdates": 0,
            "factDeletes": 0,
            "unallocatedEmployeeMonthsPromoted": 0,
            "operatorUnresolvedRowsPromoted": 0,
            "operatorUnresolvedStagingRowsInsert": OPERATOR_UNRESOLVED,
        },
        "validation": {
            "canonicalRows": FACTS,
            "canonicalPromotableRows": PROMOTABLE,
            "operatorUnresolvedRowsRetainedOutsideCanonical": OPERATOR_UNRESOLVED,
            "uniqueGrains": FACTS,
            "duplicateGrains": 0,
            "months": MONTHS,
            "stores": STORES,
            "unallocatedEmployeeMonthsRetainedOutsideCanonical": UNALLOCATED,
            "nullToZeroConversions": 0,
            "fuzzyMappings": 0,
            "productionReadOnlyDryRun": dry_result,
        },
        "artifacts": artifacts,
    }
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8", newline="\n"
    )
    readiness_path.write_text(
        f"""# 実労働FTE Production実行準備

- Project: `{PROJECT_REF}`
- Status: Production DB実行は未承認・未実施
- Fixed input SHA-256: `{INPUT_SHA}`
- Sanitized canonical SHA-256: `{canonical_sha}`
- Canonical candidate: {FACTS}件（{MONTHS}か月、{STORES}店舗、重複0）
- Production昇格候補: {PROMOTABLE}件
- 法人帰属履歴未解決: {OPERATOR_UNRESOLVED}件（KYARA HALF、2023-09～2024-01）
- 予定: definition 1件、source 1件、batch {MONTHS + OPERATOR_UNRESOLVED}件、
  raw/staging 各{FACTS}件、canonical {PROMOTABLE}件、staging-only {OPERATOR_UNRESOLVED}件
- 既存Fact直接更新: 0件
- 削除: 0件
- 未配賦: {UNALLOCATED}社員月（canonicalへ推測投入しない）
- NULL→0変換: 0件

## 固定定義

タイムカード社員月総実労働時間を同月の正式な店舗配置FTE比率で配賦し、
173.76時間を1.0FTEとして保持します。実際の打刻店舗・応援先を示す値ではありません。
実勤怠がない月、名寄せ不能、配置なし、FTE=0は推測補完しません。
KYARA HALFの2023-09～2024-01はCore DBの法人帰属履歴がないため、現在法人へ
backcastせず、`MISSING_EFFECTIVE_OPERATOR`としてraw/stagingに隔離保持し、
canonical昇格対象外とします。

## 実行ゲート

この成果物はレビュー、静的・mock検証、read-only dry-runのためのものです。
Production DBでDDL/DMLを実行するには、固定main SHAとexecution SQL SHAを指定した
Ownerの別承認が必要です。deployとPR mergeもこの成果物では承認されていません。
""",
        encoding="utf-8", newline="\n"
    )
    return manifest

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--dry-run-result", type=Path)
    args = parser.parse_args()
    manifest = write_package(args.input, args.output_dir, args.dry_run_result)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
