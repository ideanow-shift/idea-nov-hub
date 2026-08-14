import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationsDirectory = path.join(root, "supabase", "migrations");
const foundationName = "20260814140109_dbf_business_data_phase1_foundation.sql";
const correctiveName = "20260814195712_dbf_business_data_phase1_service_role_acl_corrective.sql";
const foundation = fs.readFileSync(path.join(migrationsDirectory, foundationName), "utf8");
const corrective = fs.readFileSync(path.join(migrationsDirectory, correctiveName), "utf8");

const factTables = [
  "dbf_pl_detail_facts",
  "dbf_pl_aggregate_facts",
  "dbf_bs_facts",
  "dbf_store_monthly_metric_facts",
  "dbf_budget_facts",
];

const canonicalLf = (value) => value.replace(/\r\n/gu, "\n");
const sha256 = (value) => crypto.createHash("sha256").update(canonicalLf(value)).digest("hex");

test("applied foundation migration bytes remain immutable", () => {
  assert.equal(
    sha256(foundation),
    "b366620d251e01583b3ee8af0f559c70ed58d969c1cdbf60eb90d08287a88286",
  );
});

test("reviewed corrective migration bytes remain fixed", () => {
  assert.equal(
    sha256(corrective),
    "108e10bd5998f825874783bae8ddb2253d5042b1f6d9049a72d52f67ff4cc5d4",
  );
});

test("corrective is transactional, forward-only, and contains no row DML", () => {
  assert.match(corrective, /^-- DBF Business Facts MVP[\s\S]*\bbegin;[\s\S]*\bcommit;\s*$/u);
  assert.doesNotMatch(corrective, /\brollback\b/iu);
  assert.doesNotMatch(corrective, /^\s*(?:insert\s+into|update|delete\s+from)\b/imu);
  assert.doesNotMatch(corrective, /^\s*(?:drop|truncate|alter\s+table|create\s+table)\b/imu);
  assert.doesNotMatch(corrective, /\balter\s+default\s+privileges\b/iu);
  assert.doesNotMatch(corrective, /\b(?:grant|revoke)\b[^;]*(?:schema|sequence|function)\b/iu);
});

test("corrective targets exactly the five canonical Fact tables", () => {
  for (const table of factTables) {
    assert.match(corrective, new RegExp(`public\\.${table}\\b`, "u"));
  }

  const dbfFactReferences = [
    ...corrective.matchAll(/public\.(dbf_[a-z0-9_]+_facts)\b/gu),
  ].map((match) => match[1]);
  assert.deepEqual([...new Set(dbfFactReferences)].sort(), [...factTables].sort());
  assert.doesNotMatch(corrective, /\bdbf_ingest\./u);
});

test("service_role is replaced with the exact SELECT INSERT UPDATE ACL", () => {
  assert.match(
    corrective,
    /revoke all privileges on table[\s\S]*public\.dbf_budget_facts[\s\S]*from service_role;/u,
  );
  assert.match(
    corrective,
    /grant select, insert, update on table[\s\S]*public\.dbf_budget_facts[\s\S]*to service_role;/u,
  );
  assert.doesNotMatch(
    corrective,
    /grant\s+[^;]*\b(?:delete|truncate|references|trigger|maintain)\b[^;]*to\s+service_role/iu,
  );
  assert.doesNotMatch(corrective, /with\s+grant\s+option/iu);
});

test("fail-close checks cover existence, ownership, membership, sequence, and effective ACL", () => {
  assert.match(corrective, /Expected all five DBF Phase 1 Fact tables/u);
  assert.match(corrective, /c\.relkind <> 'r'/u);
  assert.match(corrective, /owner_role\.rolname = 'service_role'/u);
  assert.match(corrective, /pg_has_role\('service_role', owner_role\.oid, 'MEMBER'\)/u);
  assert.match(corrective, /pg_has_role\('service_role', owner_role\.oid, 'SET'\)/u);
  assert.match(corrective, /with recursive inherited_roles/u);
  assert.match(corrective, /a\.attidentity <> ''/u);
  assert.match(corrective, /nextval/u);
  assert.match(corrective, /has_table_privilege\('service_role'/u);
  assert.match(corrective, /aclexplode/u);
  assert.match(corrective, /acl\.grantee = 0/u);
  assert.match(corrective, /acl\.is_grantable/u);
});

test("browser and PUBLIC grants cannot be introduced by the corrective", () => {
  assert.doesNotMatch(corrective, /\bto\s+(?:anon|authenticated|public)\s*;/iu);
  assert.match(corrective, /Browser role gained an effective privilege/u);
  assert.match(corrective, /PUBLIC has a DBF Phase 1 Fact table grant/u);
});

test("future public.dbf_*_facts migrations must declare their table ACL", () => {
  const migrationNames = fs
    .readdirSync(migrationsDirectory)
    .filter((name) => name.endsWith(".sql") && name > correctiveName)
    .sort();

  for (const migrationName of migrationNames) {
    const sql = fs.readFileSync(path.join(migrationsDirectory, migrationName), "utf8");
    const createdFactTables = [
      ...sql.matchAll(/create\s+table\s+public\.(dbf_[a-z0-9_]+_facts)\b/giu),
    ].map((match) => match[1]);

    for (const table of createdFactTables) {
      assert.match(
        sql,
        new RegExp(
          `revoke\\s+all\\s+privileges\\s+on\\s+table[\\s\\S]*?public\\.${table}[\\s\\S]*?from\\s+service_role\\s*;`,
          "iu",
        ),
        `${migrationName} must revoke the inherited service_role ACL for ${table}`,
      );
      assert.match(
        sql,
        new RegExp(
          `grant\\s+select\\s*,\\s*insert\\s*,\\s*update\\s+on\\s+table[\\s\\S]*?public\\.${table}[\\s\\S]*?to\\s+service_role\\s*;`,
          "iu",
        ),
        `${migrationName} must declare the exact service_role ACL for ${table}`,
      );
      assert.doesNotMatch(
        sql,
        new RegExp(
          `grant[\\s\\S]*?public\\.${table}[\\s\\S]*?\\b(?:delete|truncate|references|trigger|maintain)\\b[\\s\\S]*?to\\s+service_role`,
          "iu",
        ),
      );
      assert.doesNotMatch(
        sql,
        new RegExp(`grant[\\s\\S]*?public\\.${table}[\\s\\S]*?to\\s+(?:anon|authenticated|public)\\b`, "iu"),
      );
    }
  }
});

test("corrective source contains no secret or Production binding", () => {
  assert.doesNotMatch(
    corrective,
    /(?:nkmxevmioczcmnldreyo|idea-nov-core|service_role\s*=|DB_PASSWORD|PRIVATE KEY|oauth_client_secret|github_token)/iu,
  );
});
