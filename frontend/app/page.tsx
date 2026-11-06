import type { Metadata } from "next";
import Link from "next/link";
import {
  WifiOff,
  Lock,
  Receipt,
  ScanBarcode,
  Users,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { BrandFooter } from "@/components/BrandFooter";
import { HomeAuthRedirect } from "@/components/HomeAuthRedirect";
import { QuickstartCommand } from "@/components/QuickstartCommand";
import { ReceiptHero } from "@/components/ReceiptHero";

const title = "KasaNova POS – Çevrimdışı Hızlı Satış ve Stok Yönetim Sistemi";
const description =
  "KasaNova POS, perakende mağazaları ve işletmeler için geliştirilmiş çevrimdışı çalışan hızlı satış noktası (POS), veresiye ve stok yönetim yazılımıdır. Kendi bilgisayarınızda barındırılır, abonelik ücreti yoktur ve KDV destekli faturalama sunar.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description, url: "/" },
  twitter: { title, description },
};

const GITHUB_URL = "https://github.com/ibrahimgenc27/kasanova-pos";

const FEATURES = [
  {
    icon: WifiOff,
    title: "Tamamen çevrimdışı çalışır",
    body: "Satış, stok ve fiş yazdırma kendi makinenizde çalışır — satış yapmak için internet bağlantısı gerekmez.",
  },
  {
    icon: Lock,
    title: "Kendi sunucunuzda, verileriniz sizde",
    body: "Bulut hesabı yok, dış sunucuya aktarım yok. Satış ve müşteri verileri kontrolünüzdeki donanımda yerel veritabanında saklanır.",
  },
  {
    icon: Receipt,
    title: "Türkiye için KDV destekli faturalama",
    body: "KDV dahil fiyatlandırma, ürün bazında vergi oranları ve her yazdırılan termal fişte veya A4 PDF faturada KDV dökümü.",
  },
  {
    icon: ScanBarcode,
    title: "Barkod okuma & etiket yazdırma",
    body: "USB barkod okuyucu veya kamera ile oku ve sat; ayrıca barkodu olmayan ürünler için yerleşik EAN-13 barkod ve etiket üretici.",
  },
  {
    icon: Users,
    title: "Müşteriler, veresiye & sadakat",
    body: "Müşteri açık hesap (veresiye) bakiyelerini, mağaza kredisini ve puan bazlı sadakat programını ek ücret olmadan takip edin.",
  },
  {
    icon: Sparkles,
    title: "Modern, hızlı ve esnek mimari",
    body: "Aynı Wi-Fi ağındaki telefon, tablet ve bilgisayarlardan anında erişin; müşteri ekranı ve e-ticaret sipariş panosuyla tam entegre çalışın.",
  },
];

const COMPARISON_ROWS: [string, string, string][] = [
  ["Aylık abonelik", "Yok — tamamen ücretsiz", "Yaygın, terminal/konum başına"],
  ["İnternetsiz çalışır mı?", "Evet, %100 çevrimdışı", "Genellikle canlı bağlantı gerektirir"],
  ["Verileriniz nerede?", "Kendi bilgisayarınızda", "Üçüncü taraf bulut sunucularında"],
  ["Kurulum & Kontrol", "Tam kontrol, kendi sunucunuzda", "Satıcı bağımlı"],
  ["KDV dahil Türkiye fiyatlandırması", "Varsayılan olarak dahil", "Değişir, genellikle ücretli eklenti"],
];

const FAQS = [
  {
    q: "KasaNova POS gerçekten aboneliksiz mi?",
    a: "Evet. Abonelik, işlem başına komisyon veya gizli ücret yoktur. Kendi bilgisayarınızda veya sunucunuzda çalıştırırsınız.",
  },
  {
    q: "İnternet kesildiğinde satış yapmaya devam edebilir miyim?",
    a: "Evet. KasaNova POS kurulduktan sonra tamamen çevrimdışı (offline) çalışır. Kasa, stok düşümü ve fiş yazdırma işlemleri internet olmadan kesintisiz devam eder.",
  },
  {
    q: "Satış ve müşteri verilerim güvende mi?",
    a: "Verileriniz sizin seçtiğiniz cihaz dışına çıkmaz. Tüm veritabanı kendi bilgisayarınızda yerel olarak tutulur.",
  },
  {
    q: "KasaNova POS KDV ve termal fiş yazdırmayı destekliyor mu?",
    a: "Evet. Ürün bazlı KDV oranları, 80mm ESC/POS termal fiş yazıcıları ve imzalı/kaşeli A4 PDF fatura çıktıları tam olarak desteklenir.",
  },
  {
    q: "Çalıştırmak için hangi donanımlara ihtiyacım var?",
    a: "Windows, Linux veya macOS çalışan herhangi bir bilgisayar yeterlidir. USB barkod okuyucu ve termal fiş yazıcıları tak-çalıştır olarak desteklenir.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function HomePage() {
  return (
    <>
      <HomeAuthRedirect />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-20 px-4 py-12 sm:py-16">
        <section className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-14">
          <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
            <h1 className="max-w-xl text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Tamamen çevrimdışı çalışan yeni nesil POS yazılımı
            </h1>
            <p className="max-w-lg text-balance text-base text-foreground/70 sm:text-lg">
              KasaNova POS, perakende mağazaları ve işletmeler için hızlı satış noktası ve stok yönetim sistemidir.
              Kendi bilgisayarınızda barındırılır, abonelik ücreti yoktur ve satış yapmak için
              internet bağlantısı gerekmez.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition-all hover:-translate-y-px hover:opacity-90 hover:shadow-lg hover:shadow-brand/20"
              >
                Hemen Başlayın
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-border"
              >
                Giriş yap
              </Link>
            </div>
          </div>
          <div className="flex w-full justify-center lg:w-auto lg:justify-end">
            <ReceiptHero />
          </div>
        </section>

        <section aria-labelledby="features-heading" className="flex flex-col gap-6">
          <h2 id="features-heading" className="text-xl font-semibold text-foreground">
            İşletmeler neden KasaNova POS tercih ediyor?
          </h2>
          <div className="grid grid-cols-1 gap-x-8 divide-y divide-border rounded-xl border border-border sm:grid-cols-2 sm:divide-y-0">
            {FEATURES.map(({ icon: Icon, title: t, body }, i) => (
              <div
                key={t}
                className={`flex gap-4 px-5 py-5 ${i % 2 === 0 ? "sm:border-r sm:border-border" : ""} ${i >= 2 ? "sm:border-t sm:border-border" : ""}`}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                <div>
                  <h3 className="font-semibold text-foreground">{t}</h3>
                  <p className="mt-1 text-sm text-foreground/70">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="compare-heading" className="flex flex-col gap-6">
          <h2 id="compare-heading" className="text-xl font-semibold text-foreground">
            KasaNova POS ve tipik bulut POS yazılımı karşılaştırması
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="px-4 py-3 font-semibold text-foreground/70">&nbsp;</th>
                  <th className="px-4 py-3 font-semibold text-foreground">KasaNova POS</th>
                  <th className="px-4 py-3 font-semibold text-foreground/70">Tipik bulut POS</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map(([label, ours, theirs]) => (
                  <tr key={label} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium text-foreground/70">{label}</th>
                    <td className="px-4 py-3 text-foreground">{ours}</td>
                    <td className="px-4 py-3 text-foreground/60">{theirs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="faq-heading" className="flex flex-col gap-6">
          <h2 id="faq-heading" className="text-xl font-semibold text-foreground">
            Sıkça sorulan sorular
          </h2>
          <div className="divide-y divide-border rounded-xl border border-border">
            {FAQS.map((f) => (
              <details key={f.q} className="faq-row group px-5 py-4">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-medium text-foreground">
                  {f.q}
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-foreground/50 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-3 text-sm text-foreground/70">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface-muted px-6 py-10 pb-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground">Hemen kurun ve başlayın</h2>
          <p className="max-w-xl text-sm text-foreground/70">
            İşletim sisteminizi seçin ve tek bir komut çalıştırın — Docker&apos;ı kontrol eder, eksikse
            kurar, ardından KasaNova POS&apos;u kurar ve başlatır.
          </p>
          <QuickstartCommand />
          <p className="max-w-xl text-xs text-foreground/60">
            Kaynak koduna göz atmak için{" "}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              GitHub sayfasını ziyaret edin
            </a>
            .
          </p>
        </section>

        <BrandFooter />
      </main>
    </>
  );
}
