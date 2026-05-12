-- Atualiza estrutura institucional: desativa Salgueiro e cadastra os espaços de Ouricuri.
-- Salgueiro fica inativo para preservar histórico e chaves estrangeiras.

UPDATE public.campi
SET ativo = false
WHERE public.catalogo_normalize_text(nome) LIKE '%salgueiro%'
   OR public.catalogo_normalize_text(sigla) = 'slg';

INSERT INTO public.campi (nome, sigla, ativo)
VALUES ('Campus Ouricuri', 'OUR', true)
ON CONFLICT (sigla)
DO UPDATE SET nome = EXCLUDED.nome, ativo = true;

WITH ouricuri AS (
  SELECT id
  FROM public.campi
  WHERE sigla = 'OUR'
  LIMIT 1
),
setores(nome) AS (
  VALUES
    ('Direção'),
    ('Coordenação Administrativa e Planejamento'),
    ('Setor de Patrimônio'),
    ('Setor de Gestão de Pessoas'),
    ('Setor de Almoxarifado e Materiais'),
    ('Coordenação do Curso de Enfermagem'),
    ('Sala Docente'),
    ('Auditório'),
    ('Escolaridade'),
    ('Biblioteca'),
    ('Cantina'),
    ('Depósito de Materiais'),
    ('Espaço de Convivência Discente'),
    ('Sanitário Feminino'),
    ('Sanitário Masculino')
)
INSERT INTO public.departamentos (campus_id, nome, ativo)
SELECT ouricuri.id, setores.nome, true
FROM ouricuri
CROSS JOIN setores
WHERE NOT EXISTS (
  SELECT 1
  FROM public.departamentos d
  WHERE d.campus_id = ouricuri.id
    AND public.catalogo_normalize_text(d.nome) = public.catalogo_normalize_text(setores.nome)
);

WITH ouricuri AS (
  SELECT id
  FROM public.campi
  WHERE sigla = 'OUR'
  LIMIT 1
),
laboratorios(nome) AS (
  VALUES
    ('Laboratório de Ensino, Pesquisa, Extensão e Habilidades 01'),
    ('Laboratório de Ensino, Pesquisa, Extensão e Habilidades 02'),
    ('Laboratório de Ensino, Pesquisa e Extensão Multifuncional'),
    ('Laboratório de Ensino, Pesquisa e Extensão de Microbiologia e Parasitologia'),
    ('Laboratório de Ensino, Pesquisa e Extensão em Anatomofisiologia'),
    ('Laboratório de Ensino, Pesquisa e Extensão em Saúde, Ruralidades e Processos Psicossociais')
)
INSERT INTO public.laboratorios (campus_id, nome, ativo)
SELECT ouricuri.id, laboratorios.nome, true
FROM ouricuri
CROSS JOIN laboratorios
WHERE NOT EXISTS (
  SELECT 1
  FROM public.laboratorios l
  WHERE l.campus_id = ouricuri.id
    AND public.catalogo_normalize_text(l.nome) = public.catalogo_normalize_text(laboratorios.nome)
);

UPDATE public.departamentos d
SET ativo = true
FROM public.campi c
WHERE d.campus_id = c.id
  AND c.sigla = 'OUR';

UPDATE public.laboratorios l
SET ativo = true
FROM public.campi c
WHERE l.campus_id = c.id
  AND c.sigla = 'OUR';

NOTIFY pgrst, 'reload schema';
