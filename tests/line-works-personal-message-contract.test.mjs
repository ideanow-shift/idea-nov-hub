import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const apiSource = await readFile(new URL("../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");
const uiSource = await readFile(new URL("../portal/master-admin/master-admin.js", import.meta.url), "utf8");
const htmlSource = await readFile(new URL("../portal/master-admin/index.html", import.meta.url), "utf8");

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

test("live send remains fail-closed without an atomic database claim", () => {
  assert.match(apiSource, /LINE_WORKS_PERSONAL_MESSAGE_SEND_ENABLED = false/);
  assert.match(apiSource, /ATOMIC_CLAIM_UNAVAILABLE/);
  assert.doesNotMatch(apiSource, /masterSendLineWorksPersonalMessage[\s\S]{0,2000}sendIdeaLinkNotificationById/);
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
