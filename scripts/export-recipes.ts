/**
 * export-recipes.ts — exports the full recipe database to a single JSON file
 * (for backups, API seeding, or migration into Postgres/Supabase).
 *
 * Usage: npx tsx scripts/export-recipes.ts [--out exports/recipes.json]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const RECIPES_DIR = path.join(ROOT, "data", "recipes");
const args = process.argv.slice(2);
const out = path.resolve(args.includes("--out") ? args[args.indexOf("--out") + 1] : path.join(ROOT, "exports", "recipes-export.json"));

const seen = new Set<string>();
const all: unknown[] = [];
for (const f of fs.readdirSync(RECIPES_DIR).filter((x) => x.endsWith(".json")).sort()) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, f), "utf8"))) {
    if (seen.has(r.slug)) continue;
    seen.add(r.slug);
    all.push(r);
  }
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ exportedAt: new Date().toISOString(), count: all.length, recipes: all }, null, 2));
console.log(`export-recipes: ${all.length} recipes -> ${path.relative(ROOT, out)}`);
