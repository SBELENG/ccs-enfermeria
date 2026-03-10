-- ============================================================
-- CCS · Migración 013: Fix RLS Recursivo y Mejora de Seguridad
-- ============================================================

-- Eliminar políticas conflictivas o recursivas
DROP POLICY IF EXISTS "usuarios_select_docente" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios: perfiles publicos" ON public.usuarios;

-- 1. Permitir que los Docentes vean a todos los Estudiantes
-- Usamos el metadato del JWT para evitar la recursión infinita en la tabla usuarios
CREATE POLICY "usuarios_select_docente" ON public.usuarios
FOR SELECT USING (
  (auth.jwt() -> 'user_metadata' ->> 'tipo') = 'docente'
);

-- 2. Permitir que los Estudiantes vean a otros Estudiantes (Marketplace)
-- También usamos el metadato del JWT por consistencia y velocidad
CREATE POLICY "usuarios_select_marketplace" ON public.usuarios
FOR SELECT USING (
  (auth.jwt() -> 'user_metadata' ->> 'tipo') = 'estudiante' AND tipo = 'estudiante'
);

-- 3. Asegurar que el usuario siempre pueda ver e insertar su propio perfil
-- Estas suelen estar, pero las reafirmamos
DROP POLICY IF EXISTS "usuarios: leer propio perfil" ON public.usuarios;
CREATE POLICY "usuarios_select_self" ON public.usuarios
FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "usuarios_insert_self" ON public.usuarios;
CREATE POLICY "usuarios_insert_self" ON public.usuarios
FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "usuarios: actualizar propio perfil" ON public.usuarios;
CREATE POLICY "usuarios_update_self" ON public.usuarios
FOR UPDATE USING (auth.uid() = id);

-- 4. Permitir que el estudiante actualice sus propias inscripciones (para sincronizar el rol_activo)
DROP POLICY IF EXISTS "inscripciones_update_self" ON public.inscripciones;
CREATE POLICY "inscripciones_update_self" ON public.inscripciones
FOR UPDATE USING (usuario_id = auth.uid());
