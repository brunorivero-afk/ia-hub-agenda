-- IA Hub Agenda — Setup Supabase
-- Cole este bloco inteiro no SQL Editor do Supabase e execute

-- 1. Tabela de membros
CREATE TABLE IF NOT EXISTS agenda_membros (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  pin text NOT NULL,
  admin boolean DEFAULT false,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Tabela de eventos
CREATE TABLE IF NOT EXISTS agenda_eventos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  sala text NOT NULL,
  data date NOT NULL,
  hora_inicio text NOT NULL,
  hora_fim text NOT NULL,
  criador text NOT NULL,
  criador_id integer,
  descricao text,
  participantes jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

-- 3. Habilitar RLS e abrir acesso (app usa PIN próprio)
ALTER TABLE agenda_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agenda_membros_open" ON agenda_membros;
DROP POLICY IF EXISTS "agenda_eventos_open" ON agenda_eventos;

CREATE POLICY "agenda_membros_open" ON agenda_membros FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "agenda_eventos_open" ON agenda_eventos FOR ALL USING (true) WITH CHECK (true);

-- 4. Membros iniciais (PINs todos 1234 — Bruno altera pelo Admin depois)
INSERT INTO agenda_membros (nome, pin, admin, ativo) VALUES
  ('Bruno Rivéro',        '1234', true,  true),
  ('Diego Bastos',        '1234', false, true),
  ('Eduardo Lagrimante',  '1234', false, true),
  ('Vinicius Campanario', '1234', false, true),
  ('Rodrigo Martins',     '1234', false, true),
  ('Alex Salles',         '1234', false, true),
  ('Felipe de Biase',     '1234', false, true)
ON CONFLICT DO NOTHING;
