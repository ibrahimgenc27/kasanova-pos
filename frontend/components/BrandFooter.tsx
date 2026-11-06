export function BrandFooter({ className }: { className?: string }) {
  return (
    <p className={`text-center text-[11px] leading-tight text-foreground/40 ${className ?? ""}`}>
      <span className="font-medium text-foreground/60">KasaNova POS</span> &middot; Hızlı Satış &amp; Stok Yönetimi
    </p>
  );
}
