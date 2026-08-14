import fs from 'fs';
import path from 'path';

const filePath = 'c:\\Users\\Mario\\Desktop\\liquidaciones_sueldo\\declaracion-junio.csv';

try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    console.log(`Total lines: ${lines.length}`);
    if (lines.length > 0) {
        const headers = lines[0].split(';');
        console.log(`Headers (${headers.length} columns):`);
        headers.forEach((h, idx) => {
            console.log(`Column ${idx + 1}: "${h}"`);
        });
        
        if (lines.length > 1) {
            console.log('\nFirst row values:');
            const firstRow = lines[1].split(';');
            firstRow.forEach((val, idx) => {
                if (val !== '' && val !== '0') {
                    console.log(`Column ${idx + 1} (${headers[idx]}): "${val}"`);
                }
            });
        }
    }
} catch (err) {
    console.error(err);
}
