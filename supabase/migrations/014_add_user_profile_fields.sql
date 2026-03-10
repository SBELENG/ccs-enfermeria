-- ============================================================
-- CCS · Migración 014: Columnas de Perfil Profesional
-- ============================================================

-- Añadir columnas faltantes a la tabla 'usuarios'
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS preferencia_rol_busqueda TEXT DEFAULT 'primario',
ADD COLUMN IF NOT EXISTS buscando_equipo BOOLEAN DEFAULT true;

-- Comentario para documentación
COMMENT ON COLUMN public.usuarios.preferencia_rol_busqueda IS 'Indica si el usuario prefiere ser visto por su rol primario o secundario en el marketplace';
COMMENT ON COLUMN public.usuarios.buscando_equipo IS 'Estado de disponibilidad del estudiante para recibir invitaciones';
