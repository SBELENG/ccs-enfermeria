'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@ccs/supabase';
import { ROLES, type RolKey } from '@ccs/ui';
import { TAREAS_POR_ROL, calcularCompletitud, getTareasIniciales, type TareaOrientativa } from '@ccs/logic';
import type { Database } from '@ccs/supabase';
import Link from 'next/link';
import NotificationBell from '../components/NotificationBell';
import { usePushNotifications } from '../hooks/usePushNotifications';
import RadarChart from '../components/RadarChart';
import styles from './page.module.css';
import Sidebar from '../components/Sidebar';
import AuthenticatedLayout from '../components/AuthenticatedLayout';


type Usuario = Database['public']['Tables']['usuarios']['Row'];

export default function DashboardPage() {
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [catedras, setCatedras] = useState<any[]>([]);
    const [tareas, setTareas] = useState<TareaOrientativa[]>([]);
    const [loading, setLoading] = useState(true);
    const [notifOpen, setNotifOpen] = useState(false);
    const [evaluacionesPendientes, setEvaluacionesPendientes] = useState<any[]>([]);
    const [catedrasDisponibles, setCatedrasDisponibles] = useState<any[]>([]);
    const [tieneEquipoActivo, setTieneEquipoActivo] = useState(false);
    const { suscribir } = usePushNotifications();
    const [invitacionesPendientes, setInvitacionesPendientes] = useState<any[]>([]);

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
                const { data: nuevo, error: errorUpsert } = await supabase
                    .from('usuarios')
                    .upsert({
                        id: user.id,
                        nombre: String(user.user_metadata?.nombre ?? user.email?.split('@')[0] ?? 'Usuario'),
                        email: String(user.email ?? ''),
                        tipo: (user.user_metadata?.tipo as 'estudiante' | 'docente') ?? 'estudiante',
                        preferencia_rol_busqueda: 'primario'
                    } as any, { onConflict: 'id' })
                    .select('*')
                    .single();

                if (errorUpsert) {
                    console.error("Error crítico al crear perfil:", errorUpsert);
                    setLoading(false);
                    return;
                }
                data = nuevo;
            }

            if ((data as any)?.tipo === 'docente') {
                window.location.href = '/docente/dashboard';
                return;
            }

            setUsuario(data as any);

            // Cargar cátedras inscritas no ocultas
            const { data: inscripciones } = await supabase
                .from('inscripciones')
                .select('*, catedra:catedras(*)')
                .eq('usuario_id', user.id)
                .eq('oculta', false);

            if (inscripciones && inscripciones.length > 0) {
                const map = new Map();
                inscripciones.forEach((i: any) => { if (i.catedra?.id) map.set(i.catedra.id, i.catedra); });
                setCatedras(Array.from(map.values()));
            } else {
                // Cargar cátedras disponibles (públicas) para guiar al estudiante
                const { data: publics } = await supabase.from('catedras').select('*').limit(6);
                setCatedrasDisponibles(publics || []);
            }
            // Cargar tareas según preferencia de rol
            if (data) {
                const rolParaTareas = (data as any).preferencia_rol_busqueda === 'secundario' ? (data as any).rol_secundario : (data as any).rol_primario;
                if (rolParaTareas) {
                    const tareasPerfil = getTareasIniciales(rolParaTareas as RolKey);
                    // Mezclar con el progreso guardado
                    const progresoGuardado = (data as any).checklist_progreso || [];
                    const tareasConProgreso = tareasPerfil.map(t => {
                        const guardada = progresoGuardado.find((p: any) => p.id === t.id);
                        return guardada ? { ...t, estado: guardada.estado as any } : t;
                    });
                    setTareas(tareasConProgreso);
                }

                // Chequear evaluaciones 360 pendientes
                const { data: misEquipos } = await supabase
                    .from('equipo_miembros')
                    .select('equipo_id, equipo:equipos(id, nombre_equipo, estado_entrega)')
                    .eq('usuario_id', user.id);

                const equiposFinalizados = (misEquipos as any[])?.filter(e => e.equipo?.estado_entrega) || [];
                setTieneEquipoActivo(Array.isArray(misEquipos) && misEquipos.length > 0);

                const pendientes = [];
                for (const eq of equiposFinalizados) {
                    const { data: miembros } = await supabase.from('equipo_miembros').select('usuario_id').eq('equipo_id', eq.equipo_id);
                    const { data: yaEval } = await supabase.from('evaluaciones_360').select('evaluado_id').eq('evaluador_id', user.id).eq('equipo_id', eq.equipo_id);

                    const evaluadosIds = new Set((yaEval as any[])?.map(y => y.evaluado_id) || []);
                    const faltan = (miembros as any[])?.filter(m => !evaluadosIds.has(m.usuario_id)) || [];

                    if (faltan.length > 0) {
                        pendientes.push({
                            equipoId: eq.equipo_id,
                            nombre: eq.equipo.nombre_equipo,
                            faltan: faltan.length
                        });
                    }
                }
                setEvaluacionesPendientes(pendientes);

                // Chequear Invitaciones Pendientes
                const { data: invs } = await supabase
                    .from('solicitudes_equipo')
                    .select('*, equipo:equipos(nombre_equipo), remitente:usuarios(nombre)')
                    .eq('usuario_id', user.id)
                    .eq('estado', 'pendiente');
                setInvitacionesPendientes(invs || []);
            }
            setLoading(false);
        }
        cargar();
    }, []);

    async function toggleTarea(id: string) {
        const nuevasTareas = tareas.map(t => {
            if (t.id !== id) return t;
            const next = t.estado === 'completado' ? 'pendiente'
                : t.estado === 'pendiente' ? 'en-progreso'
                    : 'completado';
            return { ...t, estado: next };
        });
        setTareas(nuevasTareas as any);

        if (usuario) {
            await (supabase.from('usuarios') as any)
                .update({ checklist_progreso: nuevasTareas })
                .eq('id', usuario.id);
        }
    }

    async function cerrarSesion() {
        await supabase.auth.signOut();
        window.location.href = '/';
    }

    async function toggleBuscandoEquipo() {
        if (!usuario) return;
        const nuevo = !usuario.buscando_equipo;
        setUsuario(prev => prev ? { ...prev, buscando_equipo: nuevo } : prev);
        await (supabase.from('usuarios') as any).update({ buscando_equipo: nuevo }).eq('id', usuario.id);
    }

    async function cambiarPreferenciaRol(pref: 'primario' | 'secundario') {
        if (!usuario) return;
        setUsuario(prev => prev ? { ...prev, preferencia_rol_busqueda: pref } : prev);
        await (supabase.from('usuarios') as any).update({ preferencia_rol_busqueda: pref }).eq('id', usuario.id);

        // Actualizar tareas inmediatamente
        const nuevoRol = pref === 'secundario' ? usuario.rol_secundario : usuario.rol_primario;
        if (nuevoRol) {
            setTareas(getTareasIniciales(nuevoRol as RolKey));
        }
    }

    if (loading) return (
        <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
            <p>Cargando tu perfil...</p>
        </div>
    );

    if (!usuario) return (
        <AuthenticatedLayout>
            <div className={styles.errorFull}>
                <h2>⚠️ Error de Acceso</h2>
                <p>No se pudo encontrar ni crear tu perfil de usuario.</p>
                <p>Esto suele suceder si faltan políticas de seguridad (RLS) en la base de datos.</p>
                <div className={styles.errorAdvice}>
                    <strong>Sugerencia:</strong> Ejecutá la migración <code>008_fix_usuarios_rls.sql</code> en el editor SQL de Supabase.
                </div>
                <button onClick={() => window.location.reload()} className={styles.btnTeal}>Reintentar</button>
            </div>
        </AuthenticatedLayout>
    );

    const rolP = usuario.rol_primario ? ROLES[usuario.rol_primario as RolKey] : null;
    const rolS = usuario.rol_secundario ? ROLES[usuario.rol_secundario as RolKey] : null;
    const scores = usuario.resultados_test as Record<RolKey, number> | null;
    const completitud = calcularCompletitud(tareas);

    return (
        <AuthenticatedLayout>
            <main className={styles.main}>

                {/* BANNER DE INVITACIÓN PENDIENTE (ALTA VISIBILIDAD) */}
                {invitacionesPendientes.length > 0 && (
                    <div className={styles.invitationBanner}>
                        <div className={styles.invitationInfo}>
                            <span className={styles.invitationIcon}>📧</span>
                            <div>
                                <strong>¡Tenés una invitación pendiente!</strong>
                                <p>{invitacionesPendientes[0].remitente?.nombre} te invitó al equipo "{invitacionesPendientes[0].equipo?.nombre_equipo}".</p>
                            </div>
                        </div>
                        <Link href="/mis-equipos" className={styles.btnBanner}>
                            Revisar Invitación
                        </Link>
                    </div>
                )}

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
                            {/* Botón Notificaciones */}
                            <div style={{ position: 'relative' }}>
                                <button
                                    className={styles.pushBtn}
                                    onClick={() => setNotifOpen(!notifOpen)}
                                    id="btn-ver-notificaciones"
                                >
                                    🔔 Notificaciones
                                </button>
                                {notifOpen && usuario && (
                                    <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 1000 }}>
                                        <NotificationBell userId={usuario.id} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* INDUCCIÓN POR ROL (Sugerencia de Próximo Paso) */}
                {rolP && (
                    <div className={styles.inductionCard}>
                        <div className={styles.inductionIcon}>🚀</div>
                        <div className={styles.inductionContent}>
                            <h3 className={styles.inductionTitle}>Sugerencia para tu perfil {rolP.label}</h3>
                            <p className={styles.inductionText}>
                                {usuario.rol_primario === 'organizador' && 'Como Organizador, tu primer paso es unirte a una cátedra. Creá allí un nuevo equipo y convocá a un Conciliador; él se encargará de buscar y agregar a los demás talentos para balancear el grupo.'}
                                {usuario.rol_primario === 'conciliador' && 'Como Conciliador, unite a las cátedras y esperá a ser convocado por un Organizador. Una vez en su equipo, tu principal misión será buscar y convocar a los perfiles restantes para lograr un balance perfecto.'}
                                {usuario.rol_primario !== 'organizador' && usuario.rol_primario !== 'conciliador' && 'Como perfil de apoyo, lo ideal es que te unas a las cátedras donde quieras participar y esperes a ser convocado por un Conciliador que esté armando el equipo ideal.'}
                            </p>
                            <div className={styles.inductionActions}>
                                <Link href="/mis-equipos" className={styles.btnInduction}>
                                    {catedras.length === 0 ? 'Unirse a mi primera cátedra' : 'Gestionar mis equipos'}
                                </Link>
                                {usuario.rol_primario === 'organizador' && (
                                    <Link href="/talentos" className={styles.btnInductionGhost}>
                                        Buscar Conciliadores →
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ALERTA DE EVALUACIÓN PENDIENTE */}
                {evaluacionesPendientes.length > 0 && (
                    <div className={styles.evalNotice}>
                        <div className={styles.evalNoticeIcon}>⚠️</div>
                        <div className={styles.evalNoticeContent}>
                            <h3>Evaluación 360° pendiente</h3>
                            <p>Tu equipo <strong>{evaluacionesPendientes[0].nombre}</strong> finalizó el desafío. Debés completar la evaluación de tus compañeros para poder unirte a nuevos grupos o invitar talentos.</p>
                            <Link href={`/evaluacion-360/${evaluacionesPendientes[0].equipoId}`} className={styles.btnEvalMini}>
                                Ir a evaluar →
                            </Link>
                        </div>
                    </div>
                )}

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

                {/* MIS CÁTEDRAS INSCIRTAS */}
                {usuario.tipo === 'estudiante' && (
                    <div className={styles.catedrasSection}>
                        <div className={styles.sectionHeader}>
                            <h2>Mis Cátedras</h2>
                            <Link
                                href="/mis-equipos"
                                className={`${styles.joinLink} ${evaluacionesPendientes.length > 0 ? styles.disabledAction : ''}`}
                                title={evaluacionesPendientes.length > 0 ? "Completá la evaluación 360 para unirte a otra cátedra" : ""}
                            >
                                <span>➕</span> Sumar cátedras
                            </Link>
                        </div>
                        <div className={styles.catedrasGrid}>
                            {catedras.length === 0 ? (
                                <p className={styles.empty}>Todavía no te uniste a ninguna cátedra.</p>
                            ) : (
                                catedras.map(c => (
                                    <Link key={c.id} href="/mis-equipos" className={styles.catedraCard}>
                                        <div className={styles.catedraIconWrapper}>
                                            {c.nombre_materia.charAt(0)}
                                        </div>
                                        <div className={styles.catedraInfo}>
                                            <span className={styles.catedraLabel}>Cátedra</span>
                                            <span className={styles.catedraName}>{c.nombre_materia}</span>
                                        </div>
                                        <div className={styles.arrowIcon}>→</div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* PERFIL DE ROLES */}
                {rolP && (
                    <div className={styles.grid2}>
                        {/* Rol Destacado */}
                        {(() => {
                            const isSec = usuario.preferencia_rol_busqueda === 'secundario';
                            const activeRol = isSec && rolS ? rolS : rolP;
                            const otherRol = isSec ? rolP : rolS;

                            return (
                                <div className={styles.rolCard} style={{ '--rc': activeRol.color } as React.CSSProperties}>
                                    <div className={styles.rolBadge}>Rol Destacado {isSec ? '(Secundario)' : '(Primario)'}</div>
                                    <div className={styles.rolIcon}>{activeRol.icon}</div>
                                    <h2 className={styles.rolNombre}>{activeRol.label}</h2>
                                    {otherRol && (
                                        <div className={styles.rolSec}>
                                            {otherRol.icon} Otros talentos: <strong>{otherRol.label}</strong>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Radar de scores */}
                        {scores && (
                            <div className={styles.radarCard}>
                                <h3>Distribución de competencias</h3>
                                <div className={styles.radarWrapper}>
                                    <RadarChart scores={scores} size={240} />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* GUÍA DE ROL (Orientativa, sin progreso si no hay equipo) */}
                {rolP && tareas.length > 0 && !tieneEquipoActivo && (
                    <div className={styles.infoSection} style={{ '--rc': rolP.color } as React.CSSProperties}>
                        <div className={styles.infoTitle}>
                            <span className={styles.infoIcon}>{rolP.icon}</span>
                            <div>
                                <h2>Tu Rol: {rolP.label}</h2>
                                <p>Guía orientativa de tus funciones y responsabilidades iniciales.</p>
                            </div>
                        </div>
                        <div className={styles.infoList}>
                            {tareas.map(tarea => (
                                <div
                                    key={tarea.id}
                                    className={`${styles.infoItem} ${tarea.estado === 'completado' ? styles.infoDone : ''}`}
                                    onClick={() => toggleTarea(tarea.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <span className={styles.infoBullet}>
                                        {tarea.estado === 'completado' ? '✅' : '⬜'}
                                    </span>
                                    <span className={styles.infoDesc}>{tarea.descripcion}</span>
                                </div>
                            ))}
                        </div>
                        <div className={styles.infoFooter}>
                            💡 Estas tareas son para tu orientación. Una vez que te unas a un equipo, gestionarás el trabajo en el Tablero Kanban.
                        </div>
                    </div>
                )}

                {/* ACTIONS */}
                <div className={styles.actions}>
                    <Link href="/mis-equipos" className={styles.actionCard} id="btn-mis-equipos">
                        <span>👥</span>
                        <strong>Mis Proyectos</strong>
                        <p>Ver mis equipos y Tableros de Proyecto</p>
                    </Link>
                    <Link
                        href="/talentos"
                        className={`${styles.actionCard} ${evaluacionesPendientes.length > 0 ? styles.disabledAction : ''}`}
                        id="btn-marketplace"
                        title={evaluacionesPendientes.length > 0 ? "Completá la evaluación 360 para buscar talentos" : ""}
                    >
                        <span>🏪</span>
                        <strong>Búsqueda de Talentos</strong>
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
