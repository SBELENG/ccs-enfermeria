-- Migración 003: Gobernanza de Equipos e Identidad de Búsqueda

-- 1. Agregar preferencia de rol de búsqueda a usuarios
ALTER TABLE usuarios ADD COLUMN preferencia_rol_busqueda TEXT DEFAULT 'primario' CHECK (preferencia_rol_busqueda IN ('primario', 'secundario'));

-- 2. Agregar estado de inicio a equipos
ALTER TABLE equipos ADD COLUMN iniciado BOOLEAN DEFAULT false;

-- 3. Comentario para documentar
COMMENT ON COLUMN usuarios.preferencia_rol_busqueda IS 'Determina qué talento se destaca en el Marketplace';
COMMENT ON COLUMN equipos.iniciado IS 'Indica si un Organizador ya validó el equipo y le asignó nombre definitivo';
