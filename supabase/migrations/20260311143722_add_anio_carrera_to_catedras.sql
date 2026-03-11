-- Añadir columna anio_carrera a la tabla catedras
-- Representa el "Año del plan de estudio al que pertenece la asignatura" (1, 2, 3, 4, 5, etc.)

ALTER TABLE "public"."catedras" 
ADD COLUMN "anio_carrera" integer;

-- Opcional: Establecer un valor por defecto para las cátedras existentes para evitar nulos
UPDATE "public"."catedras"
SET "anio_carrera" = 1
WHERE "anio_carrera" IS NULL;
