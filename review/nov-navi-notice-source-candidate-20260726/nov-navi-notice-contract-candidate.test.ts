import {
  buildNovNaviNoticeEnvelope,
  NOV_NAVI_NOTICE_ACTION,
  NOV_NAVI_NOTICE_SCHEMA,
} from "./nov-navi-notice-contract-candidate.ts";

const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
};

const notice = (title: string) => ({
  type: "notice" as const,
  title,
  body: "詳細は各システムで確認できます。",
  unread: false,
  actionable: false,
});

Deno.test("uses the fixed HUB action name", () => {
  assertEquals(NOV_NAVI_NOTICE_ACTION, "novNaviNoticeRead");
});

Deno.test("returns only the first three structurally safe notices", () => {
  const result = buildNovNaviNoticeEnvelope([notice("一"), notice("二"), notice("三"), notice("四")]);
  assertEquals(result.schema, NOV_NAVI_NOTICE_SCHEMA);
  assertEquals(result.notices.map((item) => item.title), ["一", "二", "三"]);
});

Deno.test("omits malformed, URL-bearing, and extra-field notices", () => {
  const result = buildNovNaviNoticeEnvelope([
    notice("安全なお知らせ"),
    { ...notice("URLあり"), body: "https://example.invalid" },
    { ...notice("余計な値"), employeeId: "not-allowed" },
    { type: "notice", title: "短い", body: "本文", unread: "false", actionable: false },
  ]);
  assertEquals(result.notices.map((item) => item.title), ["安全なお知らせ"]);
});

Deno.test("does not preserve raw non-array provider payloads", () => {
  assertEquals(buildNovNaviNoticeEnvelope({ notices: [notice("不使用")] }).notices, []);
});
