import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sourcePath = new URL('../supabase/migrations/20260725100000_nov_talent_historical_owner_review.sql', import.meta.url);
const compatibilityPath = new URL('../supabase/migrations/20260725170000_nov_talent_historical_owner_review_pg_compat.sql', import.meta.url);

test('historical review RPC uses PostgreSQL-compatible JSON object cardinality', () => {
  const source = fs.readFileSync(sourcePath, 'utf8');
  const compatibility = fs.readFileSync(compatibilityPath, 'utf8');

  assert.doesNotMatch(source, /jsonb_object_length/);
  assert.match(source, /jsonb_object_keys\(v_pair\)/);
  assert.doesNotMatch(compatibility, /jsonb_object_length/);
  assert.match(compatibility, /jsonb_object_keys\(v_pair\)/);
});
