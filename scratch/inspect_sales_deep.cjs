const XLSX = require('xlsx');

const filePath = 'C:\\Users\\Mario\\Desktop\\libro_ventas\\RCV_VENTA_77567348-6_202601.xlsx';
try {
    const workbook = XLSX.readFile(filePath);
    workbook.SheetNames.forEach(name => {
        console.log('Sheet Name:', name);
        const sheet = workbook.Sheets[name];
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rawData.length > 0) {
            console.log('Row 1 (Headers):', rawData[0]);
            // Search if any header or data row contains "ref" or "asoc"
            const headers = rawData[0].map(h => String(h).toLowerCase());
            console.log('Headers lowercase:', headers);
        }
    });
} catch (err) {
    console.error(err);
}
