import axios from 'axios';

const ticket = 'FD7AB341-9FA0-452A-B1A8-0DEF7F6968AB';

async function testApi() {
    try {
        const codigo = '1000813-1-LE26';
        const url = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?codigo=${codigo}&ticket=${ticket}`;

        console.log(`Consultando Detalle URL: ${url}`);
        const response = await axios.get(url);

        if (response.data.Listado && response.data.Listado.length > 0) {
            console.log('Detalle de la licitación:');
            const lic = response.data.Listado[0];
            console.log('Nombre:', lic.Nombre);
            console.log('Organismo:', lic.Comprador ? lic.Comprador.NombreOrganismo : 'No disponible');
            console.log('Monto Estimado:', lic.MontoEstimado || 'No disponible');
            console.log('Fecha Cierre:', lic.FechaCierre);
            console.log('Items:', lic.Items ? lic.Items.Cantidad : 0);
            // console.log(JSON.stringify(lic, null, 2));
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testApi();
