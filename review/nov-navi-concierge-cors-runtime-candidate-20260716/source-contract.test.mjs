const source = await Deno.readTextFile(new URL("../../supabase/functions/concierge-api/index.ts", import.meta.url));
function equal(actual, expected) { if (actual !== expected) throw new Error(`expected ${expected}, got ${actual}`); }
function count(pattern) { return [...source.matchAll(pattern)].length; }

Deno.test("01 exact portal origin constant", () => equal(count(/const PORTAL_ORIGIN = "https:\/\/ideanow-shift\.github\.io";/g), 1));
Deno.test("02 wildcard allow-origin removed", () => equal(count(/Access-Control-Allow-Origin["']?:\s*["']\*["']/gi), 0));
Deno.test("03 exact origin comparison exists", () => equal(count(/origin !== PORTAL_ORIGIN/g), 1));
Deno.test("04 rejected origin precedes preflight", () => equal(source.indexOf("origin !== PORTAL_ORIGIN") < source.indexOf('request.method === "OPTIONS"'), true));
Deno.test("05 OPTIONS exact branch", () => equal(count(/request\.method === "OPTIONS"/g), 1));
Deno.test("06 POST-only branch", () => equal(count(/request\.method !== "POST"/g), 1));
Deno.test("07 GET payload branch removed", () => equal(count(/request\.method === "GET"/g), 0));
Deno.test("08 formData payload removed", () => equal(count(/request\.formData\(/g), 0));
Deno.test("09 exact JSON media type", () => equal(count(/const JSON_MEDIA_TYPE = "application\/json";/g), 1));
Deno.test("10 body limit fixed", () => equal(count(/const MAX_BODY_BYTES = 4096;/g), 1));
Deno.test("11 request body read once", () => equal(count(/await request\.text\(\)/g), 1));
Deno.test("12 UTF-8 byte counting", () => equal(count(/new TextEncoder\(\)\.encode\(bodyText\)\.byteLength/g), 1));
Deno.test("13 JSON parsing exact once", () => equal(count(/JSON\.parse\(bodyText\)/g), 1));
Deno.test("14 array body rejected", () => equal(count(/!parsed \|\| typeof parsed !== "object" \|\| Array\.isArray\(parsed\)/g), 1));
Deno.test("15 no-store is fixed", () => equal(count(/["']cache-control["']\s*,?\s*:\s*["']no-store["']/gi) >= 1, true));
Deno.test("16 Vary Origin is fixed", () => equal(count(/["']vary["']\s*,?\s*:\s*["']Origin["']/gi) >= 1, true));
Deno.test("17 allow methods are POST OPTIONS", () => equal(count(/POST, OPTIONS/g), 1));
Deno.test("18 existing action dispatcher retained", () => equal(count(/const action = getString\(payload\.action\)/g), 1));
Deno.test("19 existing session verifier retained", () => equal(count(/async function requireSession/g), 1));
Deno.test("20 existing admin verifier retained", () => equal(count(/async function requireAdmin/g), 1));
Deno.test("21 response is wrapped once", () => equal(count(/return withCors\(response, origin\);/g), 1));
Deno.test("22 raw body not logged", () => equal(count(/console\.(?:log|error|warn)\([^\n]*bodyText/g), 0));
Deno.test("23 parsed payload not logged", () => equal(count(/console\.(?:log|error|warn)\([^\n]*payload/g), 0));
