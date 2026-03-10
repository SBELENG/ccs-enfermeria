-- Migración 004: Historial de Carrera e Insignias de Talento
-- Esta tabla guarda el "estado final" de un alumno tras un desafío

CREATE TABLE IF NOT EXISTS public.perfil_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    desafio_id UUID NOT NULL REFERENCES public.desafios(id) ON DELETE CASCADE,
    equipo_id UUID REFERENCES public.equipos(id) ON DELETE SET NULL,
    insignias TEXT[] DEFAULT '{}',
    score_ejecucion NUMERIC(3,2),
    score_iniciativa NUMERIC(3,2),
    score_clima NUMERIC(3,2),
    score_comunicacion NUMERIC(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Un usuario solo tiene un registro histórico por desafío
    UNIQUE(usuario_id, desafio_id)
);

-- Habilitar RLS
ALTER TABLE public.perfil_historial ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Usuarios pueden ver su propio historial"
    ON public.perfil_historial FOR SELECT
    USING (auth.uid() = usuario_id);

CREATE POLICY "Docentes pueden ver el historial de todos los alumnos"
    ON public.perfil_historial FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo = 'docente'
    ));

-- Añadir estado 'finalizado' a los desafíos
ALTER TABLE public.desafios ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo' CHECK (estado IN ('activo', 'finalizado'));
