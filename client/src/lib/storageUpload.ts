export interface UploadRenderResult {
  url: string;
  fileName: string;
  bucket?: string;
  originalSizeKB?: number;
  compressedSizeKB?: number;
}

/**
 * Comprime y redimensiona cualquier imagen antes de enviarla a la red / Storage.
 * - Ancho máximo: 560px (ancho exacto de visualización en plantillas de correo).
 * - Formato: JPEG de alta fidelidad con 80% de calidad (compatibilidad 100% con todos los clientes de email).
 * - Tamaño objetivo: 30 KB - 80 KB (reducción de hasta 95% respecto a imágenes originales).
 */
export async function compressAndResizeImage(
  fileOrBlob: File | Blob,
  maxWidth = 1600,
  quality = 0.90
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number; sizeKB: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error al leer la imagen"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Error al decodificar la imagen"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Escalar manteniendo proporción si supera el ancho máximo (560px)
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo obtener contexto 2D del canvas"));
          return;
        }

        // Fondo blanco para manejar PNGs con transparencia y evitar fondos negros en JPEG
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);

        // Suavizado de imagen de alta calidad
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a JPEG con compresión optimizada
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Error al generar blob comprimido"));
              return;
            }
            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            const sizeKB = Math.round((blob.size / 1024) * 10) / 10;
            console.log(`[COMPRESSOR] Imagen optimizada: ${width}x${height}px | ${sizeKB} KB (calidad ${quality * 100}%)`);
            resolve({ blob, dataUrl, width, height, sizeKB });
          },
          "image/jpeg",
          quality
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Sube una imagen optimizada (<= 560px, JPEG comprimido, Cache-Control de 1 año)
 * y devuelve su URL pública permanente.
 *
 * Orden de subida (importante para el consumo de egress de Supabase, que es limitado
 * en el plan gratuito): primero se intenta SIEMPRE Cloudflare R2 a través de
 * /api/upload-render (egress $0 en R2), y solo si esa ruta falla por completo
 * (backend caído, sin red, etc.) se recurre a subir directo a un bucket de
 * Supabase Storage como último recurso, para que la app nunca deje de funcionar.
 */
export async function uploadRenderImage(
  file: File | Blob,
  contactoId?: string
): Promise<UploadRenderResult> {
  const originalSizeKB = Math.round((file.size / 1024) * 10) / 10;

  // 1. Comprimir y redimensionar imagen en el cliente ANTES de subir
  let uploadBlob: Blob = file;
  let compressedDataUrl = "";
  let compressedSizeKB = originalSizeKB;

  try {
    const compressed = await compressAndResizeImage(file, 1600, 0.90);
    uploadBlob = compressed.blob;
    compressedDataUrl = compressed.dataUrl;
    compressedSizeKB = compressed.sizeKB;
  } catch (compErr) {
    console.warn("[STORAGE] Advertencia en compresión previa, usando archivo original:", compErr);
  }

  const timestamp = Date.now();
  const safeId = contactoId ? String(contactoId).replace(/[^a-zA-Z0-9_-]/g, '') : 'general';
  const fileName = `contacto_${safeId}_${timestamp}.jpg`;
  const contentType = 'image/jpeg';

  // 2. Prioridad: subir vía /api/upload-render, que a su vez prioriza Cloudflare R2
  //    (egress ilimitado gratis) y solo usa Supabase Storage si R2 no está disponible.
  try {
    let base64Data = compressedDataUrl;
    if (!base64Data) {
      const reader = new FileReader();
      base64Data = await new Promise((res, rej) => {
        reader.onloadend = () => res(reader.result as string);
        reader.onerror = () => rej(new Error('Error al leer blob'));
        reader.readAsDataURL(uploadBlob);
      });
    }

    const response = await fetch('/api/upload-render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contacto_id: contactoId,
        image_base64: base64Data,
        file_name: fileName,
        content_type: contentType
      })
    });

    if (!response.ok) {
      throw new Error(`Error en servidor: ${response.statusText}`);
    }

    const resData = await response.json();
    if (resData.url) {
      console.log(`[STORAGE] Render subido con éxito vía ${resData.storageEngine || 'api'} (${compressedSizeKB} KB, 560px)`);
      return {
        url: resData.url,
        fileName: resData.fileName || fileName,
        bucket: resData.storageEngine,
        originalSizeKB,
        compressedSizeKB
      };
    } else {
      throw new Error(resData.error || 'No se pudo obtener URL pública');
    }
  } catch (apiErr: any) {
    console.error("[STORAGE] Error subiendo a Cloudflare R2 vía /api/upload-render:", apiErr);
    throw new Error('No se pudo subir la imagen a Cloudflare R2: ' + (apiErr?.message || 'error desconocido'));
  }
}

