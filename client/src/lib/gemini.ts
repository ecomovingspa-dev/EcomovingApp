/**
 * Servicio para interactuar con la API de Google Gemini (v1beta REST)
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL_NAME = "gemini-2.0-flash-exp";

export interface GeneratedContent {
  subject: string;
  part1: string;
  part2: string;
  social: string;
  html: string;
}

/**
 * Genera contenido de marketing basado en una imagen (URL o base64)
 */
export const generateMarketingContent = async (
  imageSource: string,
  prompt: string = ""
): Promise<GeneratedContent> => {
  if (!API_KEY) throw new Error("VITE_GEMINI_API_KEY no está configurada.");

  let base64Data = "";

  console.log("DEBUG IA: Procesando imagen ->", imageSource.substring(0, 100));

  try {
    // Usamos una regex más robusta para detectar URLs de Supabase o externas
    const isUrl = /^https?:\/\//i.test(imageSource);

    if (isUrl) {
      console.log("DEBUG IA: Detectada URL, convirtiendo...");
      const response = await fetch(imageSource, { mode: 'cors' });
      const blob = await response.blob();

      base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // El split es vital para que Gemini reciba solo la data purificada
          const pureBase64 = result.split(',')[1];
          if (!pureBase64) {
            reject(new Error("No se pudo extraer la base64 del blob"));
            return;
          }
          resolve(pureBase64);
        };
        reader.onerror = () => reject(new Error("Error al leer el blob de la imagen"));
        reader.readAsDataURL(blob);
      });
    } else {
      console.log("DEBUG IA: Detectada Base64 o data local");
      base64Data = imageSource.split(',')[1] || imageSource;
    }

    // VALIDACIÓN CRÍTICA: Si base64Data sigue siendo una URL, algo salió mal
    if (base64Data.startsWith('http')) {
      throw new Error("La conversión de imagen falló. Gemini no acepta URLs directas.");
    }

  } catch (err: any) {
    console.error("Error crítico procesando imagen para Gemini:", err);
    throw new Error("Error visual: No pudimos preparar la imagen para la IA. Detalle: " + err.message);
  }

  const defaultPrompt = `Analiza el producto en la imagen y genera copia de marketing profesional en ESPAÑOL.
Formatea tu respuesta exactamente de esta manera (sin usar Markdown ni asteriscos en las etiquetas):
SUBJECT: [Asunto llamativo]
PART1: [Párrafo introductorio sobre calidad y exclusividad]
PART2: [Llamado a la acción y cierre]
SOCIAL: [Caption para redes sociales con emojis]

Reglas:
- Tono profesional y elegante.
- Enfócate en los beneficios de estilo de vida.
- No menciones especificaciones técnicas a menos que sean visibles.`;

  const finalPrompt = prompt || defaultPrompt;

  const response = await fetch(`${BASE_URL}/${MODEL_NAME}:generateContent?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: finalPrompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Error al llamar a Gemini API");
  }

  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Parsear la respuesta estructurada
  const subjectMatch = text.match(/SUBJECT:\s*(.*)/i);
  const part1Match = text.match(/PART1:\s*([\s\S]*?)(?=PART2:|SOCIAL:|$)/i);
  const part2Match = text.match(/PART2:\s*([\s\S]*?)(?=SOCIAL:|$)/i);
  const socialMatch = text.match(/SOCIAL:\s*([\s\S]*)$/i);

  const subject = subjectMatch ? subjectMatch[1].trim() : "Exclusividad Ecomoving";
  const p1 = part1Match ? part1Match[1].trim() : "";
  const p2 = part2Match ? part2Match[1].trim() : "";
  const sc = socialMatch ? socialMatch[1].trim() : "";

  // Generar HTML profesional estilo Brevo para el email
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    .email-container { max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Arial, sans-serif; background-color: #ffffff; }
    .content-padding { padding: 40px 20px; }
    .footer { background-color: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6;">
  <div class="email-container">
    <div class="content-padding">
      <h1 style="color: #111827; font-size: 24px; font-weight: bold; margin-bottom: 24px; text-align: center;">${subject}</h1>
      
      <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 30px;">
        ${p1}
      </p>

      <div style="text-align: center; margin-bottom: 30px;">
        <img src="IMAGE_PLACEHOLDER" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);" alt="${subject}" />
      </div>

      <p style="font-size: 16px; line-height: 1.6; color: #374151; margin-bottom: 32px;">
        ${p2}
      </p>


    </div>
    
    <div class="footer">
      <p style="margin: 0 0 8px 0;"><strong>Ecomoving SpA</strong></p>
      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
        <p style="margin: 0;">Recibiste este correo porque estás en nuestra lista de contactos preferenciales.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return {
    subject,
    part1: p1,
    part2: p2,
    social: sc,
    html
  };
};
