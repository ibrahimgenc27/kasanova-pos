"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { usePasswordConfirm } from "@/components/PasswordConfirm";
import { api, describeApiError } from "@/lib/api";

interface Cfg { reportEmail: string; reportFrequency: "off" | "daily" | "weekly"; smtp: { configured: boolean; host: string; port: number; secure: boolean; user: string; from: string } }

export function EmailTab() {
  const { show } = useToast();
  const qc = useQueryClient();
  const { withPasswordConfirm } = usePasswordConfirm();
  const { data } = useQuery({ queryKey: ["email-reports"], queryFn: () => api.get<Cfg>("/email-reports") });
  const [f, setF] = useState<{ email: string; freq: string; host: string; port: string; secure: boolean; user: string; pass: string; from: string } | null>(null);
  const cur = f ?? (data && { email: data.reportEmail, freq: data.reportFrequency, host: data.smtp.host, port: String(data.smtp.port), secure: data.smtp.secure, user: data.smtp.user, pass: "", from: data.smtp.from });

  const save = useMutation({
    mutationFn: () => withPasswordConfirm("e-posta rapor ayarlarını kaydetmek", (confirmPassword) =>
      api.put("/email-reports", { reportEmail: cur!.email, reportFrequency: cur!.freq, ...(cur!.host ? { smtp: { host: cur!.host, port: Number(cur!.port) || 587, secure: cur!.secure, user: cur!.user || undefined, from: cur!.from || undefined, ...(cur!.pass ? { pass: cur!.pass } : {}) } } : {}), confirmPassword })),
    onSuccess: (r) => { if (r) { show("Ayarlar kaydedildi", "success"); setF(null); qc.invalidateQueries({ queryKey: ["email-reports"] }); } },
    onError: (e) => show(describeApiError(e, "Kaydedilemedi"), "error"),
  });
  const test = useMutation({
    mutationFn: () => api.post("/email-reports/send-now", { kind: "daily" }),
    onSuccess: () => show("Test raporu gönderildi — lütfen gelen kutunuzu kontrol edin", "success"),
    onError: (e) => show(describeApiError(e, "Rapor gönderilemedi"), "error"),
  });
  if (!cur) return <p className="text-sm text-foreground-muted">Yükleniyor…</p>;
  const set = (patch: Partial<typeof cur>) => setF({ ...cur, ...patch });

  return (
    <Card className="flex max-w-2xl flex-col gap-4 p-6">
      <h2 className="text-base font-semibold">Zamanlanmış Satış Raporu E-postaları</h2>
      <p className="text-sm text-foreground-muted">Günlük ciro, brüt kâr, en çok satan ürünler ve kritik stok özetini her sabah saat 08:00&apos;de otomatik olarak e-posta adresinize iletir. SMTP şifreniz veritabanında şifreli olarak saklanır.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Raporun Gönderileceği E-posta" type="email" value={cur.email} onChange={(e) => set({ email: e.target.value })} />
        <Select
          label="Gönderim Sıklığı"
          value={cur.freq}
          onChange={(e) => set({ freq: e.target.value })}
          options={[
            { value: "off", label: "Kapalı" },
            { value: "daily", label: "Her Gün (Günlük Özet)" },
            { value: "weekly", label: "Haftalık (Her Pazartesi)" },
          ]}
        />
        <Field label="SMTP Sunucu Adresi" placeholder="smtp.gmail.com / mail.siteniz.com" value={cur.host} onChange={(e) => set({ host: e.target.value })} />
        <Field label="SMTP Port" type="number" value={cur.port} onChange={(e) => set({ port: e.target.value })} />
        <Field label="SMTP Kullanıcı Adı" value={cur.user} onChange={(e) => set({ user: e.target.value })} autoComplete="off" />
        <Field label="SMTP Şifresi" type="password" placeholder={data?.smtp.configured ? "•••••••• kayıtlı — değiştirmemek için boş bırakın" : ""} value={cur.pass} onChange={(e) => set({ pass: e.target.value })} autoComplete="new-password" />
        <Field label="Gönderen E-posta Adresi (Kimden)" placeholder="pos-rapor@isletmeniz.com" value={cur.from} onChange={(e) => set({ from: e.target.value })} />
      </div>
      <Toggle label="Doğrudan SSL/TLS Kullan (Port 465 için)" checked={cur.secure} onChange={(v) => set({ secure: v })} />
      <div className="flex gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Ayarları Kaydet</Button>
        <Button variant="secondary" onClick={() => test.mutate()} disabled={test.isPending || !data?.smtp.configured}>Şimdi Test Gönder</Button>
      </div>
    </Card>
  );
}
