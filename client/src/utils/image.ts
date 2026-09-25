/**
 * Utilidades para procesamiento de imágenes en el cliente
 */

/**
 * Optimiza una imagen base64 reduciendo su calidad y tamaño si es necesario
 */
export const optimizeImage = async (base64Str: string, maxSizeByte: number = 500000): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Mantener proporciones pero limitar tamaño máximo si es descomunal
            const maxDim = 1200;
            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = (height / width) * maxDim;
                    width = maxDim;
                } else {
                    width = (width / height) * maxDim;
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject("No se pudo obtener el contexto del canvas");

            ctx.drawImage(img, 0, 0, width, height);

            // Iterar reduciendo calidad hasta estar bajo el límite
            let quality = 0.9;
            let result = canvas.toDataURL('image/jpeg', quality);

            while (result.length > maxSizeByte * 1.3 && quality > 0.1) {
                quality -= 0.1;
                result = canvas.toDataURL('image/jpeg', quality);
            }

            resolve(result);
        };
        img.onerror = reject;
    });
};

/**
 * Descarga una imagen pública (por ej. Cloudflare R2) y la convierte a data URL (base64),
 * comprimiéndola para que quede liviana. Pensado para incrustar imágenes directamente en el
 * HTML de un correo (Zoho Mail), evitando que el correo dependa de cargar una imagen remota.
 *
 * No usa Supabase: la descarga es un fetch directo a la URL pública (R2), sin pasar por
 * ningún endpoint propio ni base de datos. maxSizeByte acota el peso final del correo.
 */
export const fetchImageAsEmailDataUrl = async (
    url: string,
    maxSizeByte: number = 220000
): Promise<string | null> => {
    if (!url) return null;
    // Si ya es un data URL, solo se optimiza (por si viene sin comprimir).
    if (url.startsWith("data:")) {
        try {
            return await optimizeImage(url, maxSizeByte);
        } catch (e) {
            console.warn("No se pudo optimizar data URL existente:", e);
            return url;
        }
    }
    try {
        const blob = await fetch(url, { mode: "cors" }).then((r) => {
            if (!r.ok) throw new Error(String(r.status));
            return r.blob();
        });
        const rawDataUrl = await new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onloadend = () => resolve(fr.result as string);
            fr.onerror = reject;
            fr.readAsDataURL(blob);
        });
        return await optimizeImage(rawDataUrl, maxSizeByte);
    } catch (e) {
        console.warn("No se pudo descargar/convertir imagen a base64 para el correo:", url, e);
        return null;
    }
};
