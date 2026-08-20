import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../docs/store_operations_management/production_release/staging_core_uat_security/', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, root), 'utf8');

test('sealed population artifact is exact, deterministic, private, and reversible', () => {
  const doc = read('sealed-population-artifact-spec.md');
  for (const term of ['six corporations', '20 official stores', 'three Owner-selected UAT employees', 'HQ', 'SHA-256', 'dry-run', 'rollback', 'single transaction', 'synthetic rows', 'Production database copy']) {
    assert.match(doc, new RegExp(term, 'iu'));
  }
  for (const dataset of ['corporations', 'stores', 'employees', 'identities', 'roles', 'assignments']) assert.match(doc, new RegExp(`\\b${dataset}\\b`, 'u'));
});

test('AUTH-01 adopts native passwordless Auth and server-only exact binding', () => {
  const doc = read('auth01-security-spec.md');
  for (const term of ['Admin-created Staging Supabase Auth users', 'signInWithOtp', 'shouldCreateUser: false', 'PKCE', 'server', 'opaque', 'HttpOnly', 'Email is only a delivery attribute', 'M019', 'SCOPE_DENIED']) {
    assert.match(doc, new RegExp(term, 'iu'));
  }
  assert.doesNotMatch(doc, /password:\s*["'][^"']+/iu);
});

test('runbooks and matrix preserve zero-write, spoof, revoke, and environment gates', () => {
  const combined = ['supabase-auth-onboarding-runbook.md', 'rollback-revoke-runbook.md', 'test-matrix.md', 'implementation-plan.md'].map(read).join('\n');
  for (const term of ['unknown Auth subject', 'inactive', 'expired', 'Role/employee spoof', 'scope/Store UUID', 'raw UUID', 'service role', 'Business write 0', 'DBF Canonical write 0', 'Production']) {
    assert.match(combined, new RegExp(term, 'iu'));
  }
});
