const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/web/.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
    const { data, error } = await supabase.from('checkins').select('*, usuario:usuarios(nombre)');
    if (error) {
        console.error('Error fetching checkins:', error);
    } else {
        console.log('Checkins found:', data.length);
        data.forEach(c => {
            console.log(`- [${c.created_at}] ${c.usuario?.nombre}: ${c.resumen}`);
        });
    }
}

check();
