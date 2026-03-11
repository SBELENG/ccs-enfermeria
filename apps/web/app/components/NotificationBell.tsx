'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@ccs/supabase';
import type { Database } from '@ccs/supabase';
import styles from './NotificationBell.module.css';

type Notif = Database['public']['Tables']['notificaciones']['Row'];

export default function NotificationBell({ userId, initialCounts }: { userId: string, initialCounts?: { notifs: number, invs: number } }) {
    const [notifs, setNotifs] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // El conteo real es el máximo entre la carga interna y lo que la Sidebar ya calculó
    const noLeidasInternas = notifs.filter(n => !n.leida).length;
    const noLeidas = Math.max(noLeidasInternas, (initialCounts?.notifs || 0) + (initialCounts?.invs || 0));

    useEffect(() => {
        if (!userId) return;

        // Cargar notificaciones e invitaciones (Sistema Híbrido)
        async function cargar() {
            // 1. Cargar notificaciones tradicionales
            const { data: nData } = await supabase.from('notificaciones').select('*').eq('usuario_id', userId).order('created_at', { ascending: false }).limit(20);

            // 2. Cargar solicitudes de equipo (invitaciones) pendientes
            const { data: sData } = await supabase.from('solicitudes_equipo').select('*, remitente:usuarios(nombre), equipo:equipos(nombre_equipo)').eq('usuario_id', userId).eq('estado', 'pendiente');

            const normalizadas = (nData || []).map((n: any) => ({ ...n, source: 'notif' }));

            // Transformar solicitudes en notificaciones si no existe una ya vinculada
            const sDataArray = (sData as any[]) || [];
            const virtuales = sDataArray
                .filter(s => !normalizadas.some(n => n.equipo_id === s.equipo_id && n.tipo === s.tipo))
                .map(s => ({
                    id: s.id,
                    usuario_id: s.usuario_id,
                    remitente_id: s.remitente_id,
                    tipo: s.tipo,
                    mensaje: s.mensaje || `${s.remitente?.nombre || 'Alguien'} te envió una ${s.tipo === 'invitacion' ? 'invitación' : 'señal de interés'}`,
                    leida: false,
                    created_at: s.created_at,
                    equipo_id: s.equipo_id,
                    estado: 'pendiente',
                    source: 'solicitud'
                }));

            // Unificar y ordenar
            const unificadas = [...(normalizadas || []), ...(virtuales || [])].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setNotifs(unificadas);
        }
        cargar();

        // Realtime: escuchar nuevas notificaciones
        const channel = supabase
            .channel(`notif-bell-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${userId}` }, () => cargar())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_equipo', filter: `usuario_id=eq.${userId}` }, () => cargar())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    // Cerrar dropdown al click fuera
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    async function marcarLeida(id: string) {
        // Optimistic update
        setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));

        // Database update
        await (supabase.from('notificaciones') as any).update({ leida: true }).eq('id', id);

        // Emitir evento para que el Sidebar (o cualquier otro componente) se entere
        window.dispatchEvent(new CustomEvent('notif-read', { detail: { id } }));
    }

    async function marcarTodasLeidas() {
        setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
        await (supabase.from('notificaciones') as any).update({ leida: true }).eq('usuario_id', userId);
        window.dispatchEvent(new CustomEvent('notif-read-all'));
    }

    async function responderInvitacion(n: any, accion: 'aceptado' | 'rechazado') {
        const nId = n.id;
        const source = n.source;

        if (accion === 'aceptado' && n.equipo_id) {
            // 1. Obtener rol propuesto o primario
            const { data: u } = await supabase.from('usuarios').select('rol_primario').eq('id', userId).single();
            const rolParaUnirse = n.rol_invitado || (u as any)?.rol_primario || 'ejecutor';

            // 2. Unirse al equipo
            const { error: errJoin } = await (supabase.from('equipo_miembros') as any).insert({
                equipo_id: n.equipo_id,
                usuario_id: userId,
                rol_en_equipo: rolParaUnirse
            });

            if (!errJoin || errJoin.code === '23505') {
                // ASEGURAR INSCRIPCIÓN EN LA CÁTEDRA
                const { data: eq } = await (supabase.from('equipos') as any)
                    .select('desafio:desafios(catedra_id)')
                    .eq('id', n.equipo_id)
                    .single();

                if ((eq as any)?.desafio?.catedra_id) {
                    await (supabase.from('inscripciones') as any).upsert({
                        usuario_id: userId,
                        catedra_id: (eq as any).desafio.catedra_id,
                        rol_activo: rolParaUnirse
                    }, { onConflict: 'usuario_id, catedra_id' });
                }
            } else {
                alert(`Error: ${errJoin.message}`);
                return;
            }
            // Desactivar buscando equipo
            await (supabase.from('usuarios') as any).update({ buscando_equipo: false }).eq('id', userId);
        }

        // Actualizar estado local
        setNotifs(prev => prev.map(item => item.id === nId ? { ...item, estado: accion, leida: true } : item));

        const tabla = source === 'solicitud' ? 'solicitudes_equipo' : 'notificaciones';
        const updates = source === 'solicitud'
            ? { estado: accion === 'aceptado' ? 'aceptada' : 'rechazada' }
            : { estado: accion, leida: true };

        await (supabase.from(tabla) as any).update(updates).eq('id', nId);

        if (accion === 'aceptado') window.location.href = '/mis-equipos';
    }

    function formatTime(iso: string) {
        const d = new Date(iso);
        const now = new Date();
        const diff = Math.floor((now.getTime() - d.getTime()) / 60000); // minutos
        if (diff < 1) return 'Ahora';
        if (diff < 60) return `Hace ${diff} min`;
        if (diff < 1440) return `Hace ${Math.floor(diff / 60)}h`;
        return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    }

    return (
        <div className={styles.wrap} ref={ref}>
            <button
                className={`${styles.bell} ${noLeidas > 0 ? styles.shake : ''}`}
                onClick={() => setOpen(o => !o)}
                aria-label={`Notificaciones${noLeidas > 0 ? ` (${noLeidas} nuevas)` : ''}`}
                id="btn-notificaciones"
            >
                🔔
                {noLeidas > 0 && (
                    <span className={styles.badge}>{noLeidas > 9 ? '9+' : noLeidas}</span>
                )}
            </button>

            {open && (
                <div className={styles.overlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2>🔔 Centro de Notificaciones</h2>
                            <div className={styles.headerActions}>
                                {noLeidas > 0 && (
                                    <button className={styles.markAll} onClick={marcarTodasLeidas}>
                                        Marcar todas como leídas
                                    </button>
                                )}
                                <button className={styles.btnClose} onClick={() => setOpen(false)}>✕</button>
                            </div>
                        </div>

                        <div className={styles.modalBody}>
                            {notifs.length === 0 ? (
                                <div className={styles.empty}>
                                    <span>🔕</span>
                                    <p>No tenés notificaciones aún</p>
                                </div>
                            ) : (
                                <div className={styles.scrollArea}>
                                    {notifs.map(n => (
                                        <div
                                            key={n.id}
                                            className={`${styles.item} ${!n.leida ? styles.unread : ''}`}
                                            onClick={() => {
                                                if (!n.leida) marcarLeida(n.id);
                                                if (n.tipo === 'invitacion' || n.tipo === 'interes_formal') {
                                                    window.location.href = '/mis-equipos';
                                                    setOpen(false);
                                                }
                                            }}
                                        >
                                            <div className={styles.itemIcon}>
                                                {n.tipo === 'contacto' ? '💬' : (n.tipo === 'invitacion' || n.tipo === 'interes_formal') ? '🤝' : '🔔'}
                                            </div>
                                            <div className={styles.itemContent}>
                                                <p className={styles.itemMsg}>{n.mensaje}</p>
                                                <div className={styles.itemMeta}>
                                                    <span className={styles.itemTime}>{formatTime(n.created_at)}</span>
                                                    <div className={styles.metaActions}>
                                                        {!n.leida && (
                                                            <button
                                                                className={styles.btnCheck}
                                                                title="Marcar como leído"
                                                                onClick={(e) => { e.stopPropagation(); marcarLeida(n.id); }}
                                                            >
                                                                ✓
                                                            </button>
                                                        )}
                                                        {(n as any).estado !== 'pendiente' && (n.tipo === 'invitacion' || n.tipo === 'interes_formal') && (
                                                            <span className={styles.statusBadge}>
                                                                {(n as any).estado === 'aceptado' ? '✅ Aceptada' : '❌ Rechazada'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Botones de acción si es invitación y está pendiente */}
                                                {(n.tipo === 'invitacion' || n.tipo === 'interes_formal') && (n as any).estado === 'pendiente' && (
                                                    <div className={styles.notifActions}>
                                                        <button
                                                            className={styles.btnAceptar}
                                                            onClick={(e) => { e.stopPropagation(); responderInvitacion(n, 'aceptado'); }}
                                                        >
                                                            Aceptar →
                                                        </button>
                                                        <button
                                                            className={styles.btnRechazar}
                                                            onClick={(e) => { e.stopPropagation(); responderInvitacion(n, 'rechazado'); }}
                                                        >
                                                            Rechazar
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {!n.leida && <div className={styles.dot} />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
