-- ============================================================
-- CCS · Migración 030: Snapshot del Kanban en equipos
-- ============================================================

-- 1. Añadir la columna snapshot_kanban a la tabla equipos
-- Esta columna guardará el estado de las tareas al momento de finalizar el desafío.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipos' AND column_name='snapshot_kanban') THEN
        ALTER TABLE public.equipos ADD COLUMN snapshot_kanban JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

COMMENT ON COLUMN public.equipos.snapshot_kanban IS 'Copia de seguridad del estado de las tareas (Kanban) al momento de marcar el desafío como logrado.';
