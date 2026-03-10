-- ============================================================
-- CCS · Migración 006: Fix Políticas RLS Final (v3.2)
-- ============================================================

-- 0. FUNCIONES DE AYUDA (Security Definer para evitar recursión RLS)
-- Estas funciones corren con privilegios de sistema para evadir el bucle de políticas.

CREATE OR REPLACE FUNCTION public.check_es_docente_de_equipo(p_equipo_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.equipos e
        JOIN public.desafios d ON d.id = e.desafio_id
        JOIN public.catedras c ON c.id = d.catedra_id
        WHERE e.id = p_equipo_id
          AND c.docente_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_es_miembro_de_equipo(p_equipo_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.equipo_miembros em
        WHERE em.equipo_id = p_equipo_id
          AND em.usuario_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Asegurar que la columna 'iniciado' existe
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='equipos' AND column_name='iniciado') THEN
        ALTER TABLE equipos ADD COLUMN iniciado BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 1. Limpieza total de políticas previas (para evitar conflictos de nombres)
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('desafios', 'equipos', 'equipo_miembros', 'tareas', 'inscripciones', 'solicitudes_equipo')) 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. Políticas para DESAFIOS
CREATE POLICY "desafios_select" ON desafios FOR SELECT USING (true);
CREATE POLICY "desafios_all_docente" ON desafios FOR ALL USING (
    EXISTS (SELECT 1 FROM catedras WHERE id = desafios.catedra_id AND docente_id = auth.uid())
);

-- 3. Políticas para EQUIPOS
CREATE POLICY "equipos_select" ON equipos FOR SELECT USING (true);

CREATE POLICY "equipos_insert_estudiante" ON equipos FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM desafios d
        JOIN inscripciones i ON i.catedra_id = d.catedra_id
        WHERE d.id = equipos.desafio_id AND i.usuario_id = auth.uid()
    )
);

CREATE POLICY "equipos_update_docente" ON equipos FOR UPDATE USING (
    check_es_docente_de_equipo(id, auth.uid())
);

CREATE POLICY "equipos_update_miembro" ON equipos FOR UPDATE USING (
    check_es_miembro_de_equipo(id, auth.uid())
);

-- 4. Políticas para EQUIPO_MIEMBROS
CREATE POLICY "equipo_miembros_select" ON equipo_miembros FOR SELECT USING (true);

CREATE POLICY "equipo_miembros_insert_self" ON equipo_miembros FOR INSERT WITH CHECK (
    usuario_id = auth.uid()
);

CREATE POLICY "equipo_miembros_all_docente" ON equipo_miembros FOR ALL USING (
    check_es_docente_de_equipo(equipo_id, auth.uid())
);

CREATE POLICY "equipo_miembros_all_self" ON equipo_miembros FOR ALL USING (
    usuario_id = auth.uid()
);

-- 5. Políticas para TAREAS
CREATE POLICY "tareas_select" ON tareas FOR SELECT USING (true);

CREATE POLICY "tareas_all_miembro" ON tareas FOR ALL USING (
    check_es_miembro_de_equipo(equipo_id, auth.uid())
);

CREATE POLICY "tareas_all_docente" ON tareas FOR ALL USING (
    check_es_docente_de_equipo(equipo_id, auth.uid())
);

-- 6. Políticas para INSCRIPCIONES
CREATE POLICY "inscripciones_select" ON inscripciones FOR SELECT USING (true);
CREATE POLICY "inscripciones_insert_self" ON inscripciones FOR INSERT WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "inscripciones_all_docente" ON inscripciones FOR ALL USING (
    EXISTS (SELECT 1 FROM catedras WHERE id = inscripciones.catedra_id AND docente_id = auth.uid())
);

-- 7. Políticas para SOLICITUDES_EQUIPO
ALTER TABLE solicitudes_equipo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "solicitudes_select" ON solicitudes_equipo FOR SELECT USING (usuario_id = auth.uid() OR remitente_id = auth.uid());
CREATE POLICY "solicitudes_insert" ON solicitudes_equipo FOR INSERT WITH CHECK (remitente_id = auth.uid());
CREATE POLICY "solicitudes_update" ON solicitudes_equipo FOR UPDATE USING (usuario_id = auth.uid());
