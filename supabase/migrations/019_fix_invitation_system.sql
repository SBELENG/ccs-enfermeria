-- ============================================================
-- CCS · Migración 019: Garantía de Invitaciones y Notificaciones
-- ============================================================

-- 1. Asegurar tabla solicitudes_equipo (Fallback por si no existe en repo)
-- Esta tabla es vital para el reclutamiento.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'solicitudes_equipo') THEN
        CREATE TABLE public.solicitudes_equipo (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            equipo_id    UUID NOT NULL REFERENCES public.equipos(id) ON DELETE CASCADE,
            usuario_id   UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE, -- El invitado o interesado
            remitente_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE, -- El que invita o avisa interés
            tipo         TEXT NOT NULL DEFAULT 'invitacion', -- 'invitacion' o 'interes'
            mensaje      TEXT,
            estado       TEXT NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'aceptado', 'rechazado'
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        -- RLS para esta nueva tabla
        ALTER TABLE public.solicitudes_equipo ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "solicitudes_select_v19" ON solicitudes_equipo FOR SELECT USING (usuario_id = auth.uid() OR remitente_id = auth.uid());
        CREATE POLICY "solicitudes_insert_v19" ON solicitudes_equipo FOR INSERT WITH CHECK (remitente_id = auth.uid());
        CREATE POLICY "solicitudes_update_v19" ON solicitudes_equipo FOR UPDATE USING (usuario_id = auth.uid());
    END IF;

    -- 2. Asegurar columna 'estado' y default en solicitudes_equipo si ya existía
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='solicitudes_equipo' AND column_name='estado') THEN
        ALTER TABLE public.solicitudes_equipo ADD COLUMN estado TEXT NOT NULL DEFAULT 'pendiente';
    END IF;

    -- 3. Asegurar columna 'estado' y default en notificaciones si ya existía
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='estado') THEN
        ALTER TABLE public.notificaciones ADD COLUMN estado TEXT NOT NULL DEFAULT 'pendiente';
    END IF;
END $$;

-- 4. Asegurar RLS para INSERT en notificaciones (re-asegurado)
DROP POLICY IF EXISTS "Remitentes pueden insertar notificaciones" ON public.notificaciones;
CREATE POLICY "Remitentes pueden insertar notificaciones" 
    ON public.notificaciones FOR INSERT 
    WITH CHECK (auth.uid() = remitente_id);

-- 5. Asegurar Realtime en estas tablas
ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones, solicitudes_equipo;
EXCEPTION WHEN OTHERS THEN 
    -- Si ya estaban en la publicación, capturamos el error silenciosamente
    NULL;
