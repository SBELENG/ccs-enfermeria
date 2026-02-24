'use client';
import { useEffect, useState, use } from 'react';
import { supabase } from '@ccs/supabase';
import type { Database } from '@ccs/supabase';
import Link from 'next/link';
import { ROLES, type RolKey } from '@ccs/ui';
import styles from './page.module.css';

type UsuarioDB = Database['public']['Tables']['usuarios']['Row'];
type CatedraDB = Database['public']['Tables']['catedras']['Row'];
type DesafioDB = Database['public']['Tables']['desafios']['Row'];
type InscripcionDB = Database['public']['Tables']['inscripciones']['Row'];

type EstudianteData = UsuarioDB & {
    sinEquipo: boolean;
};

type DesafioConEquipos = DesafioDB & { equiposCount: number };

export default function CatedraPage({ params }: { params: Promise<{ catedraId: string }> }) {
    const { catedraId } = use(params);

    const [catedra, setCatedra] = useState<CatedraDB | null>(null);
    const [desafios, setDesafios] = useState<DesafioConEquipos[]>([]);
    const [estudiantes, setEstudiantes] = useState<EstudianteData[]>([]);
    const [loading, setLoading] = useState(true);

    // Desafío
    const [showForm, setShowForm] = useState(false);
    const [editingDesafioId, setEditingDesafioId] = useState<string | null>(null);
    const [titulo, setTitulo] = useState('');
    const [fechaEnt, setFechaEnt] = useState('');
    const [estadoDes, setEstadoDes] = useState<'borrador' | 'activo'>('borrador');
    const [archivo, setArchivo] = useState<File | null>(null);
    const [checklist, setChecklist] = useState<string[]>([]);
    const [checklistInput, setChecklistInput] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }

            const { data: cat } = await supabase.from('catedras').select('*').eq('id', catedraId).single();
            setCatedra(cat);

            const { data: des } = await (supabase.from('desafios') as any).select('*').eq('catedra_id', catedraId).order('created_at', { ascending: false });

            const desEnriched = await Promise.all(((des as any[]) ?? []).map(async d => {
                const { count } = await supabase.from('equipos').select('*', { count: 'exact', head: true }).eq('desafio_id', d.id);
                return { ...(d as any), equiposCount: count ?? 0 };
            }));

            setDesafios(desEnriched as any);

            // Cargar estudiantes y chequear equipos
            const { data: insData } = await (supabase.from('inscripciones') as any)
                .select('*, usuario:usuarios(*)')
                .eq('catedra_id', catedraId);

            if (insData) {
                const ests = await Promise.all((insData as any[]).map(async (i: any) => {
                    const u = i.usuario;
                    // Chequeamos si está en algún equipo de esta cátedra para el desafío más reciente
                    const currentDesId = desEnriched[0]?.id;
                    let hasTeam = false;
                    if (currentDesId) {
                        const { count } = await (supabase.from('equipo_miembros') as any)
                            .select('*, equipo:equipos!inner(*)')
                            .eq('usuario_id', u.id)
                            .eq('equipo.desafio_id', currentDesId);
                        hasTeam = (count || 0) > 0;
                    }

                    return { ...u, sinEquipo: !hasTeam };
                }));
                setEstudiantes(ests);
            }

            setLoading(false);
        }
        cargar();
    }, [catedraId]);

    async function guardarDesafio(e: React.FormEvent) {
        e.preventDefault();
        if (!titulo.trim() || !fechaEnt) return;
        setSaving(true);

        let urlDoc = '';
        if (archivo) {
            const fileName = `${catedraId}/${Date.now()}-${archivo.name}`;
            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from('desafios-docs')
                .upload(fileName, archivo);
            if (!uploadErr && uploadData) {
                const { data: { publicUrl } } = supabase.storage
                    .from('desafios-docs')
                    .getPublicUrl(fileName);
                urlDoc = publicUrl;
            }
        }

        const payload: any = {
            catedra_id: catedraId,
            titulo: titulo.trim(),
            fecha_entrega: fechaEnt,
            estado: estadoDes,
            checklist_sugerido: checklist.length > 0 ? checklist.map(t => ({ descripcion: t })) : null,
        };
        if (urlDoc) payload.documento_url = urlDoc;

        if (editingDesafioId) {
            const { data, error } = await (supabase.from('desafios') as any)
                .update(payload)
                .eq('id', editingDesafioId)
                .select()
                .single();
            if (data) {
                setDesafios(prev => prev.map(d => d.id === data.id ? { ...d, ...data } : d));
            }
        } else {
            const { data } = await (supabase.from('desafios') as any).insert(payload).select().single();
            if (data) setDesafios(prev => [{ ...data, equiposCount: 0 }, ...prev]);
        }

        setTitulo('');
        setFechaEnt('');
        setEstadoDes('borrador');
        setArchivo(null);
        setChecklist([]);
        setChecklistInput('');
        setEditingDesafioId(null);
        setShowForm(false);
        setSaving(false);
    }

    function prepararEdicion(d: DesafioDB) {
        setEditingDesafioId(d.id);
        setTitulo(d.titulo);
        // Formato para datetime-local: YYYY-MM-DDTHH:MM
        const date = new Date(d.fecha_entrega);
        const isoStr = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setFechaEnt(isoStr);
        setEstadoDes(d.estado as any);
        setChecklist((d.checklist_sugerido as any[])?.map((i: any) => i.descripcion) ?? []);
        setShowForm(true);
    }

    async function toggleActiva() {
        if (!catedra) return;
        const nuevo = !catedra.activa;
        setCatedra(prev => prev ? { ...prev, activa: nuevo } : null);
        await (supabase.from('catedras') as any).update({ activa: nuevo }).eq('id', catedraId);
    }

    if (loading) return (
        <div className={styles.loadingWrap}><div className={styles.spinner} /><p>Cargando cátedra...</p></div>
    );

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <Link href="/docente/dashboard" className={styles.back}>← Panel</Link>
                    <div className={styles.headerCenter}>
                        <h1>{catedra?.nombre_materia}</h1>
                        <span className={styles.headerSub}>📅 {catedra?.ciclo_lectivo}</span>
                    </div>
                    <div className={styles.headerRight}>
                        <code className={styles.codigoBadge}>🔑 {catedra?.codigo_acceso}</code>
                        <button
                            className={`${styles.toggleBtn} ${catedra?.activa ? styles.activa : styles.inactiva}`}
                            onClick={toggleActiva}
                        >
                            {catedra?.activa ? '✅ Activa' : '⏸ Inactiva'}
                        </button>
                    </div>
                </div>
            </header>

            <main className={styles.main}>

                {/* STATS RÁPIDAS */}
                <div className={styles.quickStats}>
                    <div className={styles.qStat}>
                        <span className={styles.qNum}>{estudiantes.length}</span>
                        <span className={styles.qLbl}>Estudiantes</span>
                    </div>
                    <div className={styles.qStat}>
                        <span className={styles.qNum}>{desafios.length}</span>
                        <span className={styles.qLbl}>Desafíos</span>
                    </div>
                    <div className={styles.qStat}>
                        <span className={styles.qNum}>{estudiantes.filter(e => e.sinEquipo).length}</span>
                        <span className={styles.qLbl}>Sin equipo</span>
                    </div>
                </div>

                {/* DESAFÍOS */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>Desafíos</h2>
                        <button className={styles.btnAgregar} onClick={() => {
                            if (showForm) {
                                setEditingDesafioId(null);
                                setTitulo('');
                                setFechaEnt('');
                            }
                            setShowForm(s => !s);
                        }} id="btn-nuevo-desafio">
                            {showForm ? 'Cancelar' : '+ Nuevo desafío'}
                        </button>
                    </div>

                    {showForm && (
                        <form onSubmit={guardarDesafio} className={styles.formInline}>
                            <h3>{editingDesafioId ? 'Editar Desafío' : 'Nuevo Desafío'}</h3>
                            <input
                                className={styles.inputInline}
                                placeholder="Título del desafío (ej: Trabajo Práctico 1)"
                                value={titulo}
                                onChange={e => setTitulo(e.target.value)}
                                required
                                autoFocus
                            />
                            <div className={styles.formGrid}>
                                <div className={styles.formGroup}>
                                    <label>Fecha y Hora de entrega</label>
                                    <input
                                        type="datetime-local"
                                        className={styles.inputInline}
                                        value={fechaEnt}
                                        onChange={e => setFechaEnt(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Estado Inicial</label>
                                    <select
                                        className={styles.inputInline}
                                        value={estadoDes}
                                        onChange={e => setEstadoDes(e.target.value as any)}
                                    >
                                        <option value="borrador">📝 Borrador (Solo docente)</option>
                                        <option value="activo">🚀 Activo (Visible a alumnos)</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Documentación (PDF/Img)</label>
                                    <input
                                        type="file"
                                        className={styles.inputInline}
                                        onChange={e => setArchivo(e.target.files?.[0] || null)}
                                        accept=".pdf,image/*,.doc,.docx"
                                    />
                                </div>
                                <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                                    <label>Checklist Sugerido (Orientación para equipos)</label>
                                    <div className={styles.checklistCreator}>
                                        <div className={styles.checklistInputArea}>
                                            <input
                                                className={styles.inputInline}
                                                placeholder="Ej: Investigar fuentes primarias"
                                                value={checklistInput}
                                                onChange={e => setChecklistInput(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (checklistInput.trim()) {
                                                            setChecklist([...checklist, checklistInput.trim()]);
                                                            setChecklistInput('');
                                                        }
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className={styles.btnAddCheck}
                                                onClick={() => {
                                                    if (checklistInput.trim()) {
                                                        setChecklist([...checklist, checklistInput.trim()]);
                                                        setChecklistInput('');
                                                    }
                                                }}
                                            >
                                                Añadir
                                            </button>
                                        </div>
                                        <div className={styles.checklistPills}>
                                            {checklist.map((item, idx) => (
                                                <div key={idx} className={styles.checklistPill}>
                                                    <span>{item}</span>
                                                    <button
                                                        type="button"
                                                        className={styles.btnRemovePill}
                                                        onClick={() => setChecklist(checklist.filter((_, i) => i !== idx))}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.formActions}>
                                    <button type="submit" className={styles.btnCrearDes} disabled={saving}>
                                        {saving ? 'Guardando...' : editingDesafioId ? 'Guardar Cambios' : 'Crear Desafío'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}

                    {desafios.length === 0 && !showForm ? (
                        <div className={styles.emptyRow}>
                            <p>No hay desafíos todavía. ¡Creá el primero!</p>
                        </div>
                    ) : (
                        <div className={styles.desafiosGrid}>
                            {desafios.map(d => {
                                const dias = Math.ceil((new Date(d.fecha_entrega).getTime() - Date.now()) / 86_400_000);
                                const estadoColor = d.estado === 'activo' ? styles.activo : d.estado === 'cerrado' ? styles.cerrado : styles.borrador;
                                return (
                                    <div key={d.id} className={styles.desafioHorizontal}>
                                        <Link href={`/docente/desafio/${d.id}`} className={styles.desafioContent}>
                                            <div className={styles.desafioTop}>
                                                <div className={styles.desafioTitulo}>{d.titulo}</div>
                                                <span className={`${styles.estadoBadge} ${estadoColor}`}>{d.estado}</span>
                                            </div>
                                            <div className={styles.desafioMeta}>
                                                <span>📋 {d.equiposCount} equipos</span>
                                                <span className={dias < 0 ? styles.vencido : (dias >= 0 && dias <= 3) ? styles.urgente : styles.ok}>
                                                    ⏰ {dias > 0 ? `${dias}d restantes` : dias === 0 ? '¡Hoy!' : 'Vencivo'}
                                                </span>
                                                {d.documento_url && <span className={styles.docCheck}>📄 Con adjunto</span>}
                                            </div>
                                            <div className={styles.fechaEntrega}>
                                                📅 {new Date(d.fecha_entrega).toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </Link>
                                        <div className={styles.desafioActions}>
                                            <button className={styles.btnEdit} onClick={() => prepararEdicion(d)}>✏️</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ESTUDIANTES */}
                <div className={styles.section} style={{ marginTop: '24px' }}>
                    <div className={styles.sectionHeader}>
                        <h2>Listado de Estudiantes</h2>
                        <span className={styles.sub}>{estudiantes.length} alumnos inscriptos</span>
                    </div>

                    <div className={styles.estudiantesList}>
                        {estudiantes.length === 0 ? (
                            <p className={styles.emptyText}>No hay estudiantes inscriptos con el código {catedra?.codigo_acceso}.</p>
                        ) : (
                            <div className={styles.estTable}>
                                <div className={styles.estTableRowHeader}>
                                    <span>Nombre</span>
                                    <span>Rol Principal</span>
                                    <span>Estado Equipo</span>
                                </div>
                                {estudiantes.map(est => {
                                    const rol = est.rol_primario ? ROLES[est.rol_primario as RolKey] : null;
                                    return (
                                        <div key={est.id} className={styles.estTableRow}>
                                            <div className={styles.estName}>
                                                <div className={styles.estAvatar}>
                                                    {est.nombre.charAt(0)}
                                                </div>
                                                {est.nombre}
                                            </div>
                                            <div className={styles.estRol}>
                                                {rol ? (
                                                    <span className={styles.rolBadge} style={{ background: rol.color + '20', color: rol.color }}>
                                                        {rol.icon} {rol.label}
                                                    </span>
                                                ) : '-'}
                                            </div>
                                            <div className={styles.estTeam}>
                                                {est.sinEquipo ? (
                                                    <span className={styles.sinEquipoBadge}>⚠ Sin equipo</span>
                                                ) : (
                                                    <span className={styles.conEquipoBadge}>✅ En equipo</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

