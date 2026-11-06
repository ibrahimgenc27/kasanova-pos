"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BrandFooter } from "@/components/BrandFooter";
import { useCurrencies } from "@/hooks/useShopSettings";
import { api, ApiError } from "@/lib/api";

const accountSchema = z.object({
  name: z.string().trim().min(1, "Ad Soyad zorunludur"),
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
  password: z.string().min(8, "En az 8 karakter kullanın"),
});
type AccountForm = z.infer<typeof accountSchema>;

const shopSchema = z.object({
  shopName: z.string().trim().min(1, "İşletme adı zorunludur"),
  address1: z.string().trim().min(1, "Adres zorunludur"),
  address2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  currencyCode: z.string().min(1, "Bir para birimi seçin"),
  lowStockAlert: z.number().int().min(0),
  gstNumber: z.string().trim().optional(),
  defaultTaxRate: z.number().min(0).max(100),
});
type ShopForm = z.infer<typeof shopSchema>;

const STEPS = ["Hesap", "İşletme", "Tamamlandı"] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const { data: currencies } = useCurrencies();
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);

  const currencyOptions = Object.entries(currencies ?? {}).map(([value, c]) => ({
    value,
    label: `${c.symbol} ${c.label} (${value})`,
  }));

  const accountForm = useForm<AccountForm>({ resolver: zodResolver(accountSchema) });
  const shopForm = useForm<ShopForm>({
    resolver: zodResolver(shopSchema),
    defaultValues: { currencyCode: "TRY", lowStockAlert: 5, defaultTaxRate: 20 },
  });

  async function onAccountSubmit(values: AccountForm) {
    setServerError(null);
    try {
      await api.post("/auth/register", values);
      setStep(1);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Yönetici hesabı oluşturulamadı");
    }
  }

  async function onShopSubmit(values: ShopForm) {
    setServerError(null);
    try {
      await api.post("/settings", {
        ...values,
        gstEnabled,
        loyaltyEnabled,
        // sensible loyalty defaults if enabled: 1 pt per unit, 1 pt = 0.1 unit
        pointsPerUnit: loyaltyEnabled ? 1 : 0,
        pointValue: loyaltyEnabled ? 0.1 : 0,
      });
      setStep(2);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "İşletme ayarları kaydedilemedi");
    }
  }

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <Card className="w-full max-w-lg p-8">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image src="/logo.png" alt="KasaNova POS" width={64} height={64} className="h-16 w-16 rounded-full" priority />
          <h1 className="text-xl font-semibold text-foreground">KasaNova POS&apos;a Hoş Geldiniz</h1>
          <p className="text-sm text-foreground/60">Hadi işletmenizi kuralım.</p>
        </div>

        <ol className="mb-8 flex items-center justify-center gap-2" aria-label="Kurulum adımları">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  i < step
                    ? "bg-success text-white"
                    : i === step
                      ? "bg-brand text-brand-foreground"
                      : "bg-surface-muted text-foreground/50"
                }`}
                aria-current={i === step ? "step" : undefined}
              >
                {i < step ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
              </span>
              {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" aria-hidden="true" />}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <form onSubmit={accountForm.handleSubmit(onAccountSubmit)} noValidate className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-foreground/70">1. Adım — Yönetici Hesabı</h2>
            <Field label="Adınız Soyadınız" error={accountForm.formState.errors.name?.message} {...accountForm.register("name")} />
            <Field
              label="E-posta"
              type="email"
              autoComplete="email"
              error={accountForm.formState.errors.email?.message}
              {...accountForm.register("email")}
            />
            <Field
              label="Şifre"
              type="password"
              autoComplete="new-password"
              error={accountForm.formState.errors.password?.message}
              {...accountForm.register("password")}
            />
            <p className="-mt-2 text-xs text-foreground/50">
              Bu hesap için &quot;şifremi unuttum&quot; seçeneği yoktur — yalnızca bu cihazda saklanır. Güvenli bir yere not edin.
            </p>
            {serverError && <p role="alert" className="text-sm text-danger">{serverError}</p>}
            <Button type="submit" disabled={accountForm.formState.isSubmitting} className="mt-2 w-full">
              Devam Et
            </Button>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={shopForm.handleSubmit(onShopSubmit)} noValidate className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-foreground/70">2. Adım — İşletme Bilgileri</h2>
            <Field label="İşletme Adı" error={shopForm.formState.errors.shopName?.message} {...shopForm.register("shopName")} />
            <Field label="Adres Satırı 1" error={shopForm.formState.errors.address1?.message} {...shopForm.register("address1")} />
            <Field label="Adres Satırı 2 (İsteğe bağlı)" {...shopForm.register("address2")} />
            <div className="grid grid-cols-2 gap-4">
              <Field label="İlçe" {...shopForm.register("city")} />
              <Field label="İl" {...shopForm.register("state")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Telefon" {...shopForm.register("phone")} />
              <Select label="Para Birimi" options={currencyOptions} {...shopForm.register("currencyCode")} />
            </div>
            <Field
              label="Kritik Stok Uyarı Eşiği"
              type="number"
              min={0}
              error={shopForm.formState.errors.lowStockAlert?.message}
              {...shopForm.register("lowStockAlert", { valueAsNumber: true })}
            />

            <div className="rounded-lg border border-border p-4">
              <Toggle
                label="KDV / Vergi Sistemini Etkinleştir"
                description="Ürün bazlı KDV uygulayın ve fatura/fişlerde vergi dökümünü gösterin"
                checked={gstEnabled}
                onChange={setGstEnabled}
              />
              {gstEnabled && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Field label="VKN / TCKN (İsteğe bağlı)" {...shopForm.register("gstNumber")} />
                  <Field
                    label="Varsayılan KDV Oranı %"
                    type="number"
                    min={0}
                    step="0.01"
                    {...shopForm.register("defaultTaxRate", { valueAsNumber: true })}
                  />
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-4">
              <Toggle
                label="Müşteri Sadakat Programını Etkinleştir"
                description="Müşteriler alışverişlerinde puan kazanır, indirim olarak kullanabilir"
                checked={loyaltyEnabled}
                onChange={setLoyaltyEnabled}
              />
              {loyaltyEnabled && (
                <p className="mt-3 text-xs text-foreground/50">
                  Harcama başına 1 puan kazanılır, 1 puan = 0,1 ₺ indirim sağlar. Bunu daha sonra Ayarlar&apos;dan değiştirebilirsiniz.
                </p>
              )}
            </div>

            {serverError && <p role="alert" className="text-sm text-danger">{serverError}</p>}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={() => setStep(0)} className="flex-1">
                Geri
              </Button>
              <Button type="submit" disabled={shopForm.formState.isSubmitting} className="flex-1">
                Tamamla ve Başla
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <Check className="h-7 w-7 text-success" aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold text-foreground">Her Şey Hazır!</h2>
            <p className="text-sm text-foreground/60">İşletmeniz yapılandırıldı ve satış yapmaya hazırsınız.</p>
            <Button className="mt-2 w-full" onClick={() => router.replace("/dashboard")}>
              Yönetim Paneline Git
            </Button>
          </div>
        )}
      </Card>
      <BrandFooter />
    </main>
  );
}
