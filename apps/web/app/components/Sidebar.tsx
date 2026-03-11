'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@ccs/supabase';
import styles from './Sidebar.module.css';
import NotificationBell from './NotificationBell';
import { sanitizeFileName } from '../lib/utils';

import { ROLES, type RolKey } from '@ccs/ui';

interface SidebarProps {
    userId: string;
    userName: string;
    userEmail: string;
    userAvatar?: string;
    userRoleP?: string;
    userRoleS?: string;
    userPref?: 'primario' | 'secundario';
    isBlocked?: boolean;
}

export default function Sidebar({ userId, userName, userEmail, userAvatar, userRoleP, userRoleS, userPref, isBlocked }: SidebarProps) {
    const pathname = usePathname();
    const [invCount, setInvCount] = useState(0);
    const [notifCount, setNotifCount] = useState(0);

    const activeRolKey = userPref === 'secundario' ? userRoleS : userRoleP;
    const activeRol = activeRolKey ? ROLES[activeRolKey as RolKey] : null;

    const menuItems = [
        { label: 'Inicio', icon: '🏠', href: '/dashboard' },
        { label: 'Mis Proyectos', icon: '👥', href: '/mis-equipos' },
        { label: 'Búsqueda Talentos', icon: '🏪', href: '/talentos' },
    ];

    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function cerrarSesion() {
        await supabase.auth.signOut();
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/';
    }

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const fileExt = sanitizeFileName(file.name.split('.').pop() || 'png');
            const filePath = `${userId}/avatar-${Math.random()}.${fileExt}`;

            // 1. Subir a Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            // 2. Obtener URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // 3. Actualizar tabla usuarios
            const { error: updateError } = await (supabase
                .from('usuarios') as any)
                .update({ foto_url: publicUrl })
                .eq('id', userId);

            if (updateError) throw updateError;

            window.location.reload(); // Recarga para ver el cambio en toda la app
        } catch (error) {
            console.error('Error uploading avatar:', error);
            alert('Error al subir la imagen.');
        } finally {
            setUploading(false);
        }
    }

    // Cargar conteos para alertas visuales
    useEffect(() => {
        if (!userId) return;

        async function updateCounts() {
            const { count: sCount } = await supabase.from('solicitudes_equipo').select('*', { count: 'exact', head: true }).eq('usuario_id', userId).eq('estado', 'pendiente');
            setInvCount(sCount || 0);

            const { count: nCount } = await supabase.from('notificaciones').select('*', { count: 'exact', head: true }).eq('usuario_id', userId).eq('leida', false);
            setNotifCount(nCount || 0);
        }

        updateCounts();

        const sub = supabase.channel('sidebar-alerts')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_equipo', filter: `usuario_id=eq.${userId}` }, updateCounts)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${userId}` }, updateCounts)
            .subscribe();

        // Escuchar eventos locales de lectura desde NotificationBell
        const handleLocalRead = () => updateCounts();
        window.addEventListener('notif-read', handleLocalRead);
        window.addEventListener('notif-read-all', handleLocalRead);

        return () => {
            supabase.removeChannel(sub);
            window.removeEventListener('notif-read', handleLocalRead);
            window.removeEventListener('notif-read-all', handleLocalRead);
        };
    }, [userId]);

    return (
        <aside className={styles.sidebar}>
            <div className={styles.top}>
                <div className={styles.logo}>
                    <img src="/logo-icon.png" alt="Logo CCS" width="32" height="32" />
                    <span>CCS</span>
                </div>

                <nav className={styles.nav}>
                    {menuItems.map((item) => {
                        const blocked = isBlocked && (item.href === '/talentos' || item.href === '/mis-equipos');
                        const isMisProyectos = item.href === '/mis-equipos';
                        return (
                            <Link
                                key={item.href}
                                href={blocked ? '#' : item.href}
                                className={`${styles.navItem} ${pathname === item.href ? styles.active : ''} ${blocked ? styles.disabled : ''}`}
                                title={blocked ? "Completá la evaluación 360 para acceder" : ""}
                            >
                                <span className={styles.icon}>
                                    {item.icon}
                                    {isMisProyectos && invCount > 0 && (
                                        <span className={styles.navBadge}>{invCount}</span>
                                    )}
                                </span>
                                <span className={styles.label}>{item.label}</span>
                            </Link>
                        );
                    })}
                    <div className={styles.mobileBellWrap}>
                        <NotificationBell userId={userId} initialCounts={{ notifs: notifCount, invs: invCount }} />
                    </div>
                    <button onClick={cerrarSesion} className={`${styles.navItem} ${styles.mobileLogoutBtn}`} title="Cerrar sesión">
                        <span className={styles.icon}>🚪</span>
                        <span className={styles.label}>Salir</span>
                    </button>
                </nav>
            </div>

            <div className={styles.bottom}>
                <div className={styles.notifWrap}>
                    <span>Notificaciones</span>
                    <NotificationBell userId={userId} initialCounts={{ notifs: notifCount, invs: invCount }} />
                </div>

                <div className={styles.userProfile}>
                    <div
                        className={`${styles.userAvatar} ${uploading ? styles.uploading : ''}`}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        title="Cambiar foto de perfil"
                    >
                        {userAvatar
                            ? <img src={userAvatar} alt={userName} />
                            : userName.charAt(0).toUpperCase()
                        }
                        <div className={styles.avatarOverlay}>
                            <span>{uploading ? '...' : '📷'}</span>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleAvatarUpload}
                            accept="image/*"
                            style={{ display: 'none' }}
                        />
                    </div>
                    <div className={styles.userInfo}>
                        <div className={styles.userName}>{userName}</div>
                        {activeRol && (
                            <div className={styles.userRoleBadge} style={{ background: activeRol.color }}>
                                {activeRol.icon} {activeRol.label}
                            </div>
                        )}
                        <div className={styles.userEmail}>{userEmail}</div>
                    </div>
                </div>

                <button onClick={cerrarSesion} className={styles.logoutBtn}>
                    <span>🚪</span> Salir
                </button>
            </div>
        </aside>
    );
}
