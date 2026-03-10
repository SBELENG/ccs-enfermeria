-- ============================================================
-- CCS · Migración 020: Automatización de Notificaciones via Trigger
-- ============================================================

-- 1. Función para crear notificación automática desde Solicitudes
CREATE OR REPLACE FUNCTION public.fn_sync_solicitud_to_notificacion()
RETURNS TRIGGER AS $$
DECLARE
    v_nombre_remitente TEXT;
    v_nombre_equipo TEXT;
    v_mensaje_notif TEXT;
BEGIN
    -- Obtener nombres para el mensaje
    SELECT nombre INTO v_nombre_remitente FROM public.usuarios WHERE id = NEW.remitente_id;
    SELECT nombre_equipo INTO v_nombre_equipo FROM public.equipos WHERE id = NEW.equipo_id;

    IF NEW.tipo = 'invitacion' THEN
        v_mensaje_notif := v_nombre_remitente || ' te invitó a sumarte al equipo "' || v_nombre_equipo || '".';
    ELSE
        v_mensaje_notif := v_nombre_remitente || ' del equipo "' || v_nombre_equipo || '" está interesado en tu perfil.';
    END IF;

    -- Insertar en notificaciones
    INSERT INTO public.notificaciones (
        usuario_id,
        remitente_id,
        tipo,
        equipo_id,
        mensaje,
        estado,
        leida
    ) VALUES (
        NEW.usuario_id,
        NEW.remitente_id,
        NEW.tipo,
        NEW.equipo_id,
        v_mensaje_notif,
        'pendiente',
        false
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. El Trigger en solicitudes_equipo
DROP TRIGGER IF EXISTS tr_sync_solicitud_notif ON public.solicitudes_equipo;
CREATE TRIGGER tr_sync_solicitud_notif
    AFTER INSERT ON public.solicitudes_equipo
    FOR EACH ROW EXECUTE FUNCTION public.fn_sync_solicitud_to_notificacion();

-- 3. Asegurar que 'notificaciones' sea insertable por el sistema (trigger)
-- La política de INSERT ya existe para usuarios, pero con SECURITY DEFINER evitamos roles.

-- 4. Unificar RLS de notificaciones para SELECT (Garantía total)
DROP POLICY IF EXISTS "Usuarios pueden ver sus propias notificaciones" ON public.notificaciones;
CREATE POLICY "notificaciones_select_v20" 
    ON public.notificaciones FOR SELECT 
    USING (auth.uid() = usuario_id);

-- 5. Asegurar Realtime (Re-ejecución por seguridad)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND tablename = 'notificaciones'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones;
    END IF;
END $$;
