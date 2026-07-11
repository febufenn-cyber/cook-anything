export default function PageHero({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-b border-cardamom bg-rice-deep/50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-turmeric-deep">{eyebrow}</p>
        )}
        <h1 className="font-display mt-2 max-w-3xl text-3xl leading-tight sm:text-4xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-tamarind-soft">{intro}</p>}
        {children}
      </div>
    </section>
  );
}
