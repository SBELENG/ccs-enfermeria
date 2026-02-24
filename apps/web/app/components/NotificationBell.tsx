'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@ccs/supabase';
import type { Database } from '@ccs/supabase';
import styles from './NotificationBell.module.css';

type Notif = Database['public']['Tables']['notificaciones']['Row'];

export default function NotificationBell({ userId }: { userId: string }) {
    const [notifs, setNotifs] = useState<Notif[]>([]);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const noLeidas = notifs.filter(n => !n.leida).length;

    useEffect(() => {
        // Cargar notificaciones iniciales
        supabase
            .from('notificaciones')
            .select('*')
            .eq('usuario_id', userId)
            .order('created_at', { ascending: false })
            .limit(20)
            .then(({ data }) => setNotifs(data ?? []));

        // Realtime: escuchar nuevas notificaciones
        const channel = supabase
            .channel(`notif-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notificaciones',
                    filter: `usuario_id=eq.${userId}`,
                },
                (payload) => {
                    setNotifs(prev => [payload.new as Notif, ...prev]);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
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
        setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
        await supabase.from('notificaciones').update({ leida: true }).eq('id', id);
    }

    async function marcarTodasLeidas() {
        setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
        await supabase.from('notificaciones').update({ leida: true }).eq('usuario_id', userId);
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
                className={styles.bell}
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
                <div className={styles.dropdown}>
                    <div className={styles.dropHeader}>
                        <span>Notificaciones</span>
                        {noLeidas > 0 && (
                            <button className={styles.markAll} onClick={marcarTodasLeidas}>
                                Marcar todas como leídas
                            </button>
                        )}
                    </div>

                    {notifs.length === 0 ? (
                        <div className={styles.empty}>
                            <span>🔕</span>
                            <p>No tenés notificaciones</p>
                        </div>
                    ) : (
                        <ul className={styles.list}>
                            {notifs.map(n => (
                                <li
                                    key={n.id}
                                    className={`${styles.item} ${!n.leida ? styles.unread : ''}`}
                                    onClick={() => !n.leida && marcarLeida(n.id)}
                                >
                                    <div className={styles.itemIcon}>
                                        {n.tipo === 'contacto' ? '✉️' : '🔔'}
                                    </div>
                                    <div className={styles.itemBody}>
                                        <p className={styles.itemMsg}>{n.mensaje}</p>
                                        <span className={styles.itemTime}>{formatTime(n.created_at)}</span>
                                    </div>
                                    {!n.leida && <div className={styles.dot} />}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
