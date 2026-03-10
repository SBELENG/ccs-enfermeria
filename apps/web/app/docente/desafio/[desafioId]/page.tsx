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
    hasBottleneck: boolean;
    hasSocialFriction: boolean;
    socialHealth: {
        avg360: number;
        maxGap: number;
        friction: number;
    };
    stats: {
        doing: number;
        review: number;
        backlog: number;
        done: number;
    };
};

const ROL_KEYS: RolKey[] = ['organizador', 'analitico', 'ejecutor', 'creativo', 'conciliador', 'motivador'];

const INSIGNIAS = [
    { key: 'ejecutor_estrella', condicion: (q: number) => q >= 4.5, label: 'Ejecutor Estrella', emoji: '🛠️' },
    { key: 'puente_equipo', condicion: (_q: number, c: number) => c >= 4.5, label: 'Puente del Equipo', emoji: '🤝' },
    { key: 'colaborador_integral', condicion: (q: number, c: number) => q >= 4 && c >= 4, label: 'Colaborador Integral', emoji: '⭐' },
    { key: 'motor_grupo', condicion: (_q: number, c: number) => c >= 4, label: 'Motor del Grupo', emoji: '🔊' },
    { key: 'aporte_concreto', condicion: (q: number) => q >= 4, label: 'Aporte Concreto', emoji: '📊' },
];

export default function DesafioPage({ params }: { params: Promise<{ desafioId: string }> }) {
    const { desafioId } = use(params);
    const [desafio, setDesafio] = useState<DesafioDB | null>(null);
    const [equipos, setEquipos] = useState<EquipoData[]>([]);
    const [checkins, setCheckins] = useState<CheckinData[]>([]);
    const [tab, setTab] = useState<'equipos' | 'timeline' | 'insights'>('equipos');
    const [loading, setLoading] = useState(true);
    const [finalizando, setFinalizando] = useState(false);
    const [alumnosLibres, setAlumnosLibres] = useState<UsuarioDB[]>([]);

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

            const enriched: EquipoData[] = await Promise.all((eqs ?? []).map(async (eq: any) => {
                const [{ data: miembros }, { data: tareas }, { data: evals }] = await Promise.all([
                    (supabase.from('equipo_miembros') as any).select('*, usuario:usuarios(*)').eq('equipo_id', eq.id),
                    (supabase.from('tareas') as any).select('*').eq('equipo_id', eq.id) as any,
                    (supabase.from('evaluaciones_360') as any).select('*').eq('equipo_id', eq.id) as any,
                ]);

                const ts = (tareas as any[]) ?? [];
                const ms = (miembros as any[]) ?? [];

                // Completitud kanban
                const completitud = ts.length > 0
                    ? Math.round((ts.filter(t => t.estado === 'done').length / ts.length) * 100)
                    : 0;

                // Distribución de roles
                const rolDist = ROL_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<RolKey, number>);
                ms.forEach((m: any) => { if (m.rol_en_equipo) rolDist[m.rol_en_equipo as RolKey]++; });

                // Alerta de balance: Faltan roles clave?
                const hasCriticalGap = rolDist.organizador === 0 || rolDist.ejecutor === 0;

                // Stats de tareas
                const stats = {
                    backlog: ts.filter(t => t.estado === 'backlog').length,
                    doing: ts.filter(t => t.estado === 'doing').length,
                    review: ts.filter(t => t.estado === 'review').length,
                    done: ts.filter(t => t.estado === 'done').length,
                };

                // Detección de Cuellos de Botella (ej: >3 tareas en Doing o Review)
                const hasBottleneck = stats.doing > 3 || stats.review > 2;

                // Métrica de Salud Social
                const evs = (evals as any[]) ?? [];
                const pares = evs.filter(e => !e.es_autoevaluacion);
                const autos = evs.filter(e => e.es_autoevaluacion);

                const avg360 = pares.length > 0 ? pares.reduce((s, e) => s + (e.puntaje_que + e.puntaje_como) / 2, 0) / pares.length : 0;

                // Fricción: Desviación de puntajes (simplificada)
                const friction = pares.length > 1 ? Math.max(...pares.map(p => (p.puntaje_que + p.puntaje_como) / 2)) - Math.min(...pares.map(p => (p.puntaje_que + p.puntaje_como) / 2)) : 0;

                // Gap: Máxima diferencia autoeval vs pares
                let maxGap = 0;
                ms.forEach((m: any) => {
                    const auto = autos.find(a => a.evaluado_id === m.usuario_id);
                    const pAvg = pares.filter(p => p.evaluado_id === m.usuario_id);
                    if (auto && pAvg.length > 0) {
                        const pMean = pAvg.reduce((s, x) => s + (x.puntaje_que + x.puntaje_como) / 2, 0) / pAvg.length;
                        maxGap = Math.max(maxGap, Math.abs((auto.puntaje_que + auto.puntaje_como) / 2 - pMean));
                    }
                });

                const hasSocialFriction = friction > 1.5 || maxGap > 1.5 || (avg360 < 3 && pares.length > 0);

                return {
                    ...eq, miembros: ms, tareas: ts, completitud, rolDist,
                    hasCriticalGap, hasBottleneck, hasSocialFriction,
                    stats, socialHealth: { avg360, maxGap, friction }
                };
            }));

            setEquipos(enriched);

            // Cargar alumnos de la cátedra que NO están en equipos
            if (des) {
                const { data: inscritos } = await (supabase.from('catedra_inscripciones') as any)
                    .select('*, usuario:usuarios(*)')
                    .eq('catedra_id', (des as any).catedra_id);

                const todosAlumnos = (inscritos as any[])?.map(i => i.usuario) || [];
                const idsEnEquipos = enriched.flatMap(e => e.miembros.map(m => m.usuario_id));
                const libres = todosAlumnos.filter(a => a && !idsEnEquipos.includes(a.id));
                setAlumnosLibres(libres);
            }

            // Cargar Timeline de Check-ins
            const { data: chks } = await (supabase.from('checkins') as any)
                .select('*, usuario:usuarios(*)')
                .in('equipo_id', eqs?.map((e: any) => e.id) || [])
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

    async function crearEquipo(e: React.FormEvent<HTMLFormElement>) {
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

    async function finalizarDesafio() {
        if (!desafio || !confirm('¿Estás seguro de finalizar el desafío? Esto congelará los resultados y generará las insignias en el historial de los alumnos.')) return;
        setFinalizando(true);

        try {
            const historialRows: any[] = [];

            for (const eq of equipos) {
                // Obtener todas las evaluaciones 360 del equipo (pares)
                const { data: evs } = await (supabase.from('evaluaciones_360') as any)
                    .select('*')
                    .eq('equipo_id', eq.id)
                    .eq('es_autoevaluacion', false);

                for (const m of eq.miembros) {
                    const mEvals = (evs as any[])?.filter(e => e.evaluado_id === m.usuario_id) ?? [];
                    const n = mEvals.length;

                    if (n > 0) {
                        const q = mEvals.reduce((acc, e) => acc + e.puntaje_que, 0) / n;
                        const c = mEvals.reduce((acc, e) => acc + e.puntaje_como, 0) / n;

                        // Calcular Radar Dims para el historial
                        const dims = [
                            { key: 'ejecucion', indices: ['p0', 'p2'] },
                            { key: 'iniciativa', indices: ['p1', 'p3'] },
                            { key: 'clima', indices: ['p5', 'p6'] },
                            { key: 'comunicacion', indices: ['p4', 'p7'] },
                        ];

                        const radarScores = dims.map(d => {
                            const sum = mEvals.reduce((acc, current) => {
                                const rowSum = d.indices.reduce((s, idx) => s + (current.respuestas[idx] || 0), 0);
                                return acc + (rowSum / d.indices.length);
                            }, 0);
                            return Math.round((sum / n) * 100) / 100;
                        });

                        const insignias = INSIGNIAS.filter(i => i.condicion(q, c)).map(i => i.label);

                        historialRows.push({
                            usuario_id: m.usuario_id,
                            desafio_id: desafioId,
                            equipo_id: eq.id,
                            insignias,
                            score_ejecucion: radarScores[0],
                            score_iniciativa: radarScores[1],
                            score_clima: radarScores[2],
                            score_comunicacion: radarScores[3]
                        });
                    }
                }
                const { error } = await (supabase.from('desafios') as any)
                    .update({ estado: 'finalizado' })
                    .eq('id', desafioId);

                if (error) {
                    alert(`Error al finalizar el desafío: ${error.message}`);
                    setFinalizando(false);
                }
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
                            <div className={styles.headerRight}>
                                {(desafio as any)?.estado !== 'finalizado' ? (
                                    <button className={styles.btnFinalizar} onClick={finalizarDesafio} disabled={finalizando}>
                                        {finalizando ? 'Procesando...' : '🏁 Finalizar'}
                                    </button>
                                ) : (
                                    <span className={styles.finalizedBadge}>✅ Finalizado</span>
                                )}
                                <button className={styles.btnNE} onClick={() => setShowNE(s => !s)} id="btn-nuevo-equipo">
                                    {showNE ? 'Cancelar' : '+ Equipo'}
                                </button>
                            </div>
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
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNombreEq(e.target.value)}
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
                                className={styles.tabBtn}
                                onClick={() => setTab('equipos')}
                                style={{ color: alumnosLibres.length > 0 ? '#ef4444' : '#94a3b8' }}
                                title="Alumnos del curso que todavía no tienen equipo"
                            >
                                🚫 Sin Equipo ({alumnosLibres.length})
                            </button>
                            <button
                                className={`${styles.tabBtn} ${tab === 'timeline' ? styles.activeTab : ''}`}
                                onClick={() => setTab('timeline')}
                            >
                                🕒 Timeline ({checkins.length})
                            </button>
                            <button
                                className={`${styles.tabBtn} ${tab === 'insights' ? styles.activeTab : ''}`}
                                onClick={() => setTab('insights')}
                            >
                                📊 Insights
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

                                {alumnosLibres.length > 0 && (
                                    <div className={styles.libresSection}>
                                        <h3 className={styles.libresTitle}>🔴 Alumnos sin equipo ({alumnosLibres.length})</h3>
                                        <div className={styles.libresGrid}>
                                            {alumnosLibres.map(a => {
                                                const rolP = a.rol_primario ? ROLES[a.rol_primario as RolKey] : null;
                                                return (
                                                    <div key={a.id} className={styles.libreCard}>
                                                        <div className={styles.libreAvatar}>
                                                            {a.foto_url ? <img src={a.foto_url} alt={a.nombre} /> : a.nombre.charAt(0)}
                                                        </div>
                                                        <div className={styles.libreInfo}>
                                                            <div className={styles.libreName}>{a.nombre}</div>
                                                            <div className={styles.libreEmail}>{a.email}</div>
                                                            {rolP && <div className={styles.libreRol}>{rolP.icon} {rolP.label}</div>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : tab === 'timeline' ? (
                            <div className={styles.timeline}>
                                <h2 className={styles.secTitle}> Feed de Check-ins</h2>
                                {checkins.length === 0 ? (
                                    <p className={styles.emptyText}>No hay check-ins registrados aún.</p>
                                ) : (
                                    <div className={styles.timelineList}>
                                        {checkins.map((c: any) => (
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
                        ) : (
                            <div className={styles.insights}>
                                <h2 className={styles.secTitle}>Análisis Estratégico</h2>

                                <section className={styles.insightSection}>
                                    <h3>🔥 Balance de Roles por Equipo</h3>
                                    <p className={styles.insSub}>Detectá faltantes de talentos críticos de un vistazo.</p>
                                    <div className={styles.heatmapScroll}>
                                        <table className={styles.heatmapTable}>
                                            <thead>
                                                <tr>
                                                    <th>Equipo</th>
                                                    {ROL_KEYS.map(k => (
                                                        <th key={k} title={ROLES[k].label}>{ROLES[k].icon}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {equipos.map(eq => (
                                                    <tr key={eq.id}>
                                                        <td className={styles.teamNameCell}>{eq.nombre_equipo}</td>
                                                        {ROL_KEYS.map(k => {
                                                            const count = eq.rolDist[k];
                                                            return (
                                                                <td
                                                                    key={k}
                                                                    className={`${styles.heatCell} ${count > 1 ? styles.heatDouble : count === 1 ? styles.heatOk : styles.heatEmpty}`}
                                                                >
                                                                    {count > 0 ? count : ''}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>

                                <section className={styles.insightSection}>
                                    <h3>📈 Progreso Comparativo</h3>
                                    <div className={styles.progCompareList}>
                                        {equipos.map(eq => (
                                            <div key={eq.id} className={styles.progRow}>
                                                <div className={styles.progName}>{eq.nombre_equipo}</div>
                                                <div className={styles.progTrackA}>
                                                    <div className={styles.progFillA} style={{ width: `${eq.completitud}%` }} />
                                                </div>
                                                <div className={styles.progVal}>{eq.completitud}%</div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className={styles.insightSection} id="docente-alerts">
                                    <h3>🚨 Señales de Alerta</h3>
                                    <div className={styles.alertsGrid}>
                                        {equipos.filter(e => e.hasCriticalGap).map(eq => (
                                            <div key={`${eq.id}-gap`} className={styles.alertCard}>
                                                <div className={styles.alertHeader}>⚖️ Balance Crítico</div>
                                                <strong>{eq.nombre_equipo}</strong>
                                                <p>Falta rol de {eq.rolDist.organizador === 0 ? 'Organizador' : 'Ejecutor'}.</p>
                                            </div>
                                        ))}
                                        {equipos.filter(e => e.hasBottleneck).map(eq => (
                                            <div key={`${eq.id}-bot`} className={styles.alertCard} style={{ background: '#fff0f0', border: '1px solid #ffcaca' }}>
                                                <div className={styles.alertHeader} style={{ color: '#d00' }}>⚠️ Cuello de Botella</div>
                                                <strong>{eq.nombre_equipo}</strong>
                                                <p>
                                                    {eq.stats.doing > 3 ? `${eq.stats.doing} tareas simultáneas en curso.` : ''}
                                                    {eq.stats.review > 2 ? ` ${eq.stats.review} tareas esperando revisión.` : ''}
                                                </p>
                                            </div>
                                        ))}
                                        {equipos.filter(e => e.hasSocialFriction).map(eq => (
                                            <div key={`${eq.id}-soc`} className={styles.alertCard} style={{ background: '#f5f0ff', border: '1px solid #e2d5ff' }}>
                                                <div className={styles.alertHeader} style={{ color: '#6a0dad' }}>🤝 Salud Social</div>
                                                <strong>{eq.nombre_equipo}</strong>
                                                <p>
                                                    {eq.socialHealth.friction > 1.5 ? '⚠️ Alta discrepancia en el equipo.' : ''}
                                                    {eq.socialHealth.maxGap > 1.5 ? ' 🔍 Alumnos con autopercepción desfasada.' : ''}
                                                    {eq.socialHealth.avg360 < 3 && eq.socialHealth.avg360 > 0 ? ' 📉 Clima grupal bajo (Promedio < 3).' : ''}
                                                </p>
                                            </div>
                                        ))}
                                        {equipos.every((e: any) => !e.hasCriticalGap && !e.hasBottleneck && !e.hasSocialFriction && e.miembros.length >= 3) && (
                                            <div className={styles.allOk}>
                                                <span>💎</span>
                                                <p>No se detectan riesgos operativos ni sociales en los equipos.</p>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}
                    </main>
                </div>
            );
        }
