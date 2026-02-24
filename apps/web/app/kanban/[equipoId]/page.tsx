'use client';
import { useEffect, useState, useCallback, use } from 'react';
import { supabase } from '@ccs/supabase';
import { ROLES, type RolKey } from '@ccs/ui';
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

    const [equipo, setEquipo] = useState<EquipoDB | null>(null);
    const [desafio, setDesafio] = useState<DesafioDB | null>(null);
    const [tareas, setTareas] = useState<TareaDB[]>([]);
    const [loading, setLoading] = useState(true);
    const [dragging, setDragging] = useState<string | null>(null);
    const [showNew, setShowNew] = useState(false);
    const [newDesc, setNewDesc] = useState('');
    const [newRol, setNewRol] = useState<RolKey>('organizador');
    const [saving, setSaving] = useState(false);
    const [diasRestantes, setDiasRestantes] = useState<number | null>(null);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }

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

    async function importarChecklist() {
        if (!desafio?.checklist_sugerido || (desafio.checklist_sugerido as any).length === 0) return;
        setSaving(true);

        const checklist = (desafio as any).checklist_sugerido as { descripcion: string }[];
        const nuevasTareas = checklist.map(item => ({
            equipo_id: equipoId,
            descripcion: item.descripcion,
            rol_asociado: 'organizador',
            estado: 'backlog'
        }));

        const { data, error } = await (supabase.from('tareas') as any).insert(nuevasTareas).select();
        if (!error && data) {
            setTareas(prev => [...prev, ...data]);
        }
        setSaving(false);
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
                        <Link href="/dashboard" className={styles.back}>← Panel</Link>
                        <img src="/logo-icon.png" alt="CCS" width="28" height="28" style={{ objectFit: 'contain' }} />
                        <div>
                            <div className={styles.headerTitle}>{equipo?.nombre_equipo ?? 'Mi Equipo'}</div>
                            {desafio && <div className={styles.headerSub}>{desafio.titulo}</div>}
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
                        <button className={styles.btnImport} onClick={importarChecklist} disabled={saving}>
                            ⚡ Importar guía
                        </button>
                    )}
                    <button className={styles.btnAdd} onClick={() => setShowNew(true)} id="btn-nueva-tarea">
                        + Nueva tarea
                    </button>
                </div>
            </header>

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

            {/* TABLERO KANBAN */}
            <main className={styles.board}>
                {COLUMNAS.map(col => {
                    const tareasCol = tareas.filter(t => t.estado === col.id);
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
                                            <div className={styles.cardRolBadge} style={{ '--rc': rol.color } as React.CSSProperties}>
                                                {rol.icon} {rol.label}
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
                                                                setTareas(prev => prev.map(x => x.id === t.id ? { ...x, estado: dest.id } : x));
                                                                await supabase.from('tareas').update({ estado: dest.id }).eq('id', t.id);
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
        </div>
    );
}
