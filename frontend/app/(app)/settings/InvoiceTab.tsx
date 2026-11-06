"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PenLine, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SignaturePad } from "@/components/pos/SignaturePad";
import { useToast } from "@/components/Toast";
import { usePasswordConfirm } from "@/components/PasswordConfirm";
import { api, describeApiError } from "@/lib/api";
import type { ShopSettings } from "@/lib/types";
import { useSaver } from "./useSaver";

export function InvoiceTab({ settings }: { settings: ShopSettings }) {
  const save = useSaver();
  const { show } = useToast();
  const qc = useQueryClient();
  const { withPasswordConfirm } = usePasswordConfirm();
  const [layout, setLayout] = useState(settings.invoiceLayout);
  const [signatory, setSignatory] = useState(settings.signatoryName ?? "");
  const [terms, setTerms] = useState(settings.termsText ?? "");
  const [pad, setPad] = useState(false);

  const upload = useMutation({
    mutationFn: (image: string) => withPasswordConfirm("bu imzayı kaydetmek", (confirmPassword) => api.put("/settings/signature", { image, confirmPassword })),
    onSuccess: (r) => { if (r) { qc.invalidateQueries({ queryKey: ["shop-settings"] }); show("İmza kaydedildi", "success"); } setPad(false); },
    onError: (e) => show(describeApiError(e, "İmza kaydedilemedi"), "error"),
  });
  const remove = useMutation({
    mutationFn: () => withPasswordConfirm("imzayı kaldırmak", (confirmPassword) => api.delete("/settings/signature", { confirmPassword })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shop-settings"] }),
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-base font-semibold">Fatura ve Fiş Görünümü</h2>
        <Select
          label="Varsayılan PDF Fatura Formatı"
          value={layout}
          onChange={(e) => setLayout(e.target.value as "receipt" | "a4")}
          options={[
            { value: "receipt", label: "Termal Fiş Formatı (80 mm / 58 mm rulo)" },
            { value: "a4", label: "A4 Resmi Fatura Formatı (Antetli, KDV dökümlü, garanti tablosu)" },
          ]}
        />
        <Field label="Yetkili İmza Sahibi Adı (İmzanın altına basılır)" value={signatory} onChange={(e) => setSignatory(e.target.value)} maxLength={100} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">Satış Şartları &amp; Fatura Alt Notu (A4 Fatura)
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            maxLength={600}
            rows={3}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
            placeholder="Örn: Tüketici Hakları Kanunu gereği iade ve değişimler fatura/fiş ibrazı ile 14 gün içinde yapılabilir."
          />
        </label>
        <div><Button onClick={() => save({ invoiceLayout: layout, signatoryName: signatory, termsText: terms })}>Kaydet</Button></div>
        <p className="text-xs text-foreground-muted">Satışlar veya Kasa ekranından her zaman her iki formatta da fatura/fiş indirebilirsiniz.</p>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-base font-semibold">Yetkili İmza &amp; Kaşe</h2>
        <p className="text-sm text-foreground-muted">A4 fatura ve fiş çıktılarında yer alır. Buradan çizebilir veya resim olarak yükleyebilirsiniz (PNG/JPEG).</p>
        {settings.signatureFile ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/signatures/${settings.signatureFile}`} alt="Kayıtlı İmza" className="h-20 rounded-lg border border-border bg-white p-2" />
            <Button variant="ghost" onClick={() => remove.mutate()}><Trash2 className="h-4 w-4 text-danger" aria-hidden="true" /> İmzayı Kaldır</Button>
          </div>
        ) : <p className="text-sm text-foreground-muted">Henüz imza yüklenmedi.</p>}
        <div><Button variant="secondary" onClick={() => setPad(true)}><PenLine className="h-4 w-4" aria-hidden="true" /> {settings.signatureFile ? "İmzayı Değiştir" : "İmza Ekle"}</Button></div>
      </Card>
      {pad && <SignaturePad title="Yetkili İmza" onClose={() => setPad(false)} onSave={(d) => upload.mutate(d)} />}
    </div>
  );
}
