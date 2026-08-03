import assert from "node:assert/strict";
import fs from "node:fs";

const apiPath = new URL("../../supabase/functions/nov-hub-api/index.ts", import.meta.url);
const privacyPath = new URL("../../supabase/functions/nov-hub-api/idea-link-privacy.ts", import.meta.url);
const frontendPath = new URL("../../portal/idea-link-app/index.html", import.meta.url);
const api = fs.readFileSync(apiPath, "utf8");
const privacy = fs.readFileSync(privacyPath, "utf8");
const frontend = fs.readFileSync(frontendPath, "utf8");

const visibilityGuard = api.match(/function buildIdeaLinkVisibilityOr\(employee: JsonRecord\) \{[\s\S]*?\n\}/)?.[0] || "";
const visibilityNormalizer = api.match(/function normalizeIdeaLinkVisibility\(value: unknown\) \{[\s\S]*?\n\}/)?.[0] || "";

assert.match(frontend, /visibility: "public"/);
assert.doesNotMatch(frontend, /name=["']visibility["']/);
assert.doesNotMatch(frontend, /<strong>非公開<\/strong>/);
assert.match(frontend, /投稿したサンクスメッセージはIDEA LINKを利用するスタッフに公開されます。/);

assert.match(visibilityNormalizer, /IDEA LINK posts must be public/);
assert.match(api, /\|\| payload\.visibility !== "public"/);
assert.doesNotMatch(api, /payload\.visibility !== "public" && payload\.visibility !== "private"/);

assert.match(visibilityGuard, /return buildIdeaLinkReadablePostOr\(employee\)/);
assert.match(privacy, /IDEA_LINK_PUBLIC_VISIBILITY_QUERY = "eq\.public"/);
assert.match(privacy, /`visibility\.\$\{IDEA_LINK_PUBLIC_VISIBILITY_QUERY\}`/);
assert.match(privacy, /sender_id\.eq/);
assert.match(privacy, /receiver_id\.eq/);
assert.doesNotMatch(visibilityGuard, /isIdeaLinkManager/);
assert.doesNotMatch(visibilityGuard, /receiver_store_id\.eq/);
assert.doesNotMatch(visibilityGuard, /receiver_department_id\.eq/);

assert.match(api, /String\(row\.visibility \|\| ""\) === "private" \? "private" : "public"/);
assert.match(api, /or: `\(sender_id\.eq\.\$\{employeeId\},receiver_id\.eq\.\$\{employeeId\}\)`/);

console.log("PASS: IDEA LINK accepts only public new posts and limits legacy private posts to sender/receiver access.");
