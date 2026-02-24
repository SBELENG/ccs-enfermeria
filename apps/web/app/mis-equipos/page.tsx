'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@ccs/supabase';
import type { Database } from '@ccs/supabase';
import Link from 'next/link';
import { ROLES, type RolKey } from '@ccs/ui';
import styles from './page.module.css';
import AuthenticatedLayout from '../components/AuthenticatedLayout';

type CatedraDB = Database['public']['Tables']['catedras']['Row'];
type DesafioDB = Database['public']['Tables']['desafios']['Row'];
type EquipoDB = Database['public']['Tables']['equipos']['Row'];
type UsuarioDB = Database['public']['Tables']['usuarios']['Row'];

type MiEquipo = EquipoDB & { desafio: DesafioDB & { catedra: CatedraDB } };

export default function MisEquiposPage() {
    const [usuario, setUsuario] = useState<UsuarioDB | null>(null);
    const [equipos, setEquipos] = useState<MiEquipo[]>([]);
    const [desafiosLibres, setDesafiosLibres] = useState<(DesafioDB & { catedra: CatedraDB })[]>([]);
    const [invitaciones, setInvitaciones] = useState<(Database['public']['Tables']['solicitudes_equipo']['Row'] & { equipo: EquipoDB, remitente: UsuarioDB })[]>([]);
    const [loading, setLoading] = useState(true);
    const [codigoIn, setCodigoIn] = useState('');
    const [busError, setBusError] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }

            const { data: u } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
            setUsuario(u);

            // Cargar equipos del usuario vía equipo_miembros
            const { data: miembros } = await supabase
                .from('equipo_miembros')
                .select('equipo_id')
                .eq('usuario_id', user.id);

            if (miembros && miembros.length > 0) {
                const ids = miembros.map(m => m.equipo_id);
                const { data: eqs } = await supabase
                    .from('equipos')
                    .select(`*, desafio: desafios(*, catedra: catedras(*))`)
                    .in('id', ids);
                setEquipos((eqs as any) ?? []);
            }

            // Cargar desafíos disponibles (de las cátedras inscriptas pero sin equipo para ese desafío)
            const { data: inscripciones } = await supabase
                .from('inscripciones')
                .select('catedra_id')
                .eq('usuario_id', user.id);

            if (inscripciones && inscripciones.length > 0) {
                const catIds = inscripciones.map(i => i.catedra_id);
                const { data: des } = await supabase
                    .from('desafios')
                    .select('*, catedra:catedras(*)')
                    .in('catedra_id', catIds)
                    .eq('estado', 'activo');

                const desFiltrados = (des ?? []).filter(d => !equipos.some(e => e.desafio_id === d.id));
                setDesafiosLibres(desFiltrados as any);
            }

            // Cargar invitaciones pendientes
            const { data: invs } = await supabase
                .from('solicitudes_equipo')
                .select('*, equipo:equipos(*), remitente:usuarios!solicitudes_equipo_remitente_id_fkey(*)')
                .eq('usuario_id', user.id)
                .eq('estado', 'pendiente');
            setInvitaciones(invs as any);

            setLoading(false);
        }
        cargar();
    }, [equipos.length]);

    async function unirseConCodigo() {
        if (!codigoIn.trim() || !usuario) return;
        setJoining(true);
        setBusError(null);

        const { data: catedra } = await supabase
            .from('catedras')
            .select('*')
            .eq('codigo_acceso', codigoIn.trim().toUpperCase())
            .single();

        if (!catedra) { setBusError('Código no encontrado.'); setJoining(false); return; }

        await supabase.from('inscripciones').upsert({
            usuario_id: usuario.id,
            catedra_id: catedra.id,
        });

        alert(`✅ ¡Te uniste a ${catedra.nombre_materia}!`);
        window.location.reload();
    }

    async function crearEquipo(desafioId: string) {
        if (!usuario) return;
        const resp = confirm('¿Querés crear una propuesta de equipo para este desafío?\n\nUn Organizador deberá ponerle nombre e iniciarlo formalmente.');
        if (!resp) return;

        setLoading(true);
        const { data: eq, error } = await supabase.from('equipos').insert({
            desafio_id: desafioId,
            nombre_equipo: `Propuesta de ${usuario.nombre.split(' ')[0]}`,
            iniciado: false
        } as any).select().single();

        if (error) { alert('Error al crear equipo'); setLoading(false); return; }

        await supabase.from('equipo_miembros').insert({
            equipo_id: eq.id,
            usuario_id: usuario.id,
            rol_en_equipo: usuario.rol_primario || 'ejecutor',
        });

        window.location.reload();
    }

    async function iniciarEquipo(equipoId: string) {
        if (!usuario) return;
        const nombre = prompt('Nombre definitivo para el grupo (ej: Equipo Alpha):');
        if (!nombre || nombre.trim().length < 3) {
            alert('El nombre debe tener al menos 3 caracteres.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.from('equipos')
            .update({ nombre_equipo: nombre, iniciado: true } as any)
            .eq('id', equipoId);

        if (error) {
            alert('Error al iniciar equipo.');
        } else {
            alert('✅ ¡Equipo iniciado satisfactoriamente!');
        }
        window.location.reload();
    }

    async function responderInvitacion(invId: string, aceptar: boolean) {
        if (!usuario) return;
        setLoading(true);
        if (aceptar) {
            const inv = invitaciones.find(i => i.id === invId);
            if (inv) {
                await supabase.from('equipo_miembros').insert({
                    equipo_id: inv.equipo_id,
                    usuario_id: usuario.id,
                    rol_en_equipo: usuario.rol_primario || 'ejecutor',
                });
                await supabase.from('solicitudes_equipo').update({ estado: 'aceptada' }).eq('id', invId);
            }
        } else {
            await supabase.from('solicitudes_equipo').update({ estado: 'rechazada' }).eq('id', invId);
        }
        window.location.reload();
    }

    return (
        <AuthenticatedLayout>
            <div className={styles.header}>
                <h1>👥 Mis Equipos</h1>
                <p className={styles.sub}>Gestioná tus cátedras y el progreso de tus desafíos.</p>
            </div>

            {/* UNIRSE */}
            <div className={styles.codigoCard}>
                <div className={styles.codigoLeft}>
                    <div className={styles.codigoIcon}>🔑</div>
                    <div>
                        <h2>Unirse a una cátedra</h2>
                        <p>Ingresá el código de tu docente</p>
                    </div>
                </div>
                <div className={styles.codigoForm}>
                    <input
                        className={styles.codigoInput}
                        placeholder="CÓDIGO"
                        value={codigoIn}
                        onChange={e => setCodigoIn(e.target.value.toUpperCase())}
                    />
                    <button onClick={unirseConCodigo} disabled={joining}>{joining ? '...' : 'Unirse'}</button>
                </div>
                {busError && <p className={styles.error}>{busError}</p>}
            </div>

            {/* INVITACIONES */}
            {invitaciones.length > 0 && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>✉️ Invitaciones</h2>
                    <div className={styles.invsGrid}>
                        {invitaciones.map(inv => (
                            <div key={inv.id} className={styles.invCard}>
                                <p><strong>{inv.remitente.nombre}</strong> te invitó a <strong>{inv.equipo.nombre_equipo}</strong></p>
                                <div className={styles.invBtns}>
                                    <button onClick={() => responderInvitacion(inv.id, true)} className={styles.btnAceptar}>Aceptar</button>
                                    <button onClick={() => responderInvitacion(inv.id, false)} className={styles.btnRechazar}>Rechazar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* EQUIPOS */}
            <div className={styles.section}>
                <h2 className={styles.sectionTitle}>🏆 Mis Equipos</h2>
                {equipos.length === 0 ? (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>🏕️</div>
                        <h3>Sin equipos activos</h3>
                        <p>Unite a una cátedra o usá el Marketplace para encontrar compañeros.</p>
                        <Link href="/marketplace" className={styles.btnLink}>Ir al Marketplace →</Link>
                    </div>
                ) : (
                    <div className={styles.equiposGrid}>
                        {equipos.map(eq => {
                            const dias = Math.ceil((new Date(eq.desafio.fecha_entrega).getTime() - Date.now()) / 86400000);
                            return (
                                <div key={eq.id} className={styles.equipoCard}>
                                    <div className={styles.eqTop}>
                                        <div className={styles.eqName}>{eq.nombre_equipo}</div>
                                        <div className={`${styles.badge} ${dias < 3 ? styles.urgent : ''}`}>
                                            {dias > 0 ? `${dias}d restante` : 'Vencido'}
                                        </div>
                                    </div>
                                    <div className={styles.eqDesafio}>{eq.desafio.titulo}</div>
                                    <div className={styles.eqCatedra}>{eq.desafio.catedra.nombre_materia}</div>

                                    {!eq.iniciado ? (
                                        <div className={styles.governanceAlert}>
                                            <p className={styles.govText}>⚠️ Equipo pendiente de inicio.</p>
                                            {usuario && (usuario.rol_primario === 'organizador' || usuario.rol_secundario === 'organizador') ? (
                                                <button onClick={() => iniciarEquipo(eq.id)} className={styles.btnStart}>
                                                    🚀 Iniciar Equipo
                                                </button>
                                            ) : (
                                                <span className={styles.govWait}>Esperando a un Organizador...</span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={styles.eqActions}>
                                            <Link href={`/equipo/${eq.id}`} className={styles.btnSec}>Check-in</Link>
                                            <Link href={`/kanban/${eq.id}`} className={styles.btnPri}>Kanban</Link>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* DESAFÍOS LIBRES */}
            {desafiosLibres.length > 0 && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>🚀 Desafíos Disponibles</h2>
                    <div className={styles.libresGrid}>
                        {desafiosLibres.map(d => (
                            <div key={d.id} className={styles.libreCard}>
                                <div>
                                    <h3>{d.titulo}</h3>
                                    <p>{d.catedra.nombre_materia}</p>
                                </div>
                                <button onClick={() => crearEquipo(d.id)} className={styles.btnCrear}>+ Nuevo Equipo</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
