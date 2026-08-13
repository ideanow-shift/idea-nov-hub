import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { basename, resolve } from "node:path";
import { readFile } from "node:fs/promises";

const EXPECTED_FILENAME = "20260813063843_nov_talent_salon_visit_backfill_preparation.sql";
const EXPECTED_SHA256 = "0c25a48e54f1927680deb7e64c8ae4682fbb461525d7dcb4a2f1ff4061cc4972";
const migrationPath = resolve(process.argv[2] || `supabase/migrations/${EXPECTED_FILENAME}`);
const bytes = await readFile(migrationPath);

assert.equal(basename(migrationPath), EXPECTED_FILENAME, "formal migration filename mismatch");
assert.equal(createHash("sha256").update(bytes).digest("hex"), EXPECTED_SHA256, "formal migration SHA-256 mismatch");
assert.equal(bytes.includes(0), false, "formal migration contains a null byte");
assert.equal(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false, "formal migration contains a UTF-8 BOM");

const sql = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
assert.equal(Buffer.from(sql, "utf8").equals(bytes), true, "formal migration is not canonical UTF-8");
assert.match(sql, /(?:^|\n)begin;\s*(?:\r?\n)/iu, "formal migration does not open a transaction");
assert.match(sql, /(?:^|\n)commit;\s*$/iu, "formal migration does not end with COMMIT");
assert.doesNotMatch(sql, /rollback;\s*$/iu, "formal migration has a trailing ROLLBACK");
assert.doesNotMatch(
  sql,
  /\b(?:drop\s+(?:table|schema|column|constraint|index|type)|truncate(?:\s+table)?|alter\s+table[^;]*\bdrop\b)/iu,
  "formal migration contains destructive DDL",
);

console.log(JSON.stringify({
  result: "SALON_VISIT_MIGRATION_BYTE_INTEGRITY_PASS",
  filename: EXPECTED_FILENAME,
  sha256: EXPECTED_SHA256,
  utf8: true,
  bom: false,
  nullByte: false,
  transaction: "BEGIN_COMMIT",
  destructiveDdlCount: 0,
}));
