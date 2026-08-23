import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const here = resolve(import.meta.dirname);
const repository = resolve(here, "../..");
const output = join(here, "dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ["index.html", "styles.css", "app.js", "api-client.js", "firebase-config.js"]) {
  await cp(join(here, file), join(output, file));
}
await cp(join(repository, "portal/js/auth.js"), join(output, "auth.js"));
const productionRef = "nkmxevmioczcmnldreyo";
for (const file of ["index.html", "styles.css", "app.js", "api-client.js", "firebase-config.js", "auth.js"]) {
  if ((await readFile(join(output, file), "utf8")).includes(productionRef)) {
    throw new Error(`PRODUCTION_REF_IN_STAGING_LAUNCHER:${file}`);
  }
}
