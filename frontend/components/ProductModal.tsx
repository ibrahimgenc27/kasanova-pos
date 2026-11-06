"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Barcode as BarcodeIcon, Camera } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { BarcodeDownloadPanel } from "@/components/BarcodeDownloadPanel";
import { CameraScannerModal } from "@/components/CameraScannerModal";
import { ProductImageField } from "@/components/ProductImageField";
import { OnlineMatchPanel } from "@/components/OnlineMatchPanel";
import { productImageSrc } from "@/lib/productImage";
import { useCreateProduct, useProducts, useUpdateProduct, type ProductInput } from "@/hooks/useProducts";
import { useShopSettings } from "@/hooks/useShopSettings";
import { useToast } from "@/components/Toast";
import { api, ApiError } from "@/lib/api";
import { generateEan13 } from "@/lib/barcode";
import { formatMoney } from "@/lib/format";
import { GENERIC_PRODUCT_CATEGORIES, GST_RATES, UQC_UNITS } from "@/lib/masters";
import type { Product } from "@/lib/types";

const productSchema = z.object({
  barcode: z.string().trim().min(1, "Barkod zorunludur"),
  sku: z.string().trim().optional(),
  name: z.string().trim().min(1, "Ürün adı zorunludur"),
  category: z.string().trim().optional(),
  hsn: z.string().trim().optional(),
  unit: z.string().trim().optional(),
  purchasePrice: z.number().min(0, "0 veya daha büyük olmalıdır"),
  sellingPrice: z.number().min(0, "0 veya daha büyük olmalıdır"),
  taxRate: z.number().min(0).max(100),
  discountType: z.enum(["percent", "amount"]).nullable(),
  discountValue: z.number().min(0, "0 veya daha büyük olmalıdır"),
  stock: z.number().min(0, "0 veya daha büyük olmalıdır"),
  trackSerial: z.boolean(),
  warrantyMonths: z.number().int().min(0).max(240),
  reorderPoint: z.number().min(0),
  supplierId: z.number().int().positive().nullable(),
});
type ProductForm = z.infer<typeof productSchema>;

const UNIT_OPTIONS = [{ value: "", label: "Birim Yok (Adet)" }, ...UQC_UNITS.map((u) => ({ value: u.code, label: `${u.code} — ${u.name}` }))];

interface TaxCodeSuggestion {
  code: string;
  description: string;
}

interface ProductModalProps {
  mode: "add" | "edit";
  product?: Product;
  initialBarcode?: string;
  prefill?: { barcode: string; name: string; category?: string | null; imageUrl?: string | null };
  onClose: () => void;
}

export function ProductModal({ mode, product, initialBarcode, prefill, onClose }: ProductModalProps) {
  const { show } = useToast();
  const { data: shop } = useShopSettings();
  const { data: products } = useProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      barcode: product?.barcode ?? prefill?.barcode ?? initialBarcode ?? "",
      sku: product?.sku ?? "",
      name: product?.name ?? prefill?.name ?? "",
      category: product?.category ?? prefill?.category ?? "",
      hsn: product?.hsn ?? "",
      unit: product?.unit ?? "",
      purchasePrice: product?.purchasePrice ?? 0,
      sellingPrice: product?.sellingPrice ?? 0,
      taxRate: product?.taxRate ?? shop?.defaultTaxRate ?? 20,
      discountType: product?.discountType ?? null,
      discountValue: product?.discountValue ?? 0,
      stock: product?.stock ?? 0,
      trackSerial: product?.trackSerial ?? false,
      warrantyMonths: product?.warrantyMonths ?? 0,
      reorderPoint: product?.reorderPoint ?? 0,
      supplierId: product?.supplierId ?? null,
    },
  });

  const [newImage, setNewImage] = useState<string | null | undefined>(undefined);
  const [chosenOnline, setChosenOnline] = useState<string | null>(null);
  const onlineImage = chosenOnline ?? (mode === "add" ? prefill?.imageUrl ?? null : null);
  const imagePreview = newImage !== undefined ? newImage : onlineImage ?? productImageSrc(product?.imageFile);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function onSubmit(values: ProductForm) {
    try {
      const payload: ProductInput = { ...values };
      if (newImage !== undefined) payload.image = newImage;
      else if (onlineImage) payload.imageUrl = onlineImage;
      if (mode === "edit" && product) {
        await updateProduct.mutateAsync({ id: product.id, data: payload });
        show("Ürün başarıyla güncellendi", "success");
      } else {
        await createProduct.mutateAsync(payload);
        show("Yeni ürün başarıyla eklendi", "success");
      }
      onClose();
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Ürün kaydedilemedi", "error");
    }
  }

  const gst = shop?.gstEnabled;
  const taxRate = useWatch({ control, name: "taxRate" });
  const hsnValue = useWatch({ control, name: "hsn" });
  const barcodeValue = useWatch({ control, name: "barcode" });
  const nameValue = useWatch({ control, name: "name" });
  const categoryValue = useWatch({ control, name: "category" });
  const sellingPrice = useWatch({ control, name: "sellingPrice" });
  const discountType = useWatch({ control, name: "discountType" });
  const discountValue = useWatch({ control, name: "discountValue" });
  const sym = shop?.currencySymbol ?? "₺";
  const trackSerial = useWatch({ control, name: "trackSerial" });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get<{ id: number; name: string }[]>("/purchasing/suppliers").catch(() => []) });
  const discountedPrice = (() => {
    if (!discountType || !discountValue) return sellingPrice;
    if (discountType === "percent") {
      const pct = Math.min(100, Math.max(0, discountValue));
      return Math.round(sellingPrice * (1 - pct / 100) * 100) / 100;
    }
    const amt = Math.min(sellingPrice, Math.max(0, discountValue));
    return Math.round((sellingPrice - amt) * 100) / 100;
  })();

  function generateBarcode() {
    const code = generateEan13(products?.map((p) => p.barcode) ?? []);
    setValue("barcode", code, { shouldValidate: true, shouldDirty: true });
  }

  const categoryOptions = useMemo(() => {
    const existing = new Set((products ?? []).map((p) => p.category).filter((c): c is string => !!c));
    return Array.from(new Set([...existing, ...GENERIC_PRODUCT_CATEGORIES])).sort();
  }, [products]);

  const [showBarcodeImage, setShowBarcodeImage] = useState(false);
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [hsnSuggestions, setHsnSuggestions] = useState<TaxCodeSuggestion[]>([]);
  useEffect(() => {
    const query = hsnValue?.trim() ?? "";
    const handle = setTimeout(() => {
      if (!gst || query.length < 2) {
        setHsnSuggestions([]);
        return;
      }
      api
        .get<TaxCodeSuggestion[]>(`/masters/tax-codes/search?q=${encodeURIComponent(query)}`)
        .then(setHsnSuggestions)
        .catch(() => setHsnSuggestions([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [gst, hsnValue]);

  return (
    <Modal title={mode === "edit" ? "Ürünü Düzenle" : "Yeni Ürün Ekle"} onClose={onClose} size="lg" closeOnBackdrop={false}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <ProductImageField src={imagePreview} onChange={(v) => { setChosenOnline(null); setNewImage(v); }} />
        {barcodeValue?.trim() && (
          <OnlineMatchPanel
            barcode={barcodeValue.trim()}
            current={{ name: nameValue ?? "", category: categoryValue ?? "", imageSrc: imagePreview }}
            onUseName={(v) => setValue("name", v, { shouldValidate: true, shouldDirty: true })}
            onUseCategory={(v) => setValue("category", v, { shouldDirty: true })}
            onUseImage={(url) => { setNewImage(undefined); setChosenOnline(url); }}
          />
        )}
        <section aria-label="Barkod" className="flex flex-col gap-2.5">
          <Field label="Barkod" autoFocus={mode === "add"} error={errors.barcode?.message} {...register("barcode")} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={generateBarcode} title="Barkodu olmayan ürün için otomatik EAN-13 barkod oluştur">
              <BarcodeIcon className="h-4 w-4" aria-hidden="true" />
              Otomatik Barkod Üret
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCameraScannerOpen(true)} title="Kamera ile barkod oku">
              <Camera className="h-4 w-4" aria-hidden="true" />
              Kamera ile Tara
            </Button>
            <span className="text-xs text-foreground-muted">Üründe barkod yok mu? Sistemden otomatik üretip etiket yazdırabilirsiniz.</span>
          </div>
          {cameraScannerOpen && (
            <CameraScannerModal
              onClose={() => setCameraScannerOpen(false)}
              onScan={(code) => {
                setCameraScannerOpen(false);
                setValue("barcode", code, { shouldValidate: true, shouldDirty: true });
              }}
            />
          )}
          {barcodeValue?.trim() && (
            <div>
              <button
                type="button"
                onClick={() => setShowBarcodeImage((v) => !v)}
                className="text-sm font-medium text-brand hover:underline"
              >
                {showBarcodeImage ? "Barkod görselini gizle" : "Yazdırmak için barkod etiketi al (PNG/JPG)"}
              </button>
              {showBarcodeImage && (
                <div className="mt-3">
                  <BarcodeDownloadPanel value={barcodeValue.trim()} />
                </div>
              )}
            </div>
          )}
        </section>
        <Field label="Ürün Adı" error={errors.name?.message} {...register("name")} />
        <div>
          <Field
            label="SKU / Ürün Kodu (İsteğe Bağlı)"
            placeholder="Online e-ticaret eşleştirmesi için"
            error={errors.sku?.message}
            {...register("sku")}
          />
          <p className="mt-1 text-xs text-foreground/50">
            E-ticaret sitelerinizle ürünü eşleştirmek için kullanılır. Farklı bir kanalda satılmıyorsa boş bırakabilirsiniz.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kategori" list="category-options" {...register("category")} />
          <Select label="Satış Birimi" options={UNIT_OPTIONS} {...register("unit")} />
        </div>
        {gst && <Field label="GTİP / Vergi Kodu" list="hsn-options" {...register("hsn")} />}
        <datalist id="category-options">
          {categoryOptions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <datalist id="hsn-options">
          {hsnSuggestions.map((s) => (
            <option key={s.code} value={s.code}>
              {s.description}
            </option>
          ))}
        </datalist>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Alış Fiyatı (Maliyet)"
            type="number"
            step="0.01"
            min={0}
            error={errors.purchasePrice?.message}
            {...register("purchasePrice", { valueAsNumber: true })}
          />
          <Field
            label="Satış Fiyatı"
            type="number"
            step="0.01"
            min={0}
            error={errors.sellingPrice?.message}
            {...register("sellingPrice", { valueAsNumber: true })}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Sabit Ürün İndirimi (Kasada otomatik uygulanır)
          </label>
          <div className="flex gap-2">
            <select
              aria-label="İndirim türü"
              className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
              {...register("discountType", { setValueAs: (v) => (v === "" ? null : v) })}
            >
              <option value="">Yok</option>
              <option value="percent">% Yüzde</option>
              <option value="amount">{sym} Tutar</option>
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              disabled={!discountType}
              placeholder="İndirim değeri"
              aria-label="İndirim değeri"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground disabled:opacity-50"
              {...register("discountValue", { valueAsNumber: true })}
            />
          </div>
          {errors.discountValue?.message && <p className="mt-1 text-sm text-danger">{errors.discountValue.message}</p>}
          {discountType && discountValue > 0 && (
            <p className="mt-1 text-xs text-success">İndirimli satış fiyatı: {formatMoney(discountedPrice, sym)}</p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Mevcut Stok Miktarı"
            type="number"
            min={0}
            step="0.001"
            autoFocus={mode === "edit"}
            error={errors.stock?.message}
            {...register("stock", { valueAsNumber: true })}
          />
          {gst && (
            <Field
              label="KDV Oranı (%)"
              type="number"
              min={0}
              step="0.01"
              error={errors.taxRate?.message}
              {...register("taxRate", { valueAsNumber: true })}
            />
          )}
        </div>
        {gst && (
          <div className="flex flex-wrap gap-1.5">
            {GST_RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setValue("taxRate", rate, { shouldValidate: true, shouldDirty: true })}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  taxRate === rate
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border text-foreground/60 hover:bg-surface-muted"
                }`}
              >
                %{rate}
              </button>
            ))}
          </div>
        )}

        {shop?.serialTracking && (
          <fieldset className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-semibold">IMEI / Seri No &amp; Garanti Takibi</legend>
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--brand)]" {...register("trackSerial")} />
              <span>
                <span className="font-medium">Satışta her ürün için IMEI / Seri Numarası zorunlu olsun</span>
                <span className="block text-xs text-foreground-muted">Kasada satış anında barkod okutularak girilir.</span>
              </span>
            </label>
            {trackSerial && <Field label="Garanti Süresi (Ay)" type="number" min={0} max={240} error={errors.warrantyMonths?.message} {...register("warrantyMonths", { valueAsNumber: true })} />}
          </fieldset>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Kritik Stok Uyarı Eşiği" type="number" min={0} step="0.001" error={errors.reorderPoint?.message} {...register("reorderPoint", { valueAsNumber: true })} />
          <label className="flex flex-col gap-1.5 text-sm font-medium">Tedarikçi Firma
            <select className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm" {...register("supplierId", { setValueAs: (v) => (v === "" || v == null ? null : Number(v)) })}>
              <option value="">Seçilmedi</option>
              {(suppliers ?? []).map((sp) => (<option key={sp.id} value={sp.id}>{sp.name}</option>))}
            </select>
          </label>
        </div>
        <div className="sticky -bottom-5 -mx-5 -mb-5 flex justify-end gap-3 border-t border-border-subtle bg-surface px-5 py-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {mode === "edit" ? "Değişiklikleri Kaydet" : "Ürünü Ekle"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
