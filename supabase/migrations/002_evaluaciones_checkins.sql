-- Migración 002: tabla evaluaciones_360
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.evaluaciones_360 (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluador_id  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  evaluado_id   UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  equipo_id     UUID NOT NULL REFERENCES public.equipos(id)  ON DELETE CASCADE,
  puntaje_que   NUMERIC(3,1) NOT NULL CHECK (puntaje_que  BETWEEN 1 AND 5),
  puntaje_como  NUMERIC(3,1) NOT NULL CHECK (puntaje_como BETWEEN 1 AND 5),
  respuestas    JSONB,
  comentario    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Un usuario no puede evaluar dos veces al mismo par en el mismo equipo
  CONSTRAINT unique_evaluacion UNIQUE (evaluador_id, evaluado_id, equipo_id),
  -- No puede autoevaluarse
  CONSTRAINT no_autoevaluacion CHECK (evaluador_id <> evaluado_id)
);

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_eval360_evaluado  ON public.evaluaciones_360 (evaluado_id,  equipo_id);
CREATE INDEX IF NOT EXISTS idx_eval360_evaluador ON public.evaluaciones_360 (evaluador_id, equipo_id);

-- Row Level Security
ALTER TABLE public.evaluaciones_360 ENABLE ROW LEVEL SECURITY;

-- El evaluador puede insertar su propia evaluación
CREATE POLICY "evaluaciones_insert" ON public.evaluaciones_360
  FOR INSERT WITH CHECK (evaluador_id = auth.uid());

-- El evaluado puede ver sus evaluaciones recibidas (pero no quién las mandó)
CREATE POLICY "evaluaciones_select_evaluado" ON public.evaluaciones_360
  FOR SELECT USING (evaluado_id = auth.uid());

-- El evaluador puede ver las evaluaciones que envió
CREATE POLICY "evaluaciones_select_evaluador" ON public.evaluaciones_360
  FOR SELECT USING (evaluador_id = auth.uid());

-- Docente puede ver todas las evaluaciones de sus equipos
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

-- También agregar tabla de checkins si no existe
CREATE TABLE IF NOT EXISTS public.checkins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES public.usuarios(id)  ON DELETE CASCADE,
  equipo_id   UUID NOT NULL REFERENCES public.equipos(id)   ON DELETE CASCADE,
  resumen     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkins_equipo ON public.checkins (equipo_id, created_at DESC);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checkins_insert" ON public.checkins
  FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "checkins_select_equipo" ON public.checkins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.equipo_miembros em
      WHERE em.equipo_id = checkins.equipo_id
        AND em.usuario_id = auth.uid()
    )
  );

COMMENT ON TABLE public.evaluaciones_360 IS 'Evaluaciones de pares entre miembros de un equipo al cierre del desafío (anónimas para el evaluado)';
COMMENT ON TABLE public.checkins         IS 'Updates diarios asíncronos de cada miembro al equipo';
