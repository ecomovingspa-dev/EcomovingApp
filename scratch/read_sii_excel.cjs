const XLSX = require('xlsx');

const filePath = 'C:\\Users\\Mario\\Desktop\\cartolas_bci\\detallado.xlsx';
console.log('Reading file:', filePath);

try {
    const workbook = XLSX.readFile(filePath);
    console.log('Sheets present:', workbook.SheetNames);
    const sheetName = workbook.SheetNames[0];
    console.log('Target Sheet Name:', sheetName);
    const sheet = workbook.Sheets[sheetName];
    
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log('Total raw rows:', rawData.length);
    
    console.log('First 20 raw rows:');
    rawData.slice(0, 20).forEach((row, index) => {
        console.log(`Row ${index + 1}:`, row);
    });
} catch (err) {
    console.error('Error reading detailed statement Excel:', err);
}
