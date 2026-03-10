const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/web/.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testInsert() {
    console.log('--- TEST INSERT CHECKIN ---');

    // Buscar un usuario y un equipo para la prueba
    const { data: user } = await supabase.from('usuarios').select('id').limit(1).single();
    const { data: eq } = await supabase.from('equipos').select('id').limit(1).single();

    if (!user || !eq) {
        console.log('No se encontró usuario o equipo para la prueba.');
        return;
    }

    console.log(`Insertando para Usuario: ${user.id} en Equipo: ${eq.id}`);

    const { data, error } = await supabase.from('checkins').insert({
        usuario_id: user.id,
        equipo_id: eq.id,
        resumen: 'Test desde script service role'
    }).select();

    if (error) {
        console.error('❌ Error en el insert:', error);
    } else {
        console.log('✅ Éxito al insertar:', data);
    }
}

testInsert();
