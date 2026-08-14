const XLSX = require('xlsx');

const fileDet = 'C:\\Users\\Mario\\Desktop\\cartolas_bci\\detallado.xlsx';

try {
    const wbDet = XLSX.readFile(fileDet);
    const rawDet = XLSX.utils.sheet_to_json(wbDet.Sheets[wbDet.SheetNames[0]]);
    
    // Find any row that mentions 250000 or '1423817923'
    const results = rawDet.filter(r => {
        const rowStr = JSON.stringify(r);
        return rowStr.includes('250000') || rowStr.includes('1423817923');
    });
    
    console.log(`Found ${results.length} matches in detailed cartola:`);
    console.log(JSON.stringify(results, null, 2));
    
} catch (err) {
    console.error(err);
}
