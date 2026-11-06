"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { usePasswordConfirm } from "@/components/PasswordConfirm";
import { api, describeApiError } from "@/lib/api";

interface Cfg { role: "none" | "branch" | "hub"; hubUrl: string; branchCode: string; secretSet: boolean; lastSyncAt: string | null }

export function SyncTab() {
  const { show } = useToast();
  const qc = useQueryClient();
  const { withPasswordConfirm } = usePasswordConfirm();
  const { data } = useQuery({ queryKey: ["sync-config"], queryFn: () => api.get<Cfg>("/sync") });
  const [f, setF] = useState<{ role: string; hubUrl: string; code: string; secret: string } | null>(null);
  const cur = f ?? (data && { role: data.role, hubUrl: data.hubUrl, code: data.branchCode, secret: "" });

  const save = useMutation({
    mutationFn: () => withPasswordConfirm("şube senkronizasyon ayarlarını değiştirmek", (confirmPassword) =>
      api.put("/sync", { role: cur!.role, hubUrl: cur!.hubUrl, branchCode: cur!.code, ...(cur!.secret ? { secret: cur!.secret } : {}), confirmPassword })),
    onSuccess: (r) => { if (r) { show("Ayarlar kaydedildi", "success"); setF(null); qc.invalidateQueries({ queryKey: ["sync-config"] }); qc.invalidateQueries({ queryKey: ["shop-settings"] }); } },
    onError: (e) => show(describeApiError(e, "Kaydedilemedi"), "error"),
  });
  const now = useMutation({
    mutationFn: () => api.post<{ pushed?: number; skipped?: boolean }>("/sync/now"),
    onSuccess: (r) => { show(r.skipped ? "Senkronize edilecek veri yok — önce bu cihazı şube olarak tanımlayın" : `${r.pushed} ürün merkeze eşitlendi`, "success"); qc.invalidateQueries({ queryKey: ["sync-config"] }); },
    onError: (e) => show(describeApiError(e, "Senkronizasyon başarısız oldu"), "error"),
  });
  if (!cur) return <p className="text-sm text-foreground-muted">Yükleniyor…</p>;
  const set = (patch: Partial<typeof cur>) => setF({ ...cur, ...patch });

  return (
    <Card className="flex max-w-2xl flex-col gap-4 p-6">
      <h2 className="text-base font-semibold">Çoklu Şube &amp; Franchise Yönetimi</h2>
      <p className="text-sm text-foreground-muted">Varsayılan olarak kapalıdır — tek bir dükkan için gerekmez. Veriler şubeler ve merkez arasında uçtan uca şifreli olarak doğrudan aktarılır.</p>
      <Select
        label="Bu Kurulumun Rolü"
        value={cur.role}
        onChange={(e) => set({ role: e.target.value })}
        options={[
          { value: "none", label: "Bağımsız Tekil Mağaza" },
          { value: "branch", label: "Şube (Satış ve stokları merkeze raporlar)" },
          { value: "hub", label: "Merkez Şube / Hub (Tüm şubeleri burada toplar)" },
        ]}
      />
      {cur.role === "branch" && (
        <>
          <Field label="Merkez Sunucu Adresi (https://…)" type="url" value={cur.hubUrl} onChange={(e) => set({ hubUrl: e.target.value })} />
          <Field label="Şube Kodu" value={cur.code} onChange={(e) => set({ code: e.target.value })} />
          <Field label="Senkronizasyon Gizli Anahtarı (Merkezden alınan)" type="password" autoComplete="off" placeholder={data?.secretSet ? "•••••••• kayıtlı — değiştirmemek için boş bırakın" : ""} value={cur.secret} onChange={(e) => set({ secret: e.target.value })} />
        </>
      )}
      {cur.role === "hub" && (
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand">
          Şube eklemek için sol menüdeki <b>Şubeler</b> sekmesini açın (her şubenin gizli anahtarı orada oluşturulur).
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Ayarları Kaydet</Button>
        {data?.role === "branch" && <Button variant="secondary" onClick={() => now.mutate()} disabled={now.isPending}>Şimdi Senkronize Et</Button>}
        {data?.lastSyncAt && <span className="text-xs text-foreground-muted">son senkronizasyon: {new Date(data.lastSyncAt).toLocaleString("tr-TR")}</span>}
      </div>
    </Card>
  );
}
