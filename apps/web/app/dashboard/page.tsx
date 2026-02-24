'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@ccs/supabase';
import { ROLES, type RolKey } from '@ccs/ui';
import { TAREAS_POR_ROL, calcularCompletitud, getTareasIniciales, type TareaOrientativa } from '@ccs/logic';
import type { Database } from '@ccs/supabase';
import Link from 'next/link';
import NotificationBell from '../components/NotificationBell';
import { usePushNotifications } from '../hooks/usePushNotifications';
import styles from './page.module.css';
import Sidebar from '../components/Sidebar';
import AuthenticatedLayout from '../components/AuthenticatedLayout';


type Usuario = Database['public']['Tables']['usuarios']['Row'];

export default function DashboardPage() {
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [tareas, setTareas] = useState<TareaOrientativa[]>([]);
    const [loading, setLoading] = useState(true);
    const { suscribir } = usePushNotifications();

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }

            let { data } = await supabase
                .from('usuarios')
                .select('*')
                .eq('id', user.id)
                .single();

            // Si no existe el perfil (ej: error RLS en registro), lo creamos ahora
            if (!data) {
                const { data: nuevo } = await supabase
                    .from('usuarios')
                    .upsert({
                        id: user.id,
                        nombre: user.user_metadata?.nombre ?? user.email?.split('@')[0] ?? 'Usuario',
                        email: user.email ?? '',
                        tipo: (user.user_metadata?.tipo as 'estudiante' | 'docente') ?? 'estudiante',
                        preferencia_rol_busqueda: 'primario'
                    }, { onConflict: 'id' })
                    .select('*')
                    .single();
                data = nuevo;
            }

            setUsuario(data);

            // Cargar tareas del rol primario
            if (data?.rol_primario) {
                setTareas(getTareasIniciales(data.rol_primario as RolKey));
            }
            setLoading(false);
        }
        cargar();
    }, []);

    function toggleTarea(id: string) {
        setTareas(prev => prev.map(t => {
            if (t.id !== id) return t;
            const next = t.estado === 'completado' ? 'pendiente'
                : t.estado === 'pendiente' ? 'en-progreso'
                    : 'completado';
            return { ...t, estado: next };
        }));
    }

    async function cerrarSesion() {
        await supabase.auth.signOut();
        window.location.href = '/';
    }

    async function toggleBuscandoEquipo() {
        if (!usuario) return;
        const nuevo = !usuario.buscando_equipo;
        setUsuario(prev => prev ? { ...prev, buscando_equipo: nuevo } : prev);
        await supabase.from('usuarios').update({ buscando_equipo: nuevo }).eq('id', usuario.id);
    }

    async function cambiarPreferenciaRol(pref: 'primario' | 'secundario') {
        if (!usuario) return;
        setUsuario(prev => prev ? { ...prev, preferencia_rol_busqueda: pref } : prev);
        await supabase.from('usuarios').update({ preferencia_rol_busqueda: pref } as any).eq('id', usuario.id);
    }

    if (loading) return (
        <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
            <p>Cargando tu perfil...</p>
        </div>
    );

    if (!usuario) return null;

    const rolP = usuario.rol_primario ? ROLES[usuario.rol_primario as RolKey] : null;
    const rolS = usuario.rol_secundario ? ROLES[usuario.rol_secundario as RolKey] : null;
    const scores = usuario.resultados_test as Record<RolKey, number> | null;
    const completitud = calcularCompletitud(tareas);

    return (
        <AuthenticatedLayout>
            <main className={styles.main}>

                {/* BIENVENIDA + PERFIL */}
                <div className={styles.profileSection}>
                    <div className={styles.avatar}>
                        {usuario.foto_url
                            ? <img src={usuario.foto_url} alt={usuario.nombre} />
                            : <span>{usuario.nombre.charAt(0).toUpperCase()}</span>
                        }
                    </div>
                    <div>
                        <h1>Hola, {usuario.nombre === usuario.email?.split('@')[0] ? (usuario.nombre.charAt(0).toUpperCase() + usuario.nombre.slice(1)) : usuario.nombre.split(' ')[0]} 👋</h1>
                        <p className={styles.sub}>{usuario.email}</p>

                        {/* Selector de Preferencia de Talento */}
                        {rolP && rolS && (
                            <div className={styles.talentPref}>
                                <span className={styles.prefLabel}>Destacar mi talento:</span>
                                <div className={styles.prefButtons}>
                                    <button
                                        className={`${styles.prefBtn} ${usuario.preferencia_rol_busqueda === 'primario' ? styles.prefActive : ''}`}
                                        onClick={() => cambiarPreferenciaRol('primario')}
                                    >
                                        {rolP.icon} {rolP.label} (Primario)
                                    </button>
                                    <button
                                        className={`${styles.prefBtn} ${usuario.preferencia_rol_busqueda === 'secundario' ? styles.prefActive : ''}`}
                                        onClick={() => cambiarPreferenciaRol('secundario')}
                                    >
                                        {rolS.icon} {rolS.label} (Secundario)
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={styles.metaActions}>
                            {/* Toggle buscando equipo */}
                            {usuario.tipo === 'estudiante' && (
                                <button
                                    className={`${styles.buscandoToggle} ${usuario.buscando_equipo ? styles.buscandoOn : ''}`}
                                    onClick={toggleBuscandoEquipo}
                                    id="btn-buscando-equipo"
                                >
                                    {usuario.buscando_equipo ? '🟢 Buscando equipo' : '⚪ No estoy buscando equipo'}
                                </button>
                            )}
                            {/* Botón Push */}
                            <button
                                className={styles.pushBtn}
                                onClick={() => suscribir(usuario.id)}
                                id="btn-suscribir-push"
                            >
                                🔔 Notificaciones
                            </button>
                        </div>
                    </div>
                </div>

                {/* SIN TEST REALIZADO */}
                {!rolP && (
                    <div className={styles.testCta}>
                        <div className={styles.testCtaIcon}>📋</div>
                        <div>
                            <h2>Todavía no hiciste el test</h2>
                            <p>Descubrí tu perfil profesional y empezá a conectarte con compañeros.</p>
                        </div>
                        <Link href="/test" className={styles.btnTeal} id="btn-ir-test">
                            Hacer el Test →
                        </Link>
                    </div>
                )}

                {/* PERFIL DE ROLES */}
                {rolP && (
                    <div className={styles.grid2}>
                        {/* Rol Primario */}
                        <div className={styles.rolCard} style={{ '--rc': rolP.color } as React.CSSProperties}>
                            <div className={styles.rolBadge}>Rol Primario</div>
                            <div className={styles.rolIcon}>{rolP.icon}</div>
                            <h2 className={styles.rolNombre}>{rolP.label}</h2>
                            {rolS && (
                                <div className={styles.rolSec}>
                                    {rolS.icon} Secundario: <strong>{rolS.label}</strong>
                                </div>
                            )}
                        </div>

                        {/* Radar de scores */}
                        {scores && (
                            <div className={styles.radarCard}>
                                <h3>Distribución de competencias</h3>
                                {(Object.keys(scores) as RolKey[]).map(rol => {
                                    const r = ROLES[rol];
                                    const max = Math.max(...Object.values(scores));
                                    const pct = Math.round((scores[rol] / max) * 100);
                                    return (
                                        <div key={rol} className={styles.radarRow}>
                                            <span className={styles.radarLbl}>{r.icon} {r.label}</span>
                                            <div className={styles.radarBar}>
                                                <div className={styles.radarFill} style={{ width: `${pct}%`, background: r.color }} />
                                            </div>
                                            <span className={styles.radarPct}>{scores[rol]}%</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* CHECKLIST DE ROL (termómetro del equipo) */}
                {rolP && tareas.length > 0 && (
                    <div className={styles.checklistSection}>
                        <div className={styles.checklistHeader}>
                            <div>
                                <h2>Mis tareas orientativas</h2>
                                <p className={styles.sub}>Rol {rolP.label} · {completitud}% completado</p>
                            </div>
                            <div className={styles.progressPill} style={{ '--rc': rolP.color } as React.CSSProperties}>
                                {completitud}%
                            </div>
                        </div>
                        <div className={styles.progressBarWrap}>
                            <div className={styles.progressFill} style={{ width: `${completitud}%`, background: rolP.color }} />
                        </div>

                        <div className={styles.checklist}>
                            {tareas.map(tarea => (
                                <button
                                    key={tarea.id}
                                    className={`${styles.tareaItem} ${styles[tarea.estado]}`}
                                    onClick={() => toggleTarea(tarea.id)}
                                    title="Click para cambiar estado"
                                >
                                    <span className={styles.tareaCheck}>
                                        {tarea.estado === 'completado' ? '✅'
                                            : tarea.estado === 'en-progreso' ? '🔵'
                                                : '☐'}
                                    </span>
                                    <span className={styles.tareaDesc}>{tarea.descripcion}</span>
                                    <span className={`${styles.tareaEstado} ${styles[`est-${tarea.estado}`]}`}>
                                        {tarea.estado === 'completado' ? 'Listo'
                                            : tarea.estado === 'en-progreso' ? 'En progreso'
                                                : 'Pendiente'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ACTIONS */}
                <div className={styles.actions}>
                    <Link href="/mis-equipos" className={styles.actionCard} id="btn-mis-equipos">
                        <span>👥</span>
                        <strong>Mis Equipos</strong>
                        <p>Unirte a una cátedra y ver el Kanban</p>
                    </Link>
                    <Link href="/marketplace" className={styles.actionCard} id="btn-marketplace">
                        <span>🏪</span>
                        <strong>Marketplace de talentos</strong>
                        <p>Buscá compañeros por rol faltante</p>
                    </Link>
                    <Link href="/test" className={styles.actionCard} id="btn-repetir-test">
                        <span>📝</span>
                        <strong>Repetir el test</strong>
                        <p>Actualizá tu perfil de roles</p>
                    </Link>
                </div>

            </main>
        </AuthenticatedLayout>
    );
}
