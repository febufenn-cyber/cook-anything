/**
 * detect-duplicates.ts — flags likely duplicate recipes across all batch files.
 * Signals: slug similarity, title similarity (normalized Levenshtein),
 * required-ingredient overlap (Jaccard), same cuisine.
 *
 * Usage: npx tsx scripts/detect-duplicates.ts [--threshold 0.75] [--fail]
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const RECIPES_DIR = path.join(ROOT, "data", "recipes");

const args = process.argv.slice(2);
const threshold = args.includes("--threshold") ? Number(args[args.indexOf("--threshold") + 1]) : 0.75;
const failOnDupes = args.includes("--fail");

interface Lite { slug: string; title: string; cuisine: string; req: Set<string>; file: string; steps: number }

const recipes: Lite[] = [];
for (const f of fs.readdirSync(RECIPES_DIR).filter((x) => x.endsWith(".json"))) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, f), "utf8"))) {
    recipes.push({
      slug: r.slug,
      title: String(r.title ?? "").toLowerCase(),
      cuisine: r.cuisine,
      req: new Set((r.ingredients ?? []).filter((i: any) => !i.optional).map((i: any) => i.normalizedName)),
      file: f,
      steps: (r.steps ?? []).length,
    });
  }
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}
const titleSim = (a: string, b: string) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);
const jaccard = (a: Set<string>, b: Set<string>) => {
  const inter = [...a].filter((x) => b.has(x)).length;
  return inter / (a.size + b.size - inter || 1);
};

const flagged: { a: Lite; b: Lite; score: number; why: string }[] = [];
for (let i = 0; i < recipes.length; i++) {
  for (let j = i + 1; j < recipes.length; j++) {
    const a = recipes[i], b = recipes[j];
    const ts = titleSim(a.title, b.title);
    const ing = jaccard(a.req, b.req);
    const sameCuisine = a.cuisine === b.cuisine ? 1 : 0;
    // step-count closeness as a cheap placeholder for step-text similarity
    const stepSim = 1 - Math.abs(a.steps - b.steps) / Math.max(a.steps, b.steps, 1);
    const score = 0.45 * ts + 0.35 * ing + 0.1 * sameCuisine + 0.1 * stepSim;
    if (score >= threshold) {
      flagged.push({ a, b, score, why: `title ${(ts * 100) | 0}%, ingredients ${(ing * 100) | 0}%${sameCuisine ? ", same cuisine" : ""}` });
    }
  }
}

flagged.sort((x, y) => y.score - x.score);
for (const d of flagged) {
  console.log(`  ${(d.score * 100).toFixed(0)}%  ${d.a.slug} (${d.a.file})  <->  ${d.b.slug} (${d.b.file})  [${d.why}]`);
}
console.log(`\ndetect-duplicates: ${recipes.length} recipes scanned, ${flagged.length} candidate pair(s) at threshold ${threshold}`);
if (failOnDupes && flagged.length > 0) process.exit(1);
