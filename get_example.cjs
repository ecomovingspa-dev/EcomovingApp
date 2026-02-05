
const axios = require('axios');

async function getContactExample() {
    const TICKET = 'FD7AB341-9FA0-452A-B1A8-0DEF7F6968AB';
    // Codigo de licitación real de una delegación (ejemplo buscado)
    const codes = ['7195-2-LP24', '7134-3-L124', '7450-4-LE24'];

    for (const code of codes) {
        try {
            console.log(`Consultando detalle de Licitación: ${code}`);
            const url = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?codigo=${code}&ticket=${TICKET}`;
            const response = await axios.get(url);

            if (response.data && response.data.Listado && response.data.Listado[0]) {
                const d = response.data.Listado[0];
                console.log(`Organismo: ${d.Comprador.NombreOrganismo}`);
                console.log(`Contacto: ${d.Comprador.ContactoNombre}`);
                console.log(`Email: ${d.Comprador.ContactoEmail}`);
                console.log(`Fono: ${d.Comprador.ContactoTelefono}`);
                return; // Con uno basta para demostrar
            }
        } catch (err) {
            console.error(`Error con ${code}:`, err.message);
        }
    }
}

getContactExample();
