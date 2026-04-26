import init, { Model, Processor, ProcessorParameter } from "@ai-coustics/aic-sdk-wasm";
import wasmUrl from "@ai-coustics/aic-sdk-wasm/aic_sdk_wasm_bg.wasm?url";

const MODEL_URL =
  "https://artifacts.ai-coustics.io/models/quail-vf-l-16khz/v1/quail_vf_l_16khz_jc5pk1aa_v17.aicmodel";

let initPromise: Promise<void> | null = null;
let modelPromise: Promise<Model> | null = null;

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const res = await fetch(wasmUrl);
      const bytes = await res.arrayBuffer();
      await init({ module_or_path: bytes });
    })();
  }
  await initPromise;
}

async function ensureModel(): Promise<Model> {
  if (!modelPromise) {
    modelPromise = (async () => {
      await ensureInit();
      const res = await fetch(MODEL_URL);
      if (!res.ok) throw new Error(`Model fetch failed: ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      return Model.fromBytes(bytes);
    })();
  }
  return modelPromise;
}

function getLicenseKey(): string {
  const key = import.meta.env.VITE_AIC_KEY as string | undefined;
  if (!key) {
    throw new Error("VITE_AIC_KEY missing. Add it to ui/.env.local and restart vite.");
  }
  return key;
}

function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
}

function dbfs(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -120;
}

function resampleLinear(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (inRate === outRate) return input;
  const ratio = inRate / outRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcIndex - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export type EnhanceResult = {
  enhancedUrl: string;
  sampleRate: number;
  durationSec: number;
  rmsInDb: number;
  rmsOutDb: number;
  peakInDb: number;
  peakOutDb: number;
  vadSpeechRatio: number;
  vadAnyDetected: boolean;
  latencyMs: number;
};

export async function enhanceFromUrl(
  inputUrl: string,
  options: { enhancementLevel?: number; voiceGain?: number } = {},
): Promise<EnhanceResult> {
  const model = await ensureModel();
  const licenseKey = getLicenseKey();

  const sampleRate = model.getOptimalSampleRate();
  const numFrames = model.getOptimalNumFrames(sampleRate);

  const res = await fetch(inputUrl);
  if (!res.ok) throw new Error(`Audio fetch failed: ${inputUrl}`);
  const arrayBuf = await res.arrayBuffer();

  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
  await ctx.close();

  let mono = decoded.getChannelData(0);
  if (decoded.numberOfChannels > 1) {
    const merged = new Float32Array(mono.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const ch = decoded.getChannelData(c);
      for (let i = 0; i < merged.length; i++) merged[i] += ch[i];
    }
    for (let i = 0; i < merged.length; i++) merged[i] /= decoded.numberOfChannels;
    mono = merged;
  }

  const input = resampleLinear(mono, decoded.sampleRate, sampleRate);
  const rmsIn = rms(input);
  let peakIn = 0;
  for (let i = 0; i < input.length; i++) {
    const a = Math.abs(input[i]);
    if (a > peakIn) peakIn = a;
  }

  const processor = new Processor(model, licenseKey);
  processor.initialize(sampleRate, 1, numFrames, false);
  const procCtx = processor.getProcessorContext();
  const vad = processor.getVadContext();

  if (options.enhancementLevel !== undefined) {
    procCtx.setParameter(ProcessorParameter.EnhancementLevel, options.enhancementLevel);
  }
  if (options.voiceGain !== undefined) {
    procCtx.setParameter(ProcessorParameter.VoiceGain, options.voiceGain);
  }

  const padded = new Float32Array(Math.ceil(input.length / numFrames) * numFrames);
  padded.set(input);
  const output = new Float32Array(padded.length);

  let vadHits = 0;
  let vadChecks = 0;
  const t0 = performance.now();
  for (let offset = 0; offset < padded.length; offset += numFrames) {
    const frame = padded.slice(offset, offset + numFrames);
    processor.processInterleaved(frame, 1, numFrames);
    output.set(frame, offset);
    if (vad.isSpeechDetected()) vadHits++;
    vadChecks++;
  }
  const latencyMs = performance.now() - t0;

  const delaySamples = procCtx.getOutputDelay();
  const trimmed = output.subarray(delaySamples, delaySamples + input.length);
  const rmsOut = rms(trimmed);
  let peakOut = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const a = Math.abs(trimmed[i]);
    if (a > peakOut) peakOut = a;
  }

  vad.free();
  procCtx.free();
  processor.free();

  const wavBlob = encodeWav(trimmed, sampleRate);
  return {
    enhancedUrl: URL.createObjectURL(wavBlob),
    sampleRate,
    durationSec: trimmed.length / sampleRate,
    rmsInDb: dbfs(rmsIn),
    rmsOutDb: dbfs(rmsOut),
    peakInDb: dbfs(peakIn),
    peakOutDb: dbfs(peakOut),
    vadSpeechRatio: vadChecks > 0 ? vadHits / vadChecks : 0,
    vadAnyDetected: vadHits > 0,
    latencyMs,
  };
}
