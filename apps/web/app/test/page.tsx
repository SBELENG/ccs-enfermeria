'use client';
import { useState } from 'react';
import { TEST_SITUACIONAL, calcularResultadoTest, determinarRolesPrincipales } from '@ccs/logic';
import { ROLES, type RolKey } from '@ccs/ui';
import { supabase } from '@ccs/supabase';
import RadarChart from '../components/RadarChart';
import styles from './page.module.css';

type Fase = 'intro' | 'pregunta' | 'resultado';

export default function TestPage() {
    const [fase, setFase] = useState<Fase>('intro');
    const [pregActual, setPregActual] = useState(0);
    const [respuestas, setRespuestas] = useState<Record<string, string>>({});
    const [opcionSel, setOpcionSel] = useState<string | null>(null);
    const [resultado, setResultado] = useState<{ primario: RolKey; secundario: RolKey; scores: Record<RolKey, number> } | null>(null);
    const [tienesSesion, setTienesSesion] = useState(false);

    const totalPreguntas = TEST_SITUACIONAL.length;
    const pregunta = TEST_SITUACIONAL[pregActual];

    function handleSeleccionar(opcionId: string) {
        setOpcionSel(opcionId);
    }

    async function handleSiguiente() {
        if (!opcionSel) return;
        const nuevasResp = { ...respuestas, [pregunta.id]: opcionSel };
        setRespuestas(nuevasResp);
        setOpcionSel(null);

        if (pregActual + 1 < totalPreguntas) {
            setPregActual(p => p + 1);
        } else {
            const scores = calcularResultadoTest(nuevasResp, TEST_SITUACIONAL) as Record<RolKey, number>;
            const { primario, secundario } = determinarRolesPrincipales(scores);
            setResultado({ primario, secundario, scores });
            setFase('resultado');

            // Guardar en la BD si el usuario está autenticado
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setTienesSesion(true);
                await supabase.from('usuarios').update({
                    resultados_test: scores,
                    rol_primario: primario,
                    rol_secundario: secundario,
                }).eq('id', user.id);
            }
        }
    }

    // — INTRO —
    if (fase === 'intro') return (
        <div className={styles.wrap}>
            <div className={styles.introCard}>
                <div className={styles.introIcon}>🧪</div>
                <h1>Test de Perfil Profesional</h1>
                <p>4 situaciones del mundo académico sanitario. Elegí la respuesta que se parezca más a tu forma natural de actuar en grupo.</p>
                <ul className={styles.introTips}>
                    <li>✔ No hay respuestas correctas ni incorrectas</li>
                    <li>✔ Respondé con honestidad, no con lo que "debería" hacer</li>
                    <li>✔ Tardás menos de 3 minutos</li>
                </ul>
                <button className={styles.btnStart} onClick={() => setFase('pregunta')} id="btn-comenzar-test">
                    Comenzar →
                </button>
            </div>
        </div>
    );

    // — RESULTADO —
    if (fase === 'resultado' && resultado) {
        const rolP = ROLES[resultado.primario];
        const rolS = ROLES[resultado.secundario];
        const maxScore = Math.max(...Object.values(resultado.scores));

        return (
            <div className={styles.wrap}>
                <div className={styles.resultCard}>
                    <div className={styles.resultHeader}>
                        <h1>Tu Perfil CCS</h1>
                        <p>Basado en tus respuestas, este es tu rol dominante en el trabajo en equipo.</p>
                    </div>


                    {/* Layout dos columnas: roles + radar */}
                    <div className={styles.resultGrid}>
                        <div className={styles.rolesCol}>
                            <div className={styles.rolPrimario} style={{ '--rc': rolP.color } as React.CSSProperties}>
                                <div className={styles.rolIcon}>{rolP.icon}</div>
                                <div>
                                    <div className={styles.rolLabel}>Rol Primario</div>
                                    <div className={styles.rolNombre}>{rolP.label}</div>
                                </div>
                            </div>

                            <div className={styles.rolSecundario} style={{ '--rc': rolS.color } as React.CSSProperties}>
                                <div className={styles.rolIcon}>{rolS.icon}</div>
                                <div>
                                    <div className={styles.rolLabel}>Rol Secundario</div>
                                    <div className={styles.rolNombre}>{rolS.label}</div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.radarCol}>
                            <h3 className={styles.radarTitle}>Distribución de Competencias</h3>
                            <RadarChart scores={resultado.scores} size={220} />
                        </div>
                    </div>

                    <div className={styles.resultCtas}>
                        {tienesSesion ? (
                            <a href="/dashboard" className={styles.btnPrimary} id="btn-resultado-dashboard">
                                Ver mi Dashboard →
                            </a>
                        ) : (
                            <>
                                <a href="/ingresar" className={styles.btnPrimary} id="btn-resultado-ingresar">
                                    Ingresar para guardar mi perfil →
                                </a>
                                <a href="/registro" className={styles.btnGhost} id="btn-resultado-registro">
                                    Crear cuenta
                                </a>
                            </>
                        )}
                        <button className={styles.btnGhost} onClick={() => { setFase('intro'); setPregActual(0); setRespuestas({}); setResultado(null); setTienesSesion(false); }}>
                            Repetir test
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // — PREGUNTA —
    const pct = Math.round(((pregActual) / totalPreguntas) * 100);
    return (
        <div className={styles.wrap}>
            <div className={styles.preguntaCard}>
                {/* Progress */}
                <div className={styles.progressRow}>
                    <span className={styles.progressLabel}>Pregunta {pregActual + 1} de {totalPreguntas}</span>
                    <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                    </div>
                </div>

                <h2 className={styles.preguntaTexto}>{pregunta.texto}</h2>

                <div className={styles.opciones}>
                    {pregunta.opciones.map(op => (
                        <button
                            key={op.id}
                            id={`opcion-${op.id}`}
                            className={`${styles.opcionBtn} ${opcionSel === op.id ? styles.opcionSel : ''}`}
                            onClick={() => handleSeleccionar(op.id)}
                        >
                            {op.texto}
                        </button>
                    ))}
                </div>

                <button
                    className={styles.btnSiguiente}
                    onClick={handleSiguiente}
                    disabled={!opcionSel}
                    id="btn-siguiente-pregunta"
                >
                    {pregActual + 1 < totalPreguntas ? 'Siguiente →' : 'Ver mi resultado →'}
                </button>
            </div>
        </div>
    );
}
