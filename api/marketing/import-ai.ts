import { getSupabase } from '../utils/supabase';

const AUTH_TOKEN = "Ecomoving_AI_2026"; // Simple pero efectivo para tu uso personal

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${AUTH_TOKEN}`) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        const supabase = getSupabase();
        const { asunto, contenido, imagen_url } = req.body;

        if (!asunto || !contenido) {
            return res.status(400).json({ error: 'Faltan campos obligatorios (asunto, contenido)' });
        }

        // Calcular el siguiente número de envío
        const { data: ultimos } = await supabase
            .from('marketing')
            .select('nombre_envio')
            .order('nombre_envio', { ascending: false })
            .limit(1);

        const siguienteEnvio = ultimos && ultimos.length > 0 ? ultimos[0].nombre_envio + 1 : 1;
        const timestamp = Date.now();
        const nombreImagen = imagen_url ? null : `MKT-${timestamp}.jpg`; // Si no hay URL, reservamos nombre

        // Generar el HTML automáticamente (usamos el mismo bloque de ListaContenidos)
        const lineas = contenido.split('\n').filter((l: string) => l.trim() !== '');
        const titulo = lineas[0] || "ECOMOVING";
        const resto = lineas.slice(1).join('<br><br>');
        
        const finalImagenUrl = imagen_url || `https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/imagenes-marketing/${nombreImagen}`;

        const cuerpo_html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;700;900&display=swap');
        body { margin: 0; padding: 0; background-color: #f9f9f9; font-family: 'Outfit', sans-serif; color: #1a1a1a; }
        .wrapper { width: 100%; background-color: #f9f9f9; padding: 40px 0; }
        .main-container { width: 700px; background-color: #ffffff; border: 1px solid #eeeeee; border-radius: 8px; margin: 0 auto; }
        .h1 { font-size: 26px; font-weight: 800; line-height: 1.2; text-align: center; color: #000000; text-transform: uppercase; margin: 50px 0; }
        .p { font-size: 19px; line-height: 1.6; color: #333333; font-weight: 300; text-align: center; margin: 0 60px 50px; }
        .footer { padding: 50px; background-color: #fafafa; border-top: 1px solid #f0f0f0; text-align: center; font-size: 15px; color: #999999; }
    </style>
</head>
<body>
    <center class="wrapper">
        <table class="main-container" width="700" border="0" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding: 50px 0;">
                <img src="https://xgdmyjzyejjmwdqkufhp.supabase.co/storage/v1/object/public/logo_ecomoving/Logo_horizontal.png" alt="Ecomoving" width="200" />
            </td></tr>
            <tr><td align="center"><h1 class="h1">${titulo}</h1></td></tr>
            <tr><td align="center" style="padding-bottom: 50px;">
                <img src="${finalImagenUrl}" alt="Contenido" width="550" style="width: 550px; display: block; border-radius: 4px;" />
            </td></tr>
            <tr><td align="center"><p class="p">${resto}</p></td></tr>
            <tr><td align="center" style="padding-bottom: 50px;">
                <table style="background-color: #000000;">
                    <tr><td style="padding: 12px 40px;">
                        <a href="https://www.ecomoving.cl" style="color: #ffffff; text-decoration: none; font-weight: 900; text-transform: uppercase; letter-spacing: 3px;">EXPLORAR PORTAFOLIO</a>
                    </td></tr>
                </table>
            </td></tr>
            <tr><td class="footer">ECOMOVING SPA &bull; SANTIAGO, CHILE</td></tr>
        </table>
    </center>
</body>
</html>`;

        const { data, error } = await supabase
            .from('marketing')
            .insert([{
                asunto,
                cuerpo: contenido,
                cuerpo_html,
                imagen_url: finalImagenUrl,
                nombre_imagen: nombreImagen,
                nombre_envio: siguienteEnvio,
                estado: 'en revisión',
                activo: true
            }])
            .select();

        if (error) throw error;

        return res.status(200).json({ 
            success: true, 
            message: 'Contenido importado con éxito',
            data: data[0]
        });

    } catch (err: any) {
        return res.status(500).json({ error: err.message });
    }
}
