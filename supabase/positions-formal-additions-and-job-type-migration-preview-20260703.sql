-- HUB / Core DB positions formal additions and job type migration preview.
-- SELECT preview only. Do not execute INSERT/UPDATE/DELETE before OS/Core DB approval.

with missing_required_positions(position_name, sort_order) as (
  values
    ('店長', 1),
    ('店長見習い', 2),
    ('FCオーナー見習い', 3),
    ('一般スタッフ', 4)
),
job_type_position_names(position_name, recommended_job_type_name) as (
  values
    ('スタイリスト', '美容師'),
    ('アシスタント', '美容師'),
    ('レセプション', 'レセプション'),
    ('本部スタッフ', '本部スタッフ')
)
select jsonb_build_object(
  'missing_required_position_preview', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'position_name', mrp.position_name,
      'exists', p.id is not null,
      'id', p.id,
      'position_no', p.position_no,
      'is_active', p.is_active
    ) order by mrp.sort_order), '[]'::jsonb)
    from missing_required_positions mrp
    left join public.positions p
      on p.position_name = mrp.position_name
  ),
  'current_max_position_no', (
    select max(position_no)
    from public.positions
    where position_no ~ '^[0-9]+$'
  ),
  'proposed_position_inserts', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'position_no', lpad((19 + mrp.sort_order)::text, 4, '0'),
      'position_name', mrp.position_name,
      'is_active', true
    ) order by mrp.sort_order), '[]'::jsonb)
    from missing_required_positions mrp
    left join public.positions p
      on p.position_name = mrp.position_name
    where p.id is null
  ),
  'reception_position_deactivation_preview', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'position_no', p.position_no,
      'position_name', p.position_name,
      'is_active', p.is_active,
      'employee_ref_count', (
        select count(*)
        from public.employees e
        where e.position_id = p.id
      )
    )), '[]'::jsonb)
    from public.positions p
    where p.position_name = 'レセプション'
  ),
  'job_type_position_migration_summary', (
    select coalesce(jsonb_agg(row_data order by position_no), '[]'::jsonb)
    from (
      select
        p.position_no,
        jsonb_build_object(
          'position_id', p.id,
          'position_no', p.position_no,
          'position_name', p.position_name,
          'position_is_active', p.is_active,
          'recommended_job_type_name', jtp.recommended_job_type_name,
          'recommended_job_type_id', jt.id,
          'employee_ref_count', count(e.id)
        ) as row_data
      from job_type_position_names jtp
      join public.positions p
        on p.position_name = jtp.position_name
      left join public.job_types jt
        on jt.job_type_name = jtp.recommended_job_type_name
      left join public.employees e
        on e.position_id = p.id
      group by p.id, p.position_no, p.position_name, p.is_active, jtp.recommended_job_type_name, jt.id
    ) s
  ),
  'job_type_position_employee_migration_candidates', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'employee_id', e.id,
      'employee_no', e.employee_id,
      'full_name', e.full_name,
      'current_position_id', p.id,
      'current_position_name', p.position_name,
      'current_job_type_id', e.job_type_id,
      'current_job_type_name', current_jt.job_type_name,
      'recommended_job_type_name', jtp.recommended_job_type_name,
      'recommended_job_type_id', recommended_jt.id,
      'needs_job_type_backfill', e.job_type_id is null
    ) order by p.position_no, e.employee_id), '[]'::jsonb)
    from job_type_position_names jtp
    join public.positions p
      on p.position_name = jtp.position_name
    join public.employees e
      on e.position_id = p.id
    left join public.job_types current_jt
      on current_jt.id = e.job_type_id
    left join public.job_types recommended_jt
      on recommended_jt.job_type_name = jtp.recommended_job_type_name
    where p.position_name in ('スタイリスト', 'アシスタント', '本部スタッフ')
  )
) as preview;

-- INSERT proposal for missing formal positions.
-- Execute only after OS/Core DB approval.
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

-- UPDATE proposal for レセプション only.
-- Execute only after OS/Core DB approval.
/*
begin;

with target_position as (
  select id, position_no, position_name, is_active
  from public.positions
  where id = '799feda6-3263-4080-b133-458743fba752'
    and position_name = 'レセプション'
    and is_active = true
    and not exists (
      select 1
      from public.employees e
      where e.position_id = '799feda6-3263-4080-b133-458743fba752'
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
