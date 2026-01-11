import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // 1. Validar seguridad (Key en la URL)
  const { key } = req.query;
  
  if (key !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  // 2. Inicializar Supabase con Service Role para poder editar logs
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // 3. Buscar contactos que deban recibir correo hoy (o que nunca hayan recibido)
    const { data: contactos, error: errorContactos } = await supabase
      .from('contactos')
      .select('*')
      .eq('estado', 'activo')
      .or(`proximo_envio.lte.${new Date().toISOString().split('T')[0]},proximo_envio.is.null`)
      .limit(5); // Prueba pequeña inicial

    if (errorContactos) throw errorContactos;

    const resultados = [];

    // 4. Vincular con la tabla marketing por secuencia
    for (const contacto of contactos) {
      const { data: contenido } = await supabase
        .from('marketing')
        .select('asunto, cuerpo_html')
        .eq('numero_secuencia', contacto.indice_secuencia || 0)
        .eq('estado', 'activo')
        .single();

      if (contenido) {
        resultados.push({
          email: contacto.correo,
          asunto: contenido.asunto,
          secuencia_actual: contacto.indice_secuencia
        });
      }
    }

    return res.status(200).json({ 
      success: true, 
      encontrados: resultados.length,
      contactos: resultados 
    });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}