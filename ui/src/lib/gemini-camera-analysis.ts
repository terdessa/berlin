import { createServerFn } from "@tanstack/react-start";

export type GeminiCameraMessage = {
  role: "user" | "model";
  text: string;
};

export type GeminiCameraInput = {
  imageBase64: string;
  imageFramesBase64?: string[];
  prompt: string;
  history?: GeminiCameraMessage[];
  mode?:
    | "question"
    | "commentary"
    | "loss-scan"
    | "object-watch"
    | "event-watch"
    | "palm-watch"
    | "object-hold";
  audioBase64?: string;
  audioMimeType?: string;
};

export type GeminiCameraResult =
  | {
      ok: true;
      text: string;
      model: string;
    }
  | {
      ok: false;
      reason: "not-configured" | "invalid-input" | "api-error";
      message: string;
    };

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const MAX_HISTORY_TURNS = 8;

export const analyzeCameraFrame = createServerFn({ method: "POST" })
  .inputValidator((data: GeminiCameraInput) => {
    if (!data || typeof data !== "object") throw new Error("input is required");
    if (typeof data.imageBase64 !== "string" || data.imageBase64.length < 100) {
      throw new Error("imageBase64 is required");
    }
    if (typeof data.prompt !== "string" || data.prompt.trim().length === 0) {
      throw new Error("prompt is required");
    }

    const history = Array.isArray(data.history)
      ? data.history
          .filter(
            (item): item is GeminiCameraMessage =>
              item &&
              (item.role === "user" || item.role === "model") &&
              typeof item.text === "string" &&
              item.text.trim().length > 0,
          )
          .slice(-MAX_HISTORY_TURNS)
      : [];
    const audioBase64 =
      typeof data.audioBase64 === "string" && data.audioBase64.length > 100
        ? stripDataUrlPrefix(data.audioBase64)
        : undefined;
    const audioMimeType =
      audioBase64 && typeof data.audioMimeType === "string" && data.audioMimeType.trim()
        ? data.audioMimeType.trim().split(";")[0]
        : undefined;
    const imageFramesBase64 = Array.isArray(data.imageFramesBase64)
      ? data.imageFramesBase64
          .filter((frame): frame is string => typeof frame === "string" && frame.length > 100)
          .slice(0, 12)
          .map(stripDataUrlPrefix)
      : [];

    return {
      imageBase64: stripDataUrlPrefix(data.imageBase64),
      imageFramesBase64,
      prompt: data.prompt.trim().slice(0, 2000),
      history,
      mode:
        data.mode === "commentary" ||
        data.mode === "loss-scan" ||
        data.mode === "object-watch" ||
        data.mode === "event-watch" ||
        data.mode === "palm-watch" ||
        data.mode === "object-hold"
          ? data.mode
          : "question",
      audioBase64,
      audioMimeType,
    };
  })
  .handler(async ({ data }): Promise<GeminiCameraResult> => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const model = GEMINI_MODEL;

    if (!apiKey || apiKey.startsWith("replace-with") || apiKey === "AIzaSy...") {
      return {
        ok: false,
        reason: "not-configured",
        message:
          "Gemini is not configured. Add GEMINI_API_KEY to the repo root .env and restart the dev server.",
      };
    }

    const hasAudio = !!data.audioBase64;
    const frameBase64s =
      data.imageFramesBase64.length > 0 ? data.imageFramesBase64 : [data.imageBase64];
    const systemInstruction =
      data.mode === "loss-scan"
        ? "You are Sentinel's live retail camera analyst. Review the ordered frame sequence for observable loss-prevention concerns such as shelf-to-bag, shelf-to-pocket, concealment-like movement, repeated scanning of surroundings, or item handling that needs human review. Do not accuse anyone, identify people, infer intent, or mention protected traits. If nothing review-worthy is visible, say that clearly. If review is warranted, use cautious language like 'requires review' and cite the frame-to-frame observation."
        : data.mode === "event-watch"
          ? "You are Sentinel's CAM-03 live camera analyst. Analyze only the ordered CAM-03 frames provided. Use cautious, non-accusatory language. Reply exactly CLEAR if nothing review-worthy is visible. Reply exactly ALERT: followed by one concise observable summary if the frames show a person entering the monitored area, a reviewed item disappearing, concealment-like item movement, unusual handling, or another situation a human guard should review. Do not infer intent or identity."
          : data.mode === "object-hold"
            ? "You are a precise visual detector for retail loss-prevention review. Look only for whether any person in the frame is holding any physical object in their hand that they have just picked up (e.g. an item from a shelf, table, display, or counter). The trigger is a hand visibly gripping a discrete item. Ignore: empty hands, pointing, people only touching items without lifting them, phones held passively at rest, and people walking by empty-handed. Reply exactly HOLD if a person is clearly holding a picked-up object in hand. Otherwise reply exactly NONE."
            : data.mode === "palm-watch"
              ? "You are a precise visual detector. The only thing you look for is an open human palm shown to the camera (a flat, open hand with fingers spread or extended, deliberately presented toward the lens). Ignore everything else: faces, motion, objects, background. Reply exactly PALM if any frame in the sequence clearly shows an open palm presented to the camera. Otherwise reply exactly NONE."
              : data.mode === "object-watch"
                ? "You are a precise visual detector. Look only for whether the watched object is visible anywhere in the image. Reply exactly with ITEM_VISIBLE if the watched object is visible, otherwise reply exactly with ITEM_GONE."
                : data.mode === "commentary"
                  ? "You are Sentinel's live visual analyst. Comment on the current camera frame in 2-4 concise sentences. Describe observable details only. Do not identify people, infer protected traits, or accuse anyone of wrongdoing. Mention uncertainty when relevant."
                  : hasAudio
                    ? "You are Sentinel's live camera-and-voice analyst. Use the current camera frame, recent chat context, and the attached microphone audio together. Treat the audio as the user's spoken request; briefly reflect the request only when useful, then answer it using observable visual details. Be concise, practical, and careful. Do not identify people, infer protected traits, or accuse anyone of wrongdoing."
                    : "You are Sentinel's live visual analyst. Answer the user's question using the current camera frame and recent chat context. Be concise, practical, and careful. Describe observable details only. Do not identify people, infer protected traits, or accuse anyone of wrongdoing.";
    const userParts: GeminiPart[] = [
      {
        text:
          data.mode === "loss-scan"
            ? `${data.prompt}\n\nThe following ${frameBase64s.length} images are ordered oldest to newest. Compare them as a short video-like sequence and return: status, confidence, key observation, and recommended next human-review action.`
            : data.mode === "event-watch"
              ? `${data.prompt}\n\nThe following ${frameBase64s.length} images are ordered oldest to newest from CAM-03. Reply exactly CLEAR or ALERT: <summary>.`
              : data.mode === "object-hold"
                ? `${data.prompt}\n\nThe following ${frameBase64s.length} images are ordered oldest to newest from CAM-03. Reply exactly HOLD or NONE.`
                : data.mode === "palm-watch"
                  ? `${data.prompt}\n\nThe following ${frameBase64s.length} images are ordered oldest to newest from CAM-03. Reply exactly PALM or NONE.`
                  : data.mode === "object-watch"
                    ? data.prompt
                    : hasAudio
                      ? `${data.prompt}\n\nThe attached audio is the user's spoken request. Analyze it together with the current camera frame.`
                      : data.prompt,
      },
    ];
    frameBase64s.forEach((frame, index) => {
      if (frameBase64s.length > 1) {
        userParts.push({ text: `Frame ${index + 1} of ${frameBase64s.length}` });
      }
      userParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: frame,
        },
      });
    });
    const audioBase64 = data.audioBase64;
    if (audioBase64) {
      userParts.push({
        inlineData: {
          mimeType: data.audioMimeType || "audio/wav",
          data: audioBase64,
        },
      });
    }

    const contents = [
      ...data.history.map((message) => ({
        role: message.role,
        parts: [{ text: message.text }],
      })),
      {
        role: "user",
        parts: userParts,
      },
    ];

    const result = await requestGemini({
      apiKey,
      model,
      systemInstruction,
      contents,
      mode: data.mode,
    });

    if (result.ok) return result;
    return { ok: false, reason: "api-error", message: result.message };
  });

type GeminiPart =
  | { text: string }
  | {
      inlineData: {
        mimeType: string;
        data: string;
      };
    };

type GeminiRequestInput = {
  apiKey: string;
  model: string;
  systemInstruction: string;
  contents: Array<{
    role: string;
    parts: GeminiPart[];
  }>;
  mode?:
    | "question"
    | "commentary"
    | "loss-scan"
    | "object-watch"
    | "event-watch"
    | "palm-watch"
    | "object-hold";
};

type GeminiRequestResult =
  | {
      ok: true;
      text: string;
      model: string;
    }
  | {
      ok: false;
      status?: number;
      message: string;
    };

async function requestGemini({
  apiKey,
  model,
  systemInstruction,
  contents,
  mode,
}: GeminiRequestInput): Promise<GeminiRequestResult> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents,
          generationConfig: {
            temperature: mode === "commentary" ? 0.5 : 0.1,
            maxOutputTokens:
              mode === "object-watch" || mode === "palm-watch" || mode === "object-hold"
                ? 8
                : mode === "event-watch"
                  ? 80
                  : mode === "commentary"
                    ? 220
                    : mode === "loss-scan"
                      ? 320
                      : 420,
          },
        }),
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    } | null;

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: payload?.error?.message || `Gemini request failed with ${response.status}.`,
      };
    }

    const text =
      payload?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text)
        .filter(Boolean)
        .join("\n")
        .trim() || "";

    return {
      ok: true,
      text: text || "I could not produce a visual analysis for this frame.",
      model,
    };
  } catch (err) {
    const cause =
      err instanceof Error &&
      "cause" in err &&
      err.cause &&
      typeof err.cause === "object" &&
      "message" in err.cause
        ? String(err.cause.message)
        : "";
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: cause ? `${message}: ${cause}` : message };
  }
}

function stripDataUrlPrefix(value: string) {
  return value.replace(/^data:[^;]+;base64,/i, "");
}
