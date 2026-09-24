-- REVIEW ONLY. This script intentionally ends with ROLLBACK.
-- Production DDL/DML execution is not authorized by this artifact.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table dbf_ingest.metric_definitions
  drop constraint metric_definitions_metric_code_check;

alter table dbf_ingest.metric_definitions
  add constraint metric_definitions_metric_code_check
  check (metric_code = any (array[
    'TOTAL_SALES'::text,
    'TECHNICAL_SALES'::text,
    'RETAIL_SALES'::text,
    'MID_SALES'::text,
    'EC_ALLOCATED_SALES'::text,
    'TOTAL_CUSTOMERS'::text,
    'NEW_CUSTOMERS'::text,
    'EXISTING_CUSTOMERS'::text,
    'TOTAL_UNIT_PRICE'::text,
    'TECHNICAL_UNIT_PRICE'::text,
    'TOTAL_REPEAT_RATE'::text,
    'NEW_REPEAT_RATE'::text,
    'SECOND_REPEAT_RATE'::text,
    'THIRD_REPEAT_RATE'::text,
    'FIXED_REPEAT_RATE'::text,
    'TOTAL_PRODUCTIVITY'::text,
    'TECHNICAL_PRODUCTIVITY'::text,
    'RETAIL_PURCHASE_RATE'::text,
    'RETAIL_PURCHASE_CUSTOMER_VISITS'::text,
    'ACTUAL_LABOR_FTE'::text,
    'OPERATING_PROFIT'::text
  ]));

insert into dbf_ingest.metric_definitions (
  metric_code, definition_version, value_kind, display_name, description, is_active
) values (
  'ACTUAL_LABOR_FTE',
  'ACTUAL_LABOR_FTE_173_76_V1',
  'quantity',
  '実労働FTE（換算人数）',
  'タイムカード社員月総実労働時間を同月の正式な店舗配置FTE比率で配賦し、173.76時間を1.0FTEとして算出。実際の打刻店舗・応援先を示さず、実勤怠なしはNULL。',
  true
)
on conflict (metric_code, definition_version) do nothing;

do $validation$
begin
  if not exists (
    select 1
    from dbf_ingest.metric_definitions
    where metric_code = 'ACTUAL_LABOR_FTE'
      and definition_version = 'ACTUAL_LABOR_FTE_173_76_V1'
      and value_kind = 'quantity'
      and display_name = '実労働FTE（換算人数）'
      and is_active
  ) then
    raise exception 'ACTUAL_LABOR_FTE metric definition is missing or conflicts with the fixed contract';
  end if;
end
$validation$;

rollback;
