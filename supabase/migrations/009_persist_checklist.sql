-- Añadir columna para persistir el progreso de las tareas orientativas
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS checklist_progreso JSONB DEFAULT '[]'::jsonb;
