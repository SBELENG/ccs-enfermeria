-- ============================================================
-- CCS · Migración 025: Notificaciones al Finalizar Desafío
-- ============================================================

-- 1. Función para notificar a todo el equipo cuando se cierra un desafío
CREATE OR REPLACE FUNCTION public.fn_notify_desafio_finalizado()
RETURNS TRIGGER AS $$
DECLARE
    v_miembro RECORD;
    v_nombre_equipo TEXT;
    v_titulo_desafio TEXT;
BEGIN
    -- Solo actuar cuando estado_entrega pasa de FALSE a TRUE
    IF (OLD.estado_entrega IS FALSE AND NEW.estado_entrega IS TRUE) THEN
        
        -- Obtener Datos para el mensaje
        v_nombre_equipo := NEW.nombre_equipo;
        
        SELECT titulo INTO v_titulo_desafio 
        FROM public.desafios 
        WHERE id = NEW.desafio_id;

        -- Notificar a todos los miembros del equipo
        FOR v_miembro IN (
            SELECT usuario_id FROM public.equipo_miembros WHERE equipo_id = NEW.id
        ) LOOP
            INSERT INTO public.notificaciones (
                usuario_id,
                tipo,
                mensaje,
                equipo_id
            ) VALUES (
                v_miembro.usuario_id,
                'sistema',
                '¡Desafío finalizado! El equipo "' || v_nombre_equipo || '" ha completado "' || v_titulo_desafio || '". Ya pueden realizar la evaluación 36°.',
                NEW.id
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. El Trigger en la tabla equipos
DROP TRIGGER IF EXISTS tr_notificar_fin_desafio ON public.equipos;
CREATE TRIGGER tr_notificar_fin_desafio
    AFTER UPDATE OF estado_entrega ON public.equipos
    FOR EACH ROW
    WHEN (OLD.estado_entrega IS FALSE AND NEW.estado_entrega IS TRUE)
    EXECUTE FUNCTION public.fn_notify_desafio_finalizado();

-- 3. Asegurar que la tabla notificaciones tiene la columna equipo_id (si no estaba de antes)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='equipo_id') THEN
        ALTER TABLE public.notificaciones ADD COLUMN equipo_id UUID REFERENCES public.equipos(id) ON DELETE CASCADE;
    END IF;
END $$;

COMMENT ON FUNCTION public.fn_notify_desafio_finalizado IS 'Dispara notificaciones a todo el equipo cuando el Organizador marca el desafío como logrado.';
