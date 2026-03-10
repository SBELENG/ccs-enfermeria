'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@ccs/supabase';
import { ROLES, type RolKey } from '@ccs/ui';
import type { Database } from '@ccs/supabase';
import Link from 'next/link';
import styles from './page.module.css';

type CatedraDB = Database['public']['Tables']['catedras']['Row'];
type UsuarioDB = Database['public']['Tables']['usuarios']['Row'];

type CatedraConStats = CatedraDB & {
    inscripcionesCount: number;
    desafiosCount: number;
    roles: Record<string, number>;
};

export default function DocenteDashboard() {
    const [usuario, setUsuario] = useState<UsuarioDB | null>(null);
    const [catedras, setCatedras] = useState<CatedraConStats[]>([]);
    const [globalRoles, setGlobalRoles] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }

            const { data: u } = await (supabase.from('usuarios') as any).select('*').eq('id', user.id).single();
            if (u?.tipo !== 'docente') { window.location.href = '/dashboard'; return; }
            setUsuario(u as UsuarioDB);

            // Cargar cátedras del docente
            const { data: cats } = await supabase
                .from('catedras')
                .select('*')
                .eq('docente_id', user.id)
                .order('created_at', { ascending: false });

            if (cats) {
                const enrichedFinal = await Promise.all((cats as any[]).map(async (cat: any) => {
                    const [{ count: insCount }, { count: desCount }, { data: insRoles }] = await Promise.all([
                        supabase.from('inscripciones').select('*', { count: 'exact', head: true }).eq('catedra_id', cat.id),
                        supabase.from('desafios').select('*', { count: 'exact', head: true }).eq('catedra_id', cat.id),
                        (supabase.from('inscripciones') as any).select('usuario:usuarios(rol_primario)').eq('catedra_id', cat.id)
                    ]);

                    const roles: Record<string, number> = {};
                    (insRoles as any[])?.forEach((i: any) => {
                        const r = i.usuario?.rol_primario;
                        if (r) roles[r] = (roles[r] || 0) + 1;
                    });

                    return {
                        ...cat,
                        inscripcionesCount: insCount ?? 0,
                        desafiosCount: desCount ?? 0,
                        roles
                    };
                }));
                setCatedras(enrichedFinal);
            }
            setLoading(false);
        }
        cargar();
    }, []);

    async function cerrarSesion() {
        await supabase.auth.signOut();
        window.location.href = '/';
    }

    if (loading) return (
        <div className={styles.loadingWrap}><div className={styles.spinner} /><p>Cargando panel...</p></div>
    );

    return (
        <div className={styles.page}>
            {/* HEADER */}
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div className={styles.headerLeft}>
                        <img src="/logo-icon.png" alt="CCS" width="30" height="30" style={{ objectFit: 'contain' }} />
                        <span className={styles.headerTitle}>Panel Docente</span>
                    </div>
                    <div className={styles.headerRight}>
                        <span className={styles.headerUser}>👨‍🏫 {usuario?.nombre}</span>
                        <button onClick={cerrarSesion} className={styles.navBtn}>Salir</button>
                    </div>
                </div>
            </header>

            <main className={styles.main}>

                {/* BIENVENIDA */}
                <div className={styles.welcome}>
                    <div>
                        <h1>Bienvenido, {usuario?.nombre.split(' ')[0]} 👋</h1>
                        <p className={styles.sub}>Administrá tus cátedras, desafíos y monitoreá el equilibrio de roles.</p>
                    </div>
                    <Link href="/docente/nueva-catedra" className={styles.btnCrear} id="btn-nueva-catedra">
                        + Nueva cátedra
                    </Link>
                </div>

                {/* STATS */}
                <div className={styles.statsRow}>
                    <div className={styles.statCard}>
                        <div className={styles.statNum}>{catedras.length}</div>
                        <div className={styles.statLabel}>Cátedras</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statNum}>{catedras.reduce((s, c) => s + c.inscripcionesCount, 0)}</div>
                        <div className={styles.statLabel}>Estudiantes inscriptos</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statNum}>{catedras.reduce((s, c) => s + c.desafiosCount, 0)}</div>
                        <div className={styles.statLabel}>Desafíos creados</div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statNum}>{catedras.filter(c => c.activa).length}</div>
                        <div className={styles.statLabel}>Cátedras activas</div>
                    </div>
                </div>

                {/* Se eliminó la sección global por pedido del usuario para integrarla por cátedra */}

                {/* CÁTEDRAS */}
                <h2 className={styles.sectionTitle}>Mis cátedras</h2>

                {catedras.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📚</div>
                        <h3>Todavía no creaste ninguna cátedra</h3>
                        <p>Creá tu primera cátedra y compartí el código de acceso con tus estudiantes.</p>
                        <Link href="/docente/nueva-catedra" className={styles.btnCrear}>
                            + Crear primera cátedra
                        </Link>
                    </div>
                ) : (
                    <div className={styles.catedrasGrid}>
                        {catedras.map(cat => (
                            <Link key={cat.id} href={`/docente/catedra/${cat.id}`} className={styles.catedraCard}>
                                <div className={styles.catedraTop}>
                                    <div>
                                        <div className={styles.catedraNom}>{cat.nombre_materia}</div>
                                        <div className={styles.catedraCiclo}>📅 {cat.ciclo_lectivo}</div>
                                    </div>
                                    <div className={`${styles.activaBadge} ${cat.activa ? styles.activa : styles.inactiva}`}>
                                        {cat.activa ? 'Activa' : 'Inactiva'}
                                    </div>
                                </div>

                                <div className={styles.catedraStats}>
                                    <div className={styles.catedraStat}>
                                        <span className={styles.catedrStatNum}>{cat.inscripcionesCount}</span>
                                        <span className={styles.catedrStatLbl}>estudiantes</span>
                                    </div>
                                    <div className={styles.catedraStat}>
                                        <span className={styles.catedrStatNum}>{cat.desafiosCount}</span>
                                        <span className={styles.catedrStatLbl}>desafíos</span>
                                    </div>
                                </div>

                                {/* Mini Balance de Roles por Cátedra */}
                                <div className={styles.catRolesMini}>
                                    {(Object.entries(ROLES) as [RolKey, any][]).map(([key, rol]) => (
                                        <div key={key} className={styles.roleTiny} title={rol.label}>
                                            <span className={styles.tinyIcon}>{rol.icon}</span>
                                            <span className={styles.tinyCount}>{cat.roles?.[key] || 0}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className={styles.codigoRow}>
                                    <span className={styles.codigoLabel}>Código:</span>
                                    <code className={styles.codigo}>{cat.codigo_acceso}</code>
                                </div>

                                <div className={styles.catedraArrow}>Ver cátedra →</div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
