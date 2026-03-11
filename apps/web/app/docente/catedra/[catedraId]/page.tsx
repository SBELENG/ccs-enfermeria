'use client';
import { useEffect, useState, use } from 'react';
import { supabase } from '@ccs/supabase';
import type { Database } from '@ccs/supabase';
import Link from 'next/link';
import { sanitizeFileName } from '../../../lib/utils';
import { ROLES, type RolKey } from '@ccs/ui';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import styles from './page.module.css';

type UsuarioDB = Database['public']['Tables']['usuarios']['Row'];
type CatedraDB = Database['public']['Tables']['catedras']['Row'];
type DesafioDB = Database['public']['Tables']['desafios']['Row'];
type InscripcionDB = Database['public']['Tables']['inscripciones']['Row'];

type EstudianteData = UsuarioDB & {
    sinEquipo: boolean;
    nombreEquipo?: string;
    equipoCerrado?: boolean;
    progresoRol: number;
    metricas?: {
        promedioQue: number;
        promedioComo: number;
        reviewsRecibidas: number;
        insignias: string[];
        participacionCompleta: boolean;
        totalColegasAEvaluar: number;
        evaluacionesEnviadas: number;
    };
};
type DesafioConEquipos = DesafioDB & { equiposCount: number };
type EquipoDetalle = Database['public']['Tables']['equipos']['Row'] & { miembros: any[], progreso?: number, totalTareas?: number, desafio?: { titulo: string } };

const INSIGNIAS_METRICS = [
    { rol: 'ejecutor', condicion: (q: number) => q >= 4.5, label: 'Ejecutor Estrella', emoji: '🛠️' },
    { rol: 'conciliador', condicion: (_: number, c: number) => c >= 4.5, label: 'Puente del Equipo', emoji: '🤝' },
    { rol: 'organizador', condicion: (q: number, c: number) => q >= 4 && c >= 4, label: 'Colaborador Integral', emoji: '⭐' },
    { rol: 'motivador', condicion: (_: number, c: number) => c >= 4, label: 'Motor del Grupo', emoji: '🔊' },
    { rol: 'analitico', condicion: (q: number) => q >= 4, label: 'Aporte Concreto', emoji: '📊' },
    { rol: 'creativo', condicion: (q: number, c: number) => (q + c) / 2 >= 3.5, label: 'En Crecimiento', emoji: '🌱' },
];

export default function CatedraPage({ params }: { params: Promise<{ catedraId: string }> }) {
    const { catedraId } = use(params);

    const [catedra, setCatedra] = useState<CatedraDB | null>(null);
    const [desafios, setDesafios] = useState<DesafioConEquipos[]>([]);
    const [estudiantes, setEstudiantes] = useState<EstudianteData[]>([]);
    const [equiposCatedra, setEquiposCatedra] = useState<EquipoDetalle[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroEstudiantes, setFiltroEstudiantes] = useState<'todos' | 'sin-equipo' | 'formados' | 'cerrados' | 'metricas'>('todos');

    // Desafío
    const [showForm, setShowForm] = useState(false);
    const [editingDesafioId, setEditingDesafioId] = useState<string | null>(null);
    const [titulo, setTitulo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [fechaEnt, setFechaEnt] = useState('');
    const [estadoDes, setEstadoDes] = useState<'borrador' | 'activo'>('borrador');
    const [userType, setUserType] = useState<string | null>(null);
    const [archivo, setArchivo] = useState<File | null>(null);
    const [checklist, setChecklist] = useState<string[]>([]);
    const [checklistInput, setChecklistInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [avisoTexto, setAvisoTexto] = useState('');
    const [showAvisoModal, setShowAvisoModal] = useState(false);

    useEffect(() => {
        async function cargar() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { window.location.href = '/ingresar'; return; }

            const { data: u } = await supabase.from('usuarios').select('tipo').eq('id', user.id).single();
            setUserType((u as any)?.tipo || null);

            const { data: cat } = await supabase.from('catedras').select('*').eq('id', catedraId).single();
            setCatedra(cat);

            const { data: desData } = await (supabase.from('desafios') as any)
                .select('*, equipos:equipos(*, equipo_miembros(usuario:usuarios(*)))')
                .eq('catedra_id', catedraId)
                .order('created_at', { ascending: false });

            const desEnriched = ((desData as any[]) ?? []).map(d => ({
                ...d,
                equiposCount: d.equipos?.length || 0
            }));
            setDesafios(desEnriched as any);

            const allTeams = ((desData as any[]) ?? []).flatMap(d =>
                (d.equipos || []).map((eq: any) => ({
                    ...eq,
                    desafio: { titulo: d.titulo },
                    miembros: eq.equipo_miembros || []
                }))
            );
            // Enriquecer equipos con progreso del Kanban
            const enrichedTeams = await Promise.all(allTeams.map(async (eq) => {
                const { data: ts } = await supabase.from('tareas').select('estado').eq('equipo_id', eq.id);
                const total = ts?.length || 0;
                const listos = (ts as any[])?.filter((t: any) => t.estado === 'done').length || 0;
                const pct = total > 0 ? Math.round((listos / total) * 100) : 0;

                return { ...eq, progreso: pct, totalTareas: total };
            }));
            setEquiposCatedra(enrichedTeams);

            // Cargar estudiantes y chequear equipos
            const { data: insData } = await (supabase.from('inscripciones') as any)
                .select('*, usuario:usuarios(*)')
                .eq('catedra_id', catedraId);

            if (insData) {
                // Cargar TODAS las evaluaciones 360 de los equipos de esta cátedra para métricas
                const equipoIds = enrichedTeams.map(eq => eq.id);
                let todasEvals: any[] = [];
                if (equipoIds.length > 0) {
                    const { data: evalsData } = await (supabase.from('evaluaciones_360') as any)
                        .select('*')
                        .in('equipo_id', equipoIds);
                    todasEvals = evalsData || [];
                }

                const ests = await Promise.all((insData as any[]).map(async (i: any) => {
                    const u = i.usuario;
                    // Chequeamos si está en algún equipo de esta cátedra para el desafío más reciente
                    const currentDesId = desEnriched[0]?.id;
                    let hasTeam = false;
                    let nombreEq = '';
                    let eqCerrado = false;
                    let equipoId = '';
                    let rolEnEquipo = '';

                    if (currentDesId) {
                        const { data: mData } = await (supabase.from('equipo_miembros') as any)
                            .select('*, equipo:equipos!inner(*)')
                            .eq('usuario_id', u.id)
                            .eq('equipo.desafio_id', currentDesId)
                            .maybeSingle();

                        if (mData) {
                            hasTeam = true;
                            nombreEq = (mData as any).equipo?.nombre_equipo || 'En equipo';
                            eqCerrado = (mData as any).equipo?.cerrado || false;
                            equipoId = mData.equipo_id;
                            rolEnEquipo = mData.rol_en_equipo;
                        }
                    }

                    // 1. Calcular progreso de rol (Inducción)
                    const checklist = (u as any).checklist_progreso || [];
                    const chTotal = checklist.length;
                    const chListos = (checklist as any[]).filter(p => p.estado === 'completado').length;
                    const pctInduccion = chTotal > 0 ? (chListos / chTotal) : 0;

                    // 2. Calcular progreso en Tareas del Kanban (Asignadas a él o de su ROL en el equipo)
                    let tTotal = 0;
                    let tListos = 0;

                    if (hasTeam && equipoId) {
                        const { data: tData } = await supabase
                            .from('tareas')
                            .select('estado, usuario_id, rol_asociado')
                            .eq('equipo_id', equipoId);

                        if (tData) {
                            const misTareas = (tData as any[]).filter(t =>
                                t.usuario_id === u.id ||
                                (!t.usuario_id && t.rol_asociado === rolEnEquipo)
                            );
                            tTotal = misTareas.length;
                            tListos = misTareas.filter(t => t.estado === 'done').length;
                        }
                    }

                    const pctKanban = tTotal > 0 ? (tListos / tTotal) : 0;

                    // 3. Promedio final (Si no tiene tareas de ningún tipo, es 0)
                    let pctFinal = 0;
                    if (chTotal > 0 && tTotal > 0) {
                        pctFinal = Math.round(((pctInduccion + pctKanban) / 2) * 100);
                    } else if (chTotal > 0) {
                        pctFinal = Math.round(pctInduccion * 100);
                    } else if (tTotal > 0) {
                        pctFinal = Math.round(pctKanban * 100);
                    }

                    // 4. Métricas 360 (Basado en evaluaciones recibidas de pares)
                    const evalsRecibidas = todasEvals.filter(ev => ev.evaluado_id === u.id && !ev.es_autoevaluacion);
                    const n = evalsRecibidas.length;
                    const avgQue = n > 0 ? evalsRecibidas.reduce((s, ev) => s + ev.puntaje_que, 0) / n : 0;
                    const avgComo = n > 0 ? evalsRecibidas.reduce((s, ev) => s + ev.puntaje_como, 0) / n : 0;

                    // 5. Participación (Basado en evaluaciones enviadas por el usuario a su equipo actual)
                    let participacionCompleta = false;
                    let numColegas = 0;
                    let numEnviadas = 0;

                    if (hasTeam && equipoId) {
                        const equipo = enrichedTeams.find(eq => eq.id === equipoId);
                        if (equipo) {
                            numColegas = (equipo.miembros?.length || 1) - 1; // Colegas sin contarse a sí mismo
                            const misEvalsEnviadas = todasEvals.filter(ev =>
                                ev.evaluador_id === u.id &&
                                ev.equipo_id === equipoId &&
                                !ev.es_autoevaluacion
                            );
                            numEnviadas = misEvalsEnviadas.length;
                            participacionCompleta = numColegas > 0 && numEnviadas >= numColegas;
                        }
                    }

                    const insigniasArr = INSIGNIAS_METRICS
                        .filter(ins => ins.condicion(avgQue, avgComo))
                        .map(ins => `${ins.emoji} ${ins.label}`);

                    return {
                        ...u,
                        sinEquipo: !hasTeam,
                        nombreEquipo: nombreEq,
                        equipoCerrado: eqCerrado,
                        progresoRol: pctFinal,
                        metricas: {
                            promedioQue: Math.round(avgQue * 10) / 10,
                            promedioComo: Math.round(avgComo * 10) / 10,
                            reviewsRecibidas: n,
                            insignias: insigniasArr,
                            participacionCompleta,
                            totalColegasAEvaluar: numColegas,
                            evaluacionesEnviadas: numEnviadas
                        }
                    };
                }));

                setEstudiantes(ests);
            }

            // Equipos ya cargados vía join en el bloque anterior para mayor consistencia

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
            const sanitizedName = sanitizeFileName(archivo.name);
            const fileName = `${catedraId}/${Date.now()}-${sanitizedName}`;
            const { data: { user } } = await supabase.auth.getUser();
            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from('desafios-docs')
                .upload(fileName, archivo);
            if (uploadErr) {
                console.error("Error al subir archivo:", uploadErr);
                alert(`Error al subir el archivo: ${uploadErr.message}`);
                setSaving(false);
                return;
            }
            if (uploadData) {
                const { data: { publicUrl } } = supabase.storage
                    .from('desafios-docs')
                    .getPublicUrl(fileName);
                urlDoc = publicUrl;
            }
        }

        const payload: any = {
            catedra_id: catedraId,
            titulo: titulo.trim(),
            descripcion: descripcion.trim(),
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

            if (error) {
                console.error("Error al actualizar desafío:", error);
                alert(`Error al guardar cambios: ${error.message}`);
                setSaving(false);
                return;
            }

            if (data) {
                setDesafios(prev => prev.map(d => d.id === data.id ? { ...d, ...data } : d));
            }
        } else {
            const { data, error } = await (supabase.from('desafios') as any).insert(payload).select().single();

            if (error) {
                console.error("Error al crear desafío:", error);
                alert(`Error al crear desafío: ${error.message}`);
                setSaving(false);
                return;
            }

            if (data) setDesafios(prev => [{ ...data, equiposCount: 0 }, ...prev]);
        }

        alert('✅ ¡Desafío guardado correctamente!');
        setTitulo('');
        setDescripcion('');
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
        setDescripcion((d as any).descripcion || '');
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

    async function enviarAvisoGeneral() {
        if (!avisoTexto.trim()) return;
        setSaving(true);
        const { error } = await supabase.from('avisos_catedra').insert({
            catedra_id: catedraId,
            mensaje: avisoTexto.trim()
        } as any);

        if (error) {
            alert('Error al enviar aviso: ' + error.message);
        } else {
            alert('¡Aviso enviado con éxito a todos los alumnos!');
            setAvisoTexto('');
            setShowAvisoModal(false);
        }
        setSaving(false);
    }

    function exportarPDF() {
        if (estudiantes.length === 0) return;

        const doc = new jsPDF('landscape');

        doc.setFontSize(18);
        doc.text(`Métricas Académicas - ${catedra?.nombre_materia || 'Cátedra'}`, 14, 22);

        doc.setFontSize(11);
        doc.text(`Docente: Evaluaciones 360° | Ciclo: ${catedra?.ciclo_lectivo || ''}`, 14, 30);

        const tableColumn = ["Estudiante", "Participación", "Reviews Recibidas", "Promedio Qué", "Promedio Cómo", "Insignias"];
        const tableRows = estudiantes.map(e => [
            e.nombre,
            e.metricas?.participacionCompleta ? "Completa (Ok)" : `Incompleta (${e.metricas?.evaluacionesEnviadas}/${e.metricas?.totalColegasAEvaluar})`,
            e.metricas?.reviewsRecibidas?.toString() || "0",
            e.metricas?.promedioQue?.toString() || "0",
            e.metricas?.promedioComo?.toString() || "0",
            (e.metricas?.insignias || []).map(i => i.substring(i.indexOf(' ') + 1)).join(" | ")
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            styles: { fontSize: 10, cellPadding: 4 },
            headStyles: { fillColor: [26, 43, 94] },
            alternateRowStyles: { fillColor: [248, 250, 255] }
        });

        doc.save(`metricas_catedra_${catedraId}.pdf`);
    }

    if (loading) return (
        <div className={styles.loadingWrap}><div className={styles.spinner} /><p>Cargando cátedra...</p></div>
    );

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerInner}>
                    <Link href={userType === 'docente' ? '/docente/dashboard' : '/dashboard'} className={styles.back}>← Panel</Link>
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
                    <button
                        className={styles.btnAddAviso}
                        onClick={() => setShowAvisoModal(true)}
                    >
                        📢 Enviar Comunicado
                    </button>
                </div>

                {/* BALANCE DE ROLES (Vista Detallada por Cátedra) */}
                <div className={styles.balanceSection}>
                    <div className={styles.balanceHeader}>
                        <h2>🎯 Balance de Roles en esta Cátedra</h2>
                        <span className={styles.sub}>Identificá carencias para incentivar roles secundarios</span>
                    </div>
                    <div className={styles.balanceGrid}>
                        {(Object.entries(ROLES) as [RolKey, any][]).map(([key, rol]) => {
                            const count = estudiantes.filter(e => e.rol_primario === key).length;
                            const counts = (Object.keys(ROLES)).map(rk => estudiantes.filter(e => e.rol_primario === rk).length);
                            const max = Math.max(...counts, 1);
                            const pct = Math.round((count / max) * 100);

                            return (
                                <div key={key} className={styles.rolStats}>
                                    <span className={styles.rolIcon} title={rol.label}>{rol.icon}</span>
                                    <div className={styles.rolBarTrack}>
                                        <div
                                            className={styles.rolBarFill}
                                            style={{ height: `${pct}%`, background: rol.color }}
                                        />
                                    </div>
                                    <span className={styles.rolCount}>{count}</span>
                                    <span className={styles.rolName}>{rol.label.split(' ')[0]}</span>
                                </div>
                            );
                        })}
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
                            <textarea
                                className={styles.inputInline}
                                placeholder="Descripción detallada del desafío o consigna..."
                                value={descripcion}
                                onChange={e => setDescripcion(e.target.value)}
                                rows={4}
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
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="file"
                                            className={styles.inputInline}
                                            onChange={e => setArchivo(e.target.files?.[0] || null)}
                                            accept=".pdf,image/*,.doc,.docx"
                                        />
                                        {editingDesafioId && desafios.find(d => d.id === editingDesafioId)?.documento_url && (
                                            <a href={desafios.find(d => d.id === editingDesafioId)!.documento_url!} target="_blank" rel="noreferrer" className={styles.btnMiniDoc} title="Ver documento actual">📄 Ver actual</a>
                                        )}
                                    </div>
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
                                                <div className={styles.desafioTitulo}>
                                                    {d.titulo}
                                                    {d.documento_url && <span className={styles.docIndicator} title="Contiene documento adjunto">📎</span>}
                                                </div>
                                                <span className={`${styles.estadoBadge} ${estadoColor}`}>{d.estado}</span>
                                            </div>
                                            <div className={styles.desafioMeta}>
                                                <span>📋 {d.equiposCount} equipos</span>
                                                <span className={dias < 0 ? styles.vencido : (dias >= 0 && dias <= 3) ? styles.urgente : styles.ok}>
                                                    ⏰ {dias > 0 ? `${dias}d restantes` : dias === 0 ? '¡Hoy!' : 'Vencido'}
                                                </span>
                                            </div>

                                            <div className={styles.fechaEntrega}>
                                                📅 {new Date(d.fecha_entrega).toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                            </div>

                                            {/* Equipos que ya finalizaron (Badge sutil) */}
                                            {((d as any).equipos?.filter((eq: any) => eq.estado_entrega).length > 0) && (
                                                <div className={styles.finishedTeamsRow}>
                                                    <div className={styles.finishedLabel}>
                                                        ✅ Equipos que cumplieron:
                                                    </div>
                                                    <div className={styles.finishedList}>
                                                        {(d as any).equipos
                                                            .filter((eq: any) => eq.estado_entrega)
                                                            .map((eq: any) => (
                                                                <span key={eq.id} className={styles.finishedChip}>
                                                                    {eq.nombre_equipo}
                                                                </span>
                                                            ))}
                                                    </div>
                                                </div>
                                            )}
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
                        <div>
                            <h2>{filtroEstudiantes === 'todos' || filtroEstudiantes === 'sin-equipo' ? 'Listado de Estudiantes' : 'Listado de Equipos'}</h2>
                            <span className={styles.sub}>
                                {filtroEstudiantes === 'todos' || filtroEstudiantes === 'sin-equipo'
                                    ? `${estudiantes.length} alumnos inscriptos`
                                    : `${equiposCatedra.length} equipos en la cátedra`}
                            </span>
                        </div>
                        <div className={styles.filtrosEstudiantes}>
                            <button
                                className={`${styles.filterBtn} ${filtroEstudiantes === 'todos' ? styles.filterActive : ''}`}
                                onClick={() => setFiltroEstudiantes('todos')}
                            >
                                Todos
                            </button>
                            <button
                                className={`${styles.filterBtn} ${filtroEstudiantes === 'sin-equipo' ? styles.filterActive : ''}`}
                                onClick={() => setFiltroEstudiantes('sin-equipo')}
                            >
                                Sin equipo
                            </button>
                            <button
                                className={`${styles.filterBtn} ${filtroEstudiantes === 'formados' ? styles.filterActive : ''}`}
                                onClick={() => setFiltroEstudiantes('formados')}
                            >
                                Formados
                            </button>
                            <button
                                className={`${styles.filterBtn} ${filtroEstudiantes === 'cerrados' ? styles.filterActive : ''}`}
                                onClick={() => setFiltroEstudiantes('cerrados')}
                            >
                                Cerrados
                            </button>
                            <button
                                className={`${styles.filterBtn} ${filtroEstudiantes === 'metricas' ? styles.filterActive : ''}`}
                                onClick={() => setFiltroEstudiantes('metricas')}
                            >
                                📊 Métricas
                            </button>
                        </div>
                    </div>

                    <div className={styles.estudiantesList}>
                        {/* Vista de Estudiantes (Todos / Sin equipo) */}
                        {(filtroEstudiantes === 'todos' || filtroEstudiantes === 'sin-equipo') && (
                            estudiantes.length === 0 ? (
                                <p className={styles.emptyText}>No hay estudiantes inscriptos con el código {catedra?.codigo_acceso}.</p>
                            ) : (
                                <div className={styles.estTable}>
                                    <div className={styles.estTableRowHeader}>
                                        <span>Nombre / Test</span>
                                        <span>Rol / Progreso Individual</span>
                                        <span>Estado Equipo</span>
                                    </div>
                                    {estudiantes
                                        .filter(est => {
                                            if (filtroEstudiantes === 'sin-equipo') return est.sinEquipo;
                                            return true;
                                        })
                                        .map(est => {
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
                                                            <div className={styles.progWrap}>
                                                                <span className={styles.rolBadge} style={{ background: rol.color + '20', color: rol.color }}>
                                                                    {rol.icon} {rol.label}
                                                                </span>
                                                                <div className={styles.miniProg}>
                                                                    <div className={styles.miniProgFill} style={{ width: `${est.progresoRol}%`, background: rol.color }} />
                                                                    <span className={styles.miniProgText}>{est.progresoRol}%</span>
                                                                </div>
                                                            </div>
                                                        ) : '-'}
                                                    </div>
                                                    <div className={styles.estTeam}>
                                                        {est.sinEquipo ? (
                                                            <span className={styles.sinEquipoBadge}>⚠ Sin equipo</span>
                                                        ) : (
                                                            <span className={styles.conEquipoBadge}>
                                                                {est.nombreEquipo || '✅ En equipo'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )
                        )}

                        {/* Vista de Métricas (Consolidado 360) */}
                        {filtroEstudiantes === 'metricas' && (
                            <div className={styles.metricasSection}>
                                <div className={styles.metricasHeader}>
                                    <p className={styles.metricasSub}>Indicadores de desempeño basados en evaluaciones 360° (Promedios de Pares)</p>
                                    <button onClick={exportarPDF} className={styles.btnExport}>📥 Descargar PDF</button>
                                </div>
                                <div className={styles.estTable}>
                                    <div className={styles.estTableRowHeader} style={{ gridTemplateColumns: '1.5fr 0.8fr 0.6fr 0.6fr 0.6fr 2fr' }}>
                                        <span>Estudiante</span>
                                        <span>Participación</span>
                                        <span>Reviews</span>
                                        <span>🎯 Qué</span>
                                        <span>🤝 Cómo</span>
                                        <span>Insignias Ganadas</span>
                                    </div>
                                    {estudiantes.map(est => (
                                        <div key={est.id} className={styles.estTableRow} style={{ gridTemplateColumns: '1.5fr 0.8fr 0.6fr 0.6fr 0.6fr 2fr', alignItems: 'center' }}>
                                            <div className={styles.estName}>
                                                <div className={styles.estAvatar}>{est.nombre.charAt(0)}</div>
                                                {est.nombre}
                                            </div>
                                            <div className={styles.metPart}>
                                                {est.metricas?.participacionCompleta ? (
                                                    <span className={styles.partOk} title="Evaluó a todos sus compañeros">✅ Completa</span>
                                                ) : (
                                                    <span className={styles.partWait} title={`${est.metricas?.evaluacionesEnviadas} de ${est.metricas?.totalColegasAEvaluar} evaluados`}>
                                                        ⚠️ {est.metricas?.evaluacionesEnviadas}/{est.metricas?.totalColegasAEvaluar}
                                                    </span>
                                                )}
                                            </div>
                                            <div className={styles.metReviewCount}>{est.metricas?.reviewsRecibidas || 0}</div>
                                            <div className={styles.metVal} style={{ color: (est.metricas?.promedioQue || 0) >= 4 ? '#2dc9a8' : '#1a2b5e' }}>
                                                {est.metricas?.promedioQue?.toFixed(1) || '0.0'}
                                            </div>
                                            <div className={styles.metVal} style={{ color: (est.metricas?.promedioComo || 0) >= 4 ? '#2dc9a8' : '#1a2b5e' }}>
                                                {est.metricas?.promedioComo?.toFixed(1) || '0.0'}
                                            </div>
                                            <div className={styles.metInsignias}>
                                                {est.metricas?.insignias.map((ins, idx) => (
                                                    <span key={idx} className={styles.metInsigniaChip} title={ins}>
                                                        {ins.split(' ')[0]}
                                                    </span>
                                                ))}
                                                {est.metricas?.insignias.length === 0 && <span className={styles.metEmpty}>Sin insignias</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Vista de Equipos (Formados / Cerrados) */}
                        {(filtroEstudiantes === 'formados' || filtroEstudiantes === 'cerrados') && (
                            equiposCatedra.length === 0 ? (
                                <p className={styles.emptyText}>No hay equipos registrados en esta cátedra aún.</p>
                            ) : (
                                <div className={styles.estTable}>
                                    <div className={styles.estTableRowHeader} style={{ gridTemplateColumns: '1.5fr 1.2fr 1fr' }}>
                                        <span>Nombre Equipo / Desafío</span>
                                        <span>Miembros</span>
                                        <span>Avance del Proyecto</span>
                                    </div>
                                    {equiposCatedra
                                        .filter(eq => {
                                            if (filtroEstudiantes === 'cerrados') return (eq as any).cerrado;
                                            return true;
                                        })
                                        .map(eq => (
                                            <div key={eq.id} className={styles.estTableRow} style={{ gridTemplateColumns: '1.5fr 1.2fr 1fr', alignItems: 'center' }}>
                                                <div className={styles.eqDocName}>
                                                    <div className={styles.estName}>
                                                        <strong>{eq.nombre_equipo}</strong>
                                                        <span className={`${styles.lockIcon} ${(eq as any).cerrado ? styles.isLocked : ''}`}>
                                                            {(eq as any).cerrado ? '🔒' : '🔓'}
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{(eq as any).desafio?.titulo}</span>
                                                </div>
                                                <div className={styles.miembrosMini}>
                                                    {eq.miembros?.map((m: any) => (
                                                        <div key={m.usuario.id} className={styles.miniAv} title={`${m.usuario.nombre} (${m.usuario.rol_primario})`}>
                                                            {m.usuario.nombre.charAt(0)}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className={styles.progresoEquipo}>
                                                    <div className={styles.progBarTrack}>
                                                        <div
                                                            className={styles.progBarFill}
                                                            style={{ width: `${eq.progreso || 0}%`, background: (eq.progreso || 0) > 80 ? '#2dc9a8' : (eq.progreso || 0) > 40 ? '#3a6bc8' : '#64748b' }}
                                                        />
                                                    </div>
                                                    <div className={styles.progLabel}>
                                                        {eq.progreso || 0}% <span className={styles.progTasks}>({eq.totalTareas || 0} tareas)</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )
                        )}
                    </div>
                </div>
            </main>

            {/* MODAL PARA AVISO GENERAL */}
            {showAvisoModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalContent}>
                        <div className={styles.modalHeader}>
                            <h3>📢 Comunicado General</h3>
                            <button onClick={() => setShowAvisoModal(false)} className={styles.btnCloseModal}>×</button>
                        </div>
                        <p className={styles.modalSub}>Este mensaje llegará como notificación a todos los alumnos inscriptos.</p>
                        <textarea
                            className={styles.avisoTextArea}
                            placeholder="Ej: Se prorrogó la fecha de entrega del TP1 para el próximo viernes..."
                            value={avisoTexto}
                            onChange={e => setAvisoTexto(e.target.value)}
                            rows={5}
                            autoFocus
                        />
                        <div className={styles.modalActions}>
                            <button
                                className={styles.btnSendAviso}
                                onClick={enviarAvisoGeneral}
                                disabled={saving || !avisoTexto.trim()}
                            >
                                {saving ? 'Enviando...' : 'Enviar a todos'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

