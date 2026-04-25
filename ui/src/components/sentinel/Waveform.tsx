type Props = {
  bars?: number;
  variant?: "raw" | "enhanced";
  playing?: boolean;
};

export function Waveform({ bars = 48, variant = "raw", playing = false }: Props) {
  // Deterministic pseudo-random heights
  const heights = Array.from({ length: bars }, (_, i) => {
    const seed = variant === "raw" ? i * 9301 + 49297 : i * 7919 + 1031;
    const v = ((seed % 233280) / 233280);
    if (variant === "raw") {
      // jagged, noisy
      return 0.2 + (v * 0.8) * (i % 3 === 0 ? 1 : 0.6);
    }
    // smoother, modulated
    return 0.35 + Math.abs(Math.sin(i / 3.2)) * 0.55 + v * 0.1;
  });

  const color = variant === "raw" ? "bg-muted-foreground/70" : "bg-primary";

  return (
    <div className="flex h-12 items-center gap-[2px]">
      {heights.map((h, i) => (
        <span
          key={i}
          className={[
            "w-[3px] rounded-sm transition-transform",
            color,
            playing ? "animate-wave" : "",
          ].join(" ")}
          style={{
            height: `${Math.max(8, h * 100)}%`,
            animationDelay: playing ? `${(i % 8) * 60}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}
