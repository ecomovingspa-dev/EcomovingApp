import axios from 'axios';

const ticket = 'FD7AB341-9FA0-452A-B1A8-0DEF7F6968AB';
const fecha = '26012026'; // DDMMYYYY
const url = `https://api.mercadopublico.cl/servicios/v1/publico/licitaciones.json?fecha=${fecha}&ticket=${ticket}`;

async function testApi() {
    try {
        console.log(`Consultando URL: ${url}`);
        const response = await axios.get(url);
        console.log('Respuesta recibida!');
        console.log('Cantidad de licitaciones:', response.data.Cantidad);
        if (response.data.Listado && response.data.Listado.length > 0) {
            console.log('Primeras 3 licitaciones:');
            console.log(JSON.stringify(response.data.Listado.slice(0, 3), null, 2));
        } else {
            console.log('No se encontraron licitaciones para esta fecha o la respuesta está vacía.');
            console.log('Data:', response.data);
        }
    } catch (error) {
        console.error('Error al consultar la API:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

testApi();
