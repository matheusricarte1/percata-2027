# Sessão de Análise com Python/Pandas

Script disponível em:
- `scripts/analise_consolidacao_pandas.py`

## Pré-requisitos
- Variáveis no `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Python com bibliotecas:
  - `pandas`
  - `requests`

Instalação:

```bash
pip install pandas requests
```

## Execução

```bash
python scripts/analise_consolidacao_pandas.py
```

Com parâmetros:

```bash
python scripts/analise_consolidacao_pandas.py --status aprovada --out scratch/analises_pandas
```

## Saídas geradas

- `analise_itens_detalhado.csv`
- `analise_por_servidor.csv`
- `analise_por_departamento_laboratorio.csv`
- `analise_por_grupo_classe_tipo.csv`
- `analise_por_codigo_efisco.csv`

Todas são gravadas em `scratch/analises_pandas` (ou no diretório indicado em `--out`).

