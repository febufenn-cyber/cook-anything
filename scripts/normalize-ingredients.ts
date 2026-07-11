/**
 * normalize-ingredients.ts — maps free-text ingredient names to canonical
 * slugs using the alias table in data/taxonomy/ingredients.json.
 *
 * Usage:
 *   npx tsx scripts/normalize-ingredients.ts                # report unknown normalizedNames
 *   npx tsx scripts/normalize-ingredients.ts --fix          # rewrite fixable ones in place
 *   npx tsx scripts/normalize-ingredients.ts --file <path>  # limit to one file
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const RECIPES_DIR = path.join(ROOT, "data", "recipes");
const ingredients = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "taxonomy", "ingredients.json"), "utf8"),
);

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const fileArg = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;

const canonical = new Set<string>(ingredients.map((i: any) => i.slug));
const aliasToSlug = new Map<string, string>();
for (const ing of ingredients) {
  const keys = [
    ing.slug,
    ing.name.toLowerCase().replace(/\s*\(.*\)\s*/g, "").trim(),
    ing.ta?.toLowerCase(),
    ing.hi?.toLowerCase(),
    ...ing.aliases.map((a: string) => a.toLowerCase()),
  ].filter(Boolean);
  for (const k of keys) if (!aliasToSlug.has(k)) aliasToSlug.set(k, ing.slug);
}

function resolve(name: string): string | null {
  const n = name.toLowerCase().trim();
  if (aliasToSlug.has(n)) return aliasToSlug.get(n)!;
  const stripped = n.replace(/\s*\(.*\)\s*/g, "").replace(/,.*$/, "").trim();
  if (aliasToSlug.has(stripped)) return aliasToSlug.get(stripped)!;
  const singular = stripped.endsWith("es") ? stripped.slice(0, -2) : stripped.endsWith("s") ? stripped.slice(0, -1) : stripped;
  if (aliasToSlug.has(singular)) return aliasToSlug.get(singular)!;
  return null;
}

const files = fileArg
  ? [path.resolve(fileArg)]
  : fs.readdirSync(RECIPES_DIR).filter((f) => f.endsWith(".json")).map((f) => path.join(RECIPES_DIR, f));

let unknown = 0, fixed = 0, checked = 0;
for (const file of files) {
  const recipes = JSON.parse(fs.readFileSync(file, "utf8"));
  let changed = false;
  for (const r of recipes) {
    for (const ing of r.ingredients ?? []) {
      checked++;
      if (canonical.has(ing.normalizedName)) continue;
      const hit = resolve(ing.normalizedName) ?? resolve(ing.name);
      if (hit) {
        if (fix) {
          ing.normalizedName = hit;
          changed = true;
          fixed++;
        } else {
          console.log(`  fixable  ${r.slug}: "${ing.normalizedName}" -> "${hit}"`);
        }
      } else {
        unknown++;
        console.log(`  UNKNOWN  ${r.slug}: "${ing.normalizedName}" (name: "${ing.name}") — add to ingredients.json or pick closest slug`);
      }
    }
  }
  if (changed) fs.writeFileSync(file, JSON.stringify(recipes, null, 2) + "\n");
}
console.log(`\nnormalize-ingredients: ${checked} ingredient refs checked, ${fixed} fixed, ${unknown} unknown`);
process.exit(unknown > 0 && !fix ? 1 : 0);
