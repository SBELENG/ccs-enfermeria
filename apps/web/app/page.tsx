'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@ccs/supabase';
import Link from 'next/link';
import styles from './page.module.css';

const roles = [
    { key: 'organizador', icon: '🗂️', nombre: 'Organizador', desc: 'Estructura, planifica y da seguimiento al trabajo grupal.', color: '#1a2b5e' },
    { key: 'analitico', icon: '📊', nombre: 'Analítico', desc: 'Interpreta información con mirada crítica. Valida fuentes.', color: '#3a6bc8' },
    { key: 'ejecutor', icon: '🛠️', nombre: 'Ejecutor', desc: 'Transforma ideas en acciones concretas. Avance constante.', color: '#7bb5e8' },
    { key: 'creativo', icon: '🎨', nombre: 'Creativo', desc: 'Aporta enfoques originales e innovación en la presentación.', color: '#1e8f7a' },
    { key: 'conciliador', icon: '🤝', nombre: 'Conciliador', desc: 'Facilita el diálogo y garantiza la participación equitativa.', color: '#2dc9a8' },
    { key: 'motivador', icon: '🔊', nombre: 'Motivador', desc: 'Sostiene el compromiso y el clima positivo del grupo.', color: '#7eecd8' },
];

export default function HomePage() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [userProfile, setUserProfile] = useState<any>(null);

    useEffect(() => {
        async function checkUser() {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            if (user) {
                const { data: profile } = await supabase.from('usuarios').select('tipo').eq('id', user.id).single();
                setUserProfile(profile);
            }
            setLoading(false);
        }
        checkUser();
    }, []);

    return (
        <div className={styles.page}>
            {/* HERO */}
            <header className={styles.hero}>
                <div className={styles.heroInner}>
                    <div className={styles.logoWrap}>
                        <img src="/logo-icon.png" alt="CCS – Competencias Colaborativas en Salud" className={styles.logoIconImg} />
                    </div>
                    <div className={styles.heroText}>
                        <h1><span className={styles.accent}>CCS</span> · Competencias<br />Colaborativas en Salud</h1>
                        <p>Formá equipos por complementariedad de roles, no por afinidad personal. Plataforma académica para la Escuela de Enfermería · UNRC.</p>
                        {!loading && (
                            <div className={styles.heroCtas}>
                                {user ? (
                                    <>
                                        {userProfile?.tipo !== 'docente' && (
                                            <Link href="/test" className={styles.btnPrimary} id="cta-test">
                                                🧪 Test de Perfil
                                            </Link>
                                        )}
                                        <Link href={userProfile?.tipo === 'docente' ? "/docente/dashboard" : "/dashboard"} className={styles.btnOutline} id="cta-dashboard">
                                            Ir al Panel →
                                        </Link>
                                    </>
                                ) : (
                                    <Link href="/ingresar" className={styles.btnPrimary} id="cta-login">
                                        Ingresar / Comenzar Ahora
                                    </Link>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className={styles.heroDecor1} aria-hidden />
                <div className={styles.heroDecor2} aria-hidden />
            </header>

            <main className={styles.main}>

                {/* ROLES GRID */}
                <section aria-labelledby="roles-heading">
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionNum}>R</div>
                        <h2 id="roles-heading">Los 6 Roles Profesionales</h2>
                    </div>
                    <div className={styles.rolesGrid}>
                        {roles.map(rol => (
                            <div
                                key={rol.key}
                                className={styles.roleCard}
                                style={{ '--role-color': rol.color } as React.CSSProperties}
                            >
                                <div className={styles.roleIcon}>{rol.icon}</div>
                                <div className={styles.roleName}>{rol.nombre}</div>
                                <div className={styles.roleDesc}>{rol.desc}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CÓMO FUNCIONA */}
                <section aria-labelledby="como-heading" className={styles.comoSection}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionNum}>¿?</div>
                        <h2 id="como-heading">¿Cómo funciona?</h2>
                    </div>
                    <div className={styles.stepsGrid}>
                        {[
                            { n: '1', titulo: 'Hacé el Test', desc: '4 preguntas situacionales. Descubrís tu Rol Primario y Secundario.', icon: '🧪' },
                            { n: '2', titulo: 'Ingresá a tu Cátedra', desc: 'Tu docente te da un código de acceso único por materia.', icon: '🔑' },
                            { n: '3', titulo: 'Formá tu Equipo', desc: 'El Organizador convoca al Conciliador, quien luego busca los perfiles que faltan (Ejecutor, Analítico, etc.) para equilibrar el grupo.', icon: '👥' },
                            { n: '4', titulo: 'Trabajá con tu Checklist', desc: 'Cada rol tiene tareas orientativas y un Sprint Board Kanban.', icon: '✅' },
                            { n: '5', titulo: 'Evaluá con 360°', desc: 'Al finalizar, el grupo se evalúa mutuamente y recibe insignias.', icon: '🏅' },
                        ].map(step => (
                            <div key={step.n} className={styles.stepCard}>
                                <div className={styles.stepNum}>{step.n}</div>
                                <div className={styles.stepIcon}>{step.icon}</div>
                                <h3>{step.titulo}</h3>
                                <p>{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* CTA FINAL */}
                <section className={styles.ctaSection}>
                    <div className={styles.ctaBox}>
                        <h2>¿Sos docente?</h2>
                        <p>Creá tu cátedra, diseñá desafíos y monitoreá el equilibrio de roles en cada equipo desde el dashboard.</p>
                        <Link href="/registro?tipo=docente" className={styles.btnTeal} id="cta-docente">
                            Comenzar como Docente →
                        </Link>
                    </div>
                </section>

            </main>

            <footer className={styles.footer}>
                <strong>CCS · Competencias Colaborativas en Salud</strong> · Escuela de Enfermería · UNRC
            </footer>
        </div>
    );
}
