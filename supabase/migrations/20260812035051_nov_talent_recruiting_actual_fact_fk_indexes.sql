begin;

create index nov_talent_engagement_fact_candidate_fk_v1
  on public.nov_talent_recruiting_engagement_facts_v1 (candidate_id);

create index nov_talent_engagement_audit_fact_fk_v1
  on public.nov_talent_recruiting_engagement_audit_v1 (engagement_fact_id);

create index nov_talent_selection_coverage_supersedes_fk_v1
  on public.nov_talent_selection_coverage_releases_v1 (supersedes_release_id);

create index nov_talent_selection_coverage_superseded_by_fk_v1
  on public.nov_talent_selection_coverage_releases_v1 (superseded_by_release_id);

create index nov_talent_selection_coverage_audit_release_fk_v1
  on public.nov_talent_selection_coverage_audit_v1 (coverage_release_id);

create index nov_talent_spend_audit_fact_fk_v1
  on public.nov_talent_recruiting_spend_audit_v1 (spend_fact_id);

commit;
