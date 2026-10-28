// @lovable.dev/vite-tanstack-config already includes the following - do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

function devApiMiddleware(): Plugin {
  return {
    name: "ashmawy-dev-api-middleware",
    apply: "serve",
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

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper and API router).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro: {
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
  },
  vite: {
    plugins: [devApiMiddleware()],
  },
});

