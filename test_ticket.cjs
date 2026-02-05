
const axios = require('axios');

async function testWithSkillTicket() {
    const TICKET = 'F8537A18-6766-4DEF-9E59-426B4FEE2844';
    const fecha = '04022026';
    const url = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?fecha=${fecha}&ticket=${TICKET}`;

    try {
        console.log(`Buscando con Ticket de Skill...`);
        const response = await axios.get(url);
        console.log(`Resultado: ${response.data ? 'OK' : 'FAIL'}`);
        if (response.data && response.data.Listado) {
            console.log(`Encontradas ${response.data.Listado.length} licitaciones.`);
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

testWithSkillTicket();
