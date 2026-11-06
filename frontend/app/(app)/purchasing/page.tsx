"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, PackageCheck, Pencil, Plus, Send, Trash2, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Badge, EmptyState, PageHeader } from "@/components/ui/Bits";
import { Modal } from "@/components/ui/Modal";
import { api, describeApiError } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useShopSettings } from "@/hooks/useShopSettings";
import { useToast } from "@/components/Toast";
import { Select } from "@/components/ui/Select";
import { useProducts } from "@/hooks/useProducts";
import type { Supplier } from "@/lib/types";

interface ReorderGroup {
  supplierId: number | null;
  supplierName: string;
  items: { productId: number; name: string; stock: number; reorderPoint: number; unit: string | null; unitCost: number; suggestedQty: number }[];
}
interface PO {
  id: number;
  number: string;
  status: "DRAFT" | "SENT" | "RECEIVED" | "CANCELLED";
  totalCost: number;
  createdAt: string;
  supplier: { name: string };
  _count: { items: number };
}
interface PODetail extends PO {
  items: { id: number; productId: number; name: string; quantity: number; unitCost: number; receivedQty: number }[];
}

const tone = { DRAFT: "neutral", SENT: "brand", RECEIVED: "good", CANCELLED: "bad" } as const;
const statusLabel = {
  DRAFT: "Taslak",
  SENT: "Gönderildi",
  RECEIVED: "Mal Kabul Yapıldı",
  CANCELLED: "İptal Edildi",
} as const;

export default function PurchasingPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol ?? "₺";
  const { show } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"reorder" | "orders" | "suppliers">("reorder");
  const [receiving, setReceiving] = useState<number | null>(null);
  const [supplierDialog, setSupplierDialog] = useState<Supplier | "new" | null>(null);
  const [poDialog, setPoDialog] = useState(false);

  const { data: reorder = [] } = useQuery({ queryKey: ["reorder"], queryFn: () => api.get<ReorderGroup[]>("/purchasing/reorder") });
  const { data: orders = [] } = useQuery({ queryKey: ["pos"], queryFn: () => api.get<PO[]>("/purchasing/orders") });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get<Supplier[]>("/purchasing/suppliers") });

  const createPo = useMutation({
    mutationFn: (g: ReorderGroup) => api.post<PO>("/purchasing/orders", { supplierId: g.supplierId, items: g.items.map((i) => ({ productId: i.productId, quantity: i.suggestedQty, unitCost: i.unitCost })) }),
    onSuccess: (po) => { show(`${po.number} siparişi oluşturuldu`, "success"); qc.invalidateQueries({ queryKey: ["pos"] }); setTab("orders"); },
    onError: (e) => show(describeApiError(e, "Sipariş oluşturulamadı"), "error"),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.patch(`/purchasing/orders/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos"] }),
    onError: (e) => show(describeApiError(e, "İşlem başarısız oldu"), "error"),
  });

  return (
    <div>
      <PageHeader
        title="Satın Alma & Tedarikçiler"
        subtitle="Tedarikçi listesi, kritik stok sipariş tavsiyeleri ve satınalma siparişleri yönetimi."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSupplierDialog("new")}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Tedarikçi Ekle
            </Button>
            <Button onClick={() => setPoDialog(true)} disabled={suppliers.length === 0} title={suppliers.length === 0 ? "Önce bir tedarikçi ekleyin" : undefined}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Yeni Sipariş
            </Button>
          </div>
        }
      />
      <div role="tablist" aria-label="Satın alma sekmeleri" className="mb-4 inline-flex rounded-xl border border-border bg-surface p-1">
        {([["reorder", `Sipariş Önerileri (${reorder.reduce((n, g) => n + g.items.length, 0)})`], ["orders", "Satınalma Siparişleri"], ["suppliers", "Tedarikçiler"]] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-lg px-3.5 py-1.5 text-sm font-medium ${tab === k ? "bg-brand text-brand-foreground" : "text-foreground-muted hover:text-foreground"}`}>{label}</button>
        ))}
      </div>

      {tab === "reorder" && (
        <div className="space-y-4">
          {reorder.length === 0 && <EmptyState icon={<PackageCheck className="h-8 w-8" />} title="Kritik seviyede ürün yok" hint="Stok sayfasında ürünlere 'Kritik Stok Eşiği' belirlediğinizde, stok azaldığında otomatik olarak burada görünür." />}
          {reorder.map((g) => (
            <section key={g.supplierName} className="rise card-surface p-5">
              <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold"><Truck className="h-4 w-4 text-foreground-muted" aria-hidden="true" />{g.supplierName}</h2>
                <Button disabled={!g.supplierId || createPo.isPending} title={g.supplierId ? undefined : "Önce bu ürünlere bir tedarikçi atayın"} onClick={() => createPo.mutate(g)}>Satınalma Siparişi Oluştur</Button>
              </header>
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-foreground-muted">
                  <tr>
                    <th className="py-1.5">Ürün Adı</th>
                    <th className="py-1.5 text-right">Mevcut Stok</th>
                    <th className="py-1.5 text-right">Kritik Eşik</th>
                    <th className="py-1.5 text-right">Önerilen Miktar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {g.items.map((i) => (
                    <tr key={i.productId}>
                      <td className="py-2 font-medium">{i.name}</td>
                      <td className="tabular py-2 text-right text-danger">{i.stock}</td>
                      <td className="tabular py-2 text-right">{i.reorderPoint}</td>
                      <td className="tabular py-2 text-right font-semibold">{i.suggestedQty}{i.unit ? ` ${i.unit}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}

      {tab === "orders" && (
        <div className="card-surface overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-foreground-muted">
              <tr>
                <th className="p-3">Sipariş No</th>
                <th className="p-3">Tedarikçi</th>
                <th className="p-3">Durum</th>
                <th className="p-3 text-right">Toplam Tutar</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="p-3 font-medium">
                    {o.number}
                    <div className="text-xs font-normal text-foreground-muted">{new Date(o.createdAt).toLocaleDateString("tr-TR")} · {o._count.items} kalem ürün</div>
                  </td>
                  <td className="p-3">{o.supplier.name}</td>
                  <td className="p-3"><Badge tone={tone[o.status]}>{statusLabel[o.status]}</Badge></td>
                  <td className="tabular p-3 text-right">{formatMoney(o.totalCost, sym)}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1.5">
                      <a href={`/api/purchasing/orders/${o.id}/pdf`} download title="PDF İndir">
                        <Button variant="ghost" aria-label={`${o.number} PDF İndir`}><FileDown className="h-4 w-4" aria-hidden="true" /></Button>
                      </a>
                      {o.status === "DRAFT" && (
                        <Button variant="secondary" onClick={() => setStatus.mutate({ id: o.id, status: "SENT" })}>
                          <Send className="h-4 w-4" aria-hidden="true" /> Gönderildi Yap
                        </Button>
                      )}
                      {(o.status === "DRAFT" || o.status === "SENT") && (
                        <Button
                          variant="ghost"
                          aria-label={`İptal et ${o.number}`}
                          title="Siparişi İptal Et"
                          onClick={() => { if (window.confirm(`${o.number} nolu siparişi iptal etmek istediğinize emin misiniz?`)) setStatus.mutate({ id: o.id, status: "CANCELLED" }); }}
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                      {(o.status === "DRAFT" || o.status === "SENT") && (
                        <Button onClick={() => setReceiving(o.id)}>
                          <PackageCheck className="h-4 w-4" aria-hidden="true" /> Mal Kabul
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <EmptyState title="Henüz satınalma siparişi bulunmuyor" />}
        </div>
      )}

      {tab === "suppliers" && (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s, i) => (
            <li key={s.id} className="rise card-surface p-4" style={{ "--i": i } as React.CSSProperties}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{s.name}</p>
                <button type="button" aria-label={`${s.name} düzenle`} title="Tedarikçiyi düzenle" onClick={() => setSupplierDialog(s)} className="text-foreground/40 hover:text-brand"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
              </div>
              <p className="text-sm text-foreground-muted">{[s.phone, s.email].filter(Boolean).join(" · ") || "İletişim bilgisi girilmedi"}</p>
              {s.gstin && <p className="mt-1 font-mono text-xs text-foreground-muted">VKN/TCKN: {s.gstin}</p>}
            </li>
          ))}
          {suppliers.length === 0 && <EmptyState title="Henüz tedarikçi eklenmedi" hint="Bir tedarikçi ekleyin, ardından Stok sayfasında ürünlerle eşleştirin." />}
        </ul>
      )}

      {supplierDialog && <SupplierDialog supplier={supplierDialog === "new" ? undefined : supplierDialog} onClose={() => setSupplierDialog(null)} />}
      {poDialog && <NewPoDialog suppliers={suppliers} onCreated={() => setTab("orders")} onClose={() => setPoDialog(false)} />}
      {receiving != null && <ReceiveDialog id={receiving} onClose={() => setReceiving(null)} />}
    </div>
  );
}

function SupplierDialog({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const qc = useQueryClient();
  const { show } = useToast();
  const [f, setF] = useState({ name: supplier?.name ?? "", phone: supplier?.phone ?? "", email: supplier?.email ?? "", address: supplier?.address ?? "", gstin: supplier?.gstin ?? "", notes: supplier?.notes ?? "" });
  const done = () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); qc.invalidateQueries({ queryKey: ["reorder"] }); qc.invalidateQueries({ queryKey: ["products"] }); onClose(); };
  const save = useMutation({
    mutationFn: () => (supplier ? api.put(`/purchasing/suppliers/${supplier.id}`, f) : api.post("/purchasing/suppliers", f)),
    onSuccess: () => { show(supplier ? "Tedarikçi bilgileri güncellendi" : "Yeni tedarikçi eklendi", "success"); done(); },
    onError: (e) => show(describeApiError(e, "Kaydedilemedi"), "error"),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/purchasing/suppliers/${supplier!.id}`),
    onSuccess: () => { show("Tedarikçi silindi", "success"); done(); },
    onError: (e) => show(describeApiError(e, "Silinemedi"), "error"),
  });
  return (
    <Modal title={supplier ? "Tedarikçiyi Düzenle" : "Yeni Tedarikçi Ekle"} onClose={onClose} size="sm">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <Field label="Tedarikçi / Firma Adı" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label="Telefon Numarası" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <Field label="E-posta Adresi" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Field label="Adres" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        <Field label="Vergi No / VKN / TCKN" value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} />
        <Field label="Özel Notlar" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <Button type="submit" disabled={save.isPending || !f.name.trim()}>{supplier ? "Değişiklikleri Kaydet" : "Tedarikçiyi Kaydet"}</Button>
        {supplier && (
          <Button type="button" variant="ghost" disabled={remove.isPending} onClick={() => { if (window.confirm(`"${supplier.name}" tedarikçisini silmek istediğinize emin misiniz? Bu tedarikçiye bağlı ürünler sahipsiz kalacaktır.`)) remove.mutate(); }}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Tedarikçiyi Sil
          </Button>
        )}
      </form>
    </Modal>
  );
}

interface PoLine { productId: number; name: string; quantity: string; unitCost: string }

function NewPoDialog({ suppliers, onCreated, onClose }: { suppliers: Supplier[]; onCreated: () => void; onClose: () => void }) {
  const qc = useQueryClient();
  const { show } = useToast();
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol ?? "₺";
  const [supplierId, setSupplierId] = useState(String(suppliers[0]?.id ?? ""));
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<PoLine[]>([]);
  const { data: products = [] } = useProducts(search);

  const total = lines.reduce((n, l) => n + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);
  const valid = supplierId !== "" && lines.length > 0 && lines.every((l) => Number(l.quantity) > 0 && Number(l.unitCost) >= 0 && l.unitCost !== "");
  const update = (id: number, patch: Partial<PoLine>) => setLines((ls) => ls.map((l) => (l.productId === id ? { ...l, ...patch } : l)));

  const create = useMutation({
    mutationFn: () => api.post<PO>("/purchasing/orders", { supplierId: Number(supplierId), notes: notes.trim() || undefined, items: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) })) }),
    onSuccess: (po) => { show(`${po.number} siparişi oluşturuldu`, "success"); qc.invalidateQueries({ queryKey: ["pos"] }); onCreated(); onClose(); },
    onError: (e) => show(describeApiError(e, "Sipariş oluşturulamadı"), "error"),
  });

  return (
    <Modal title="Yeni Satınalma Siparişi" onClose={onClose} size="lg">
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (valid) create.mutate(); }}>
        <Select label="Tedarikçi Seçin" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} options={suppliers.map((s) => ({ value: String(s.id), label: s.name }))} />
        <Field label="Ürün Ekle" placeholder="Ürün adı veya barkod ile arayın…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {search.trim() && (
          <ul className="max-h-40 overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {products.slice(0, 20).map((p) => (
              <li key={p.id}>
                <button type="button" disabled={lines.some((l) => l.productId === p.id)} onClick={() => { setLines((ls) => [...ls, { productId: p.id, name: p.name, quantity: "1", unitCost: String(p.purchasePrice) }]); setSearch(""); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand/5 disabled:opacity-40">
                  <span>{p.name}</span><span className="text-xs text-foreground-muted">mevcut stok: {p.stock}</span>
                </button>
              </li>
            ))}
            {products.length === 0 && <li className="px-3 py-2 text-sm text-foreground-muted">Eşleşen ürün bulunamadı.</li>}
          </ul>
        )}
        {lines.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-foreground-muted">Yukarıdan ürün aratarak sipariş listesine ekleyin.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {lines.map((l) => (
              <div key={l.productId} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{l.name}</span>
                <input aria-label={`${l.name} için miktar`} type="number" min={0} step="0.001" value={l.quantity} onChange={(e) => update(l.productId, { quantity: e.target.value })} className="tabular w-20 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" />
                <input aria-label={`${l.name} için birim maliyet`} type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => update(l.productId, { unitCost: e.target.value })} className="tabular w-24 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" />
                <button type="button" aria-label={`${l.name} kaldır`} onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))} className="text-foreground/40 hover:text-danger"><X className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            ))}
            <p className="tabular text-right text-sm font-semibold">Toplam Tutar: {formatMoney(total, sym)}</p>
          </div>
        )}
        <Field label="Sipariş Notu (isteğe bağlı)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button type="submit" disabled={!valid || create.isPending}>{create.isPending ? "Oluşturuluyor…" : "Satınalma Siparişini Oluştur"}</Button>
      </form>
    </Modal>
  );
}

function ReceiveDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { show } = useToast();
  const { data: po } = useQuery({ queryKey: ["po", id], queryFn: () => api.get<PODetail>(`/purchasing/orders/${id}`) });
  const [qty, setQty] = useState<Record<number, string>>({});

  const receive = useMutation({
    mutationFn: () =>
      api.post(`/purchasing/orders/${id}/receive`, {
        items: po!.items
          .map((i) => ({ itemId: i.id, quantity: Number(qty[i.id] ?? i.quantity - i.receivedQty) }))
          .filter((i) => i.quantity > 0),
      }),
    onSuccess: () => { show("Mal kabul tamamlandı ve stoklara işlendi", "success"); qc.invalidateQueries({ queryKey: ["pos"] }); qc.invalidateQueries({ queryKey: ["products"] }); qc.invalidateQueries({ queryKey: ["reorder"] }); onClose(); },
    onError: (e) => show(describeApiError(e, "Mal kabul işlemi yapılamadı"), "error"),
  });

  return (
    <Modal title={po ? `Mal Kabul: ${po.number}` : "Mal Kabul"} onClose={onClose} size="lg">
      {!po ? <p>Yükleniyor…</p> : (
        <div className="flex flex-col gap-3">
          {po.items.map((i) => (
            <div key={i.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{i.name}<span className="ml-2 text-xs font-normal text-foreground-muted">sipariş: {i.quantity} · teslim alınan: {i.receivedQty}</span></p>
                <input aria-label={`${i.name} için teslim alınan miktar`} type="number" min={0} step="0.001" value={qty[i.id] ?? String(Math.max(0, i.quantity - i.receivedQty))} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} className="tabular w-24 rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" />
              </div>
            </div>
          ))}
          <Button onClick={() => receive.mutate()} disabled={receive.isPending}>{receive.isPending ? "Kaydediliyor…" : "Stoğa Ekle"}</Button>
        </div>
      )}
    </Modal>
  );
}
