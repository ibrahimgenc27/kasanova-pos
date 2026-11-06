// A4 tax invoice PDF (pdfkit). Layout follows nodedr-invoice's invoice
// document: business + bill-to header, itemised table, tax breakup, payment
// QR, serial/warranty table, terms and signature blocks.
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { readSignature } = require('./signatures');
const { buildUpiUri } = require('./upi');
const { drawQrPdf } = require('./verifactu/qr');

const GREEN = '#0d3b28';
const MUTED = '#66746b';
const LINE = '#dfe6df';

const BIRLER = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
const ONLAR = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];

function ucHane(n) {
  let s = '';
  const yuz = Math.floor(n / 100);
  const on = Math.floor((n % 100) / 10);
  const bir = n % 10;
  if (yuz > 1) s += BIRLER[yuz] + ' Yüz ';
  else if (yuz === 1) s += 'Yüz ';
  if (on > 0) s += ONLAR[on] + ' ';
  if (bir > 0) s += BIRLER[bir] + ' ';
  return s.trim();
}

function amountInWords(amount) {
  const lira = Math.floor(amount);
  const kurus = Math.round((amount - lira) * 100);
  if (lira === 0 && kurus === 0) return 'Sıfır Türk Lirası';

  const basamaklar = ['', 'Bin', 'Milyon', 'Milyar'];
  let bolukler = [];
  let temp = lira;
  while (temp > 0) {
    bolukler.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  let parts = [];
  for (let i = bolukler.length - 1; i >= 0; i--) {
    const val = bolukler[i];
    if (val === 0) continue;
    if (i === 1 && val === 1) {
      parts.push('Bin');
    } else {
      const w = ucHane(val);
      if (w) parts.push(w + (basamaklar[i] ? ' ' + basamaklar[i] : ''));
    }
  }

  let out = parts.join(' ').trim();
  if (out) out += ' Türk Lirası';
  if (kurus > 0) {
    const kw = ucHane(kurus);
    out += `${out ? ' ' : ''}${kw} Kuruş`;
  }
  return `Yalnız ${out}`;
}

const fmtDate = (d) => new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const PAYMENT_LABELS = {
  CASH: 'Nakit',
  UPI: 'Havale / FAST',
  CARD: 'Kredi / Banka Kartı',
  CREDIT: 'Veresiye / Açık Hesap',
  SPLIT: 'Parçalı Ödeme',
};

async function buildInvoicePdf({ shop, invoice }) {
  const es = !!shop.vfEnabled; // Spain: IVA wording, the NIF and a simplified-invoice title instead of India's GST
  const sym = shop.currencySymbol || '₺';
  const money = (n) => `${sym} ${Number(n).toFixed(2)}`;

  let qrPng = null;
  const balance = Math.max(0, invoice.dueAmount || 0);
  if (shop.upiId && shop.currencyCode === 'INR' && balance > 0) {
    qrPng = await QRCode.toBuffer(
      buildUpiUri({ vpa: shop.upiId, name: shop.shopName, amount: balance, note: invoice.invoiceNumber, ref: invoice.invoiceNumber }),
      { type: 'png', margin: 1, width: 220, errorCorrectionLevel: 'M' }
    );
  }
  const shopSig = readSignature(shop.signatureFile);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Fatura ${invoice.invoiceNumber}`, Author: shop.shopName } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L = doc.page.margins.left;
    const R = doc.page.width - doc.page.margins.right;
    const W = R - L;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 20;

    // ---- header ----
    doc.font('Helvetica-Bold').fontSize(18).fillColor(GREEN).text(shop.shopName, L, 40, { width: W * 0.6 });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    if (shop.legalName) doc.text(shop.legalName, { width: W * 0.6 });
    const addr = [shop.address1, shop.address2, shop.city, shop.state, shop.pincode].filter(Boolean).join(', ');
    if (addr) doc.text(addr, { width: W * 0.6 });
    const contact = [shop.phone && `Tel: ${shop.phone}`, shop.email].filter(Boolean).join('  |  ');
    if (contact) doc.text(contact, { width: W * 0.6 });
    if (es && shop.vfNif) doc.text(`NIF: ${shop.vfNif}`, { width: W * 0.6 });
    else if (shop.gstEnabled && shop.gstNumber) doc.text(`VKN / TCKN: ${shop.gstNumber}`, { width: W * 0.6 });
    if (shop.panNumber) doc.text(`Mersis / Tic. Sicil: ${shop.panNumber}`, { width: W * 0.6 });
    const leftEnd = doc.y;

    const invoiceTitle = es ? 'FACTURA SIMPLIFICADA' : shop.gstEnabled ? 'SATIŞ FATURASI' : 'BİLGİ FİŞİ / FATURA';
    const payMethod = PAYMENT_LABELS[invoice.paymentMethod] || invoice.paymentMethod;

    doc.font('Helvetica-Bold').fontSize(18).fillColor('#17251d').text(invoiceTitle, L + W * 0.5, 40, { width: W * 0.5, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    doc.text(`Fatura No: ${invoice.invoiceNumber}`, L + W * 0.5, 66, { width: W * 0.5, align: 'right' });
    doc.text(`Tarih: ${fmtDate(invoice.createdAt || Date.now())}`, { width: W * 0.5, align: 'right', continued: false });
    doc.text(`Ödeme Yöntemi: ${payMethod}`, L + W * 0.5, doc.y, { width: W * 0.5, align: 'right' });

    let y = Math.max(leftEnd, doc.y) + 14;
    doc.moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor(LINE).stroke();
    y += 10;

    // ---- bill to ----
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('SAYIN (MÜŞTERİ)', L, y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#17251d').text(invoice.customerName || 'Perakende Müşteri', L, y + 12);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED);
    if (invoice.customerPhone) doc.text(`Tel: ${invoice.customerPhone}`, L);
    y = doc.y + 14;

    // ---- items table ----
    const cols = [
      { k: 'n', label: '#', w: 22, align: 'left' },
      { k: 'name', label: 'Ürün / Hizmet', w: W - 22 - 62 - 48 - 70 - 48 - 80, align: 'left' },
      { k: 'hsn', label: 'GTİP', w: 62, align: 'left' },
      { k: 'qty', label: 'Miktar', w: 48, align: 'right' },
      { k: 'rate', label: 'Birim Fiyat', w: 70, align: 'right' },
      { k: 'gst', label: es ? 'IVA' : 'KDV', w: 48, align: 'right' },
      { k: 'amt', label: 'Tutar', w: 80, align: 'right' },
    ];
    const drawHeader = (yy) => {
      doc.rect(L, yy, W, 20).fill(GREEN);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#fff');
      let x = L;
      for (const c of cols) {
        doc.text(c.label, x + 4, yy + 6, { width: c.w - 8, align: c.align });
        x += c.w;
      }
      return yy + 20;
    };
    y = drawHeader(y);

    invoice.items.forEach((it, i) => {
      const serialText = it.serials?.length ? `Seri No: ${it.serials.map((s) => s.serial).join(', ')}` : '';
      doc.font('Helvetica-Bold').fontSize(9);
      const nameH = doc.heightOfString(it.name, { width: cols[1].w - 8 });
      doc.font('Helvetica').fontSize(7.5);
      const serH = serialText ? doc.heightOfString(serialText, { width: cols[1].w - 8 }) : 0;
      const rowH = Math.max(nameH + serH + 10, 22);
      if (y + rowH > bottomLimit() - 160) {
        doc.addPage();
        y = drawHeader(doc.page.margins.top);
      }
      const cells = {
        n: String(i + 1),
        hsn: it.product?.hsn || '',
        qty: `${it.quantity}${it.unit ? ' ' + it.unit : ''}`,
        rate: money(it.price),
        gst: it.taxRate > 0 ? `%${it.taxRate}` : '-',
        amt: money(it.total),
      };
      let x = L;
      for (const c of cols) {
        if (c.k === 'name') {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#17251d').text(it.name, x + 4, y + 5, { width: c.w - 8 });
          if (serialText) doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(serialText, x + 4, doc.y, { width: c.w - 8 });
        } else {
          doc.font('Helvetica').fontSize(9).fillColor('#17251d').text(cells[c.k], x + 4, y + 5, { width: c.w - 8, align: c.align });
        }
        x += c.w;
      }
      y += rowH;
      doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(LINE).stroke();
    });

    // ---- totals (right) + payment QR / words (left) ----
    y += 12;
    if (y > bottomLimit() - 150) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    const totalsX = L + W * 0.55;
    const totalsW = W * 0.45;
    let ty = y;
    const trow = (label, value, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9).fillColor(bold ? GREEN : '#17251d');
      doc.text(label, totalsX, ty, { width: totalsW * 0.55 });
      doc.text(value, totalsX + totalsW * 0.45, ty, { width: totalsW * 0.55, align: 'right' });
      ty += bold ? 18 : 14;
    };
    trow('Ara Toplam', money(invoice.subtotal));
    if (invoice.discountAmount > 0) trow(invoice.discountType === 'percent' ? `İndirim (%${invoice.discountValue})` : 'İndirim', `- ${money(invoice.discountAmount)}`);
    if (shop.gstEnabled && invoice.taxAmount > 0) {
      trow(es ? 'IVA (Dahil)' : 'KDV (Dahil)', money(invoice.taxAmount));
    }
    if (invoice.loyaltyDiscount > 0) trow(`Sadakat İndirimi (${invoice.pointsRedeemed} puan)`, `- ${money(invoice.loyaltyDiscount)}`);
    if (invoice.returnValue > 0) trow('İadeler', `- ${money(invoice.returnValue)}`);
    if (invoice.creditApplied > 0) trow('Kullanılan Bakiye', `- ${money(invoice.creditApplied)}`);
    const payable = Math.max(0, Math.round((invoice.totalAmount - invoice.returnValue - invoice.creditApplied) * 100) / 100);
    doc.moveTo(totalsX, ty).lineTo(R, ty).lineWidth(1).strokeColor(GREEN).stroke();
    ty += 5;
    trow(invoice.returnValue > 0 || invoice.creditApplied > 0 ? 'ÖDENECEK NET TUTAR' : 'GENEL TOPLAM', money(payable), true);
    trow(`Ödenen (${payMethod})`, money(invoice.amountPaid));
    if (invoice.changeDue > 0) trow('Para Üstü', money(invoice.changeDue));
    if (invoice.dueAmount > 0) trow('Kalan Borç', money(invoice.dueAmount), true);

    // left column beside totals
    let ly = y;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('YAZIYLA', L, ly);
    doc.font('Helvetica').fontSize(9).fillColor('#17251d').text(amountInWords(payable), L, ly + 11, { width: W * 0.5 });
    ly = doc.y + 8;
    if (qrPng) {
      doc.image(qrPng, L, ly, { width: 76 });
      doc.font('Helvetica-Bold').fontSize(8).fillColor(GREEN).text('Kalan borcu ödemek için okutun', L + 84, ly + 20, { width: 120 });
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`${shop.upiId}`, L + 84, doc.y, { width: 120 });
      ly += 82;
    }
    if (invoice.verifactu) {
      const vf = invoice.verifactu;
      if (ly + 112 > bottomLimit()) {
        doc.addPage();
        ly = doc.page.margins.top;
      }
      doc.font('Helvetica-Bold').fontSize(8).fillColor(GREEN).text(`Factura simplificada ${vf.invoiceNumber}`, L, ly, { width: W * 0.5, lineBreak: false });
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(vf.heading, L, ly + 11, { width: W * 0.5, lineBreak: false });
      drawQrPdf(doc, vf.url, L, ly + 24, 99);
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(vf.legend, L + 107, ly + 50, { width: 150 });
      doc.font('Helvetica-Bold').fillColor(GREEN).text(vf.short, L + 107, doc.y + 2, { width: 150, lineBreak: false });
      ly += 128;
    }
    y = Math.max(ty, ly) + 10;

    // ---- warranty table ----
    const serialRows = invoice.items.flatMap((it) => (it.serials || []).map((s) => ({ name: it.name, serial: s.serial, ends: s.warrantyEndsAt, months: it.warrantyMonths })));
    if (serialRows.length > 0) {
      const need = 24 + serialRows.length * 14;
      if (y + need > bottomLimit() - 70) { doc.addPage(); y = doc.page.margins.top; }
      doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('GARANTİ VE SERİ NUMARALARI', L, y);
      y += 12;
      for (const r of serialRows) {
        if (y > bottomLimit() - 70) { doc.addPage(); y = doc.page.margins.top; }
        doc.font('Helvetica').fontSize(8.5).fillColor('#17251d').text(r.name, L, y, { width: W * 0.38, lineBreak: false, ellipsis: true });
        doc.font('Courier').text(r.serial, L + W * 0.4, y, { width: W * 0.25, lineBreak: false });
        doc.font('Helvetica').text(r.ends ? `Garanti Bitişi: ${fmtDate(r.ends)} (${r.months} ay)` : 'Garantisiz', L + W * 0.66, y, { width: W * 0.34, lineBreak: false });
        y += 14;
      }
      y += 6;
    }

    // ---- terms + authorised signature ----
    const SIG_H = 74;
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    const termsText = shop.termsText || shop.receiptFooter || '';
    let termsH = 0;
    if (termsText) {
      doc.font('Helvetica').fontSize(8);
      termsH = 12 + Math.min(doc.heightOfString(termsText, { width: W * 0.55 }), 60);
    }
    if (y + Math.max(termsH, SIG_H) > pageBottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    if (termsText) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('ŞARTLAR VE KOŞULLAR', L, y, { lineBreak: false });
      doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(termsText, L, y + 11, { width: W * 0.55, height: 60, ellipsis: true });
    }
    const sigW = 150;
    const sigX = R - sigW;
    const sigY = Math.max(y, pageBottom - SIG_H);
    if (shopSig) {
      try {
        doc.image(shopSig, sigX, sigY, { fit: [sigW, 40], align: 'center', valign: 'bottom' });
      } catch {
        /* unreadable image — leave the space blank */
      }
    }
    doc.moveTo(sigX, sigY + 44).lineTo(sigX + sigW, sigY + 44).lineWidth(0.75).strokeColor(MUTED).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(MUTED);
    doc.text('Yetkili İmza / Kaşe', sigX + (sigW - doc.widthOfString('Yetkili İmza / Kaşe')) / 2, sigY + 48, { lineBreak: false });
    if (shop.signatoryName) {
      let name = shop.signatoryName;
      while (name.length > 1 && doc.widthOfString(name) > sigW) name = name.slice(0, -2).trimEnd() + (name.endsWith('…') ? '' : '…');
      doc.text(name, sigX + (sigW - doc.widthOfString(name)) / 2, sigY + 59, { lineBreak: false });
    }

    doc.end();
  });
}

module.exports = { buildInvoicePdf, amountInWords };
