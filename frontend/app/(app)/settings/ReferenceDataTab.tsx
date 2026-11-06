"use client";

import { useState } from "react";
import { Search, Upload } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { ApiError, api } from "@/lib/api";
import {
  useImportIfsc,
  useImportPincodes,
  useImportTaxCodes,
  useMastersSummary,
  type IfscRecord,
} from "@/hooks/useMasters";

export function ReferenceDataTab() {
  const { data: summary } = useMastersSummary();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <TaxCodeImportCard count={summary} />
      <PinCodeImportCard count={summary?.pincodes} />
      <IfscCard count={summary?.ifsc} />
    </div>
  );
}

function ImportRow({
  label,
  hint,
  onImport,
  isPending,
}: {
  label: string;
  hint: string;
  onImport: (file: File) => void;
  isPending: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-foreground/50">{hint}</p>
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="flex-1 text-xs text-foreground/70 file:mr-3 file:rounded-md file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={!file || isPending}
          onClick={() => file && onImport(file)}
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          İçe Aktar (CSV)
        </Button>
      </div>
    </div>
  );
}

function TaxCodeImportCard({ count }: { count?: { hsn: number; sac: number } }) {
  const { show } = useToast();
  const importTaxCodes = useImportTaxCodes();

  async function handle(type: "HSN" | "SAC", file: File) {
    try {
      const res = await importTaxCodes.mutateAsync({ type, file });
      show(`${res.imported} adet ${type === "HSN" ? "GTİP / Ürün" : "Hizmet"} kodu içe aktarıldı`, "success");
    } catch (err) {
      show(err instanceof ApiError ? err.message : `${type} kodları içe aktarılamadı`, "error");
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-base font-semibold text-foreground">GTİP / Vergi &amp; Hizmet Kodları</h2>
      <p className="mb-4 text-sm text-foreground/60">
        {count ? `${count.hsn} GTİP / Mal + ${count.sac} Hizmet kodu yüklü` : "Henüz kod yüklenmedi"} — ürün kartlarında GTİP/vergi kodu otomatik tamamlamasını destekler.
      </p>
      <div className="flex flex-col gap-3">
        <ImportRow
          label="GTİP Kodları (Mal / Ürün Sınıflandırması)"
          hint="CSV sütunları: code, description, gstRate (isteğe bağlı)."
          onImport={(f) => handle("HSN", f)}
          isPending={importTaxCodes.isPending}
        />
        <ImportRow
          label="Hizmet Kodları (Hizmet / Servis Sektörü)"
          hint="CSV sütunları: code, description, gstRate (isteğe bağlı)."
          onImport={(f) => handle("SAC", f)}
          isPending={importTaxCodes.isPending}
        />
      </div>
    </Card>
  );
}

function PinCodeImportCard({ count }: { count?: number }) {
  const { show } = useToast();
  const importPincodes = useImportPincodes();

  async function handle(file: File) {
    try {
      const res = await importPincodes.mutateAsync(file);
      show(`${res.imported} adet posta kodu içe aktarıldı`, "success");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Posta kodları içe aktarılamadı", "error");
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-base font-semibold text-foreground">Posta Kodları (İl / İlçe Rehberi)</h2>
      <p className="mb-4 text-sm text-foreground/60">
        {count ? `${count} adet posta kodu yüklü` : "Henüz yüklenmedi"} — İşletme ve müşteri adreslerinde posta kodundan il/ilçe otomatik tamamlamayı sağlar.
      </p>
      <ImportRow
        label="Posta Kodu Listesi"
        hint="CSV sütunları: pincode, area, district, state (Posta kodu, Mahalle, İlçe, İl)."
        onImport={handle}
        isPending={importPincodes.isPending}
      />
    </Card>
  );
}

function IfscCard({ count }: { count?: number }) {
  const { show } = useToast();
  const importIfsc = useImportIfsc();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<IfscRecord | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleImport(file: File) {
    try {
      const res = await importIfsc.mutateAsync(file);
      show(`${res.imported} adet banka kodu içe aktarıldı`, "success");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Banka kodları içe aktarılamadı", "error");
    }
  }

  async function lookup() {
    if (!query.trim()) return;
    setSearching(true);
    setResult(null);
    try {
      const record = await api.get<IfscRecord>(`/masters/ifsc/${encodeURIComponent(query.trim().toUpperCase())}`);
      setResult(record);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Banka şube kodu bulunamadı", "info");
    } finally {
      setSearching(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-base font-semibold text-foreground">Banka Kodları &amp; Şubeler</h2>
      <p className="mb-4 text-sm text-foreground/60">
        {count ? `${count} banka şubesi yüklü` : "Henüz yüklenmedi"} — banka şube kodu sorgulama aracı.
      </p>
      <ImportRow
        label="Banka Şube Rehberi (CSV)"
        hint="CSV sütunları: ifsc, bank, branch, address, district, state."
        onImport={handleImport}
        isPending={importIfsc.isPending}
      />
      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <Field
            label="Banka / Şube Kodu Sorgula"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="örn: TR00123"
          />
        </div>
        <Button type="button" variant="secondary" onClick={lookup} disabled={searching} aria-label="Banka ara">
          <Search className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {result && (
        <div className="mt-3 rounded-lg bg-surface-muted p-3 text-sm text-foreground/80">
          <p className="font-medium text-foreground">{result.bank}</p>
          <p>{result.branch}</p>
          <p className="text-foreground/60">{result.address}</p>
        </div>
      )}
    </Card>
  );
}
