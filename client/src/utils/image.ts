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
