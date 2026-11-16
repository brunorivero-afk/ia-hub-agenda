-- IA Hub Agenda — Bloqueio de horário por sócio (2026-11-16)
-- Pessoal: sem motivo (os outros veem só "Indisponível"). Profissional: motivo obrigatório.
CREATE TABLE IF NOT EXISTS agenda_bloqueios (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  membro_id integer NOT NULL REFERENCES agenda_membros(id) ON DELETE CASCADE,
  membro_nome text NOT NULL,
  data date NOT NULL,
  hora_inicio text NOT NULL,
  hora_fim text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('pessoal','profissional')),
  motivo text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT bloqueio_motivo CHECK (
    (tipo = 'pessoal' AND motivo IS NULL) OR
    (tipo = 'profissional' AND coalesce(trim(motivo), '') <> '')
  )
);

ALTER TABLE agenda_bloqueios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agenda_bloqueios_open" ON agenda_bloqueios;
CREATE POLICY "agenda_bloqueios_open" ON agenda_bloqueios FOR ALL USING (true) WITH CHECK (true);
