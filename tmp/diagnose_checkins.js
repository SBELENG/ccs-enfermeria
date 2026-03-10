const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'apps/web/.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function diagnose() {
    console.log('--- DIAGNÓSTICO DE CHECKINS ---');

    // 1. Verificar si la tabla existe
    const { error: tableError } = await supabase.from('checkins').select('id').limit(1);
    if (tableError) {
        console.error('Error al acceder a la tabla checkins:', tableError.message);
    } else {
        console.log('✅ Tabla checkins existe.');
    }

    // 2. Verificar usuario (tomaremos el primero de la tabla para probar)
    const { data: user } = await supabase.from('usuarios').select('id, nombre').limit(1).single();
    console.log('Probando con usuario:', user?.nombre, user?.id);

    // 3. Verificar si el usuario está en algún equipo
    const { data: em } = await supabase.from('equipo_miembros').select('equipo_id').eq('usuario_id', user.id).limit(1).single();
    if (!em) {
        console.log('❌ El usuario no está en ningún equipo.');
    } else {
        console.log('✅ Usuario está en equipo:', em.equipo_id);

        // 4. Intentar inserción de prueba
        const { data: insData, error: insError } = await supabase.from('checkins').insert({
            usuario_id: user.id,
            equipo_id: em.equipo_id,
            resumen: 'Test de diagnóstico'
        }).select();

        if (insError) {
            console.error('❌ Error al insertar checkin:', insError.message);
        } else {
            console.log('✅ Inserción de prueba exitosa:', insData);
        }
    }
}

diagnose();
