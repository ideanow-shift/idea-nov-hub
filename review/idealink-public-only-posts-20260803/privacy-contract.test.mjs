import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildIdeaLinkReadablePostOr,
  canReadIdeaLinkPost,
  filterIdeaLinkPublicPosts,
} from "../../supabase/functions/nov-hub-api/idea-link-privacy.ts";

const api = fs.readFileSync(new URL("../../supabase/functions/nov-hub-api/index.ts", import.meta.url), "utf8");
const organization = fs.readFileSync(new URL("../../supabase/functions/nov-hub-api/organization_health_monitoring_candidate.ts", import.meta.url), "utf8");
const frontend = fs.readFileSync(new URL("../../portal/idea-link-app/index.html", import.meta.url), "utf8");
const sql = fs.readFileSync(new URL("../../supabase/thanks-coin-analytics-public-only-20260803.sql", import.meta.url), "utf8");
const rpcBody = sql.match(/as \$function\$([\s\S]*?)\$function\$;/)?.[1] || "";

const sender = { id: "sender", roleKeys: ["idea_link.staff"] };
const receiver = { id: "receiver", roleKeys: ["idea_link.staff"] };
const other = { id: "other", roleKeys: ["idea_link.staff"] };
const manager = { id: "manager", roleKeys: ["idea_link.manager"] };
const publicPost = { visibility: "public", sender_id: "sender", receiver_id: "receiver" };
const privatePost = { visibility: "private", sender_id: "sender", receiver_id: "receiver" };

assert.equal(canReadIdeaLinkPost(other, publicPost), true, "public post remains readable");
assert.equal(canReadIdeaLinkPost(sender, privatePost), true, "legacy private remains readable by sender");
assert.equal(canReadIdeaLinkPost(receiver, privatePost), true, "legacy private remains readable by receiver");
assert.equal(canReadIdeaLinkPost(other, privatePost), false, "legacy private is hidden from other employees");
assert.equal(canReadIdeaLinkPost(manager, privatePost), false, "legacy private is hidden from non-party managers");
assert.deepEqual(filterIdeaLinkPublicPosts([publicPost, privatePost]), [publicPost], "aggregate filter is public-only");
assert.equal(
  buildIdeaLinkReadablePostOr(manager),
  "(visibility.eq.public,sender_id.eq.manager,receiver_id.eq.manager)",
  "manager timeline has no all-post exception",
);

assert.match(api, /visibility: IDEA_LINK_PUBLIC_VISIBILITY_QUERY,[\s\S]{0,120}order: "created_at\.desc",[\s\S]{0,80}limit: "1000"/, "admin summary query filters at source");
assert.match(api, /const monthPosts = filterIdeaLinkPublicPosts\(posts\)/, "admin summary filters defensively");
assert.match(api, /limit: "2000",[\s\S]{0,160}const targetPosts = filterIdeaLinkPublicPosts\(posts\)/, "MVP filters defensively");
assert.match(organization, /visibility: IDEA_LINK_PUBLIC_VISIBILITY_QUERY/, "organization monitoring filters at source");
assert.match(organization, /if \(!isIdeaLinkPublicPost\(row\)\) return false/, "organization monitoring filters defensively");

assert.match(sql, /and p\.visibility='public'/, "RPC source rows are public-only");
assert.match(sql, /'overallPostCount',\(select pg_catalog\.count\(\*\) from public_rows\)/, "RPC total is public-only");
assert.match(sql, /from months m left join public_rows p/, "RPC monthly trend is public-only");
assert.doesNotMatch(rpcBody, /count\(\*\) from known|left join known/, "RPC has no mixed visibility aggregate");

assert.doesNotMatch(frontend, /name=["']visibility["']|<strong>非公開<\/strong>/, "private choice is absent");
assert.match(frontend, /visibility: "public"/, "new posts remain public");
assert.match(api, /\|\| payload\.visibility !== "public"/, "direct private API input is rejected");

assert.doesNotMatch(frontend, /ideaLink.*(?:Export|Download)|(?:Export|Download).*ideaLink/i, "IDEA LINK post export is absent");
assert.doesNotMatch(api, /ideaLink(?:Post|Timeline).*(?:Export|Search)|ideaLink(?:Export|Search).*(?:Post|Timeline)/i, "IDEA LINK post search/export API is absent");
assert.match(api, /supabaseRequest\("idea_link_audit_logs"[\s\S]*?detail: \{[\s\S]*?visibility,[\s\S]*?category,[\s\S]*?receiverId:/, "audit metadata remains");
const auditWrite = api.match(/await supabaseRequest\("idea_link_audit_logs"[\s\S]*?\n  \}\);/)?.[0] || "";
assert.doesNotMatch(auditWrite, /comment|body|title/, "audit log does not copy post body");

console.log(JSON.stringify({ result: "PASS_PRIVACY_CONTRACT", assertions: 24, productionOperations: 0, rawValuesIncluded: false }));
