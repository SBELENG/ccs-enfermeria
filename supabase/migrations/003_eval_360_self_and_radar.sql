-- Migración 003: Habilitar Autoevaluación 360
-- Ejecutar en Supabase SQL Editor

-- 1. Eliminar restricción que impide autoevaluarse
ALTER TABLE public.evaluaciones_360 
DROP CONSTRAINT IF EXISTS no_autoevaluacion;

-- 2. Añadir columna para identificar autoevaluaciones
ALTER TABLE public.evaluaciones_360
ADD COLUMN IF NOT EXISTS es_autoevaluacion BOOLEAN DEFAULT FALSE;

-- 3. Actualizar comentarios
COMMENT ON COLUMN public.evaluaciones_360.es_autoevaluacion IS 'Indica si la evaluación es una autoevaluación del propio alumno';
