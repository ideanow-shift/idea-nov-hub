export const NOV_NAVI_NOTICE_ACTION = "novNaviNoticeRead";
export const NOV_NAVI_NOTICE_SCHEMA = "nov-navi-notices-v1";

export type NovNaviNotice = Readonly<{
  type: "important" | "notice";
  title: string;
  body: string;
  unread: boolean;
  actionable: boolean;
}>;

const MAX_NOTICE_COUNT = 3;
const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 240;
const URL_PATTERN = /(?:https?:\/\/|www\.)/i;
const CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;

function isSafeText(value: unknown, maximumLength: number): value is string {
  return typeof value === "string"
    && value.trim().length > 0
    && value.length <= maximumLength
    && !URL_PATTERN.test(value)
    && !CONTROL_PATTERN.test(value);
}

function isNotice(value: unknown): value is NovNaviNotice {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const notice = value as Record<string, unknown>;
  const keys = Object.keys(notice).sort();
  const expected = ["actionable", "body", "title", "type", "unread"];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) return false;
  return (notice.type === "important" || notice.type === "notice")
    && isSafeText(notice.title, MAX_TITLE_LENGTH)
    && isSafeText(notice.body, MAX_BODY_LENGTH)
    && typeof notice.unread === "boolean"
    && typeof notice.actionable === "boolean";
}

export function buildNovNaviNoticeEnvelope(value: unknown): {
  ok: true;
  schema: string;
  notices: NovNaviNotice[];
} {
  const notices = Array.isArray(value) ? value.filter(isNotice).slice(0, MAX_NOTICE_COUNT) : [];
  return { ok: true, schema: NOV_NAVI_NOTICE_SCHEMA, notices };
}
