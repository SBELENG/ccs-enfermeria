'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@ccs/supabase';
import Link from 'next/link';
import { traducirError } from '../lib/auth-errors';
import styles from '../auth.module.css';

export default function RegistroPage() {
    const searchParams = useSearchParams();
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [tipo, setTipo] = useState<'estudiante' | 'docente'>('estudiante');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const t = searchParams.get('tipo');
        if (t === 'docente') setTipo('docente');
    }, [searchParams]);
    const [done, setDone] = useState(false);

    async function handleRegistro(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // 1. Crear usuario en Supabase Auth
        const { data, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/dashboard`,
                data: { nombre, tipo },   // guardados en user_metadata
            },
        });

        if (authError) { setError(traducirError(authError.message)); setLoading(false); return; }

        // 2. Insertar/actualizar perfil en tabla usuarios
        if (data.user) {
            const { error: dbError } = await supabase.from('usuarios').upsert({
                id: data.user.id,
                nombre,
                email,
                tipo,
            }, { onConflict: 'id' });
            if (dbError) { setError(traducirError(dbError.message)); setLoading(false); return; }
        }

        setDone(true);
        setLoading(false);
    }

    if (done) return (
        <div className={styles.wrap}>
            <div className={styles.card}>
                <div className={styles.icon}>🎉</div>
                <h1>¡Cuenta creada!</h1>
                <p>Registramos tu perfil como <strong>{tipo}</strong>.</p>
                <p>Revisá tu email (<strong>{email}</strong>) para confirmar tu cuenta. Una vez confirmada, podrás ingresar para realizar tu test profesional.</p>
                <Link href="/ingresar" className={styles.btnPrimary}>Ir a Ingresar →</Link>
            </div>
        </div>
    );

    return (
        <div className={styles.wrap}>
            <div className={styles.card}>
                <div className={styles.logoSmall}>
                    <img src="/logo-icon.png" alt="Logo CCS" width="64" height="64" style={{ objectFit: 'contain' }} />
                </div>
                <h1>Crear cuenta CCS</h1>
                <p className={styles.sub}>Competencias Colaborativas en Salud · UNRC</p>

                {error && <div className={styles.errorBox}>{error}</div>}

                {/* Selector de tipo */}
                <div className={styles.tipoRow}>
                    <button
                        type="button"
                        className={`${styles.tipoBtn} ${tipo === 'estudiante' ? styles.tipoActive : ''}`}
                        onClick={() => setTipo('estudiante')}
                        id="btn-tipo-estudiante"
                    >🎓 Estudiante</button>
                    <button
                        type="button"
                        className={`${styles.tipoBtn} ${tipo === 'docente' ? styles.tipoActive : ''}`}
                        onClick={() => setTipo('docente')}
                        id="btn-tipo-docente"
                    >👨‍🏫 Docente</button>
                </div>

                <form onSubmit={handleRegistro} className={styles.form}>
                    <label htmlFor="nombre">Nombre completo</label>
                    <input
                        id="nombre"
                        type="text"
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        placeholder="Ej: María González"
                        required
                        className={styles.input}
                    />
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
                        placeholder="Mínimo 8 caracteres"
                        minLength={8}
                        required
                        className={styles.input}
                    />
                    <button type="submit" className={styles.btnPrimary} disabled={loading} id="btn-registro">
                        {loading ? 'Creando cuenta...' : 'Crear cuenta →'}
                    </button>
                </form>

                <p className={styles.linkRow}>
                    ¿Ya tenés cuenta? <Link href="/ingresar">Ingresar</Link>
                </p>
            </div>
        </div>
    );
}
