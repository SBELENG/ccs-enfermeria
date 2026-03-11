'use client';
import { useEffect, useState, use } from 'react';
import { supabase } from '@ccs/supabase';
import { ROLES, type RolKey } from '@ccs/ui';
import type { Database } from '@ccs/supabase';
import Link from 'next/link';
import styles from './page.module.css';

type UsuarioDB = Database['public']['Tables']['usuarios']['Row'];
type EquipoDB = Database['public']['Tables']['equipos']['Row'];

const PREGUNTAS_QUE = [
    'Cumplió con las tareas asignadas en el tiempo acordado',
    'Aportó ideas concretas y útiles para el grupo',
    'Produjo entregables de calidad dentro del equipo',
    'Tomó iniciativa cuando el grupo lo necesitaba',
];

const PREGUNTAS_COMO = [
    'Comunicó con claridad sus avances y bloqueos',
    'Escuchó y consideró las ideas de los demás',
    'Contribuyó al buen clima del equipo',
    'Resolución constructiva de conflictos o diferencias',
];

type Puntaje = Record<string, number>; // preguntaId → 1..5

export default function Evaluacion360Page({ params }: { params: Promise<{ equipoId: string }> }) {
    const { equipoId } = use(params);

    const [yo, setYo] = useState<UsuarioDB | null>(null);
    const [equipo, setEquipo] = useState<EquipoDB | null>(null);
    const [miembros, setMiembros] = useState<UsuarioDB[]>([]);
    const [evaluando, setEvaluando] = useState<string | null>(null); // userId del par
    const [puntajes, setPuntajes] = useState<Puntaje>({});
    const [comentario, setComentario] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [enviadas, setEnviadas] = useState<Set<string>>(new Set());
    const [done, setDone] = useState(false);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }

            const { data: u } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
            setYo(u);

            const { data: eq } = await supabase.from('equipos').select('*').eq('id', equipoId).single();
            setEquipo(eq);

            if (eq && !(eq as any).estado_entrega) {
                alert('El desafío debe estar finalizado para acceder a la evaluación 360°.');
                window.location.href = `/equipo/${equipoId}`;
                return;
            }

            // Miembros del equipo (excluye al propio usuario)
            const { data: miembrosRaw } = await supabase
                .from('equipo_miembros')
                .select('usuario_id')
                .eq('equipo_id', equipoId)
                .neq('usuario_id', user.id);

            if (miembrosRaw && (miembrosRaw as any[]).length > 0) {
                const ids = (miembrosRaw as any[]).map(m => m.usuario_id);
                const { data: users } = await supabase.from('usuarios').select('*').in('id', [...ids, user.id]);
                setMiembros(users ?? []);
            }

            // Ver cuáles ya fueron evaluados por este usuario
            const { data: yaEnv } = await (supabase.from('evaluaciones_360') as any)
                .select('evaluado_id')
                .eq('evaluador_id', user.id)
                .eq('equipo_id', equipoId);
            setEnviadas(new Set((yaEnv as any[])?.map((e: any) => e.evaluado_id) ?? []));

            setLoading(false);
        }
        cargar();
    }, [equipoId]);

    function setPunt(id: string, valor: number) {
        setPuntajes(prev => ({ ...prev, [id]: valor }));
    }

    const todasRespondidas = () => {
        const todas = [...PREGUNTAS_QUE, ...PREGUNTAS_COMO].map((_, i) => `p${i}`);
        return todas.every(id => puntajes[id] !== undefined);
    };

    async function enviarEvaluacion() {
        if (!yo || !evaluando || !todasRespondidas()) return;
        setSaving(true);

        // Calcular promedios
        const queKeys = PREGUNTAS_QUE.map((_, i) => `p${i}`);
        const comoKeys = PREGUNTAS_COMO.map((_, i) => `p${PREGUNTAS_QUE.length + i}`);
        const avgQue = queKeys.reduce((s, k) => s + (puntajes[k] ?? 0), 0) / PREGUNTAS_QUE.length;
        const avgComo = comoKeys.reduce((s, k) => s + (puntajes[k] ?? 0), 0) / PREGUNTAS_COMO.length;

        const { error } = await (supabase.from('evaluaciones_360') as any).insert({
            evaluador_id: yo.id,
            evaluado_id: evaluando,
            equipo_id: equipoId,
            puntaje_que: Math.round(avgQue * 10) / 10,
            puntaje_como: Math.round(avgComo * 10) / 10,
            comentario: comentario.trim() || null,
            respuestas: puntajes,
            es_autoevaluacion: yo.id === evaluando
        });

        if (error) {
            console.error("Error al guardar evaluación:", error);
            alert(`Error al guardar: ${error.message} (Código: ${error.code})`);
            setSaving(false);
            return;
        }

        setEnviadas(prev => new Set([...prev, evaluando]));
        setEvaluando(null);
        setPuntajes({});
        setComentario('');
        setSaving(false);

        // Verificar si ya evaluó a todos
        if (enviadas.size + 1 >= miembros.length) setDone(true);
    }

    if (loading) return (
        <div className={styles.loadingWrap}><div className={styles.spinner} /><p>Cargando...</p></div>
    );

    if (done || (miembros.length > 0 && enviadas.size >= miembros.length)) return (
        <div className={styles.completadoWrap}>
            <div className={styles.completadoCard}>
                <div className={styles.completadoIcon}>🏅</div>
                <h1>¡Evaluación completada!</h1>
                <p>Ya evaluaste a todos tus compañeros. Tus respuestas ayudan a mejorar la colaboración del equipo.</p>
                <Link href={`/evaluacion-360/${equipoId}/resultados`} className={styles.btnResultados}>
                    Ver mis resultados →
                </Link>
                <Link href="/dashboard" className={styles.btnVolver}>
                    Volver al panel
                </Link>
            </div>
        </div>
    );

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <Link href="/dashboard" className={styles.back}>← Panel</Link>
                    <div className={styles.headerCenter}>
                        <h1>Evaluación 360°</h1>
                        <p>{equipo?.nombre_equipo}</p>
                    </div>
                    <div className={styles.progress360}>
                        {enviadas.size}/{miembros.length} enviadas
                    </div>
                </div>
            </header>

            {/* Formulario activo */}
            {evaluando ? (
                <main className={styles.formMain}>
                    <div className={styles.formCard}>
                        <div className={styles.formEvaluado}>
                            Evaluando a: <strong>{miembros.find(m => m.id === evaluando)?.nombre}</strong>
                        </div>

                        {/* QUÉ hizo */}
                        <div className={styles.dimensionBlock}>
                            <div className={styles.dimensionTitle}>
                                <span className={styles.dimensionIcon}>🎯</span>
                                <div>
                                    <h2>¿Qué hizo?</h2>
                                    <p>Contribución concreta al trabajo del equipo</p>
                                </div>
                            </div>
                            {PREGUNTAS_QUE.map((preg, i) => (
                                <div key={i} className={styles.pregunta}>
                                    <p className={styles.preguntaTxt}>{preg}</p>
                                    <div className={styles.estrellas}>
                                        {[1, 2, 3, 4, 5].map(v => (
                                            <button
                                                key={v}
                                                className={`${styles.estrella} ${(puntajes[`p${i}`] ?? 0) >= v ? styles.estrellaOn : ''}`}
                                                onClick={() => setPunt(`p${i}`, v)}
                                                title={['Muy bajo', 'Bajo', 'Regular', 'Bueno', 'Excelente'][v - 1]}
                                            >★</button>
                                        ))}
                                        <span className={styles.estrellaLabel}>
                                            {puntajes[`p${i}`] ? ['Muy bajo', 'Bajo', 'Regular', 'Bueno', 'Excelente'][puntajes[`p${i}`] - 1] : '—'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* CÓMO colaboró */}
                        <div className={styles.dimensionBlock}>
                            <div className={styles.dimensionTitle}>
                                <span className={styles.dimensionIcon}>🤝</span>
                                <div>
                                    <h2>¿Cómo colaboró?</h2>
                                    <p>Calidad del vínculo y comunicación grupal</p>
                                </div>
                            </div>
                            {PREGUNTAS_COMO.map((preg, i) => {
                                const key = `p${PREGUNTAS_QUE.length + i}`;
                                return (
                                    <div key={i} className={styles.pregunta}>
                                        <p className={styles.preguntaTxt}>{preg}</p>
                                        <div className={styles.estrellas}>
                                            {[1, 2, 3, 4, 5].map(v => (
                                                <button
                                                    key={v}
                                                    className={`${styles.estrella} ${(puntajes[key] ?? 0) >= v ? styles.estrellaOn : ''}`}
                                                    onClick={() => setPunt(key, v)}
                                                    title={['Muy bajo', 'Bajo', 'Regular', 'Bueno', 'Excelente'][v - 1]}
                                                >★</button>
                                            ))}
                                            <span className={styles.estrellaLabel}>
                                                {puntajes[key] ? ['Muy bajo', 'Bajo', 'Regular', 'Bueno', 'Excelente'][puntajes[key] - 1] : '—'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Comentario libre */}
                        <div className={styles.comentarioBlock}>
                            <label className={styles.comentarioLabel}>Comentario (opcional)</label>
                            <textarea
                                className={styles.comentarioInput}
                                placeholder="¿Algo más que te gustaría destacar o sugerir?"
                                value={comentario}
                                onChange={e => setComentario(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className={styles.formActions}>
                            <button className={styles.btnCancelar} onClick={() => { setEvaluando(null); setPuntajes({}); }}>
                                Cancelar
                            </button>
                            <button
                                className={styles.btnEnviar}
                                onClick={enviarEvaluacion}
                                disabled={saving || !todasRespondidas()}
                            >
                                {saving ? 'Enviando...' : 'Enviar evaluación ✓'}
                            </button>
                        </div>
                    </div>
                </main>
            ) : (
                /* Lista de compañeros */
                <main className={styles.listaMain}>
                    <p className={styles.instruccion}>
                        Evaluá la contribución de cada compañero/a al trabajo grupal de forma anónima y constructiva.
                    </p>

                    <div className={styles.miembrosGrid}>
                        {miembros.map(m => {
                            const yaEnv = enviadas.has(m.id);
                            return (
                                <div key={m.id} className={`${styles.miembroCard} ${yaEnv ? styles.evaluado : ''}`}>
                                    <div className={styles.miembroAvatar}>
                                        {m.nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={styles.miembroInfo}>
                                        <strong>{m.nombre}{m.id === yo?.id ? ' (Yo)' : ''}</strong>
                                        {m.rol_primario && (
                                            <span className={styles.rolTag}>
                                                {ROLES[m.rol_primario as RolKey]?.icon} {ROLES[m.rol_primario as RolKey]?.label}
                                            </span>
                                        )}
                                    </div>
                                    {yaEnv ? (
                                        <div className={styles.evaluadoBadge}>✅ Enviada</div>
                                    ) : (
                                        <button
                                            className={styles.btnIniciar}
                                            onClick={() => setEvaluando(m.id)}
                                            id={`btn-evaluar-${m.id}`}
                                        >
                                            Evaluar →
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {miembros.length === 0 && (
                        <div className={styles.emptyState}>
                            <p>No hay compañeros para evaluar en este equipo.</p>
                        </div>
                    )}
                </main>
            )}
        </div>
    );
}
