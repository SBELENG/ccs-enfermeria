// ============================================================
// CCS · Tipos TypeScript del modelo de datos de Supabase
// ============================================================

export type TipoUsuario = 'docente' | 'estudiante';
export type RolNombre = 'organizador' | 'analitico' | 'ejecutor' | 'creativo' | 'conciliador' | 'motivador';
export type EstadoKanban = 'backlog' | 'doing' | 'review' | 'done';
export type EstadoDesafio = 'borrador' | 'activo' | 'cerrado';

export interface Database {
    public: {
        Tables: {
            usuarios: {
                Row: {
                    id: string;
                    nombre: string;
                    foto_url: string | null;
                    email: string;
                    tipo: TipoUsuario;
                    resultados_test: Record<RolNombre, number> | null;
                    rol_primario: RolNombre | null;
                    rol_secundario: RolNombre | null;
                    buscando_equipo: boolean | null;
                    preferencia_rol_busqueda: 'primario' | 'secundario';
                    created_at: string;
                };
                Insert: {
                    id: string;
                    nombre: string;
                    foto_url?: string | null;
                    email: string;
                    tipo?: TipoUsuario;
                    resultados_test?: Record<RolNombre, number> | null;
                    rol_primario?: RolNombre | null;
                    rol_secundario?: RolNombre | null;
                    buscando_equipo?: boolean | null;
                    preferencia_rol_busqueda?: 'primario' | 'secundario';
                };
                Update: {
                    nombre?: string;
                    foto_url?: string | null;
                    tipo?: TipoUsuario;
                    resultados_test?: Record<RolNombre, number> | null;
                    rol_primario?: RolNombre | null;
                    rol_secundario?: RolNombre | null;
                    buscando_equipo?: boolean | null;
                    preferencia_rol_busqueda?: 'primario' | 'secundario';
                };
            };
            catedras: {
                Row: {
                    id: string;
                    nombre_materia: string;
                    docente_id: string;
                    codigo_acceso: string;
                    activa: boolean;
                    ciclo_lectivo: string;
                    created_at: string;
                };
                Insert: {
                    nombre_materia: string;
                    docente_id: string;
                    codigo_acceso: string;
                    activa?: boolean;
                    ciclo_lectivo: string;
                };
                Update: {
                    nombre_materia?: string;
                    activa?: boolean;
                    ciclo_lectivo?: string;
                };
            };
            inscripciones: {
                Row: {
                    id: string;
                    usuario_id: string;
                    catedra_id: string;
                    rol_activo: RolNombre | null;
                    created_at: string;
                };
                Insert: {
                    usuario_id: string;
                    catedra_id: string;
                    rol_activo?: RolNombre | null;
                };
                Update: {
                    rol_activo?: RolNombre | null;
                };
            };
            desafios: {
                Row: {
                    id: string;
                    catedra_id: string;
                    titulo: string;
                    documento_url: string | null;
                    fecha_entrega: string;
                    checklist_sugerido: { descripcion: string }[] | null;
                    estado: EstadoDesafio;
                    created_at: string;
                };
                Insert: {
                    catedra_id: string;
                    titulo: string;
                    documento_url?: string | null;
                    fecha_entrega: string;
                    checklist_sugerido?: { descripcion: string }[] | null;
                    estado?: EstadoDesafio;
                };
                Update: {
                    titulo?: string;
                    documento_url?: string | null;
                    fecha_entrega?: string;
                    checklist_sugerido?: { descripcion: string }[] | null;
                    estado?: EstadoDesafio;
                };
            };
            equipos: {
                Row: {
                    id: string;
                    desafio_id: string;
                    nombre_equipo: string;
                    radar_equilibrio: Record<RolNombre, number> | null;
                    estado_entrega: boolean;
                    iniciado: boolean;
                    evaluacion_360: Record<string, unknown> | null;
                    created_at: string;
                };
                Insert: {
                    desafio_id: string;
                    nombre_equipo: string;
                    radar_equilibrio?: Record<RolNombre, number> | null;
                    estado_entrega?: boolean;
                    iniciado?: boolean;
                    evaluacion_360?: Record<string, unknown> | null;
                };
                Update: {
                    nombre_equipo?: string;
                    radar_equilibrio?: Record<RolNombre, number> | null;
                    estado_entrega?: boolean;
                    iniciado?: boolean;
                    evaluacion_360?: Record<string, unknown> | null;
                };
            };
            equipo_miembros: {
                Row: {
                    equipo_id: string;
                    usuario_id: string;
                    rol_en_equipo: RolNombre;
                    joined_at: string;
                };
                Insert: {
                    equipo_id: string;
                    usuario_id: string;
                    rol_en_equipo: RolNombre;
                };
                Update: {
                    rol_en_equipo?: RolNombre;
                };
            };
            tareas: {
                Row: {
                    id: string;
                    equipo_id: string;
                    usuario_id: string | null;
                    descripcion: string;
                    rol_asociado: RolNombre;
                    estado: EstadoKanban;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    equipo_id: string;
                    usuario_id?: string | null;
                    descripcion: string;
                    rol_asociado: RolNombre;
                    estado?: EstadoKanban;
                };
                Update: {
                    usuario_id?: string | null;
                    descripcion?: string;
                    estado?: EstadoKanban;
                };
            };
            insignias: {
                Row: {
                    id: string;
                    usuario_id: string;
                    tipo_competencia: string;
                    otorgada_en: string;
                    equipo_origen_id: string | null;
                };
                Insert: {
                    usuario_id: string;
                    tipo_competencia: string;
                    otorgada_en?: string;
                    equipo_origen_id?: string | null;
                };
                Update: {
                    tipo_competencia?: string;
                };
            };
            checkins: {
                Row: {
                    id: string;
                    usuario_id: string;
                    equipo_id: string;
                    resumen: string;
                    created_at: string;
                };
                Insert: {
                    usuario_id: string;
                    equipo_id: string;
                    resumen: string;
                };
                Update: {
                    resumen?: string;
                };
            };
            notificaciones: {
                Row: {
                    id: string;
                    usuario_id: string;
                    remitente_id: string | null;
                    tipo: string;
                    mensaje: string;
                    leida: boolean;
                    created_at: string;
                };
                Insert: {
                    usuario_id: string;
                    remitente_id?: string | null;
                    tipo?: string;
                    mensaje: string;
                    leida?: boolean;
                };
                Update: {
                    leida?: boolean;
                };
            };
            solicitudes_equipo: {
                Row: {
                    id: string;
                    equipo_id: string;
                    usuario_id: string;
                    remitente_id: string;
                    tipo: 'invitacion' | 'solicitud';
                    estado: 'pendiente' | 'aceptada' | 'rechazada';
                    mensaje: string | null;
                    created_at: string;
                };
                Insert: {
                    equipo_id: string;
                    usuario_id: string;
                    remitente_id: string;
                    tipo: 'invitacion' | 'solicitud';
                    mensaje?: string | null;
                };
                Update: {
                    estado?: 'pendiente' | 'aceptada' | 'rechazada';
                };
            };
        };
    };
}
