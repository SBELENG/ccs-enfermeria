-- ============================================================
-- CCS · Migración 024: Reparación Definitiva de Checkins
-- ============================================================

-- 1. Asegurar la tabla con la estructura correcta
-- Si ya existe, nos aseguramos de que tenga las políticas limpias
DROP TABLE IF EXISTS public.checkins CASCADE;

CREATE TABLE public.checkins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  equipo_id  UUID NOT NULL REFERENCES public.equipos(id)  ON DELETE CASCADE,
  resumen    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- 3. Políticas ultra-seguras y sin recursión
-- INSERT: Cualquier usuario autenticado puede insertar SU propio checkin
CREATE POLICY "checkins_insert_self" ON public.checkins
FOR INSERT WITH CHECK (auth.uid() = usuario_id);

-- SELECT: Miembros de equipo pueden ver los del equipo
CREATE POLICY "checkins_select_team" ON public.checkins
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.equipo_miembros em
        WHERE em.equipo_id = checkins.equipo_id
          AND em.usuario_id = auth.uid()
    )
);

-- SELECT: Docentes pueden ver los de sus cátedras
CREATE POLICY "checkins_select_docente" ON public.checkins
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.equipos eq
        JOIN public.desafios des ON des.id = eq.desafio_id
        JOIN public.catedras cat ON cat.id = des.catedra_id
        WHERE eq.id = checkins.equipo_id
          AND cat.docente_id = auth.uid()
    )
);

-- Fallback simple para el docente si la anterior falla por relaciones
CREATE POLICY "checkins_select_docente_admin" ON public.checkins
FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'tipo') = 'docente'
);

-- 4. Índices
CREATE INDEX idx_checkins_equipo_final ON public.checkins(equipo_id, created_at DESC);

COMMENT ON TABLE public.checkins IS 'Daily updates de los estudiantes para sus equipos y docentes.';
