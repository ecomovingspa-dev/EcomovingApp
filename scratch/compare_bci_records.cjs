const XLSX = require('xlsx');

const fileHist = 'C:\\Users\\Mario\\Desktop\\libro_ventas\\bci.xlsx';
const fileDet = 'C:\\Users\\Mario\\Desktop\\cartolas_bci\\detallado.xlsx';

try {
    const wbHist = XLSX.readFile(fileHist);
    const sheetHist = wbHist.Sheets[wbHist.SheetNames[0]];
    const rawHist = XLSX.utils.sheet_to_json(sheetHist, { range: 17 }); // range: 17 skips first 17 rows, starts at Row 18
    
    const wbDet = XLSX.readFile(fileDet);
    const rawDet = XLSX.utils.sheet_to_json(wbDet.Sheets[wbDet.SheetNames[0]]);
    
    console.log('Total records in historical cartola:', rawHist.length);
    console.log('Total records in detailed cartola:', rawDet.length);
    
    // Find historical record with Doc N° 1423817923
    const matchHist = rawHist.find(r => String(r['N° Documento'] || '') === '1423817923');
    console.log('\n--- Historical Record in bci.xlsx ---');
    console.log(matchHist);
    
    // Find detailed record with 'Código de transacción' containing 1423817923 or 'Código Transferencia' containing 1423817923
    const matchDet = rawDet.find(r => 
        String(r['Código de transacción'] || '').includes('1423817923') ||
        String(r['Código Transferencia'] || '').includes('1423817923') ||
        String(r['Numero serie'] || '').includes('1423817923')
    );
    console.log('\n--- Matching Detailed Record in detallado.xlsx ---');
    console.log(matchDet);
    
} catch (err) {
    console.error(err);
}
