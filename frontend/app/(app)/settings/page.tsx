"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Toggle } from "@/components/ui/Toggle";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/Toast";
import { useCurrencies, useShopSettings } from "@/hooks/useShopSettings";
import { api, ApiError } from "@/lib/api";
import { isValidGstinFormat, isValidPanFormat } from "@/lib/masters";
import type { PinCodeRecord } from "@/hooks/useMasters";
import type { ShopSettings } from "@/lib/types";
import { UsersPanel } from "./UsersPanel";
import { ReferenceDataTab } from "./ReferenceDataTab";
import { useSaver } from "./useSaver";
import { PaymentsTab } from "./PaymentsTab";
import { InvoiceTab } from "./InvoiceTab";
import { OnlineTab } from "./OnlineTab";
import { EmailTab } from "./EmailTab";
import { SyncTab } from "./SyncTab";
import { FeaturesTab } from "./FeaturesTab";
import { IntegrationsTab } from "./IntegrationsTab";
import { UpdatesTab } from "./UpdatesTab";
import { VerifactuTab } from "./VerifactuTab";

const TABS = [
  "İşletme Bilgileri",
  "KDV & Sadakat",
  "Fiş & Yazıcı",
  "Özellikler",
  "Fatura & İmza",
  "Ödeme Yöntemleri",
  "Online Mağazalar",
  "E-posta Raporları",
  "Çoklu Şube",
  "Tanımlar & Referanslar",
  "Entegrasyonlar",
  "VERI*FACTU",
  "Şifre Değiştir",
  "Personel",
  "Güncellemeler",
] as const;
type Tab = (typeof TABS)[number];

const TAB_MAP: Record<string, Tab> = {
  Company: "İşletme Bilgileri",
  "Tax & Loyalty": "KDV & Sadakat",
  Receipt: "Fiş & Yazıcı",
  Features: "Özellikler",
  "Invoice & signature": "Fatura & İmza",
  Payments: "Ödeme Yöntemleri",
  "Online stores": "Online Mağazalar",
  "E-mail reports": "E-posta Raporları",
  Branches: "Çoklu Şube",
  "Reference Data": "Tanımlar & Referanslar",
  Integrations: "Entegrasyonlar",
  "VERI*FACTU": "VERI*FACTU",
  Password: "Şifre Değiştir",
  Staff: "Personel",
  Updates: "Güncellemeler",
};

export default function SettingsPage() {
  const { data: settings, isLoading, isError, error, refetch } = useShopSettings();
  const [tab, setTab] = useState<Tab>("İşletme Bilgileri");

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted) {
      if ((TABS as readonly string[]).includes(wanted)) setTab(wanted as Tab);
      else if (TAB_MAP[wanted]) setTab(TAB_MAP[wanted]);
    }
  }, []);

  if (isLoading) {
    return <p className="text-sm text-foreground/50">Ayarlar yükleniyor…</p>;
  }

  if (isError || !settings) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-danger">
          {isError
            ? error instanceof ApiError
              ? error.message
              : "Ayarlar yüklenemedi — lütfen bağlantınızı kontrol edip tekrar deneyin"
            : "Bu işletme için başlangıç kurulumu henüz tamamlanmamış."}
        </p>
        {isError ? (
          <Button variant="secondary" onClick={() => refetch()}>
            Yeniden Dene
          </Button>
        ) : (
          <Link href="/onboarding">
            <Button variant="secondary">Kurulumu Tamamla</Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-foreground">Sistem Ayarları</h1>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.filter((t) => t !== "VERI*FACTU" || settings.currencyCode === "EUR").map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-brand text-brand"
                : "border-transparent text-foreground/60 hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "İşletme Bilgileri" && <CompanyTab settings={settings} />}
      {tab === "KDV & Sadakat" && <TaxLoyaltyTab settings={settings} />}
      {tab === "Fiş & Yazıcı" && <ReceiptTab settings={settings} />}
      {tab === "Özellikler" && <FeaturesTab settings={settings} />}
      {tab === "Fatura & İmza" && <InvoiceTab settings={settings} />}
      {tab === "Ödeme Yöntemleri" && <PaymentsTab settings={settings} />}
      {tab === "Online Mağazalar" && <OnlineTab />}
      {tab === "E-posta Raporları" && <EmailTab />}
      {tab === "Çoklu Şube" && <SyncTab />}
      {tab === "Tanımlar & Referanslar" && <ReferenceDataTab />}
      {tab === "Entegrasyonlar" && <IntegrationsTab />}
      {tab === "VERI*FACTU" && (settings.currencyCode === "EUR" ? <VerifactuTab /> : <p className="max-w-2xl text-sm text-foreground-muted">VERI*FACTU yalnızca İspanya&apos;daki Euro para birimini kullanan işletmeler için geçerlidir.</p>)}
      {tab === "Şifre Değiştir" && <PasswordTab />}
      {tab === "Personel" && <UsersPanel />}
      {tab === "Güncellemeler" && <UpdatesTab />}
    </div>
  );
}

function CompanyTab({ settings }: { settings: ShopSettings }) {
  const save = useSaver();
  const { data: currencies } = useCurrencies();
  const { show } = useToast();
  const [form, setForm] = useState(settings);
  const [lookingUp, setLookingUp] = useState(false);
  const currencyOptions = Object.entries(currencies ?? {}).map(([value, c]) => ({
    value,
    label: `${c.symbol} ${c.label} (${value})`,
  }));
  const set = (k: keyof ShopSettings, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function lookupPincode() {
    const pin = (form.pincode ?? "").trim();
    if (!pin) return;
    setLookingUp(true);
    try {
      const record = await api.get<PinCodeRecord>(`/masters/pincodes/${encodeURIComponent(pin)}`);
      setForm((f) => ({ ...f, city: record.district || f.city, state: record.state || f.state }));
      show(`${record.area || record.district}, ${record.state}`, "success");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Posta kodu bulunamadı", "info");
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <Card className="max-w-2xl p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save({
            shopName: form.shopName,
            legalName: form.legalName || "",
            address1: form.address1,
            address2: form.address2 || "",
            pincode: form.pincode || "",
            city: form.city || "",
            state: form.state || "",
            phone: form.phone || "",
            email: form.email || "",
            currencyCode: form.currencyCode,
            lowStockAlert: form.lowStockAlert,
            allowNegativeStock: form.allowNegativeStock,
          });
        }}
        className="flex flex-col gap-4"
      >
        <Field label="İşletme / Mağaza Adı" value={form.shopName} onChange={(e) => set("shopName", e.target.value)} />
        <Field label="Ticari Unvan (Fatura Üzerindeki Resmi Ad)" value={form.legalName ?? ""} onChange={(e) => set("legalName", e.target.value)} />
        <Field label="Adres Satırı 1 (Cadde, Sokak, No)" value={form.address1} onChange={(e) => set("address1", e.target.value)} />
        <Field label="Adres Satırı 2 (Mahalle, Daire vb.)" value={form.address2 ?? ""} onChange={(e) => set("address2", e.target.value)} />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field
              label="Posta Kodu"
              value={form.pincode ?? ""}
              onChange={(e) => set("pincode", e.target.value)}
              placeholder="İl ve ilçe otomatik doldurulur"
            />
          </div>
          <Button type="button" variant="secondary" onClick={lookupPincode} disabled={lookingUp} aria-label="Posta kodunu sorgula">
            <Search className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="İlçe" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          <Field label="Şehir / İl" value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Telefon Numarası" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          <Field label="E-posta Adresi" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Varsayılan Para Birimi"
            options={currencyOptions}
            value={form.currencyCode}
            onChange={(e) => set("currencyCode", e.target.value)}
          />
          <Field
            label="Kritik Stok Uyarı Sınırı (Adet)"
            type="number"
            min={0}
            value={form.lowStockAlert}
            onChange={(e) => set("lowStockAlert", Number(e.target.value))}
          />
        </div>
        <Toggle
          label="Eksi bakiye ile satışa izin ver"
          description="Stokta kalmayan (0 veya negatif) ürünler için satış işleminin engellenmesini önler; sayımları sonradan eşitleyen işletmeler için faydalıdır."
          checked={form.allowNegativeStock}
          onChange={(v) => setForm((f) => ({ ...f, allowNegativeStock: v }))}
        />
        <Button type="submit" className="self-start">İşletme Bilgilerini Kaydet</Button>
      </form>
    </Card>
  );
}

function TaxLoyaltyTab({ settings }: { settings: ShopSettings }) {
  const save = useSaver();
  const [form, setForm] = useState(settings);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">KDV & Vergi Yapılandırması</h2>
        <div className="flex flex-col gap-4">
          <Toggle
            label="KDV Sistemini Etkinleştir"
            description="Ürün bazlı KDV oranlarını hesapla ve fiş/faturalarda göster"
            checked={form.gstEnabled}
            onChange={(v) => setForm((f) => ({ ...f, gstEnabled: v }))}
          />
          {form.gstEnabled && (
            <>
              <Toggle
                label="Fiş üzerinde KDV matrah dökümünü göster"
                checked={form.showGst}
                onChange={(v) => setForm((f) => ({ ...f, showGst: v }))}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Field
                    label="Vergi Kimlik No / VKN / TCKN"
                    value={form.gstNumber ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value.toUpperCase() }))}
                  />
                  {form.gstNumber && (
                    <p className={`mt-1 text-xs ${isValidGstinFormat(form.gstNumber) ? "text-success" : "text-warning"}`}>
                      {isValidGstinFormat(form.gstNumber)
                        ? "Geçerli format"
                        : "10 haneli VKN veya 11 haneli TCKN formatına dikkat ediniz"}
                    </p>
                  )}
                </div>
                <Field
                  label="Varsayılan KDV Oranı (%)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.defaultTaxRate}
                  onChange={(e) => setForm((f) => ({ ...f, defaultTaxRate: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Field
                  label="Mersis No / Ticaret Sicil No"
                  value={form.panNumber ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, panNumber: e.target.value.toUpperCase() }))}
                />
                {form.panNumber && (
                  <p className={`mt-1 text-xs ${isValidPanFormat(form.panNumber) ? "text-success" : "text-warning"}`}>
                    {isValidPanFormat(form.panNumber) ? "Geçerli format" : "Formatı kontrol ediniz"}
                  </p>
                )}
              </div>
            </>
          )}
          <Button
            className="self-start"
            onClick={() =>
              save({
                gstEnabled: form.gstEnabled,
                showGst: form.showGst,
                gstNumber: form.gstNumber || "",
                panNumber: form.panNumber || "",
                defaultTaxRate: form.defaultTaxRate,
              })
            }
          >
            Vergi Ayarlarını Kaydet
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Sadakat & Puan Programı</h2>
        <div className="flex flex-col gap-4">
          <Toggle
            label="Sadakat Puan Sistemini Etkinleştir"
            description="Müşteriler harcamalarından puan kazanır ve sonraki alışverişlerinde indirim olarak kullanabilirler"
            checked={form.loyaltyEnabled}
            onChange={(v) => setForm((f) => ({ ...f, loyaltyEnabled: v }))}
          />
          {form.loyaltyEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <Field
                label="Birim Harcama Başına Kazanılan Puan"
                type="number"
                min={0}
                step="0.01"
                value={form.pointsPerUnit}
                onChange={(e) => setForm((f) => ({ ...f, pointsPerUnit: Number(e.target.value) }))}
              />
              <Field
                label="1 Puanın İndirim Karşılığı (₺)"
                type="number"
                min={0}
                step="0.01"
                value={form.pointValue}
                onChange={(e) => setForm((f) => ({ ...f, pointValue: Number(e.target.value) }))}
              />
            </div>
          )}
          <Button
            className="self-start"
            onClick={() =>
              save({
                loyaltyEnabled: form.loyaltyEnabled,
                pointsPerUnit: form.pointsPerUnit,
                pointValue: form.pointValue,
              })
            }
          >
            Sadakat Ayarlarını Kaydet
          </Button>
        </div>
      </Card>
    </div>
  );
}

type PrinterDiag = {
  lpDevices: string[];
  libusbPrinter: { id: string } | null;
  canPrint: boolean;
  notes: string[];
};

function ReceiptTab({ settings }: { settings: ShopSettings }) {
  const save = useSaver();
  const { show } = useToast();
  const [header, setHeader] = useState(settings.receiptHeader ?? "");
  const [footer, setFooter] = useState(settings.receiptFooter ?? "");
  const [autoPrint, setAutoPrint] = useState(settings.autoPrintReceipt);
  const [autoPrintMethod, setAutoPrintMethod] = useState(settings.autoPrintMethod ?? "browser");
  const [usbWidth, setUsbWidth] = useState(String(settings.usbPrinterWidth));
  const [diag, setDiag] = useState<PrinterDiag | null>(null);
  const [checking, setChecking] = useState(false);
  const [testing, setTesting] = useState(false);

  async function checkPrinter() {
    setChecking(true);
    try {
      setDiag(await api.get<PrinterDiag>("/print/diagnostics"));
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Yazıcı kontrol edilemedi", "error");
    } finally {
      setChecking(false);
    }
  }

  async function testPrint() {
    setTesting(true);
    try {
      await api.post("/print/test");
      show("Test fişi USB yazıcıya gönderildi", "success");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Test yazdırma başarısız oldu", "error");
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="max-w-2xl p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save({
            receiptHeader: header,
            receiptFooter: footer,
            autoPrintReceipt: autoPrint,
            autoPrintMethod,
            usbPrinterWidth: Number(usbWidth),
          });
        }}
        className="flex flex-col gap-4"
      >
        <Toggle
          label="Her satıştan sonra fişi otomatik yazdır"
          description="Satış tamamlandığı anda fiş doğrudan yazıcıya gönderilir"
          checked={autoPrint}
          onChange={setAutoPrint}
        />
        {autoPrint && (
          <Select
            label="Yazdırma Yöntemi"
            value={autoPrintMethod}
            onChange={(e) => setAutoPrintMethod(e.target.value as "browser" | "usb")}
            options={[
              { value: "browser", label: "Tarayıcı Yazdırma İletişim Kutusu (Windows sürücüsü ile)" },
              { value: "usb", label: "Doğrudan USB Termal Yazıcı (İletişim kutusuz ESC/POS)" },
            ]}
          />
        )}
        {autoPrint && autoPrintMethod === "usb" && (
          <p className="-mt-2 text-xs text-foreground/60">
            Fişi açılır pencere olmadan doğrudan USB termal yazıcıya iletir.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rh" className="text-sm font-medium text-foreground">
            Fiş Başlık Metni (Mağaza adının üzerinde yer alır)
          </label>
          <textarea
            id="rh"
            value={header}
            onChange={(e) => setHeader(e.target.value)}
            rows={2}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rf" className="text-sm font-medium text-foreground">
            Fiş Alt Bilgi Notu (Teşekkür & bilgilendirme mesajı)
          </label>
          <textarea
            id="rf"
            value={footer}
            onChange={(e) => setFooter(e.target.value)}
            rows={2}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <Select
          label="Termal Yazıcı Kağıt Genişliği"
          value={usbWidth}
          onChange={(e) => setUsbWidth(e.target.value)}
          options={[
            { value: "80", label: "80mm (Standart Geniş)" },
            { value: "58", label: "58mm (Kompakt Dar)" },
          ]}
        />
        <Button type="submit" className="self-start">Fiş Ayarlarını Kaydet</Button>
      </form>

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-sm font-semibold text-foreground">USB Termal Yazıcı Kontrolü</h3>
        <p className="mt-1 text-xs text-foreground/60">
          Cihazınıza bağlı termal fiş yazıcının durumunu kontrol eder ve test çıktısı alır.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={checkPrinter} disabled={checking}>
            {checking ? "Kontrol Ediliyor…" : "Yazıcıyı Kontrol Et"}
          </Button>
          <Button type="button" variant="secondary" onClick={testPrint} disabled={testing}>
            {testing ? "Yazdırılıyor…" : "Test Fişi Yazdır"}
          </Button>
        </div>
        {diag && (
          <div
            className={`mt-3 rounded-lg border p-3 text-xs ${
              diag.canPrint ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"
            }`}
          >
            <p className="font-semibold">
              {diag.canPrint ? "Yazıcı tespit edildi — doğrudan USB yazdırma kullanılabilir." : "USB yazıcı tespit edilemedi."}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-foreground/70">
              <li>Kernel yazıcı aygıtları: {diag.lpDevices.length > 0 ? diag.lpDevices.join(", ") : "yok"}</li>
              <li>USB aygıtı: {diag.libusbPrinter ? diag.libusbPrinter.id : "yok"}</li>
              {diag.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function PasswordTab() {
  const { show } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/change-password", { currentPassword: current, newPassword: next });
      show("Şifreniz başarıyla değiştirildi", "success");
      setCurrent("");
      setNext("");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Şifre değiştirilemedi", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-md p-6">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Mevcut Şifre"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Field
          label="Yeni Şifre (En az 8 karakter)"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <Button type="submit" disabled={busy} className="self-start">Şifreyi Değiştir</Button>
      </form>
    </Card>
  );
}
