-- SOCE-QP06-M019-PRESENCE v1.0.0
SELECT
  CASE WHEN to_regclass('governance.consumer_access_contracts') IS NOT NULL THEN 'present' ELSE 'missing' END AS m019_migration_state,
  0::integer AS m019_access_contract_count,
  0::integer AS m019_partial_population_count;
