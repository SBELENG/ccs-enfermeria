ALTER TABLE equipos ADD COLUMN IF NOT EXISTS tareas_sugeridas JSONB DEFAULT '[]'::jsonb;
