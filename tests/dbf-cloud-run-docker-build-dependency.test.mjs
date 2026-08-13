import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockerfilePath = "deploy/dbf-cloud-run-staging-bff-candidate/Dockerfile";
const navigationPath = "deploy/dbf-cloud-run-staging-bff-candidate/canonical-navigation.js";
const buildScriptPath = "tools/build-dbf-staging-pages.mjs";
const dockerfile = fs.readFileSync(path.join(root, dockerfilePath), "utf8").replaceAll("\r\n", "\n");
const buildScript = fs.readFileSync(path.join(root, buildScriptPath), "utf8");
const buildStage = dockerfile.split(/\nFROM\s+/u, 1)[0];
const copyLine = `COPY ${navigationPath} ./${navigationPath}`;

assert.equal(dockerfile.split(copyLine).length - 1, 1);
assert.ok(buildStage.indexOf(copyLine) < buildStage.indexOf(`RUN node ${buildScriptPath}`));
assert.doesNotMatch(dockerfile, /^COPY\s+\.\s+\./gmu);
assert.ok(fs.statSync(path.join(root, navigationPath)).isFile());
assert.equal(
  execFileSync("git", ["ls-files", "--error-unmatch", navigationPath], { cwd: root, encoding: "utf8" }).trim(),
  navigationPath
);

const dockerignorePath = path.join(root, ".dockerignore");
assert.ok(fs.existsSync(dockerignorePath));
const dockerignore = fs.readFileSync(dockerignorePath, "utf8").replaceAll("\r\n", "\n");
const dockerignoreRules = new Set(dockerignore.split("\n").map((line) => line.trim()).filter(Boolean));
assert.ok(dockerignoreRules.has("**"));
assert.ok(dockerignoreRules.has(`!${navigationPath}`));
assert.ok(dockerignoreRules.has("!portal/management-app/**"));
assert.ok(dockerignoreRules.has("!portal/js/**"));
assert.ok(dockerignoreRules.has("portal/js/firebase-config.js"));
assert.ok(dockerignoreRules.has("!deploy/dbf-staging/**"));
assert.ok(dockerignoreRules.has(`!${buildScriptPath}`));
assert.doesNotMatch(dockerignore, new RegExp(`^/?${navigationPath.replaceAll("/", "\\/")}$`, "mu"));

const buildInputs = [
  ...new Set(
    [...buildScript.matchAll(/path\.join\(root,\s*"([^"]+)"\)/gu)]
      .map((match) => match[1])
      .filter((input) => !input.startsWith("build/"))
  ),
  buildScriptPath
];
const copySources = [...buildStage.matchAll(/^COPY\s+(\S+)\s+\S+$/gmu)].map((match) => match[1].replace(/\/$/u, ""));
for (const input of buildInputs) {
  assert.ok(fs.existsSync(path.join(root, input)), `missing build input: ${input}`);
  assert.ok(
    copySources.some((source) => input === source || input.startsWith(`${source}/`)),
    `Docker build stage does not include: ${input}`
  );
}

console.log("dbf cloud run docker build dependency: PASS");
