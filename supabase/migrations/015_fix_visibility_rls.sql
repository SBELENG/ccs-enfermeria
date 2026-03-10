-- ============================================================
-- CCS · Migración 015: Visibilidad Transversal e Inscripciones
-- ============================================================

-- 1. Asegurar visibilidad de INSCRIPCIONES (Todos deben ver quién está en qué cátedra)
DROP POLICY IF EXISTS "inscripciones_select" ON public.inscripciones;
CREATE POLICY "inscripciones_select_all" ON public.inscripciones
FOR SELECT TO authenticated USING (true);

-- 2. Asegurar visibilidad de USUARIOS (Marketplace)
-- Permitimos que cualquier usuario autenticado vea a los estudiantes (perfiles públicos)
DROP POLICY IF EXISTS "usuarios_select_marketplace" ON public.usuarios;
CREATE POLICY "usuarios_select_estudiantes" ON public.usuarios
FOR SELECT TO authenticated 
USING (tipo = 'estudiante' OR id = auth.uid());

-- Permitimos que los Docentes vean a todos para gestión
DROP POLICY IF EXISTS "usuarios_select_docente" ON public.usuarios;
CREATE POLICY "usuarios_select_docente_v2" ON public.usuarios
FOR SELECT TO authenticated 
USING (
  (auth.jwt() -> 'user_metadata' ->> 'tipo') = 'docente'
);

-- 3. Asegurar visibilidad de EQUIPOS y MIEMBROS
DROP POLICY IF EXISTS "equipos_select" ON public.equipos;
CREATE POLICY "equipos_select_all" ON public.equipos FOR SELECT USING (true);

DROP POLICY IF EXISTS "equipo_miembros_select" ON public.equipo_miembros;
CREATE POLICY "equipo_miembros_select_all" ON public.equipo_miembros FOR SELECT USING (true);

-- 4. Asegurar visibilidad de CÁTEDRAS
DROP POLICY IF EXISTS "catedras: estudiantes ven activas" ON public.catedras;
DROP POLICY IF EXISTS "catedras_select" ON public.catedras;
CREATE POLICY "catedras_select_all" ON public.catedras FOR SELECT USING (true);

-- Comentario
COMMENT ON POLICY "inscripciones_select_all" ON public.inscripciones IS 'Permite que todos los usuarios vean las inscripciones para filtrar el marketplace';
