'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@ccs/supabase';
import Sidebar from './Sidebar';
import Footer from './Footer';
import styles from './AuthenticatedLayout.module.css';

interface AuthenticatedLayoutProps {
    children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
    const [usuario, setUsuario] = useState<any>(null);
    const [sessionUser, setSessionUser] = useState<any>(null);
    const [hasPendingEval, setHasPendingEval] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/ingresar';
                return;
            }
            setSessionUser(user);

            const { data } = await supabase
                .from('usuarios')
                .select('*')
                .eq('id', user.id)
                .single();

            setUsuario(data);
            const d = data as any;
            console.log("AuthenticatedLayout - Usuario cargado:", {
                id: d?.id,
                rol: d?.rol_primario,
                tipo: d?.tipo,
                path: window.location.pathname
            });

            // Redirección obligatoria al Test si no tiene perfil, excepto en landing o el propio test
            if (d && !d.rol_primario && d.tipo === 'estudiante') {
                const isTestPage = window.location.pathname === '/test';
                const isLanding = window.location.pathname === '/' || window.location.pathname === '';
                if (!isTestPage && !isLanding) {
                    window.location.href = '/test';
                    return;
                }
            }

            if (data) {
                // Chequear si tiene evaluaciones pendientes de equipos finalizados
                const { data: misEquipos } = await supabase
                    .from('equipo_miembros')
                    .select('equipo_id, equipo:equipos(id, estado_entrega)')
                    .eq('usuario_id', user.id);

                const finalizados = (misEquipos as any[])?.filter(e => e.equipo?.estado_entrega) || [];
                let bloqueado = false;
                for (const eq of finalizados) {
                    const { data: mData } = await supabase.from('equipo_miembros').select('usuario_id').eq('equipo_id', eq.equipo_id);
                    const { data: yaEval } = await supabase.from('evaluaciones_360').select('evaluado_id').eq('evaluador_id', user.id).eq('equipo_id', eq.equipo_id);
                    if ((yaEval?.length || 0) < (mData?.length || 0)) {
                        bloqueado = true;
                        break;
                    }
                }
                setHasPendingEval(bloqueado);
            }

            setLoading(false);
        }
        cargar();
    }, []);

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner} />
                <p>Cargando aplicación...</p>
            </div>
        );
    }

    if (!usuario) {
        // Si hay sesión pero no perfil, permitimos el renderizado básico para que las páginas manejen el upsert
        return (
            <div className={styles.wrapper}>
                <Sidebar
                    userId={sessionUser?.id || ''}
                    userName={sessionUser?.user_metadata?.nombre || sessionUser?.email?.split('@')[0] || 'Usuario'}
                    userEmail={sessionUser?.email || ''}
                />
                <main className={styles.main}>
                    <div className={styles.content}>
                        {children}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.wrapper}>
            <Sidebar
                userId={usuario.id}
                userName={usuario.nombre}
                userEmail={usuario.email}
                userAvatar={usuario.foto_url || undefined}
                userRoleP={usuario.rol_primario}
                userRoleS={usuario.rol_secundario}
                userPref={usuario.preferencia_rol_busqueda}
                isBlocked={hasPendingEval}
            />
            <main className={styles.main}>
                <div className={styles.content}>
                    {children}
                </div>
                <Footer />
            </main>
        </div>
    );
}
