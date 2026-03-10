-- ============================================================
-- CCS · Migración 023: Fix Checkins (Políticas y Visibilidad)
-- ============================================================

-- 1. Limpiar políticas previas de checkins para evitar conflictos
DROP POLICY IF EXISTS "checkins_insert" ON public.checkins;
DROP POLICY IF EXISTS "checkins_select_equipo" ON public.checkins;
DROP POLICY IF EXISTS "checkins_select_all" ON public.checkins;

-- 2. Permitir que cualquier usuario autenticado inserte su propio checkin
CREATE POLICY "checkins_insert_self" ON public.checkins
FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- 3. Permitir que los miembros del equipo vean los checkins del equipo
CREATE POLICY "checkins_select_miembros" ON public.checkins
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.equipo_miembros em
        WHERE em.equipo_id = checkins.equipo_id
          AND em.usuario_id = auth.uid()
    )
);

-- 4. Permitir que los docentes vean los checkins de sus equipos (Supervisión)
CREATE POLICY "checkins_select_docente" ON public.checkins
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.equipos e
        JOIN public.desafios d ON d.id = e.desafio_id
        JOIN public.catedras c ON c.id = d.catedra_id
        WHERE e.id = checkins.equipo_id
          AND c.docente_id = auth.uid()
    )
);

-- 5. Asegurar índices para performance
CREATE INDEX IF NOT EXISTS idx_checkins_equipo_v2 ON public.checkins (equipo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_usuario_v2 ON public.checkins (usuario_id);
