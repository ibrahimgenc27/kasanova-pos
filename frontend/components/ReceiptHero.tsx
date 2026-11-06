const LINE_ITEMS = [
  { qty: 1, label: "Çevrimdışı POS yazılımı", price: "0,00" },
  { qty: 1, label: "Stok & faturalama", price: "0,00" },
  { qty: 1, label: "KDV faturası (Türkiye)", price: "0,00" },
  { qty: 1, label: "Barkod okuma", price: "0,00" },
];

export function ReceiptHero() {
  return (
    <div className="receipt-print-in w-full max-w-[280px] shrink-0">
      <div className="receipt-card mb-3 rounded-sm px-5 pb-6 pt-5 font-mono text-[13px] shadow-2xl shadow-black/40">
        <p className="text-center text-sm font-bold tracking-[0.15em]">NODEDR POS</p>
        <p className="mt-0.5 text-center text-[11px]" style={{ color: "var(--receipt-ink-muted)" }}>
          Fiş No. 0001 &middot; Süre SINIRSIZ
        </p>
        <div className="my-3 border-t border-dashed" style={{ borderColor: "var(--receipt-ink-muted)" }} />
        <ul className="flex flex-col gap-1.5">
          {LINE_ITEMS.map((item) => (
            <li key={item.label} className="flex items-baseline justify-between gap-2">
              <span>
                {item.qty}&times; {item.label}
              </span>
              <span className="tabular-nums">₺{item.price}</span>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-2">
            <span>1&times; Aylık abonelik</span>
            <span className="tabular-nums">
              <span className="mr-1 line-through opacity-50">₺999,00</span>
              ₺0,00
            </span>
          </li>
        </ul>
        <div className="my-3 border-t border-dashed" style={{ borderColor: "var(--receipt-ink-muted)" }} />
        <div className="flex items-baseline justify-between text-sm font-bold">
          <span>TOPLAM BORÇ</span>
          <span className="tabular-nums">₺0,00</span>
        </div>
        <p className="mt-4 text-center text-[11px] tracking-wide">TAMAMI ÖDENDİ &middot; KART BİLGİSİ YOK</p>
        <p className="mt-3 text-center text-[10px]" style={{ color: "var(--receipt-ink-muted)" }}>
          Kendi bilgisayarınızda çalışır. Sonsuza dek sizin.
        </p>
      </div>
    </div>
  );
}
