/**
 * Servicio para interactuar con Gemini API
 */
const GEMINI_API_KEY = "AIzaSyANy1lc4pJU0YhaS_fL1N2JNfHJHK2F15E";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.0-flash:generateContent";

interface GeminiResponse {
  asunto: string;
  cuerpo_html: string;
  descripcion: string;
}

/**
 * Genera contenido de email a partir de una imagen
 */
export async function generarContenidoEmail(
  imagenBase64: string,
  numeroSecuencia: number,
): Promise<GeminiResponse> {
  const prompt = `Eres un experto en marketing para Ecomoving SpA, empresa chilena de personalización de artículos corporativos.

CONTEXTO ECOMOVING:
- Productos: mugs, termos, textiles, tecnología, escritorio, bolsas
- Técnicas: grabado láser, serigrafía, DTF textil/UV, impresión directa
- Clientes: empresas, universidades, instituciones, eventos
- Propuesta de valor: calidad premium, desde 1 unidad, entrega rápida en Chile

Analiza esta imagen de un producto personalizado (es la imagen #${numeroSecuencia} de nuestra campaña) y genera contenido para email marketing B2B.

GENERA EN FORMATO JSON VÁLIDO:
{
  "asunto": "máximo 60 caracteres, atractivo, menciona el producto o industria target",
  "cuerpo_html": "email HTML profesional que incluye: saludo con {{nombre}}, descripción del producto visible en imagen, 3 beneficios máximo en lista HTML, mención de técnica de personalización usada, CTA suave ('¿Conversamos sobre tu proyecto?'), firma 'Equipo Ecomoving'. Incluye <img src='{{imagen_url}}' alt='Producto personalizado' style='max-width:100%; height:auto; margin:20px 0;' /> donde debe ir la imagen",
  "descripcion": "breve descripción de 1-2 líneas de lo que ves en la imagen"
}

IMPORTANTE:
- Tono: profesional B2B pero cercano y consultivo
- NO seas agresivo en ventas, ofrece valor y consultoría
- El cuerpo_html debe ser HTML válido con estilos inline
- Incluye el placeholder {{nombre}} para personalizar
- Incluye el placeholder {{imagen_url}} para la imagen
- La imagen debe estar centrada y responsive
- Responde SOLO con el JSON, sin texto adicional antes o después`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imagenBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Error de Gemini API: ${response.statusText}`);
    }

    const data = await response.json();

    // Extraer el texto de la respuesta
    const textoRespuesta = data.candidates[0].content.parts[0].text;

    // Limpiar el texto (quitar ```json si existe)
    const jsonLimpio = textoRespuesta
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    // Parsear JSON
    const contenido = JSON.parse(jsonLimpio);

    return {
      asunto: contenido.asunto || "Descubre nuestros productos personalizados",
      cuerpo_html: contenido.cuerpo_html || "<p>Contenido generado por IA</p>",
      descripcion: contenido.descripcion || "Producto personalizado",
    };
  } catch (error) {
    console.error("Error al generar contenido:", error);
    throw new Error(
      "No se pudo generar el contenido con IA. Por favor, intenta de nuevo.",
    );
  }
}
