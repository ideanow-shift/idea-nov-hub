import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const scanTargets = [
  "app.js",
  "index.html",
  "styles.css",
  "portal/concierge",
  "supabase/functions/concierge-api",
];

const ignoredPathParts = [
  ".temp",
  "node_modules",
  ".git",
];

const textExtensions = new Set([
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".html",
  ".css",
  ".sql",
  ".md",
]);

const rules = [
  {
    id: "family-label-as-attribute",
    message: "家族関係・敬称ラベルを社員属性や権限判定に使わない",
    patterns: [/会長夫人/g, /創業者夫人/g, /夫人/g],
  },
  {
    id: "reception-as-position",
    message: "レセプションは役職ではなく job_types の職種として扱う",
    patterns: [
      /レセプション.{0,30}(役職|position|position_id|positions)/gi,
      /(役職|position|position_id|positions).{0,30}レセプション/gi,
    ],
  },
  {
    id: "position-as-permission",
    message: "一般スタッフなどの役職名を管理権限として使わない",
    patterns: [
      /一般スタッフ.{0,30}(管理権限|権限|admin|role|roleKeys)/gi,
      /(管理権限|権限|admin|role|roleKeys).{0,30}一般スタッフ/gi,
    ],
  },
];

function extensionOf(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index).toLowerCase();
}

function shouldIgnore(path) {
  return ignoredPathParts.some((part) => path.split(/[\\/]/).includes(part));
}

function collectFiles(path, files = []) {
  if (shouldIgnore(path)) return files;
  const stats = statSync(path);
  if (stats.isDirectory()) {
    for (const entry of readdirSync(path)) collectFiles(join(path, entry), files);
    return files;
  }
  if (stats.isFile() && textExtensions.has(extensionOf(path))) files.push(path);
  return files;
}

function collectConciergeSupabaseFiles() {
  const supabaseDir = join(root, "supabase");
  if (!existsSync(supabaseDir)) return [];
  return readdirSync(supabaseDir)
    .filter((entry) => /^concierge[_-].*\.(sql|md)$/i.test(entry))
    .map((entry) => join(supabaseDir, entry))
    .filter((path) => statSync(path).isFile());
}

function lineNumberFor(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

const files = scanTargets.flatMap((target) => {
  const path = join(root, target);
  try {
    return collectFiles(path);
  } catch {
    return [];
  }
}).concat(collectConciergeSupabaseFiles());

const findings = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      pattern.lastIndex = 0;
      for (const match of content.matchAll(pattern)) {
        findings.push({
          file: relative(root, file),
          line: lineNumberFor(content, match.index ?? 0),
          rule: rule.id,
          message: rule.message,
          match: match[0],
        });
      }
    }
  }
}

if (findings.length) {
  console.error("Forbidden employee attribute label usage found:");
  for (const finding of findings) {
    console.error(
      `- ${finding.file}:${finding.line} [${finding.rule}] ${finding.message}: ${finding.match}`,
    );
  }
  process.exit(1);
}

console.log("OK: forbidden employee attribute label usage was not found in NOV Navi implementation files.");
