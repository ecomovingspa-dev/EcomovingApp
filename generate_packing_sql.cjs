const fs = require('fs');

const csvPath = 'C:\\Users\\Mario\\Desktop\\EcomovingApp\\packing.csv';
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split('\n');

// Skip first 2 lines, headers on row 3 (index 2)
const dataLines = lines.slice(3);

const cleanNumber = (val) => {
    if (!val || val.trim() === '') return 0;
    // Remove thousands separator (comma)
    // and keep the decimal point
    let cleaned = val.replace(/,/g, '').trim();
    let num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

const escapeSql = (str) => {
    if (!str) return 'NULL';
    return `'${str.replace(/'/g, "''")}'`;
};

let sqlStatements = [];

dataLines.forEach(line => {
    const parts = line.split(';');
    if (parts.length < 10) return;

    const codigo = parts[0]?.trim();
    if (!codigo) return; // Skip empty rows

    const proveedor = parts[1]?.trim();
    const nCajas = Math.round(cleanNumber(parts[2]));
    const cantidadBox = Math.round(cleanNumber(parts[3]));
    const ancho = cleanNumber(parts[4]);
    const alto = cleanNumber(parts[5]);
    const largo = cleanNumber(parts[6]);
    const kgCaja = cleanNumber(parts[7]);
    const pesoVol = cleanNumber(parts[8]);
    const pesoKg = cleanNumber(parts[9]);

    sqlStatements.push(`(${escapeSql(codigo)}, ${escapeSql(proveedor)}, ${nCajas}, ${cantidadBox}, ${ancho}, ${alto}, ${largo}, ${kgCaja}, ${pesoVol}, ${pesoKg})`);
});

const chunks = [];
const chunkSize = 50;
for (let i = 0; i < sqlStatements.length; i += chunkSize) {
    chunks.push(sqlStatements.slice(i, i + chunkSize));
}

let finalSql = '';
chunks.forEach(chunk => {
    finalSql += `INSERT INTO packing_productos (codigo, proveedor, n_cajas, cantidad_por_caja, ancho, alto, largo, kg_por_caja, peso_volumen, peso_kg)\nVALUES\n  ${chunk.join(',\n  ')}\nON CONFLICT (codigo) DO UPDATE SET\n  proveedor = EXCLUDED.proveedor,\n  n_cajas = EXCLUDED.n_cajas,\n  cantidad_por_caja = EXCLUDED.cantidad_por_caja,\n  ancho = EXCLUDED.ancho,\n  alto = EXCLUDED.alto,\n  largo = EXCLUDED.largo,\n  kg_por_caja = EXCLUDED.kg_por_caja,\n  peso_volumen = EXCLUDED.peso_volumen,\n  peso_kg = EXCLUDED.peso_kg;\n\n`;
});

fs.writeFileSync('IMPORT_PACKING_DATA.sql', finalSql);
console.log(`Generated IMPORT_PACKING_DATA.sql with ${sqlStatements.length} records.`);
