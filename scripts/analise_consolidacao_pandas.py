#!/usr/bin/env python3
"""
Sessão de análise de consolidação com Python + Pandas para o PERCATA.

Gera recortes analíticos a partir de DFDs aprovadas:
- Itens detalhados consolidados
- Visão por servidor solicitante
- Visão por departamento/laboratório (local de uso)
- Visão por grupo/classe/tipo
- Visão por código e-fisco

Uso:
  python scripts/analise_consolidacao_pandas.py
  python scripts/analise_consolidacao_pandas.py --status aprovada --out scratch/analises_pandas
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Dict, Iterable, List

import requests

try:
    import pandas as pd
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Pandas não encontrado. Instale com: pip install pandas requests"
    ) from exc


def load_env_file(env_path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    if not env_path.exists():
        return env

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def chunked(values: List[str], size: int) -> Iterable[List[str]]:
    for i in range(0, len(values), size):
        yield values[i : i + size]


class SupabaseRest:
    def __init__(self, url: str, service_key: str):
        self.base = url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

    def fetch(self, table: str, select: str, filters: Dict[str, str] | None = None) -> List[Dict]:
        filters = filters or {}
        all_rows: List[Dict] = []
        offset = 0
        limit = 1000

        while True:
            params = {"select": select, "limit": str(limit), "offset": str(offset), **filters}
            resp = requests.get(
                f"{self.base}/rest/v1/{table}",
                headers=self.headers,
                params=params,
                timeout=120,
            )
            if resp.status_code >= 300:
                raise RuntimeError(
                    f"Erro ao consultar {table} ({resp.status_code}): {resp.text}"
                )
            rows = resp.json()
            if not isinstance(rows, list):
                raise RuntimeError(f"Resposta inesperada de {table}: {rows}")

            all_rows.extend(rows)
            if len(rows) < limit:
                break
            offset += limit

        return all_rows


def derive_tipo_from_gnd(gnd: str | None) -> str:
    value = str(gnd or "").strip()
    if value.startswith("3.3.90.39"):
        return "Serviço"
    return "Material"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--status", default="aprovada")
    parser.add_argument("--out", default="scratch/analises_pandas")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parents[1]
    env_local = load_env_file(project_root / ".env.local")
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or env_local.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or env_local.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        raise RuntimeError(
            "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env.local"
        )

    out_dir = (project_root / args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    client = SupabaseRest(supabase_url, service_key)

    print("Carregando DFDs...")
    dfds = client.fetch(
        "dfds",
        "id,numero_protocolo,status,created_at,campus,campus_id,solicitante_id,unidade_id,tipo_unidade,objeto_contratacao,valor_total_estimado",
        {"status": f"eq.{args.status}"},
    )
    if not dfds:
        print("Nenhuma DFD encontrada para o status informado.")
        return

    df_dfds = pd.DataFrame(dfds)
    dfd_ids = df_dfds["id"].dropna().astype(str).unique().tolist()
    solicitante_ids = (
        df_dfds["solicitante_id"].dropna().astype(str).unique().tolist()
        if "solicitante_id" in df_dfds.columns
        else []
    )

    print("Carregando perfis...")
    profiles_rows: List[Dict] = []
    for id_chunk in chunked(solicitante_ids, 150):
        profiles_rows.extend(
            client.fetch(
                "profiles",
                "id,full_name,email",
                {"id": f"in.({','.join(id_chunk)})"},
            )
        )
    df_profiles = pd.DataFrame(profiles_rows) if profiles_rows else pd.DataFrame(columns=["id", "full_name", "email"])

    print("Carregando departamentos/laboratórios...")
    departamentos = client.fetch("departamentos", "id,nome")
    laboratorios = client.fetch("laboratorios", "id,nome")
    dept_map = {str(row.get("id")): str(row.get("nome") or "").strip() for row in departamentos}
    lab_map = {str(row.get("id")): str(row.get("nome") or "").strip() for row in laboratorios}

    def resolve_unidade(row: pd.Series) -> str:
        unit_id = str(row.get("unidade_id") or "").strip()
        if not unit_id:
            return ""
        tipo = str(row.get("tipo_unidade") or "").strip().lower()
        if tipo == "departamento":
            return dept_map.get(unit_id, "")
        if tipo == "laboratorio":
            return lab_map.get(unit_id, "")
        return dept_map.get(unit_id, "") or lab_map.get(unit_id, "")

    if not df_profiles.empty:
        profile_name = df_profiles.set_index("id")["full_name"].fillna(df_profiles.set_index("id")["email"]).to_dict()
        profile_email = df_profiles.set_index("id")["email"].to_dict()
    else:
        profile_name = {}
        profile_email = {}

    df_dfds["solicitante_nome"] = df_dfds["solicitante_id"].map(profile_name).fillna("Usuário")
    df_dfds["solicitante_email"] = df_dfds["solicitante_id"].map(profile_email).fillna("")
    df_dfds["unidade_nome"] = df_dfds.apply(resolve_unidade, axis=1)

    print("Carregando itens das DFDs...")
    item_rows: List[Dict] = []
    for id_chunk in chunked(dfd_ids, 120):
        filter_expr = f"in.({','.join(id_chunk)})"
        try:
            item_rows.extend(
                client.fetch(
                    "dfd_items",
                    "id,dfd_id,codigo_tce,descricao,quantidade,valor_unitario_estimado,gnd,criticidade,moscow_categoria,local_uso,is_highlight_item",
                    {"dfd_id": filter_expr},
                )
            )
        except RuntimeError:
            item_rows.extend(
                client.fetch(
                    "dfd_items",
                    "id,dfd_id,codigo_tce,descricao,quantidade,valor_unitario_estimado,gnd,is_highlight_item",
                    {"dfd_id": filter_expr},
                )
            )

    if not item_rows:
        print("As DFDs encontradas não possuem itens.")
        return

    df_items = pd.DataFrame(item_rows)
    df_items["codigo_tce"] = df_items["codigo_tce"].astype(str).str.strip()
    df_items["descricao"] = df_items["descricao"].fillna("Descrição não informada")
    df_items["quantidade"] = pd.to_numeric(df_items["quantidade"], errors="coerce").fillna(0.0)
    df_items["valor_unitario_estimado"] = pd.to_numeric(
        df_items["valor_unitario_estimado"], errors="coerce"
    ).fillna(0.0)
    df_items["valor_total_item"] = df_items["quantidade"] * df_items["valor_unitario_estimado"]

    codigo_list = (
        df_items["codigo_tce"].dropna().astype(str).str.strip().loc[lambda s: s != ""].unique().tolist()
    )
    catalog_rows: List[Dict] = []
    for code_chunk in chunked(codigo_list, 250):
        catalog_rows.extend(
            client.fetch(
                "catalogo",
                "codigo_efisco,grupo,classe,tipo",
                {"codigo_efisco": f"in.({','.join(code_chunk)})"},
            )
        )
    df_catalog = pd.DataFrame(catalog_rows) if catalog_rows else pd.DataFrame(columns=["codigo_efisco", "grupo", "classe", "tipo"])

    if not df_catalog.empty:
        df_catalog["codigo_efisco"] = df_catalog["codigo_efisco"].astype(str).str.strip()

    df = df_items.merge(
        df_dfds[
            [
                "id",
                "numero_protocolo",
                "campus",
                "campus_id",
                "solicitante_id",
                "solicitante_nome",
                "solicitante_email",
                "unidade_nome",
            ]
        ],
        left_on="dfd_id",
        right_on="id",
        how="left",
        suffixes=("", "_dfd"),
    )
    if not df_catalog.empty:
        df = df.merge(
            df_catalog[["codigo_efisco", "grupo", "classe", "tipo"]],
            left_on="codigo_tce",
            right_on="codigo_efisco",
            how="left",
        )
    else:
        df["grupo"] = ""
        df["classe"] = ""
        df["tipo"] = ""

    df["local_uso_final"] = df["local_uso"].fillna("").astype(str).str.strip()
    df.loc[df["local_uso_final"] == "", "local_uso_final"] = (
        df.loc[df["local_uso_final"] == "", "unidade_nome"].fillna("").astype(str)
    )
    df["tipo_final"] = df["tipo"].fillna("").astype(str).str.strip()
    df.loc[df["tipo_final"] == "", "tipo_final"] = df["gnd"].map(derive_tipo_from_gnd)
    df["grupo"] = df["grupo"].fillna("Sem Grupo").replace("", "Sem Grupo")
    df["classe"] = df["classe"].fillna("Sem Classe").replace("", "Sem Classe")

    total_dfds = df_dfds["id"].nunique()
    total_itens = len(df.index)
    total_codigos = df["codigo_tce"].nunique()
    total_valor = float(df["valor_total_item"].sum())
    print(f"DFDs analisadas: {total_dfds}")
    print(f"Itens analisados: {total_itens}")
    print(f"Códigos e-fisco: {total_codigos}")
    print(f"Valor total: R$ {total_valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))

    por_servidor = (
        df.groupby(["solicitante_email", "solicitante_nome"], dropna=False)
        .agg(
            dfds=("dfd_id", "nunique"),
            itens=("id", "count"),
            codigos=("codigo_tce", "nunique"),
            valor_total=("valor_total_item", "sum"),
        )
        .reset_index()
        .sort_values("valor_total", ascending=False)
    )

    por_local = (
        df.groupby(["local_uso_final"], dropna=False)
        .agg(
            dfds=("dfd_id", "nunique"),
            itens=("id", "count"),
            codigos=("codigo_tce", "nunique"),
            valor_total=("valor_total_item", "sum"),
        )
        .reset_index()
        .sort_values("valor_total", ascending=False)
    )

    por_taxonomia = (
        df.groupby(["grupo", "classe", "tipo_final"], dropna=False)
        .agg(
            itens=("id", "count"),
            codigos=("codigo_tce", "nunique"),
            valor_total=("valor_total_item", "sum"),
        )
        .reset_index()
        .sort_values("valor_total", ascending=False)
    )

    por_codigo = (
        df.groupby(["codigo_tce", "descricao"], dropna=False)
        .agg(
            dfds=("dfd_id", "nunique"),
            itens=("id", "count"),
            quantidade_total=("quantidade", "sum"),
            valor_total=("valor_total_item", "sum"),
            servidor_count=("solicitante_email", "nunique"),
            local_count=("local_uso_final", "nunique"),
        )
        .reset_index()
        .sort_values("valor_total", ascending=False)
    )

    detalhado_path = out_dir / "analise_itens_detalhado.csv"
    servidor_path = out_dir / "analise_por_servidor.csv"
    local_path = out_dir / "analise_por_departamento_laboratorio.csv"
    taxo_path = out_dir / "analise_por_grupo_classe_tipo.csv"
    codigo_path = out_dir / "analise_por_codigo_efisco.csv"

    df.to_csv(detalhado_path, index=False, encoding="utf-8-sig")
    por_servidor.to_csv(servidor_path, index=False, encoding="utf-8-sig")
    por_local.to_csv(local_path, index=False, encoding="utf-8-sig")
    por_taxonomia.to_csv(taxo_path, index=False, encoding="utf-8-sig")
    por_codigo.to_csv(codigo_path, index=False, encoding="utf-8-sig")

    print("\nArquivos gerados:")
    print(f"- {detalhado_path}")
    print(f"- {servidor_path}")
    print(f"- {local_path}")
    print(f"- {taxo_path}")
    print(f"- {codigo_path}")


if __name__ == "__main__":
    main()
