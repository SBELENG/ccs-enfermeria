-- ============================================================
-- CCS · Migración 021: Fix fecha_entrega con hora
-- ============================================================

-- Cambiamos el tipo de la columna a TIMESTAMPTZ para que PostgreSQL guarde la hora.
-- El USING cast permite conservar los datos que ya existen.
ALTER TABLE public.desafios
ALTER COLUMN fecha_entrega TYPE TIMESTAMPTZ USING fecha_entrega::timestamptz;
