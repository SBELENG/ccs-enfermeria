'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@ccs/supabase';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import Link from 'next/link';
import styles from './historial.module.css';

type HistorialDB = {
    id: string;
    desafio_id: string;
    insignias: string[];
    score_ejecucion: number;
    score_iniciativa: number;
    score_clima: number;
    score_comunicacion: number;
    created_at: string;
    desafio: { titulo: string };
};

export default function HistorialPage() {
    const [historial, setHistorial] = useState<HistorialDB[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await (supabase.from('perfil_historial') as any)
                .select('*, desafio:desafios(titulo)')
                .eq('usuario_id', user.id)
                .order('created_at', { ascending: true });

            if (data) setHistorial(data);
            setLoading(false);
        }
        cargar();
    }, []);

    if (loading) return (
        <div className={styles.loadingWrap}><div className={styles.spinner} /><p>Cargando historial...</p></div>
    );

    const chartData = historial.map(h => ({
        name: h.desafio.titulo.substring(0, 10) + '...',
        Ejecución: h.score_ejecucion,
        Iniciativa: h.score_iniciativa,
        Clima: h.score_clima,
        Comunicación: h.score_comunicacion,
    }));

    const insigniasTotales = Array.from(new Set(historial.flatMap(h => h.insignias)));

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <Link href="/dashboard" className={styles.back}>← Dashboard</Link>
                    <h1 className={styles.title}>Historial de Carrera</h1>
                </div>
            </header>

            <main className={styles.main}>
                {historial.length === 0 ? (
                    <div className={styles.card}>
                        <div className={styles.empty}>
                            <p>Aún no tienes desafíos finalizados. ¡Sigue participando para construir tu perfil!</p>
                        </div>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        <div className={styles.left}>
                            <div className={styles.card}>
                                <h2>📊 Evolución de Competencias</h2>
                                <div className={styles.chartContainer}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                            <YAxis domain={[0, 5]} hide />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                            />
                                            <Legend iconType="circle" />
                                            <Line type="monotone" dataKey="Ejecución" stroke="#3a6bc8" strokeWidth={2} dot={{ r: 4 }} />
                                            <Line type="monotone" dataKey="Iniciativa" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                                            <Line type="monotone" dataKey="Clima" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                                            <Line type="monotone" dataKey="Comunicación" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className={styles.card} style={{ marginTop: '20px' }}>
                                <h2>🕒 Línea de Tiempo</h2>
                                <div className={styles.timeline}>
                                    {historial.map(h => (
                                        <div key={h.id} className={styles.timelineItem}>
                                            <div className={styles.itemHeader}>
                                                <span className={styles.itemName}>{h.desafio.titulo}</span>
                                                <span className={styles.itemDate}>
                                                    {new Date(h.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className={styles.itemBadges}>
                                                {h.insignias.map(tag => (
                                                    <span key={tag} className={styles.badge}>✨ {tag}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className={styles.right}>
                            <div className={styles.summaryCards}>
                                <div className={styles.miniStat}>
                                    <span className={styles.statVal}>{historial.length}</span>
                                    <span className={styles.statLabel}>Desafíos</span>
                                </div>
                                <div className={styles.miniStat}>
                                    <span className={styles.statVal}>{insigniasTotales.length}</span>
                                    <span className={styles.statLabel}>Insignias</span>
                                </div>
                            </div>

                            <div className={styles.card}>
                                <h2>💎 Insignias Ganadas</h2>
                                <div className={styles.itemBadges}>
                                    {insigniasTotales.length === 0 ? (
                                        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Aún no has ganado insignias específicas.</p>
                                    ) : (
                                        insigniasTotales.map(ins => (
                                            <span key={ins} className={styles.badge} style={{ padding: '8px 12px' }}>
                                                {ins}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
