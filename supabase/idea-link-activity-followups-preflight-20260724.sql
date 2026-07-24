begin transaction read only;
set local statement_timeout = '5s';
set local lock_timeout = '1s';

with candidate as (
  select
    to_regclass('public.employees') is not null
      and to_regclass('public.stores') is not null as dependencies_exact,
    to_regclass('public.idea_link_activity_followups') is not null as candidate_present
),
shape as (
  select
    case
      when not candidate_present then 'ABSENT'
      when (
        select array_agg(attname::text order by attname::text)
          from pg_attribute
         where attrelid = to_regclass('public.idea_link_activity_followups')
           and attnum > 0
           and not attisdropped
      ) = array[
        'assigned_to_employee_id', 'created_at', 'created_by_employee_id', 'id',
        'next_review_on', 'signal_categories', 'status', 'store_id',
        'target_employee_id', 'updated_at', 'updated_by_employee_id'
      ]::text[] then 'EXACT'
      else 'INCOMPATIBLE'
    end as candidate_category,
    dependencies_exact
  from candidate
)
select json_build_object(
  'dependenciesExact', dependencies_exact,
  'candidateCategory', candidate_category,
  'migrationReady', dependencies_exact and candidate_category in ('ABSENT', 'EXACT'),
  'businessRowsRead', false,
  'rawValuesIncluded', false
) as followup_preflight
from shape;

rollback;
