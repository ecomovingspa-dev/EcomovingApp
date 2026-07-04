-- ============================================================================
-- ACTUALIZACIÓN DE PLANTILLAS DE PROSPECCIÓN (4 PLANTILLAS: PRESENTACIÓN + SEGUIMIENTO)
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- 1. Agregar columna para imagen si no existe
ALTER TABLE configuracion_prospeccion 
ADD COLUMN IF NOT EXISTS imagen_url TEXT DEFAULT '';

-- 2. Limpiar configuración anterior
TRUNCATE TABLE configuracion_prospeccion RESTART IDENTITY;

-- 3. Insertar las 4 nuevas plantillas cordiales con lenguaje humano
INSERT INTO configuracion_prospeccion (nombre, etiqueta, orden, dias_espera, asunto_template, mensaje_intro, mensaje_cierre, imagen_url)
VALUES
(
    'consulta_directa',
    '1. Consulta Directa (Ice-Breaker)',
    1,
    3,
    'Consulta rápida sobre merchandising en {empresa}',
    'Hola {contacto}, espero que estés teniendo una excelente semana.' || chr(10) || chr(10) || 'Te escribo brevemente con la esperanza de poder conversar contigo o con quien corresponda en {empresa} sobre la gestión de merchandising o regalos corporativos.' || chr(10) || chr(10) || 'Sé perfectamente que coordinar estos artículos suele ser un dolor de cabeza silencioso (buscar proveedores que respondan rápido, asegurarse de que los logos queden perfectos y cruzar los dedos para que todo llegue a tiempo para el evento o la campaña).' || chr(10) || chr(10) || 'Solo quería pasar a saludar y preguntar de manera muy abierta y relajada: ¿tienen planificado algún proyecto de regalos corporativos o merchandising en carpeta para estos meses en el que te vendría bien una mano?',
    'No pretendo quitarte tiempo vendiéndote algo a la fuerza hoy. Pero si te sirve tener una opción confiable, rápida y de alta calidad a mano para comparar o cotizar cuando lo necesites, me avisas y te comparto nuestras ideas más populares o el catálogo digital.' || chr(10) || chr(10) || '¡Que tengas un excelente día!',
    ''
),
(
    'alternativa_valor',
    '2. Alternativa de Valor (Follow-up)',
    2,
    4,
    'Re: Consulta rápida sobre merchandising en {empresa}',
    'Hola {contacto}, espero que vaya todo muy bien.' || chr(10) || chr(10) || 'Te escribo de manera muy breve en seguimiento a mi correo anterior, sobre el merchandising y regalos para su equipo en {empresa}.' || chr(10) || chr(10) || 'Entiendo perfectamente que las agendas en el día a día están a mil por hora, por lo que solo quería reiterarte nuestra total disposición. Si en algún momento planifican algún evento corporativo, bienvenida de colaboradores o fechas especiales, acá estamos para simplificarte el proceso y buscar ideas atractivas sin compromiso.',
    'Si estás tapado/a de pendientes en este momento, no te preocupes en responder ahora. Pero si te gustaría tener nuestro catálogo guardado para más adelante, me avisas con un breve "sí" y te lo envío encantado.' || chr(10) || chr(10) || '¡Un abrazo y mucho éxito en tus actividades!',
    ''
),
(
    'email_despedida',
    '3. Email de Despedida (Breakup)',
    3,
    5,
    'Cerrando contacto / Merchandising en {empresa}',
    'Hola {contacto}, espero que te encuentres muy bien.' || chr(10) || chr(10) || 'Te escribo por última vez para no saturar tu bandeja de entrada. Como no hemos coincidido en esta oportunidad, asumo que el tema de regalos o merchandising no está dentro de tus prioridades o necesidades actuales en {empresa}, lo cual es totalmente comprensible.' || chr(10) || chr(10) || 'Si en el futuro cercano deciden buscar alternativas o necesitas solucionar una producción a contrarreloj con excelente calidad, nos encantará poder ayudarte.',
    'Te deseo el mayor de los éxitos en tus proyectos y metas del año. Si en algún momento nos necesitas, ya tienes mi contacto por esta vía.' || chr(10) || chr(10) || '¡Que tengas una excelente semana!',
    ''
);
