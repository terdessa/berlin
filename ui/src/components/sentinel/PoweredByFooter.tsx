const partners = [
  "ai-coustics",
  "Gradium",
  "Entire",
  "Google DeepMind",
];

export function PoweredByFooter() {
  return (
    <div className="mono flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
      <span>powered by</span>
      {partners.map((p, i) => (
        <span key={p} className="flex items-center gap-3">
          <span className="text-foreground/80">{p}</span>
          {i < partners.length - 1 && <span className="text-muted-foreground/40">·</span>}
        </span>
      ))}
    </div>
  );
}
