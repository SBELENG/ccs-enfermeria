'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@ccs/supabase';
import styles from './Sidebar.module.css';
import NotificationBell from './NotificationBell';

interface SidebarProps {
    userId: string;
    userName: string;
    userEmail: string;
    userAvatar?: string;
}

export default function Sidebar({ userId, userName, userEmail, userAvatar }: SidebarProps) {
    const pathname = usePathname();

    const menuItems = [
        { label: 'Inicio', icon: '🏠', href: '/dashboard' },
        { label: 'Mis Equipos', icon: '👥', href: '/mis-equipos' },
        { label: 'Marketplace', icon: '🏪', href: '/marketplace' },
    ];

    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function cerrarSesion() {
        await supabase.auth.signOut();
        window.location.href = '/';
    }

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            const fileExt = file.name.split('.').pop();
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
            const { error: updateError } = await supabase
                .from('usuarios')
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

    return (
        <aside className={styles.sidebar}>
            <div className={styles.top}>
                <div className={styles.logo}>
                    <img src="/logo-icon.png" alt="Logo CCS" width="32" height="32" />
                    <span>CCS</span>
                </div>

                <nav className={styles.nav}>
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
                        >
                            <span className={styles.icon}>{item.icon}</span>
                            <span className={styles.label}>{item.label}</span>
                        </Link>
                    ))}
                </nav>
            </div>

            <div className={styles.bottom}>
                <div className={styles.notifWrap}>
                    <span>Notificaciones</span>
                    <NotificationBell userId={userId} />
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
