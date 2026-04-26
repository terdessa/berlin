// Lovable's @lovable.dev/vite-tanstack-config already wires up tanstackStart,
// viteReact, tailwindcss, tsConfigPaths, the Cloudflare build plugin, the @
// alias, React/TanStack dedupe, and dev-server host/port. Don't add those
// manually; pass extras via `plugins` (Vite plugins) and `vite` (Vite config).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import selfsigned from "selfsigned";
import { loadEnv, type Plugin, type ViteDevServer } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Hoist the repository-root .env into process.env so server functions (e.g.
// `src/lib/livekit-token.ts`) can read LIVEKIT_* secrets at request time.
// Vite's loadEnv normally only exposes VITE_-prefixed values to the client;
// here we keep them server-side by writing them straight to process.env.
{
  const mode = process.env.NODE_ENV ?? "development";
  const env = loadEnv(mode, repoRoot, "");
  const nodeTlsEnvKeys = new Set([
    "NODE_EXTRA_CA_CERTS",
    "NODE_TLS_REJECT_UNAUTHORIZED",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
  ]);
  for (const [key, value] of Object.entries(env)) {
    if (nodeTlsEnvKeys.has(key)) continue;
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function getDevHttpsCert() {
  const cacheDir = resolve(__dirname, "node_modules/.cache/sentinel-dev-cert");
  const keyPath = resolve(cacheDir, "key.pem");
  const certPath = resolve(cacheDir, "cert.pem");

  if (existsSync(keyPath) && existsSync(certPath)) {
    return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
  }

  // selfsigned v5 returns a Promise.
  const pems = await selfsigned.generate([{ name: "commonName", value: "sentinel.local" }], {
    keySize: 2048,
    algorithm: "sha256",
  });

  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(keyPath, pems.private);
  writeFileSync(certPath, pems.cert);

  return { key: pems.private, cert: pems.cert };
}

const useHttps = process.env.SENTINEL_DEV_HTTP !== "1";
const devHttpsCert = useHttps ? await getDevHttpsCert() : undefined;

function getLanIPv4Addrs() {
  const out: { name: string; ip: string }[] = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        out.push({ name, ip: addr.address });
      }
    }
  }
  return out;
}

function printSentinelLinksPlugin(): Plugin {
  return {
    name: "sentinel-print-links",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      server.httpServer?.once("listening", () => {
        // Defer briefly so this banner prints AFTER Vite's own `Local/Network` lines.
        setTimeout(() => {
          const addr = server.httpServer?.address();
          const port =
            typeof addr === "object" && addr ? addr.port : (server.config.server.port ?? 8080);
          const proto = server.config.server.https ? "https" : "http";

          const lan = getLanIPv4Addrs();
          const sections = [
            { name: "HOME (dashboard + walkie-talkie)", path: "/" },
            { name: "METRICS (SAIS dashboard)", path: "/metrics" },
          ];

          type Line = { who: string; url: string; label: string };
          const lines: Line[] = [];
          for (const s of sections) {
            lines.push({
              who: s.name,
              url: `${proto}://localhost:${port}${s.path}`,
              label: "laptop",
            });
            for (const { name, ip } of lan) {
              lines.push({
                who: "  -> phone",
                url: `${proto}://${ip}:${port}${s.path}`,
                label: name,
              });
            }
          }

          const w0 = Math.max(...lines.map((l) => l.who.length), 26);
          const w1 = Math.max(...lines.map((l) => l.url.length), 30);
          const w2 = Math.max(...lines.map((l) => l.label.length), 6);
          const total = w0 + w1 + w2 + 8;
          const bar = "+" + "-".repeat(total) + "+";
          const center = (s: string, w: number) => {
            const left = Math.max(0, Math.floor((w - s.length) / 2));
            return " ".repeat(left) + s + " ".repeat(Math.max(0, w - s.length - left));
          };

          const out: string[] = [];
          out.push("");
          out.push(bar);
          out.push("|" + center("SENTINEL  -  open these URLs in a browser", total) + "|");
          out.push(bar);
          for (const l of lines) {
            out.push(
              "|  " +
                l.who.padEnd(w0) +
                "  " +
                l.url.padEnd(w1) +
                "  " +
                l.label.padEnd(w2) +
                "  |",
            );
          }
          out.push(bar);

          if (proto === "https") {
            out.push("");
            out.push("  Phone tip: accept the self-signed certificate warning the first time.");
            out.push(
              "  The cert is cached in node_modules/.cache/sentinel-dev-cert, so the warning",
            );
            out.push("  won't reappear on restart unless you wipe node_modules.");
          }

          out.push("");
          out.push("  Backend wiring (LiveKit voice + Gemini analysis) is intentionally absent.");
          out.push("  The dashboard renders cameras and the metrics page only.");
          out.push("");
          // server.config.logger.info preserves Vite's formatting/clearing behaviour.
          server.config.logger.info(out.join("\n"));
        }, 120);
      });
    },
  };
}

export default defineConfig({
  plugins: [printSentinelLinksPlugin()],
  vite: {
    envDir: repoRoot,
    server: {
      // HTTPS is required for navigator.mediaDevices.getUserMedia() on phones
      // when accessed via LAN IP (any non-localhost origin).
      https: devHttpsCert,
    },
  },
});
