export function SectionHeading({ eyebrow, title, description, id }: { eyebrow: string; title: string; description?: string; id?: string }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
      <h2 id={id} className="font-display text-2xl tracking-tight text-balance sm:text-3xl">{title}</h2>
      {description ? <p className="max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p> : null}
    </div>
  );
}
