import Link from "next/link";

export default function ChipLink({
  href,
  label,
  sub,
  count,
}: {
  href: string;
  label: string;
  sub?: string | null;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-2 rounded-full border border-cardamom bg-card px-4 py-2 text-sm shadow-lift transition-colors hover:border-turmeric"
    >
      <span className="font-medium">{label}</span>
      {sub && <span className="text-xs text-tamarind-faint">{sub}</span>}
      {count !== undefined && (
        <span className="rounded-full bg-turmeric-tint px-1.5 text-xs font-semibold text-turmeric-deep">
          {count}
        </span>
      )}
    </Link>
  );
}
