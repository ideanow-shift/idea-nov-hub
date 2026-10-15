import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiSource = await readFile(new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");
const uiSource = await readFile(new URL("../portal/master-admin/master-admin.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../portal/master-admin/index.html", import.meta.url), "utf8");
const senderSource = await readFile(new URL("../supabase/functions/send-line-works-notifications/index.ts", import.meta.url), "utf8");
const migrationSource = await readFile(new URL("../supabase/migrations/20261015083908_line_works_personal_message_delivery_v1.sql", import.meta.url), "utf8");

test("personal message actions require the existing master editor authorization", () => {
  for (const action of ["masterPreviewLineWorksPersonalMessage", "masterSendLineWorksPersonalMessage"]) {
    assert.match(apiSource, new RegExp(`action === "${action}"[\\s\\S]{0,120}assertMasterEditor\\(employee\\)`));
  }
});

test("preview approval is short-lived and bound to recipient/title/body fingerprint", () => {
  assert.match(apiSource, /LINE_WORKS_PERSONAL_MESSAGE_APPROVAL_TTL_SECONDS = 5 \* 60/);
  assert.match(apiSource, /JSON\.stringify\(\[input\.recipientEmployeeId, input\.title, input\.body\]\)/);
  assert.match(apiSource, /APPROVAL_MISMATCH/);
});

test("bounded live send requires the isolated atomic database claim", () => {
  assert.match(apiSource, /claim_line_works_personal_message_v1/);
  assert.match(apiSource, /personalMessageClaimId: claimId/);
  assert.match(apiSource, /LINE_WORKS_PERSONAL_MESSAGE_RECIPIENT_NAME = "脇田 将樹"/);
  assert.match(apiSource, /MESSAGE_OUTSIDE_APPROVAL/);
});

test("sender accepts only cryptographically established internal invocation", () => {
  assert.match(senderSource, /constantTimeEquals\(bearerToken, serviceKey\)/);
  assert.match(senderSource, /constantTimeEquals\(providedSecret, triggerSecret\)/);
  assert.doesNotMatch(senderSource, /isVerifiedServiceRoleJwt|decodeJwtPayload|\/auth\/v1\/user/);
});

test("personal delivery is employee-only and isolated from the existing queue", () => {
  assert.match(senderSource, /line_works_personal_message_deliveries/);
  assert.match(senderSource, /\.eq\("target_type", "employee"\)/);
  assert.match(senderSource, /\.eq\("purpose", "primary"\)/);
  assert.match(senderSource, /type: "user"/);
  assert.doesNotMatch(migrationSource, /(?:update|delete\s+from|insert\s+into)\s+os\.notifications\b/i);
});

test("migration provides atomic claim and permanent unknown-result stop", () => {
  assert.match(migrationSource, /insert into os\.line_works_personal_message_deliveries[\s\S]*on conflict do nothing[\s\S]*returning/);
  assert.match(migrationSource, /unique index[\s\S]*recipient_employee_id, content_fingerprint/);
  assert.match(migrationSource, /delivery_unknown/);
  assert.match(migrationSource, /revoke all on function[\s\S]*from public, anon, authenticated/);
  assert.match(migrationSource, /grant execute on function[\s\S]*to service_role/);
});

test("master UI provides exact preview, masked destination, and confirmation controls", () => {
  assert.match(htmlSource, /line-works-personal-message-recipient/);
  assert.match(htmlSource, /line-works-personal-message-confirm/);
  assert.match(uiSource, /preview\.recipient\.destinationMasked/);
  assert.match(uiSource, /!preview\?\.sendAvailable/);
  assert.match(htmlSource, /【接続テスト】/);
  assert.match(htmlSource, /脇田AI秘書からLINE WORKSへの送信テストです。返信・対応は不要です。/);
  assert.doesNotMatch(htmlSource, /野方店|Instagram|提出依頼|未提出/);
});
