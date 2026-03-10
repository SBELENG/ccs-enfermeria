'use client';
import { useState } from 'react';
import { TEST_SITUACIONAL, calcularResultadoTest, determinarRolesPrincipales } from '@ccs/logic';
import { ROLES, type RolKey } from '@ccs/ui';
import { supabase } from '@ccs/supabase';
import RadarChart from '../components/RadarChart';
import styles from './page.module.css';

type Fase = 'intro' | 'pregunta' | 'resultado' | 'seleccion';

export default function TestPage() {
    const [fase, setFase] = useState<Fase>('intro');
    const [pregActual, setPregActual] = useState(0);
    const [respuestas, setRespuestas] = useState<Record<string, string>>({});
    const [opcionSel, setOpcionSel] = useState<string | null>(null);
    const [resultado, setResultado] = useState<{ primario: RolKey; secundario: RolKey; scores: Record<RolKey, number> } | null>(null);
    const [tienesSesion, setTienesSesion] = useState(false);
    const [prefSel, setPrefSel] = useState<'primario' | 'secundario'>('primario');
    const [guardando, setGuardando] = useState(false);

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

            const { data: { user } } = await supabase.auth.getUser();
            if (user) setTienesSesion(true);
        }
    }

    async function guardarPerfil() {
        if (!resultado || guardando) return;
        setGuardando(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const rolElegido = prefSel === 'primario' ? resultado.primario : resultado.secundario;

                console.log("Guardando perfil... Payload:", { id: user.id, primario: resultado.primario });
                const { error: errorUpdate } = await supabase.from('usuarios').upsert({
                    id: user.id,
                    nombre: user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario',
                    email: user.email,
                    resultados_test: resultado.scores,
                    rol_primario: resultado.primario,
                    rol_secundario: resultado.secundario,
                    preferencia_rol_busqueda: prefSel,
                    buscando_equipo: true
                } as any);

                if (errorUpdate) {
                    console.error("Error al guardar perfil:", errorUpdate);
                    alert("Error al guardar tu perfil profesional: " + errorUpdate.message);
                    setGuardando(false);
                    return;
                }

                console.log("Perfil guardado. Sincronizando inscripciones...");
                // Sincronizar con inscripciones previas que no tengan rol
                const { error: errorSinc } = await (supabase.from('inscripciones') as any)
                    .update({ rol_activo: rolElegido })
                    .eq('usuario_id', user.id)
                    .is('rol_activo', null);

                if (errorSinc) {
                    console.error("Error al sincronizar inscripciones:", errorSinc);
                }

                console.log("Todo OK. Redirigiendo al Dashboard...");
                window.location.href = '/dashboard';
            } else {
                window.location.href = '/registro';
            }
        } catch (err) {
            console.error("Error inesperado en guardarPerfil:", err);
            alert("Ocurrió un error inesperado. Por favor recargá la página e intentá de nuevo.");
            setGuardando(false);
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

    // — SELECCION —
    if (fase === 'seleccion' && resultado) {
        const rolP = ROLES[resultado.primario];
        const rolS = ROLES[resultado.secundario];

        return (
            <div className={styles.wrap}>
                <div className={styles.resultCard}>
                    <div className={styles.resultHeader}>
                        <h1>Elegí tu Perfil de Búsqueda</h1>
                        <p>¿Cómo preferís que te vean tus compañeros en el listado de Talentos?</p>
                    </div>

                    <div className={styles.seleccionGrid}>
                        <button
                            className={`${styles.selBtn} ${prefSel === 'primario' ? styles.selBtnActive : ''}`}
                            onClick={() => setPrefSel('primario')}
                            style={{ '--rc': rolP.color } as React.CSSProperties}
                        >
                            <div className={styles.rolIcon}>{rolP.icon}</div>
                            <div className={styles.rolNombre}>{rolP.label}</div>
                            <span className={styles.rolLabel}>Rol Primario (Dominante)</span>
                        </button>

                        <button
                            className={`${styles.selBtn} ${prefSel === 'secundario' ? styles.selBtnActive : ''}`}
                            onClick={() => setPrefSel('secundario')}
                            style={{ '--rc': rolS.color } as React.CSSProperties}
                        >
                            <div className={styles.rolIcon}>{rolS.icon}</div>
                            <div className={styles.rolNombre}>{rolS.label}</div>
                            <span className={styles.rolLabel}>Rol Secundario (Apoyo)</span>
                        </button>
                    </div>

                    <div className={styles.resultCtas} style={{ marginTop: '24px' }}>
                        <button className={styles.btnPrimary} onClick={guardarPerfil} disabled={guardando}>
                            {guardando ? 'Guardando Perfil...' : 'Confirmar y Ver Dashboard →'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // — RESULTADO —
    if (fase === 'resultado' && resultado) {
        const rolP = ROLES[resultado.primario];
        const rolS = ROLES[resultado.secundario];

        return (
            <div className={styles.wrap}>
                <div className={styles.resultCard}>
                    <div className={styles.resultHeader}>
                        <h1>Tu Perfil CCS</h1>
                        <p>Basado en tus respuestas, este es tu rol dominante en el trabajo en equipo.</p>
                    </div>

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
                        <button onClick={() => setFase('seleccion')} className={styles.btnPrimary} id="btn-continuar-seleccion">
                            Continuar a selección de perfil →
                        </button>
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
