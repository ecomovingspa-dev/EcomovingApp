
const axios = require('axios');

async function getContacts() {
    const TICKET = 'FD7AB341-9FA0-452A-B1A8-0DEF7F6968AB';
    const dates = ['04022026', '03022026', '02022026', '01022026', '31012026'];

    for (const fecha of dates) {
        try {
            console.log(`\nBuscando OCs del día ${fecha}...`);
            const url = `https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json?fecha=${fecha}&ticket=${TICKET}`;
            const response = await axios.get(url);

            if (!response.data || !response.data.Listado) continue;

            const delegacionesOCs = response.data.Listado.filter(oc =>
                oc.NombreOrganismo && oc.NombreOrganismo.toLowerCase().includes('delegacion presidencial')
            );

            if (delegacionesOCs.length === 0) {
                console.log("No se encontraron OCs de Delegaciones este día.");
                continue;
            }

            console.log(`Encontradas ${delegacionesOCs.length} OCs de Delegaciones.`);

            for (const oc of delegacionesOCs.slice(0, 2)) {
                console.log(`Consultando detalle de OC: ${oc.Codigo}`);
                const detailUrl = `https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json?codigo=${oc.Codigo}&ticket=${TICKET}`;
                const detailResp = await axios.get(detailUrl);

                if (detailResp.data && detailResp.data.Listado && detailResp.data.Listado[0]) {
                    const d = detailResp.data.Listado[0];
                    console.log(`  - Organismo: ${d.Comprador.NombreOrganismo}`);
                    console.log(`  - Contacto: ${d.Comprador.NombreContacto}`);
                    console.log(`  - Email: ${d.Comprador.EmailContacto}`);
                    console.log(`  - Fono: ${d.Comprador.FonoContacto}`);
                }
            }
        } catch (err) {
            console.error(`Error en fecha ${fecha}:`, err.message);
        }
    }
}

getContacts();
