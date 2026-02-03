---
description: Proceso de conciliación de cartola bancaria BCI
---

# Workflow: Conciliación Bancaria

Este flujo describe cómo procesar una nueva cartola del BCI y conciliar movimientos.

1. **Obtener Cartola**: Descargar el archivo Excel desde el portal BCI (Cartola Detallada).
2. **Carga**: Ir a la página `/conciliacion` y subir el archivo.
3. **Revisión de Duplicados**: El sistema detectará automáticamente movimientos ya subidos basándose en un hash único (Fecha | Descripción | Montos | RUT).
4. **Pre-conciliación**:
    - Haz clic en "Sugerencias de Conciliación".
    - Revisa los matches automáticos propuestos (Folio/Monto/RUT).
    - Aprueba los matches de alta confianza (>90%).
5. **Categorización Manual**:
    - Para movimientos sin factura (comisiones, transferencias internas), usa el selector de "Tipo de Gasto".
    - Puedes pedirle al Bot: "Clasifica el movimiento X como Gastos Generales".
6. **Cierre de Período**: Una vez conciliados todos los movimientos relevantes, verifica que el saldo final coincida con el saldo bancario real.
