-- CCS · Script de Salud de Base de Datos (Integridad de Esquema)
-- Ejecutar en Supabase SQL Editor para resolver errores de "column not found"

DO $$ 
BEGIN 
    -- 1. Asegurar columna 'cerrado' en equipos
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipos' AND column_name='cerrado') THEN
        ALTER TABLE public.equipos ADD COLUMN cerrado BOOLEAN DEFAULT false;
        COMMENT ON COLUMN public.equipos.cerrado IS 'Indica si el grupo está completo y puede comenzar con la asignación de tareas en el Kanban';
    END IF;

    -- 2. Asegurar columna 'iniciado' en equipos (Migración 006 fallback)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipos' AND column_name='iniciado') THEN
        ALTER TABLE public.equipos ADD COLUMN iniciado BOOLEAN DEFAULT false;
    END IF;

    -- 3. Asegurar columna 'es_autoevaluacion' en evaluaciones_360 (Migración 003 fallback)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evaluaciones_360') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='evaluaciones_360' AND column_name='es_autoevaluacion') THEN
            ALTER TABLE public.evaluaciones_360 ADD COLUMN es_autoevaluacion BOOLEAN DEFAULT false;
        END IF;
    END IF;

END $$;

SELECT 'Chequeo de salud completado' as resultado;
