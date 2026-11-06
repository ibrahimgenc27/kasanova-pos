"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Badge, Delta, PageHeader, StatCard } from "@/components/ui/Bits";
import { Button } from "@/components/ui/Button";
import { useShopSettings } from "@/hooks/useShopSettings";
import { useCompare, useOverview, type Row } from "@/hooks/useReports";
import { formatMoney } from "@/lib/format";
import { CATEGORY_COLORS } from "@/components/ReportsCharts";

const RevenueArea = dynamic(() => import("@/components/ReportsCharts").then((m) => m.RevenueArea), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-surface-muted" /> });
const CategoryDonut = dynamic(() => import("@/components/ReportsCharts").then((m) => m.CategoryDonut), { ssr: false, loading: () => <div className="h-52 animate-pulse rounded-xl bg-surface-muted" /> });

const WEEKDAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

export default function ReportsPage() {
  const { data: shop } = useShopSettings();
  const sym = shop?.currencySymbol ?? "₺";
  const money = (n: number) => formatMoney(n, sym);
  const [days, setDays] = useState(30);
  const [cmp, setCmp] = useState<"day" | "week" | "month">("week");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data, isLoading, error } = useOverview(days);
  const { data: compare } = useCompare(cmp);

  const maxHeat = Math.max(1, ...(data?.heatmap.flat().map((c) => c.bills) ?? [1]));
  const cats = (data?.categories ?? []).map((c: Row) => ({ name: c.category ?? "Diğer", value: c.net }));

  return (
    <div>
      <PageHeader
        title="Raporlar"
        subtitle={data ? `${data.range.from} → ${data.range.to}` : "Satış, kâr marjı ve vergi analizleri"}
        actions={
          <div role="group" aria-label="Tarih aralığı" className="flex rounded-xl border border-border bg-surface p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days === d}
                onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${days === d ? "bg-brand text-brand-foreground" : "text-foreground-muted hover:text-foreground"}`}
              >
                Son {d} Gün
              </button>
            ))}
          </div>
        }
      />
      {error && <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">Rapor verileri yüklenemedi.</p>}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          index={0}
          accent
          label="Ciro / Toplam Gelir"
          value={isLoading ? "…" : money(data?.totals.revenue ?? 0)}
          sub={data && <span className="text-white/80">{data.deltas.revenue >= 0 ? "▲" : "▼"} %{Math.abs(data.deltas.revenue)} önceki döneme göre</span>}
        />
        <StatCard
          index={1}
          label="Brüt Kâr"
          value={isLoading ? "…" : money(data?.totals.grossProfit ?? 0)}
          sub={data && <><Delta value={data.deltas.grossProfit} /> · %{data.totals.marginPct} marj</>}
        />
        <StatCard
          index={2}
          label="İşlem / Fiş Sayısı"
          value={isLoading ? "…" : data?.totals.bills ?? 0}
          sub={data && <Delta value={data.deltas.bills} />}
        />
        <StatCard
          index={3}
          label="Ortalama Sepet Tutarı"
          value={isLoading ? "…" : money(data?.totals.avgBill ?? 0)}
          sub={data && <Delta value={data.deltas.avgBill} />}
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rise card-surface p-5 lg:col-span-2" style={{ "--i": 4 } as React.CSSProperties}>
          <h2 className="mb-3 text-base font-semibold">Günlük Satış Trendi</h2>
          {data && <RevenueArea data={data.daily} sym={sym} />}
        </section>
        <section className="rise card-surface p-5" style={{ "--i": 5 } as React.CSSProperties}>
          <h2 className="mb-3 text-base font-semibold">Kategori Dağılımı</h2>
          {cats.length === 0 ? <p className="py-10 text-center text-sm text-foreground-muted">Bu dönemde satış kaydedilmedi.</p> : (
            <>
              <CategoryDonut data={cats} />
              <ul className="mt-2 space-y-1.5 text-sm">
                {data!.categories.map((c, i) => (
                  <li key={c.category} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{c.category}</span>
                    <span className="tabular text-foreground-muted">{money(c.net)}</span>
                    <Badge tone={c.marginPct >= 20 ? "good" : c.marginPct >= 10 ? "warn" : "bad"}>%{c.marginPct}</Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rise card-surface p-5 lg:col-span-2" style={{ "--i": 6 } as React.CSSProperties}>
          <h2 className="mb-1 text-base font-semibold">Müşteri Yoğunluk Saatleri</h2>
          <p className="mb-3 text-xs text-foreground-muted">Haftanın günlerine ve saatlere göre işlem sıklığı — koyu renkler en yoğun saatleri gösterir.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-1 text-[10px]" aria-label="Saatlik satış yoğunluk haritası">
              <thead>
                <tr>
                  <th className="w-9" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <th key={h} scope="col" className="font-normal text-foreground-muted">{h % 3 === 0 ? h : ""}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.heatmap ?? []).map((row, d) => (
                  <tr key={d}>
                    <th scope="row" className="pr-1 text-right font-medium text-foreground-muted">{WEEKDAYS[d]}</th>
                    {row.map((c, h) => (
                      <td key={h} title={`${WEEKDAYS[d]} ${h}:00 — ${c.bills} fiş, ${money(c.revenue)}`} className="h-5 rounded-[4px]" style={{ background: c.bills ? `color-mix(in srgb, var(--brand) ${Math.max(14, Math.round((c.bills / maxHeat) * 100))}%, transparent)` : "var(--surface-muted)" }}>
                        <span className="sr-only">{c.bills} fiş</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rise card-surface p-5" style={{ "--i": 7 } as React.CSSProperties}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Dönem Karşılaştırması</h2>
            <div role="group" aria-label="Karşılaştırma dönemi" className="flex rounded-lg border border-border p-0.5 text-xs">
              {(["day", "week", "month"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={cmp === p}
                  onClick={() => setCmp(p)}
                  className={`rounded-md px-2.5 py-1 font-medium capitalize ${cmp === p ? "bg-brand text-brand-foreground" : "text-foreground-muted"}`}
                >
                  {p === "day" ? "Gün" : p === "week" ? "Hafta" : "Ay"}
                </button>
              ))}
            </div>
          </div>
          {compare && (
            <dl className="space-y-3 text-sm">
              {([["Ciro", compare.current.revenue, compare.previous.revenue, compare.deltas.revenue, true], ["Brüt Kâr", compare.current.grossProfit, compare.previous.grossProfit, compare.deltas.grossProfit, true], ["Fiş Sayısı", compare.current.bills, compare.previous.bills, compare.deltas.bills, false]] as const).map(([label, cur, prev, d, isMoney]) => (
                <div key={label}>
                  <dt className="flex items-center justify-between text-foreground-muted"><span>{label}</span><Delta value={d} /></dt>
                  <dd className="tabular"><b className="text-base">{isMoney ? money(cur) : cur}</b> <span className="text-foreground-muted">karşılaştırma: {isMoney ? money(prev) : prev} ({cmp === "day" ? "düne göre" : cmp === "week" ? "geçen haftaya göre" : "geçen aya göre"})</span></dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>

      <section className="rise card-surface mb-4 overflow-x-auto p-5" style={{ "--i": 8 } as React.CSSProperties}>
        <h2 className="mb-3 text-base font-semibold">En Çok Satan Ürünler (Gelire Göre)</h2>
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs text-foreground-muted">
            <tr>
              <th className="py-2 pr-3">Ürün</th>
              <th className="py-2 pr-3 text-right">Adet</th>
              <th className="py-2 pr-3 text-right">Net Satış</th>
              <th className="py-2 pr-3 text-right">Kâr</th>
              <th className="py-2 text-right">Kâr Marjı</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(data?.topProducts ?? []).map((p, i) => (
              <tr key={`${p.name}-${i}`}>
                <td className="py-2 pr-3 font-medium">{p.name}</td>
                <td className="tabular py-2 pr-3 text-right">{p.qty}</td>
                <td className="tabular py-2 pr-3 text-right">{money(p.net)}</td>
                <td className="tabular py-2 pr-3 text-right">{money(p.profit)}</td>
                <td className="py-2 text-right">
                  <Badge tone={p.marginPct >= 20 ? "good" : p.marginPct >= 10 ? "warn" : "bad"}>%{p.marginPct}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && data.topProducts.length === 0 && <p className="py-6 text-center text-sm text-foreground-muted">Bu dönemde satış kaydedilmedi.</p>}
      </section>

      <section className="rise card-surface p-5" style={{ "--i": 9 } as React.CSSProperties}>
        <h2 className="mb-1 text-base font-semibold">Vergi ve Muhasebe Raporu İndir</h2>
        <p className="mb-3 text-sm text-foreground-muted">KDV beyannameleri, muhasebe entegrasyonu ve gelir/gider denetimleri için CSV formatında dışa aktarın.</p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">Ay Seçin
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm" />
          </label>
          {(["b2cs", "b2b", "hsn", "docs", "cdn"] as const).map((sec) => (
            <a key={sec} href={`/api/reports/gstr1.csv?month=${month}&section=${sec}`} download>
              <Button variant="secondary" type="button"><FileSpreadsheet className="h-4 w-4" aria-hidden="true" /> {sec === "b2b" ? "Kurumsal Fatura (B2B)" : sec === "b2cs" ? "Perakende Fatura (B2C)" : sec === "hsn" ? "GTİP/Ürün Kodu Özeti" : sec === "docs" ? "Belge Dökümü" : "İade / Fiyat Farkı"} (CSV)</Button>
            </a>
          ))}
          <a href={`/api/reports/tax-summary.csv?from=${month}-01&to=${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, "0")}`} download>
            <Button variant="secondary" type="button"><Download className="h-4 w-4" aria-hidden="true" /> KDV & Vergi Özeti</Button>
          </a>
        </div>
      </section>
    </div>
  );
}
