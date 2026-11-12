"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive } from "@/components/icons/phosphor/exports/Archive";
import { CaretRight } from "@/components/icons/phosphor/exports/CaretRight";
import { CircleNotch } from "@/components/icons/phosphor/exports/CircleNotch";
import { ClipboardText } from "@/components/icons/phosphor/exports/ClipboardText";
import { Files } from "@/components/icons/phosphor/exports/Files";
import { MagnifyingGlass } from "@/components/icons/phosphor/exports/MagnifyingGlass";
import { Package } from "@/components/icons/phosphor/exports/Package";
import { Plus } from "@/components/icons/phosphor/exports/Plus";
import { Trash } from "@/components/icons/phosphor/exports/Trash";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { MechanicalValue } from "@/components/ui/MechanicalValue";

type Kit = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  source_dfd_id?: string | null;
  source_protocol?: string | null;
  is_active?: boolean | null;
  classe_id?: string | null;
  created_at?: string | null;
};

type CatalogItem = {
  id: number | string;
  codigo_efisco?: string | null;
  descricao?: string | null;
  tipo?: string | null;
  categoria?: string | null;
  grupo?: string | null;
  classe?: string | null;
  gnd_preferencial?: string | null;
  unidade_medida?: string | null;
};

type KitItem = {
  id: string;
  kit_id: string;
  item_id: number | string;
  quantidade?: number | null;
  quantidade_sugerida?: number | null;
  catalogo?: CatalogItem | null;
};

const CATEGORIES = [
  "Geral",
  "Gestao",
  "Ensino",
  "Pesquisa",
  "Extensao",
  "Administrativo",
  "Laboratorio",
  "TI",
  "Manutencao",
];

export default function KitsAdminPage() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [kitItems, setKitItems] = useState<KitItem[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [seedingCusteio, setSeedingCusteio] = useState(false);

  const fetchKits = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("kits")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setKits((data || []) as Kit[]);
      if (!selectedKit && data?.[0]) {
        await openKitEditor(data[0] as Kit);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar modelos de DFD: " + (error?.message || "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalItems = kitItems.length;
  const totalQuantity = useMemo(
    () => kitItems.reduce((sum, item) => sum + getKitItemQuantity(item), 0),
    [kitItems],
  );
  const completeness = useMemo(() => {
    if (!selectedKit) return 0;
    let score = 0;
    if (selectedKit.nome?.trim()) score += 35;
    if (selectedKit.descricao?.trim()) score += 35;
    if (kitItems.length > 0) score += 30;
    return score;
  }, [kitItems.length, selectedKit]);

  const handleDeleteKit = async (id: string) => {
    const { error } = await supabase.from("kits").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Modelo removido.");
    setSelectedKit(null);
    setKitItems([]);
    await fetchKits();
  };

  const handleSeedCusteioKits = async () => {
    setSeedingCusteio(true);
    try {
      const response = await fetch("/api/admin/kits/seed-custeio", {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Falha ao montar kits de custeio.");
      }

      const totalItems = Array.isArray(payload?.results)
        ? payload.results.reduce((sum: number, row: any) => sum + Number(row.insertedItems || 0), 0)
        : 0;
      toast.success(`Kits de custeio montados com ${totalItems} item(ns) do catálogo.`);
      await fetchKits();
    } catch (error: any) {
      toast.error("Erro ao montar kits de custeio: " + (error?.message || "erro desconhecido"));
    } finally {
      setSeedingCusteio(false);
    }
  };

  async function openKitEditor(kit: Kit) {
    setSelectedKit(kit);
    setSearch("");
    setSearchResults([]);
    const response = await fetch(`/api/admin/kits/items?kitId=${encodeURIComponent(kit.id)}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error("Erro ao carregar itens do modelo: " + (payload?.error || "erro desconhecido"));
      setKitItems([]);
      return;
    }
    setKitItems((payload?.items || []) as KitItem[]);
  }

  const updateSelectedKit = async (patch: Partial<Kit>) => {
    if (!selectedKit) return;
    const next = { ...selectedKit, ...patch };
    setSelectedKit(next);
    setKits((prev) => prev.map((kit) => (kit.id === next.id ? next : kit)));

    const { error } = await supabase
      .from("kits")
      .update({
        nome: next.nome,
        descricao: next.descricao,
        categoria: next.categoria || "Geral",
      })
      .eq("id", next.id);
    if (error) toast.error("Erro ao salvar modelo: " + error.message);
  };

  const searchItems = async (query: string) => {
    setSearch(query);
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }

    const params = new URLSearchParams({
      q: query,
      category: "all",
      limit: "12",
      context: "admin-kits",
    });
    const response = await fetch(`/api/catalog-search?${params.toString()}`);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error("Erro na busca do catálogo: " + (payload?.error || "erro desconhecido"));
      return;
    }
    setSearchResults((payload?.items || []) as CatalogItem[]);
  };

  const addItemToKit = async (item: CatalogItem) => {
    if (!selectedKit) return;

    const response = await fetch("/api/admin/kits/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kitId: selectedKit.id,
        codigoEfisco: item.codigo_efisco,
        quantidade: 1,
      }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(payload?.error || "Item já existe no modelo ou houve erro ao adicionar.");
      return;
    }

    toast.success("Item adicionado ao modelo de DFD.");
    setSearch("");
    setSearchResults([]);
    await openKitEditor(selectedKit);
  };

  const updateItemQuantity = async (item: KitItem, quantity: number) => {
    if (!selectedKit) return;
    const nextQuantity = Math.max(1, Math.floor(Number(quantity || 1)));
    setKitItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, quantidade: nextQuantity } : row)),
    );
    const { error } = await supabase
      .from("kit_items")
      .update({ quantidade: nextQuantity })
      .eq("id", item.id);
    if (error) toast.error("Erro ao atualizar quantidade: " + error.message);
  };

  const removeItemFromKit = async (item: KitItem) => {
    if (!selectedKit) return;
    const { error } = await supabase.from("kit_items").delete().eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await openKitEditor(selectedKit);
  };

  return (
    <div className="mx-auto max-w-[1800px] space-y-5 bg-[var(--p-color-bg-muted)] px-3 py-5 md:px-5">
      <section className="rounded-[20px] border border-[var(--p-color-info-border)] bg-[var(--p-color-info-bg)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="type-kicker font-semibold uppercase tracking-[0.18em] text-[var(--p-color-brand-400)]">
              Modelos de DFD
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--p-color-fg)]">
              Kits como DFDs pré-prontas
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--p-color-fg-muted)]">
              Kits agora nascem de DFDs reais. Abra uma DFD pronta e use a ação "Marcar como kit" para reaproveitar objeto, justificativa e itens.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSeedCusteioKits}
              disabled={seedingCusteio}
              className="inline-flex h-11 items-center rounded-xl border border-[var(--p-color-info-border)] bg-white px-4 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-info-bg)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {seedingCusteio ? (
                <CircleNotch size={16} className="mr-2 animate-spin" />
              ) : (
                <Package size={16} weight="bold" className="mr-2" />
              )}
              Kits de custeio
            </button>
            <Link
              href="/admin/consolidacao"
              className="inline-flex h-11 items-center rounded-xl bg-[var(--p-color-brand-500)] px-5 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-[var(--p-color-brand-600)]"
            >
              <Files size={16} weight="bold" className="mr-2" />
              Escolher DFD
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4">
        <aside className="rounded-[20px] border border-[var(--p-color-border)] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--p-color-brand-500)]">
              Biblioteca
            </h2>
            <span className="rounded-full bg-[var(--p-color-info-bg)] px-2.5 py-1 type-kicker font-semibold text-[var(--p-color-brand-500)]">
              {kits.length}
            </span>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {loading ? (
              <div className="rounded-2xl border border-dashed border-[var(--p-color-border)] p-5 text-sm text-[var(--p-color-fg-muted)]">
                Carregando modelos...
              </div>
            ) : kits.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--p-color-border)] p-6 text-center">
                <Archive size={28} className="mx-auto text-[var(--p-color-fg-subtle)]" />
                <p className="mt-2 text-sm font-semibold text-[var(--p-color-brand-500)]">
                  Nenhum modelo criado
                </p>
                <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                  Abra uma DFD existente e marque como kit para criar o primeiro modelo.
                </p>
              </div>
            ) : (
              kits.map((kit) => (
                <button
                  key={kit.id}
                  type="button"
                  onClick={() => openKitEditor(kit)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedKit?.id === kit.id
                      ? "border-[var(--p-color-brand-500)] bg-[var(--p-color-info-bg)]"
                      : "border-[var(--p-color-border-muted)] bg-white hover:bg-[var(--p-color-info-bg)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="type-kicker font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
                        {kit.source_protocol || kit.categoria || "Geral"}
                      </p>
                      <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-tight text-[var(--p-color-fg)]">
                        {kit.nome}
                      </h3>
                    </div>
                    <CaretRight size={16} weight="bold" className="mt-1 shrink-0 text-[var(--p-color-fg-subtle)]" />
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="min-h-[680px] rounded-[20px] border border-[var(--p-color-border)] bg-white shadow-sm">
          {!selectedKit ? (
            <div className="flex h-full min-h-[520px] flex-col items-center justify-center p-10 text-center">
              <Package size={56} weight="duotone" className="text-[var(--p-color-fg-subtle)]" />
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--p-color-brand-500)]">
                Selecione um modelo
              </h3>
              <p className="mt-1 max-w-md text-sm text-[var(--p-color-fg-muted)]">
                O kit deve funcionar como uma DFD pre-preenchida, com objeto, finalidade e itens sugeridos.
              </p>
            </div>
          ) : (
            <div className="grid min-h-[680px] grid-cols-1">
              <section className="space-y-5 p-5 md:p-6">
                <div className="rounded-2xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--p-color-info-bg)] text-[var(--p-color-brand-500)]">
                        <ClipboardText size={22} weight="duotone" />
                      </div>
                      <div>
                        <p className="type-kicker font-semibold uppercase tracking-[0.16em] text-[var(--p-color-fg-subtle)]">
                          Documento modelo {selectedKit.source_protocol ? `· ${selectedKit.source_protocol}` : ""}
                        </p>
                        <h2 className="text-xl font-semibold tracking-tight text-[var(--p-color-fg)]">
                          Estrutura da DFD
                        </h2>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteKit(selectedKit.id)}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 type-kicker font-semibold uppercase tracking-[0.12em] text-red-600 hover:bg-red-100"
                    >
                      <Trash size={14} />
                      Remover
                    </button>
                  </div>

                  <div className="mt-5 grid gap-4">
                    <Field label="Objeto da contratacao">
                      <input
                        value={selectedKit.nome || ""}
                        onChange={(event) =>
                          setSelectedKit({ ...selectedKit, nome: event.target.value })
                        }
                        onBlur={() => updateSelectedKit({ nome: selectedKit.nome })}
                        className="h-11 w-full rounded-xl border border-[var(--p-color-border)] bg-white px-3 text-sm font-semibold text-[var(--p-color-fg)] outline-none focus:border-[var(--p-color-brand-500)]"
                      />
                    </Field>
                    <Field label="Justificativa / finalidade padrao">
                      <textarea
                        value={selectedKit.descricao || ""}
                        onChange={(event) =>
                          setSelectedKit({ ...selectedKit, descricao: event.target.value })
                        }
                        onBlur={() => updateSelectedKit({ descricao: selectedKit.descricao || null })}
                        rows={9}
                        placeholder="Explique quando este modelo deve ser usado e qual necessidade atende."
                        className="w-full resize-none rounded-xl border border-[var(--p-color-border)] bg-white px-3 py-3 text-sm text-[var(--p-color-fg)] outline-none focus:border-[var(--p-color-brand-500)]"
                      />
                    </Field>
                    <Field label="Categoria operacional">
                      <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((category) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => updateSelectedKit({ categoria: category })}
                            className={`h-9 rounded-xl border px-3 type-kicker font-semibold uppercase tracking-[0.12em] ${
                              selectedKit.categoria === category
                                ? "border-[var(--p-color-brand-500)] bg-[var(--p-color-brand-500)] text-white"
                                : "border-[var(--p-color-border)] bg-white text-[var(--p-color-brand-500)] hover:bg-[var(--p-color-info-bg)]"
                            }`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--p-color-border-muted)] bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="type-kicker font-semibold uppercase tracking-[0.16em] text-[var(--p-color-fg-subtle)]">
                        Itens pre-preenchidos
                      </p>
                      <h2 className="text-xl font-semibold tracking-tight text-[var(--p-color-brand-500)]">
                        Composicao do modelo
                      </h2>
                    </div>
                    <span className="rounded-full bg-[var(--p-color-info-bg)] px-3 py-1 type-kicker font-semibold uppercase tracking-[0.12em] text-[var(--p-color-brand-500)]">
                      {totalItems} itens / {totalQuantity} un.
                    </span>
                  </div>

                  <div className="relative mt-4">
                    <MagnifyingGlass
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--p-color-fg-subtle)]"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Adicionar item do catalogo por descricao ou codigo e-Fisco"
                      value={search}
                      onChange={(event) => searchItems(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[var(--p-color-border)] bg-[var(--p-color-bg-elevated)] pl-10 pr-3 text-sm outline-none focus:border-[var(--p-color-brand-500)] focus:bg-white"
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-[var(--p-color-border)] bg-white p-2 shadow-xl">
                        {searchResults.map((item) => (
                          <button
                            key={String(item.id)}
                            type="button"
                            onClick={() => addItemToKit(item)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left hover:bg-[var(--p-color-info-bg)]"
                          >
                            <span className="min-w-0">
                              <span className="block type-kicker font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">
                                {item.codigo_efisco || "Sem codigo"} · {item.tipo || item.categoria || "Catalogo"}
                              </span>
                              <span className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--p-color-fg)]">
                                {item.descricao || "Item sem descricao"}
                              </span>
                            </span>
                            <Plus size={18} className="shrink-0 text-[var(--p-color-brand-500)]" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--p-color-border-muted)]">
                    {kitItems.length === 0 ? (
                      <div className="flex min-h-[220px] flex-col items-center justify-center bg-[var(--p-color-bg-elevated)] p-8 text-center">
                        <Files size={36} weight="duotone" className="text-[var(--p-color-fg-subtle)]" />
                        <p className="mt-3 text-sm font-semibold text-[var(--p-color-brand-500)]">
                          Modelo sem itens
                        </p>
                        <p className="mt-1 text-xs text-[var(--p-color-fg-muted)]">
                          Adicione itens para que este kit funcione como uma DFD pre-pronta.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--p-color-border-muted)]">
                        {kitItems.map((item, index) => (
                          <div key={item.id} className="grid gap-3 p-3 lg:grid-cols-[44px_minmax(0,1fr)_120px_44px] lg:items-center">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--p-color-info-bg)] text-xs font-semibold text-[var(--p-color-brand-500)]">
                              {index + 1}
                            </div>
                            <div className="min-w-0">
                              <p className="type-kicker font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">
                                {item.catalogo?.codigo_efisco || "Sem codigo"} · {item.catalogo?.unidade_medida || "UN"}
                              </p>
                              <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--p-color-fg)]">
                                {item.catalogo?.descricao || "Item sem descricao"}
                              </p>
                            </div>
                            <div>
                              <label className="type-micro font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">
                                Qtd.
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={getKitItemQuantity(item)}
                                onChange={(event) => updateItemQuantity(item, Number(event.target.value))}
                                className="mt-1 h-9 w-full rounded-xl border border-[var(--p-color-border)] bg-white px-2 text-center text-sm font-semibold text-[var(--p-color-brand-500)] outline-none focus:border-[var(--p-color-brand-500)]"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItemFromKit(item)}
                              className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--p-color-border-strong)] hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash size={17} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <aside className="border-t border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] p-5">
                <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                  <div className="rounded-2xl border border-[var(--p-color-border)] bg-white p-4 shadow-sm">
                    <p className="type-kicker font-semibold uppercase tracking-[0.16em] text-[var(--p-color-fg-subtle)]">
                      Prontidao do modelo
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--p-color-brand-500)]">
                      {completeness}%
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--p-color-info-bg)]">
                      <div className="h-full rounded-full bg-[var(--p-color-brand-500)]" style={{ width: `${completeness}%` }} />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[var(--p-color-fg-muted)]">
                      Um modelo completo precisa manter o objeto, a justificativa e os itens herdados da DFD original.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[var(--p-color-border)] bg-white p-4 shadow-sm">
                    <p className="type-kicker font-semibold uppercase tracking-[0.16em] text-[var(--p-color-fg-subtle)]">
                      Previa da DFD
                    </p>
                    <h3 className="mt-2 text-lg font-semibold leading-tight text-[var(--p-color-fg)]">
                      {selectedKit.nome || "Objeto nao informado"}
                    </h3>
                    <p className="mt-2 line-clamp-5 text-xs leading-5 text-[var(--p-color-fg-muted)]">
                      {selectedKit.descricao || "Justificativa padrao ainda nao informada."}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <PreviewStat label="Itens" value={String(totalItems)} />
                      <PreviewStat label="Qtd." value={String(totalQuantity)} />
                      <PreviewStat label="Categoria" value={selectedKit.categoria || "Geral"} />
                      <PreviewStat label="Origem" value={selectedKit.source_protocol || "DFD"} />
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block type-kicker font-semibold uppercase tracking-[0.14em] text-[var(--p-color-fg-subtle)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  const shouldAnimateValue = /\d/.test(value);

  return (
    <div className="rounded-xl border border-[var(--p-color-border-muted)] bg-[var(--p-color-bg-elevated)] px-3 py-2">
      <p className="type-micro font-semibold uppercase tracking-[0.12em] text-[var(--p-color-fg-subtle)]">
        {label}
      </p>
      <p className="mt-1 min-w-0 overflow-visible text-xs font-semibold text-[var(--p-color-brand-500)]">
        {shouldAnimateValue ? <MechanicalValue value={value} /> : value}
      </p>
    </div>
  );
}

function getKitItemQuantity(item: KitItem) {
  return Math.max(1, Number(item.quantidade ?? item.quantidade_sugerida ?? 1));
}
