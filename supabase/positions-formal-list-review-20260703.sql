-- HUB / Core DB positions formal list review.
-- SELECT preview only. Do not execute INSERT/UPDATE/DELETE before OS/Core DB approval.

with formal_positions(position_name, sort_order) as (
  values
    ('相談役', 1),
    ('会長', 2),
    ('社長', 3),
    ('副社長', 4),
    ('取締役', 5),
    ('執行役員', 6),
    ('部長', 7),
    ('課長', 8),
    ('係長', 9),
    ('エリアマネージャー', 10),
    ('店長', 11),
    ('店長見習い', 12),
    ('副店長', 13),
    ('FCオーナー', 14),
    ('FCオーナー見習い', 15),
    ('一般スタッフ', 16)
),
cleanup_labels(position_name, cleanup_reason) as (
  values
    ('レセプション', 'job_type'),
    ('アシスタント', 'job_type'),
    ('スタイリスト', 'job_type'),
    ('本部スタッフ', 'job_type'),
    ('会長夫人', 'forbidden_family_label'),
    ('創業者夫人', 'forbidden_family_label'),
    ('夫人', 'forbidden_family_label')
)
select jsonb_build_object(
  'formal_position_status', (
    select coalesce(jsonb_agg(row_data order by sort_order), '[]'::jsonb)
    from (
      select
        f.sort_order,
        jsonb_build_object(
          'position_name', f.position_name,
          'exists', p.id is not null,
          'is_active', p.is_active,
          'position_no', p.position_no,
          'id', p.id
        ) as row_data
      from formal_positions f
      left join public.positions p
        on p.position_name = f.position_name
    ) s
  ),
  'missing_formal_positions', (
    select coalesce(jsonb_agg(f.position_name order by f.sort_order), '[]'::jsonb)
    from formal_positions f
    left join public.positions p
      on p.position_name = f.position_name
    where p.id is null
  ),
  'active_non_formal_positions', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'position_no', p.position_no,
      'position_name', p.position_name,
      'id', p.id,
      'classification',
        case
          when p.position_name in ('レセプション', 'アシスタント', 'スタイリスト', '本部スタッフ') then 'job_type_candidate'
          when p.position_name in ('会長夫人', '創業者夫人', '夫人') then 'forbidden_family_label'
          else 'non_formal_position_review'
        end
    ) order by p.position_no), '[]'::jsonb)
    from public.positions p
    left join formal_positions f
      on f.position_name = p.position_name
    where p.is_active = true
      and f.position_name is null
  ),
  'cleanup_candidate_employee_refs', (
    select coalesce(jsonb_agg(row_data order by position_no), '[]'::jsonb)
    from (
      select
        p.position_no,
        jsonb_build_object(
          'position_no', p.position_no,
          'position_name', p.position_name,
          'id', p.id,
          'is_active', p.is_active,
          'cleanup_reason', c.cleanup_reason,
          'employee_ref_count', count(e.id)
        ) as row_data
      from cleanup_labels c
      join public.positions p
        on p.position_name = c.position_name
      left join public.employees e
        on e.position_id = p.id
      group by p.id, p.position_no, p.position_name, p.is_active, c.cleanup_reason
    ) s
  ),
  'next_position_no_candidate', (
    select lpad((coalesce(max(nullif(position_no, '')::int), 0) + 1)::text, 4, '0')
    from public.positions
    where position_no ~ '^[0-9]+$'
  )
) as preview;

-- INSERT proposal for missing formal positions. Execute only after OS/Core DB approval.
/*
begin;

with proposed_positions(position_no, position_name) as (
  values
    ('0020', '店長'),
    ('0021', '店長見習い'),
    ('0022', 'FCオーナー見習い'),
    ('0023', '一般スタッフ')
),
inserted_positions as (
  insert into public.positions (
    position_no,
    position_name,
    is_active
  )
  select
    pp.position_no,
    pp.position_name,
    true
  from proposed_positions pp
  where not exists (
    select 1
    from public.positions p
    where p.position_name = pp.position_name
  )
  returning id, position_no, position_name, is_active
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
  id,
  'm.wakita@idea-nov.com',
  jsonb_build_object(
    'cleanup_id', 'employee_attribute_required_positions_20260703',
    'action', 'employee_attribute.add_required_position',
    'new_value', jsonb_build_object(
      'position_no', position_no,
      'position_name', position_name,
      'is_active', is_active
    ),
    'reason', 'OS/Core DB正式役職リストに含まれるため',
    'executed_by', 'm.wakita@idea-nov.com'
  ),
  'employee_attribute.add_required_position',
  position_name,
  '正式役職マスタを追加',
  now()
from inserted_positions;

commit;
*/

-- UPDATE proposal for レセプション only. Execute only after OS/Core DB approval.
-- Preconditions:
--   public.positions.position_name = 'レセプション'
--   employee reference count = 0
/*
begin;

with target_position as (
  select id, position_no, position_name, is_active
  from public.positions
  where position_name = 'レセプション'
    and is_active = true
    and not exists (
      select 1
      from public.employees e
      where e.position_id = public.positions.id
    )
),
updated_position as (
  update public.positions p
  set is_active = false
  from target_position t
  where p.id = t.id
  returning p.id, p.position_no, p.position_name, t.is_active as old_is_active, p.is_active as new_is_active
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
  id,
  'm.wakita@idea-nov.com',
  jsonb_build_object(
    'cleanup_id', 'employee_attribute_cleanup_job_type_positions_20260703',
    'action', 'employee_attribute.deactivate_job_type_position',
    'old_value', jsonb_build_object('position_name', position_name, 'is_active', old_is_active),
    'new_value', jsonb_build_object('position_name', position_name, 'is_active', new_is_active),
    'reason', 'レセプションはpositionsではなくjob_typesで扱うため',
    'executed_by', 'm.wakita@idea-nov.com'
  ),
  'employee_attribute.deactivate_job_type_position',
  position_name,
  '職種系役職を非表示化',
  now()
from updated_position;

commit;
*/
