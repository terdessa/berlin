import { createServerFn } from "@tanstack/react-start";

export type GeminiCameraMessage = {
  role: "user" | "model";
  text: string;
};

export type GeminiCameraInput = {
  imageBase64: string;
  prompt: string;
  history?: GeminiCameraMessage[];
  mode?: "question" | "commentary";
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

const DEFAULT_MODEL = "gemini-3.1-pro-preview";
const DEFAULT_FALLBACK_MODEL = "gemini-2.5-flash-lite";
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

    return {
      imageBase64: stripDataUrlPrefix(data.imageBase64),
      prompt: data.prompt.trim().slice(0, 2000),
      history,
      mode: data.mode === "commentary" ? "commentary" : "question",
    };
  })
  .handler(async ({ data }): Promise<GeminiCameraResult> => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const model = process.env.GEMINI_CAMERA_MODEL || DEFAULT_MODEL;
    const fallbackModel = process.env.GEMINI_CAMERA_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;

    if (!apiKey || apiKey.startsWith("replace-with") || apiKey === "AIzaSy...") {
      return {
        ok: false,
        reason: "not-configured",
        message:
          "Gemini is not configured. Add GEMINI_API_KEY to ui/.env and restart the dev server.",
      };
    }

    const systemInstruction =
      data.mode === "commentary"
        ? "You are Sentinel's live visual analyst. Comment on the current camera frame in 2-4 concise sentences. Describe observable details only. Do not identify people, infer protected traits, or accuse anyone of wrongdoing. Mention uncertainty when relevant."
        : "You are Sentinel's live visual analyst. Answer the user's question using the current camera frame and recent chat context. Be concise, practical, and careful. Describe observable details only. Do not identify people, infer protected traits, or accuse anyone of wrongdoing.";

    const contents = [
      ...data.history.map((message) => ({
        role: message.role,
        parts: [{ text: message.text }],
      })),
      {
        role: "user",
        parts: [
          { text: data.prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: data.imageBase64,
            },
          },
        ],
      },
    ];

    const primary = await requestGemini({
      apiKey,
      model,
      systemInstruction,
      contents,
      mode: data.mode,
    });

    if (primary.ok) return primary;

    const shouldFallback =
      fallbackModel &&
      fallbackModel !== model &&
      (primary.status === 404 || primary.status === 429 || primary.message.includes("quota"));

    if (shouldFallback) {
      const fallback = await requestGemini({
        apiKey,
        model: fallbackModel,
        systemInstruction,
        contents,
        mode: data.mode,
      });
      if (fallback.ok) return fallback;
      return {
        ok: false,
        reason: "api-error",
        message: `${model} failed: ${primary.message}. ${fallbackModel} also failed: ${fallback.message}`,
      };
    }

    return { ok: false, reason: "api-error", message: primary.message };
  });

type GeminiRequestInput = {
  apiKey: string;
  model: string;
  systemInstruction: string;
  contents: Array<{
    role: string;
    parts: Array<
      | { text: string }
      | {
          inlineData: {
            mimeType: string;
            data: string;
          };
        }
    >;
  }>;
  mode?: "question" | "commentary";
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
            temperature: mode === "commentary" ? 0.5 : 0.35,
            maxOutputTokens: mode === "commentary" ? 220 : 420,
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
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

function stripDataUrlPrefix(value: string) {
  return value.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
}
