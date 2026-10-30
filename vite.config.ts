import { defineConfig, loadEnv, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function devApiMiddleware(): Plugin {
  return {
    name: "ashmawy-dev-api-middleware",
    apply: "serve",
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), "");
      for (const [key, val] of Object.entries(env)) {
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || "";
        const pathname = rawUrl.split("?")[0] || "";
        if (pathname.startsWith("/api/")) {
          try {
            const { handleApiRequest } = await server.ssrLoadModule("/src/server/apiRouter.ts");
            const protocol = req.headers["x-forwarded-proto"] || "http";
            const host = req.headers.host || "localhost";
            const fullUrl = `${protocol}://${host}${rawUrl}`;

            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers)) {
              if (value !== undefined) {
                if (Array.isArray(value)) {
                  for (const v of value) headers.append(key, v);
                } else {
                  headers.set(key, value);
                }
              }
            }

            let body: any = null;
            if (req.method !== "GET" && req.method !== "HEAD") {
              const chunks: Buffer[] = [];
              for await (const chunk of req) chunks.push(chunk as Buffer);
              body = Buffer.concat(chunks);
            }

            const webReq = new Request(fullUrl, {
              method: req.method || "GET",
              headers,
              body,
            });

            const webRes: Response = await handleApiRequest(webReq);

            res.statusCode = webRes.status;
            webRes.headers.forEach((val, key) => {
              res.setHeader(key, val);
            });

            const arrayBuf = await webRes.arrayBuffer();
            res.end(Buffer.from(arrayBuf));
            return;
          } catch (err: any) {
            console.error("[devApiMiddleware] Error executing API request:", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ success: false, error: err?.message || "Internal server error" }));
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
    ],
    ignoreOutdatedRequests: true,
  },
  plugins: [
    devApiMiddleware(),
    tanstackStart({
      server: { entry: "server" },
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    command === "build"
      ? (nitro({
          preset: "vercel",
          node: true,
          rollupConfig: {
            external: [
              "firebase-admin",
              /^firebase-admin(\/.*)?$/,
              "@google-cloud/firestore",
              /^@google-cloud\/.*/,
            ],
          },
          rolldownConfig: {
            external: [
              "firebase-admin",
              /^firebase-admin(\/.*)?$/,
              "@google-cloud/firestore",
              /^@google-cloud\/.*/,
            ],
          },
          vercel: {
            entryFormat: "node",
          },
        }) as any)
      : null,
  ].filter(Boolean),
}));
