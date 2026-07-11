/**
 * generate-slugs.ts — generates/repairs slugs and ids for recipes that are
 * missing them (e.g. fresh imports), guaranteeing global uniqueness.
 *
 * Usage: npx tsx scripts/generate-slugs.ts [--file <path>] [--fix]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const RECIPES_DIR = path.join(ROOT, "data", "recipes");
const args = process.argv.slice(2);
const fix = args.includes("--fix");
const fileArg = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;

export function slugify(title: string, cuisine?: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cuisine && !base.startsWith(cuisine) ? `${cuisine}-${base}` : base;
}

const files = fileArg
  ? [path.resolve(fileArg)]
  : fs.readdirSync(RECIPES_DIR).filter((f) => f.endsWith(".json")).map((f) => path.join(RECIPES_DIR, f));

const taken = new Set<string>();
// first pass: collect existing slugs
for (const file of files) {
  for (const r of JSON.parse(fs.readFileSync(file, "utf8"))) if (r.slug) taken.add(r.slug);
}

let generated = 0;
for (const file of files) {
  const recipes = JSON.parse(fs.readFileSync(file, "utf8"));
  let changed = false;
  for (const r of recipes) {
    if (r.slug && r.id === `ca-${r.slug}`) continue;
    let slug = r.slug || slugify(r.title ?? "untitled", r.cuisine);
    let n = 2;
    while (!r.slug && taken.has(slug)) slug = `${slugify(r.title, r.cuisine)}-${n++}`;
    taken.add(slug);
    const id = `ca-${slug}`;
    if (r.slug !== slug || r.id !== id) {
      console.log(`  ${r.title}: slug="${slug}" id="${id}"`);
      if (fix) {
        r.slug = slug;
        r.id = id;
        changed = true;
      }
      generated++;
    }
  }
  if (changed) fs.writeFileSync(file, JSON.stringify(recipes, null, 2) + "\n");
}
console.log(`\ngenerate-slugs: ${generated} slug/id ${fix ? "fixed" : "issue(s) found (run with --fix to apply)"}`);
