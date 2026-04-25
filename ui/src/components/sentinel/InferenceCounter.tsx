import { useEffect, useState } from "react";

type Props = {
  base?: number;
  reviewsFlagged?: number;
  falseAlarms?: number;
};

export function InferenceCounter({ base = 1284317, reviewsFlagged = 12, falseAlarms = 4 }: Props) {
  const [frames, setFrames] = useState(base);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = setInterval(() => {
      setFrames((f) => f + Math.floor(8 + Math.random() * 12));
    }, 700);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mono flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      <span>
        frames analyzed today{" "}
        {/* suppressHydrationWarning: toLocaleString() can differ between the
            Node SSR locale and the browser's locale (e.g. "1,284,317" vs
            "1 284 317"). The value is cosmetic — the mismatch is harmless. */}
        <span className="text-foreground" suppressHydrationWarning>
          {frames.toLocaleString()}
        </span>
      </span>
      <span>
        reviews flagged <span className="text-alert/90">{reviewsFlagged}</span>
      </span>
      <span>
        false alarms <span className="text-foreground/80">{falseAlarms}</span>
      </span>
    </div>
  );
}
