'use client';
import { useEffect, useState, useCallback, use } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { supabase } from '@ccs/supabase';
import { ROLES, type RolKey } from '@ccs/ui';
import { TAREAS_POR_ROL } from '@ccs/logic';
import type { Database } from '@ccs/supabase';
import Link from 'next/link';
import styles from './page.module.css';

type TareaDB = Database['public']['Tables']['tareas']['Row'];
type EstadoKan = TareaDB['estado'];
type EquipoDB = Database['public']['Tables']['equipos']['Row'];
type DesafioDB = Database['public']['Tables']['desafios']['Row'];

const COLUMNAS: { id: EstadoKan; label: string; emoji: string; color: string }[] = [
    { id: 'backlog', label: 'Backlog', emoji: '📋', color: '#e2eaf2' },
    { id: 'doing', label: 'En Curso', emoji: '🔄', color: '#fff3d0' },
    { id: 'review', label: 'Revisión', emoji: '👀', color: '#e8f0ff' },
    { id: 'done', label: 'Listo', emoji: '✅', color: '#d0f5ec' },
];

export default function KanbanPage({ params }: { params: Promise<{ equipoId: string }> }) {
    const { equipoId } = use(params);
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    const [equipo, setEquipo] = useState<any | null>(null);
    const [desafio, setDesafio] = useState<DesafioDB | null>(null);
    const [tareas, setTareas] = useState<TareaDB[]>([]);
    const [loading, setLoading] = useState(true);
    const [dragging, setDragging] = useState<string | null>(null);
    const [showNew, setShowNew] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [newDesc, setNewDesc] = useState('');
    const [newRol, setNewRol] = useState<RolKey>('organizador');
    const [saving, setSaving] = useState(false);
    const [diasRestantes, setDiasRestantes] = useState<number | null>(null);
    const [filtroRol, setFiltroRol] = useState<RolKey | null>((searchParams.get('rol') as RolKey) || null);
    const [rolesPresentes, setRolesPresentes] = useState<RolKey[]>([]);
    const [myRol, setMyRol] = useState<RolKey | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [userType, setUserType] = useState<string | null>(null);
    const [showDesModal, setShowDesModal] = useState(false);

    // Sincronizar filtro con URL
    const updateFiltro = useCallback((rol: RolKey | null) => {
        setFiltroRol(rol);
        const params = new URLSearchParams(searchParams);
        if (rol) {
            params.set('rol', rol);
        } else {
            params.delete('rol');
        }
        router.push(`${pathname}?${params.toString()}`);
    }, [searchParams, pathname, router]);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }
            setUserId(user.id);

            const { data: u } = await supabase.from('usuarios').select('tipo').eq('id', user.id).single();
            setUserType((u as any)?.tipo || null);

            // Cargar equipo
            const { data: eq } = await supabase
                .from('equipos')
                .select('*')
                .eq('id', equipoId)
                .single() as any;
            setEquipo(eq);

            // Cargar desafío
            if (eq) {
                const { data: des } = await (supabase
                    .from('desafios')
                    .select('*')
                    .eq('id', (eq as any).desafio_id)
                    .single() as any);
                setDesafio(des);

                // Calcular días restantes
                if ((des as any)?.fecha_entrega) {
                    const hoy = new Date();
                    const plazo = new Date((des as any).fecha_entrega);
                    const diff = Math.ceil((plazo.getTime() - hoy.getTime()) / 86_400_000);
                    setDiasRestantes(diff);
                }
            }

            // Cargar tareas
            const { data: ts } = await supabase
                .from('tareas')
                .select('*')
                .eq('equipo_id', equipoId)
                .order('created_at') as any;
            setTareas(ts ?? []);

            // Cargar roles del equipo
            const { data: mbs } = await supabase
                .from('equipo_miembros')
                .select('rol_en_equipo, usuario_id')
                .eq('equipo_id', equipoId) as any;

            if (mbs) {
                const uniqRoles = Array.from(new Set((mbs as any[]).map((m: any) => m.rol_en_equipo as RolKey))) as RolKey[];
                setRolesPresentes(uniqRoles);
                const me = (mbs as any[]).find((m: any) => m.usuario_id === user.id);
                if (me) {
                    const myR = me.rol_en_equipo as RolKey;
                    setMyRol(myR);
                    setNewRol(myR);

                    // Si no hay filtro en la URL, por defecto filtramos por "mi rol"
                    const currentFilter = searchParams.get('rol');
                    if (!currentFilter) {
                        setFiltroRol(myR);
                    }
                }
            }

            setLoading(false);

            // Suscripción Realtime
            const canal = supabase
                .channel(`kanban-${equipoId}`)
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'tareas',
                    filter: `equipo_id=eq.${equipoId}`,
                }, (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setTareas(prev => [...prev, payload.new as TareaDB]);
                    } else if (payload.eventType === 'UPDATE') {
                        setTareas(prev => prev.map(t => t.id === (payload.new as TareaDB).id ? (payload.new as TareaDB) : t));
                    } else if (payload.eventType === 'DELETE') {
                        setTareas(prev => prev.filter(t => t.id !== (payload.old as TareaDB).id));
                    }
                })
                .subscribe();

            return () => { supabase.removeChannel(canal); };
        }
        cargar();
    }, [equipoId]);

    // ── Drag & Drop ──────────────────────────────────────────────
    function onDragStart(e: React.DragEvent, id: string) {
        setDragging(id);
        e.dataTransfer.effectAllowed = 'move';
    }

    async function onDrop(e: React.DragEvent, columna: EstadoKan) {
        e.preventDefault();
        if (!dragging) return;
        const old = tareas.find(t => t.id === dragging);
        if (!old || old.estado === columna) { setDragging(null); return; }

        // Optimistic update
        setTareas(prev => prev.map(t => t.id === dragging ? { ...t, estado: columna } : t));
        setDragging(null);

        if (!equipo?.cerrado) {
            alert('El equipo aún no está cerrado. El Organizador debe marcarlo como completo en "Mis Equipos" para operar el Kanban.');
            window.location.reload();
            return;
        }

        await (supabase.from('tareas') as any).update({ estado: columna }).eq('id', dragging);
    }

    function onDragOver(e: React.DragEvent) { e.preventDefault(); }

    // ── Nueva tarea ───────────────────────────────────────────────
    async function crearTarea() {
        if (!newDesc.trim()) return;
        setSaving(true);
        await (supabase.from('tareas') as any).insert({
            equipo_id: equipoId,
            descripcion: newDesc.trim(),
            rol_asociado: newRol,
            estado: 'backlog',
        });
        setNewDesc('');
        setShowNew(false);
        setSaving(false);
    }

    async function eliminarTarea(id: string) {
        setTareas(prev => prev.filter(t => t.id !== id));
        await (supabase.from('tareas') as any).delete().eq('id', id);
    }

    async function importarChecklist(rolDestino: RolKey) {
        if (!desafio) return;
        setSaving(true);

        const nuevasTareas: any[] = [];

        // 1. Tareas del Desafío (Docente) -> Al rol seleccionado
        if (desafio.checklist_sugerido && (desafio.checklist_sugerido as any).length > 0) {
            const checklist = (desafio as any).checklist_sugerido as { descripcion: string }[];
            nuevasTareas.push(...checklist.map(item => ({
                equipo_id: equipoId,
                descripcion: `📌 [DOCENTE] ${item.descripcion}`,
                rol_asociado: rolDestino,
                estado: 'backlog'
            })));
        }

        // 2. Tareas por Rol (Automáticas) -> Cada una a su rol correspondiente (Importamos TODO para que el equipo las delegue)
        (Object.keys(TAREAS_POR_ROL) as RolKey[]).forEach(rol => {
            const tareasRol = TAREAS_POR_ROL[rol];
            if (tareasRol) {
                nuevasTareas.push(...tareasRol.map(t => ({
                    equipo_id: equipoId,
                    descripcion: t.descripcion,
                    rol_asociado: rol,
                    estado: 'backlog'
                })));
            }
        });

        if (nuevasTareas.length === 0) {
            setSaving(false);
            setShowImport(false);
            return;
        }

        const { data, error } = await (supabase.from('tareas') as any).insert(nuevasTareas).select();
        if (!error && data) {
            setTareas(prev => [...prev, ...data]);
        }
        setSaving(false);
        setShowImport(false);
    }

    // ── Stats ─────────────────────────────────────────────────────
    const total = tareas.length;
    const doneCount = tareas.filter(t => t.estado === 'done').length;
    const progreso = total > 0 ? Math.round((doneCount / total) * 100) : 0;

    if (loading) return (
        <div className={styles.loadingWrap}>
            <div className={styles.spinner} />
            <p>Cargando tablero...</p>
        </div>
    );

    return (
        <div className={styles.page}>
            {/* HEADER */}
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <div className={styles.headerLeft}>
                        <Link href={userType === 'docente' ? '/docente/dashboard' : '/dashboard'} className={styles.back}>← Panel</Link>
                        <img src="/logo-icon.png" alt="CCS" width="28" height="28" style={{ objectFit: 'contain' }} />
                        <div>
                            <div className={styles.headerTitle}>{equipo?.nombre_equipo ?? 'Mi Equipo'}</div>
                            {desafio && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                                    <button
                                        className={styles.btnDesInfoPill}
                                        onClick={() => setShowDesModal(true)}
                                        title={`Leer sobre: ${desafio.titulo}`}
                                    >
                                        <span className={styles.pillIcon}>📖</span>
                                        <span className={styles.pillText}>LEER EL DESAFÍO</span>
                                    </button>
                                    {desafio.documento_url && (
                                        <a
                                            href={desafio.documento_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={styles.btnDirectDoc}
                                            title="Descargar PDF con las consignas del docente"
                                        >
                                            📄 DESCARGAR PDF
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cuenta regresiva */}
                    <div className={styles.countdown}>
                        {diasRestantes !== null && (
                            <div className={`${styles.countdownBadge} ${diasRestantes <= 3 ? styles.urgent : diasRestantes <= 7 ? styles.warning : styles.ok}`}>
                                ⏰ {diasRestantes > 0 ? `${diasRestantes}d restantes` : diasRestantes === 0 ? '¡Hoy!' : 'Vencido'}
                            </div>
                        )}
                        <div className={styles.progressBadge}>
                            <div className={styles.progressBarMini}>
                                <div className={styles.progressFillMini} style={{ width: `${progreso}%` }} />
                            </div>
                            <span>{progreso}% listo</span>
                        </div>
                    </div>

                    {tareas.length === 0 && desafio?.checklist_sugerido && (desafio.checklist_sugerido as any).length > 0 && (
                        <button
                            className={styles.btnImport}
                            onClick={() => equipo?.cerrado ? setShowImport(true) : alert('Primero debés cerrar el grupo en "Mis Equipos".')}
                            disabled={saving}
                        >
                            ⚡ Importar guía
                        </button>
                    )}
                    <button
                        className={styles.btnAdd}
                        onClick={() => equipo?.cerrado ? setShowNew(true) : alert('Primero debés cerrar el grupo en "Mis Equipos".')}
                        id="btn-nueva-tarea"
                    >
                        + Nueva tarea
                    </button>
                </div>
            </header>

            {!equipo?.cerrado && (
                <div className={styles.lockBanner}>
                    ⚠️ El Tablero está en modo <strong>Solo Lectura</strong> hasta que el Organizador cierre el grupo en "Mis Equipos".
                </div>
            )}

            {/* BARRA DE FILTROS POR ROL */}
            <div className={styles.filterBar}>
                <div className={styles.filterGroup}>
                    <button
                        className={`${styles.filterBtn} ${filtroRol === null ? styles.filterBtnActive : ''}`}
                        onClick={() => updateFiltro(null)}
                    >
                        Todas las tareas
                    </button>
                    {(Object.keys(ROLES) as RolKey[]).map(rk => {
                        const r = ROLES[rk];
                        const count = tareas.filter(t => t.rol_asociado === rk).length;
                        if (count === 0 && !rolesPresentes.includes(rk)) return null;
                        return (
                            <button
                                key={rk}
                                className={`${styles.filterBtn} ${filtroRol === rk ? styles.filterBtnActive : ''}`}
                                onClick={() => updateFiltro(rk)}
                                style={filtroRol === rk ? { '--rc': r.color } as React.CSSProperties : {}}
                            >
                                {r.icon} {r.label}
                                {count > 0 && <span className={styles.myTag}> ({count})</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* MODAL NUEVA TAREA */}
            {showNew && (
                <div className={styles.modalOverlay} onClick={() => setShowNew(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3>Nueva tarea</h3>
                        <textarea
                            className={styles.modalInput}
                            placeholder="Descripción de la tarea…"
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            rows={3}
                            autoFocus
                        />
                        <div className={styles.rolSelector}>
                            <span>Rol:</span>
                            {(Object.keys(ROLES) as RolKey[]).map(key => (
                                <button
                                    key={key}
                                    className={`${styles.rolChip} ${newRol === key ? styles.rolChipActive : ''}`}
                                    style={newRol === key ? { '--rc': ROLES[key].color } as React.CSSProperties : {}}
                                    onClick={() => setNewRol(key)}
                                >
                                    {ROLES[key].icon} {ROLES[key].label}
                                </button>
                            ))}
                        </div>
                        <div className={styles.modalActions}>
                            <button className={styles.btnCancel} onClick={() => setShowNew(false)}>Cancelar</button>
                            <button className={styles.btnCreate} onClick={crearTarea} disabled={saving || !newDesc.trim()}>
                                {saving ? 'Guardando...' : 'Crear tarea'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL IMPORTAR GUÍA */}
            {showImport && (
                <div className={styles.modalOverlay} onClick={() => setShowImport(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3>Importar guía de tareas</h3>
                        <p className={styles.modalSub}>Seleccioná a qué rol se le asignarán las tareas del desafío planteado por el docente:</p>

                        <div className={styles.rolSelectorImport}>
                            {rolesPresentes.map(rk => {
                                const r = ROLES[rk];
                                return (
                                    <button
                                        key={rk}
                                        className={styles.rolChipBig}
                                        style={{ '--rc': r.color } as React.CSSProperties}
                                        onClick={() => importarChecklist(rk)}
                                        disabled={saving}
                                    >
                                        <span className={styles.rolChipIcon}>{r.icon}</span>
                                        <div className={styles.rolChipInfo}>
                                            <strong>{r.label}</strong>
                                            <span>{myRol === rk ? 'Tu rol' : 'Compañero'}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className={styles.modalActions}>
                            <button className={styles.btnCancel} onClick={() => setShowImport(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* TABLERO KANBAN */}
            <main className={styles.board}>
                {COLUMNAS.map(col => {
                    const tareasCol = tareas
                        .filter(t => t.estado === col.id)
                        .filter(t => filtroRol === null || t.rol_asociado === filtroRol);
                    const isDragOver = dragging !== null;
                    return (
                        <div
                            key={col.id}
                            className={`${styles.column} ${isDragOver ? styles.columnDragOver : ''}`}
                            onDrop={e => onDrop(e, col.id)}
                            onDragOver={onDragOver}
                        >
                            {/* Columna header */}
                            <div className={styles.colHeader} style={{ background: col.color }}>
                                <span>{col.emoji} {col.label}</span>
                                <span className={styles.colCount}>{tareasCol.length}</span>
                            </div>

                            {/* Tarjetas */}
                            <div className={styles.cards}>
                                {tareasCol.map(t => {
                                    const rol = ROLES[t.rol_asociado as RolKey];
                                    return (
                                        <div
                                            key={t.id}
                                            className={`${styles.card} ${dragging === t.id ? styles.cardDragging : ''}`}
                                            draggable
                                            onDragStart={e => onDragStart(e, t.id)}
                                            onDragEnd={() => setDragging(null)}
                                        >
                                            <div className={styles.cardHeaderRow}>
                                                <div className={styles.cardRolBadge} style={{ '--rc': rol.color } as React.CSSProperties}>
                                                    {rol.icon} {rol.label}
                                                </div>
                                                <select
                                                    className={styles.rolMiniSelect}
                                                    value={t.rol_asociado}
                                                    onChange={async (e) => {
                                                        const newR = e.target.value;
                                                        setTareas(prev => prev.map(x => x.id === t.id ? { ...x, rol_asociado: newR as any } : x));
                                                        await (supabase.from('tareas') as any).update({ rol_asociado: newR }).eq('id', t.id);
                                                    }}
                                                >
                                                    {(Object.keys(ROLES) as RolKey[]).map(rk => (
                                                        <option key={rk} value={rk}>{ROLES[rk].icon} {ROLES[rk].label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <p className={styles.cardDesc}>{t.descripcion}</p>
                                            <div className={styles.cardFooter}>
                                                <div className={styles.cardActions}>
                                                    {COLUMNAS.map(dest => dest.id !== t.estado && (
                                                        <button
                                                            key={dest.id}
                                                            className={styles.moveBtn}
                                                            title={`Mover a ${dest.label}`}
                                                            onClick={async () => {
                                                                setTareas(prev => prev.map(x => x.id === t.id ? { ...x, estado: dest.id, usuario_id: x.usuario_id || (userType === 'estudiante' ? userId : null) } : x));
                                                                const updatePayload: any = { estado: dest.id };
                                                                if (!t.usuario_id && userType === 'estudiante') {
                                                                    updatePayload.usuario_id = userId;
                                                                }
                                                                await (supabase.from('tareas') as any).update(updatePayload).eq('id', t.id);
                                                            }}
                                                        >
                                                            {dest.emoji}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button
                                                    className={styles.deleteBtn}
                                                    title="Eliminar tarea"
                                                    onClick={() => eliminarTarea(t.id)}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Drop zone vacía */}
                                {tareasCol.length === 0 && (
                                    <div className={styles.emptyCol}>
                                        <p>Arrastrá tareas aquí</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </main>

            {/* BARRA DE PROGRESO GLOBAL */}
            <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progreso}%` }} />
            </div>

            {/* MODAL DETALLE DESAFÍO */}
            {showDesModal && desafio && (
                <div className={styles.modalOverlay} onClick={() => setShowDesModal(false)}>
                    <div className={styles.modalDes} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeaderDes}>
                            <span className={styles.modalIconDes}>🚀</span>
                            <div style={{ flex: 1 }}>
                                <h2>{desafio.titulo}</h2>
                                <p className={styles.modalSubDes}>Consigna del docente</p>
                            </div>
                            {desafio.documento_url && (
                                <a href={desafio.documento_url} target="_blank" rel="noreferrer" className={styles.btnDirectDoc}>
                                    📄 DESCARGAR PDF
                                </a>
                            )}
                        </div>

                        <div className={styles.modalBody}>
                            {desafio.documento_url && (
                                <div className={styles.modalSection}>
                                    <h3>📁 ARCHIVO PRINCIPAL DEL DESAFÍO</h3>
                                    <a
                                        href={desafio.documento_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={styles.btnDocDesMain}
                                    >
                                        📥 DESCARGAR CONSIGNAS (PDF/IMAGEN)
                                    </a>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '8px' }}>ℹ️ Este documento contiene las especificaciones técnicas dadas por el docente.</p>
                                </div>
                            )}

                            <div className={styles.modalSection}>
                                <h3>📝 Resumen / Comentarios</h3>
                                <p className={styles.desDescripcion}>
                                    {(desafio as any).descripcion || 'No hay una descripción adicional escrita todavía.'}
                                </p>
                            </div>

                            {desafio.checklist_sugerido && (desafio.checklist_sugerido as any).length > 0 && (
                                <div className={styles.modalSection}>
                                    <h3>📌 Checklist sugerido</h3>
                                    <ul className={styles.modalChecklist}>
                                        {(desafio.checklist_sugerido as any).map((item: any, idx: number) => (
                                            <li key={idx}>✅ {item.descripcion}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <button className={styles.btnConfirmDes} onClick={() => setShowDesModal(false)}>Entendido</button>
                    </div>
                </div>
            )}
        </div>
    );
}
