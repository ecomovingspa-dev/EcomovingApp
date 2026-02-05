
const axios = require('axios');

async function getLicitContacts() {
    const TICKET = 'FD7AB341-9FA0-452A-B1A8-0DEF7F6968AB';
    const fecha = '05022026'; // Hoy
    const url = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?fecha=${fecha}&ticket=${TICKET}`;

    try {
        console.log(`Buscando Licitaciones del día ${fecha}...`);
        const response = await axios.get(url);

        if (!response.data || !response.data.Listado) {
            console.log("No hay licitaciones para hoy (aún).");
            return;
        }

        const delegacionesLicit = response.data.Listado.filter(l =>
            l.Nombre && l.Nombre.toLowerCase().includes('delegacion')
        );

        console.log(`Encontradas ${delegacionesLicit.length} posibles licitaciones.`);

        for (const lic of delegacionesLicit.slice(0, 5)) {
            console.log(`Consultando detalle: ${lic.CodigoExterno}`);
            const detailUrl = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?codigo=${lic.CodigoExterno}&ticket=${TICKET}`;
            const detailResp = await axios.get(detailUrl);

            if (detailResp.data && detailResp.data.Listado && detailResp.data.Listado[0]) {
                const d = detailResp.data.Listado[0];
                if (d.Comprador && d.Comprador.NombreOrganismo.toLowerCase().includes('presidencial')) {
                    console.log(`  - Organismo: ${d.Comprador.NombreOrganismo}`);
                    console.log(`  - Contacto: ${d.Comprador.ContactoNombre || 'N/A'}`);
                    console.log(`  - Email: ${d.Comprador.ContactoEmail || 'N/A'}`);
                    console.log(`  - Fono: ${d.Comprador.ContactoTelefono || 'N/A'}`);
                }
            }
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

getLicitContacts();
