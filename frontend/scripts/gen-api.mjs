// Regenerates src/api/schema.d.ts from the backend's OpenAPI schema.
// With --check, fails if the committed file is out of date (used by scripts/check).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const check = process.argv.includes("--check");
const backend = path.resolve(import.meta.dirname, "../../backend");
const target = path.resolve(import.meta.dirname, "../src/api/schema.d.ts");
const tmp = mkdtempSync(path.join(tmpdir(), "openapi-"));
const specFile = path.join(tmp, "openapi.json");
const outFile = path.join(tmp, "schema.d.ts");

const spec = execFileSync("uv", ["run", "python", "-m", "app.export_openapi"], {
  cwd: backend,
  encoding: "utf8",
  shell: process.platform === "win32",
});
writeFileSync(specFile, spec);
execFileSync("npx", ["openapi-typescript", specFile, "-o", outFile], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

const generated = readFileSync(outFile, "utf8");
if (check) {
  if (readFileSync(target, "utf8") !== generated) {
    console.error("src/api/schema.d.ts is out of date. Run `npm run gen:api`.");
    process.exit(1);
  }
} else {
  writeFileSync(target, generated);
}
