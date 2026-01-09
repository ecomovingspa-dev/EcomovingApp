import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// En producción, Replit define process.env.PORT=5000
const PORT = parseInt(process.env.PORT || "5000", 10); // Asegurar que sea número

app.use(express.json({ limit: "10mb" }));

// Servir archivos estáticos de production
const publicPath = path.resolve(__dirname, "../dist/public");
app.use(
  express.static(publicPath, {
    maxAge: "1d",
  }),
);

// Ruta fallback para SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Algo salió mal.");
});

// Iniciar servidor con manejo de errores
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor listo en puerto ${PORT}`);
});

// Manejo de error si el puerto está en uso
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`❌ Error: Puerto ${PORT} ya está en uso`);
    console.log("Intentando con puerto alternativo...");

    // Intentar con un puerto diferente
    const alternativePort = PORT + 1;
    app.listen(alternativePort, "0.0.0.0", () => {
      console.log(`✅ Servidor listo en puerto alternativo ${alternativePort}`);
    });
  } else {
    console.error("❌ Error al iniciar servidor:", err);
    process.exit(1);
  }
});

// Manejo de cierre graceful
process.on("SIGTERM", () => {
  console.log("SIGTERM recibido, cerrando servidor...");
  server.close(() => {
    console.log("Servidor cerrado correctamente");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT recibido, cerrando servidor...");
  server.close(() => {
    console.log("Servidor cerrado correctamente");
    process.exit(0);
  });
});
