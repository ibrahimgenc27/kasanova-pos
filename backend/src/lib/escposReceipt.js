// Builds a raw ESC/POS byte buffer for direct-USB thermal printing — a third
// receipt renderer alongside receipt.js (browser-print HTML) and pdf.js
// (PDF download). It mirrors the same invoice content as those two, but the
// layout technique is different on purpose: ESC/POS text mode is a truly
// fixed-width monospace grid at a known column count (42 for 80mm paper, 32
// for 58mm, passed in as `width`), so plain string padding lines up exactly —
// none of the proportional-font wrapping/gap issues that pdf.js had to work
// around with vector-drawn rules apply here.
//
// Unicode limitation (unlike receipt.js/pdf.js, which are full Unicode):
// generic ESC/POS thermal printers default to a single-byte codepage
// (usually CP437/PC850), not UTF-8. Sending raw UTF-8 bytes for anything
// outside printable ASCII would print as mojibake, which is worse than not
// printing it at all, so `toPrinterText` normalizes accented Latin letters
// down to their base letter (café -> cafe) and replaces anything else
// (Devanagari, Arabic, CJK, etc.) with "?". This is a real, documented
// trade-off of the USB path specifically — the HTML/PDF receipts remain the
// correct choice whenever exact non-Latin text matters.

const { escposQr } = require('./verifactu/qr');

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  init: Buffer.from([ESC, 0x40]),
  codepagePc437: Buffer.from([ESC, 0x74, 0x00]),
  // Left alignment is set once, up front — centering (shop header, footer)
  // is done in software via the `center()` string helper's space padding,
  // not the printer's own ESC a 1 command, so alignment never needs to
  // change mid-receipt.
  alignLeft: Buffer.from([ESC, 0x61, 0x00]),
  boldOn: Buffer.from([ESC, 0x45, 0x01]),
  boldOff: Buffer.from([ESC, 0x45, 0x00]),
  // Feed a few blank lines before cutting so the cut lands below the last
  // printed line rather than through it, then a full-cut command (GS V 0)
  // — the same bytes the widely-used `escpos` npm package sends for a full
  // cut, kept identical here since it's a proven-compatible byte sequence
  // across generic ESC/POS clones without pulling in that whole package.
  feedAndCut: Buffer.concat([Buffer.from('\n\n\n\n'), Buffer.from([GS, 0x56, 0x00])]),
};

const ASCII_ONLY = /^[\x20-\x7e]*$/;

// Strips accents (NFKD splits "é" into "e" + a combining accent mark, which
// the second regex then removes) and replaces anything still outside
// printable ASCII with "?" — see the file-level comment for why.
function toPrinterText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '?');
}

function center(s, width) {
  s = s.slice(0, width);
  const total = width - s.length;
  const left = Math.floor(total / 2);
  return ' '.repeat(left) + s + ' '.repeat(total - left);
}

// A "label ......... value" line, right-aligning value and truncating label
// if the two can't both fit — used for every totals row (Subtotal, GST,
// discounts, grand total, etc).
function row(label, value, width) {
  label = String(label);
  value = String(value);
  const space = width - label.length - value.length;
  if (space < 1) {
    label = label.slice(0, Math.max(0, width - value.length - 1));
    return label + ' '.repeat(Math.max(0, width - label.length - value.length)) + value;
  }
  return label + ' '.repeat(space) + value;
}

function rule(width) {
  return '-'.repeat(width);
}

// Greedy word-wrap to `width` columns; a single word longer than the width
// is hard-broken so it can't overflow the line.
function wrap(text, width) {
  const lines = [];
  for (const paragraph of toPrinterText(text).split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      let w = word;
      while (w.length > width) {
        lines.push(w.slice(0, width));
        w = w.slice(width);
      }
      const candidate = line ? `${line} ${w}` : w;
      if (candidate.length > width) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines.length > 0 ? lines : [''];
}

// ESC p m t1 t2 — pulse pin 2 for 50ms on / 500ms off: the standard
// "open cash drawer" kick wired through the receipt printer's RJ11 port.
const DRAWER_KICK = Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]);

function buildReceiptEscPos({ shop, invoice, width = 42 }) {
  const es = !!shop.vfEnabled; // Spain: IVA wording and the NIF instead of India's GST
  // Only fall back to the currency CODE (e.g. "EUR") instead of the symbol
  // when the symbol itself isn't plain ASCII (€, £, ﷼, ₱, ...) — a generic
  // printer's default codepage can't render those reliably, but a 3-letter
  // code always prints cleanly and stays unambiguous.
  const sym = shop.currencySymbol && ASCII_ONLY.test(shop.currencySymbol) ? shop.currencySymbol : shop.currencyCode || '';
  const money = (n) => `${sym} ${Number(n).toFixed(2)}`;
  const date = new Date(invoice.createdAt || Date.now());

  // Each entry is `{ text, bold }` rather than a plain string so the shop
  // name and grand total can be emphasized (matching the HTML receipt's
  // <h1> and .grand styling) without breaking the line-by-line string
  // helpers above, which only ever deal in plain text.
  const lines = [];
  const push = (s = '', opts = {}) => lines.push({ text: s, ...opts });

  const PAYMENT_LABELS = {
    CASH: 'Nakit',
    UPI: 'Havale / FAST',
    CARD: 'Banka / Kredi Karti',
    CREDIT: 'Veresiye / Acik Hesap',
    SPLIT: 'Parcali Odeme',
  };
  const payMethod = PAYMENT_LABELS[invoice.paymentMethod] || invoice.paymentMethod;

  push(center(toPrinterText(shop.shopName), width), { bold: true });
  if (shop.legalName) push(center(toPrinterText(shop.legalName), width));
  const addr = [shop.address1, shop.address2].filter(Boolean).join(', ');
  if (addr) for (const l of wrap(addr, width)) push(center(l, width));
  const cityState = [shop.city, shop.state].filter(Boolean).join(', ');
  if (cityState) push(center(toPrinterText(cityState), width));
  if (shop.phone) push(center(toPrinterText(`Tel: ${shop.phone}`), width));
  if (es && shop.vfNif) push(center(toPrinterText(`NIF: ${shop.vfNif}`), width));
  else if (shop.gstEnabled && shop.gstNumber) push(center(toPrinterText(`VKN/TCKN: ${shop.gstNumber}`), width));
  push(rule(width));
  push(toPrinterText(date.toLocaleString('tr-TR')));
  push(toPrinterText(`Fis: #${invoice.invoiceNumber}`));
  const cust = `Musteri: ${invoice.customerName || 'Perakende Musteri'}${invoice.customerPhone ? ` - ${invoice.customerPhone}` : ''}`;
  for (const l of wrap(cust, width)) push(l);
  push(rule(width));

  // Two lines per item rather than a 4-column table: "qty x rate" columns
  // narrow enough to survive a 32-col (58mm) printer without truncating
  // would make item names unreadably short, so each item gets its own full-
  // width name line, then a second line with qty/rate on the left and the
  // line amount right-aligned — the same information as the HTML/PDF
  // receipts' table, just laid out for a narrow fixed-width strip instead
  // of a wide proportional-font table.
  for (const item of invoice.items) {
    for (const l of wrap(item.name, width)) push(l);
    const qty = `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;
    push(row(`  ${qty} x ${money(item.price)}`, money(item.price * item.quantity), width));
    if (shop.gstEnabled && shop.showGst && item.taxRate > 0) {
      push(`  ${es ? 'IVA' : 'KDV'} @ %${item.taxRate}`);
    }
    for (const s of item.serials || []) push(`  Seri No: ${s.serial}`);
  }
  push(rule(width));

  push(row('Ara Toplam', money(invoice.subtotal), width));
  if (invoice.discountAmount > 0) {
    const label = invoice.discountType === 'percent' ? `Indirim (%${invoice.discountValue})` : 'Indirim';
    push(row(label, `-${money(invoice.discountAmount)}`, width));
  }
  if (shop.gstEnabled && invoice.taxAmount > 0) {
    push(row(es ? 'IVA (Dahil)' : 'KDV (Dahil)', money(invoice.taxAmount), width));
  }
  if (invoice.loyaltyDiscount > 0) {
    push(row(`Sadakat (${invoice.pointsRedeemed} puan)`, `-${money(invoice.loyaltyDiscount)}`, width));
  }
  if (invoice.returnValue > 0) push(row('Iadeler', `-${money(invoice.returnValue)}`, width));
  if (invoice.creditApplied > 0) push(row('Kullanilan Bakiye', `-${money(invoice.creditApplied)}`, width));

  const payable = Math.max(0, Math.round((invoice.totalAmount - invoice.returnValue - invoice.creditApplied) * 100) / 100);
  const hasRefund = invoice.refundValue > 0;
  if (hasRefund && invoice.previousDuePaid > 0) {
    push(row('Eski Borc Tahsilati', `-${money(invoice.previousDuePaid)}`, width));
  }
  const grandLabel = hasRefund
    ? `IADE (${invoice.refundMode === 'CREDIT' ? 'magaza bakiyesi' : 'nakit'})`
    : invoice.returnValue > 0 || invoice.creditApplied > 0
      ? 'ODENECEK TUTAR'
      : 'GENEL TOPLAM';
  const grandValue = hasRefund ? invoice.refundValue : payable;
  push(rule(width));
  push(row(grandLabel, money(grandValue), width), { bold: true });

  if (!hasRefund) {
    push(rule(width));
    push(row(`Odenen (${payMethod})`, money(invoice.amountPaid), width));
    if (invoice.previousDuePaid > 0) {
      push(row('Eski Borc Tahsilati', money(invoice.previousDuePaid), width));
      push(row('Toplam Tahsil Edilen', money(invoice.amountPaid + invoice.previousDuePaid), width));
    }
    if (invoice.changeDue > 0) push(row('Para Ustu', money(invoice.changeDue), width));
    if (invoice.dueAmount > 0) push(row('Kalan Borc', money(invoice.dueAmount), width));
  }

  if (shop.loyaltyEnabled && invoice.pointsEarned > 0) {
    push(center(`Bu alisveristen ${invoice.pointsEarned} sadakat puani kazandiniz!`, width));
  }
  if (invoice.verifactu) {
    const vf = invoice.verifactu;
    push(rule(width));
    push(center(toPrinterText(`Factura simplificada ${vf.invoiceNumber}`), width), { bold: true });
    push(center(toPrinterText(vf.heading), width));
    push('', { raw: escposQr(vf.url) });
    push(center(toPrinterText(vf.legend), width));
    push(center(toPrinterText(vf.short), width), { bold: true });
  }
  push(rule(width));
  for (const l of wrap(shop.receiptFooter || 'Tesekkur Ederiz! Yine Bekleriz.', width)) push(center(l, width));

  // Wrap only the bold-marked lines in ESC E 1 / ESC E 0 individually,
  // rather than toggling bold once per contiguous run — simpler, and the
  // per-line overhead of a few extra command bytes is irrelevant next to a
  // full receipt's byte count.
  const segments = [CMD.init, CMD.codepagePc437, CMD.alignLeft];
  for (const { text, bold, raw } of lines) {
    if (raw) {
      segments.push(raw);
      continue;
    }
    const lineBuffer = Buffer.from(`${text}\n`, 'latin1');
    segments.push(bold ? Buffer.concat([CMD.boldOn, lineBuffer, CMD.boldOff]) : lineBuffer);
  }
  segments.push(CMD.feedAndCut);
  if (shop.cashDrawer && invoice.paymentMethod === 'CASH') segments.push(DRAWER_KICK);
  return Buffer.concat(segments);
}

module.exports = { buildReceiptEscPos, toPrinterText, DRAWER_KICK };
