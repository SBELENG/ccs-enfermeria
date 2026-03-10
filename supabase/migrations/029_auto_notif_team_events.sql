-- ============================================================
-- CCS · Migración 029: Notificaciones Automáticas de Eventos de Equipo
-- ============================================================

-- 1. Función para notificar Abandono de Equipo
CREATE OR REPLACE FUNCTION public.fn_notify_team_abandonment()
RETURNS TRIGGER AS $$
DECLARE
    v_usuario_nombre TEXT;
    v_equipo_nombre TEXT;
    v_docente_id UUID;
    v_companero RECORD;
BEGIN
    -- Obtener nombre del que abandona
    SELECT nombre INTO v_usuario_nombre FROM public.usuarios WHERE id = OLD.usuario_id;
    
    -- Obtener datos del equipo y docente
    SELECT e.nombre_equipo, c.docente_id INTO v_equipo_nombre, v_docente_id
    FROM public.equipos e
    JOIN public.desafios d ON e.desafio_id = d.id
    JOIN public.catedras c ON d.catedra_id = c.id
    WHERE e.id = OLD.equipo_id;

    -- A) Notificar al Docente
    INSERT INTO public.notificaciones (usuario_id, remitente_id, tipo, mensaje)
    VALUES (v_docente_id, OLD.usuario_id, 'sistema', '⚠️ ' || v_usuario_nombre || ' ha abandonado el equipo "' || v_equipo_nombre || '".');

    -- B) Notificar a los compañeros restantes
    FOR v_companero IN (SELECT usuario_id FROM public.equipo_miembros WHERE equipo_id = OLD.equipo_id) LOOP
        INSERT INTO public.notificaciones (usuario_id, remitente_id, tipo, mensaje)
        VALUES (v_companero.usuario_id, OLD.usuario_id, 'sistema', '⚠️ ' || v_usuario_nombre || ' salió del equipo.');
    END LOOP;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger de Abandono
DROP TRIGGER IF EXISTS tr_notify_abandonment ON public.equipo_miembros;
CREATE TRIGGER tr_notify_abandonment
    AFTER DELETE ON public.equipo_miembros
    FOR EACH ROW EXECUTE FUNCTION public.fn_notify_team_abandonment();

-- 3. Función para notificar Cierre de Grupo (Kanban iniciado)
CREATE OR REPLACE FUNCTION public.fn_notify_team_closed()
RETURNS TRIGGER AS $$
DECLARE
    v_docente_id UUID;
BEGIN
    -- Solo si cambió a cerrado = true
    IF (OLD.cerrado IS DISTINCT FROM NEW.cerrado AND NEW.cerrado = true) THEN
        -- Obtener docente
        SELECT c.docente_id INTO v_docente_id
        FROM public.desafios d
        JOIN public.catedras c ON d.catedra_id = c.id
        WHERE d.id = NEW.desafio_id;

        -- Notificar al Docente
        INSERT INTO public.notificaciones (usuario_id, remitente_id, tipo, mensaje)
        VALUES (v_docente_id, auth.uid(), 'sistema', '🔒 El equipo "' || NEW.nombre_equipo || '" ha sido cerrado y ya inició el Kanban.');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger de Cierre
DROP TRIGGER IF EXISTS tr_notify_team_closed ON public.equipos;
CREATE TRIGGER tr_notify_team_closed
    AFTER UPDATE ON public.equipos
    FOR EACH ROW EXECUTE FUNCTION public.fn_notify_team_closed();
