-- Eliminar los segmentos obsoletos 'Mineras' y 'Expomin' de la tabla de catálogo
DELETE FROM catalogo_segmentos 
WHERE nombre IN ('Mineras', 'Expomin');
