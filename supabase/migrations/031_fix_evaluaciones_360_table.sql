-- ============================================================
-- CCS · Corrección Completa: Tabla evaluaciones_360
-- ============================================================

-- 1. Crear la tabla si no existe
CREATE TABLE IF NOT EXISTS public.evaluaciones_360 (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluador_id  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    evaluado_id   UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    equipo_id     UUID NOT NULL REFERENCES public.equipos(id)  ON DELETE CASCADE,
    puntaje_que   NUMERIC(3,1) NOT NULL CHECK (puntaje_que  BETWEEN 1 AND 5),
    puntaje_como  NUMERIC(3,1) NOT NULL CHECK (puntaje_como BETWEEN 1 AND 5),
    evaluacion_que JSONB DEFAULT '{}'::jsonb, -- Soporte para respuestas detalladas
    evaluacion_como JSONB DEFAULT '{}'::jsonb,
    respuestas    JSONB DEFAULT '{}'::jsonb,
    comentario    TEXT,
    es_autoevaluacion BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_evaluacion UNIQUE (evaluador_id, evaluado_id, equipo_id)
);

-- 2. Asegurar que Row Level Security esté activo
ALTER TABLE public.evaluaciones_360 ENABLE ROW LEVEL SECURITY;

-- 3. Limpiar políticas viejas (para evitar conflictos)
DROP POLICY IF EXISTS "evaluaciones_insert" ON public.evaluaciones_360;
DROP POLICY IF EXISTS "evaluaciones_select_evaluado" ON public.evaluaciones_360;
DROP POLICY IF EXISTS "evaluaciones_select_evaluador" ON public.evaluaciones_360;
DROP POLICY IF EXISTS "evaluaciones_select_docente" ON public.evaluaciones_360;

-- 4. Crear políticas robustas
CREATE POLICY "evaluaciones_insert" ON public.evaluaciones_360
  FOR INSERT WITH CHECK (evaluador_id = auth.uid());

CREATE POLICY "evaluaciones_select_evaluado" ON public.evaluaciones_360
  FOR SELECT USING (evaluado_id = auth.uid());

CREATE POLICY "evaluaciones_select_evaluador" ON public.evaluaciones_360
  FOR SELECT USING (evaluador_id = auth.uid());

CREATE POLICY "evaluaciones_select_docente" ON public.evaluaciones_360
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.equipos eq
      JOIN public.desafios  des ON des.id = eq.desafio_id
      JOIN public.catedras  cat ON cat.id = des.catedra_id
      WHERE eq.id = evaluaciones_360.equipo_id
        AND cat.docente_id = auth.uid()
    )
  );

-- 5. Forzar actualización del cache del esquema (PostgREST)
NOTIFY pgrst, 'reload schema';

COMMENT ON TABLE public.evaluaciones_360 IS 'Evaluaciones de pares y autoevaluaciones del equipo.';
