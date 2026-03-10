-- ============================================================
-- CCS · Migración 018: Rol Invitado en Notificaciones
-- ============================================================

-- 1. Añadir columna rol_invitado
-- Utilizamos el tipo rol_nombre ya definido en la migración 001
ALTER TABLE public.notificaciones 
ADD COLUMN IF NOT EXISTS rol_invitado rol_nombre;

-- 2. Comentario
COMMENT ON COLUMN public.notificaciones.rol_invitado IS 'Rol específico propuesto al invitar a un usuario a un equipo';
