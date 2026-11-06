"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CircleDollarSign, Download, ShoppingBag, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, Delta, PageHeader } from "@/components/ui/Bits";
import { useLowStock } from "@/hooks/useProducts";
import { useInvoices, useSalesAnalytics, useSalesSummary } from "@/hooks/useInvoices";
import { useDueSummary, useTopDueCustomers } from "@/hooks/useCustomers";
import { useShopSettings } from "@/hooks/useShopSettings";
import { useMe } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { can } from "@/lib/perm";
import { formatMoney } from "@/lib/format";
import type { Order } from "@/lib/types";

const SalesCharts = dynamic(() => import("@/components/SalesCharts").then((m) => m.SalesCharts), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl bg-surface-muted" /> });

const pct = (cur?: number, prev?: number) => (cur == null || prev == null || prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10);

export default function DashboardPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: shop } = useShopSettings();
  const { data: lowStock } = useLowStock();
  const { data: summary } = useSalesSummary();
  const { data: invoices } = useInvoices();
  const { data: analytics } = useSalesAnalytics();
  const { data: dueSummary } = useDueSummary();
  const { data: topDue } = useTopDueCustomers(5);
  const wantsOrders = can(me, "orders");
  const { data: orders } = useQuery({ queryKey: ["orders", "open"], queryFn: () => api.get<Order[]>("/orders?status=NEW,PACKING,READY"), enabled: wantsOrders, refetchInterval: 15_000, refetchOnWindowFocus: true });

  // Franchise hesapları sadece konsolide hub görünümlerini görür.
  useEffect(() => {
    if (me?.role === "franchisor") router.replace("/branches");
  }, [me, router]);

  const sym = shop?.currencySymbol || "₺";
  const money = (n: number) => formatMoney(n, sym);
  const trend = analytics?.trend ?? [];
  const today = trend.at(-1);
  const yesterday = trend.at(-2);
  const revDelta = pct(today?.revenue, yesterday?.revenue);
  const salesDelta = pct(today?.count, yesterday?.count);
  const maxRev = Math.max(1, ...trend.map((t) => t.revenue));
  const prior = trend.slice(0, -1);
  const avg = prior.length ? prior.reduce((s, t) => s + t.revenue, 0) / prior.length : 0;
  const ringPct = avg > 0 ? Math.min(100, Math.round(((today?.revenue ?? 0) / avg) * 100)) : 0;
  const LEN = 2 * Math.PI * 42;

  return (
    <div>
      <PageHeader
        title={`İyi ${new Date().getHours() < 12 ? "sabahlar" : new Date().getHours() < 18 ? "günler" : "akşamlar"}${me ? `, ${me.name.split(" ")[0]}` : ""}`}
        subtitle="İşte mağazanızın durumu."
        actions={<a href="/api/invoices/export.csv" download><Button variant="secondary" type="button"><Download className="h-4 w-4" aria-hidden="true" /> Satış CSV</Button></a>}
      />

      {/* Bento: kısa KPI kartları, büyük grafik, halka, sonra listeler. */}
      <div className="grid grid-cols-12 gap-4">
        <Kpi i={0} span="col-span-6 lg:col-span-3" accent icon={TrendingUp} label="Bugünkü ciro" value={money(summary?.todaysRevenue ?? 0)} sub={revDelta != null && <span className="text-white/80">{revDelta >= 0 ? "▲" : "▼"} {Math.abs(revDelta)}% düne göre</span>} />
        <Kpi i={1} span="col-span-6 lg:col-span-3" icon={ShoppingBag} label="Bugünkü fişler" value={String(summary?.todaysCount ?? 0)} sub={salesDelta != null && <Delta value={salesDelta} />} />
        <Kpi i={2} span="col-span-6 lg:col-span-3" icon={AlertTriangle} label="Düşük stok" value={String(lowStock?.products.length ?? 0)} tone={lowStock?.products.length ? "warn" : undefined} sub={<Link href="/inventory" className="underline-offset-2 hover:underline">Stoku incele</Link>} />
        <Kpi i={3} span="col-span-6 lg:col-span-3" icon={CircleDollarSign} label="Müşteri borçları" value={money(dueSummary?.totalDue ?? 0)} tone={dueSummary?.totalDue ? "bad" : undefined} sub={`${dueSummary?.customersWithDue ?? 0} müşteri`} />

        <section className="rise card-surface col-span-12 p-5 lg:col-span-8" style={{ "--i": 4 } as React.CSSProperties}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[0.95rem] font-semibold tracking-tight">Son 14 günlük ciro</h2>
            <span className="text-xs text-foreground-muted">zirve {money(maxRev)}</span>
          </div>
          {trend.some((t) => t.revenue > 0) ? (
            <>
              <div className="flex h-40 items-end gap-1.5 sm:gap-2" role="img" aria-label={`Son ${trend.length} günün günlük cirosu; bugün ${money(today?.revenue ?? 0)}`}>
                {trend.map((t, i) => (
                  <div key={t.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${new Date(t.date).toLocaleDateString("tr-TR")} — ${money(t.revenue)} · ${t.count} fiş`}>
                    <div className="bar-grow w-full max-w-[26px] rounded-md" style={{ height: `${Math.max(6, (t.revenue / maxRev) * 100)}%`, background: i === trend.length - 1 ? "#2563eb" : "#cbd5e1", "--i": i } as React.CSSProperties} />
                    <span className="text-[10px] text-foreground-muted">{new Date(t.date).toLocaleDateString("tr-TR", { weekday: "narrow" })}</span>
                  </div>
                ))}
              </div>
              <table className="sr-only"><caption>Günlük ciro</caption><tbody>{trend.map((t) => <tr key={t.date}><th scope="row">{t.date}</th><td>{money(t.revenue)}</td></tr>)}</tbody></table>
            </>
          ) : <p className="py-14 text-center text-sm text-foreground-muted">Trend grafik çizmek için yeterli satış yok.</p>}
        </section>

        <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
          <section className="rise card-surface flex items-center gap-4 p-5" style={{ "--i": 5 } as React.CSSProperties}>
            <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0 -rotate-90" role="img" aria-label={`Bugün günlük ortalamanızın %${ringPct}'inde`}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--surface-muted)" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" strokeDasharray={LEN} strokeDashoffset={LEN * (1 - ringPct / 100)} className="ring-arc" style={{ "--len": LEN } as React.CSSProperties} />
            </svg>
            <div>
              <p className="num-xl">{ringPct}%</p>
              <p className="text-xs text-foreground-muted">bugüne kadar günlük ortalama cironuzun yüzdesi</p>
            </div>
          </section>
        </div>

        <ListCard i={6} span="lg:col-span-4" title="Düşük stoklu ürünler" href="/inventory" empty={`Tüm ürünler ${lowStock?.threshold ?? 5} üzerinde.`} rows={(lowStock?.products ?? []).slice(0, 6).map((p) => ({ k: p.id, a: p.name, b: p.barcode, end: <Badge tone="warn">{Math.round(p.stock * 1000) / 1000} kaldı</Badge> }))} />
        {wantsOrders ? (
          <ListCard i={7} span="lg:col-span-4" title="Bekleyen online siparişler" href="/orders" empty="Açık sipariş yok." rows={(orders ?? []).slice(0, 6).map((o) => ({ k: o.id, a: o.customerName, b: `${o.pickupCode} · ${o.items.length} ürün`, end: <Badge tone={o.status === "READY" ? "good" : "brand"}>{o.status === "NEW" ? "yeni" : o.status === "PACKING" ? "hazırlanıyor" : o.status === "READY" ? "hazır" : o.status.toLowerCase()}</Badge> }))} />
        ) : (
          <ListCard i={7} span="lg:col-span-4" title="Son faturalar" href="/sales" empty="Henüz satış yok." rows={(invoices ?? []).slice(0, 6).map((v) => ({ k: v.id, a: v.invoiceNumber, b: v.customerName, end: <span className="tabular text-sm font-semibold">{money(v.totalAmount)}</span> }))} />
        )}
        <ListCard i={8} span="lg:col-span-4" title="Borçlu müşteriler" href="/customers" empty="Ödenmemiş borç yok." rows={(topDue ?? []).map((c) => ({ k: c.id, a: c.name, b: c.phone, end: <Badge tone="bad">{money(c.totalDue)}</Badge> }))} />
      </div>

      <div className="mt-4"><SalesCharts sym={sym} /></div>
    </div>
  );
}

function Kpi({ i, span, icon: Icon, label, value, sub, accent, tone }: { i: number; span: string; icon: React.ElementType; label: string; value: string; sub?: React.ReactNode; accent?: boolean; tone?: "warn" | "bad" }) {
  return (
    <div className={`rise ${span} rounded-xl border p-5 ${accent ? "border-slate-800 bg-slate-900 text-white shadow-sm" : "card-surface"}`} style={{ "--i": i } as React.CSSProperties}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${accent ? "text-white/80" : tone === "bad" ? "text-danger" : tone === "warn" ? "text-warning" : "text-brand"}`} aria-hidden="true" />
        <p className={`text-xs font-medium ${accent ? "text-white/75" : "text-foreground-muted"}`}>{label}</p>
      </div>
      <p className="num-xl mt-3 truncate">{value}</p>
      {sub && <div className={`mt-2 text-xs ${accent ? "text-white/75" : "text-foreground-muted"}`}>{sub}</div>}
    </div>
  );
}

function ListCard({ i, span, title, href, rows, empty }: { i: number; span: string; title: string; href: string; rows: { k: number; a: string; b: string; end: React.ReactNode }[]; empty: string }) {
  return (
    <section className={`rise card-surface col-span-12 p-5 ${span}`} style={{ "--i": i } as React.CSSProperties}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[0.95rem] font-semibold tracking-tight">{title}</h2>
        <Link href={href} className="text-xs font-medium text-brand hover:underline">Tümünü gör</Link>
      </div>
      {rows.length === 0 ? <p className="py-6 text-center text-sm text-foreground-muted">{empty}</p> : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.k} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{r.a}</p><p className="truncate text-xs text-foreground-muted">{r.b}</p></div>
              {r.end}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
