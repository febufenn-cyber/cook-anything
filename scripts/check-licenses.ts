/**
 * check-licenses.ts — legal-safety gate. Flags:
 *  - unknown/missing licenses
 *  - missing sources
 *  - unpublishable licenses (all-rights-reserved with full text)
 *  - copied-external-source risk (external sourceUrl but license claims original)
 *  - verification statuses inconsistent with their source/license
 *
 * Usage: npx tsx scripts/check-licenses.ts
 */
import fs from "node:fs";
import path from "node:path";
import { KNOWN_LICENSES, PUBLISHABLE_LICENSES } from "../src/lib/canon";

const ROOT = path.join(__dirname, "..");
const RECIPES_DIR = path.join(ROOT, "data", "recipes");

let errors = 0, warns = 0, total = 0;
const err = (slug: string, msg: string) => { console.error(`  ERROR [${slug}]: ${msg}`); errors++; };
const warn = (slug: string, msg: string) => { console.warn(`  warn  [${slug}]: ${msg}`); warns++; };

for (const f of fs.readdirSync(RECIPES_DIR).filter((x) => x.endsWith(".json"))) {
  for (const r of JSON.parse(fs.readFileSync(path.join(RECIPES_DIR, f), "utf8"))) {
    total++;
    const slug = r.slug ?? "(no slug)";
    if (!r.source) err(slug, "missing source");
    if (!r.license) err(slug, "missing license");
    else if (!(KNOWN_LICENSES as readonly string[]).includes(r.license))
      err(slug, `unknown license "${r.license}"`);
    else if (!(PUBLISHABLE_LICENSES as readonly string[]).includes(r.license))
      err(slug, `license "${r.license}" is not publishable with full recipe text — store as external link only`);

    // copied-content risk heuristics
    if (r.license === "original" && r.sourceUrl)
      warn(slug, `claims "original" license but has external sourceUrl (${r.sourceUrl}) — verify it is not copied`);
    if (r.verificationStatus === "open_license_imported" && !r.sourceUrl)
      err(slug, "open_license_imported requires a sourceUrl for attribution");
    if (r.verificationStatus === "public_domain_imported" && !["public-domain", "CC0"].includes(r.license))
      err(slug, `public_domain_imported should carry public-domain/CC0 license, got "${r.license}"`);
    if (r.verificationStatus === "ai_drafted" && r.license !== "original")
      warn(slug, `ai_drafted recipes should be license "original", got "${r.license}"`);
    if (r.image && !r.imageLicense) err(slug, "image without imageLicense");
  }
}

console.log(`\ncheck-licenses: ${total} recipes — ${errors} error(s), ${warns} warning(s)`);
process.exit(errors > 0 ? 1 : 0);
