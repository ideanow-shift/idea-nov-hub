import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRelativePath = 'review/store-operations-sealed-snapshot-v1';
const packageRoot = join(repositoryRoot, packageRelativePath);
const parentAttributesPath = join(repositoryRoot, '.gitattributes');
const parentRule = 'review/store-operations-sealed-snapshot-v1/** text eol=lf';
const nestedRule = 'review/store-operations-sealed-snapshot-v1/.gitattributes text eol=lf';
const packageLock = JSON.parse(readFileSync(join(packageRoot, 'execution-package-lock-v1.json'), 'utf8'));
const baselinePackageLock = JSON.parse(gitShow(`${packageRelativePath}/execution-package-lock-v1.json`).toString('utf8'));
const SQL_ARTIFACT_COUNT = 16;
let moduleNonce = 0;
let passed = 0;

function test(name, fn) {
  return Promise.resolve().then(fn).then(() => {
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function containsCrLf(bytes) {
  return bytes.includes(Buffer.from('\r\n'));
}

function git(args, { cwd, encoding = 'utf8' } = {}) {
  return execFileSync('git', args, { cwd, encoding, stdio: ['ignore', 'pipe', 'pipe'] });
}

function packagePath(root, artifactPath) {
  const absolute = resolve(root, artifactPath);
  assert.equal(relative(root, absolute).replaceAll('\\', '/'), artifactPath);
  return absolute;
}

function gitShow(relativePath) {
  return git(['show', `HEAD:${relativePath}`], { cwd: repositoryRoot, encoding: 'buffer' });
}

function gitBlob(packageArtifactPath) {
  return gitShow(`${packageRelativePath}/${packageArtifactPath}`);
}

async function packageVerifier(root) {
  const moduleUrl = `${pathToFileURL(join(root, 'execution-package-lock.mjs')).href}?eolIntegrity=${moduleNonce++}`;
  return import(moduleUrl);
}

async function assertPackageIntegrity(root) {
  assert.equal(packageLock.artifacts.length, 29);
  const sqlArtifacts = packageLock.artifacts.filter(({ path }) => path.startsWith('queries/'));
  assert.equal(sqlArtifacts.length, SQL_ARTIFACT_COUNT);

  for (const artifact of packageLock.artifacts) {
    const bytes = readFileSync(packagePath(root, artifact.path));
    assert.equal(sha256(bytes), artifact.sha256, artifact.path);
    assert.equal(bytes.includes(Buffer.from('\r')), false, `${artifact.path} must be LF-only`);
  }

  const { verifyExecutionPackage } = await packageVerifier(root);
  const derived = verifyExecutionPackage({ packageRoot: root });
  assert.equal(derived.packageSha256, packageLock.packageSha256);
  assert.equal(derived.queryPackSha256, packageLock.queryPackSha256);
  assert.equal(derived.schemaContractSha256, packageLock.schemaContractSha256);
}

function materializePackageFromGitBlobs(destinationRoot) {
  const destinationPackageRoot = join(destinationRoot, packageRelativePath);
  mkdirSync(dirname(destinationPackageRoot), { recursive: true });
  cpSync(packageRoot, destinationPackageRoot, { recursive: true });

  for (const artifact of packageLock.artifacts) {
    const destination = packagePath(destinationPackageRoot, artifact.path);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, gitBlob(artifact.path));
  }
}

function createFixtureRepository({ withParentRule }) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'soce-eol-integrity-'));
  const fixtureRepository = join(fixtureRoot, 'repository');
  mkdirSync(fixtureRepository, { recursive: true });
  git(['init', '--initial-branch=main'], { cwd: fixtureRepository });
  git(['config', 'user.name', 'SOCE EOL Fixture'], { cwd: fixtureRepository });
  git(['config', 'user.email', 'soce-eol-fixture'], { cwd: fixtureRepository });
  materializePackageFromGitBlobs(fixtureRepository);
  if (withParentRule) writeFileSync(join(fixtureRepository, '.gitattributes'), `${parentRule}\n${nestedRule}\n`, 'utf8');
  git(['add', '--', packageRelativePath], { cwd: fixtureRepository });
  if (withParentRule) git(['add', '--', '.gitattributes'], { cwd: fixtureRepository });
  git(['commit', '--quiet', '-m', 'fixture'], { cwd: fixtureRepository });
  return { fixtureRoot, fixtureRepository };
}

function createFreshWorktree(fixtureRepository, autocrlf, label = autocrlf) {
  const checkout = join(dirname(fixtureRepository), `checkout-${label}`);
  git(['-c', `core.autocrlf=${autocrlf}`, 'worktree', 'add', '--detach', checkout, 'HEAD'], { cwd: fixtureRepository });
  return checkout;
}

function resolvedAttributes(checkout, relativePath) {
  return git(['check-attr', 'text', 'eol', '--', relativePath], { cwd: checkout });
}

function removeFixture(fixture) {
  rmSync(fixture.fixtureRoot, { recursive: true, force: true });
}

await test('the parent rule narrowly fixes the sealed package subtree including its nested attributes file', () => {
  const source = readFileSync(parentAttributesPath, 'utf8');
  assert.equal(source.includes(parentRule), true);
  assert.equal(source.includes(nestedRule), true);
  const v1Rules = source.split(/\r?\n/).filter((line) => line.startsWith('review/store-operations-sealed-snapshot-v1/'));
  assert.deepEqual(v1Rules, [parentRule, nestedRule]);
});

await test('all locked package Git blobs retain the existing 29-artifact and 16-SQL byte contract', () => {
  assert.equal(packageLock.artifacts.length, 29);
  assert.equal(packageLock.artifacts.filter(({ path }) => path.startsWith('queries/')).length, SQL_ARTIFACT_COUNT);
  for (const artifact of packageLock.artifacts) assert.equal(sha256(gitBlob(artifact.path)), artifact.sha256, artifact.path);
});

await test('the existing Package Lock and package-level hashes remain unchanged when artifact blobs are unchanged', () => {
  assert.deepEqual(packageLock.artifacts, baselinePackageLock.artifacts);
  assert.equal(packageLock.packageSha256, baselinePackageLock.packageSha256);
  assert.equal(packageLock.queryPackSha256, baselinePackageLock.queryPackSha256);
  assert.equal(packageLock.schemaContractSha256, baselinePackageLock.schemaContractSha256);
});

const protectedFixture = createFixtureRepository({ withParentRule: true });
try {
  for (const autocrlf of ['true', 'false', 'input']) {
    await test(`fresh Windows worktree core.autocrlf=${autocrlf} preserves package filesystem bytes`, async () => {
      const checkout = createFreshWorktree(protectedFixture.fixtureRepository, autocrlf);
      const checkoutPackageRoot = join(checkout, packageRelativePath);
      const nestedAttributes = `${packageRelativePath}/.gitattributes`;
      const attributes = resolvedAttributes(checkout, nestedAttributes);
      assert.match(attributes, /text: set/);
      assert.match(attributes, /eol: lf/);
      assert.equal(containsCrLf(readFileSync(join(checkout, nestedAttributes))), false);
      await assertPackageIntegrity(checkoutPackageRoot);
      assert.equal(git(['status', '--porcelain'], { cwd: checkout }), '');
    });
  }

  await test('a deliberate CRLF mutation remains fail-closed', async () => {
    const checkout = createFreshWorktree(protectedFixture.fixtureRepository, 'false', 'mutation');
    const checkoutPackageRoot = join(checkout, packageRelativePath);
    const nestedAttributes = join(checkoutPackageRoot, '.gitattributes');
    writeFileSync(nestedAttributes, readFileSync(nestedAttributes, 'utf8').replaceAll('\n', '\r\n'), 'utf8');
    const { verifyExecutionPackage } = await packageVerifier(checkoutPackageRoot);
    assert.throws(() => verifyExecutionPackage({ packageRoot: checkoutPackageRoot }), /PACKAGE_INTEGRITY_REJECTED/);
  });
} finally {
  removeFixture(protectedFixture);
}

const missingRuleFixture = createFixtureRepository({ withParentRule: false });
try {
  await test('a missing parent rule exposes the historical Windows checkout mismatch', async () => {
    const checkout = createFreshWorktree(missingRuleFixture.fixtureRepository, 'true');
    const checkoutPackageRoot = join(checkout, packageRelativePath);
    const nestedAttributes = join(checkoutPackageRoot, '.gitattributes');
    assert.equal(containsCrLf(readFileSync(nestedAttributes)), true);
    const { verifyExecutionPackage } = await packageVerifier(checkoutPackageRoot);
    assert.throws(() => verifyExecutionPackage({ packageRoot: checkoutPackageRoot }), /PACKAGE_INTEGRITY_REJECTED/);
  });
} finally {
  removeFixture(missingRuleFixture);
}

assert.equal(passed, 8);
process.stdout.write(`RESULT ${passed}/8 PASS\n`);
