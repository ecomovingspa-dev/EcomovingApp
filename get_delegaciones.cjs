
const axios = require('axios');

async function getDelegaciones() {
    const TICKET = 'FD7AB341-9FA0-452A-B1A8-0DEF7F6968AB';
    const url = `https://api.mercadopublico.cl/servicios/v1/Publico/Empresas/BuscarComprador?ticket=${TICKET}`;

    try {
        const response = await axios.get(url);
        if (response.data && response.data.listaEmpresas) {
            const matches = response.data.listaEmpresas.filter(e =>
                e.NombreEmpresa.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('delegacion presidencial')
            );
            console.log(JSON.stringify(matches, null, 2));
        } else {
            console.log("No se encontró el listado.");
        }
    } catch (err) {
        console.error("Error:", err.message);
    }
}

getDelegaciones();
