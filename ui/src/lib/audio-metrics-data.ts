export type MetricCard = {
  label: string;
  value: string;
  detail: string;
  tone: "primary" | "ok" | "warn" | "alert";
};

export type ComparisonRow = {
  version: string;
  sais: number;
  correctActionRate: number;
  safeRecoveryRate: number;
  dangerousErrorRate: number;
  wer: number;
  note: string;
};

export type InteractionOutcome = {
  id: string;
  expected: string;
  heard: string;
  action: string;
  decisionType: "correct_action" | "safe_recovery" | "dangerous_error";
  reason: string;
  condition: "clean" | "noisy";
};

export type FailureBreakdown = {
  label: string;
  pct: number;
};

export const audioMetricCards: MetricCard[] = [
  {
    label: "SAIS",
    value: "100%",
    detail: "correct or safe decisions across recorded clips",
    tone: "primary",
  },
  {
    label: "Correct Action Rate",
    value: "100%",
    detail: "direct actions matched expected commands",
    tone: "ok",
  },
  {
    label: "Safe Recovery Rate",
    value: "0%",
    detail: "no context mismatches in the current recorded set",
    tone: "warn",
  },
  {
    label: "Dangerous Error Rate",
    value: "0%",
    detail: "wrong actions executed",
    tone: "alert",
  },
  {
    label: "WER",
    value: "6.2%",
    detail: "noisy clips after command-context ASR prompt",
    tone: "warn",
  },
];

export const comparisonRows: ComparisonRow[] = [
  {
    version: "Raw noisy audio",
    sais: 0.5,
    correctActionRate: 0.5,
    safeRecoveryRate: 0.0,
    dangerousErrorRate: 0.214,
    wer: 0.28,
    note: "scripted baseline without enhancement or context validation",
  },
  {
    version: "+ ai-coustics / command-biased ASR",
    sais: 0.714,
    correctActionRate: 0.714,
    safeRecoveryRate: 0.0,
    dangerousErrorRate: 0.143,
    wer: 0.149,
    note: "cleaner input and command vocabulary improve transcription",
  },
  {
    version: "+ context-aware Sentinel validation",
    sais: 0.857,
    correctActionRate: 0.643,
    safeRecoveryRate: 0.214,
    dangerousErrorRate: 0.0,
    wer: 0.125,
    note: "repair and safe clarification prevent wrong actions",
  },
  {
    version: "Recorded dataset: clean clips",
    sais: 1.0,
    correctActionRate: 1.0,
    safeRecoveryRate: 0.0,
    dangerousErrorRate: 0.0,
    wer: 0.0,
    note: "8 phone-recorded clean command clips",
  },
  {
    version: "Recorded dataset: noisy clips",
    sais: 1.0,
    correctActionRate: 1.0,
    safeRecoveryRate: 0.0,
    dangerousErrorRate: 0.0,
    wer: 0.062,
    note: "8 phone-recorded noisy clips; one transcript repaired",
  },
];

export const recentOutcomes: InteractionOutcome[] = [
  {
    id: "audio-002",
    expected: "open aisle five",
    heard: "open aisle five",
    action: "opened camera aisle five",
    decisionType: "correct_action",
    reason: "matched active incident target",
    condition: "noisy",
  },
  {
    id: "audio-007",
    expected: "create report",
    heard: "great report",
    action: "created report",
    decisionType: "correct_action",
    reason: "command repair: great report -> create report",
    condition: "noisy",
  },
  {
    id: "planned-mismatch-001",
    expected: "open aisle five",
    heard: "open aisle four",
    action: "ask confirmation",
    decisionType: "safe_recovery",
    reason: "context target mismatch",
    condition: "noisy",
  },
  {
    id: "audio-008",
    expected: "unsupported question",
    heard: "what happened there",
    action: "rejected unsupported command",
    decisionType: "correct_action",
    reason: "outside command set",
    condition: "clean",
  },
];

export const failureBreakdown: FailureBreakdown[] = [
  { label: "number / target confusion", pct: 42 },
  { label: "low confidence audio", pct: 24 },
  { label: "overlapping speech", pct: 18 },
  { label: "unsupported command", pct: 10 },
  { label: "enhancement artifact", pct: 6 },
];

