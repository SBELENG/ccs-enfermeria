-- Migración 012: Estado de cierre de equipos y sincronización de roles
-- Permite bloquear la asignación de tareas hasta que el grupo esté completo.

ALTER TABLE equipos ADD COLUMN cerrado BOOLEAN DEFAULT false;

COMMENT ON COLUMN equipos.cerrado IS 'Indica si el grupo está completo y puede comenzar con la asignación de tareas en el Kanban';
