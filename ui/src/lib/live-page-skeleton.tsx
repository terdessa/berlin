// Stable skeleton rendered during SSR and before client mount for the
// live-stream pages. Keeping this minimal markup lets React hydration match
// what the server emitted, while the real interactive page swaps in only
// after `mounted` flips on the client (see /audio and /gemini-preview routes).
export function LivePageSkeleton({ title }: { title: string }) {
  return (
    <main className="min-h-screen px-6 py-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="mono text-sm uppercase tracking-[0.2em] text-foreground">{title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">Direct-link page · loading…</p>
        </div>
        <span className="mono inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          starting…
        </span>
      </header>
      <section className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="aspect-video w-full rounded-lg border border-border bg-panel" />
        <aside className="min-h-[280px] rounded-lg border border-border bg-panel/60" />
      </section>
    </main>
  );
}
