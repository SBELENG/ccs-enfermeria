'use client';
import { useState } from 'react';
import { supabase } from '@ccs/supabase';
import Link from 'next/link';
import { traducirError } from '../lib/auth-errors';
import styles from '../auth.module.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [magicSent, setMagicSent] = useState(false);

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(traducirError(error.message));
        else {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: u } = await supabase.from('usuarios').select('tipo').eq('id', user.id).single();
                window.location.href = (u as any)?.tipo === 'docente' ? '/docente/dashboard' : '/dashboard';
            } else window.location.href = '/dashboard';
        }
        setLoading(false);
    }

    async function handleMagicLink() {
        if (!email) { setError('Ingresá tu email primero'); return; }
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) setError(traducirError(error.message));
        else setMagicSent(true);
        setLoading(false);
    }

    if (magicSent) return (
        <div className={styles.wrap}>
            <div className={styles.card}>
                <div className={styles.icon}>📬</div>
                <h1>¡Revisá tu email!</h1>
                <p>Te enviamos un link de acceso a <strong>{email}</strong>. Hacé click en él para entrar.</p>
                <button className={styles.btnGhost} onClick={() => setMagicSent(false)}>Volver</button>
            </div>
        </div>
    );

    return (
        <div className={styles.wrap}>
            <div className={styles.card}>
                <div className={styles.logoSmall}>
                    <img src="/logo-icon.png" alt="Logo CCS" width="64" height="64" style={{ objectFit: 'contain' }} />
                </div>
                <h1>Ingresar a CCS</h1>
                <p className={styles.sub}>Competencias Colaborativas en Salud · UNRC</p>

                {error && <div className={styles.errorBox}>{error}</div>}

                <form onSubmit={handleLogin} className={styles.form}>
                    <label htmlFor="email">Email institucional</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="estudiante@unrc.edu.ar"
                        required
                        className={styles.input}
                    />
                    <label htmlFor="password">Contraseña</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className={styles.input}
                    />
                    <button type="submit" className={styles.btnPrimary} disabled={loading} id="btn-login">
                        {loading ? 'Ingresando...' : 'Ingresar →'}
                    </button>
                </form>

                <div className={styles.divider}><span>o</span></div>

                <button className={styles.btnOutline} onClick={handleMagicLink} disabled={loading} id="btn-magic-link">
                    ✉️ Ingresar sin contraseña (link por email)
                </button>

                <p className={styles.linkRow}>
                    ¿No tenés cuenta? <Link href="/registro">Registrarse</Link>
                </p>
            </div>
        </div>
    );
}
