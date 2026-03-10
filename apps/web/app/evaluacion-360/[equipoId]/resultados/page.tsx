'use client';
import { useEffect, useState, use } from 'react';
import { supabase } from '@ccs/supabase';
import { ROLES, type RolKey } from '@ccs/ui';
import type { Database } from '@ccs/supabase';
import Link from 'next/link';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer
} from 'recharts';
import styles from '../resultados.module.css';

type UsuarioDB = Database['public']['Tables']['usuarios']['Row'];
type Eval360DB = any;

type ResultadoPar = {
    evaluador_id: string;
    puntaje_que: number;
    puntaje_como: number;
    comentario: string | null;
    respuestas: any;
    es_autoevaluacion: boolean;
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
                setResultados(evals as ResultadoPar[]);
            }
            setLoading(false);
        }
        cargar();
    }, [equipoId]);

    if (loading) return (
        <div className={styles.loadingWrap}><div className={styles.spinner} /><p>Cargando resultados...</p></div>
    );

    const pares = resultados.filter(r => !r.es_autoevaluacion);
    const yoEval = resultados.find(r => r.es_autoevaluacion);

    const n = pares.length;
    const avgQue = n > 0 ? pares.reduce((s, r) => s + r.puntaje_que, 0) / n : 0;
    const avgComo = n > 0 ? pares.reduce((s, r) => s + r.puntaje_como, 0) / n : 0;
    const avg360 = (avgQue + avgComo) / 2;

    // Data para el Radar
    const dims = [
        { key: 'Ejecución', indices: ['p0', 'p2'] },
        { key: 'Iniciativa', indices: ['p1', 'p3'] },
        { key: 'Clima', indices: ['p5', 'p6'] },
        { key: 'Comunicación', indices: ['p4', 'p7'] },
    ];

    const calcAvg = (evals: ResultadoPar[], indices: string[]) => {
        if (evals.length === 0) return 0;
        const summed = evals.reduce((acc, current) => {
            const respuestas = current.respuestas || {};
            const rowSum = indices.reduce((s, idx) => s + (respuestas[idx] || 0), 0);
            return acc + (rowSum / indices.length);
        }, 0);
        return Math.round((summed / evals.length) * 10) / 10;
    };

    const radarData = dims.map(d => ({
        subject: d.key,
        Yo: yoEval ? calcAvg([yoEval], d.indices) : 0,
        Grupo: calcAvg(pares, d.indices),
        fullMark: 5,
    }));

    // Calcular insignias ganadas (basado en pares)
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
                {resultados.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>⏳</div>
                        <h2>Todavía no se generaron evaluaciones</h2>
                        <p>Cuando completes tu autoevaluación o tus compañeros te evalúen, acá vas a ver tus resultados.</p>
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
                        {n === 0 && yoEval && (
                            <div className={styles.partialAlert}>
                                ℹ️ <strong>Vista parcial activa:</strong> Ya completaste tu autoevaluación. Los promedios del grupo aparecerán a medida que tus compañeros completen sus revisiones.
                            </div>
                        )}

                        <div className={styles.scoresGrid}>
                            {/* RADAR CHART INTERACTIVO */}
                            <div className={styles.radarCard}>
                                <h3>Dimensiones de Competencia</h3>
                                <div className={styles.radarContainer}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                            <PolarGrid stroke="#e2eaf2" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#5a7191', fontSize: 12, fontWeight: 600 }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                                            {yoEval && (
                                                <Radar
                                                    name="Yo"
                                                    dataKey="Yo"
                                                    stroke="#2dc9a8"
                                                    fill="#2dc9a8"
                                                    fillOpacity={0.4}
                                                />
                                            )}
                                            <Radar
                                                name="Grupo"
                                                dataKey="Grupo"
                                                stroke="#3a6bc8"
                                                fill="#3a6bc8"
                                                fillOpacity={0.4}
                                            />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className={styles.radarLegend}>
                                    <div className={styles.legItem}>
                                        <div className={styles.legDot} style={{ background: '#3a6bc8' }} />
                                        <span>Promedio del Grupo</span>
                                    </div>
                                    {yoEval && (
                                        <div className={styles.legItem}>
                                            <div className={styles.legDot} style={{ background: '#2dc9a8' }} />
                                            <span>Mi Autoevaluación</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Promedio global */}
                            <div className={styles.scoreCard}>
                                <div className={styles.scoreCircle} style={{ '--score-color': avg360 >= 4 ? '#2dc9a8' : avg360 >= 3 ? '#3a6bc8' : '#e07070' } as React.CSSProperties}>
                                    <span className={styles.scoreNum}>{avg360.toFixed(1)}</span>
                                    <span className={styles.scoreMax}>/5</span>
                                </div>
                                <div className={styles.scoreLabel}>Promedio 360°</div>
                                <div className={styles.scoreN}>{n} evaluaciones de pares</div>
                            </div>

                            {/* Detalle QUÉ y CÓMO resumido */}
                            <div className={styles.scoreCard}>
                                <div className={styles.scoreDimension} style={{ marginBottom: '20px' }}>
                                    <div className={styles.scoreDimTitle}>🎯 Qué: {avgQue.toFixed(1)}</div>
                                    <div className={styles.scoreDimBar}>
                                        <div className={styles.scoreDimFill} style={{ width: `${(avgQue / 5) * 100}%`, background: '#1a2b5e' }} />
                                    </div>
                                </div>
                                <div className={styles.scoreDimension}>
                                    <div className={styles.scoreDimTitle}>🤝 Cómo: {avgComo.toFixed(1)}</div>
                                    <div className={styles.scoreDimBar}>
                                        <div className={styles.scoreDimFill} style={{ width: `${(avgComo / 5) * 100}%`, background: '#2dc9a8' }} />
                                    </div>
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
