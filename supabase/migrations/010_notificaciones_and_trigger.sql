-- ============================================================
-- CCS · Migración 010: Tabla Notificaciones + Trigger Push
-- ============================================================

-- 1. Asegurar extensión pg_net para llamadas HTTP (usada por Supabase)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Definición formal de la tabla notificaciones
CREATE TABLE IF NOT EXISTS public.notificaciones (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id   UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    remitente_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    tipo         TEXT NOT NULL, -- 'invitacion', 'interes', 'sistema', etc.
    mensaje      TEXT NOT NULL,
    leida        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON public.notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leida   ON public.notificaciones(usuario_id, leida);

-- 4. Habilitar RLS
ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver sus propias notificaciones"
    ON public.notificaciones FOR SELECT
    USING (auth.uid() = usuario_id);

CREATE POLICY "Usuarios pueden marcar como leídas sus notificaciones"
    ON public.notificaciones FOR UPDATE
    USING (auth.uid() = usuario_id);

-- 5. FUNCIÓN TRIGGER: Notificar vía Push (Expo)
-- Envía una petición a la Edge Function 'send-push' de Supabase
CREATE OR REPLACE FUNCTION public.notify_via_push()
RETURNS TRIGGER AS $$
DECLARE
    target_token TEXT;
BEGIN
    -- Obtener el token del usuario destino
    SELECT expo_push_token INTO target_token
    FROM public.usuarios
    WHERE id = NEW.usuario_id;

    -- Si el usuario tiene token, enviar push
    IF target_token IS NOT NULL THEN
        PERFORM net.http_post(
            url := 'https://' || current_setting('request.headers')::json->>'host' || '/functions/v1/send-push',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', current_setting('request.headers')::json->>'authorization'
            ),
            body := jsonb_build_object(
                'tokens', ARRAY[target_token],
                'title', CASE 
                    WHEN NEW.tipo = 'invitacion' THEN '📧 Nueva invitación'
                    WHEN NEW.tipo = 'interes' THEN '🤝 Alguien está interesado'
                    ELSE '🔔 Notificación CCS'
                END,
                body := NEW.mensaje
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. El Trigger
DROP TRIGGER IF EXISTS tr_new_notification ON public.notificaciones;
CREATE TRIGGER tr_new_notification
    AFTER INSERT ON public.notificaciones
    FOR EACH ROW EXECUTE FUNCTION public.notify_via_push();

COMMENT ON TABLE public.notificaciones IS 'Centro de notificaciones centralizado para la plataforma CCS';
