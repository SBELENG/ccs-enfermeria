import type { Metadata } from 'next';
import { DM_Sans, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import './layout.css';

const dmSans = DM_Sans({
    subsets: ['latin'],
    weight: ['300', '400', '500', '700'],
    variable: '--font-dm-sans',
    display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
    subsets: ['latin'],
    weight: ['600', '700', '800'],
    variable: '--font-heading',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'CCS · Competencias Colaborativas en Salud',
    description: 'Plataforma de formación de equipos por roles profesionales para la Escuela de Enfermería UNRC',
    keywords: ['enfermería', 'trabajo en equipo', 'roles', 'UNRC', 'salud colaborativa'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="es" className={`${dmSans.variable} ${plusJakarta.variable}`}>
            <body>{children}</body>
        </html>
    );
}
