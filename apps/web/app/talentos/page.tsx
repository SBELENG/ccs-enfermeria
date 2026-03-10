'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@ccs/supabase';
import { ROLES, type RolKey } from '@ccs/ui';
import type { Database } from '@ccs/supabase';
import styles from './page.module.css';
import AuthenticatedLayout from '../components/AuthenticatedLayout';

type Usuario = Database['public']['Tables']['usuarios']['Row'];

export default function TalentosPage() {
    const [estudiantes, setEstudiantes] = useState<Usuario[]>([]);
    const [filtroRol, setFiltroRol] = useState<RolKey | 'todos'>('todos');
    const [busqueda, setBusqueda] = useState('');
    const [loading, setLoading] = useState(true);
    const [myId, setMyId] = useState<string | null>(null);
    const [misEquipos, setMisEquipos] = useState<Database['public']['Tables']['equipos']['Row'][]>([]);
    const [eqSel, setEqSel] = useState<string>('');
    const [isBlocked, setIsBlocked] = useState(false);
    const [equiposFormacion, setEquiposFormacion] = useState<any[]>([]);
    const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null);
    const [idsEnCatedra, setIdsEnCatedra] = useState<string[] | null>(null);
    const [idsEnEquipo, setIdsEnEquipo] = useState<string[]>([]);
    const [nombreCatedraSel, setNombreCatedraSel] = useState('');
    const [loadingCatedra, setLoadingCatedra] = useState(false);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }
            setMyId(user.id);

            const { data: uData } = await supabase.from('usuarios').select('*').eq('id', user.id).single();
            setUsuarioActual(uData);

            const { data } = await supabase
                .from('usuarios')
                .select('*')
                .eq('tipo', 'estudiante')
                .order('nombre', { ascending: true });

            setEstudiantes(data ?? []);

            const { data: mms } = await (supabase.from('equipo_miembros') as any).select('equipo_id').eq('usuario_id', user.id);
            if (mms && mms.length > 0) {
                const { data: eqs } = await (supabase.from('equipos') as any).select('*').in('id', mms.map((m: any) => m.equipo_id));
                setMisEquipos(eqs ?? []);
                // No seteamos seleccion por defecto para que aparezcan todos al inicio como solicita el usuario
                setEqSel('');

                const finalizados = (eqs as any[])?.filter(e => e.estado_entrega) || [];
                let bloqueado = false;
                for (const eq of finalizados) {
                    const { data: mData } = await supabase.from('equipo_miembros').select('usuario_id').eq('equipo_id', eq.id);
                    const { data: yaEval } = await supabase.from('evaluaciones_360').select('evaluado_id').eq('evaluador_id', user.id).eq('equipo_id', eq.id);
                    if ((yaEval?.length || 0) < (mData?.length || 0)) {
                        bloqueado = true;
                        break;
                    }
                }
                setIsBlocked(bloqueado);
            }

            const { data: eqsForm } = await supabase
                .from('equipos')
                .select('*, equipo_miembros(usuario:usuarios(*))')
                .is('estado_entrega', null)
                .limit(10);
            setEquiposFormacion(eqsForm || []);

            setLoading(false);
        }
        cargar();
    }, []);

    useEffect(() => {
        if (!eqSel) {
            setIdsEnCatedra(null);
            setNombreCatedraSel('');
            setIdsEnEquipo([]);
            return;
        }
        setLoadingCatedra(true);
        async function filtrarPorCatedra() {
            // 1. Obtener catedra_id desde el equipo -> desafio
            const { data: eq } = await supabase
                .from('equipos')
                .select('desafio:desafios(catedra:catedras(*))')
                .eq('id', eqSel)
                .single();

            const catedra = (eq as any)?.desafio?.catedra;
            if (catedra) {
                setNombreCatedraSel(catedra.nombre_materia);
                // 2. Obtener todos los inscritos en esa cátedra
                const { data: ins } = await (supabase
                    .from('inscripciones') as any)
                    .select('usuario_id')
                    .eq('catedra_id', catedra.id);

                if (ins) {
                    const idsInscritos = (ins as any[]).map(i => i.usuario_id);
                    console.log(`Marketplace - Estudiantes en cátedra ${catedra.nombre_materia}:`, idsInscritos.length);
                    setIdsEnCatedra(idsInscritos);
                } else {
                    console.warn("Marketplace - No se pudieron cargar inscripciones de la cátedra.");
                }

                // 3. Obtener miembros actuales del equipo para excluirlos
                const { data: mms } = await supabase
                    .from('equipo_miembros')
                    .select('usuario_id')
                    .eq('equipo_id', eqSel);

                if (mms) {
                    console.log("Marketplace - Miembros actuales del equipo:", mms.length);
                    setIdsEnEquipo(mms.map((m: any) => m.usuario_id));
                }
            }
            setLoadingCatedra(false);
        }
        filtrarPorCatedra();
    }, [eqSel]);

    const filtrados = estudiantes.filter(e => {
        // Excluirme a mí mismo
        if (e.id === myId) return false;

        // Excluir si ya está en el equipo seleccionado
        if (idsEnEquipo.includes(e.id)) return false;

        const enCatedra = !eqSel || (idsEnCatedra && idsEnCatedra.includes(e.id));
        const cumpleRol = filtroRol === 'todos'
            || e.rol_primario === filtroRol
            || e.rol_secundario === filtroRol;
        const cumpleNombre = busqueda.trim() === ''
            || e.nombre.toLowerCase().includes(busqueda.toLowerCase());
        return enCatedra && cumpleRol && cumpleNombre;
    });

    const rolesList = Object.entries(ROLES) as [RolKey, typeof ROLES[RolKey]][];

    async function contactar(est: Usuario, rolP: any) {
        const eqNombre = misEquipos.find(e => e.id === eqSel)?.nombre_equipo || 'un equipo';
        const miNombre = usuarioActual?.nombre || 'Alguien';

        await supabase.from('notificaciones').insert({
            usuario_id: est.id,
            remitente_id: myId || undefined,
            tipo: 'contacto',
            estado: 'pendiente',
            mensaje: `${miNombre} del equipo "${eqNombre}" está interesado en tu perfil${rolP ? ` de ${rolP.label}` : ''}. Revisá Mis Proyectos.`,
        } as any);

        alert('✅ Notificación interna enviada con éxito.');
    }

    async function enviarAviso(est: Usuario) {
        if (!myId || !eqSel || !usuarioActual) return;
        const eqNombre = misEquipos.find(e => e.id === eqSel)?.nombre_equipo || 'su equipo';
        const miNombre = usuarioActual.nombre;

        const { error } = await supabase.from('solicitudes_equipo').insert({
            usuario_id: est.id,
            remitente_id: myId,
            tipo: 'interes',
            equipo_id: eqSel,
            estado: 'pendiente',
            mensaje: `🔔 ${miNombre} del equipo "${eqNombre}" está interesado en tu perfil.`
        } as any);

        if (error) {
            alert('Error al enviar el aviso.');
        } else {
            // Redundancia manual por si el trigger no está activo
            await supabase.from('notificaciones').insert({
                usuario_id: est.id,
                remitente_id: myId,
                tipo: 'interes_formal',
                equipo_id: eqSel,
                estado: 'pendiente',
                mensaje: `${usuarioActual.nombre} está interesado en tu perfil para su equipo "${eqNombre}".`,
            } as any);
            alert('✅ Aviso de interés enviado con éxito.');
        }
    }

    async function enviarInvitacion(est: Usuario) {
        if (!myId || !usuarioActual) return;

        if (!eqSel) {
            alert('⚠️ Para enviar una invitación, primero debés seleccionar a qué equipo querés sumarlo en el menú "Contexto de Búsqueda".');
            return;
        }

        const RolesMios = [usuarioActual.rol_primario, usuarioActual.rol_secundario];
        const RolesDest = [est.rol_primario, est.rol_secundario];

        const soyOrganizador = RolesMios.includes('organizador');
        const soyConciliador = RolesMios.includes('conciliador');
        const destEsOrganizador = RolesDest.includes('organizador');
        const destEsConciliador = RolesDest.includes('conciliador');

        if (!est.rol_primario) {
            alert('Este alumno aún no ha completado el test profesional.');
            return;
        }

        // Lógica de Jerarquía
        if (soyOrganizador && !destEsConciliador) {
            alert('Como Organizador, solo podés invitar a un Conciliador. Él se encargará de reclutar al resto del equipo.');
            return;
        }

        if (soyConciliador && !soyOrganizador && destEsOrganizador) {
            alert('No podés invitar a otro Organizador al equipo.');
            return;
        }

        if (!soyOrganizador && !soyConciliador) {
            alert('Solo los perfiles Organizador o Conciliador pueden emitir invitaciones.');
            return;
        }

        // Determinar el rol con el que lo invitamos (Priorizar el que necesitamos)
        const rolInvitadoRaw = soyOrganizador ? 'conciliador' : (est.rol_primario || 'ejecutor');

        const miEquipo = misEquipos.find(e => e.id === eqSel);
        const eqNombre = miEquipo?.nombre_equipo || 'su equipo';
        const msg = (miEquipo as any)?.cerrado
            ? `¿Invitar a ${est.nombre} al equipo "${eqNombre}" como ${ROLES[rolInvitadoRaw as RolKey]?.label || rolInvitadoRaw}?\n(Nota: El equipo está cerrado, se unirá directamente al proyecto en marcha)`
            : `¿Invitar a ${est.nombre} al equipo "${eqNombre}" como ${ROLES[rolInvitadoRaw as RolKey]?.label || rolInvitadoRaw}?`;

        const resp = confirm(msg);
        if (!resp) return;

        const { error } = await supabase.from('solicitudes_equipo').insert({
            equipo_id: eqSel,
            usuario_id: est.id,
            remitente_id: myId,
            tipo: 'invitacion',
            estado: 'pendiente',
            mensaje: `¡Hola! ${usuarioActual.nombre} te invita a su equipo "${eqNombre}" en CCS.`
        } as any);

        if (error) {
            if (error.code === '23505') alert('Ya enviaste una invitación.');
            else alert('Error al enviar invitación.');
        } else {
            // Redundancia manual por si el trigger no está activo
            await supabase.from('notificaciones').insert({
                usuario_id: est.id,
                remitente_id: myId,
                tipo: 'invitacion',
                equipo_id: eqSel,
                rol_invitado: rolInvitadoRaw,
                estado: 'pendiente',
                mensaje: `${usuarioActual.nombre} te invita como ${ROLES[rolInvitadoRaw as RolKey]?.label || 'miembro'} a su equipo "${eqNombre}".`,
            } as any);
            alert('✅ Invitación enviada.');
        }
    }

    return (
        <AuthenticatedLayout>
            <div className={styles.header}>
                <h1>🏪 Marketplace de Talentos</h1>
                <p className={styles.sub}>
                    {nombreCatedraSel
                        ? `Buscando compañeros para ${nombreCatedraSel}`
                        : 'Encontrá compañeros por rol o descubrí equipos en formación.'}
                </p>
            </div>

            <div className={styles.equiposFormSection}>
                <h2>{misEquipos.length > 0 ? '🏆 Mi Equipo Actual' : '📍 Equipos en Formación'}</h2>
                <div className={styles.eqScroll}>
                    {misEquipos.length > 0 ? (
                        misEquipos.map(eq => (
                            <div key={eq.id} className={`${styles.eqSmallCard} ${styles.eqActive}`}>
                                <strong>{eq.nombre_equipo}</strong>
                                <div className={styles.eqMmsMini}>
                                    <span className={styles.eqFaltan}>Ya formas parte de este equipo.</span>
                                </div>
                            </div>
                        ))
                    ) : equiposFormacion.length === 0 ? (
                        <p className={styles.emptyEq}>No hay equipos armándose en este momento.</p>
                    ) : (
                        equiposFormacion.map(eq => (
                            <div key={eq.id} className={styles.eqSmallCard}>
                                <strong>{eq.nombre_equipo}</strong>
                                <div className={styles.eqMmsMini}>
                                    {eq.equipo_miembros?.map((m: any) => (
                                        <div key={m.usuario.id} className={styles.miniAv} title={`${m.usuario.nombre} (${m.usuario.rol_primario})`}>
                                            {m.usuario.nombre.charAt(0)}
                                        </div>
                                    ))}
                                </div>
                                <span className={styles.eqFaltan}>Buscando talentos...</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className={styles.filtersSection}>
                <div className={styles.searchWrap}>
                    <span className={styles.searchIcon}>🔍</span>
                    <input
                        className={styles.searchBar}
                        placeholder="Buscar por nombre..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>

                <div className={styles.filtros}>
                    <button
                        className={`${styles.filtroBtn} ${filtroRol === 'todos' ? styles.active : ''}`}
                        onClick={() => setFiltroRol('todos')}
                    >
                        ✨ Todos
                    </button>
                    {rolesList.map(([key, rol]) => (
                        <button
                            key={key}
                            className={`${styles.filtroBtn} ${filtroRol === key ? styles.active : ''}`}
                            style={{ '--rc': rol.color } as React.CSSProperties}
                            onClick={() => setFiltroRol(key)}
                        >
                            {rol.icon} {rol.label}
                        </button>
                    ))}
                </div>
            </div>

            {(misEquipos.length > 0 || loadingCatedra) && (
                <div className={styles.eqSelector}>
                    <span>Contexto de Búsqueda:</span>
                    <select value={eqSel} onChange={e => setEqSel(e.target.value)} disabled={loadingCatedra}>
                        <option value="">✨ Todos los estudiantes (Sin cátedra)</option>
                        {misEquipos.map(e => <option key={e.id} value={e.id}>🏆 Equipo: {e.nombre_equipo}</option>)}
                    </select>
                    {loadingCatedra && <span className={styles.miniLoader}>Cargando cátedra...</span>}
                </div>
            )}

            {!loading && filtrados.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🔍</div>
                    <h3>No encontramos perfiles</h3>
                    <p>Probá con otros filtros o invitá a tus compañeros.</p>
                </div>
            ) : (
                <div className={styles.listTable}>
                    <div className={styles.listHeader}>
                        <span>Nombre / Disponibilidad</span>
                        <span>Rol Destacado</span>
                        <span>Competencias</span>
                        <span>Acciones</span>
                    </div>
                    {filtrados.map(est => {
                        const pref = (est as any).preferencia_rol_busqueda || 'primario';
                        const rolP = est.rol_primario ? ROLES[est.rol_primario as RolKey] : null;
                        const rolS = est.rol_secundario ? ROLES[est.rol_secundario as RolKey] : null;

                        const mainTalent = pref === 'secundario' && rolS ? rolS : rolP;
                        const secTalent = pref === 'secundario' && rolS ? rolP : rolS;

                        const scores = est.resultados_test as any;

                        return (
                            <div key={est.id} className={`${styles.listRow} ${est.id === myId ? styles.isMe : ''} ${!est.buscando_equipo ? styles.notSearching : ''}`}>
                                <div className={styles.estName}>
                                    <div className={styles.avatar} style={{ background: mainTalent?.color || '#1a2b5e' }}>
                                        {est.foto_url ? <img src={est.foto_url} alt={est.nombre} /> : est.nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={styles.nameInfo}>
                                        <span className={styles.name}>{est.nombre}</span>
                                        {est.buscando_equipo ? (
                                            <span className={styles.statusBadge}>🟢 Disponible</span>
                                        ) : (
                                            <span className={`${styles.statusBadge} ${styles.statusOff}`}>⚪ No busca equipo</span>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.estRoles}>
                                    {mainTalent ? (
                                        <>
                                            <span className={styles.mainBadge} style={{ background: mainTalent.color + '20', color: mainTalent.color }}>
                                                {mainTalent.icon} {mainTalent.label}
                                            </span>
                                            {secTalent && <span className={styles.secLabel}>{secTalent.icon} {secTalent.label}</span>}
                                        </>
                                    ) : (
                                        <span className={styles.pendingBadge}>⏳ Test Pendiente</span>
                                    )}
                                </div>

                                <div className={styles.estSkills}>
                                    {scores && (
                                        <div className={styles.miniBars}>
                                            {(Object.keys(ROLES) as RolKey[]).map(rk => {
                                                const r = ROLES[rk];
                                                const val = (scores[rk] as number) || 0;
                                                const max = Math.max(...Object.values(scores) as number[]) || 1;
                                                const h = Math.round((val / max) * 14);
                                                return <div key={rk} className={styles.miniBar} style={{ height: `${h}px`, background: r.color }} title={r.label} />;
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className={styles.actions}>
                                    {/* Eliminado ✉️ por solicitud v17 */}

                                    {misEquipos.length > 0 && est.id !== myId && (
                                        (() => {
                                            const RolesMios = [usuarioActual?.rol_primario, usuarioActual?.rol_secundario];
                                            const RolesDest = [est.rol_primario, est.rol_secundario];

                                            const soyOrganizador = RolesMios.includes('organizador');
                                            const soyConciliador = RolesMios.includes('conciliador');
                                            const puedeInvitar = soyOrganizador || soyConciliador;

                                            // Un Organizador solo invita a Conciliadores. 
                                            // Un Conciliador puede invitar a todos excepto Organizadores.
                                            const destinoValido = soyOrganizador
                                                ? RolesDest.includes('conciliador')
                                                : !RolesDest.includes('organizador');

                                            if (!puedeInvitar || !destinoValido) return null;

                                            return est.buscando_equipo ? (
                                                <button
                                                    onClick={() => enviarInvitacion(est)}
                                                    className={styles.btnInviteCompact}
                                                    disabled={isBlocked}
                                                    title={isBlocked ? "Debés completar la evaluación 360 pendiente para invitar" : ""}
                                                >
                                                    ➕ Invitar
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => enviarAviso(est)}
                                                    className={styles.btnAviso}
                                                    disabled={isBlocked}
                                                    title={isBlocked ? "Debés completar la evaluación 360 pendiente para avisar" : "Mandar aviso de interés"}
                                                >
                                                    🔔 Avisar
                                                </button>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </AuthenticatedLayout>
    );
}
