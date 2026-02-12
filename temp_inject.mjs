import { createClient } from '@supabase/supabase-js';

// Credentials from EcomovingWeb/.env.local
const supabaseUrl = 'https://xgdmyjzyejjmwdqkufhp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inject() {
    const product = {
        wholesaler: 'CDO Promocionales',
        external_id: 'T765',
        name: 'Mug Térmico "SUZU"',
        original_description: 'Mug de doble pared con aislamiento térmico y sellado al vacío. Mantiene bebidas calientes hasta por 12 horas y frías hasta por 24 horas. Acabado de pintura semi mate con base antideslizante y parte inferior texturizada para mejor agarre. Incluye caja de regalo Kraft.',
        images: [
            'https://s3.amazonaws.com/cdo.catalog/products/t765/original/t765_01.jpg',
            'https://s3.amazonaws.com/cdo.catalog/products/t765/original/t765_02.jpg',
            'https://s3.amazonaws.com/cdo.catalog/products/t765/original/t765_03.jpg',
            'https://s3.amazonaws.com/cdo.catalog/products/t765/original/t765_04.jpg',
            'https://s3.amazonaws.com/cdo.catalog/products/t765/original/t765_05.jpg',
            'https://s3.amazonaws.com/cdo.catalog/products/t765/original/t765_06.jpg'
        ],
        technical_specs: {
            capacidad: '600 ml',
            medidas: 'Ø 8,7 cm x 18 cm',
            materiales: 'Interior Acero 304 reciclado / Exterior Acero 201',
            tapa: 'Poliestireno con anillo de silicona',
            rendimiento: '12h caliente / 24h frío',
            sustentabilidad: 'BPA Free, Reciclable, Reutilizable'
        },
        status: 'pending'
    };

    const { error } = await supabase
        .from('agent_buffer')
        .upsert(product, { onConflict: 'external_id' });

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Successfully injected T765');
    }
}

inject();
