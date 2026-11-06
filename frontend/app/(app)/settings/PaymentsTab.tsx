"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { usePasswordConfirm } from "@/components/PasswordConfirm";
import { api, describeApiError } from "@/lib/api";
import { useCurrencies } from "@/hooks/useShopSettings";
import type { ShopSettings } from "@/lib/types";
import { useSaver } from "./useSaver";

export function PaymentsTab({ settings }: { settings: ShopSettings }) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <UpiCard settings={settings} />
      <TerminalCard />
      <FxCard base={settings.currencyCode} />
    </div>
  );
}

function UpiCard({ settings }: { settings: ShopSettings }) {
  const save = useSaver();
  const [upi, setUpi] = useState(settings.upiId ?? "");
  const [drawer, setDrawer] = useState(settings.cashDrawer);
  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-base font-semibold">Havale / FAST / Karekod &amp; Para Çekmecesi</h2>
      <Field label="IBAN veya FAST Kolay Adres" placeholder="TR00 0000 0000 0000 0000 0000 00 veya telefon/e-posta" value={upi} onChange={(e) => setUpi(e.target.value.trim())} />
      <p className="-mt-2 text-xs text-foreground-muted">Kasada ve müşteri ekranında hızlı ödeme için otomatik dinamik Karekod oluşturulur.</p>
      <Toggle label="Nakit satışlarda para çekmecesini otomatik aç" description="Fiş yazıcısının RJ11 çekmece soketi üzerinden açma sinyali gönderir." checked={drawer} onChange={setDrawer} />
      <div><Button onClick={() => save({ upiId: upi, cashDrawer: drawer })}>Kaydet</Button></div>
    </Card>
  );
}

function TerminalCard() {
  const { show } = useToast();
  const qc = useQueryClient();
  const { withPasswordConfirm } = usePasswordConfirm();
  const { data } = useQuery({ queryKey: ["terminal-config"], queryFn: () => api.get<{ provider: string; configured: boolean; readerId: string; deviceId: string; sandbox: boolean }>("/payments/terminal-config") });
  const [provider, setProvider] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [readerId, setReaderId] = useState<string | null>(null);
  const [sandbox, setSandbox] = useState<boolean | null>(null);
  const p = provider ?? data?.provider ?? "none";
  const rid = readerId ?? (p === "square" ? data?.deviceId : data?.readerId) ?? "";

  const saveCfg = useMutation({
    mutationFn: () => withPasswordConfirm("kart terminali ayarlarını kaydetmek", (confirmPassword) =>
      api.put("/payments/terminal-config", { provider: p, ...(secret ? { secret } : {}), ...(p === "stripe" ? { readerId: rid } : {}), ...(p === "square" ? { deviceId: rid, sandbox: sandbox ?? data?.sandbox ?? false } : {}), confirmPassword })),
    onSuccess: (r) => { if (r) { show("Kaydedildi", "success"); setSecret(""); qc.invalidateQueries({ queryKey: ["terminal-config"] }); qc.invalidateQueries({ queryKey: ["shop-settings"] }); } },
    onError: (e) => show(describeApiError(e, "Kaydedilemedi"), "error"),
  });

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-base font-semibold">Banka POS &amp; Kart Terminali</h2>
      <p className="rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">Doğrudan entegre POS terminali kullanıyorsanız seçin. Normal banka masaüstü/mobil POS cihazı kullanıyorsanız &ldquo;Harici POS&rdquo; seçili bırakabilirsiniz.</p>
      <Select
        label="Terminal Sağlayıcı"
        value={p}
        onChange={(e) => setProvider(e.target.value)}
        options={[
          { value: "none", label: "Harici POS (Kart satışları harici cihazda çekilir ve tutar elle onaylanır)" },
          { value: "stripe", label: "Stripe Terminal Entegrasyonu" },
          { value: "square", label: "Square Terminal Entegrasyonu" },
        ]}
      />
      {p !== "none" && (
        <>
          <Field label={p === "stripe" ? "Stripe Gizli Anahtar (sk_…)" : "Erişim Belirteci (Access Token)"} type="password" autoComplete="off" placeholder={data?.configured ? "•••••••• kayıtlı — değiştirmemek için boş bırakın" : ""} value={secret} onChange={(e) => setSecret(e.target.value)} />
          <Field label={p === "stripe" ? "Okuyucu Kimliği (tmr_…)" : "Cihaz Kimliği"} value={rid} onChange={(e) => setReaderId(e.target.value)} />
          {p === "square" && <Toggle label="Test Modu (Sandbox)" checked={sandbox ?? data?.sandbox ?? false} onChange={setSandbox} />}
        </>
      )}
      <div><Button onClick={() => saveCfg.mutate()} disabled={saveCfg.isPending}>Terminal Ayarlarını Kaydet</Button></div>
    </Card>
  );
}

function FxCard({ base }: { base: string }) {
  const { show } = useToast();
  const qc = useQueryClient();
  const { data: currencies } = useCurrencies();
  const { data: fx } = useQuery({ queryKey: ["fx"], queryFn: () => api.get<{ base: string; rates: Record<string, number>; updatedAt: string | null }>("/payments/fx") });
  const [rates, setRates] = useState<Record<string, string> | null>(null);
  const [add, setAdd] = useState("USD");
  const cur = rates ?? Object.fromEntries(Object.entries(fx?.rates ?? {}).map(([k, v]) => [k, String(v)]));

  const saveRates = useMutation({
    mutationFn: () => api.put("/payments/fx", { rates: Object.fromEntries(Object.entries(cur).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)])) }),
    onSuccess: () => { show("Döviz kurları kaydedildi", "success"); setRates(null); qc.invalidateQueries({ queryKey: ["fx"] }); },
    onError: (e) => show(describeApiError(e, "Kaydedilemedi"), "error"),
  });
  const refresh = useMutation({
    mutationFn: () => api.post("/payments/fx/refresh"),
    onSuccess: () => { show("Güncel kurlar çekildi", "success"); setRates(null); qc.invalidateQueries({ queryKey: ["fx"] }); },
    onError: (e) => show(describeApiError(e, "Kurlar çekilemedi"), "error"),
  });

  return (
    <Card className="flex flex-col gap-4 p-6">
      <h2 className="text-base font-semibold">Yabancı Para Birimi (Döviz) Satışları</h2>
      <p className="text-sm text-foreground-muted">Müşterinin USD, EUR veya diğer dövizlerle nakit ödeme yapabilmesini sağlar. 1 birim yabancı paranın kaç <b>{base}</b> değerinde olduğunu girin (çevrimdışı çalışır) veya güncel kurları otomatik çekin.</p>
      <div className="flex flex-col gap-2">
        {Object.entries(cur).map(([code, v]) => (
          <div key={code} className="flex items-center gap-2 text-sm">
            <span className="w-16 font-medium">1 {code} =</span>
            <input aria-label={`${code} kuru`} type="number" min={0} step="0.0001" value={v} onChange={(e) => setRates({ ...cur, [code]: e.target.value })} className="tabular w-32 rounded-lg border border-border bg-surface px-2 py-1.5" />
            <span className="text-foreground-muted">{base}</span>
            <Button variant="ghost" onClick={() => { const n = { ...cur }; delete n[code]; setRates(n); }}>Kaldır</Button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <select aria-label="Eklenecek para birimi" value={add} onChange={(e) => setAdd(e.target.value)} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm">
            {Object.keys(currencies ?? {}).filter((c) => c !== base && !(c in cur)).map((c) => <option key={c}>{c}</option>)}
          </select>
          <Button variant="secondary" onClick={() => setRates({ ...cur, [add]: "1" })}>Döviz Ekle</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => saveRates.mutate()} disabled={saveRates.isPending}>Kurları Kaydet</Button>
        <Button variant="secondary" onClick={() => refresh.mutate()} disabled={refresh.isPending}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Güncel Kurları Çek</Button>
        {fx?.updatedAt && <span className="text-xs text-foreground-muted">son güncelleme: {new Date(fx.updatedAt).toLocaleString("tr-TR")}</span>}
      </div>
    </Card>
  );
}
