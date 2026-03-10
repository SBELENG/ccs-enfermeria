-- ============================================================
-- CCS · Migración 008: Fix Usuarios RLS e Inserción
-- ============================================================

-- Permitir que usuarios autenticados creen su propio perfil (Necesario para el upsert del Dashboard)
CREATE POLICY "usuarios_insert_self" ON public.usuarios
FOR INSERT WITH CHECK (auth.uid() = id);

-- Permitir que los Docentes vean a todos los Estudiantes (Para gestión de cátedra y desafíos)
CREATE POLICY "usuarios_select_docente" ON public.usuarios
FOR SELECT USING (
  (SELECT tipo FROM public.usuarios WHERE id = auth.uid()) = 'docente'
);

-- Asegurar que el SELECT propio siga funcionando (ya existía pero por claridad)
-- DROP POLICY IF EXISTS "usuarios: leer propio perfil" ON usuarios;
-- CREATE POLICY "usuarios_select_self" ON usuarios FOR SELECT USING (auth.uid() = id);
