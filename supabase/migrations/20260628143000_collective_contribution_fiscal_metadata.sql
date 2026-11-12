ALTER TABLE public.dfd_collective_contributions
  ADD COLUMN IF NOT EXISTS efisco_item_id BIGINT REFERENCES efisco_core.itens(id),
  ADD COLUMN IF NOT EXISTS efisco_item_natureza_id BIGINT REFERENCES efisco_core.item_naturezas(id),
  ADD COLUMN IF NOT EXISTS natureza_count INTEGER,
  ADD COLUMN IF NOT EXISTS has_mixed_expense_classes BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_missing_natureza BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_natureza_review BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_dfd_collective_contributions_efisco_item_id
  ON public.dfd_collective_contributions (efisco_item_id);

CREATE INDEX IF NOT EXISTS idx_dfd_collective_contributions_requires_natureza_review
  ON public.dfd_collective_contributions (requires_natureza_review)
  WHERE requires_natureza_review;
