-- ============================================================
-- CCS · Migración 028: Visibilidad Pública de Perfiles
-- ============================================================

-- 1. Eliminar políticas restrictivas previas sobre la tabla usuarios
DROP POLICY IF EXISTS "usuarios_select_docente" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_marketplace" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_docente_para_estudiantes" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_self" ON public.usuarios;

-- 2. Permitir que cualquier usuario autenticado vea el Nombre y Foto de los demás
-- Esto es vital para notificaciones, muros de equipo y búsqueda de talentos.
CREATE POLICY "usuarios_select_public_v28" 
ON public.usuarios
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- 3. Asegurar que solo el dueño puede editar su info (Seguridad Crítica)
DROP POLICY IF EXISTS "usuarios_update_self" ON public.usuarios;
CREATE POLICY "usuarios_update_self_v28" 
ON public.usuarios
FOR UPDATE 
USING (auth.uid() = id);

COMMENT ON POLICY "usuarios_select_public_v28" ON public.usuarios IS 'Permite que cualquier alumno o docente vea los datos básicos (nombre, foto) necesarios para la interacción social en la plataforma.';
