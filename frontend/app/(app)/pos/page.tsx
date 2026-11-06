"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Camera, Minus, Plus, ScanBarcode, Trash2, Search, CheckCircle2, X, Monitor, Scale, Smartphone, Hash, Volume2, VolumeX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ReceiptActions } from "@/components/ReceiptActions";
import { ReturnPanel, type ReturnDraftLine } from "@/components/ReturnPanel";
import { CameraScannerModal } from "@/components/CameraScannerModal";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useProducts } from "@/hooks/useProducts";
import { useShopSettings } from "@/hooks/useShopSettings";
import { useToast } from "@/components/Toast";
import { usePasswordConfirm } from "@/components/PasswordConfirm";
import { api, ApiError, describeApiError } from "@/lib/api";
import { formatMoney, round2 } from "@/lib/format";
import { openReceiptPrint } from "@/lib/print";
import { effectivePrice, quoteSale } from "@/lib/quote";
import { postDisplay } from "@/lib/display";
import { paymentSoundEnabled, playPaymentConfirmation, setPaymentSoundEnabled } from "@/lib/paymentSound";
import { readScaleKg, scaleSupported } from "@/lib/scale";
import { SerialPrompt } from "@/components/pos/SerialPrompt";
import { UpiQr } from "@/components/pos/UpiQr";
import { CustomerDisplayLink } from "@/components/pos/CustomerDisplayLink";
import { TerminalCharge } from "@/components/pos/TerminalCharge";
import { ShareActions } from "@/components/pos/ShareActions";
import type { CartItem, Customer, Invoice, PaymentMethod, Product } from "@/lib/types";

const FRACTIONAL_UNITS = ["KG", "KGS", "GR", "GMS", "LT", "LTR", "ML", "MLT", "MTR", "MT", "CMS", "SQM", "M2", "CBM", "M3"];
const isFractional = (p: Product) => !p.trackSerial && !!p.unit && FRACTIONAL_UNITS.includes(p.unit.toUpperCase());
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export default function PosPage() {
  const { data: shop } = useShopSettings();
  const { show } = useToast();
  const { withPasswordConfirm } = usePasswordConfirm();
  const queryClient = useQueryClient();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [duePaid, setDuePaid] = useState("");
  const [returnLines, setReturnLines] = useState<ReturnDraftLine[]>([]);
  const [refundMode, setRefundMode] = useState<"CASH" | "CREDIT">("CASH");
  const [useCredit, setUseCredit] = useState(false);
  const [discountType, setDiscountType] = useState<"percent" | "amount" | null>(null);
  const [discountValue, setDiscountValue] = useState(0);
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [upiUri, setUpiUri] = useState<string | null>(null);
  const [displayLinkOpen, setDisplayLinkOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => setSoundOn(paymentSoundEnabled()), []);
  const [amountPaid, setAmountPaid] = useState("");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [completedSale, setCompletedSale] = useState<{ id: number; invoiceNumber: string; totalAmount: number } | null>(null);
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [serialFor, setSerialFor] = useState<Product | null>(null);
  const [gstin, setGstin] = useState("");
  const [payCurrency, setPayCurrency] = useState("");
  const [terminalPaymentId, setTerminalPaymentId] = useState<string | null>(null);
  const [scaleBusy, setScaleBusy] = useState<number | null>(null);
  const { data: fx } = useQuery({ queryKey: ["fx"], queryFn: () => api.get<{ base: string; rates: Record<string, number> }>("/payments/fx"), staleTime: 60_000 });
  const fxCodes = Object.keys(fx?.rates ?? {});
  const fxRate = payCurrency && fx?.rates[payCurrency] ? fx.rates[payCurrency] : 0;

  const [manualQuery, setManualQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setCommittedQuery(manualQuery.trim()), 200);
    return () => clearTimeout(t);
  }, [manualQuery]);
  const { data: manualResults } = useProducts(committedQuery);

  const sym = shop?.currencySymbol || "₺";
  const money = (n: number) => formatMoney(n, sym);

  const quote = useMemo(
    () => quoteSale({ cart, discountType, discountValue, pointsRedeemed, settings: shop }),
    [cart, discountType, discountValue, pointsRedeemed, shop]
  );

  const dueToClear = customer ? Math.min(Math.max(0, Number(duePaid) || 0), customer.totalDue) : 0;
  const returnTotal = round2(returnLines.reduce((s, l) => s + l.refundAmount, 0));
  const creditAvail = customer?.creditBalance ?? 0;
  const creditUse = useCredit ? round2(Math.min(creditAvail, Math.max(0, quote.total - returnTotal))) : 0;

  const netBill = round2(quote.total - returnTotal - creditUse);
  const payable = Math.max(0, netBill);
  const grossRefund = Math.max(0, round2(-netBill));

  const tenderedCash = paymentMethod === "CASH" ? Number(amountPaid) || 0 : payable + dueToClear;
  const pool = round2(tenderedCash + grossRefund);
  const amountAppliedToGoods = round2(Math.min(pool, payable));
  const afterGoods = round2(Math.max(0, pool - amountAppliedToGoods));
  const duePaidFinal = round2(Math.min(dueToClear, afterGoods));
  const leftover = round2(Math.max(0, afterGoods - duePaidFinal));
  const changeDue = grossRefund > 0 ? 0 : leftover;
  const refundValue = grossRefund > 0 ? leftover : 0;

  const collectTotal = round2(payable + dueToClear);
  const shortNow =
    paymentMethod === "CASH" && Number(amountPaid) > 0 && grossRefund === 0
      ? Math.max(0, round2(collectTotal - (Number(amountPaid) || 0)))
      : 0;

  const addToCart = useCallback(
    (product: Product, serial?: string) => {
      setCompletedSale(null);
      const asksSerial = Boolean(shop?.serialTracking && product.trackSerial);
      if (asksSerial && !serial) {
        setSerialFor(product);
        return;
      }
      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (asksSerial && serial) {
          if (existing?.serials?.includes(serial)) {
            show(`${serial} seri numarası bu fişte zaten mevcut`, "error");
            return prev;
          }
          if (!existing) return [...prev, { product, quantity: 1, serials: [serial] }];
          return prev.map((i) => (i.product.id === product.id ? { ...i, quantity: i.quantity + 1, serials: [...(i.serials ?? []), serial] } : i));
        }
        if (!existing) return [...prev, { product, quantity: 1 }];
        if (!shop?.allowNegativeStock && existing.quantity + 1 > product.stock + 1e-9) {
          show(`"${product.name}" için mevcut stok yalnızca ${r3(product.stock)}`, "error");
          return prev;
        }
        return prev.map((item) => (item.product.id === product.id ? { ...item, quantity: r3(item.quantity + 1) } : item));
      });
    },
    [show, shop?.allowNegativeStock, shop?.serialTracking]
  );

  const handleScan = useCallback(
    async (code: string) => {
      try {
        const r = await api.get<{ type: "product"; product: Product }>(`/products/scan/${encodeURIComponent(code)}`);
        addToCart(r.product);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          try {
            const c = await api.get<Customer>(`/customers/by-card/${encodeURIComponent(code)}`);
            setCustomer(c);
            setCustomerName(c.name);
            setCustomerPhone(c.phone);
            show(`${c.name} — ${c.loyaltyPoints} puan`, "success");
            return;
          } catch {
            /* fall through */
          }
          show("Bu koda ait ürün veya müşteri kartı bulunamadı.", "error");
        } else show("Sorgulama başarısız oldu", "error");
      }
    },
    [addToCart, show]
  );

  async function lookupCustomer(phoneOverride?: string) {
    const phone = (phoneOverride ?? customerPhone).trim();
    if (!phone) return;
    try {
      const c = await api.get<Customer>(`/customers/phone/${encodeURIComponent(phone)}`);
      setCustomer(c);
      setCustomerName(c.name);
      setDuePaid("");
      show(`${c.name} — ${c.loyaltyPoints} puan`, "success");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setCustomer(null);
        show("Yeni müşteri — satış onaylandığında kartı açılacaktır", "info");
      } else {
        show("Müşteri sorgulanamadı", "error");
      }
    }
  }

  function onReturnInvoiceFound(info: { customerPhone: string | null; customerName: string }) {
    if (!info.customerPhone) return;
    setCustomerPhone(info.customerPhone);
    setCustomerName(info.customerName);
    if (customer?.phone !== info.customerPhone) lookupCustomer(info.customerPhone);
  }

  const resetSale = () => {
    setCart([]);
    setCustomer(null);
    setCustomerName("");
    setCustomerPhone("");
    setDuePaid("");
    setReturnLines([]);
    setRefundMode("CASH");
    setUseCredit(false);
    setDiscountType(null);
    setDiscountValue(0);
    setPointsRedeemed(0);
    setPaymentMethod("CASH");
    setAmountPaid("");
    setGstin("");
    setPayCurrency("");
    setTerminalPaymentId(null);
  };

  const canFinalize = cart.length > 0 || returnLines.length > 0 || dueToClear > 0;

  const finalizeSale = useCallback(async () => {
    if (!canFinalize || isCheckingOut) return;
    setIsCheckingOut(true);
    try {
      const returnsPayload = Object.values(
        returnLines.reduce(
          (acc, l) => {
            (acc[l.invoiceId] ??= { invoiceId: l.invoiceId, items: [] }).items.push({
              invoiceItemId: l.invoiceItemId,
              quantity: l.quantity,
              refundAmount: l.refundAmount,
            });
            return acc;
          },
          {} as Record<number, { invoiceId: number; items: { invoiceItemId: number; quantity: number; refundAmount: number }[] }>
        )
      );

      const submitCheckout = (confirmPassword?: string) =>
        api.post<Invoice>("/invoices", {
          customerName,
          customerPhone,
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity, ...(item.serials?.length ? { serials: item.serials } : {}) })),
          discountType,
          discountValue: Number(discountValue) || 0,
          pointsRedeemed: Number(pointsRedeemed) || 0,
          paymentMethod,
          amountPaid: paymentMethod === "CASH" ? (payCurrency && fxRate ? round2((Number(amountPaid) || 0) * fxRate) : Number(amountPaid) || 0) : 0,
          ...(gstin.trim() ? { customerGstin: gstin.trim().toUpperCase() } : {}),
          ...(payCurrency && fxRate ? { payCurrency } : {}),
          ...(terminalPaymentId ? { terminalPaymentId } : {}),
          duePaid: dueToClear,
          returns: returnsPayload,
          refundMode,
          creditApplied: creditUse,
          confirmPassword,
        });

      const invoice =
        returnsPayload.length > 0
          ? await withPasswordConfirm("iade işlemini onaylamak", (confirmPassword) => submitCheckout(confirmPassword))
          : await submitCheckout();
      if (!invoice) return;

      const parts = [`${invoice.invoiceNumber} · ${money(invoice.totalAmount)}`];
      if (invoice.previousDuePaid > 0) parts.push(`${money(invoice.previousDuePaid)} borç ödendi`);
      if (invoice.refundValue > 0)
        parts.push(`${money(invoice.refundValue)} iade edildi (${invoice.refundMode === "CREDIT" ? "mağaza bakiyesi" : "nakit"})`);
      show(`Tamamlandı — ${parts.join(" · ")}`, "success");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCompletedSale({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.totalAmount });
      const paidCash = invoice.paymentMethod === "CASH";
      playPaymentConfirmation(`${money(invoice.totalAmount)}`, !paidCash);
      resetSale();
      if (paidCash && shop?.cashDrawer && shop.autoPrintMethod !== "usb") api.post("/print/drawer").catch(() => {});
      if (shop?.autoPrintReceipt) {
        if (shop.autoPrintMethod === "usb") {
          api.post(`/print/${invoice.id}/usb`).catch((err) =>
            show(err instanceof ApiError ? err.message : "USB fiş yazıcıya gönderme başarısız oldu", "error")
          );
        } else {
          setTimeout(() => openReceiptPrint(invoice.id), 0);
        }
      }
    } catch (err) {
      show(describeApiError(err, "Satış tamamlanamadı"), "error");
    } finally {
      setIsCheckingOut(false);
    }
  }, [gstin, payCurrency, fxRate, terminalPaymentId, shop?.cashDrawer, cart, returnLines, refundMode, creditUse, customerName, customerPhone, discountType, discountValue, pointsRedeemed, paymentMethod, amountPaid, dueToClear, canFinalize, isCheckingOut, queryClient, show, withPasswordConfirm, shop?.autoPrintReceipt, shop?.autoPrintMethod]);

  useBarcodeScanner({
    onScan: handleScan,
    onManualEnter: (event) => {
      const target = event.target as HTMLElement | null;
      const editable = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (editable) return;
      finalizeSale();
    },
  });

  function setQuantity(productId: number, qty: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId || (item.serials && item.serials.length > 0)) return item;
          const q = r3(qty);
          if (q > 0 && !shop?.allowNegativeStock && q > item.product.stock + 1e-9) {
            show(`"${item.product.name}" için stok yalnızca ${r3(item.product.stock)} adet`, "error");
            return item;
          }
          return { ...item, quantity: q };
        })
        .filter((item) => item.quantity > 0)
    );
  }
  const updateQuantity = (productId: number, delta: number) => {
    const cur = cart.find((i) => i.product.id === productId);
    if (cur) setQuantity(productId, cur.quantity + delta);
  };

  async function weigh(productId: number) {
    setScaleBusy(productId);
    try {
      setQuantity(productId, await readScaleKg());
    } catch (e) {
      show(e instanceof Error ? e.message : "Teraziden ağırlık okunamadı", "error");
    } finally {
      setScaleBusy(null);
    }
  }

  useEffect(() => {
    postDisplay({
      shopName: shop?.shopName ?? "",
      symbol: sym,
      lines: cart.map((i) => ({ name: i.product.name, qty: i.quantity, unit: i.product.unit, price: effectivePrice(i.product), total: round2(effectivePrice(i.product) * i.quantity) })),
      subtotal: quote.subtotal,
      discount: quote.discountAmount,
      tax: quote.taxAmount,
      total: quote.total,
      upiUri: paymentMethod === "UPI" && collectTotal > 0 ? upiUri : null,
      thankYou: cart.length === 0 && !!completedSale,
    });
  }, [cart, quote, shop?.shopName, sym, completedSale, paymentMethod, collectTotal, upiUri]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">POS Hızlı Satış</h1>
          <p className="flex items-center gap-1.5 text-sm text-foreground/60">
            <ScanBarcode className="h-4 w-4" aria-hidden="true" />
            Ürün eklemek için barkod okutun. Satışı tamamlamak için Enter&apos;a basın.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setDisplayLinkOpen(true)}>
            <Monitor className="h-4 w-4" aria-hidden="true" />
            Müşteri Ekranı
          </Button>
          <Button
            type="button"
            variant="secondary"
            aria-pressed={soundOn}
            title="Satış tamamlandığında sesli onay ve ödeme uyarısı"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setPaymentSoundEnabled(next);
              if (next) playPaymentConfirmation(money(0).replace(/[\d.,]+/, "test"), false);
            }}
          >
            {soundOn ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
            Sesli Bildirim {soundOn ? "Açık" : "Kapalı"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setCameraScannerOpen(true)}>
            <Camera className="h-4 w-4" aria-hidden="true" />
            Kamera ile Oku
          </Button>
        </div>
      </div>

      {displayLinkOpen && <CustomerDisplayLink onClose={() => setDisplayLinkOpen(false)} />}
      {cameraScannerOpen && (
        <CameraScannerModal
          onClose={() => setCameraScannerOpen(false)}
          onScan={(code) => {
            setCameraScannerOpen(false);
            handleScan(code);
          }}
        />
      )}

      {serialFor && (
        <SerialPrompt
          product={serialFor}
          existing={cart.find((i) => i.product.id === serialFor.id)?.serials ?? []}
          onClose={() => setSerialFor(null)}
          onDone={(serials) => {
            const product = serialFor;
            setCart((prev) => {
              const rest = prev.filter((i) => i.product.id !== product.id);
              return serials.length ? [...rest, { product, quantity: serials.length, serials }] : rest;
            });
            setSerialFor(null);
          }}
        />
      )}
      {completedSale && (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-brand/30 bg-brand/5 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-brand" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {completedSale.invoiceNumber} · {money(completedSale.totalAmount)}
              </p>
              <p className="text-xs text-foreground/60">
                {shop?.autoPrintReceipt ? "Satış tamamlandı — fiş yazıcıya iletildi." : "Satış tamamlandı — fişi yazdırabilir veya paylaşabilirsiniz."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ReceiptActions invoiceId={completedSale.id} />
            <ShareActions invoiceId={completedSale.id} />
            <Button type="button" variant="ghost" onClick={() => setCompletedSale(null)}>
              Kapat
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cart */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold text-foreground">Sepet</h2>

          <div className="relative mb-4">
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-foreground/40" aria-hidden="true" />
              <input
                type="text"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder="Barkod okuyucu yok mu? Ürün adı veya barkod ile arayın…"
                aria-label="Manuel ürün ara"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/40"
              />
              {manualQuery && (
                <button
                  type="button"
                  aria-label="Aramayı temizle"
                  onClick={() => setManualQuery("")}
                  className="text-foreground/40 hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
            {committedQuery && (
              <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg">
                {!manualResults ? (
                  <p className="px-3 py-2.5 text-sm text-foreground/50">Aranıyor…</p>
                ) : manualResults.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-foreground/50">&ldquo;{committedQuery}&rdquo; ile eşleşen ürün bulunamadı.</p>
                ) : (
                  manualResults.slice(0, 8).map((p) => {
                    const outOfStock = p.stock <= 0 && !shop?.allowNegativeStock;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => {
                          addToCart(p);
                          setManualQuery("");
                          setCommittedQuery("");
                        }}
                        className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                          {p.name}
                          {p.barcode && <span className="ml-1.5 font-normal text-foreground/40">· {p.barcode}</span>}
                        </span>
                        <span className="shrink-0 text-foreground/70">{money(effectivePrice(p))}</span>
                        <span className={`shrink-0 text-xs ${outOfStock ? "text-danger" : "text-foreground/40"}`}>
                          {outOfStock ? "Stokta yok" : `${r3(p.stock)} adet stokta`}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="py-10 text-center text-sm text-foreground/50">Sepetiniz boş. Satışa başlamak için ürün barkodu okutun.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-foreground/50">
                    <th className="py-2 pr-4">Ürün</th>
                    <th className="py-2 pr-4">Miktar</th>
                    <th className="py-2 pr-4 text-right">Birim Fiyat</th>
                    {shop?.gstEnabled && <th className="py-2 pr-4 text-right">KDV</th>}
                    <th className="py-2 pr-4 text-right">Toplam</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cart.map((item) => (
                    <tr key={item.product.id}>
                      <td className="py-2.5 pr-4 font-medium text-foreground">
                        {item.product.name}
                        {item.product.unit && <span className="ml-1.5 font-normal text-foreground/40">({item.product.unit})</span>}
                        {item.serials && item.serials.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.serials.map((sn) => (
                              <span key={sn} className="inline-flex items-center gap-0.5 rounded-full bg-brand-soft px-2 py-0.5 font-mono text-[11px] font-normal text-brand">
                                <Hash className="h-3 w-3" aria-hidden="true" />
                                {sn}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        {item.serials && item.serials.length > 0 ? (
                          <button type="button" onClick={() => setSerialFor(item.product)} className="rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-muted">
                            {item.quantity} adet · seri no düzenle
                          </button>
                        ) : isFractional(item.product) ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              step="0.001"
                              aria-label={`${item.product.name} miktarı`}
                              value={item.quantity}
                              onChange={(e) => setQuantity(item.product.id, Number(e.target.value) || 0)}
                              className="tabular w-24 rounded-md border border-border bg-surface px-2 py-1 text-sm"
                            />
                            {scaleSupported() && (
                              <button type="button" aria-label={`${item.product.name} teraziden tart`} disabled={scaleBusy === item.product.id} onClick={() => weigh(item.product.id)} className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-surface-muted" title="Elektronik Teraziden Oku">
                                <Scale className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              aria-label={`${item.product.name} azalt`}
                              onClick={() => updateQuantity(item.product.id, -1)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-surface-muted"
                            >
                              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <span className="tabular w-6 text-center">{item.quantity}</span>
                            <button
                              type="button"
                              aria-label={`${item.product.name} artır`}
                              onClick={() => updateQuantity(item.product.id, 1)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-surface-muted"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-foreground/70">
                        {money(effectivePrice(item.product))}
                        {item.product.discountType && item.product.discountValue > 0 && (
                          <div className="text-xs text-success">
                            -{item.product.discountType === "percent" ? `%${item.product.discountValue}` : money(item.product.discountValue)}
                          </div>
                        )}
                      </td>
                      {shop?.gstEnabled && (
                        <td className="py-2.5 pr-4 text-right text-foreground/50">%{item.product.taxRate}</td>
                      )}
                      <td className="py-2.5 pr-4 text-right font-medium text-foreground">
                        {money(effectivePrice(item.product) * item.quantity)}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          aria-label={`${item.product.name} sepetten sil`}
                          onClick={() => setCart((p) => p.filter((i) => i.product.id !== item.product.id))}
                          className="text-foreground/40 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Checkout panel */}
        <div className="flex flex-col gap-4">
          {/* Customer */}
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-base font-semibold text-foreground">Müşteri Bilgisi</h2>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field
                  label="Telefon Numarası"
                  value={customerPhone}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    setCustomer(null);
                    setPointsRedeemed(0);
                  }}
                  placeholder="Sadakat puanı & veresiye için"
                />
              </div>
              <Button type="button" variant="secondary" onClick={() => lookupCustomer()} aria-label="Müşteri ara">
                <Search className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <Field
              label="Müşteri Adı (İsteğe Bağlı)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Genel Müşteri"
            />
            {shop?.gstEnabled && (
              <Field label="VKN / TCKN (Kurumsal Fatura)" value={gstin} maxLength={15} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="11 haneli TCKN veya 10 haneli VKN" />
            )}
          </Card>

          {/* Returns / exchange */}
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-base font-semibold text-foreground">İade & Değişim</h2>
            <ReturnPanel
              sym={sym}
              drafted={returnLines}
              onAdd={(lines) => setReturnLines((prev) => [...prev, ...lines])}
              onInvoiceFound={onReturnInvoiceFound}
            />
            {returnLines.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                {returnLines.map((l) => (
                  <div key={`${l.invoiceId}:${l.invoiceItemId}`} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex-1 truncate text-foreground/80">
                      {l.quantity}× {l.name}
                      <span className="ml-1 text-xs text-foreground/40">({l.invoiceNumber})</span>
                    </span>
                    <span className="text-foreground">- {money(l.refundAmount)}</span>
                    <button
                      type="button"
                      aria-label={`${l.name} iadesini kaldır`}
                      onClick={() => setReturnLines((prev) => prev.filter((x) => !(x.invoiceId === l.invoiceId && x.invoiceItemId === l.invoiceItemId)))}
                      className="text-foreground/40 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1 text-sm font-medium">
                  <span className="text-foreground/60">İade Toplamı</span>
                  <span className="text-foreground">- {money(returnTotal)}</span>
                </div>
              </div>
            )}
            {refundValue > 0 && (
              <div className="rounded-lg bg-warning/10 p-3">
                <p className="text-sm font-medium text-warning">Müşteriye Ödenecek İade: {money(refundValue)}</p>
                <p className="mb-2 mt-0.5 text-xs text-foreground/60">İade tutarı alışveriş sepetinden fazla — farkı müşteriye nasıl aktarmak istersiniz:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRefundMode("CASH")}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      refundMode === "CASH" ? "border-brand bg-brand text-brand-foreground" : "border-border text-foreground/70 hover:bg-surface-muted"
                    }`}
                  >
                    Nakit İade
                  </button>
                  <button
                    type="button"
                    disabled={!customer}
                    onClick={() => setRefundMode("CREDIT")}
                    title={!customer ? "Müşteri bakiyesi için müşteri seçilmelidir" : undefined}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                      refundMode === "CREDIT" ? "border-brand bg-brand text-brand-foreground" : "border-border text-foreground/70 hover:bg-surface-muted"
                    }`}
                  >
                    Mağaza Kredisi / Bakiye
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* Discount + payment */}
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="text-base font-semibold text-foreground">Sepet İndirimi</h2>
            <div className="flex gap-2">
              <select
                aria-label="İndirim türü"
                value={discountType ?? ""}
                onChange={(e) => setDiscountType((e.target.value || null) as "percent" | "amount" | null)}
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground"
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
                value={discountValue || ""}
                onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                placeholder="İndirim değeri"
                aria-label="İndirim değeri"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground disabled:opacity-50"
              />
            </div>

            <h2 className="mt-2 text-base font-semibold text-foreground">Ödeme Yöntemi</h2>
            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "UPI", "CARD"] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(m);
                    if (m !== "CARD") setTerminalPaymentId(null);
                  }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    paymentMethod === m
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border text-foreground/70 hover:bg-surface-muted"
                  }`}
                >
                  {m === "CASH" ? "Nakit" : m === "UPI" ? "Havale / FAST" : "Kredi Kartı"}
                </button>
              ))}
            </div>
            {paymentMethod === "UPI" && shop?.upiId && collectTotal > 0 && <UpiQr amount={collectTotal} onUri={setUpiUri} />}
            {paymentMethod === "CARD" && shop?.terminalProvider && shop.terminalProvider !== "none" && collectTotal > 0 && (
              <TerminalCharge amount={collectTotal} reference="POS" paymentId={terminalPaymentId} onPaid={setTerminalPaymentId} />
            )}
            {paymentMethod === "CASH" && fxCodes.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <Smartphone className="h-4 w-4 text-foreground-muted" aria-hidden="true" />
                <span className="text-foreground-muted">Ödeme Para Birimi:</span>
                <select aria-label="Ödeme para birimi" value={payCurrency} onChange={(e) => { setPayCurrency(e.target.value); setAmountPaid(""); }} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm">
                  <option value="">{fx?.base || "TRY"}</option>
                  {fxCodes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
            )}
            {paymentMethod === "CASH" && payCurrency && fxRate > 0 && (
              <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-brand">
                1 {payCurrency} = {formatMoney(fxRate, sym)} · {formatMoney(collectTotal, sym)} = <b className="tabular">{round2(collectTotal / fxRate).toFixed(2)} {payCurrency}</b>
              </p>
            )}
            {paymentMethod === "CASH" && (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field
                    label={payCurrency && fxRate ? `Alınan Tutar (${payCurrency})` : "Alınan Nakit Tutar"}
                    type="number"
                    min={0}
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="whitespace-nowrap"
                  onClick={() => setAmountPaid(String(payCurrency && fxRate ? round2(collectTotal / fxRate) : collectTotal))}
                  disabled={collectTotal === 0}
                >
                  Tam Tutar
                </Button>
              </div>
            )}
          </Card>

          {/* Totals */}
          <Card className="flex flex-col gap-2 p-5">
            {(() => {
              const adjusted = returnTotal > 0 || creditUse > 0 || dueToClear > 0;
              return (
                <>
                  <Row label={adjusted ? "Bu Satış Tutarı" : "Ara Toplam"} value={money(adjusted ? quote.total : quote.subtotal)} />
                  {!adjusted && quote.discountAmount > 0 && <Row label="İndirim" value={`- ${money(quote.discountAmount)}`} />}
                  {!adjusted && shop?.gstEnabled && quote.taxAmount > 0 && <Row label="KDV (dahil)" value={money(quote.taxAmount)} />}
                  {!adjusted && quote.loyaltyDiscount > 0 && <Row label="Sadakat Puanı İndirimi" value={`- ${money(quote.loyaltyDiscount)}`} />}
                  {returnTotal > 0 && <Row label="İade Düşüşü" value={`- ${money(returnTotal)}`} />}
                  {creditUse > 0 && <Row label="Kullanılan Müşteri Bakiyesi" value={`- ${money(creditUse)}`} />}
                  {dueToClear > 0 && (
                    <Row
                      label={duePaidFinal < dueToClear ? "Tahsil Edilecek Eski Borç (tam ödeme bekliyor)" : "Ödenen Eski Borç"}
                      value={money(duePaidFinal)}
                    />
                  )}
                </>
              );
            })()}
            <div className="my-1 border-t border-border" />
            {refundValue > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-warning">Müşteriye İade ({refundMode === "CREDIT" ? "bakiye" : "nakit"})</span>
                <span className="text-xl font-semibold text-warning">{money(refundValue)}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground/70">
                  {returnTotal > 0 || creditUse > 0 || dueToClear > 0 ? "Tahsil Edilecek Net Tutar" : "Genel Toplam"}
                </span>
                <span className="text-xl font-semibold text-foreground">{money(collectTotal)}</span>
              </div>
            )}
            {paymentMethod === "CASH" && Number(amountPaid) > 0 && changeDue > 0 && (
              <Row label="Para Üstü" value={money(changeDue)} />
            )}
            {shortNow > 0 && (
              <p className={`rounded-lg px-3 py-2 text-xs font-medium ${customer ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"}`}>
                {customer
                  ? `${money(shortNow)} eksik ödendi — kalan tutar ${customer.name} müşterisinin veresiye borcuna yazılacaktır`
                  : `${money(shortNow)} eksik — veresiye olarak kaydetmek için müşteri telefonu ekleyin ya da tam tutarı tahsil edin`}
              </p>
            )}
            {shop?.loyaltyEnabled && customer && quote.pointsEarned > 0 && (
              <p className="text-xs text-foreground/50">{quote.pointsEarned} sadakat puanı kazanılacak</p>
            )}
            <Button
              onClick={finalizeSale}
              disabled={!canFinalize || isCheckingOut}
              className="mt-2 w-full"
            >
              {isCheckingOut
                ? "İşleniyor…"
                : refundValue > 0 && cart.length === 0
                  ? "İadeyi Tamamla (Enter)"
                  : cart.length === 0 && returnLines.length === 0 && dueToClear > 0
                    ? "Borcu Tahsil Et (Enter)"
                    : "Satışı Onayla (Enter)"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
