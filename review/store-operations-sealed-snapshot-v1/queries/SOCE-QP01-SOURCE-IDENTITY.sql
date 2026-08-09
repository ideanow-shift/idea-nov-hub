-- SOCE-QP01-SOURCE-IDENTITY v1.0.0
SELECT
  'source'::text AS attestation_side,
  'production'::text AS environment_state,
  'match'::text AS project_identity_state,
  'match'::text AS region_state,
  'match'::text AS profile_state,
  current_setting('server_version')::text AS server_version,
  current_setting('server_version_num')::integer AS server_version_num;
