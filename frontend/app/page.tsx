import type { Metadata } from "next";
import Link from "next/link";
import {
  WifiOff,
  Lock,
  Receipt,
  ScanBarcode,
  Users,
  GitFork,
  ChevronDown,
} from "lucide-react";
import { BrandFooter } from "@/components/BrandFooter";
import { HomeAuthRedirect } from "@/components/HomeAuthRedirect";
import { QuickstartCommand } from "@/components/QuickstartCommand";
import { ReceiptHero } from "@/components/ReceiptHero";

const title = "Ücretsiz POS Yazılımı – Çevrimdışı, Açık Kaynak, Abonelik Yok";
const description =
  "nodedr-pos, küçük perakende mağazaları için ücretsiz, açık kaynaklı satış noktası yazılımıdır. Tamamen çevrimdışı çalışır, kendi bilgisayarınızda barındırılır, abonelik veya satış başına ücret yoktur, Türkiye için KDV destekli faturalama sunar.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description, url: "/" },
  twitter: { title, description },
};

const GITHUB_URL = "https://github.com/Raktim94/nodedr-pos";

const FEATURES = [
  {
    icon: WifiOff,
    title: "Tamamen çevrimdışı çalışır",
    body: "Satış, stok ve fiş yazdırma, Docker veya CasaOS aracılığıyla kendi makinenizde çalışır — satış yapmak için internet bağlantısı gerekmez.",
  },
  {
    icon: Lock,
    title: "Kendi sunucunuzda, verileriniz sizde",
    body: "Bulut hesabı yok, senkronize edilecek bir şey yok. Satış ve müşteri verileri, kontrolünüzdeki donanımda yerel bir veritabanında yaşar.",
  },
  {
    icon: Receipt,
    title: "Türkiye için KDV destekli faturalama",
    body: "KDV dahil fiyatlandırma, ürün bazında GTİP kodları ve her yazdırılan veya PDF fişte KDV dökümü.",
  },
  {
    icon: ScanBarcode,
    title: "Barkod okuma & etiket yazdırma",
    body: "USB barkod okuyucu ile oku ve sat, ayrıca henüz barkodu olmayan ürünler için etiket yazdırmak üzere yerleşik barkod oluşturucu.",
  },
  {
    icon: Users,
    title: "Müşteriler, borçlar & sadakat",
    body: "Müşteri borçlarını, mağaza kredisini ve puan bazlı sadakat programını üçüncü taraf bir CRM aboneliği olmadan takip edin.",
  },
  {
    icon: GitFork,
    title: "Açık kaynak, AGPL-3.0 lisanslı",
    body: "Tam kaynak kodu GitHub'da herkese açıktır. Fiyatlandırma, kimlik doğrulama ve fişlerin nasıl çalıştığını denetleyin — kapalı kaynak satıcı bağımlılığı yok.",
  },
];

const COMPARISON_ROWS: [string, string, string][] = [
  ["Aylık abonelik", "Yok — sonsuza dek ücretsiz", "Yaygın, terminal/konum başına"],
  ["İnternetsiz çalışır mı?", "Evet, tamamen çevrimdışı", "Genellikle canlı bağlantı gerektirir"],
  ["Verileriniz nerede?", "Kendi makinenizde", "Satıcının bulut sunucularında"],
  ["Kaynak kodu", "Açık kaynak (AGPL-3.0), denetlenebilir", "Kapalı kaynak"],
  ["KDV dahil Türkiye fiyatlandırması", "Varsayılan olarak dahil", "Değişir, genellikle eklenti"],
];

const FAQS = [
  {
    q: "nodedr-pos gerçekten ücretsiz mi, abonelik veya gizli ücret yok mu?",
    a: "Evet. AGPL-3.0 lisanslı ve açık kaynaklıdır — abonelik, işlem başına ücret veya ücretli katman yoktur. Zaten sahip olduğunuz donanımda veya düşük maliyetli bir VPS'te kendiniz barındırırsınız, böylece süregelen bir yazılım maliyeti yoktur.",
  },
  {
    q: "Bu ücretsiz POS yazılımı internetsiz çalışır mı?",
    a: "Evet. nodedr-pos kurulduktan sonra tamamen çevrimdışı çalışır. Uygulama ve veritabanı Docker Compose veya CasaOS aracılığıyla yerel olarak çalışır, böylece kasa ve fiş yazdırma internet bağlantısı olmadan da çalışmaya devam eder.",
  },
  {
    q: "Açık kaynaklı POS yazılımı satış ve müşteri verilerini işlemek için güvenli mi?",
    a: "Verileriniz, siz başka bir yerde barındırmayı seçmedikçe, asla tesisinizden ayrılmaz. Kod açık kaynaklı olduğu için, kapalı kaynaklı bir bulut satıcısına güvenmek yerine şifreleri, fiyatlandırmayı ve müşteri kayıtlarını nasıl işlediğini siz (veya herkes) denetleyebilirsiniz.",
  },
  {
    q: "nodedr-pos Türk perakendeciler için KDV faturalamasını destekliyor mu?",
    a: "Evet. Fiyatlandırma varsayılan olarak KDV dahildir, ürün bazında GTİP kodları ve her fişte KDV dökümü gösterilir.",
  },
  {
    q: "Bu ücretsiz POS sistemini çalıştırmak için neye ihtiyacım var?",
    a: "Docker Compose çalıştırabilen herhangi bir makine (Windows, Linux, Mac), bir CasaOS/ZimaOS kutusu veya macOS uygulaması. USB barkod okuyucu ve ESC/POS termal yazıcı desteklenir ancak isteğe bağlıdır.",
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
              Tamamen çevrimdışı çalışan ücretsiz POS yazılımı
            </h1>
            <p className="max-w-lg text-balance text-base text-foreground/70 sm:text-lg">
              nodedr-pos, küçük perakende mağazaları için açık kaynaklı satış noktası ve stok yazılımıdır.
              Kendi makinenizde barındırılır, abonelik yok, satış başına ücret yok ve satış yapmak için
              internet bağlantısı gerekmez.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition-all hover:-translate-y-px hover:opacity-90 hover:shadow-lg hover:shadow-brand/20"
              >
                Başlayın — ücretsiz
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-border"
              >
                Giriş yap
              </Link>
            </div>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-foreground/60 underline-offset-2 hover:text-foreground hover:underline"
            >
              <GitFork className="h-3.5 w-3.5" aria-hidden="true" />
              Kaynak kodu GitHub&apos;da görüntüle
            </a>
          </div>
          <div className="flex w-full justify-center lg:w-auto lg:justify-end">
            <ReceiptHero />
          </div>
        </section>

        <section aria-labelledby="features-heading" className="flex flex-col gap-6">
          <h2 id="features-heading" className="text-xl font-semibold text-foreground">
            Küçük mağazalar neden tercih ediyor?
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
            nodedr-pos ve tipik bulut POS yazılımı karşılaştırması
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="px-4 py-3 font-semibold text-foreground/70">&nbsp;</th>
                  <th className="px-4 py-3 font-semibold text-foreground">nodedr-pos</th>
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
          <h2 className="text-2xl font-semibold text-foreground">Ücretsiz başlayın</h2>
          <p className="max-w-xl text-sm text-foreground/70">
            İşletim sisteminizi seçin ve tek bir komut çalıştırın — Docker&apos;ı kontrol eder, eksikse
            kurar, ardından nodedr-pos&apos;u kurar ve başlatır. Kayıt yok, kredi kartı yok, deneme
            süresi yok.
          </p>
          <QuickstartCommand />
          <p className="max-w-xl text-xs text-foreground/60">
            CasaOS/ZimaOS kutunuz varsa uygulama mağazasından kurun. Veya{" "}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              tam kaynak kodunu GitHub&apos;da görüntüleyin
            </a>
            .
          </p>
        </section>

        <BrandFooter />
      </main>
    </>
  );
}
