-- PR001-A / M008
-- Private security-invoker read models. No Consumer API grants in PR001-A.

create view projection.master_manifest_v1
with (security_invoker = true)
as
select
  mv.master_version_id,
  mv.population_version_id,
  mv.effective_as_of as as_of,
  mv.activated_at as generated_at
from governance.master_versions mv
join governance.master_publication_releases mr
  on mr.master_version_id = mv.master_version_id
 and mr.release_sequence = (select max(release_sequence) from governance.master_publication_releases)
where mv.status = 'published';

create view projection.corporation_master_v1
with (security_invoker = true)
as
select
  c.corporation_id,
  c.corporation_code,
  c.display_name,
  c.status,
  mv.master_version_id,
  mv.population_version_id,
  mv.effective_as_of as as_of
from governance.master_versions mv
join governance.master_publication_releases mr
  on mr.master_version_id = mv.master_version_id
 and mr.release_sequence = (select max(release_sequence) from governance.master_publication_releases)
join governance.master_version_members m
  on m.master_version_id = mv.master_version_id
 and m.entity_type = 'corporation'
join core.corporations c
  on c.corporation_version_id = m.entity_version_id
where mv.status = 'published'
  and c.effective_from <= mv.effective_as_of
  and (c.effective_to is null or mv.effective_as_of < c.effective_to);

create view projection.store_master_v1
with (security_invoker = true)
as
select
  s.store_id,
  s.store_code,
  s.display_name as store_name,
  s.status,
  (s.status = 'active') as is_active,
  s.opened_on,
  s.closed_on,
  s.business_timezone,
  operator_relation.corporation_id,
  coalesce(pi.operating_model, operator_relation.operating_model, 'unresolved') as store_type,
  coalesce(pi.in_official_population, false) as in_official_population,
  pi.classification as population_classification,
  mv.master_version_id,
  mv.population_version_id,
  mv.effective_as_of as as_of
from governance.master_versions mv
join governance.master_publication_releases mr
  on mr.master_version_id = mv.master_version_id
 and mr.release_sequence = (select max(release_sequence) from governance.master_publication_releases)
join governance.master_version_members m
  on m.master_version_id = mv.master_version_id
 and m.entity_type = 'store'
join core.stores s
  on s.store_version_id = m.entity_version_id
left join governance.store_population_items pi
  on pi.population_version_id = mv.population_version_id
 and pi.store_id = s.store_id
left join lateral (
  select csr.corporation_id, csr.operating_model
  from core.corporation_store_relationships csr
  where csr.store_id = s.store_id
    and csr.relationship_type = 'operator'
    and csr.effective_from <= mv.effective_as_of
    and (csr.effective_to is null or mv.effective_as_of < csr.effective_to)
  limit 1
) operator_relation on true
where mv.status = 'published'
  and s.effective_from <= mv.effective_as_of
  and (s.effective_to is null or mv.effective_as_of < s.effective_to);

create view projection.department_master_v1
with (security_invoker = true)
as
select
  d.department_id,
  d.department_code,
  d.display_name,
  d.corporation_id,
  d.parent_department_id,
  d.status,
  mv.master_version_id,
  mv.effective_as_of as as_of
from governance.master_versions mv
join governance.master_publication_releases mr
  on mr.master_version_id = mv.master_version_id
 and mr.release_sequence = (select max(release_sequence) from governance.master_publication_releases)
join governance.master_version_members m
  on m.master_version_id = mv.master_version_id
 and m.entity_type = 'department'
join core.departments d
  on d.department_version_id = m.entity_version_id
where mv.status = 'published'
  and d.effective_from <= mv.effective_as_of
  and (d.effective_to is null or mv.effective_as_of < d.effective_to);

create view projection.employee_assignment_v1
with (security_invoker = true)
as
select
  a.assignment_id,
  a.employee_id,
  a.store_id,
  a.assignment_role_code as role,
  a.assignment_kind,
  (a.assignment_kind = 'primary') as is_primary,
  a.allocation_ratio,
  a.effective_from as valid_from,
  a.effective_to as valid_to,
  a.status,
  mv.master_version_id,
  mv.effective_as_of as as_of
from governance.master_versions mv
join governance.master_publication_releases mr
  on mr.master_version_id = mv.master_version_id
 and mr.release_sequence = (select max(release_sequence) from governance.master_publication_releases)
join governance.master_version_members m
  on m.master_version_id = mv.master_version_id
 and m.entity_type = 'assignment'
join core.employee_store_assignments a
  on a.assignment_version_id = m.entity_version_id
where mv.status = 'published'
  and a.effective_from <= mv.effective_as_of
  and (a.effective_to is null or mv.effective_as_of < a.effective_to);

revoke all on all tables in schema projection from public, anon, authenticated;
