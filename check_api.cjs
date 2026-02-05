
const axios = require('axios');

async function checkApi() {
    const TICKET = 'FD7AB341-9FA0-452A-B1A8-0DEF7F6968AB';
    const url = `https://api.mercadopublico.cl/servicios/v1/Publico/Empresas/BuscarComprador?ticket=${TICKET}`;

    try {
        const response = await axios.get(url);
        console.log("Keys:", Object.keys(response.data));
        console.log("Sample:", JSON.stringify(response.data).substring(0, 500));
    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkApi();
