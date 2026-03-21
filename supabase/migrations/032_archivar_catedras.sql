-- Migration: Añadir columna oculta a las inscripciones para que los alumnos puedan "archivar" cátedras viejas
ALTER TABLE inscripciones ADD COLUMN IF NOT EXISTS oculta BOOLEAN DEFAULT FALSE;
