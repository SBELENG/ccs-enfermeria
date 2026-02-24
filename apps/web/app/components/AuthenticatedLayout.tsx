'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@ccs/supabase';
import Sidebar from './Sidebar';
import styles from './AuthenticatedLayout.module.css';

interface AuthenticatedLayoutProps {
    children: React.ReactNode;
}

export default function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
    const [usuario, setUsuario] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                window.location.href = '/ingresar';
                return;
            }

            const { data } = await supabase
                .from('usuarios')
                .select('*')
                .eq('id', user.id)
                .single();

            setUsuario(data);
            setLoading(false);
        }
        cargar();
    }, []);

    if (loading) {
        return (
            <div className={styles.loading}>
                <div className={styles.spinner} />
                <p>Cargando aplicación...</p>
            </div>
        );
    }

    if (!usuario) return null;

    return (
        <div className={styles.wrapper}>
            <Sidebar
                userId={usuario.id}
                userName={usuario.nombre}
                userEmail={usuario.email}
                userAvatar={usuario.foto_url || undefined}
            />
            <main className={styles.main}>
                {children}
            </main>
        </div>
    );
}
