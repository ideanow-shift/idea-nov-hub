-- Reception position cleanup.
-- Employment type and position are separated.
-- employment_type = 'パート', position = 'レセプション'

insert into public.positions (position_no, position_name, is_active)
select '0017', 'レセプション', true
where not exists (
  select 1
  from public.positions
  where position_name = 'レセプション'
);

update public.positions
set is_active = true
where position_name = 'レセプション'
  and is_active is distinct from true;

with reception_position as (
  select id
  from public.positions
  where position_name = 'レセプション'
  order by position_no nulls last, created_at nulls last
  limit 1
)
update public.employees
set
  employment_type = 'パート',
  position_id = coalesce(public.employees.position_id, reception_position.id),
  updated_at = now()
from reception_position
where public.employees.employment_type = 'レセプション';
