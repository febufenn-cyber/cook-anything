/**
 * validate-recipes.ts — structural + referential validation for recipe data.
 *
 * Usage:
 *   npx tsx scripts/validate-recipes.ts                  # validate all batches
 *   npx tsx scripts/validate-recipes.ts --file <path>    # validate one file
 *   npx tsx scripts/validate-recipes.ts --quiet          # errors only
 *
 * Exits 1 if any errors are found. Warnings do not fail the build.
 */
import fs from "node:fs";
import path from "node:path";
import {
  CUISINES, COUNTRIES, REGIONS, METHODS, COOKWARE, TAGS, MEAL_TYPES,
  DIET_TYPES, PRIMARY_DIETS, ALLERGENS, UNITS, DIFFICULTIES, SPICE_LEVELS,
  BUDGET_LEVELS, VERIFICATION_STATUSES, KNOWN_LICENSES,
} from "../src/lib/canon";

const ROOT = path.join(__dirname, "..");
const RECIPE_DIR = path.join(ROOT, "data", "recipes");
const INGREDIENTS_PATH = path.join(ROOT, "data", "taxonomy", "ingredients.json");

type Issue = { file: string; slug: string; level: "error" | "warn"; msg: string };

const args = process.argv.slice(2);
const fileArg = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
const quiet = args.includes("--quiet");

const ingredientSlugs = new Set(
  (JSON.parse(fs.readFileSync(INGREDIENTS_PATH, "utf8")) as { slug: string }[]).map((i) => i.slug),
);

const files = fileArg
  ? [path.resolve(fileArg)]
  : fs.readdirSync(RECIPE_DIR).filter((f) => f.endsWith(".json")).map((f) => path.join(RECIPE_DIR, f));

const issues: Issue[] = [];
const seenSlugs = new Map<string, string>(); // slug -> file
const seenIds = new Map<string, string>();
let total = 0;

const inSet = (set: readonly string[], v: unknown) => typeof v === "string" && (set as readonly string[]).includes(v);

for (const file of files) {
  const rel = path.relative(ROOT, file);
  let recipes: any[];
  try {
    recipes = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    issues.push({ file: rel, slug: "-", level: "error", msg: `invalid JSON: ${(e as Error).message}` });
    continue;
  }
  if (!Array.isArray(recipes)) {
    issues.push({ file: rel, slug: "-", level: "error", msg: "file is not a JSON array of recipes" });
    continue;
  }

  for (const r of recipes) {
    total++;
    const slug = typeof r.slug === "string" ? r.slug : "(missing slug)";
    const err = (msg: string) => issues.push({ file: rel, slug, level: "error", msg });
    const warn = (msg: string) => issues.push({ file: rel, slug, level: "warn", msg });

    // Identity
    if (!r.title || typeof r.title !== "string") err("missing title");
    if (!r.slug || typeof r.slug !== "string") err("missing slug");
    else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)) err(`slug not kebab-case: "${r.slug}"`);
    if (r.slug) {
      if (seenSlugs.has(r.slug)) err(`duplicate slug (also in ${seenSlugs.get(r.slug)})`);
      else seenSlugs.set(r.slug, rel);
    }
    if (!r.id) err("missing id");
    else if (r.id !== `ca-${r.slug}`) warn(`id should be "ca-${r.slug}", got "${r.id}"`);
    if (r.id) {
      if (seenIds.has(r.id)) err(`duplicate id (also in ${seenIds.get(r.id)})`);
      else seenIds.set(r.id, rel);
    }
    if (!r.description || typeof r.description !== "string" || r.description.length < 30)
      err("missing/too-short description");

    // Classification
    if (!inSet(CUISINES, r.cuisine)) err(`missing/unknown cuisine: "${r.cuisine}"`);
    if (!inSet(COUNTRIES, r.country)) err(`missing/unknown country: "${r.country}"`);
    if (r.region !== null && !inSet(REGIONS, r.region)) err(`unknown region: "${r.region}"`);
    if (!Array.isArray(r.mealType) || r.mealType.length === 0) err("missing mealType");
    else for (const m of r.mealType) if (!inSet(MEAL_TYPES, m)) err(`unknown mealType: "${m}"`);
    if (!Array.isArray(r.dietType) || r.dietType.length === 0) err("missing dietType (diet tags)");
    else {
      for (const d of r.dietType) if (!inSet(DIET_TYPES, d)) err(`unknown dietType: "${d}"`);
      const primaries = r.dietType.filter((d: string) => (PRIMARY_DIETS as readonly string[]).includes(d));
      if (primaries.length !== 1) err(`dietType must include exactly one primary diet, found: [${primaries.join(", ")}]`);
    }
    if (!inSet(DIFFICULTIES, r.difficulty)) err(`missing/unknown difficulty: "${r.difficulty}"`);
    if (!inSet(SPICE_LEVELS, r.spiceLevel)) err(`missing/unknown spiceLevel: "${r.spiceLevel}"`);
    if (!inSet(BUDGET_LEVELS, r.budgetLevel)) err(`missing/unknown budgetLevel: "${r.budgetLevel}"`);

    // Times & servings
    for (const k of ["prepTimeMinutes", "cookTimeMinutes", "totalTimeMinutes"]) {
      if (typeof r[k] !== "number" || r[k] < 0 || !Number.isFinite(r[k])) err(`invalid ${k}: ${r[k]}`);
    }
    if (
      typeof r.prepTimeMinutes === "number" && typeof r.cookTimeMinutes === "number" &&
      typeof r.totalTimeMinutes === "number" &&
      r.totalTimeMinutes !== r.prepTimeMinutes + r.cookTimeMinutes
    ) err(`totalTimeMinutes (${r.totalTimeMinutes}) != prep (${r.prepTimeMinutes}) + cook (${r.cookTimeMinutes})`);
    if (typeof r.servings !== "number" || r.servings < 1 || r.servings > 12) err(`invalid servings: ${r.servings}`);

    // Ingredients
    if (!Array.isArray(r.ingredients) || r.ingredients.length < 3) err("missing ingredients (need >= 3)");
    else {
      r.ingredients.forEach((ing: any, i: number) => {
        if (!ing || typeof ing !== "object") return err(`ingredient[${i}] malformed`);
        if (!ing.name || typeof ing.name !== "string") err(`ingredient[${i}] missing name`);
        if (!ing.normalizedName) err(`ingredient[${i}] ("${ing.name}") missing normalizedName`);
        else if (!ingredientSlugs.has(ing.normalizedName))
          err(`ingredient[${i}] unknown normalizedName: "${ing.normalizedName}"`);
        if (ing.quantity !== null && typeof ing.quantity !== "number") err(`ingredient[${i}] quantity must be number|null`);
        if (ing.unit !== null && !inSet(UNITS, ing.unit)) err(`ingredient[${i}] unknown unit: "${ing.unit}"`);
        if (typeof ing.optional !== "boolean") err(`ingredient[${i}] missing optional flag`);
      });
    }

    // Steps
    if (!Array.isArray(r.steps) || r.steps.length < 3) err("missing steps (need >= 3)");
    else {
      r.steps.forEach((s: any, i: number) => {
        if (!s || typeof s !== "object" || typeof s.text !== "string" || s.text.length < 15)
          return err(`step[${i}] malformed or too short`);
        if (s.order !== i + 1) err(`step[${i}] order should be ${i + 1}, got ${s.order}`);
        if (s.method !== undefined && !inSet(METHODS, s.method)) err(`step[${i}] unknown method: "${s.method}"`);
      });
    }

    // Method/cookware/tags
    if (!Array.isArray(r.methods) || r.methods.length === 0) err("missing method tags");
    else for (const m of r.methods) if (!inSet(METHODS, m)) err(`unknown method: "${m}"`);
    if (!Array.isArray(r.cookware) || r.cookware.length === 0) err("missing cookware");
    else for (const c of r.cookware) if (!inSet(COOKWARE, c)) err(`unknown cookware: "${c}"`);
    if (!Array.isArray(r.tags)) err("missing tags array");
    else for (const t of r.tags) if (!inSet(TAGS, t)) err(`unknown tag: "${t}"`);
    if (!Array.isArray(r.allergens)) err("missing allergens array");
    else for (const a of r.allergens) if (!inSet(ALLERGENS, a)) err(`unknown allergen: "${a}"`);

    // Substitutions
    if (!Array.isArray(r.substitutions)) err("missing substitutions array");
    else r.substitutions.forEach((s: any, i: number) => {
      if (!s?.ingredient || !s?.substitute) err(`substitution[${i}] malformed`);
      else if (!ingredientSlugs.has(s.ingredient)) warn(`substitution[${i}] ingredient not a known slug: "${s.ingredient}"`);
    });

    // Provenance
    if (!r.source || typeof r.source !== "string") err("missing source");
    if (r.sourceUrl !== null && typeof r.sourceUrl !== "string") err("sourceUrl must be string|null");
    if (!r.license) err("missing license");
    else if (!inSet(KNOWN_LICENSES, r.license)) err(`unknown license: "${r.license}"`);
    if (!r.author) err("missing author");
    if (!inSet(VERIFICATION_STATUSES, r.verificationStatus))
      err(`missing/unknown verificationStatus: "${r.verificationStatus}"`);
    if (r.verificationStatus === "verified")
      err("verificationStatus 'verified' is not allowed in seed data — nothing has been human-verified yet");

    // Nutrition
    if (r.nutrition !== null) {
      if (typeof r.nutrition !== "object") err("nutrition must be object|null");
      else if (r.nutrition.isEstimate !== true && r.verificationStatus !== "verified")
        err("nutrition.isEstimate must be true for unverified recipes");
    }

    // Allergen consistency (dairy/egg/fish as strong signals)
    const ingSlugs: string[] = Array.isArray(r.ingredients)
      ? r.ingredients.map((i: any) => i?.normalizedName).filter(Boolean)
      : [];
    const hasDairy = ingSlugs.some((s) => ["curd", "milk", "paneer", "cheese", "butter", "ghee", "cream", "khoya", "condensed-milk", "buttermilk", "coconut-milk"].includes(s) && s !== "coconut-milk");
    if (hasDairy && Array.isArray(r.allergens) && !r.allergens.includes("dairy"))
      warn("contains dairy ingredients but 'dairy' missing from allergens");
    if (ingSlugs.includes("egg") && Array.isArray(r.allergens) && !r.allergens.includes("egg"))
      warn("contains egg but 'egg' missing from allergens");
    const veg = Array.isArray(r.dietType) && (r.dietType.includes("vegetarian") || r.dietType.includes("vegan"));
    const meatSlugs = ["chicken", "mutton", "beef", "pork", "keema", "fish", "prawn", "crab", "squid"];
    if (veg && ingSlugs.some((s) => meatSlugs.includes(s))) err("marked vegetarian/vegan but contains meat/seafood");
    if (Array.isArray(r.dietType) && r.dietType.includes("vegan") && (hasDairy || ingSlugs.includes("egg") || ingSlugs.includes("honey")))
      err("marked vegan but contains dairy/egg/honey");

    if (r.image !== null && typeof r.image === "string" && !r.imageLicense)
      err("image present but imageLicense missing");
  }
}

const errors = issues.filter((i) => i.level === "error");
const warns = issues.filter((i) => i.level === "warn");

for (const i of errors) console.error(`  ERROR ${i.file} [${i.slug}]: ${i.msg}`);
if (!quiet) for (const i of warns) console.warn(`  warn  ${i.file} [${i.slug}]: ${i.msg}`);

console.log(
  `\nvalidate-recipes: ${total} recipes in ${files.length} file(s) — ${errors.length} error(s), ${warns.length} warning(s)`,
);
process.exit(errors.length > 0 ? 1 : 0);
