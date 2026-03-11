'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@ccs/supabase';
import Link from 'next/link';
import { traducirError } from '../lib/auth-errors';
import styles from '../auth.module.css';


function RegistroInner() {
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
            const { error: dbError } = await (supabase.from('usuarios') as any).upsert({
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
                <p>Por favor revisá tu <strong>bandeja de entrada</strong> (o spam) para verificar tu email y activar la cuenta.</p>
                <Link href="/ingresar" className={styles.btnSecondary} style={{ display: 'block', textAlign: 'center', marginTop: '16px' }}>
                    Ir a iniciar sesión
                </Link>
            </div>
        </div>
    );

    return (
        <div className={styles.wrap}>
            <div className={styles.card}>
                <div className={styles.logoSmall}>
                    <img src="/logo-icon.png" alt="Logo CCS" width="64" height="64" style={{ objectFit: 'contain' }} />
                </div>
                <h1>Crear cuenta {tipo === 'docente' ? '👨‍🏫' : ''}</h1>
                <p>Sumate a CCS y participá en equipos.</p>

                {error && <div className={styles.errorBox}>{error}</div>}

                <form onSubmit={handleRegistro} className={styles.form}>
                    <input
                        type="text"
                        placeholder="Nombre completo..."
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        required
                        className={styles.input}
                    />
                    <input
                        type="email"
                        placeholder="Email universitario o personal..."
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        className={styles.input}
                    />
                    <input
                        type="password"
                        placeholder="Contraseña (mínimo 6 chars)..."
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className={styles.input}
                    />

                    {/* Selector tipo perfil invisible si vino de invitacion */}
                    <div className={styles.roleSelector} style={{ marginTop: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#334155', display: 'block', marginBottom: '4px' }}>Soy:</span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className={tipo === 'estudiante' ? styles.tipoActive : styles.tipoBtn}
                                onClick={() => setTipo('estudiante')}
                            >
                                Estudiante
                            </button>
                            <button
                                type="button"
                                className={tipo === 'docente' ? styles.tipoActive : styles.tipoBtn}
                                onClick={() => setTipo('docente')}
                            >
                                Docente (Probar)
                            </button>
                        </div>
                    </div>

                    <p className={styles.hint} style={{ marginTop: '4px', marginBottom: '16px' }}>
                        {tipo === 'estudiante' ?
                            'Podrás ser invitado a equipos, inscribirte a cátedras y trabajar en tableros kanban.' :
                            'Tendrás acceso completo al panel para crear cátedras, desafíos y gestionar evaluaciones.'}
                    </p>

                    <button type="submit" disabled={loading} className={styles.btnPrimary}>
                        {loading ? 'Registrando...' : 'Registrarme'}
                    </button>
                </form>

                <div className={styles.footerLink}>
                    ¿Ya tenés cuenta? <Link href="/ingresar">Iniciá sesión acá</Link>
                </div>
            </div>
        </div>
    );
}

const SuspenseWrapper = Suspense as any;

export default function RegistroPage() {
    return (
        <SuspenseWrapper fallback={<div style={{ textAlign: 'center', padding: '50px' }}>Cargando página de registro...</div>}>
            <RegistroInner />
        </SuspenseWrapper>
    );
}
