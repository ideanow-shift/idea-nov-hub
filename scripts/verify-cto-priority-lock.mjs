import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const lockPath = path.join(root, 'docs', 'cto', 'PORTFOLIO_PRIORITY_LOCK.md');
const logPath = path.join(root, 'docs', 'cto', 'PRIORITY_DECISION_LOG.md');
const agentsPath = path.join(root, 'AGENTS.md');
const expectedLockId = 'CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4';
const expectedPhase = 'PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1';
const failures = [];

const read = (file) => readFile(file, 'utf8');
const requireText = (text, pattern, label) => {
  if (!pattern.test(text)) failures.push(label);
};

const [lock, decisionLog, agents] = await Promise.all([
  read(lockPath),
  read(logPath),
  read(agentsPath),
]);

const activeLocks = [...lock.matchAll(/^STATUS:\s*ACTIVE\s*$/gm)].length;
if (activeLocks !== 1) failures.push(`ACTIVE Lock must be exactly 1; found ${activeLocks}`);
requireText(lock, new RegExp(`^LOCK_ID:\\s*${expectedLockId}$`, 'm'), 'LOCK_ID is not V4');
requireText(lock, new RegExp(`^CURRENT_PHASE:\\s*${expectedPhase}$`, 'm'), 'CURRENT_PHASE mismatch');

const expectedOrder = [
  'PHASE_1_DBF_BACKEND_COMPLETION',
  'PHASE_2_DBF_MANAGEMENT_UI_COMPLETION',
  'PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1',
  'PHASE_4_CORPORATE_MANAGEMENT',
];
const orderSection = lock.match(/## 固定実行順序([\s\S]*?)(?=\n## )/)?.[1] ?? '';
const actualOrder = [...orderSection.matchAll(/^\d+\. `([^`]+)`/gm)].map((match) => match[1]);
if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
  failures.push(`Fixed order mismatch: ${JSON.stringify(actualOrder)}`);
}

requireText(lock, /PR #154／法人会計PromotionはPhase 1の内部工程/, 'PR #154 is not classified as Phase 1');
requireText(lock, /DBF Account Review BackendはPhase 1の内部工程/, 'DBF Account Review Backend is not Phase 1');
requireText(lock, /fix\/dbf-account-review-ui-safe-states[^\n]*Phase 2へ分類/, 'Account Review UI Safe States is not Phase 2');
requireText(lock, /PHASE_ID:\s*PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1/, 'Store Operations is not Phase 3');
requireText(lock, /PHASE_ID:\s*PHASE_4_CORPORATE_MANAGEMENT/, 'Corporate Management is not Phase 4');
requireText(lock, /Owner以外はPhaseまたはPortfolio Priorityを変更できない/, 'Owner-only change clause missing');
requireText(lock, /\[OWNER PHASE TRANSITION\][\s\S]*\[OWNER PRIORITY CHANGE\]/, 'Owner change mechanisms missing');
requireText(lock, /## NOV Talent Bounded Operational Maintenance Exception[\s\S]*STATUS:\s*OWNER_APPROVED/, 'Owner-approved NOV Talent exception missing');
requireText(lock, /NOV Talent bounded maintenanceは最大1 active implementation PR/, 'NOV Talent one-active-PR limit missing');
requireText(lock, /Store Operations Management V1を常に優先/, 'Store Operations priority clause missing');
requireText(lock, /新機能開発。[\s\S]*新規DB schema。[\s\S]*Corporate Management着手。/, 'NOV Talent prohibited scope incomplete');
requireText(lock, /Productionへの次の操作には別のOwner承認が必要/, 'Production separate approval clause missing');
requireText(lock, /## HUB Core Employee Master Bounded Operational Maintenance Exception[\s\S]*STATUS:\s*OWNER_APPROVED/, 'Owner-approved HUB Core employee master exception missing');
requireText(lock, /HUB Core employee master bounded maintenanceは最大1 active implementation PR/, 'HUB Core employee master one-active-PR limit missing');
requireText(lock, /既存社員の姓、名、表示名の訂正・変更機能/, 'HUB Core employee name edit scope missing');
requireText(lock, /社員番号、Firebase UID、login credentialの変更機能への拡張。[\s\S]*氏名以外の社員実データ変更への拡張。/, 'HUB Core employee master prohibited scope incomplete');
requireText(lock, /employee business data write。/, 'HUB Core Production employee write separate approval missing');

const phaseCriteria = {
  'Phase 1': ['法人会計ActualのBackend Contract', '店舗月次営業実績のBackend Contract', 'Canonical Factの保存先', 'PostgreSQL 17 CI', 'Staging Backend Smoke', 'Production writeが0'],
  'Phase 2': ['画面だけで取込からPromotion', 'DeveloperによるSQL操作が不要', '2026-06法人会計Pilot', '店舗月次データPilot', 'Canonical Factをread-back'],
  'Phase 3': ['正式20店舗', '直営13／FC7', '実月次データ', 'Executive Summary', '店舗ポートフォリオ', 'Owner／営業部UAT PASS', '実際の月次会議で利用開始'],
  'Phase 4': ['法人P/L', '法人B/S', '6法人比較', '経営者向けDashboard', '月次経営判断で実働開始'],
};
for (const [phase, criteria] of Object.entries(phaseCriteria)) {
  for (const criterion of criteria) {
    if (!lock.includes(criterion)) failures.push(`${phase} Exit Criterion missing: ${criterion}`);
  }
}

requireText(agents, /docs\/cto\/PORTFOLIO_PRIORITY_LOCK\.md/, 'AGENTS.md read instruction missing');
requireText(agents, /PORTFOLIO LOCK ID:[\s\S]*CURRENT PHASE:[\s\S]*REQUESTED WORK PHASE:[\s\S]*WORK ALLOWED: YES \/ NO/, 'AGENTS.md required report format missing');
requireText(agents, /Owner以外はPhaseを変更できない/, 'AGENTS.md Owner-only Phase rule missing');
requireText(agents, /Owner承認済みの明示例外[\s\S]*ALLOWED範囲内[\s\S]*PROHIBITED範囲/, 'AGENTS.md bounded exception rule missing');
requireText(decisionLog, /DECISION_ID:\s*OWNER-PORTFOLIO-ORDER-2026-08-18-V2/, 'Decision ID missing');
requireText(decisionLog, /DECISION_ID:\s*OWNER-PRIORITY-CHANGE-2026-08-21-NOV-TALENT-BOUNDED-MAINTENANCE/, 'V3 decision record missing');
requireText(decisionLog, /DECISION_ID:\s*OWNER-PRIORITY-CHANGE-2026-08-22-HUB-EMPLOYEE-MASTER-BOUNDED-MAINTENANCE/, 'V4 decision record missing');
requireText(decisionLog, /### SUPERSEDED対象文書\s+なし。/, 'SUPERSEDED disposition missing');
requireText(decisionLog, /STATUS: SUPERSEDED[\s\S]*最新の唯一の正本[\s\S]*docs\/cto\/PORTFOLIO_PRIORITY_LOCK\.md[\s\S]*旧Priorityを現在値として使用してはいけません/, 'SUPERSEDED banner template missing');

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
  }
  return files;
}

const activeMarker = /^STATUS:\s*ACTIVE\s*$/m;
const contradiction = /(?:法人経営管理|Corporate Management)[^\n]{0,100}(?:先行|先に|第1優先|最優先)|(?:Store Operations|店舗営業管理)[^\n]{0,100}(?:現在触らない|後回し)|(?:法人会計Actual|Promotion)[^\n]{0,100}(?:直後|すぐ)[^\n]{0,100}(?:法人経営管理|Corporate Management)|DBF[^\n]{0,100}(?:Portfolio全体を止める|DBFとUIの並行優先)/i;
for (const file of await markdownFiles(root)) {
  if ([path.resolve(lockPath), path.resolve(logPath)].includes(path.resolve(file))) continue;
  const text = await read(file);
  if (activeMarker.test(text) && contradiction.test(text) && !/^STATUS:\s*SUPERSEDED\s*$/m.test(text)) {
    failures.push(`Conflicting ACTIVE Priority document lacks SUPERSEDED banner: ${path.relative(root, file)}`);
  }
}

const prTitle = process.env.PR_TITLE;
const baseSha = process.env.PR_BASE_SHA;
const suppliedChangedFiles = process.env.PR_CHANGED_FILES;
if (prTitle && (baseSha || suppliedChangedFiles)) {
  let changedFiles = suppliedChangedFiles?.split(/\r?\n/).filter(Boolean) ?? [];
  if (!suppliedChangedFiles) {
    try {
      changedFiles = execFileSync('git', ['diff', '--name-only', `${baseSha}...HEAD`], { cwd: root, encoding: 'utf8' })
        .split(/\r?\n/)
        .filter(Boolean);
    } catch (error) {
      failures.push(`Unable to inspect PR diff: ${error.message}`);
    }
  }
  if (changedFiles.includes('docs/cto/PORTFOLIO_PRIORITY_LOCK.md') && !/^\[(OWNER PRIORITY CHANGE|OWNER PHASE TRANSITION)\]/.test(prTitle)) {
    failures.push('Priority Lock changes require a PR title beginning with [OWNER PRIORITY CHANGE] or [OWNER PHASE TRANSITION]');
  }
}

if (failures.length) {
  console.error('CTO Portfolio Execution Order Lock validation: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('CTO Portfolio Execution Order Lock validation: PASS');
console.log(`LOCK_ID: ${expectedLockId}`);
console.log(`CURRENT_PHASE: ${expectedPhase}`);
console.log('ACTIVE Lock count: 1');
console.log('Fixed execution order: PASS');
console.log('DBF UI before Store Operations: PASS');
console.log('Store Operations before Corporate Management: PASS');
console.log('Autonomous reprioritization prohibited: PASS');
console.log('Old active priority disposition: PASS');
console.log('NOV Talent bounded operational maintenance exception: PASS');
console.log('HUB Core employee master bounded operational maintenance exception: PASS');
console.log('Phase order unchanged: PASS');
