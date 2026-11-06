const PDFDocument = require('pdfkit');

const GREEN = '#0d3b28';

function buildPurchaseOrderPdf({ shop, order }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Purchase order ${order.number}` } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    const L = 40;
    const W = doc.page.width - 80;
    const sym = shop.currencySymbol || 'Rs.';
    const money = (n) => `${sym} ${Number(n).toFixed(2)}`;

    doc.font('Helvetica-Bold').fontSize(18).fillColor(GREEN).text(shop.shopName, L, 40);
    doc.font('Helvetica').fontSize(9).fillColor('#66746b').text([shop.address1, shop.city, shop.state].filter(Boolean).join(', '));
    if (shop.gstEnabled && shop.gstNumber) doc.text(`VKN / TCKN: ${shop.gstNumber}`);
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#17251d').text('SATIN ALMA SİPARİŞİ', L, 40, { width: W, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#66746b').text(`No: ${order.number}`, L, 66, { width: W, align: 'right' }).text(`Tarih: ${new Date(order.createdAt).toLocaleDateString('tr-TR')}`, { width: W, align: 'right' });

    let y = 120;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#66746b').text('TEDARİKÇİ', L, y);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#17251d').text(order.supplier.name, L, y + 12);
    doc.font('Helvetica').fontSize(9).fillColor('#66746b');
    for (const line of [order.supplier.address, order.supplier.phone && `Tel: ${order.supplier.phone}`, order.supplier.email, order.supplier.gstin && `VKN / TCKN: ${order.supplier.gstin}`].filter(Boolean)) doc.text(line, L);
    y = doc.y + 16;

    const cols = [
      ['#', 24, 'left'], ['Ürün / Kalem', W - 24 - 70 - 90 - 90, 'left'], ['Miktar', 70, 'right'], ['Birim Maliyet', 90, 'right'], ['Tutar', 90, 'right'],
    ];
    doc.rect(L, y, W, 20).fill(GREEN);
    let x = L;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#fff');
    for (const [label, w, a] of cols) { doc.text(label, x + 4, y + 6, { width: w - 8, align: a }); x += w; }
    y += 20;
    order.items.forEach((it, i) => {
      if (y > doc.page.height - 120) { doc.addPage(); y = 40; }
      x = L;
      const vals = [String(i + 1), it.name, String(it.quantity), money(it.unitCost), money(it.quantity * it.unitCost)];
      doc.font('Helvetica').fontSize(9).fillColor('#17251d');
      cols.forEach(([, w, a], k) => { doc.text(vals[k], x + 4, y + 5, { width: w - 8, align: a }); x += w; });
      y += 22;
      doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor('#dfe6df').stroke();
    });
    y += 10;
    doc.font('Helvetica-Bold').fontSize(11).fillColor(GREEN).text(`Toplam: ${money(order.totalCost)}`, L, y, { width: W, align: 'right' });
    if (order.notes) doc.font('Helvetica').fontSize(9).fillColor('#66746b').text(`Notlar: ${order.notes}`, L, y + 30, { width: W });
    doc.end();
  });
}

module.exports = { buildPurchaseOrderPdf };
