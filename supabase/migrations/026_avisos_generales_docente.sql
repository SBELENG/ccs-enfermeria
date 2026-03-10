-- ============================================================
-- CCS · Migración 026: Avisos Generales (Docente -> Cátedra)
-- ============================================================

-- 1. Tabla de Avisos de Cátedra
CREATE TABLE IF NOT EXISTS public.avisos_catedra (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catedra_id  UUID NOT NULL REFERENCES public.catedras(id) ON DELETE CASCADE,
    mensaje     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Función para disparar notificaciones individuales
CREATE OR REPLACE FUNCTION public.fn_notify_aviso_general()
RETURNS TRIGGER AS $$
DECLARE
    v_alumno RECORD;
    v_materia TEXT;
    v_docente_nombre TEXT;
    v_docente_id UUID;
BEGIN
    -- Obtener datos de la cátedra y el docente
    SELECT nombre_materia, docente_id INTO v_materia, v_docente_id 
    FROM public.catedras WHERE id = NEW.catedra_id;

    -- Obtener nombre del docente
    SELECT nombre INTO v_docente_nombre FROM public.usuarios WHERE id = v_docente_id;

    -- Notificar a cada estudiante inscrito
    FOR v_alumno IN (
        SELECT usuario_id FROM public.inscripciones WHERE catedra_id = NEW.catedra_id
    ) LOOP
        INSERT INTO public.notificaciones (
            usuario_id,
            remitente_id,
            tipo,
            mensaje
        ) VALUES (
            v_alumno.usuario_id,
            v_docente_id,
            'sistema',
            '📢 ' || v_docente_nombre || ' (' || v_materia || '): ' || NEW.mensaje
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger
DROP TRIGGER IF EXISTS tr_nuevo_aviso_general ON public.avisos_catedra;
CREATE TRIGGER tr_nuevo_aviso_general
    AFTER INSERT ON public.avisos_catedra
    FOR EACH ROW EXECUTE FUNCTION public.fn_notify_aviso_general();

-- 4. RLS
ALTER TABLE public.avisos_catedra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avisos_select_all" ON public.avisos_catedra 
    FOR SELECT USING (true);

CREATE POLICY "avisos_insert_docente" ON public.avisos_catedra 
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.catedras WHERE id = catedra_id AND docente_id = auth.uid())
    );

COMMENT ON TABLE public.avisos_catedra IS 'Comunicados oficiales del docente para todos los estudiantes inscritos en una cátedra.';
