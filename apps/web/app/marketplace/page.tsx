'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@ccs/supabase';
import { ROLES, type RolKey } from '@ccs/ui';
import type { Database } from '@ccs/supabase';
import styles from './page.module.css';
import AuthenticatedLayout from '../components/AuthenticatedLayout';

type Usuario = Database['public']['Tables']['usuarios']['Row'];

export default function MarketplacePage() {
    const [estudiantes, setEstudiantes] = useState<Usuario[]>([]);
    const [filtroRol, setFiltroRol] = useState<RolKey | 'todos'>('todos');
    const [busqueda, setBusqueda] = useState('');
    const [loading, setLoading] = useState(true);
    const [myId, setMyId] = useState<string | null>(null);
    const [misEquipos, setMisEquipos] = useState<Database['public']['Tables']['equipos']['Row'][]>([]);
    const [eqSel, setEqSel] = useState<string>('');

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }
            setMyId(user.id);

            const { data } = await supabase
                .from('usuarios')
                .select('*')
                .eq('tipo', 'estudiante')
                .not('rol_primario', 'is', null)
                .order('buscando_equipo', { ascending: false })
                .order('created_at', { ascending: false });

            setEstudiantes(data ?? []);

            const { data: mms } = await (supabase.from('equipo_miembros') as any).select('equipo_id').eq('usuario_id', user.id);
            if (mms && mms.length > 0) {
                const { data: eqs } = await (supabase.from('equipos') as any).select('*').in('id', mms.map((m: any) => m.equipo_id));
                setMisEquipos(eqs ?? []);
                if (eqs && eqs.length > 0) setEqSel(eqs[0].id);
            }

            setLoading(false);
        }
        cargar();
    }, []);

    const filtrados = estudiantes.filter(e => {
        const cumpleRol = filtroRol === 'todos'
            || e.rol_primario === filtroRol
            || e.rol_secundario === filtroRol;
        const cumpleNombre = busqueda.trim() === ''
            || e.nombre.toLowerCase().includes(busqueda.toLowerCase());
        return cumpleRol && cumpleNombre;
    });

    const rolesList = Object.entries(ROLES) as [RolKey, typeof ROLES[RolKey]][];

    async function contactar(est: Usuario, rolP: any) {
        await supabase.from('notificaciones').insert({
            usuario_id: est.id,
            remitente_id: myId ?? undefined,
            tipo: 'contacto',
            mensaje: `Alguien está interesado en tu perfil${rolP ? ` de ${rolP.label}` : ''}.`,
        } as any);
        const asunto = encodeURIComponent(`CCS – Interés en tu perfil ${rolP?.label ?? ''}`);
        const cuerpo = encodeURIComponent(`Hola ${est.nombre.split(' ')[0]},\n\nVi tu perfil en el Marketplace CCS y me gustaría invitarte a mi equipo.\n\nSaludos,`);
        window.open(`mailto:${est.email}?subject=${asunto}&body=${cuerpo}`);
    }

    async function enviarInvitacion(est: Usuario) {
        if (!myId || !eqSel) return;
        const resp = confirm(`¿Invitar a ${est.nombre} a tu equipo?`);
        if (!resp) return;

        const { error } = await supabase.from('solicitudes_equipo').insert({
            equipo_id: eqSel,
            usuario_id: est.id,
            remitente_id: myId,
            tipo: 'invitacion',
            mensaje: `¡Hola! Te invito a mi equipo en CCS.`
        } as any);

        if (error) {
            if (error.code === '23505') alert('Ya enviaste una invitación.');
            else alert('Error al enviar invitación.');
        } else {
            alert('✅ Invitación enviada.');
        }
    }

    return (
        <AuthenticatedLayout>
            <div className={styles.header}>
                <h1>🏪 Marketplace de Talentos</h1>
                <p className={styles.sub}>Encontrá compañeros por rol o buscá por nombre.</p>
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

            {misEquipos.length > 1 && (
                <div className={styles.eqSelector}>
                    <span>Invitar a:</span>
                    <select value={eqSel} onChange={e => setEqSel(e.target.value)}>
                        {misEquipos.map(e => <option key={e.id} value={e.id}>{e.nombre_equipo}</option>)}
                    </select>
                </div>
            )}

            {!loading && filtrados.length === 0 ? (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>🔍</div>
                    <h3>No encontramos perfiles</h3>
                    <p>Probá con otros filtros o invitá a tus compañeros de cátedra a completar el test.</p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {filtrados.map(est => {
                        const pref = (est as any).preferencia_rol_busqueda || 'primario';
                        const rolP = est.rol_primario ? ROLES[est.rol_primario as RolKey] : null;
                        const rolS = est.rol_secundario ? ROLES[est.rol_secundario as RolKey] : null;

                        // Determinar cuál mostrar como principal
                        const mainTalent = pref === 'secundario' && rolS ? rolS : rolP;
                        const secTalent = pref === 'secundario' && rolS ? rolP : rolS;

                        const scores = est.resultados_test as any;

                        return (
                            <div key={est.id} className={`${styles.profileCard} ${est.id === myId ? styles.isMe : ''}`}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.avatar} style={{ background: mainTalent?.color || '#1a2b5e' }}>
                                        {est.foto_url ? <img src={est.foto_url} alt={est.nombre} /> : est.nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <div className={styles.cardInfo}>
                                        <div className={styles.nameRow}>
                                            <span className={styles.name}>{est.nombre}</span>
                                            {est.buscando_equipo && <span className={styles.status}>🟢 Disponible</span>}
                                        </div>
                                        {mainTalent && (
                                            <div className={styles.mainRol} style={{ color: mainTalent.color }}>
                                                {mainTalent.icon} {mainTalent.label}
                                                {pref === 'secundario' && <span className={styles.prefBadge}> (Elegido)</span>}
                                            </div>
                                        )}
                                        {secTalent && <div className={styles.secRol}>{secTalent.icon} {secTalent.label}</div>}
                                    </div>
                                </div>

                                {scores && (
                                    <div className={styles.skillsSection}>
                                        <div className={styles.bars}>
                                            {(Object.keys(ROLES) as RolKey[]).map(rk => {
                                                const r = ROLES[rk];
                                                const max = Math.max(...Object.values(scores) as number[]) || 1;
                                                const val = (scores[rk] as number) || 0;
                                                const pct = Math.round((val / max) * 100);
                                                return (
                                                    <div key={rk} className={styles.barItem}>
                                                        <div className={styles.barWrap} title={`${r.label}: ${val}`}>
                                                            <div className={styles.barFill} style={{ height: `${pct}%`, background: r.color }} />
                                                        </div>
                                                        <span className={styles.barIcon}>{r.icon}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className={styles.actions}>
                                    <button onClick={() => contactar(est, rolP)} className={styles.btnMail}>
                                        <span className={styles.mailIcon}>✉️</span> Mail de contacto
                                    </button>
                                    {misEquipos.length > 0 && est.id !== myId && (
                                        <button onClick={() => enviarInvitacion(est)} className={styles.btnInvite}>➕ Invitar</button>
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
