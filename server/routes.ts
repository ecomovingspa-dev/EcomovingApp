import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import multer from "multer";
import { supabase } from "./lib/supabase";

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    const uploadPath = path.join(process.cwd(), "data", "sheets");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (_req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

const palabrasClave = [
  "agendas",
  "alfombrilla mouse",
  "articulo de publicidad",
  "bananobilletero",
  "boligrafo",
  "bolsa",
  "bolsa ecologica",
  "bolso",
  "botella",
  "caramayola",
  "carpeta",
  "chapita",
  "cooler",
  "corporativo",
  "credencial",
  "cuaderno",
  "destacador",
  "dia de la madre",
  "dia del padre",
  "dia del trabajo",
  "ecologica",
  "ecologico",
  "estuche",
  "galvano",
  "gorro",
  "gorro legionario",
  "gorro pescador",
  "impresion",
  "jockey",
  "lanyard",
  "lapices",
  "libreta",
  "linterna",
  "llavero",
  "logo",
  "lonchera",
  "mancuernas",
  "mat yoga",
  "memo set",
  "mochila",
  "morral",
  "mouse pad",
  "mug",
  "neveras",
  "pad mouse",
  "paragua",
  "parlantes",
  "pendrive",
  "personalizado",
  "pesa muñequera",
  "pesa tobillera",
  "polera",
  "porta credencial",
  "portacredencial",
  "power bank",
  "premiacion",
  "promocion",
  "promocional",
  "quitasol",
  "regalo publicitario",
  "reutilizable",
  "taza",
  "tazon",
  "tazones",
  "termico",
  "vaso",
  "vaso termico",
  "volantes",
];

export function registerRoutes(_httpServer: any, app: any) {
  app.post(
    "/upload-oportunidades",
    upload.single("file"),
    async (req: any, res: any) => {
      try {
        if (!req.file) {
          return res
            .status(400)
            .json({ ok: false, error: "No se recibió ningún archivo" });
        }

        console.log("📤 Archivo subido:", req.file.filename);

        const fileBuffer = fs.readFileSync(req.file.path);
        const workbook = XLSX.read(fileBuffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        console.log(`📊 Archivo contiene ${data.length} filas`);

        if (data.length === 0) {
          return res.json({
            ok: true,
            insertadas: 0,
            mensaje: "El archivo está vacío",
            data: [],
          });
        }

        const oportunidadesTemp = data.map((row: any) => {
          const estado = row["Estado"] || row["estado"] || "";
          if (!estado.toLowerCase().includes("publicada")) return null;

          const nombre = (row["Nombre"] || row["nombre"] || "").toLowerCase();
          const organismo = (
            row["Organismo"] ||
            row["Institución"] ||
            row["organismo"] ||
            ""
          ).toLowerCase();
          const texto = `${nombre} ${organismo}`;

          const palabrasEncontradas = palabrasClave.filter((p) =>
            texto.includes(p.toLowerCase()),
          );
          if (palabrasEncontradas.length === 0) return null;

          const estipoUno = "Unidad de compra" in row || "Institución" in row;

          return {
            id: row["ID"] || row["id"],
            nombre: row["Nombre"] || row["nombre"],
            fecha_publicacion: formatDate(
              row["Fecha de publicación"] || row["Fecha de Publicación"],
            ),
            fecha_cierre: formatDateTime(
              row["Fecha de cierre"] || row["Fecha de Cierre"],
            ),
            organismo:
              row["Organismo"] || row["Institución"] || row["organismo"],
            unidad: estipoUno ? row["Unidad de compra"] || null : null,
            monto_disponible:
              parseFloat(
                String(
                  row["Monto Disponible"] || row["Presupuesto estimado"] || "0",
                ).replace(/[^0-9.-]/g, ""),
              ) || null,
            moneda: row["Tipo Moneda"] || row["moneda"] || "CLP",
            estado: row["Estado"] || row["estado"],
            clave: palabrasEncontradas.join(", "),
            vendedor_id: null,
          };
        });

        const oportunidades = oportunidadesTemp.filter((op) => op !== null);
        console.log(`✅ Filtradas: ${oportunidades.length} oportunidades`);

        if (oportunidades.length === 0) {
          return res.json({
            ok: true,
            insertadas: 0,
            mensaje:
              "No se encontraron oportunidades que coincidan con los filtros",
            data: [],
          });
        }

        const idsExistentes = oportunidades
          .map((op: any) => op.id)
          .filter(Boolean);
        const { data: existentes } = await supabase
          .from("oportunidades")
          .select("id")
          .in("id", idsExistentes);
        const idsYaExistentes = new Set(
          existentes?.map((op: any) => op.id) || [],
        );
        const oportunidadesNuevas = oportunidades.filter(
          (op: any) => !idsYaExistentes.has(op.id),
        );

        console.log(`🆕 Nuevas: ${oportunidadesNuevas.length}`);

        if (oportunidadesNuevas.length > 0) {
          const { error } = await supabase
            .from("oportunidades")
            .insert(oportunidadesNuevas);
          if (error) {
            console.error("❌ Error insertando:", error.message);
            return res.status(500).json({
              ok: false,
              error: "Error al insertar: " + error.message,
            });
          }
          console.log(`✅ ${oportunidadesNuevas.length} insertadas`);
        }

        return res.json({
          ok: true,
          insertadas: oportunidadesNuevas.length,
          data: oportunidadesNuevas,
        });
      } catch (error) {
        console.error("❌ Error procesando archivo:", error);
        return res.status(500).json({
          ok: false,
          error: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    },
  );

  app.post("/process-oportunidades", async (_req, res) => {
    try {
      const basePath = path.join(process.cwd(), "data", "sheets");
      if (!fs.existsSync(basePath)) {
        return res
          .status(400)
          .json({ ok: false, error: "Carpeta data/sheets no existe" });
      }

      const files = fs
        .readdirSync(basePath)
        .filter((f) => f.endsWith(".xlsx") || f.endsWith(".xls"));
      if (files.length === 0) {
        return res.json({
          ok: true,
          insertadas: 0,
          mensaje: "No hay archivos para procesar",
        });
      }

      let totalInsertadas = 0;
      console.log(
        `📋 Filtrado configurado con ${palabrasClave.length} palabras clave`,
      );

      for (const file of files) {
        const filePath = path.join(basePath, file);
        console.log("📄 Procesando:", file);

        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: "buffer" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet);

        if (data.length === 0) {
          console.log("⚠️ Archivo vacío:", file);
          continue;
        }

        const oportunidadesTemp = data.map((row: any) => {
          const estado = row["Estado"] || row["estado"] || "";
          if (!estado.toLowerCase().includes("publicada")) return null;

          const nombre = (row["Nombre"] || row["nombre"] || "").toLowerCase();
          const organismo = (
            row["Organismo"] ||
            row["Institución"] ||
            row["organismo"] ||
            ""
          ).toLowerCase();
          const texto = `${nombre} ${organismo}`;

          const palabrasEncontradas = palabrasClave.filter((p) =>
            texto.includes(p.toLowerCase()),
          );
          if (palabrasEncontradas.length === 0) return null;

          const estipoUno = "Unidad de compra" in row || "Institución" in row;

          return {
            id: row["ID"] || row["id"],
            nombre: row["Nombre"] || row["nombre"],
            fecha_publicacion: formatDate(
              row["Fecha de publicación"] || row["Fecha de Publicación"],
            ),
            fecha_cierre: formatDateTime(
              row["Fecha de cierre"] || row["Fecha de Cierre"],
            ),
            organismo:
              row["Organismo"] || row["Institución"] || row["organismo"],
            unidad: estipoUno ? row["Unidad de compra"] || null : null,
            monto_disponible:
              parseFloat(
                String(
                  row["Monto Disponible"] || row["Presupuesto estimado"] || "0",
                ).replace(/[^0-9.-]/g, ""),
              ) || null,
            moneda: row["Tipo Moneda"] || row["moneda"] || "CLP",
            estado: row["Estado"] || row["estado"],
            clave: palabrasEncontradas.join(", "),
            vendedor_id: null,
          };
        });

        const oportunidades = oportunidadesTemp.filter((op) => op !== null);
        if (oportunidades.length === 0) {
          console.log("⚠️ Sin oportunidades válidas:", file);
          continue;
        }

        const idsExistentes = oportunidades
          .map((op: any) => op.id)
          .filter(Boolean);
        const { data: existentes } = await supabase
          .from("oportunidades")
          .select("id")
          .in("id", idsExistentes);
        const idsYaExistentes = new Set(
          existentes?.map((op: any) => op.id) || [],
        );
        const oportunidadesNuevas = oportunidades.filter(
          (op: any) => !idsYaExistentes.has(op.id),
        );

        console.log(
          `📊 Total: ${data.length}, Filtradas: ${oportunidades.length}, Nuevas: ${oportunidadesNuevas.length}`,
        );

        if (oportunidadesNuevas.length > 0) {
          const { error } = await supabase
            .from("oportunidades")
            .insert(oportunidadesNuevas);
          if (error) {
            console.error(`❌ Error insertando desde ${file}:`, error.message);
            continue;
          }
          totalInsertadas += oportunidadesNuevas.length;
          console.log(
            `✅ ${oportunidadesNuevas.length} oportunidades insertadas`,
          );
        }
      }

      return res.json({ ok: true, insertadas: totalInsertadas });
    } catch (error) {
      console.error("❌ Error proceso oportunidades:", error);
      return res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  });
}

function formatDate(fecha: any): string | null {
  if (!fecha) return null;
  try {
    if (typeof fecha === "number") {
      const date = XLSX.SSF.parse_date_code(fecha);
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    }
    if (fecha instanceof Date) {
      return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
    }
    if (typeof fecha === "string") {
      const fechaLimpia = fecha.split(" ")[0];
      let partes: string[] = [];
      if (fechaLimpia.includes("/")) partes = fechaLimpia.split("/");
      else if (fechaLimpia.includes("-")) partes = fechaLimpia.split("-");

      if (partes.length === 3) {
        const [p1, p2, p3] = partes;
        if (parseInt(p1) > 31)
          return `${p1}-${p2.padStart(2, "0")}-${p3.padStart(2, "0")}`;
        if (parseInt(p3) > 31)
          return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
        return `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
      }

      const parsed = new Date(fecha);
      if (!isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
      }
    }
    return null;
  } catch (error) {
    console.error("❌ Error parseando fecha:", fecha, error);
    return null;
  }
}

function formatDateTime(fecha: any): string | null {
  if (!fecha) return null;
  try {
    // Si es número de Excel (días desde 1900)
    if (typeof fecha === "number") {
      const date = XLSX.SSF.parse_date_code(fecha);
      const hours = Math.floor((fecha - Math.floor(fecha)) * 24);
      const minutes = Math.floor(
        ((fecha - Math.floor(fecha)) * 24 - hours) * 60,
      );
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")} ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
    }

    // Si es Date object
    if (fecha instanceof Date) {
      return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")} ${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}:00`;
    }

    // Si es string con formato "DD/MM/YYYY HH:MM" o "YYYY-MM-DD HH:MM"
    if (typeof fecha === "string") {
      const partes = fecha.trim().split(" ");
      const fechaParte = partes[0];
      const horaParte = partes[1] || "00:00";

      // Parsear fecha
      let fechaFormateada = null;
      let partesF: string[] = [];

      if (fechaParte.includes("/")) partesF = fechaParte.split("/");
      else if (fechaParte.includes("-")) partesF = fechaParte.split("-");

      if (partesF.length === 3) {
        const [p1, p2, p3] = partesF;
        if (parseInt(p1) > 31) {
          // YYYY-MM-DD
          fechaFormateada = `${p1}-${p2.padStart(2, "0")}-${p3.padStart(2, "0")}`;
        } else if (parseInt(p3) > 31) {
          // DD-MM-YYYY
          fechaFormateada = `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
        } else {
          // Asumir DD-MM-YYYY
          fechaFormateada = `${p3}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
        }
      }

      // Parsear hora
      const horaPartes = horaParte.split(":");
      const horas = horaPartes[0] ? horaPartes[0].padStart(2, "0") : "00";
      const minutos = horaPartes[1] ? horaPartes[1].padStart(2, "0") : "00";

      if (fechaFormateada) {
        return `${fechaFormateada} ${horas}:${minutos}:00`;
      }

      // Intento general con Date
      const parsed = new Date(fecha);
      if (!isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")} ${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}:00`;
      }
    }
    return null;
  } catch (error) {
    console.error("❌ Error parseando fecha/hora:", fecha, error);
    return null;
  }
}
