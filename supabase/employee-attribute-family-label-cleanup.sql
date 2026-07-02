-- HUB / Core DB employee attribute cleanup
-- Purpose:
--   家族関係・敬称ラベルを社員属性として扱わないための確認・整理SQL。
--
-- Important:
--   まず SELECT preview を確認する。
--   UPDATE はOS/Core DB確認後まで実行しない。
--   DELETE は使わない。履歴を残し、必要なら is_active=false または社員側の参照をNULLへ寄せる。
--   対象は完全一致のみ。

-- ============================================================
-- 1. 家族関係・敬称ラベルが各マスタに存在するか確認
-- ============================================================

with forbidden_labels(label) as (
  values
    ('会長夫人'),
    ('創業者夫人'),
    ('夫人')
)
select
  'positions' as source_table,
  p.id,
  p.position_name as label,
  p.is_active
from public.positions p
join forbidden_labels f
  on p.position_name = f.label
union all
select
  'departments' as source_table,
  d.id,
  d.department_name as label,
  d.is_active
from public.departments d
join forbidden_labels f
  on d.department_name = f.label
union all
select
  'job_types' as source_table,
  jt.id,
  jt.job_type_name as label,
  jt.is_active
from public.job_types jt
join forbidden_labels f
  on jt.job_type_name = f.label
union all
select
  'roles' as source_table,
  r.id,
  coalesce(r.role_name, r.role_key) as label,
  r.is_active
from public.roles r
join forbidden_labels f
  on r.role_name = f.label or r.role_key = f.label
order by source_table, label;

-- 件数確認
with forbidden_labels(label) as (
  values
    ('会長夫人'),
    ('創業者夫人'),
    ('夫人')
),
forbidden_master_rows as (
  select 'positions' as source_table, p.id, p.position_name as label, p.is_active
  from public.positions p
  join forbidden_labels f on p.position_name = f.label
  union all
  select 'departments', d.id, d.department_name, d.is_active
  from public.departments d
  join forbidden_labels f on d.department_name = f.label
  union all
  select 'job_types', jt.id, jt.job_type_name, jt.is_active
  from public.job_types jt
  join forbidden_labels f on jt.job_type_name = f.label
  union all
  select 'roles', r.id, coalesce(r.role_name, r.role_key), r.is_active
  from public.roles r
  join forbidden_labels f on r.role_name = f.label or r.role_key = f.label
)
select
  source_table,
  label,
  is_active,
  count(*) as row_count
from forbidden_master_rows
group by source_table, label, is_active
order by source_table, label, is_active;

-- ============================================================
-- 2. 該当役職を参照している社員を確認
-- ============================================================

with forbidden_positions as (
  select id, position_name
  from public.positions
  where position_name in ('会長夫人', '創業者夫人', '夫人')
)
select
  e.id as employee_uuid,
  e.employee_id,
  e.full_name,
  e.email,
  e.position_id,
  fp.position_name,
  e.employment_status,
  e.employment_type,
  e.is_active
from public.employees e
join forbidden_positions fp
  on e.position_id = fp.id
where e.position_id is not null
order by e.employee_id nulls last, e.full_name;

-- 件数確認
with forbidden_positions as (
  select id, position_name
  from public.positions
  where position_name in ('会長夫人', '創業者夫人', '夫人')
)
select
  fp.position_name,
  count(*) as employee_count
from public.employees e
join forbidden_positions fp
  on e.position_id = fp.id
where e.position_id is not null
group by fp.position_name
order by fp.position_name;

-- ============================================================
-- 3. 文字列属性に混入していないか確認
-- ============================================================

select
  id as employee_uuid,
  employee_id,
  full_name,
  email,
  employment_type,
  employment_status,
  leave_type
from public.employees
where employment_type in ('会長夫人', '創業者夫人', '夫人')
   or employment_status in ('会長夫人', '創業者夫人', '夫人')
   or leave_type in ('会長夫人', '創業者夫人', '夫人')
order by employee_id nulls last, full_name;

-- ============================================================
-- 4. 実行候補: 社員側の禁止役職参照をNULLへ戻す
-- ============================================================
-- 実行前に必ず 2 のpreviewを確認する。
-- 役職は家族関係・敬称ラベルにしないため、該当社員のposition_idはNULLへ戻す。
-- 必要な文脈は備考・履歴側で別管理する。

/*
begin;

-- cleanup_id / batch_id:
--   employee_attribute_cleanup_forbidden_family_label_20260702

with forbidden_positions as (
  select id, position_name
  from public.positions
  where position_name in ('会長夫人', '創業者夫人', '夫人')
),
target_employees as (
  select
    e.id,
    e.position_id,
    fp.position_name
  from public.employees e
  join forbidden_positions fp
    on e.position_id = fp.id
  where e.position_id is not null
),
updated as (
  update public.employees e
  set
    position_id = null,
    updated_at = now()
  from target_employees t
  where e.id = t.id
  returning
    e.id,
    e.full_name,
    t.position_id as old_position_id,
    t.position_name as old_position_name
)
insert into public.master_change_logs (
  table_name,
  record_id,
  changed_by_email,
  change_payload,
  action_type,
  target_name,
  change_summary,
  created_at
)
select
  'employees',
  updated.id,
  null,
  jsonb_build_object(
    'cleanup_id', 'employee_attribute_cleanup_forbidden_family_label_20260702',
    'action', 'employee_attribute.cleanup_forbidden_family_label',
    'old_value', jsonb_build_object(
      'position_id', updated.old_position_id,
      'position_name', updated.old_position_name
    ),
    'new_value', jsonb_build_object(
      'position_id', null
    ),
    'reason', '家族関係・敬称ラベルは社員属性にしない',
    'executed_by', null
  ),
  'employee_attribute.cleanup_forbidden_family_label',
  updated.full_name,
  '家族関係・敬称ラベルの役職参照を解除',
  now()
from updated;

commit;
*/

-- ============================================================
-- 5. 実行候補: 禁止ラベルの役職マスタを通常選択肢から外す
-- ============================================================
-- 社員側の参照を外した後に実行する。
-- 物理削除ではなく is_active=false とする。
-- 2026-07-02時点のOS承認対象:
--   positions.id = 304e9cd5-94c7-4cee-9278-4677b418d30d
--   position_name = 会長夫人

/*
begin;

with target_positions as (
  select id, position_name, is_active
  from public.positions
  where id = '304e9cd5-94c7-4cee-9278-4677b418d30d'::uuid
    and position_name = '会長夫人'
    and is_active = true
),
updated as (
  update public.positions p
  set is_active = false
  from target_positions t
  where p.id = t.id
    and p.is_active is distinct from false
  returning
    p.id,
    p.position_name,
    t.is_active as old_is_active,
    p.is_active as new_is_active
)
insert into public.master_change_logs (
  table_name,
  record_id,
  changed_by_email,
  change_payload,
  action_type,
  target_name,
  change_summary,
  created_at
)
select
  'positions',
  updated.id,
  null,
  jsonb_build_object(
    'cleanup_id', 'employee_attribute_cleanup_forbidden_family_label_20260702',
    'action', 'employee_attribute.cleanup_forbidden_family_label',
    'old_value', jsonb_build_object(
      'position_name', updated.position_name,
      'is_active', updated.old_is_active
    ),
    'new_value', jsonb_build_object(
      'position_name', updated.position_name,
      'is_active', updated.new_is_active
    ),
    'reason', '家族関係・敬称ラベルは役職マスタとして扱わない',
    'executed_by', null
  ),
  'employee_attribute.cleanup_forbidden_family_label',
  updated.position_name,
  '家族関係・敬称ラベルの役職マスタを非表示化',
  now()
from updated;

commit;
*/
