"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, CreditCard, MessageCircle, Plus, Search, Star, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { api, describeApiError } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SettleDueModal } from "@/components/SettleDueModal";
import { useToast } from "@/components/Toast";
import { useCustomers, useCreateCustomer, useSettleDue } from "@/hooks/useCustomers";
import { useShopSettings } from "@/hooks/useShopSettings";
import { formatMoney } from "@/lib/format";
import { ApiError } from "@/lib/api";
import { can } from "@/lib/perm";
import { useMe } from "@/hooks/useAuth";
import type { Customer } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(1, "İsim gereklidir"),
  phone: z.string().trim().min(3, "Telefon gereklidir"),
  email: z.string().trim().optional(),
  gstin: z.string().trim().toUpperCase().optional(),
});
type Form = z.infer<typeof schema>;

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [settleTarget, setSettleTarget] = useState<Customer | null>(null);
  const { data: customers, isLoading } = useCustomers(search);
  const { data: shop } = useShopSettings();
  const createCustomer = useCreateCustomer();
  const settleDue = useSettleDue();
  const { show } = useToast();
  const sym = shop?.currencySymbol || "₺";
  const { data: me } = useMe();
  const canEdit = can(me, "customers");
  const qc = useQueryClient();
  const [cardTarget, setCardTarget] = useState<Customer | null>(null);

  async function shareLink(c: Customer) {
    try {
      const r = await api.get<{ whatsappUrl: string }>(`/customers/${c.id}/portal-link`);
      window.open(r.whatsappUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      show(describeApiError(err, "Bağlantı oluşturulamadı"), "error");
    }
  }

  async function linkCard(uid: string) {
    if (!cardTarget) return;
    try {
      await api.put(`/customers/${cardTarget.id}/card`, { cardUid: uid || null });
      show(uid ? "Kart bağlandı" : "Kart bağlantısı kaldırıldı", "success");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setCardTarget(null);
    } catch (err) {
      show(describeApiError(err, "Kart bağlanamadı"), "error");
    }
  }

  async function clearDue(c: Customer) {
    if (!window.confirm(`${c.name} için ${formatMoney(c.totalDue, sym)} borç silinsin mi? Bu işlem tamamı ödendi olarak işaretler.`)) return;
    try {
      await settleDue.mutateAsync({ id: c.id, amount: c.totalDue });
      show(`${c.name} borcu silindi`, "success");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Borç silinemedi", "error");
    }
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  async function onCreate(values: Form) {
    try {
      await createCustomer.mutateAsync(values);
      show("Müşteri eklendi", "success");
      reset();
      setShowForm(false);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Müşteri eklenemedi", "error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Müşteriler</h1>
          <p className="text-sm text-foreground/60">
            {shop?.loyaltyEnabled ? "Sadakat üyeleri ve puanları." : "Müşteri rehberiniz."}
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Müşteri ekle
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleSubmit(onCreate)} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="İsim" error={errors.name?.message} {...register("name")} />
            <Field label="Telefon" error={errors.phone?.message} {...register("phone")} />
            <Field label="E-posta (isteğe bağlı)" {...register("email")} />
            {shop?.gstEnabled && <Field label="VKN (Kurumsal, isteğe bağlı)" {...register("gstin")} />}
            <div className="flex items-end gap-2 sm:col-span-3">
              <Button type="submit" disabled={isSubmitting}>Müşteriyi kaydet</Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                <X className="h-4 w-4" aria-hidden="true" /> İptal
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2">
          <Search className="h-4 w-4 text-foreground/40" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="İsim veya telefona göre ara…"
            aria-label="Müşteri ara"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/40"
          />
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-foreground/50">Yükleniyor…</p>
        ) : !customers || customers.length === 0 ? (
          <p className="py-10 text-center text-sm text-foreground/50">Henüz müşteri yok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-foreground/50">
                  <th className="py-2 pr-4">İsim</th>
                  <th className="py-2 pr-4">Telefon</th>
                  <th className="py-2 pr-4 text-right">Ziyaret</th>
                  <th className="py-2 pr-4 text-right">Toplam harcama</th>
                  <th className="py-2 pr-4 text-right">Borç</th>
                  <th className="py-2 pr-4 text-right">Mağaza kredisi</th>
                  {shop?.loyaltyEnabled && <th className="py-2 pr-4 text-right">Puan</th>}
                  <th className="py-2 text-right"><span className="sr-only">İşlemler</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4 font-medium text-foreground">{c.name}</td>
                    <td className="py-2.5 pr-4 text-foreground/70">{c.phone}</td>
                    <td className="py-2.5 pr-4 text-right text-foreground/70">{c.visits}</td>
                    <td className="py-2.5 pr-4 text-right text-foreground/70">{formatMoney(c.totalSpent, sym)}</td>
                    <td className="py-2.5 pr-4 text-right">
                      {c.totalDue >= 0.01 ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSettleTarget(c)}
                            className="rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/20"
                            title="Ödeme kaydet"
                          >
                            {formatMoney(c.totalDue, sym)}
                          </button>
                          <button
                            type="button"
                            onClick={() => clearDue(c)}
                            aria-label={`${c.name} borcunu sil`}
                            title="Borcu sil (tamamı ödendi olarak işaretle)"
                            className="text-foreground/40 hover:text-success"
                          >
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-foreground/30">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {c.creditBalance >= 0.01 ? (
                        <span className="inline-flex items-center rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                          {formatMoney(c.creditBalance, sym)}
                        </span>
                      ) : (
                        <span className="text-foreground/30">—</span>
                      )}
                    </td>
                    {shop?.loyaltyEnabled && (
                      <td className="py-2.5 pr-4 text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
                          <Star className="h-3 w-3" aria-hidden="true" />
                          {c.loyaltyPoints}
                        </span>
                      </td>
                    )}
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button type="button" aria-label={`${c.name} sadakat sayfasını WhatsApp ile gönder`} title="Sadakat ve fiş sayfasını paylaş" onClick={() => shareLink(c)} className="text-foreground/40 hover:text-brand">
                          <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        </button>
                        {canEdit && (
                          <button type="button" aria-label={`${c.name} için NFC kart bağla`} title={c.cardUid ? "NFC kart bağlı" : "NFC kart bağla"} onClick={() => setCardTarget(c)} className={c.cardUid ? "text-brand" : "text-foreground/40 hover:text-brand"}>
                            <CreditCard className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {cardTarget && (
        <Modal title={`NFC kart · ${cardTarget.name}`} onClose={() => setCardTarget(null)} size="sm">
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); linkCard(String(new FormData(e.currentTarget).get("uid") || "").trim()); }}>
            <p className="text-sm text-foreground-muted">Kartı USB NFC okuyucunuza okutun — kart kimliğini buraya yazar. Kasada aynı kartı okutmak bu müşteriyi seçer.</p>
            <input name="uid" autoFocus autoComplete="off" aria-label="Kart kimliği" defaultValue={cardTarget.cardUid ?? ""} placeholder="Kartı okutun…" className="rounded-lg border border-border bg-surface px-3 py-2.5 font-mono text-sm" />
            <div className="flex gap-2">
              <Button type="submit">Kaydet</Button>
              {cardTarget.cardUid && <Button type="button" variant="secondary" onClick={() => linkCard("")}>Bağlantıyı kaldır</Button>}
            </div>
          </form>
        </Modal>
      )}
      {settleTarget && <SettleDueModal customer={settleTarget} sym={sym} onClose={() => setSettleTarget(null)} />}
    </div>
  );
}
