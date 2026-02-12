import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xgdmyjzyejjmwdqkufhp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhnZG15anp5ZWpqbXdkcWt1ZmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTk0MTgsImV4cCI6MjA3OTM5NTQxOH0.WtEIZ324jxd5ymXJ6RwdXfqFc_qM6UAKJ-ONkbL2J4E';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inject() {
    const products = [
        {
            wholesaler: 'CDO Promocionales',
            external_id: 'K112',
            name: 'Botella Térmica "KARAB"',
            original_description: 'Botella de doble pared con aislamiento al vacío. Mantiene bebidas calientes por 12 horas y frías por 24 horas. Acabado de pintura Powder Coat para mayor durabilidad y textura premium. Tapa con mosquetón de aluminio integrado. Libre de BPA.',
            images: [
                'https://s3.amazonaws.com/cdo.catalog/products/k112/original/k112_01.jpg',
                'https://s3.amazonaws.com/cdo.catalog/products/k112/original/k112_02.jpg',
                'https://s3.amazonaws.com/cdo.catalog/products/k112/original/k112_03.jpg',
                'https://s3.amazonaws.com/cdo.catalog/products/k112/original/k112_04.jpg',
                'https://s3.amazonaws.com/cdo.catalog/products/k112/original/k112_05.jpg'
            ],
            technical_specs: {
                capacidad: '550 ml',
                medidas: 'Ø 6,5 cm x 25 cm',
                materiales: 'Acero inoxidable reciclado (304 int / 201 ext)',
                tapa: 'Polipropileno con mosquetón de aluminio',
                rendimiento: '12h calor / 24h frío',
                acabado: 'Powder Coat'
            },
            status: 'pending'
        }
    ];

    for (const product of products) {
        console.log(`🚀 Inyectando ${product.external_id}...`);
        const { error } = await supabase
            .from('agent_buffer')
            .upsert(product, { onConflict: 'external_id' });

        if (error) {
            console.error(`❌ Error en ${product.external_id}:`, error.message);
        } else {
            console.log(`✅ ${product.external_id} inyectado exitosamente.`);
        }
    }
}

inject();
