-- ============================================================
-- CCS · Migración 007: Permitir a estudiantes crear equipos
-- ============================================================

-- El docente ya tiene acceso total vía la migración 006.
-- Necesitamos que el estudiante pueda INSERTAR un equipo si está inscripto en la materia.

CREATE POLICY "equipos: estudiantes inscriptos pueden crear"
  ON equipos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM desafios d
      JOIN inscripciones i ON i.catedra_id = d.catedra_id
      WHERE d.id = equipos.desafio_id
        AND i.usuario_id = auth.uid()
    )
  );

-- También asegurar que el creador (que aún no es miembro en la tabla equipo_miembros)
-- pueda ver el equipo recién creado para completar el flujo.
-- (Ya tenemos una política de SELECT true en la migración 006, así que esto está cubierto).
