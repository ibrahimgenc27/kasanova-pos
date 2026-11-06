/**
 * Varsayılan mağaza ayarları — henüz ayar kaydı oluşturulmamışsa kullanılır.
 * Bu, ilk satışta "Shop settings not configured" hatasını önler.
 */

const DEFAULT_SHOP_SETTINGS = {
  shopName: 'Mağazam',
  address1: 'Adres girilmedi',
  currencyCode: 'TRY',
  currencySymbol: '₺',
  gstEnabled: true,
  defaultTaxRate: 20,
  loyaltyEnabled: false,
  pointsPerUnit: 0,
  pointValue: 0,
  receiptHeader: '',
  receiptFooter: 'Teşekkür Ederiz! Yine Bekleriz.',
  showGst: true,
  autoPrintReceipt: false,
  usbPrinterWidth: 80,
  autoPrintMethod: 'browser',
  lowStockAlert: 5,
  allowNegativeStock: false,
  invoiceLayout: 'receipt',
  cashDrawer: false,
  serialTracking: false,
};

/**
 * Prisma client (veya transaction) üzerinde shopSettings bulamazsa otomatik
 * olarak varsayılan Türkiye ayarlarıyla yeni bir kayıt oluşturur.
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} client
 *   Normal `prisma` veya `$transaction` içindeki `tx` nesnesi.
 * @returns {Promise<object>} shopSettings kaydı
 */
async function getOrCreateSettings(client) {
  const existing = await client.shopSettings.findFirst();
  if (existing) return existing;

  // Ayar yoksa varsayılanla oluştur
  return client.shopSettings.create({ data: DEFAULT_SHOP_SETTINGS });
}

module.exports = { getOrCreateSettings, DEFAULT_SHOP_SETTINGS };
