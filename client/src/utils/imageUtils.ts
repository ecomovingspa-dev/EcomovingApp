/**
 * Utilidad para procesar imágenes antes de subirlas
 * - Redimensiona a max 800px de ancho
 * - Comprime a <150KB
 */

export async function comprimirImagen(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Canvas para redimensionar
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("No se pudo crear contexto de canvas"));
          return;
        }

        // Calcular nuevas dimensiones (max 800px de ancho)
        let width = img.width;
        let height = img.height;
        const maxWidth = 800;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Dibujar imagen redimensionada
        ctx.drawImage(img, 0, 0, width, height);

        // Comprimir (empezar con calidad 0.8)
        let quality = 0.8;

        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Error al comprimir imagen"));
                return;
              }

              // Si es menor a 150KB, listo
              if (blob.size <= 150 * 1024) {
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                });
                resolve(compressedFile);
              } else if (quality > 0.3) {
                // Intentar con menor calidad
                quality -= 0.1;
                tryCompress();
              } else {
                // Ya no podemos comprimir más, devolver lo que tenemos
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                });
                resolve(compressedFile);
              }
            },
            "image/jpeg",
            quality,
          );
        };

        tryCompress();
      };

      img.onerror = () => reject(new Error("Error al cargar imagen"));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Error al leer archivo"));
    reader.readAsDataURL(file);
  });
}

/**
 * Convierte File a base64 para enviar a Gemini
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Formatea el tamaño de archivo
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
