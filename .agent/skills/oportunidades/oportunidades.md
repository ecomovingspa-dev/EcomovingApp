@oportunidades.md I. Protocolos de Normalización (Limpieza Quirúrgica)
Antes de clasificar, el sistema debe "neutralizar" el texto de la descripción:
1.	Indiferencia de Formato: Convertir todo a minúsculas y aplicar trim (eliminar espacios en los extremos).
2.	Limpieza Latina: Eliminar tildes y caracteres especiales (á=a, ñ=n, etc.).
3.	Neutralización de Símbolos: Reemplazar /, -, ., ,, _ por espacios simples. Esto evita que "bolsa/papel" sea ignorado por el buscador.
II. Lógica de Captura y Exclusión (El Firewall)
1. Búsqueda por Inclusión Dinámica
•	El sistema debe buscar la raíz de la keyword. Ejemplo: "Bolsa" captura "bolsa", "bolsas", "bolsitas".
2. Desambiguación por Contexto (La Regla de Oro)
Para evitar los falsos positivos detectados (como el rubro salud), se aplica un Filtro de Exclusión de Proximidad:
•	BOLSAS: Aceptar si el contexto es Kraft, Tela, Algodon, Ecologica, Reutilizable, Publicitaria.
o	RECHAZO INMEDIATO: Si detecta orina, sangre, basura, residuos, escombros, colostomia, suero, quirurgica.
•	TEXTIL/ROPA: Aceptar si el contexto es Corporativa, Estampado, Bordado, Polera, Jockey, Cortaviento.
o	RECHAZO INMEDIATO: Si detecta quirurgico, clinico, desechable, paciente, sabana hospitalaria.
•	ARTÍCULOS TÉRMICOS: Aceptar si es Mug, Vaso, Botella, Termo, Shopero.
o	RECHAZO INMEDIATO: Si detecta papel termico, impresora, rollo, ticket.
III. Integridad de Datos
•	Montos: Precisión decimal absoluta. Prohibido redondear.
•	Prioridad de Prefijos: Si una keyword viene con el prefijo - (ej: -aseo), la fila se descarta automáticamente sin importar otros matches.
IV. Matriz de Decisión Actualizada
Registro Detectado	Acción	Razón Técnica
Bolsa de polipropileno con logo	[ACEPTADO]	Coincidencia en material y fin publicitario.
Bolsas para residuos peligrosos	[RECHAZADO]	Exclusión por contexto "residuos" (Rubro Aseo/Salud).
Termo acero inoxidable 1L	[ACEPTADO]	Producto de catálogo corporativo.
Papel térmico para punto de venta	[RECHAZADO]	Falso positivo: Insumo operativo, no merchandising.
Botella deportiva personalizada	[ACEPTADO]	Match positivo en categoría hidratación/regalo.
________________________________________
Este documento constituye la lógica maestra del Skill @oportunidades. Cualquier actualización en los parámetros de búsqueda debe respetar la jerarquía: Limpieza -> Exclusión de Contexto -> Validación de Montos.
