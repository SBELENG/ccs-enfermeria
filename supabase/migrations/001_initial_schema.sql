-- ============================================================
-- CCS · Migración inicial de la base de datos (Supabase/PostgreSQL)
-- ============================================================

-- Tipos ENUM
CREATE TYPE tipo_usuario AS ENUM ('docente', 'estudiante');
CREATE TYPE rol_nombre AS ENUM ('organizador', 'analitico', 'ejecutor', 'creativo', 'conciliador', 'motivador');
CREATE TYPE estado_kanban AS ENUM ('backlog', 'doing', 'review', 'done');
CREATE TYPE estado_desafio AS ENUM ('borrador', 'activo', 'cerrado');

-- ============================================================
-- Tabla: usuarios
-- ============================================================
CREATE TABLE usuarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  foto_url        TEXT,
  email           TEXT UNIQUE NOT NULL,
  tipo            tipo_usuario NOT NULL DEFAULT 'estudiante',
  resultados_test JSONB,          -- { organizador: 75, analitico: 60, ... }
  rol_primario    rol_nombre,
  rol_secundario  rol_nombre,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Tabla: catedras
-- ============================================================
CREATE TABLE catedras (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_materia  TEXT NOT NULL,
  docente_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_acceso   TEXT NOT NULL UNIQUE,
  activa          BOOLEAN NOT NULL DEFAULT TRUE,
  ciclo_lectivo   TEXT NOT NULL,    -- ej: '2025'
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Tabla: inscripciones (estudiante ↔ cátedra)
-- ============================================================
CREATE TABLE inscripciones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  catedra_id  UUID NOT NULL REFERENCES catedras(id) ON DELETE CASCADE,
  rol_activo  rol_nombre,     -- puede diferir de rol_primario para esta materia
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(usuario_id, catedra_id)
);

-- ============================================================
-- Tabla: desafios
-- ============================================================
CREATE TABLE desafios (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catedra_id         UUID NOT NULL REFERENCES catedras(id) ON DELETE CASCADE,
  titulo             TEXT NOT NULL,
  documento_url      TEXT,
  fecha_entrega      DATE NOT NULL,
  checklist_sugerido JSONB,       -- [{ descripcion: "..." }]
  estado             estado_desafio NOT NULL DEFAULT 'borrador',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Tabla: equipos
-- ============================================================
CREATE TABLE equipos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  desafio_id       UUID NOT NULL REFERENCES desafios(id) ON DELETE CASCADE,
  nombre_equipo    TEXT NOT NULL,
  radar_equilibrio JSONB,         -- promedio de roles del equipo
  estado_entrega   BOOLEAN NOT NULL DEFAULT FALSE,
  evaluacion_360   JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Tabla: equipo_miembros
-- ============================================================
CREATE TABLE equipo_miembros (
  equipo_id    UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  usuario_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  rol_en_equipo rol_nombre NOT NULL,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (equipo_id, usuario_id)
);

-- ============================================================
-- Tabla: tareas (Kanban)
-- ============================================================
CREATE TABLE tareas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id    UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  usuario_id   UUID REFERENCES usuarios(id) ON DELETE SET NULL,  -- dueño
  descripcion  TEXT NOT NULL,
  rol_asociado rol_nombre NOT NULL,
  estado       estado_kanban NOT NULL DEFAULT 'backlog',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER tareas_updated_at BEFORE UPDATE ON tareas
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- ============================================================
-- Tabla: insignias
-- ============================================================
CREATE TABLE insignias (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_competencia TEXT NOT NULL,
  otorgada_en      DATE NOT NULL DEFAULT CURRENT_DATE,
  equipo_origen_id UUID REFERENCES equipos(id) ON DELETE SET NULL
);

-- ============================================================
-- Tabla: checkins (Daily check-in asincrónico)
-- ============================================================
CREATE TABLE checkins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  equipo_id  UUID NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  resumen    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS) – Seguridad a nivel de fila
-- ============================================================
ALTER TABLE usuarios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE catedras        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscripciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE desafios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipo_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE insignias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins        ENABLE ROW LEVEL SECURITY;

-- Un usuario puede leer su propio perfil
CREATE POLICY "usuarios: leer propio perfil"
  ON usuarios FOR SELECT
  USING (auth.uid() = id);

-- Un usuario puede actualizar su propio perfil
CREATE POLICY "usuarios: actualizar propio perfil"
  ON usuarios FOR UPDATE
  USING (auth.uid() = id);

-- Los estudiantes pueden leer perfiles públicos (marketplace)
CREATE POLICY "usuarios: perfiles publicos"
  ON usuarios FOR SELECT
  USING (tipo = 'estudiante');

-- Los docentes pueden ver todas las cátedras que crearon
CREATE POLICY "catedras: docente puede ver sus catedras"
  ON catedras FOR ALL
  USING (auth.uid() = docente_id);

-- Los estudiantes pueden ver cátedras activas
CREATE POLICY "catedras: estudiantes ven activas"
  ON catedras FOR SELECT
  USING (activa = true);

-- Índices para performance
CREATE INDEX idx_inscripciones_catedra    ON inscripciones(catedra_id);
CREATE INDEX idx_inscripciones_usuario    ON inscripciones(usuario_id);
CREATE INDEX idx_tareas_equipo            ON tareas(equipo_id);
CREATE INDEX idx_tareas_estado            ON tareas(estado);
CREATE INDEX idx_equipo_miembros_equipo   ON equipo_miembros(equipo_id);
CREATE INDEX idx_desafios_catedra         ON desafios(catedra_id);
