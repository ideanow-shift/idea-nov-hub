import { FileAtomicOneTimeStore } from "./file-atomic-store.mjs";

const [directory, code, issuer, appId] = process.argv.slice(2);
const store = new FileAtomicOneTimeStore({ directory });
try {
  await store.consume(code, { issuer, appId });
  process.stdout.write("CONSUMED");
} catch (error) {
  process.stdout.write(error.reason ?? error.message);
}
