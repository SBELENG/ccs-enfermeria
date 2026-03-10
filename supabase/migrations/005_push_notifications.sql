-- ============================================================
-- CCS · Migración 005: Soporte para Notificaciones Push
-- ============================================================

-- Añadir columna para almacenar el token de Expo Push
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Índice para búsqueda rápida por token (opcional pero recomendado)
CREATE INDEX IF NOT EXISTS idx_usuarios_push_token ON public.usuarios(expo_push_token);

-- Comentario para documentación
COMMENT ON COLUMN public.usuarios.expo_push_token IS 'Token único de Expo Push para notificaciones móviles.';
