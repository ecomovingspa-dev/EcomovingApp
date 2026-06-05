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
    'pres_contacto_sin_verificar',
    'Presentación - Contacto sin verificar',
    1,
    0,
    'Contacto de Ecomoving SpA - Merchandising Corporativo Sustentable',
    'Estimado/a, espero que se encuentre muy bien.' || chr(10) || chr(10) || 'Le escribo de parte de Ecomoving SpA, donde nos dedicamos a crear regalos corporativos y merchandising de triple impacto. Diseñamos productos sustentables de alta calidad, fabricados a partir de materiales reciclados y orgánicos, ideales para acompañar las iniciativas ambientales de su empresa y destacar el compromiso con la sostenibilidad.' || chr(10) || chr(10) || 'Nos encantaría enviarle nuestro catálogo y conversar brevemente sobre cómo podemos apoyar sus campañas internas y eventos corporativos con soluciones ecológicas a medida.',
    'Quedo muy atento a su respuesta para coordinar una llamada corta de presentación. ¡Que tenga una excelente semana!',
    ''
),
(
    'seg_contacto_sin_verificar',
    'Seguimiento - Contacto sin verificar',
    2,
    3,
    'Seguimiento: Merchandising Corporativo Sustentable - Ecomoving SpA',
    'Estimado/a, espero que se encuentre muy bien. Hace unos días le escribí para presentarle nuestras soluciones de regalos corporativos ecológicos y ver si podíamos colaborar en sus próximas actividades.' || chr(10) || chr(10) || 'Comprendo que el día a día suele ser muy ocupado, por lo que solo quería reiterarle nuestra disponibilidad y compartirle nuevamente una muestra visual de lo que hacemos. Nos adaptamos a los plazos y presupuestos de su empresa con productos certificados de triple impacto.',
    'Si le interesa conocer más o revisar una propuesta a medida, quedo a su total disposición para conversar unos minutos. ¡Que tenga un excelente día!',
    ''
),
(
    'pres_solo_correo_web',
    'Presentación - Solo correo de la web',
    3,
    0,
    'Consulta de Ecomoving SpA - Merchandising Sustentable',
    'Estimado equipo de {empresa}, espero que estén teniendo una excelente semana.' || chr(10) || chr(10) || 'Nos ponemos en contacto desde Ecomoving SpA. Somos especialistas en el desarrollo de merchandising sustentable y regalos corporativos de alta calidad en Chile, apoyando a diversas marcas a comunicar su compromiso ecológico a través de productos útiles, circulares y de bajo impacto ambiental.' || chr(10) || chr(10) || 'Escribimos a este canal general con la intención de llegar al encargado de Compras, Marketing o Sustentabilidad. Les agradeceríamos mucho si nos pudieran orientar sobre con quién dirigirnos o reenviar este mensaje a la persona adecuada para presentarle nuestra propuesta de valor.',
    'Agradecemos de antemano su colaboración y su valioso tiempo. ¡Mucho éxito en sus actividades!',
    ''
),
(
    'seg_solo_correo_web',
    'Seguimiento - Solo correo de la web',
    4,
    5,
    'Seguimiento: Consulta sobre Merchandising Sustentable',
    'Estimado equipo de {empresa}, espero que se encuentren muy bien. Les escribimos hace unos días con la intención de contactar al área de Compras o Sustentabilidad para presentarles nuestro catálogo de regalos corporativos ecológicos.' || chr(10) || chr(10) || 'Sabemos que las bandejas de entrada reciben muchos mensajes, por lo que les recordamos brevemente nuestra consulta. Agradeceríamos enormemente si nos pudiesen indicar el correo del encargado o derivar este mensaje para evaluar juntos cómo reducir la huella de carbono de sus regalos corporativos.',
    'Agradecemos mucho su tiempo y orientación. ¡Saludos cordiales al equipo!',
    ''
);
