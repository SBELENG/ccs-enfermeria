import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className={styles.footer}>
            <div className={styles.container}>
                <div className={styles.info}>
                    <h3>📩 Soporte Técnico</h3>
                    <p>Escribinos a: <a href="mailto:1000ideasdigitales@gmail.com">1000ideasdigitales@gmail.com</a></p>

                    <h3>🚀 Alianzas Académicas</h3>
                    <p>Para nuevas implementaciones: <a href="mailto:1000ideasdigitales@gmail.com">1000ideasdigitales@gmail.com</a></p>
                </div>

                <div className={styles.links}>
                    <Link href="/contacto" className={styles.link}>Contacto</Link>
                    <Link href="/terminos" className={styles.link}>Términos y condiciones</Link>
                    <Link href="/privacidad" className={styles.link}>Privacidad</Link>
                </div>
            </div>
        </footer>
    );
}
