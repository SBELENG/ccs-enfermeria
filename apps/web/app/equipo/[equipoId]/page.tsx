'use client';
import { useEffect, useState, use } from 'react';
import { supabase } from '@ccs/supabase';
import type { Database } from '@ccs/supabase';
import Link from 'next/link';
import styles from './page.module.css';

type EquipoDB = Database['public']['Tables']['equipos']['Row'];
type DesafioDB = Database['public']['Tables']['desafios']['Row'];
type CheckinDB = Database['public']['Tables']['checkins']['Row'];
type UsuarioDB = Database['public']['Tables']['usuarios']['Row'];

export default function EquipoPage({ params }: { params: Promise<{ equipoId: string }> }) {
    const { equipoId } = use(params);
    const [equipo, setEquipo] = useState<EquipoDB | null>(null);
    const [desafio, setDesafio] = useState<DesafioDB | null>(null);
    const [miembros, setMiembros] = useState<(UsuarioDB & { rol_en_equipo: string })[]>([]);
    const [checkins, setCheckins] = useState<CheckinDB[]>([]);
    const [usuario, setUsuario] = useState<UsuarioDB | null>(null);
    const [texto, setTexto] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }

            const [{ data: u }, { data: eq }] = await Promise.all([
                supabase.from('usuarios').select('*').eq('id', user.id).single(),
                supabase.from('equipos').select('*').eq('id', equipoId).single() as any,
            ]);

            setUsuario(u);
            setEquipo(eq);

            if (eq) {
                const { data: des } = await supabase
                    .from('desafios').select('*').eq('id', eq.desafio_id).single();
                setDesafio(des);
            }

            const { data: chs } = await supabase
                .from('checkins')
                .select('*, usuario:usuarios(nombre, foto_url)')
                .eq('equipo_id', equipoId)
                .order('created_at', { ascending: false })
                .limit(20);
            setCheckins(chs ?? []);

            // Cargar miembros del equipo
            const { data: ms } = await supabase
                .from('equipo_miembros')
                .select('rol_en_equipo, usuario:usuarios(*)')
                .eq('equipo_id', equipoId);

            if (ms) {
                const flattedMs = ms.map((m: any) => ({
                    ...m.usuario,
                    rol_en_equipo: m.rol_en_equipo
                }));
                setMiembros(flattedMs);
            }

            setLoading(false);
        }
        cargar();
    }, [equipoId]);

    async function enviarCheckin() {
        if (!texto.trim() || !usuario) return;
        setSending(true);
        console.log("Enviando checkin:", { usuario_id: usuario.id, equipo_id: equipoId, resumen: texto.trim() });

        const { data: nuevo, error } = await supabase.from('checkins').insert({
            usuario_id: usuario.id,
            equipo_id: equipoId,
            resumen: texto.trim(),
        } as any).select().single();

        if (error) {
            console.error("Error al publicar checkin:", error);
            alert(`Error: ${error.message} (Código: ${error.code})`);
        } else if (nuevo) {
            const miRol = miembros.find(m => m.id === usuario.id)?.rol_en_equipo;
            // Inyectamos los datos del usuario y rol localmente
            const nuevoEnriquecido = {
                ...nuevo,
                usuario: { nombre: usuario.nombre, foto_url: usuario.foto_url },
                em: { rol_en_equipo: miRol }
            };
            setCheckins(prev => [nuevoEnriquecido, ...prev] as any);
            setTexto('');
        }
        setSending(false);
    }

    async function finalizarDesafio() {
        if (!usuario || !equipo) return;
        const esOrganizador = miembros.find(m => m.id === usuario.id)?.rol_en_equipo === 'organizador';
        if (!esOrganizador) {
            alert('Solo el Organizador puede dar por finalizado el desafío del equipo.');
            return;
        }

        if (!confirm('¿Finalizar desafío? Esto habilitará la fase de evaluación grupal.')) return;

        setSending(true);
        const { error } = await (supabase.from('equipos') as any).update({
            estado_entrega: true
        }).eq('id', equipoId);

        if (!error) {
            setEquipo(prev => prev ? { ...prev, estado_entrega: true } as any : null);
        } else {
            console.error("Error al finalizar desafío:", error);
            alert(`Error al finalizar: ${error.message}`);
        }
        setSending(false);
    }

    if (loading) return (
        <div className={styles.loadingWrap}>
            <div className={styles.spinner} /><p>Cargando equipo...</p>
        </div>
    );

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <Link href="/dashboard" className={styles.back}>← Panel</Link>
                    <div className={styles.headerCenter}>
                        <h1>{equipo?.nombre_equipo}</h1>
                        {desafio && <p>{desafio.titulo}</p>}
                    </div>
                    <Link href={`/kanban/${equipoId}`} className={styles.btnKanban} id="btn-ir-kanban">
                        📋 Kanban
                    </Link>
                    {equipo?.estado_entrega ? (
                        <Link href={`/evaluacion-360/${equipoId}`} className={styles.btnEval} id="btn-ir-evaluacion">
                            🏅 360°
                        </Link>
                    ) : (
                        <button className={styles.btnEvalDisabled} id="btn-ir-evaluacion-locked" title="El desafío debe estar finalizado para evaluar" disabled>
                            🔒 360° (Bloqueado)
                        </button>
                    )}
                </div>
            </header>

            <main className={styles.main}>
                {/* GUÍA DE ROL */}
                {usuario && miembros.find(m => m.id === usuario.id) && (
                    <div className={styles.roleGuide}>
                        {miembros.find(m => m.id === usuario.id)?.rol_en_equipo?.toLowerCase() === 'organizador' && (
                            <div className={styles.guideBox}>
                                <div className={styles.guideTitle}>🚀 Guía del Organizador</div>
                                <ul className={styles.guideList}>
                                    <li>1. Inicia realizando una propuesta de equipo.</li>
                                    <li>2. Continúas asignándole un nombre.</li>
                                    <li>3. Invitar a un <strong>Conciliador</strong> para armar el equipo ideal.</li>
                                </ul>
                            </div>
                        )}
                        {miembros.find(m => m.id === usuario.id)?.rol_en_equipo?.toLowerCase() === 'conciliador' && (
                            <div className={styles.guideBox}>
                                <div className={styles.guideTitle}>🤝 Guía del Conciliador</div>
                                <p>Tu tarea es equilibrar los talentos del equipo. Invitá a los perfiles que faltan desde la sección de <strong>Talentos</strong>.</p>
                            </div>
                        )}
                        {miembros.find(m => m.id === usuario.id)?.rol_en_equipo?.toLowerCase() === 'ejecutor' && (
                            <div className={`${styles.guideBox} ${styles.guideEjecutor}`}>
                                <div className={styles.guideTitle}>🛠️ Guía del Ejecutor</div>
                                <p>Tu responsabilidad principal es la **producción técnica**. Una vez que el Organizador finalice el desafío, recordá realizar la carga final en la plataforma oficial de la UNRC.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* AVISO DE TAREAS COMPARTIDAS */}
                {(() => {
                    const counts: Record<string, number> = {};
                    miembros.forEach(m => {
                        const r = m.rol_en_equipo?.toLowerCase() || 'miembro';
                        counts[r] = (counts[r] || 0) + 1;
                    });
                    const hasDuplicates = Object.values(counts).some(c => c > 1);
                    if (hasDuplicates) {
                        return (
                            <div className={styles.sharedTasksAlert}>
                                ⚠️ <strong>Tareas Compartidas:</strong> Hay más de un integrante con el mismo rol. Deberán coordinar la división de responsabilidades.
                            </div>
                        );
                    }
                    return null;
                })()}

                {/* Desafío info */}
                {desafio && (
                    <div className={styles.desafioCard}>
                        <div className={styles.desafioLeft}>
                            <div className={styles.desafioLabel}>Desafío activo</div>
                            <h2>{desafio.titulo}</h2>
                            <div className={styles.fechaRow}>
                                📅 Entrega: <strong>{new Date(desafio.fecha_entrega).toLocaleString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                            </div>
                            {((desafio as any).descripcion) && (
                                <div className={styles.desDescripcion}>
                                    {(desafio as any).descripcion}
                                </div>
                            )}
                            {desafio.documento_url && (
                                <a href={desafio.documento_url} target="_blank" rel="noopener noreferrer" className={styles.btnDirectDocMain}>
                                    📄 DESCARGAR CONSIGNAS TÉCNICAS (PDF/IMG)
                                </a>
                            )}
                        </div>
                        <div className={styles.desafioActions}>
                            <Link href={`/kanban/${equipoId}`} className={styles.btnGo}>
                                Sprint Board →
                            </Link>
                            {equipo?.estado_entrega ? (
                                <div className={styles.logradoBadge}>✓ Desafío logrado</div>
                            ) : (
                                <div className={styles.finishContainer}>
                                    <button
                                        className={styles.btnLogrado}
                                        onClick={finalizarDesafio}
                                        disabled={sending}
                                        title={miembros.find(m => m.id === usuario?.id)?.rol_en_equipo !== 'organizador' ? "Solo el Organizador puede finalizar" : ""}
                                    >
                                        {sending ? '...' : 'Desafío logrado ✓'}
                                    </button>
                                    {miembros.find(m => m.id === usuario?.id)?.rol_en_equipo !== 'organizador' && (
                                        <span className={styles.onlyOrgMsg}>Solo el Organizador puede dar el cierre final.</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Grid principal: Checkins + Miembros */}
                <div className={styles.contentGrid}>
                    <div className={styles.checkinSection}>
                        <h2>📝 Daily Check-in</h2>
                        <p className={styles.sub}>¿Qué hiciste hoy? Compartí tu avance.</p>

                        <div className={styles.checkinForm}>
                            <textarea
                                className={styles.checkinInput}
                                placeholder="Ej: Avancé con el diseño..."
                                value={texto}
                                onChange={e => setTexto(e.target.value)}
                                rows={2}
                            />
                            <button
                                className={styles.btnEnviar}
                                onClick={enviarCheckin}
                                disabled={sending || !texto.trim()}
                            >
                                {sending ? '...' : 'Publicar'}
                            </button>
                        </div>

                        <div className={styles.feed}>
                            {checkins.map(ch => {
                                const miembro = miembros.find(m => m.id === ch.usuario_id);
                                const rol = miembro?.rol_en_equipo || 'Miembro';
                                return (
                                    <div key={ch.id} className={styles.checkinItem}>
                                        <div className={styles.checkinAvatar}>
                                            {miembro?.foto_url
                                                ? <img src={miembro.foto_url} alt="Avatar" className={styles.avImg} />
                                                : (miembro?.nombre?.charAt(0) || '👤')
                                            }
                                        </div>
                                        <div className={styles.checkinBody}>
                                            <div className={styles.checkinMeta}>
                                                <strong>
                                                    {ch.usuario_id === usuario?.id ? 'Vos' : miembro?.nombre}
                                                    <span className={styles.checkinRol}> — {rol}</span>
                                                </strong>
                                                <span className={styles.checkinTime}>
                                                    {new Date(ch.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p>{ch.resumen}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className={styles.sidebar}>
                        <div className={styles.miembrosCard}>
                            <div className={styles.cardHeader}>
                                <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '1.2rem' }}>👥</span> Miembros
                                </h2>
                            </div>
                            <div className={styles.miembrosList}>
                                {miembros.map(m => (
                                    <div key={m.id} className={styles.miembroItem}>
                                        <div className={styles.mAvatar}>{m.nombre.charAt(0)}</div>
                                        <div className={styles.mInfo}>
                                            <div className={styles.mName}>{m.nombre} {m.id === usuario?.id && '(Vos)'}</div>
                                            <div className={styles.mRol}>{m.rol_en_equipo || 'Miembro'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Abandonar equipo */}
                        <button
                            className={styles.btnAbandonar}
                            onClick={async () => {
                                if (confirm('¿Estás seguro de que querés abandonar el equipo?')) {
                                    await (supabase.from('equipo_miembros') as any).delete().eq('equipo_id', equipoId).eq('usuario_id', usuario?.id);
                                    window.location.href = '/mis-equipos';
                                }
                            }}
                        >
                            Abandonar equipo
                        </button>
                    </div>
                </div>
            </main >
        </div >
    );
}
