'use client';
import { useState } from 'react';
import { supabase } from '@ccs/supabase';
import Link from 'next/link';
import styles from './page.module.css';

function generarCodigo(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function NuevaCatedraPage() {
    const [nombre, setNombre] = useState('');
    const [ciclo, setCiclo] = useState(new Date().getFullYear().toString());
    const [codigo, setCodigo] = useState(generarCodigo());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function crear(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = '/ingresar'; return; }

        const { data, error: err } = await supabase.from('catedras').insert({
            nombre_materia: nombre.trim(),
            docente_id: user.id,
            codigo_acceso: codigo,
            ciclo_lectivo: ciclo,
            activa: true,
        }).select().single();

        if (err) { setError(err.message); setLoading(false); return; }
        window.location.href = `/docente/catedra/${data?.id}`;
    }

    return (
        <div className={styles.wrap}>
            <div className={styles.card}>
                <Link href="/docente/dashboard" className={styles.back}>← Volver al panel</Link>
                <h1>Nueva cátedra</h1>
                <p className={styles.sub}>Los estudiantes usarán el <strong>código de acceso</strong> para inscribirse.</p>

                {error && <div className={styles.errorBox}>{error}</div>}

                <form onSubmit={crear} className={styles.form}>
                    <label htmlFor="nombre">Nombre de la materia</label>
                    <input
                        id="nombre"
                        type="text"
                        className={styles.input}
                        placeholder="Ej: Práctica Profesional IV"
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        required
                    />

                    <label htmlFor="ciclo">Ciclo lectivo</label>
                    <input
                        id="ciclo"
                        type="text"
                        className={styles.input}
                        placeholder="2026"
                        value={ciclo}
                        onChange={e => setCiclo(e.target.value)}
                        required
                    />

                    <label>Código de acceso</label>
                    <div className={styles.codigoRow}>
                        <code className={styles.codigoDisplay}>{codigo}</code>
                        <button
                            type="button"
                            className={styles.btnRefresh}
                            onClick={() => setCodigo(generarCodigo())}
                            title="Generar nuevo código"
                        >
                            🔄 Nuevo
                        </button>
                    </div>
                    <p className={styles.codigoHint}>Este código es único. Compartilo con tus estudiantes para que se inscriban.</p>

                    <button type="submit" className={styles.btnCrear} disabled={loading || !nombre.trim()} id="btn-crear-catedra">
                        {loading ? 'Creando...' : 'Crear cátedra →'}
                    </button>
                </form>
            </div>
        </div>
    );
}
