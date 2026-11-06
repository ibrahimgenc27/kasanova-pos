"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, ScanBarcode, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, PageHeader } from "@/components/ui/Bits";
import { api, ApiError, describeApiError } from "@/lib/api";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useToast } from "@/components/Toast";
import type { WarrantyResult } from "@/lib/types";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "—");

const historyTypeLabel: Record<string, string> = {
  PURCHASE: "Mal Kabul / Alış",
  SALE: "Satış Fişi Düzenlendi",
  RETURN: "Müşteri İadesi",
  CLAIM: "Garanti / Servis Talebi",
};

export default function WarrantyPage() {
  const { show } = useToast();
  const [serial, setSerial] = useState("");
  const [claim, setClaim] = useState("");
  const [result, setResult] = useState<WarrantyResult | null>(null);

  const lookup = useMutation({
    mutationFn: (s: string) => api.get<WarrantyResult>(`/warranty/${encodeURIComponent(s.trim())}`),
    onSuccess: setResult,
    onError: (e) => {
      setResult(null);
      show(e instanceof ApiError && e.status === 404 ? "Bu seri no / IMEI ile kayıtlı ürün bulunamadı" : describeApiError(e, "Sorgulama başarısız oldu"), "error");
    },
  });
  const logClaim = useMutation({
    mutationFn: () => api.post(`/warranty/${encodeURIComponent(result!.serial)}/claim`, { note: claim }),
    onSuccess: () => { setClaim(""); show("Garanti servis talebi kaydedildi", "success"); lookup.mutate(result!.serial); },
    onError: (e) => show(describeApiError(e, "Servis talebi kaydedilemedi"), "error"),
  });

  useBarcodeScanner({ onScan: (c) => { setSerial(c); lookup.mutate(c); } });

  const w = result;
  const tone = w?.warranty === "ACTIVE" ? "good" : w?.warranty === "EXPIRED" ? "bad" : "warn";
  const Icon = w?.warranty === "ACTIVE" ? ShieldCheck : w?.warranty === "EXPIRED" ? ShieldAlert : ShieldQuestion;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Garanti & Seri No Sorgulama"
        subtitle="Satış geçmişi ve garanti durumunu öğrenmek için cihazın IMEI veya seri numarasını barkod okutun ya da yazın."
      />
      <form className="card-surface mb-6 flex flex-wrap gap-3 p-4" onSubmit={(e) => { e.preventDefault(); if (serial.trim()) lookup.mutate(serial); }}>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border px-3">
          <ScanBarcode className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
          <input
            autoFocus
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="IMEI veya seri numarası…"
            aria-label="IMEI veya seri numarası"
            className="w-full bg-transparent py-2.5 font-mono text-sm outline-none placeholder:text-foreground-muted"
          />
        </div>
        <Button type="submit" disabled={lookup.isPending || !serial.trim()}>
          {lookup.isPending ? "Sorgulanıyor…" : "Sorgula"}
        </Button>
      </form>

      {w && (
        <div className="space-y-4">
          <div className={`rise card-surface flex items-center gap-4 p-5 ${w.warranty === "ACTIVE" ? "border-success/40" : ""}`}>
            <Icon className={`h-10 w-10 shrink-0 ${w.warranty === "ACTIVE" ? "text-success" : w.warranty === "EXPIRED" ? "text-danger" : "text-warning"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{w.product.name}</p>
              <p className="font-mono text-sm text-foreground-muted">{w.serial}</p>
            </div>
            <Badge tone={tone}>
              {w.warranty === "ACTIVE" ? `Garanti Kapsamında · ${w.daysLeft} gün kaldı` :
               w.warranty === "EXPIRED" ? "Garanti Süresi Dolmuş" :
               w.warranty === "RETURNED" ? "İade Edilmiş Ürün" : "Garanti Yok"}
            </Badge>
          </div>

          <dl className="rise card-surface grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-4" style={{ "--i": 1 } as React.CSSProperties}>
            <div><dt className="text-foreground-muted">Satış Tarihi</dt><dd className="font-medium">{fmt(w.soldAt)}</dd></div>
            <div><dt className="text-foreground-muted">Garanti Bitişi</dt><dd className="font-medium">{fmt(w.warrantyEndsAt)}</dd></div>
            <div><dt className="text-foreground-muted">Fatura / Fiş No</dt><dd className="font-medium">{w.invoice?.invoiceNumber ?? "—"}</dd></div>
            <div><dt className="text-foreground-muted">Müşteri</dt><dd className="font-medium">{w.invoice?.customerName ?? "Genel Müşteri"}{w.invoice?.customerPhone ? ` · ${w.invoice.customerPhone}` : ""}</dd></div>
          </dl>

          {w.status === "SOLD" && (
            <form className="rise card-surface flex flex-wrap gap-3 p-5" style={{ "--i": 2 } as React.CSSProperties} onSubmit={(e) => { e.preventDefault(); if (claim.trim()) logClaim.mutate(); }}>
              <input
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                placeholder="Servis talebi veya arıza detayı girin…"
                aria-label="Servis talep notu"
                maxLength={300}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm placeholder:text-foreground-muted"
              />
              <Button type="submit" variant="secondary" disabled={!claim.trim() || logClaim.isPending}>
                <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Talep Kaydet
              </Button>
            </form>
          )}

          <section className="rise card-surface p-5" style={{ "--i": 3 } as React.CSSProperties}>
            <h2 className="mb-3 text-sm font-semibold">Cihaz Hareket ve Servis Geçmişi</h2>
            <ol className="space-y-2 border-l border-border pl-4">
              {w.history.map((h, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{historyTypeLabel[h.type] || h.type}</span>{" "}
                  <span className="text-foreground-muted">· {fmt(h.at)}{h.note ? ` · ${h.note}` : ""}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </div>
  );
}
