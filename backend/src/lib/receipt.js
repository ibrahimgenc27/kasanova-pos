// Builds the printable HTML receipt (see buildReceiptHtml below), shared by
// the browser print flow and used as the content reference for the PDF
// renderer in pdf.js.

const { qrSvg } = require('./verifactu/qr');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const PAYMENT_LABELS = {
  CASH: 'Nakit',
  UPI: 'Havale / FAST',
  CARD: 'Kredi / Banka Kartı',
  CREDIT: 'Veresiye / Açık Hesap',
  SPLIT: 'Parçalı Ödeme',
};

// Builds a standalone, self-printing HTML receipt. Loaded into a hidden
// same-page iframe (see frontend/lib/print.ts) rather than a new tab, it
// calls window.print() on load — the browser's own print dialog lets the
// user pick any printer (thermal, laser, PDF virtual printer, whatever the
// OS/CUPS has configured) instead of us talking to a USB device directly.
function buildReceiptHtml({ shop, invoice }) {
  const es = !!shop.vfEnabled; // Spain: IVA wording and the NIF instead of India's GST
  const sym = shop.currencySymbol || '₺';
  const money = (n) => `${sym} ${Number(n).toFixed(2)}`;
  const date = new Date(invoice.createdAt || Date.now());
  const dateStr = date.toLocaleString('tr-TR');

  const itemRows = invoice.items
    .map(
      (it) => `
        <tr>
          <td>${esc(it.name)}${
            shop.gstEnabled && shop.showGst && it.taxRate > 0
              ? `<div class="sub">${es ? 'IVA' : 'KDV'} @ %${it.taxRate}</div>`
              : ''
          }${(it.serials || []).map((s) => `<div class="sub">Seri No: ${esc(s.serial)}</div>`).join('')}</td>
          <td class="num">${it.quantity}${it.unit ? ` ${esc(it.unit)}` : ''}</td>
          <td class="num">${money(it.price)}</td>
          <td class="num">${money(it.price * it.quantity)}</td>
        </tr>`
    )
    .join('');

  const totalRows = [];
  totalRows.push(['Ara Toplam', money(invoice.subtotal)]);
  if (invoice.discountAmount > 0) {
    const label = invoice.discountType === 'percent' ? `İndirim (%${invoice.discountValue})` : 'İndirim';
    totalRows.push([label, `- ${money(invoice.discountAmount)}`]);
  }
  if (shop.gstEnabled && invoice.taxAmount > 0) {
    totalRows.push([es ? 'IVA (Dahil)' : 'KDV (Dahil)', money(invoice.taxAmount)]);
  }
  if (invoice.loyaltyDiscount > 0) {
    totalRows.push([`Sadakat İndirimi (${invoice.pointsRedeemed} puan)`, `- ${money(invoice.loyaltyDiscount)}`]);
  }
  if (invoice.returnValue > 0) totalRows.push(['İadeler', `- ${money(invoice.returnValue)}`]);
  if (invoice.creditApplied > 0) totalRows.push(['Kullanılan Bakiye', `- ${money(invoice.creditApplied)}`]);

  // With returns/credit, the customer pays (or is refunded) the net, not the
  // raw sale total. Decide the bold bottom line accordingly.
  const payable = Math.max(0, Math.round((invoice.totalAmount - invoice.returnValue - invoice.creditApplied) * 100) / 100);
  const hasRefund = invoice.refundValue > 0;
  if (hasRefund && invoice.previousDuePaid > 0) {
    totalRows.push(['Tahsil Edilen Eski Borç', `- ${money(invoice.previousDuePaid)}`]);
  }
  const grandLabel = hasRefund
    ? `İADE (${invoice.refundMode === 'CREDIT' ? 'mağaza bakiyesi' : 'nakit'})`
    : invoice.returnValue > 0 || invoice.creditApplied > 0
      ? 'ÖDENECEK NET TUTAR'
      : 'GENEL TOPLAM';
  const grandValue = hasRefund ? invoice.refundValue : payable;
  const payMethod = PAYMENT_LABELS[invoice.paymentMethod] || invoice.paymentMethod;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(invoice.invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; }
  html { margin: 0; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 4mm; color: #111; width: 80mm; }
  p { margin: 0 0 3px; }
  .receipt { width: 100%; margin: 0; }
  h1 { font-size: 15px; text-align: center; margin: 0 0 2px; }
  .center { text-align: center; }
  .muted { color: #555; font-size: 11px; line-height: 1.35; }
  .rule { border: none; border-top: 1px dashed #999; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; color: #777; padding-bottom: 2px; }
  td { padding: 1px 0; vertical-align: top; word-break: break-word; }
  .num { text-align: right; white-space: nowrap; padding-left: 6px; }
  .sub { font-size: 10px; color: #777; }
  .totals td { padding: 1px 0; }
  .grand td { font-weight: 700; font-size: 13px; border-top: 1px solid #111; padding-top: 3px; }
  .vf { text-align: center; font-size: 11px; }
  .vf svg { display: block; margin: 4px auto; }
  .footer { text-align: center; margin-top: 6px; font-size: 11px; }
  @page { size: 80mm auto; margin: 0; }
  @media print {
    html, body { width: 80mm; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <script>
    window.addEventListener('message', function (e) { if (e.data === 'print') window.print(); });
  </script>
  <div class="receipt">
    ${shop.receiptHeader ? `<p class="center muted">${esc(shop.receiptHeader).replace(/\n/g, '<br>')}</p>` : ''}
    <h1>${esc(shop.shopName)}</h1>
    ${shop.legalName ? `<p class="center muted">${esc(shop.legalName)}</p>` : ''}
    <p class="center muted">
      ${esc(shop.address1)}${shop.address2 ? `, ${esc(shop.address2)}` : ''}<br>
      ${[shop.city, shop.state].filter(Boolean).map(esc).join(', ')}
      ${shop.phone ? `<br>Tel: ${esc(shop.phone)}` : ''}
      ${es && shop.vfNif ? `<br>NIF: ${esc(shop.vfNif)}` : shop.gstEnabled && shop.gstNumber ? `<br>VKN / TCKN: ${esc(shop.gstNumber)}` : ''}
    </p>
    <hr class="rule">
    <p class="muted">
      ${esc(dateStr)}<br>
      Fiş No: #${esc(invoice.invoiceNumber)}<br>
      Müşteri: ${esc(invoice.customerName || 'Perakende Müşteri')}${invoice.customerPhone ? ` · ${esc(invoice.customerPhone)}` : ''}
    </p>
    <hr class="rule">
    <table>
      <thead>
        <tr><th>Ürün</th><th class="num">Miktar</th><th class="num">Fiyat</th><th class="num">Tutar</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr class="rule">
    <table class="totals">
      ${totalRows.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="num">${esc(v)}</td></tr>`).join('')}
      <tr class="grand"><td>${esc(grandLabel)}</td><td class="num">${money(grandValue)}</td></tr>
    </table>
    ${
      hasRefund
        ? ''
        : `<hr class="rule">
    <table class="totals">
      <tr><td>Ödenen (${esc(payMethod)})</td><td class="num">${money(invoice.amountPaid)}</td></tr>
      ${
        invoice.previousDuePaid > 0
          ? `<tr><td>Tahsil Edilen Eski Borç</td><td class="num">${money(invoice.previousDuePaid)}</td></tr>
      <tr class="grand"><td>Toplam Tahsil Edilen</td><td class="num">${money(invoice.amountPaid + invoice.previousDuePaid)}</td></tr>`
          : ''
      }
      ${invoice.changeDue > 0 ? `<tr><td>Para Üstü</td><td class="num">${money(invoice.changeDue)}</td></tr>` : ''}
      ${invoice.dueAmount > 0 ? `<tr><td>Kalan Borç</td><td class="num">${money(invoice.dueAmount)}</td></tr>` : ''}
    </table>`
    }
    ${
      shop.loyaltyEnabled && invoice.pointsEarned > 0
        ? `<p class="center muted">Bu alışverişinizden ${invoice.pointsEarned} sadakat puanı kazandınız!</p>`
        : ''
    }
    ${
      invoice.verifactu
        ? `<hr class="rule"><div class="vf"><strong>Factura simplificada ${esc(invoice.verifactu.invoiceNumber)}</strong><div>${esc(invoice.verifactu.heading)}</div>${qrSvg(invoice.verifactu.url, '35mm')}<div>${esc(invoice.verifactu.legend)}</div><strong>${esc(invoice.verifactu.short)}</strong></div>`
        : ''
    }
    <hr class="rule">
    <p class="footer">${esc(shop.receiptFooter || 'Teşekkür Ederiz! Yine Bekleriz.').replace(/\n/g, '<br>')}</p>
  </div>
</body>
</html>`;
}

module.exports = { buildReceiptHtml };
