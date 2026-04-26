import { datasetClips, type DatasetClip } from "./audio-dataset";
import { enhanceFromUrl, type EnhanceResult } from "./audio-enhancer";

const STORAGE_KEY = "sentinel.benchRun.v2";

export type ClipMetric = {
  id: string;
  command: string;
  condition: "clean" | "noisy";
  take: string;
  rawUrl: string;
  enhancedUrl: string;
  rmsInDb: number;
  rmsOutDb: number;
  peakInDb: number;
  peakOutDb: number;
  vadSpeechRatio: number;
  vadAnyDetected: boolean;
  latencyMs: number;
  durationSec: number;
  rtFactor: number;
  qualityProxy: number;
  levelStatus: "pass" | "warn" | "fail";
};

export type BenchAggregate = {
  clips: number;
  vadDetected: number;
  vadMissRate: number;
  avgLatencyMs: number;
  avgRtFactor: number;
  avgRawRmsDb: number;
  avgEnhancedRmsDb: number;
  avgQuality: number;
  rmsLiftDb: number;
  inLevelPassRate: number;
};

export type BenchRun = {
  startedAt: number;
  completedAt: number;
  totalLatencyMs: number;
  clips: ClipMetric[];
  aggregate: {
    overall: BenchAggregate;
    clean: BenchAggregate;
    noisy: BenchAggregate;
  };
};

export type BenchProgress = {
  done: number;
  total: number;
  current?: DatasetClip;
};

export const benchTotal = datasetClips.length;

function levelStatus(db: number): "pass" | "warn" | "fail" {
  if (db >= -27 && db <= -16) return "pass";
  if (db < -35 || db > -8) return "fail";
  return "warn";
}

function qualityProxy(r: EnhanceResult): number {
  // Reference-free, honest 1-5 estimate driven by the signals we *do* measure:
  // - in-target loudness (-27..-16 dBFS) ............ +1.0
  // - speech actually detected ....................... +1.0
  // - speech-frame ratio (consistent voicing) ........ +1.5
  // - non-clipping enhanced peak (<= -1 dBFS) ........ +0.5
  // baseline 1.0
  let s = 1.0;
  if (r.rmsOutDb >= -27 && r.rmsOutDb <= -16) s += 1.0;
  else if (r.rmsOutDb >= -35 && r.rmsOutDb <= -8) s += 0.5;
  if (r.vadAnyDetected) s += 1.0;
  s += Math.min(1.5, r.vadSpeechRatio * 1.5);
  if (r.peakOutDb <= -1) s += 0.5;
  return Math.max(1, Math.min(5, s));
}

function summarize(rows: ClipMetric[]): BenchAggregate {
  const n = rows.length;
  if (!n) {
    return {
      clips: 0,
      vadDetected: 0,
      vadMissRate: 0,
      avgLatencyMs: 0,
      avgRtFactor: 0,
      avgRawRmsDb: 0,
      avgEnhancedRmsDb: 0,
      avgQuality: 0,
      rmsLiftDb: 0,
      inLevelPassRate: 0,
    };
  }
  const sum = (fn: (r: ClipMetric) => number) => rows.reduce((a, r) => a + fn(r), 0);
  const detected = rows.filter((r) => r.vadAnyDetected).length;
  const inLevel = rows.filter((r) => r.levelStatus === "pass").length;
  const avgRaw = sum((r) => r.rmsInDb) / n;
  const avgEnh = sum((r) => r.rmsOutDb) / n;
  return {
    clips: n,
    vadDetected: detected,
    vadMissRate: (n - detected) / n,
    avgLatencyMs: sum((r) => r.latencyMs) / n,
    avgRtFactor: sum((r) => r.rtFactor) / n,
    avgRawRmsDb: avgRaw,
    avgEnhancedRmsDb: avgEnh,
    avgQuality: sum((r) => r.qualityProxy) / n,
    rmsLiftDb: avgEnh - avgRaw,
    inLevelPassRate: inLevel / n,
  };
}

function toMetric(clip: DatasetClip, r: EnhanceResult): ClipMetric {
  return {
    id: clip.id,
    command: clip.command,
    condition: clip.condition,
    take: clip.take,
    rawUrl: clip.url,
    enhancedUrl: r.enhancedUrl,
    rmsInDb: r.rmsInDb,
    rmsOutDb: r.rmsOutDb,
    peakInDb: r.peakInDb,
    peakOutDb: r.peakOutDb,
    vadSpeechRatio: r.vadSpeechRatio,
    vadAnyDetected: r.vadAnyDetected,
    latencyMs: r.latencyMs,
    durationSec: r.durationSec,
    rtFactor: r.durationSec > 0 ? r.latencyMs / 1000 / r.durationSec : 0,
    qualityProxy: qualityProxy(r),
    levelStatus: levelStatus(r.rmsOutDb),
  };
}

export function buildAggregate(clips: ClipMetric[]): BenchRun["aggregate"] {
  return {
    overall: summarize(clips),
    clean: summarize(clips.filter((r) => r.condition === "clean")),
    noisy: summarize(clips.filter((r) => r.condition === "noisy")),
  };
}

export async function runBench(
  onProgress?: (p: BenchProgress) => void,
  onClip?: (m: ClipMetric) => void,
): Promise<BenchRun> {
  const startedAt = Date.now();
  const clips: ClipMetric[] = [];
  for (let i = 0; i < datasetClips.length; i++) {
    const clip = datasetClips[i];
    onProgress?.({ done: i, total: datasetClips.length, current: clip });
    const r = await enhanceFromUrl(clip.url);
    const m = toMetric(clip, r);
    clips.push(m);
    onClip?.(m);
  }
  onProgress?.({ done: datasetClips.length, total: datasetClips.length });
  const completedAt = Date.now();
  return {
    startedAt,
    completedAt,
    totalLatencyMs: clips.reduce((a, r) => a + r.latencyMs, 0),
    clips,
    aggregate: buildAggregate(clips),
  };
}

// localStorage holds metric scalars only — blob URLs are session-bound and dropped.
type PersistedClip = Omit<ClipMetric, "enhancedUrl">;
type PersistedRun = Omit<BenchRun, "clips"> & { clips: PersistedClip[] };

export function saveRun(run: BenchRun) {
  if (typeof window === "undefined") return;
  const persisted: PersistedRun = {
    ...run,
    clips: run.clips.map(({ enhancedUrl: _ignored, ...rest }) => rest),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // quota or private mode — silently skip
  }
}

export function loadRun(): BenchRun | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRun;
    return {
      ...parsed,
      clips: parsed.clips.map((c) => ({ ...c, enhancedUrl: "" })),
    };
  } catch {
    return null;
  }
}

export function clearRun() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function downloadRun(run: BenchRun, filename = "sentinel-bench-run.json") {
  const persisted = {
    ...run,
    clips: run.clips.map(({ enhancedUrl: _ignored, ...rest }) => rest),
  };
  const blob = new Blob([JSON.stringify(persisted, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function formatRelativeTime(epochMs: number, now = Date.now()): string {
  const diff = Math.max(0, now - epochMs);
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}
