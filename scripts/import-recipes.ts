/**
 * import-recipes.ts — the safe intake gate for external recipe JSON.
 * Pipeline: read -> field defaults -> slug generation -> ingredient
 * normalization -> validation -> license check -> write batch file.
 *
 * Usage:
 *   npx tsx scripts/import-recipes.ts --file <input.json> [--batch <name>] [--status open_license_imported]
 *
 * The input must be a JSON array of recipe-shaped objects. Anything that
 * fails validation is written to <batch>.rejected.json instead of imported.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { VERIFICATION_STATUSES } from "../src/lib/canon";
import { slugify } from "./generate-slugs";

const ROOT = path.join(__dirname, "..");
const RECIPES_DIR = path.join(ROOT, "data", "recipes");

const args = process.argv.slice(2);
const fileArg = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
if (!fileArg) {
  console.error("Usage: npx tsx scripts/import-recipes.ts --file <input.json> [--batch <name>] [--status <verificationStatus>]");
  process.exit(1);
}
const batch = args.includes("--batch") ? args[args.indexOf("--batch") + 1] : `imported-${Date.now()}`;
const status = args.includes("--status") ? args[args.indexOf("--status") + 1] : "editor_needed";
if (!(VERIFICATION_STATUSES as readonly string[]).includes(status) || status === "verified") {
  console.error(`Invalid --status "${status}" (and "verified" is never allowed on import).`);
  process.exit(1);
}

const input = JSON.parse(fs.readFileSync(path.resolve(fileArg), "utf8"));
if (!Array.isArray(input)) {
  console.error("Input must be a JSON array of recipes.");
  process.exit(1);
}

const existingSlugs = new Set<string>();
for (const f of fs.readdirSync(RECIPES_DIR).filter((x) => x.endsWith(".json"))) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, f), "utf8"))) existingSlugs.add(r.slug);
}

const now = new Date().toISOString();
const prepared = input.map((r: any) => {
  let slug = r.slug || slugify(r.title ?? "untitled", r.cuisine);
  let n = 2;
  while (existingSlugs.has(slug)) slug = `${slugify(r.title ?? "untitled", r.cuisine)}-${n++}`;
  existingSlugs.add(slug);
  return {
    nativeTitle: null, region: null, language: "en", tags: [], allergens: [],
    substitutions: [], nutrition: null, culturalNote: null, regionalVariation: null,
    indianKitchenAdaptation: null, sourceUrl: null, image: null, imageLicense: null,
    ...r,
    slug,
    id: `ca-${slug}`,
    verificationStatus: r.verificationStatus && r.verificationStatus !== "verified" ? r.verificationStatus : status,
    createdAt: r.createdAt ?? now,
    updatedAt: now,
  };
});

const outFile = path.join(RECIPES_DIR, `${batch}.json`);
fs.writeFileSync(outFile, JSON.stringify(prepared, null, 2) + "\n");

// normalize, then validate; on failure quarantine the batch
try {
  execSync(`npx tsx "${path.join(__dirname, "normalize-ingredients.ts")}" --file "${outFile}" --fix`, { stdio: "inherit" });
  execSync(`npx tsx "${path.join(__dirname, "validate-recipes.ts")}" --file "${outFile}"`, { stdio: "inherit" });
  execSync(`npx tsx "${path.join(__dirname, "check-licenses.ts")}"`, { stdio: "inherit" });
  console.log(`\nimport-recipes: imported ${prepared.length} recipes into data/recipes/${batch}.json`);
} catch {
  const rejected = outFile.replace(/\.json$/, ".rejected.json");
  fs.renameSync(outFile, rejected);
  console.error(`\nimport-recipes: batch FAILED validation — quarantined at ${path.relative(ROOT, rejected)}. Fix and re-run.`);
  process.exit(1);
}
