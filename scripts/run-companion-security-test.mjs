import { readFile, unlink, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.join(scriptsDir, "test-companion-security.ts");
const generatedPath = path.join(scriptsDir, ".test-companion-security.generated.ts");

const source = await readFile(sourcePath, "utf8");
const marker = /\nawait main\(\);\s*$/;
if (!marker.test(source)) {
  throw new Error("test-companion-security.ts no longer has the expected async entry point");
}

const generated = source.replace(
  marker,
  `\nmain().catch((error) => {\n  console.error(error);\n  process.exitCode = 1;\n});\n`,
);

await writeFile(generatedPath, generated, "utf8");
try {
  const executable = process.platform === "win32" ? "tsx.cmd" : "tsx";
  const result = spawnSync(executable, [generatedPath], {
    cwd: path.join(scriptsDir, ".."),
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  await unlink(generatedPath).catch(() => undefined);
}
