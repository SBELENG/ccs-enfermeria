-- ============================================================
-- CCS · Migración 021: Agregar descripción a desafíos
-- ============================================================

ALTER TABLE desafios ADD COLUMN IF NOT EXISTS descripcion TEXT;
