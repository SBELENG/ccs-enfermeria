'use client';
import { useState } from 'react';
import styles from './contacto.module.css';

export default function ContactoPage() {
    const [submitted, setSubmitted] = useState(false);
    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>Contacto e Innovación</h1>
                <p className={styles.subtitle}>
                    ¿Necesitás ayuda con la plataforma o querés implementar CCS en tu cátedra? Estamos para acompañarte.
                </p>

                <div className={styles.grid}>
                    <div className={styles.info}>
                        <h3>📩 Soporte Técnico</h3>
                        <p>Escribinos a: <a href="mailto:1000ideasdigitales@gmail.com">1000ideasdigitales@gmail.com</a></p>

                        <h3>🚀 Alianzas Académicas</h3>
                        <p>Para nuevas implementaciones: <a href="mailto:1000ideasdigitales@gmail.com">1000ideasdigitales@gmail.com</a></p>

                        <div className={styles.branding}>
                            <p>Desarrollado con ❤️ por</p>
                            <h2>Ideas Digitales</h2>
                            <p>Transformando la educación a través del talento.</p>
                        </div>
                    </div>

                    <div className={styles.externalFormCard}>
                        <div className={styles.formIcon}>📝</div>
                        <h3>Formulario de Contacto</h3>
                        <p>Hacé click en el botón de abajo para abrir el formulario oficial en una pestaña nueva y enviarnos tu consulta.</p>
                        <a
                            href="https://docs.google.com/forms/d/e/1FAIpQLSdv7NbNonltyci_Pk70khi4wfMTl594TwybIodcmhouultGEQ/viewform?usp=sf_link"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.externalBtn}
                        >
                            Abrir Formulario →
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
