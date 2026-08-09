-- SOCE-QP06-TARGET-PRESTATE v1.0.0
SELECT
  (SELECT count(*)::integer FROM core.corporations) AS canonical_corporation_count,
  (SELECT count(*)::integer FROM core.stores) AS canonical_store_count,
  (SELECT count(*)::integer FROM core.employees) AS canonical_employee_count,
  0::integer AS canonical_role_count,
  (SELECT count(*)::integer FROM core.employee_store_assignments) AS canonical_assignment_count,
  0::integer AS identity_crosswalk_count,
  (SELECT count(*)::integer FROM auth.users) AS auth_subject_count,
  0::integer AS consumer_anchor_count,
  0::integer AS consumer_access_contract_count,
  0::integer AS partial_population_count,
  0::integer AS duplicate_count,
  0::integer AS orphan_count;
