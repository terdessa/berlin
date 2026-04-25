import { createServerFn } from "@tanstack/react-start";

export type IssueTokenInput = {
  room: string;
  identity: string;
};

export type IssueTokenResult = {
  ok: true;
  token: string;
  url: string;
};

export type IssueTokenError = {
  ok: false;
  reason: "not-configured" | "invalid-input" | "internal";
  message: string;
};

// Server function: mints a LiveKit access token for a given room + identity.
// Runs server-side (Node in `vite dev`, Workers in production with the
// nodejs_compat flag set in wrangler.jsonc). LIVEKIT_* secrets never reach
// the browser.
export const issueLivekitToken = createServerFn({ method: "POST" })
  .inputValidator((data: IssueTokenInput) => {
    if (typeof data?.room !== "string" || data.room.trim().length === 0) {
      throw new Error("room is required");
    }
    if (typeof data?.identity !== "string" || data.identity.trim().length === 0) {
      throw new Error("identity is required");
    }
    if (data.room.length > 128 || data.identity.length > 128) {
      throw new Error("room and identity must be <= 128 chars");
    }
    return { room: data.room.trim(), identity: data.identity.trim() };
  })
  .handler(async ({ data }): Promise<IssueTokenResult | IssueTokenError> => {
    const url = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    // Treat the example placeholder values from .env.example as "not
    // configured" so a freshly-copied .env doesn't try (and fail) to connect.
    const hasPlaceholder =
      url === "wss://your-project.livekit.cloud" ||
      apiKey === "APIxxxxxxxxxxxx" ||
      apiSecret === "replace-with-the-long-secret-from-livekit-cloud" ||
      apiKey?.startsWith("APIxxx") ||
      apiSecret?.startsWith("replace-with");

    if (!url || !apiKey || !apiSecret || hasPlaceholder) {
      return {
        ok: false,
        reason: "not-configured",
        message:
          "LiveKit is not configured. Replace the placeholder values in ui/.env with credentials from https://cloud.livekit.io (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET) and restart `npm run dev`.",
      };
    }

    try {
      const { AccessToken } = await import("livekit-server-sdk");
      const at = new AccessToken(apiKey, apiSecret, {
        identity: data.identity,
        // 1-hour token; long enough for a hackathon demo, short enough to be safe.
        ttl: 60 * 60,
      });
      at.addGrant({
        roomJoin: true,
        room: data.room,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });

      const token = await at.toJwt();
      console.log(
        `[livekit] issued token  room="${data.room}"  identity="${data.identity}"`,
      );

      return { ok: true, token, url };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[livekit] failed to mint token:", message);
      return { ok: false, reason: "internal", message };
    }
  });
