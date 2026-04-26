import bundledAudioResults from "./audio-metrics-generated.json";

export type ComparisonRow = {
  id: string;
  version: string;
  clips: number | null;
  transcribed: number | null;
  sais: number | null;
  correctActionRate: number | null;
  safeRecoveryRate: number | null;
  dangerousErrorRate: number | null;
  wer: number | null;
  avgConfidence: number | null;
  note: string;
};

export type FailureBreakdown = {
  label: string;
  count: number;
  pct: number;
};

export type CommandPerformance = {
  command: string;
  clips: number;
  transcribed: number;
  sais: number | null;
  correctActionRate: number | null;
  safeRecoveryRate: number | null;
  dangerousErrorRate: number | null;
  wer: number | null;
  avgConfidence: number | null;
};

export type QualitySignal = {
  signal: string;
  value: string;
  status: "pass" | "warn" | "fail";
  threshold: string;
  tool: string;
  meaning: string;
};

export type PipelineStage = {
  stage: string;
  signal: string;
  value: string;
  status: "pass" | "warn" | "fail";
  note: string;
};

export type InteractionOutcome = {
  id: string;
  condition: string;
  system?: string;
  expected: string;
  heard: string;
  action: string;
  decisionType:
    | "correct_action"
    | "safe_recovery"
    | "dangerous_error"
    | "missing_transcript"
    | "unscored";
  reason: string;
  confidence: number | null;
  wer: number | null;
};

export type AudioMetricsDashboard = {
  source: string;
  warnings: string[];
  conditionComparison: ComparisonRow[];
  systemComparison: ComparisonRow[];
  failureBreakdown: FailureBreakdown[];
  commandPerformance: CommandPerformance[];
  qualitySignals: QualitySignal[];
  pipelineStages: PipelineStage[];
  stressCoverage: Array<{ label: string; value: string; detail: string }>;
  outcomes: InteractionOutcome[];
};

type SummaryBlock = {
  clips?: number;
  transcribedClips?: number;
  sais?: number | null;
  correctActionRate?: number | null;
  safeRecoveryRate?: number | null;
  dangerousErrorRate?: number | null;
  wer?: number | null;
  unsafeActionRate?: number | null;
  retryRate?: number | null;
  avgConfidence?: number | null;
  avgUsabilityScore?: number | null;
  avgRmsDbfs?: number | null;
};

type BenchmarkRecord = {
  case_id?: string;
  id?: string;
  condition?: string;
  system?: string;
  expected_utterance?: string;
  expected_command?: string;
  transcript?: string | null;
  repaired_transcript?: string | null;
  parsed_command?: string | null;
  parsed_target?: string | null;
  action_taken?: string | null;
  command_confidence?: number | null;
  task_success?: boolean | null;
  safe_recovery?: boolean | null;
  unsafe_action?: boolean | null;
  dangerous_error?: boolean | null;
  decision_type?: string | null;
  failure_reason?: string | null;
  failure_mode?: string | null;
  wer?: number | null;
  explanation?: string | null;
};

type BenchmarkPayload = {
  dataset?: {
    clips?: number;
    cases?: number;
    supportedCommands?: string[];
  };
  summary?: Record<string, unknown> & {
    totalClips?: number;
    transcribedClips?: number;
    overall?: SummaryBlock;
    clean?: SummaryBlock;
    noisy?: SummaryBlock;
    failureBreakdown?: FailureBreakdown[];
    commandPerformance?: CommandPerformance[];
  };
  records?: BenchmarkRecord[];
};

export const audioMetricsDashboard = buildAudioMetricsDashboard(
  bundledAudioResults as BenchmarkPayload,
  "bundled generated benchmark",
);

export function buildAudioMetricsDashboard(
  payload: BenchmarkPayload,
  source: string,
): AudioMetricsDashboard {
  const records = payload.records ?? [];
  const summary = payload.summary ?? {};
  const overall = summary.overall ?? summarize(records);
  const clean =
    summary.clean ?? summarize(records.filter((record) => record.condition === "clean"));
  const noisy =
    summary.noisy ?? summarize(records.filter((record) => record.condition === "noisy"));
  const totalClips = summary.totalClips ?? payload.dataset?.clips ?? records.length;
  const transcribedClips =
    summary.transcribedClips ?? records.filter((record) => record.transcript).length;
  const missing = Math.max(0, totalClips - transcribedClips);
  const vadMissRate = totalClips ? missing / totalClips : null;

  const outcomes = records.map(toOutcome);
  const failures = summary.failureBreakdown ?? buildFailureBreakdown(outcomes);
  const commandRows = mergeCommandPerformance(
    summary.commandPerformance,
    buildCommandPerformance(records),
  );
  const qualitySignals = buildQualitySignals(overall, vadMissRate);

  return {
    source,
    warnings: missing
      ? [
          `${missing} of ${totalClips} clips still need Gradium transcripts before the benchmark is complete.`,
        ]
      : [],
    conditionComparison: [
      comparison(
        "overall",
        "All recorded clips",
        overall,
        "Complete 48-track supermarket benchmark",
      ),
      comparison("clean", "Clean clips", clean, "Clean phone-recorded guard commands"),
      comparison(
        "noisy",
        "Noisy supermarket clips",
        noisy,
        "Retail background noise and second takes",
      ),
    ],
    systemComparison: buildSystemComparison(summary),
    failureBreakdown: failures,
    commandPerformance: commandRows,
    qualitySignals,
    pipelineStages: buildPipelineStages(overall, vadMissRate),
    stressCoverage: [
      {
        label: "dataset",
        value: `${totalClips} clips`,
        detail: "real clean and noisy guard commands recorded for the supermarket scenario",
      },
      {
        label: "noise",
        value: `${noisy.clips ?? 0} noisy`,
        detail: "retail background noise, second takes, and hard STT conditions",
      },
      {
        label: "commands",
        value: `${payload.dataset?.cases ?? commandRows.length}`,
        detail: "camera, playback, report, dispatch, follow, backup, and review commands",
      },
      {
        label: "misses",
        value: `${missing}`,
        detail: "kept visible as VAD/STT misses instead of hidden from the score",
      },
    ],
    outcomes,
  };
}

function buildQualitySignals(overall: SummaryBlock, vadMissRate: number | null): QualitySignal[] {
  return [
    {
      signal: "Non-intrusive MOS",
      value: formatScore(overall.avgUsabilityScore),
      status: mosStatus(overall.avgUsabilityScore),
      threshold: "usable >= 3.0",
      tool: "audio usability / NISQA-like proxy",
      meaning: "Does the audio sound usable before it reaches STT?",
    },
    {
      signal: "WER under noise",
      value: formatPct(overall.wer),
      status: thresholdStatus(overall.wer, 0.15, 0.3, false),
      threshold: "good <= 15%, breaking >= 30%",
      tool: "Gradium STT + reference transcript",
      meaning: "Does the speech recognizer still hear the words?",
    },
    {
      signal: "VAD miss-rate",
      value: formatPct(vadMissRate),
      status: thresholdStatus(vadMissRate, 0.05, 0.1, false),
      threshold: "good <= 5%",
      tool: "Gradium streaming VAD/STT completion",
      meaning: "Did the pipeline detect speech at all?",
    },
    {
      signal: "Input level",
      value: formatDb(overall.avgRmsDbfs),
      status: levelStatus(overall.avgRmsDbfs),
      threshold: "target -27 to -16 dB",
      tool: "RMS dBFS as LUFS proxy",
      meaning: "Is the mic level sensible for STT?",
    },
    {
      signal: "Task completion",
      value: formatPct(overall.sais),
      status: thresholdStatus(overall.sais, 0.9, 0.75, true),
      threshold: "demo target >= 90%",
      tool: "Sentinel Audio Intelligence Score",
      meaning: "Did Sentinel take the correct or safe action?",
    },
  ];
}

function buildPipelineStages(overall: SummaryBlock, vadMissRate: number | null): PipelineStage[] {
  return [
    {
      stage: "Audio capture",
      signal: "input level",
      value: formatDb(overall.avgRmsDbfs),
      status: levelStatus(overall.avgRmsDbfs),
      note: "Level is tracked so low-volume or clipped mic input is visible.",
    },
    {
      stage: "Audio quality",
      signal: "MOS proxy",
      value: formatScore(overall.avgUsabilityScore),
      status: mosStatus(overall.avgUsabilityScore),
      note: "Reference-free quality approximates the DNSMOS/NISQA role from the starter recipe.",
    },
    {
      stage: "Speech detection",
      signal: "VAD miss",
      value: formatPct(vadMissRate),
      status: thresholdStatus(vadMissRate, 0.05, 0.1, false),
      note: "One noisy clip produced no Gradium transcript and remains visible as a miss.",
    },
    {
      stage: "Speech recognition",
      signal: "WER",
      value: formatPct(overall.wer),
      status: thresholdStatus(overall.wer, 0.15, 0.3, false),
      note: "High WER shows the hostile supermarket noise is genuinely stressing STT.",
    },
    {
      stage: "Agent decision",
      signal: "SAIS",
      value: formatPct(overall.sais),
      status: thresholdStatus(overall.sais, 0.9, 0.75, true),
      note: "Sentinel converts many bad transcripts into safe recoveries instead of wrong actions.",
    },
  ];
}

function summarize(records: BenchmarkRecord[]): SummaryBlock {
  const transcribed = records.filter((record) => record.transcript);
  const count = transcribed.length;
  const correct = transcribed.filter(
    (record) => record.decision_type === "correct_action" || record.task_success,
  ).length;
  const recovery = transcribed.filter(
    (record) => record.decision_type === "safe_recovery" || record.safe_recovery,
  ).length;
  const danger = transcribed.filter(
    (record) =>
      record.decision_type === "dangerous_error" || record.dangerous_error || record.unsafe_action,
  ).length;
  return {
    clips: records.length,
    transcribedClips: count,
    sais: count ? (correct + recovery) / count : null,
    correctActionRate: count ? correct / count : null,
    safeRecoveryRate: count ? recovery / count : null,
    dangerousErrorRate: count ? danger / count : null,
    wer: avg(transcribed.map((record) => record.wer)),
    avgConfidence: avg(transcribed.map((record) => record.command_confidence)),
  };
}

function buildSystemComparison(summary: BenchmarkPayload["summary"]): ComparisonRow[] {
  const keys = [
    ["raw_noisy", "Raw noisy audio"],
    ["aicoustics_only", "+ ai-coustics"],
    ["aicoustics_plus_sentinel", "+ ai-coustics + Sentinel"],
  ] as const;
  return keys.flatMap(([key, label]) => {
    const block = summary?.[key] as SummaryBlock | undefined;
    return block ? [comparison(key, label, block, "Generated system comparison row")] : [];
  });
}

function buildFailureBreakdown(outcomes: InteractionOutcome[]): FailureBreakdown[] {
  const failures = outcomes.filter((row) => row.reason && row.reason !== "matched expected action");
  const counts = new Map<string, number>();
  for (const row of failures) counts.set(row.reason, (counts.get(row.reason) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      pct: failures.length ? count / failures.length : 0,
    }));
}

function buildCommandPerformance(records: BenchmarkRecord[]): CommandPerformance[] {
  const grouped = new Map<string, BenchmarkRecord[]>();
  for (const record of records) {
    const key = record.expected_command || record.expected_utterance || "unknown";
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }
  return [...grouped.entries()].map(([command, commandRecords]) => {
    const block = summarize(commandRecords);
    return {
      command,
      clips: commandRecords.length,
      transcribed: block.transcribedClips ?? 0,
      sais: block.sais ?? null,
      correctActionRate: block.correctActionRate ?? null,
      safeRecoveryRate: block.safeRecoveryRate ?? null,
      dangerousErrorRate: block.dangerousErrorRate ?? null,
      wer: block.wer ?? null,
      avgConfidence: block.avgConfidence ?? null,
    };
  });
}

function mergeCommandPerformance(
  summaryRows: CommandPerformance[] | undefined,
  computedRows: CommandPerformance[],
): CommandPerformance[] {
  if (!summaryRows?.length) return computedRows;

  const computedByCommand = new Map(computedRows.map((row) => [row.command, row]));
  return summaryRows.map((row) => {
    const computed = computedByCommand.get(row.command);
    return {
      command: row.command,
      clips: row.clips ?? computed?.clips ?? 0,
      transcribed: row.transcribed ?? computed?.transcribed ?? 0,
      sais: row.sais ?? computed?.sais ?? null,
      correctActionRate: row.correctActionRate ?? computed?.correctActionRate ?? null,
      safeRecoveryRate: row.safeRecoveryRate ?? computed?.safeRecoveryRate ?? null,
      dangerousErrorRate: row.dangerousErrorRate ?? computed?.dangerousErrorRate ?? null,
      wer: row.wer ?? computed?.wer ?? null,
      avgConfidence: row.avgConfidence ?? computed?.avgConfidence ?? null,
    };
  });
}

function toOutcome(record: BenchmarkRecord): InteractionOutcome {
  const transcript = record.repaired_transcript || record.transcript || "";
  const decision = normalizeDecision(record);
  return {
    id: record.case_id || record.id || "unknown",
    condition: record.condition || "unknown",
    system: record.system,
    expected: record.expected_utterance || record.expected_command || "unknown",
    heard: transcript,
    action: record.action_taken || "pending transcript",
    decisionType: decision,
    reason:
      record.failure_reason ||
      record.failure_mode ||
      (record.transcript ? "matched expected action" : "missing Gradium transcript"),
    confidence: cleanNumber(record.command_confidence),
    wer: cleanNumber(record.wer),
  };
}

function normalizeDecision(record: BenchmarkRecord): InteractionOutcome["decisionType"] {
  if (!record.transcript) return "missing_transcript";
  if (record.decision_type === "correct_action" || record.task_success) return "correct_action";
  if (record.decision_type === "safe_recovery" || record.safe_recovery) return "safe_recovery";
  if (
    record.decision_type === "dangerous_error" ||
    record.dangerous_error ||
    record.unsafe_action
  ) {
    return "dangerous_error";
  }
  return "unscored";
}

function comparison(id: string, label: string, block: SummaryBlock, note: string): ComparisonRow {
  return {
    id,
    version: label,
    clips: block.clips ?? null,
    transcribed: block.transcribedClips ?? null,
    sais: block.sais ?? null,
    correctActionRate: block.correctActionRate ?? null,
    safeRecoveryRate: block.safeRecoveryRate ?? null,
    dangerousErrorRate: block.dangerousErrorRate ?? block.unsafeActionRate ?? null,
    wer: block.wer ?? null,
    avgConfidence: block.avgConfidence ?? null,
    note,
  };
}

function avg(values: Array<number | null | undefined>) {
  const clean = values.filter((value): value is number => typeof value === "number");
  if (!clean.length) return null;
  return clean.reduce((sum, value) => sum + value, 0) / clean.length;
}

function cleanNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatPct(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? "n/a" : `${Math.round(value * 100)}%`;
}

function formatScore(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? "n/a" : value.toFixed(2);
}

function formatDb(value: number | null | undefined) {
  return value == null || Number.isNaN(value) ? "n/a" : `${value.toFixed(1)} dB`;
}

function thresholdStatus(
  value: number | null | undefined,
  good: number,
  bad: number,
  higherIsBetter: boolean,
): QualitySignal["status"] {
  if (value == null || Number.isNaN(value)) return "warn";
  if (higherIsBetter) {
    if (value >= good) return "pass";
    if (value < bad) return "fail";
    return "warn";
  }
  if (value <= good) return "pass";
  if (value >= bad) return "fail";
  return "warn";
}

function mosStatus(value: number | null | undefined): QualitySignal["status"] {
  if (value == null || Number.isNaN(value)) return "warn";
  if (value >= 3.0) return "pass";
  if (value < 2.0) return "fail";
  return "warn";
}

function levelStatus(value: number | null | undefined): QualitySignal["status"] {
  if (value == null || Number.isNaN(value)) return "warn";
  if (value >= -27 && value <= -16) return "pass";
  if (value < -35 || value > -8) return "fail";
  return "warn";
}
