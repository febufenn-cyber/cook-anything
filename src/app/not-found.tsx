import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <div className="flex justify-center gap-1.5" aria-hidden>
        <span className="pantry-dot pantry-dot--have" />
        <span className="pantry-dot pantry-dot--missing" />
        <span className="pantry-dot pantry-dot--missing" />
      </div>
      <h1 className="font-display mt-4 text-4xl">This dish isn&apos;t in the pot</h1>
      <p className="mt-4 text-tamarind-soft">
        The page you&apos;re looking for doesn&apos;t exist — but your ingredients still do.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/what-can-i-cook" className="rounded-full bg-turmeric px-6 py-3 font-semibold text-tamarind">
          What can I cook?
        </Link>
        <Link href="/recipes" className="rounded-full border border-cardamom bg-card px-6 py-3 font-medium">
          Browse recipes
        </Link>
      </div>
    </div>
  );
}
