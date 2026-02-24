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
                .from('checkins').select('*')
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
        const { data: nuevo } = await supabase.from('checkins').insert({
            usuario_id: usuario.id,
            equipo_id: equipoId,
            resumen: texto.trim(),
        } as any).select().single();
        if (nuevo) setCheckins(prev => [nuevo, ...prev]);
        setTexto('');
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
        // Capturar snapshot del Kanban
        const { data: tareas } = await supabase.from('tareas').select('*').eq('equipo_id', equipoId);

        const { error } = await (supabase.from('equipos') as any).update({
            estado_entrega: true,
            snapshot_kanban: tareas || []
        }).eq('id', equipoId);

        if (!error) {
            setEquipo(prev => prev ? { ...prev, estado_entrega: true, snapshot_kanban: tareas || [] } as any : null);
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
                    <Link href={`/evaluacion-360/${equipoId}`} className={styles.btnEval} id="btn-ir-evaluacion">
                        🏅 360°
                    </Link>
                </div>
            </header>

            <main className={styles.main}>
                {/* Desafío info */}
                {desafio && (
                    <div className={styles.desafioCard}>
                        <div className={styles.desafioLeft}>
                            <div className={styles.desafioLabel}>Desafío activo</div>
                            <h2>{desafio.titulo}</h2>
                            <div className={styles.fechaRow}>
                                📅 Entrega: <strong>{new Date(desafio.fecha_entrega).toLocaleString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                            </div>
                            {desafio.documento_url && (
                                <a href={desafio.documento_url} target="_blank" rel="noopener noreferrer" className={styles.docLink}>
                                    📄 Descargar Documentación técnica
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
                                <button className={styles.btnLogrado} onClick={finalizarDesafio} disabled={sending}>
                                    {sending ? '...' : 'Desafío logrado ✓'}
                                </button>
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
                            {checkins.map(ch => (
                                <div key={ch.id} className={styles.checkinItem}>
                                    <div className={styles.checkinAvatar}>
                                        {ch.usuario_id === usuario?.id ? usuario.nombre.charAt(0) : '👤'}
                                    </div>
                                    <div className={styles.checkinBody}>
                                        <div className={styles.checkinMeta}>
                                            <strong>{ch.usuario_id === usuario?.id ? 'Vos' : 'Compañero/a'}</strong>
                                            <span className={styles.checkinTime}>
                                                {new Date(ch.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p>{ch.resumen}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.sidebar}>
                        <div className={styles.miembrosCard}>
                            <div className={styles.cardHeader}>
                                <h2>👥 Miembros</h2>
                                <Link href="/marketplace" className={styles.btnInvitar}>+ Invitar</Link>
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
            </main>
        </div>
    );
}
