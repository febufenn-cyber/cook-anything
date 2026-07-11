import Link from "next/link";

const NAV = [
  { href: "/what-can-i-cook", label: "What can I cook?" },
  { href: "/recipes", label: "Recipes" },
  { href: "/cuisines", label: "Cuisines" },
  { href: "/ingredients", label: "Ingredients" },
  { href: "/search", label: "Search" },
  { href: "/family-cookbook", label: "My cookbook" },
];

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-cardamom bg-rice/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-baseline gap-1.5" aria-label="Cook Anything home">
          <span aria-hidden className="pantry-dot pantry-dot--have translate-y-[-1px]" />
          <span className="font-display text-xl leading-none">Cook Anything</span>
        </Link>
        <nav className="rail -mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-tamarind-soft transition-colors hover:bg-rice-deep hover:text-tamarind"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
