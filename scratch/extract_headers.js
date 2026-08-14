import fs from 'fs';

const filePath = 'c:\\Users\\Mario\\Desktop\\liquidaciones_sueldo\\declaracion-junio.csv';

try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
        const headers = lines[0].split(';');
        fs.writeFileSync('c:\\Users\\Mario\\Desktop\\Replit\\React-Vite-Starter\\scratch\\lre_headers.json', JSON.stringify(headers, null, 2), 'utf-8');
        console.log(`Extracted ${headers.length} headers to scratch/lre_headers.json`);
    }
} catch (err) {
    console.error(err);
}
