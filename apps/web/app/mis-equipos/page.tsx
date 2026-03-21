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
    const [usuario, setUsuario] = useState<any>(null);
    const [equipos, setEquipos] = useState<any[]>([]);
    const [inscripciones, setInscripciones] = useState<any[]>([]);
    const [desafiosLibres, setDesafiosLibres] = useState<any[]>([]);
    const [invitaciones, setInvitaciones] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [codigoIn, setCodigoIn] = useState('');
    const [busError, setBusError] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);
    const [catedrasPublicas, setCatedrasPublicas] = useState<CatedraDB[]>([]);
    const [showRolModal, setShowRolModal] = useState(false);
    const [catToJoin, setCatToJoin] = useState<CatedraDB | null>(null);
    const [rolSeleccionado, setRolSeleccionado] = useState<'primario' | 'secundario'>('primario');
    const [showDesModal, setShowDesModal] = useState(false);
    const [selectedDes, setSelectedDes] = useState<any>(null);

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
                const ids = miembros.map((m: any) => m.equipo_id);
                const { data: eqs } = await (supabase.from('equipos') as any)
                    .select(`*, desafio: desafios(*, catedra: catedras(*)), equipo_miembros(rol_en_equipo, usuario:usuarios(id, nombre, foto_url))`)
                    .in('id', ids);
                setEquipos((eqs as any[]) ?? []);
            }

            // Cargar inscripciones activas (no archivadas)
            const { data: insData, error: insErr } = await supabase
                .from('inscripciones')
                .select('*, catedra:catedras(*)')
                .eq('usuario_id', user.id)
                .eq('oculta', false);

            if (insData && insData.length > 0) {
                setInscripciones(insData);
                const catIds = insData.map((i: any) => i.catedra_id);
                const { data: des } = await (supabase.from('desafios') as any)
                    .select('*, catedra:catedras(*)')
                    .in('catedra_id', catIds)
                    .eq('estado', 'activo');

                const desFiltrados = (des ?? []).filter((d: any) => !equipos.some((e: any) => e.desafio_id === d.id));
                setDesafiosLibres(desFiltrados as any[]);
            }

            // Cargar solicitudes (Invitaciones e Intereses)
            const { data: invs } = await supabase
                .from('solicitudes_equipo')
                .select('*, equipo:equipos(*), remitente:usuarios!solicitudes_equipo_remitente_id_fkey(*)')
                .eq('usuario_id', user.id)
                .eq('estado', 'pendiente');
            setInvitaciones(invs as any ?? []);

            // Cargar todas las cátedras públicas (activas)
            const { data: publics } = await supabase
                .from('catedras')
                .select('*')
                .eq('activa', true)
                .order('nombre_materia');

            // Filtrar las que ya estamos inscriptos
            const yaInscriptoIds = (insData ?? []).map((i: any) => i.catedra_id);
            const filtradas = (publics ?? []).filter((c: any) => !yaInscriptoIds.includes(c.id));
            setCatedrasPublicas(filtradas);

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

        // Verificar si ya está inscripto antes de abrir modal
        const { data: ya } = await (supabase
            .from('inscripciones') as any)
            .select('id')
            .eq('usuario_id', (usuario as any).id)
            .eq('catedra_id', (catedra as any).id)
            .limit(1);

        if (ya && ya.length > 0) {
            setBusError('Ya estás inscripto en esta cátedra.');
            setJoining(false);
            return;
        }

        setCatToJoin(catedra as CatedraDB);
        setShowRolModal(true);
        setJoining(false);
    }

    async function confirmarUnion() {
        if (!usuario || !catToJoin) return;
        setJoining(true);

        const rolElegido = rolSeleccionado === 'primario'
            ? usuario.rol_primario
            : usuario.rol_secundario;

        // 1. Inscribirse con el rol elegido
        await (supabase.from('inscripciones') as any).upsert({
            usuario_id: usuario.id,
            catedra_id: catToJoin.id,
            rol_activo: rolElegido
        });

        // 2. Activar "buscando equipo" automáticamente (Requisito auditado)
        await (supabase.from('usuarios') as any).update({
            buscando_equipo: true
        }).eq('id', usuario.id);

        alert(`✅ ¡Te uniste a ${catToJoin.nombre_materia} como ${ROLES[rolElegido as RolKey]?.label || 'Estudiante'}!`);
        window.location.reload();
    }

    async function crearEquipo(desafioId: string) {
        if (!usuario) return;

        const esOrganizador = usuario.rol_primario === 'organizador' || usuario.rol_secundario === 'organizador';
        if (!esOrganizador) {
            alert('⚠️ Solo los perfiles de Organizador pueden crear o iniciar una propuesta de equipo.');
            return;
        }

        const resp = confirm('¿Querés crear una propuesta de equipo para este desafío?\n\nComo Organizador, serás responsable de ponerle nombre y convocar a un Conciliador.');
        if (!resp) return;

        setLoading(true);
        const { data: eq, error } = await (supabase.from('equipos') as any).insert({
            desafio_id: desafioId,
            nombre_equipo: `Propuesta de ${usuario.nombre.split(' ')[0]}`,
            iniciado: false
        }).select().single();

        if (error) {
            console.error("Error al crear equipo:", error);
            alert(`Error al crear equipo: ${error.message}`);
            setLoading(false);
            return;
        }

        const { error: errorMiembro } = await (supabase.from('equipo_miembros') as any).insert({
            equipo_id: eq.id,
            usuario_id: usuario.id,
            rol_en_equipo: (usuario as any).rol_primario || 'ejecutor',
        });

        if (errorMiembro) {
            console.error("Error al unirse al equipo:", errorMiembro);
            alert(`Equipo creado pero hubo un error al unirte: ${errorMiembro.message}`);
        } else {
            // Cancelar búsqueda automáticamente
            await (supabase.from('usuarios') as any).update({ buscando_equipo: false }).eq('id', usuario.id);
            alert('✅ ¡Propuesta de equipo creada!');
        }

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
        const { error } = await (supabase.from('equipos') as any)
            .update({ nombre_equipo: nombre, iniciado: true } as any)
            .eq('id', equipoId);

        if (error) {
            console.error("Error al iniciar equipo:", error);
            alert(`Error al iniciar equipo: ${error.message}`);
        } else {
            alert('✅ ¡Equipo iniciado satisfactoriamente!');
        }
        window.location.reload();
    }

    async function cerrarEquipo(equipoId: string) {
        if (!usuario) return;
        const resp = confirm('¿Confirmás que el grupo está completo? Una vez cerrado, se habilitará el Tablero Kanban para asignar tareas.');
        if (!resp) return;

        setLoading(true);
        const { error } = await (supabase.from('equipos') as any)
            .update({ cerrado: true } as any)
            .eq('id', equipoId);

        if (error) {
            console.error("Error al cerrar equipo:", error);
            alert(`Error al cerrar equipo: ${error.message}`);
        } else {
            alert('✅ ¡Grupo cerrado! Ya pueden comenzar con el Kanban.');
        }
        window.location.reload();
    }

    async function responderInvitacion(invId: string, aceptar: boolean) {
        if (!usuario) return;
        setLoading(true);
        if (aceptar) {
            const inv = (invitaciones as any[]).find(i => i.id === invId);
            if (inv) {
                // Unirse al equipo
                await (supabase.from('equipo_miembros') as any).insert({
                    equipo_id: inv.equipo_id,
                    usuario_id: usuario.id,
                    rol_en_equipo: (usuario as any).rol_primario || 'ejecutor',
                });

                // Aceptar la invitación actual
                await (supabase.from('solicitudes_equipo') as any).update({ estado: 'aceptada' }).eq('id', invId);

                // RECHAZAR AUTOMÁTICAMENTE EL RESTO DE LAS INVITACIONES PENDIENTES
                await (supabase.from('solicitudes_equipo') as any)
                    .update({ estado: 'rechazada' })
                    .eq('usuario_id', usuario.id)
                    .eq('estado', 'pendiente');

                // DESACTIVAR ESTADO DE BÚSQUEDA
                await (supabase.from('usuarios') as any).update({ buscando_equipo: false }).eq('id', usuario.id);

                alert('✅ ¡Te has unido al equipo! Se han rechazado el resto de tus invitaciones pendientes.');
            }
        } else {
            await (supabase.from('solicitudes_equipo') as any).update({ estado: 'rechazada' }).eq('id', invId);
        }
        window.location.reload();
    }

    async function archivarCatedra(inscripcionId: string) {
        if (!confirm('¿Seguro querés archivar esta cátedra? Ya no la verás en tu lista principal, pero se conserva tu historial de equipos.')) return;
        setLoading(true);
        await (supabase.from('inscripciones') as any).update({ oculta: true }).eq('id', inscripcionId);
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

            {/* CÁTEDRAS PÚBLICAS (Auditado) */}
            {catedrasPublicas.length > 0 && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>🏫 Otras cátedras disponibles</h2>
                    {Object.entries(
                        catedrasPublicas.reduce((acc, cat) => {
                            const anio = (cat as any).anio_carrera ? `${(cat as any).anio_carrera}º Año` : 'Otros';
                            if (!acc[anio]) acc[anio] = [];
                            acc[anio].push(cat);
                            return acc;
                        }, {} as Record<string, typeof catedrasPublicas>)
                    )
                        .sort(([a], [b]) => a.localeCompare(b)) /* 1ro, 2do, 3ro orden alfabético/numérico */
                        .map(([anio, cats]) => (
                            <div key={anio} style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '1.05rem', color: '#5a7191', marginBottom: '12px', borderBottom: '2px solid #eef2f6', paddingBottom: '6px' }}>
                                    {anio} - Plan de Estudio
                                </h3>
                                <div className={styles.catedrasPublicas}>
                                    {cats.map(cat => (
                                        <div key={cat.id} className={styles.catPubCard}>
                                            <div>
                                                <h3>{cat.nombre_materia}</h3>
                                                <p className={styles.catPubDoc}>Materia Universitaria</p>
                                            </div>
                                            <button
                                                className={styles.btnJoin}
                                                onClick={() => { setCatToJoin(cat); setShowRolModal(true); }}
                                            >
                                                Inscribirse
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                </div>
            )}

            {/* MODAL DE SELECCIÓN DE ROL (Auditado) */}
            {showRolModal && catToJoin && usuario && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <h2>Elegir rol para la cátedra</h2>
                        <p>Vas a unirte a <strong>{catToJoin.nombre_materia}</strong>. ¿Qué rol vas a ejercer en esta materia?</p>

                        <div className={styles.rolOptions}>
                            <button
                                className={`${styles.rolOpt} ${rolSeleccionado === 'primario' ? styles.rolOptActive : ''}`}
                                onClick={() => setRolSeleccionado('primario')}
                            >
                                <span style={{ fontSize: '1.5rem' }}>{ROLES[usuario.rol_primario as RolKey]?.icon}</span>
                                <strong>{ROLES[usuario.rol_primario as RolKey]?.label}</strong>
                                <span>(Primario)</span>
                            </button>
                            <button
                                className={`${styles.rolOpt} ${rolSeleccionado === 'secundario' ? styles.rolOptActive : ''}`}
                                onClick={() => setRolSeleccionado('secundario')}
                            >
                                <span style={{ fontSize: '1.5rem' }}>{ROLES[usuario.rol_secundario as RolKey]?.icon}</span>
                                <strong>{ROLES[usuario.rol_secundario as RolKey]?.label}</strong>
                                <span>(Secundario)</span>
                            </button>
                        </div>

                        <button
                            className={styles.btnConfirm}
                            onClick={confirmarUnion}
                            disabled={joining}
                        >
                            {joining ? 'Uniendo...' : 'Confirmar e Inscribirse'}
                        </button>
                        <button className={styles.btnCancel} onClick={() => setShowRolModal(false)}>Cancelar</button>
                    </div>
                </div>
            )}

            {/* MODAL DETALLE DESAFÍO */}
            {showDesModal && selectedDes && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <span className={styles.modalIcon}>🚀</span>
                            <div>
                                <h2>{selectedDes.titulo}</h2>
                                <p className={styles.modalSub}>{selectedDes.catedra?.nombre_materia}</p>
                            </div>
                        </div>

                        <div className={styles.modalBody}>
                            <div className={styles.modalSection}>
                                <h3>📝 Consigna del Desafío</h3>
                                <p className={styles.desDescripcion}>
                                    {selectedDes.descripcion || 'No hay una descripción escrita todavía. Consultá el documento adjunto o con tu docente.'}
                                </p>
                            </div>

                            {selectedDes.documento_url && (
                                <div className={styles.modalSection}>
                                    <h3>📁 Documentación Adjunta</h3>
                                    <a
                                        href={selectedDes.documento_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={styles.btnDirectDoc}
                                    >
                                        📄 DESCARGAR CONSIGNAS (PDF/IMG)
                                    </a>
                                </div>
                            )}

                            {selectedDes.checklist_sugerido && selectedDes.checklist_sugerido.length > 0 && (
                                <div className={styles.modalSection}>
                                    <h3>📌 Orientación (Pasos sugeridos)</h3>
                                    <ul className={styles.modalChecklist}>
                                        {selectedDes.checklist_sugerido.map((item: any, idx: number) => (
                                            <li key={idx}>✅ {item.descripcion}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <button className={styles.btnConfirm} onClick={() => setShowDesModal(false)}>Cerrar</button>
                    </div>
                </div>
            )}

            {/* INVITACIONES */}
            {invitaciones.length > 0 && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>✉️ Invitaciones e Intereses</h2>
                    <div className={styles.invsGrid}>
                        {invitaciones.map(inv => (
                            <div key={inv.id} className={`${styles.invCard} ${inv.tipo === 'interes' ? styles.interesCard : ''}`}>
                                <div className={styles.invTypeBadge}>{inv.tipo === 'interes' ? '🤝 Interés' : '✉️ Invitación'}</div>
                                <p>
                                    <strong>{inv.remitente?.nombre || 'Alguien'}</strong>
                                    {inv.tipo === 'interes'
                                        ? ` está interesado en tu perfil para su equipo "${inv.equipo?.nombre_equipo || 'Proyecto'}".`
                                        : ` te invitó a unirse al equipo "${inv.equipo?.nombre_equipo || 'un nuevo proyecto'}".`}
                                </p>
                                <div className={styles.invBtns}>
                                    {inv.tipo === 'interes' ? (
                                        <Link href="/talentos" className={styles.btnAceptar}>Ver Perfil / Responder</Link>
                                    ) : (
                                        <>
                                            <button onClick={() => responderInvitacion(inv.id, true)} className={styles.btnAceptar}>Aceptar</button>
                                            <button onClick={() => responderInvitacion(inv.id, false)} className={styles.btnRechazar}>Rechazar</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MIS CÁTEDRAS INSCIRTAS */}
            {usuario && usuario.tipo === 'estudiante' && (
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>🏫 Mis Cátedras</h2>
                    <div className={styles.catedrasInscritasGrid}>
                        {inscripciones.length === 0 ? (
                            <p className={styles.emptySmall}>No estás inscripto en ninguna cátedra actualmente.</p>
                        ) : (
                            inscripciones.map(ins => (
                                <div key={ins.id} className={styles.inscripcionCard}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                                        <div className={styles.insIcon}>🏛️</div>
                                        <div className={styles.insInfo}>
                                            <h3>{ins.catedra?.nombre_materia}</h3>
                                            <p>Ciclo: {ins.catedra?.ciclo_lectivo} · Rol: <strong>{ROLES[ins.rol_activo as RolKey]?.label || 'Estudiante'}</strong></p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => archivarCatedra(ins.id)}
                                        className={styles.btnArchivar}
                                        title="Ocultar de mi lista de cátedras activas"
                                    >
                                        👁️‍🗨️ Archivar
                                    </button>
                                </div>
                            ))
                        )}
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
                        <p>Inscribite a una cátedra primero para ver los desafíos disponibles.</p>
                    </div>
                ) : (
                    <div className={styles.equiposGrid}>
                        {equipos.map(eq => {
                            const dias = Math.ceil((new Date(eq.desafio.fecha_entrega).getTime() - Date.now()) / 86400000);
                            return (
                                <div key={eq.id} className={styles.equipoCard}>
                                    <div className={styles.eqTop}>
                                        <div className={styles.eqName}>{eq.nombre_equipo}</div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            {eq.desafio.documento_url && (
                                                <a href={eq.desafio.documento_url} target="_blank" rel="noreferrer" className={styles.btnDirectDocCompact} title="Descargar consignas">
                                                    📄 PDF
                                                </a>
                                            )}
                                            {eq.cerrado && <span className={styles.closedBadge}>🔒 Cerrado</span>}
                                            <div className={`${styles.badge} ${dias < 3 ? styles.urgent : ''}`}>
                                                {dias > 0 ? `${dias}d restante` : 'Vencido'}
                                            </div>
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    className={styles.btnInfo}
                                                    onClick={() => { setSelectedDes(eq.desafio); setShowDesModal(true); }}
                                                    title="Ver consigna del desafío"
                                                >
                                                    ℹ️
                                                </button>
                                                {eq.desafio.documento_url && <span className={styles.cardDocBadge}>📄</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.eqDesafio}>{eq.desafio.titulo}</div>
                                    <div className={styles.eqCatedra}>{eq.desafio.catedra.nombre_materia}</div>

                                    <div className={styles.eqMembers}>
                                        {(eq.equipo_miembros || []).map((m: any) => (
                                            <div key={m.usuario.id} className={styles.memberMini} title={`${m.usuario.nombre} (${ROLES[m.rol_en_equipo as RolKey]?.label})`}>
                                                {m.usuario.foto_url
                                                    ? <img src={m.usuario.foto_url} alt={m.usuario.nombre} />
                                                    : <div className={styles.memberInitial}>{m.usuario.nombre[0]}</div>
                                                }
                                                <span className={styles.memberRoleIcon}>{ROLES[m.rol_en_equipo as RolKey]?.icon}</span>
                                            </div>
                                        ))}
                                        {(eq.equipo_miembros || []).length < 5 && <div className={styles.memberSlot}>➐</div>}
                                    </div>

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

                                            {eq.cerrado ? (
                                                <Link href={`/kanban/${eq.id}`} className={styles.btnPri}>Tablero Kanban</Link>
                                            ) : (
                                                usuario && (usuario.rol_primario === 'organizador' || usuario.rol_secundario === 'organizador') ? (
                                                    <button onClick={() => cerrarEquipo(eq.id)} className={styles.btnCerrar}>
                                                        🔒 Cerrar Grupo
                                                    </button>
                                                ) : (
                                                    <div className={styles.btnPri + ' ' + styles.kanbanLocked}>
                                                        <span className={styles.lockIcon}>🔒</span> Kanban
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    )}
                                    {!eq.cerrado && eq.iniciado && (
                                        <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '12px', textAlign: 'center' }}>
                                            {usuario && (usuario.rol_primario === 'organizador' || usuario.rol_secundario === 'organizador')
                                                ? 'Una vez que el grupo esté completo, cerralo para habilitar el Kanban.'
                                                : 'Esperando que el Organizador cierre el grupo para iniciar tareas.'}
                                        </p>
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <h3>{d.titulo}</h3>
                                        <button
                                            className={styles.btnInfo}
                                            onClick={() => { setSelectedDes(d); setShowDesModal(true); }}
                                        >
                                            ℹ️
                                        </button>
                                    </div>
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
