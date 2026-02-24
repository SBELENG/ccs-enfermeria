'use client';
import { useEffect, useState, use } from 'react';
import { supabase } from '@ccs/supabase';
import { ROLES, type RolKey } from '@ccs/ui';
import type { Database } from '@ccs/supabase';
import Link from 'next/link';
import styles from './page.module.css';

type DesafioDB = Database['public']['Tables']['desafios']['Row'];
type EquipoDB = Database['public']['Tables']['equipos']['Row'];
type TareaDB = Database['public']['Tables']['tareas']['Row'];
type MiembroDBRaw = Database['public']['Tables']['equipo_miembros']['Row'];

type CheckinDB = Database['public']['Tables']['checkins']['Row'];
type UsuarioDB = Database['public']['Tables']['usuarios']['Row'];

type CheckinData = CheckinDB & {
    usuario: UsuarioDB;
    equipo_nombre: string;
};

type EquipoData = EquipoDB & {
    miembros: (MiembroDBRaw & { usuario: UsuarioDB })[];
    tareas: TareaDB[];
    completitud: number;
    rolDist: Record<RolKey, number>;
    hasCriticalGap: boolean;
};

const ROL_KEYS: RolKey[] = ['organizador', 'analitico', 'ejecutor', 'creativo', 'conciliador', 'motivador'];

export default function DesafioPage({ params }: { params: Promise<{ desafioId: string }> }) {
    const { desafioId } = use(params);
    const [desafio, setDesafio] = useState<DesafioDB | null>(null);
    const [equipos, setEquipos] = useState<EquipoData[]>([]);
    const [checkins, setCheckins] = useState<CheckinData[]>([]);
    const [tab, setTab] = useState<'equipos' | 'timeline'>('equipos');
    const [loading, setLoading] = useState(true);

    // Nuevo equipo
    const [showNE, setShowNE] = useState(false);
    const [nombreEq, setNombreEq] = useState('');
    const [savingEq, setSavingEq] = useState(false);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }

            const { data: des } = await (supabase.from('desafios') as any).select('*').eq('id', desafioId).single();
            setDesafio(des as any);

            const { data: eqs } = await (supabase.from('equipos') as any).select('*').eq('desafio_id', desafioId);

            const enriched: EquipoData[] = await Promise.all((eqs ?? []).map(async eq => {
                const [{ data: miembros }, { data: tareas }] = await Promise.all([
                    (supabase.from('equipo_miembros') as any).select('*, usuario:usuarios(*)').eq('equipo_id', eq.id),
                    (supabase.from('tareas') as any).select('*').eq('equipo_id', eq.id) as any,
                ]);

                const ts = tareas ?? [];
                const ms = miembros ?? [];

                // Completitud kanban
                const completitud = ts.length > 0
                    ? Math.round((ts.filter(t => t.estado === 'done').length / ts.length) * 100)
                    : 0;

                // Distribución de roles
                const rolDist = ROL_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<RolKey, number>);
                ms.forEach((m: any) => { if (m.rol_en_equipo) rolDist[m.rol_en_equipo as RolKey]++; });

                // Alerta de balance: Faltan roles clave?
                const hasCriticalGap = rolDist.organizador === 0 || rolDist.ejecutor === 0;

                return { ...eq, miembros: ms, tareas: ts, completitud, rolDist, hasCriticalGap };
            }));

            setEquipos(enriched);

            // Cargar Timeline de Check-ins
            const { data: chks } = await (supabase.from('checkins') as any)
                .select('*, usuario:usuarios(*)')
                .in('equipo_id', eqs?.map(e => e.id) || [])
                .order('created_at', { ascending: false });

            if (chks) {
                const enrichedChks = chks.map((c: any) => ({
                    ...c,
                    equipo_nombre: eqs?.find(e => e.id === c.equipo_id)?.nombre_equipo || 'Equipo'
                }));
                setCheckins(enrichedChks);
            }

            setLoading(false);
        }
        cargar();
    }, [desafioId]);

    async function crearEquipo(e: React.FormEvent) {
        e.preventDefault();
        if (!nombreEq.trim()) return;
        setSavingEq(true);
        const { data } = await (supabase.from('equipos') as any).insert({
            desafio_id: desafioId,
            nombre_equipo: nombreEq.trim(),
        }).select().single();
        if (data) {
            setEquipos(prev => [...prev, { ...data, miembros: [], tareas: [], completitud: 0, rolDist: ROL_KEYS.reduce((a, k) => ({ ...a, [k]: 0 }), {} as Record<RolKey, number>), hasCriticalGap: true }]);
        }
        setNombreEq('');
        setShowNE(false);
        setSavingEq(false);
    }

    if (loading) return (
        <div className={styles.loadingWrap}><div className={styles.spinner} /><p>Cargando...</p></div>
    );

    const dias = desafio ? Math.ceil((new Date(desafio.fecha_entrega).getTime() - Date.now()) / 86_400_000) : null;

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <Link href={desafio ? `/docente/catedra/${desafio.catedra_id}` : '/docente/dashboard'} className={styles.back}>
                        ← Cátedra
                    </Link>
                    <div className={styles.headerCenter}>
                        <h1 className={styles.headerTitle}>{desafio?.titulo}</h1>
                        {dias !== null && (
                            <span className={`${styles.diasBadge} ${dias <= 0 ? styles.venc : dias <= 3 ? styles.urg : styles.ok}`}>
                                ⏰ {dias > 0 ? `${dias}d restantes` : dias === 0 ? '¡Hoy!' : 'Vencido'}
                            </span>
                        )}
                        {desafio?.documento_url && (
                            <a href={desafio.documento_url} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                                📄 Documentación Adjunta
                            </a>
                        )}
                    </div>
                    <button className={styles.btnNE} onClick={() => setShowNE(s => !s)} id="btn-nuevo-equipo">
                        {showNE ? 'Cancelar' : '+ Equipo'}
                    </button>
                </div>
            </header>

            <main className={styles.main}>

                {/* NUEVO EQUIPO FORM */}
                {showNE && (
                    <form onSubmit={crearEquipo} className={styles.formNuevoEquipo}>
                        <input
                            className={styles.inputNE}
                            placeholder="Nombre del equipo (ej: Equipo Tía Marge)"
                            value={nombreEq}
                            onChange={e => setNombreEq(e.target.value)}
                            autoFocus
                            required
                        />
                        <button type="submit" className={styles.btnCrearEq} disabled={savingEq}>
                            {savingEq ? '...' : 'Crear equipo'}
                        </button>
                    </form>
                )}

                {/* TABS */}
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tabBtn} ${tab === 'equipos' ? styles.activeTab : ''}`}
                        onClick={() => setTab('equipos')}
                    >
                        👥 Equipos ({equipos.length})
                    </button>
                    <button
                        className={`${styles.tabBtn} ${tab === 'timeline' ? styles.activeTab : ''}`}
                        onClick={() => setTab('timeline')}
                    >
                        🕒 Timeline ({checkins.length})
                    </button>
                </div>

                {tab === 'equipos' ? (
                    <>
                        <h2 className={styles.secTitle}>Equipos del Desafío</h2>
                        {equipos.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p>No hay equipos todavía. ¡Creá el primero!</p>
                            </div>
                        ) : (
                            <div className={styles.equiposGrid}>
                                {equipos.map(eq => {
                                    const maxEq = Math.max(...Object.values(eq.rolDist), 1);
                                    return (
                                        <div key={eq.id} className={styles.equipoCard}>
                                            <div className={styles.equipoHeader}>
                                                <div>
                                                    <div className={styles.equipoNombre}>{eq.nombre_equipo}</div>
                                                    {eq.hasCriticalGap && (
                                                        <span className={styles.criticalAlert}>⚠ Falta Organizador/Ejecutor</span>
                                                    )}
                                                </div>
                                                <div className={styles.equipoStats}>
                                                    <span>👤 {eq.miembros.length} miembros</span>
                                                </div>
                                            </div>

                                            <div className={styles.progSection}>
                                                <div className={styles.progLabel}>
                                                    Progreso Kanban <strong>{eq.completitud}%</strong>
                                                </div>
                                                <div className={styles.progTrack}>
                                                    <div
                                                        className={styles.progFill}
                                                        style={{
                                                            width: `${eq.completitud}%`,
                                                            background: eq.completitud === 100 ? '#2dc9a8' : eq.completitud >= 50 ? '#3a6bc8' : '#7bb5e8',
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className={styles.miniRadar}>
                                                {(Object.entries(ROLES) as [RolKey, any][]).map(([k, r]) => {
                                                    const count = eq.rolDist[k];
                                                    const pct = Math.round((count / maxEq) * 100);
                                                    return (
                                                        <div key={k} className={styles.miniRow}>
                                                            <span>{r.icon}</span>
                                                            <div className={styles.miniTrack}>
                                                                <div className={styles.miniFill} style={{ width: `${pct}%`, background: r.color }} />
                                                            </div>
                                                            <span className={styles.miniNum}>{count}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <Link href={`/kanban/${eq.id}`} className={styles.btnKanban}>
                                                📋 Ver Kanban
                                            </Link>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    <div className={styles.timeline}>
                        <h2 className={styles.secTitle}> Feed de Check-ins</h2>
                        {checkins.length === 0 ? (
                            <p className={styles.emptyText}>No hay check-ins registrados aún.</p>
                        ) : (
                            <div className={styles.timelineList}>
                                {checkins.map(c => (
                                    <div key={c.id} className={styles.checkinCard}>
                                        <div className={styles.chTop}>
                                            <strong>{c.usuario?.nombre}</strong>
                                            <span className={styles.chTeam}>en {c.equipo_nombre}</span>
                                            <span className={styles.chDate}>{new Date(c.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className={styles.chMsg}>"{c.resumen}"</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

