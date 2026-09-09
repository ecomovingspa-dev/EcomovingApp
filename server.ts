import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

import uploadRenderHandler from "./api/upload-render";
import renderImageHandler from "./api/render-image";
import importAiHandler from "./api/marketing/import-ai";
import enrichAccountsHandler from "./api/enrich-accounts";
import syncBrevoHandler from "./api/sync-brevo";
import sentinelPixelHandler from "./api/sentinel-pixel";
import sendCortesiaHandler from "./api/send-cortesia";
import sendTestProspeccionHandler from "./api/send-test-prospeccion";
import sendTestHandler from "./api/send-test";
import cronDailyHandler from "./api/cron-daily";
import sendTestCobranzaHandler from "./api/send-test-cobranza";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Routes
  const routes: { path: string; handler: (req: any, res: any) => Promise<any> | any }[] = [
    { path: "/api/upload-render", handler: uploadRenderHandler },
    { path: "/api/render-image", handler: renderImageHandler },
    { path: "/api/marketing/import-ai", handler: importAiHandler },
    { path: "/api/enrich-accounts", handler: enrichAccountsHandler },
    { path: "/api/sync-brevo", handler: syncBrevoHandler },
    { path: "/api/sentinel-pixel", handler: sentinelPixelHandler },
    { path: "/api/send-cortesia", handler: sendCortesiaHandler },
    { path: "/api/send-test-prospeccion", handler: sendTestProspeccionHandler },
    { path: "/api/send-test", handler: sendTestHandler },
    { path: "/api/cron-daily", handler: cronDailyHandler },
    { path: "/api/send-test-cobranza", handler: sendTestCobranzaHandler },
  ];

  for (const route of routes) {
    app.all(route.path, async (req, res) => {
      try {
        await route.handler(req, res);
      } catch (err: any) {
        console.error(`Error in ${route.path}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: err.message || "Internal server error" });
        }
      }
    });
  }

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
