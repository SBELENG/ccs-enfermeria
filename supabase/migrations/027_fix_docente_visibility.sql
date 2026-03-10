-- ============================================================
-- CCS · Migración 027: Visibilidad Alumno-Docente
-- ============================================================

-- 1. Permitir que los Estudiantes vean a los Docentes
-- Actualmente solo podían ver a otros Estudiantes, lo que bloqueaba las notificaciones del docente.
DROP POLICY IF EXISTS "usuarios_select_docente_para_estudiantes" ON public.usuarios;
CREATE POLICY "usuarios_select_docente_para_estudiantes" ON public.usuarios
FOR SELECT USING (
  ((auth.jwt() -> 'user_metadata' ->> 'tipo') = 'estudiante' AND tipo = 'docente')
);

-- 2. Asegurar que las notificaciones e invitaciones se vean siempre (robustez)
-- Reforzamos que el dueño de la notificación siempre pueda verla aunque el remitente sea nulo
DROP POLICY IF EXISTS "notificaciones_select_v25" ON public.notificaciones;
CREATE POLICY "notificaciones_select_v25" ON public.notificaciones
FOR SELECT USING (auth.uid() = usuario_id);

COMMENT ON POLICY "usuarios_select_docente_para_estudiantes" ON public.usuarios IS 'Permite que los alumnos vean los perfiles básicos (nombre, foto) de sus profesores para recibir avisos e identificarlos.';
