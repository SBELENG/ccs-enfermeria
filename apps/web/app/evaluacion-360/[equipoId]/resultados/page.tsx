'use client';
import { useEffect, useState, use } from 'react';
import { supabase } from '@ccs/supabase';
import { ROLES, type RolKey } from '@ccs/ui';
import type { Database } from '@ccs/supabase';
import Link from 'next/link';
import styles from '../resultados.module.css';

type UsuarioDB = Database['public']['Tables']['usuarios']['Row'];
type Eval360DB = any;

type ResultadoPar = {
    evaluador: UsuarioDB;
    puntaje_que: number;
    puntaje_como: number;
    comentario: string | null;
};

const INSIGNIAS: { rol: RolKey; condicion: (que: number, como: number) => boolean; label: string; desc: string; emoji: string }[] = [
    { rol: 'ejecutor', condicion: (q) => q >= 4.5, label: 'Ejecutor Estrella', desc: 'Entrega constante y de alta calidad', emoji: '🛠️' },
    { rol: 'conciliador', condicion: (_, c) => c >= 4.5, label: 'Puente del Equipo', desc: 'Comunicación y clima grupal excelentes', emoji: '🤝' },
    { rol: 'organizador', condicion: (q, c) => q >= 4 && c >= 4, label: 'Colaborador Integral', desc: 'Alto desempeño en ambas dimensiones', emoji: '⭐' },
    { rol: 'motivador', condicion: (_, c) => c >= 4, label: 'Motor del Grupo', desc: 'Sostiene el ánimo colectivo', emoji: '🔊' },
    { rol: 'analitico', condicion: (q) => q >= 4, label: 'Aporte Concreto', desc: 'Contribución sólida al trabajo colectivo', emoji: '📊' },
    { rol: 'creativo', condicion: (q, c) => (q + c) / 2 >= 3.5, label: 'En Crecimiento', desc: 'Buen potencial colaborativo', emoji: '🌱' },
];

export default function Resultados360Page({ params }: { params: Promise<{ equipoId: string }> }) {
    const { equipoId } = use(params);

    const [yo, setYo] = useState<UsuarioDB | null>(null);
    const [resultados, setResultados] = useState<ResultadoPar[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }

            const { data: u } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
            setYo(u);

            // Evaluaciones recibidas
            const { data: evals } = await (supabase.from('evaluaciones_360') as any)
                .select('*')
                .eq('evaluado_id', user.id)
                .eq('equipo_id', equipoId);

            if (evals && evals.length > 0) {
                // Cargar datos de evaluadores (anónimos — solo para contar)
                const resultado: ResultadoPar[] = evals.map(e => ({
                    evaluador: { id: e.evaluador_id } as UsuarioDB,
                    puntaje_que: e.puntaje_que,
                    puntaje_como: e.puntaje_como,
                    comentario: e.comentario,
                }));
                setResultados(resultado);
            }
            setLoading(false);
        }
        cargar();
    }, [equipoId]);

    if (loading) return (
        <div className={styles.loadingWrap}><div className={styles.spinner} /><p>Cargando resultados...</p></div>
    );

    const n = resultados.length;
    const avgQue = n > 0 ? resultados.reduce((s, r) => s + r.puntaje_que, 0) / n : 0;
    const avgComo = n > 0 ? resultados.reduce((s, r) => s + r.puntaje_como, 0) / n : 0;
    const avg360 = (avgQue + avgComo) / 2;

    // Calcular insignias ganadas
    const insigniasGanadas = INSIGNIAS.filter(ins => ins.condicion(avgQue, avgComo));
    const topInsignia = insigniasGanadas[0];

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <Link href="/dashboard" className={styles.back}>← Panel</Link>
                    <h1 className={styles.title}>Mis resultados 360°</h1>
                </div>
            </header>

            <main className={styles.main}>
                {n === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>⏳</div>
                        <h2>Todavía no recibiste evaluaciones</h2>
                        <p>Cuando tus compañeros te evalúen, acá vas a ver tus resultados.</p>
                    </div>
                ) : (
                    <>
                        {/* INSIGNIA PRINCIPAL */}
                        {topInsignia && (
                            <div className={styles.insigniaCard}>
                                <div className={styles.insigniaEmoji}>{topInsignia.emoji}</div>
                                <div className={styles.insigniaInfo}>
                                    <div className={styles.insigniaBadge}>Insignia desbloqueada</div>
                                    <h2>{topInsignia.label}</h2>
                                    <p>{topInsignia.desc}</p>
                                </div>
                                <div className={styles.insigniaRol}>
                                    {ROLES[topInsignia.rol].icon} Competencia: {ROLES[topInsignia.rol].label}
                                </div>
                            </div>
                        )}

                        {/* PUNTUACIONES */}
                        <div className={styles.scoresGrid}>
                            {/* Promedio global */}
                            <div className={styles.scoreCard}>
                                <div className={styles.scoreCircle} style={{ '--score-color': avg360 >= 4 ? '#2dc9a8' : avg360 >= 3 ? '#3a6bc8' : '#e07070' } as React.CSSProperties}>
                                    <span className={styles.scoreNum}>{avg360.toFixed(1)}</span>
                                    <span className={styles.scoreMax}>/5</span>
                                </div>
                                <div className={styles.scoreLabel}>Promedio 360°</div>
                                <div className={styles.scoreN}>{n} evaluaciones recibidas</div>
                            </div>

                            {/* QUÉ */}
                            <div className={styles.scoreCard}>
                                <div className={styles.scoreDimension}>
                                    <div className={styles.scoreDimTitle}>🎯 ¿Qué hice?</div>
                                    <div className={styles.scoreDimBar}>
                                        <div className={styles.scoreDimFill} style={{ width: `${(avgQue / 5) * 100}%`, background: '#1a2b5e' }} />
                                    </div>
                                    <div className={styles.scoreDimNum}>{avgQue.toFixed(1)} / 5</div>
                                    <p className={styles.scoreDimDesc}>Contribución concreta al trabajo grupal</p>
                                </div>
                            </div>

                            {/* CÓMO */}
                            <div className={styles.scoreCard}>
                                <div className={styles.scoreDimension}>
                                    <div className={styles.scoreDimTitle}>🤝 ¿Cómo colaboré?</div>
                                    <div className={styles.scoreDimBar}>
                                        <div className={styles.scoreDimFill} style={{ width: `${(avgComo / 5) * 100}%`, background: '#2dc9a8' }} />
                                    </div>
                                    <div className={styles.scoreDimNum}>{avgComo.toFixed(1)} / 5</div>
                                    <p className={styles.scoreDimDesc}>Calidad de comunicación y clima grupal</p>
                                </div>
                            </div>
                        </div>

                        {/* TODAS LAS INSIGNIAS */}
                        <div className={styles.allInsignias}>
                            <h3>Insignias disponibles</h3>
                            <div className={styles.insigniasGrid}>
                                {INSIGNIAS.map(ins => {
                                    const ganada = ins.condicion(avgQue, avgComo);
                                    return (
                                        <div key={ins.rol} className={`${styles.insigniaMini} ${ganada ? styles.ganada : styles.bloqueada}`}>
                                            <div className={styles.mEmoji}>{ins.emoji}</div>
                                            <div className={styles.mLabel}>{ins.label}</div>
                                            <div className={styles.mDesc}>{ins.desc}</div>
                                            {!ganada && <div className={styles.lockIcon}>🔒</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* COMENTARIOS */}
                        {resultados.some(r => r.comentario) && (
                            <div className={styles.comentariosSection}>
                                <h3>Comentarios de tus compañeros</h3>
                                <div className={styles.comentarios}>
                                    {resultados.filter(r => r.comentario).map((r, i) => (
                                        <div key={i} className={styles.comentario}>
                                            <div className={styles.comentarioAvatar}>👤</div>
                                            <p>{r.comentario}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
