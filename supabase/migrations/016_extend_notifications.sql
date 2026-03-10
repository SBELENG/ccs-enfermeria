-- ============================================================
-- CCS · Migración 016: Notificaciones Interactivas
-- ============================================================

-- 1. Añadir columnas de contexto y estado
ALTER TABLE public.notificaciones ADD COLUMN IF NOT EXISTS equipo_id UUID REFERENCES public.equipos(id) ON DELETE CASCADE;
ALTER TABLE public.notificaciones ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente'; -- 'pendiente', 'aceptado', 'rechazado'

-- 2. Activar RLS (por si no lo estaba)
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

-- 3. Asegurar que los remitentes puedan insertar (aunque no ver)
DROP POLICY IF EXISTS "Remitentes pueden insertar notificaciones" ON public.notificaciones;
CREATE POLICY "Remitentes pueden insertar notificaciones" 
    ON public.notificaciones FOR INSERT 
    WITH CHECK (auth.uid() = remitente_id);

-- 4. Comentarios
COMMENT ON COLUMN public.notificaciones.equipo_id IS 'ID del equipo que invita o genera el interés';
COMMENT ON COLUMN public.notificaciones.estado IS 'Estado de la interacción: pendiente, aceptado o rechazado';
