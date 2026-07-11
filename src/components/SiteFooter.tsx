import Link from "next/link";
import { SITE_TAGLINE } from "@/lib/site";

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Discover",
    links: [
      { href: "/what-can-i-cook", label: "What can I cook?" },
      { href: "/recipes", label: "All recipes" },
      { href: "/cuisines", label: "Cuisines" },
      { href: "/countries", label: "Countries" },
      { href: "/ingredients", label: "Ingredients" },
      { href: "/methods", label: "Cooking methods" },
      { href: "/diets", label: "Diets" },
    ],
  },
  {
    heading: "Collections",
    links: [
      { href: "/quick-recipes", label: "Quick meals" },
      { href: "/budget-recipes", label: "Budget meals" },
      { href: "/indian-recipes", label: "Indian recipes" },
      { href: "/tamil-recipes", label: "Tamil recipes" },
      { href: "/chicken-recipes", label: "Chicken recipes" },
      { href: "/vegetarian-recipes", label: "Vegetarian" },
      { href: "/high-protein-recipes", label: "High protein" },
      { href: "/festival-recipes", label: "Festival food" },
    ],
  },
  {
    heading: "Community",
    links: [
      { href: "/submit-recipe", label: "Submit a recipe" },
      { href: "/family-cookbook", label: "Family cookbook" },
      { href: "/about", label: "About" },
    ],
  },
  {
    heading: "Trust",
    links: [
      { href: "/sources", label: "Sources & licensing" },
      { href: "/legal", label: "Legal" },
      { href: "/privacy", label: "Privacy" },
      { href: "/admin", label: "Data studio" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-cardamom bg-rice-deep/60">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <p className="font-display text-lg">Cook Anything</p>
            <p className="mt-2 text-sm text-tamarind-soft">{SITE_TAGLINE}</p>
            <p className="mt-4 text-xs text-tamarind-faint">
              Recipes are marked with their source and verification status. AI-drafted
              recipes are original drafts, not yet kitchen-verified.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLUMNS.map((col) => (
              <div key={col.heading}>
                <p className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">
                  {col.heading}
                </p>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-sm text-tamarind-soft hover:text-tamarind">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-10 text-xs text-tamarind-faint">
          © {new Date().getFullYear()} Cook Anything. Nutrition values are estimates unless marked verified.
        </p>
      </div>
    </footer>
  );
}
