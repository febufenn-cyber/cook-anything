import fs from "node:fs";
import path from "node:path";

const root = path.join(__dirname, "..");
const recipeDir = path.join(root, "data", "recipes");
const quarantineDir = path.join(root, "quarantine");
let errors = 0;

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

for (const file of walk(recipeDir)) {
  const relative = path.relative(root, file);
  const name = path.basename(file).toLowerCase();
  if (name.includes("rejected") || name.includes("quarantine") || name.endsWith(".tmp.json")) {
    console.error(`  ERROR ${relative}: rejected or temporary import lives inside the production recipe tree`);
    errors += 1;
  }
  if (path.extname(file) !== ".json") {
    console.error(`  ERROR ${relative}: production recipe tree contains a non-JSON file`);
    errors += 1;
  }
}

if (path.resolve(quarantineDir).startsWith(`${path.resolve(recipeDir)}${path.sep}`)) {
  console.error("  ERROR quarantine directory is nested inside data/recipes");
  errors += 1;
}

console.log(`\ncheck-import-boundaries: ${errors} error(s)`);
process.exit(errors > 0 ? 1 : 0);
