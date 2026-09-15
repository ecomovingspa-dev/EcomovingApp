import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  const apiRoutes = [
    { path: "/api/upload-render", file: "./api/upload-render.ts" },
    { path: "/api/render-image", file: "./api/render-image.ts" },
    { path: "/api/marketing/import-ai", file: "./api/marketing/import-ai.ts" },
    { path: "/api/enrich-accounts", file: "./api/enrich-accounts.ts" },
    { path: "/api/sync-brevo", file: "./api/sync-brevo.ts" },
    { path: "/api/sentinel-pixel", file: "./api/sentinel-pixel.ts" },
    { path: "/api/send-cortesia", file: "./api/send-cortesia.ts" },
    { path: "/api/send-test-prospeccion", file: "./api/send-test-prospeccion.ts" },
    { path: "/api/send-test", file: "./api/send-test.ts" },
    { path: "/api/cron-daily", file: "./api/cron-daily.ts" },
    { path: "/api/send-test-cobranza", file: "./api/send-test-cobranza.ts" },
  ];

  for (const route of apiRoutes) {
    app.all(route.path, async (req, res) => {
      try {
        const module = await import(route.file);
        const handler = module.default;
        await handler(req, res);
      } catch (err: any) {
        console.error(`Error in ${route.path}:`, err);
        res.status(500).json({ error: err.message });
      }
    });
  }
  
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
