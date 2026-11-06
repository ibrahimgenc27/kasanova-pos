// Küçük, değişmeyen referans verileri — açılır menüler ve format
// doğrulaması için kullanılır. Sadece kısa ve nadiren değişen listelerle
// sınırlıdır — KDV oranları, il kodları, standart birim kodları ve yapısal
// VKN/TCKN doğrulama. Büyük, sık güncellenen kayıtlar (GTİP katalogları,
// posta kodları) burada paketlenmez.

// Türkiye'de kullanılan KDV oranları.
export const GST_RATES = [0, 1, 8, 10, 18, 20] as const;

// Türkiye illeri ve plaka kodları.
export const GST_STATE_CODES: { code: string; name: string }[] = [
  { code: "01", name: "Adana" },
  { code: "02", name: "Adıyaman" },
  { code: "03", name: "Afyonkarahisar" },
  { code: "04", name: "Ağrı" },
  { code: "05", name: "Amasya" },
  { code: "06", name: "Ankara" },
  { code: "07", name: "Antalya" },
  { code: "08", name: "Artvin" },
  { code: "09", name: "Aydın" },
  { code: "10", name: "Balıkesir" },
  { code: "11", name: "Bilecik" },
  { code: "12", name: "Bingöl" },
  { code: "13", name: "Bitlis" },
  { code: "14", name: "Bolu" },
  { code: "15", name: "Burdur" },
  { code: "16", name: "Bursa" },
  { code: "17", name: "Çanakkale" },
  { code: "18", name: "Çankırı" },
  { code: "19", name: "Çorum" },
  { code: "20", name: "Denizli" },
  { code: "21", name: "Diyarbakır" },
  { code: "22", name: "Edirne" },
  { code: "23", name: "Elazığ" },
  { code: "24", name: "Erzincan" },
  { code: "25", name: "Erzurum" },
  { code: "26", name: "Eskişehir" },
  { code: "27", name: "Gaziantep" },
  { code: "28", name: "Giresun" },
  { code: "29", name: "Gümüşhane" },
  { code: "30", name: "Hakkari" },
  { code: "31", name: "Hatay" },
  { code: "32", name: "Isparta" },
  { code: "33", name: "Mersin" },
  { code: "34", name: "İstanbul" },
  { code: "35", name: "İzmir" },
  { code: "36", name: "Kars" },
  { code: "37", name: "Kastamonu" },
  { code: "38", name: "Kayseri" },
  { code: "39", name: "Kırklareli" },
  { code: "40", name: "Kırşehir" },
  { code: "41", name: "Kocaeli" },
  { code: "42", name: "Konya" },
  { code: "43", name: "Kütahya" },
  { code: "44", name: "Malatya" },
  { code: "45", name: "Manisa" },
  { code: "46", name: "Kahramanmaraş" },
  { code: "47", name: "Mardin" },
  { code: "48", name: "Muğla" },
  { code: "49", name: "Muş" },
  { code: "50", name: "Nevşehir" },
  { code: "51", name: "Niğde" },
  { code: "52", name: "Ordu" },
  { code: "53", name: "Rize" },
  { code: "54", name: "Sakarya" },
  { code: "55", name: "Samsun" },
  { code: "56", name: "Siirt" },
  { code: "57", name: "Sinop" },
  { code: "58", name: "Sivas" },
  { code: "59", name: "Tekirdağ" },
  { code: "60", name: "Tokat" },
  { code: "61", name: "Trabzon" },
  { code: "62", name: "Tunceli" },
  { code: "63", name: "Şanlıurfa" },
  { code: "64", name: "Uşak" },
  { code: "65", name: "Van" },
  { code: "66", name: "Yozgat" },
  { code: "67", name: "Zonguldak" },
  { code: "68", name: "Aksaray" },
  { code: "69", name: "Bayburt" },
  { code: "70", name: "Karaman" },
  { code: "71", name: "Kırıkkale" },
  { code: "72", name: "Batman" },
  { code: "73", name: "Şırnak" },
  { code: "74", name: "Bartın" },
  { code: "75", name: "Ardahan" },
  { code: "76", name: "Iğdır" },
  { code: "77", name: "Yalova" },
  { code: "78", name: "Karabük" },
  { code: "79", name: "Kilis" },
  { code: "80", name: "Osmaniye" },
  { code: "81", name: "Düzce" },
];

// Standart birim kodları — genel bir perakende mağazasının ihtiyaç
// duyacağı birimleri kapsar.
export const UQC_UNITS: { code: string; name: string }[] = [
  { code: "AD", name: "ADET" },
  { code: "KG", name: "KİLOGRAM" },
  { code: "GR", name: "GRAM" },
  { code: "LT", name: "LİTRE" },
  { code: "ML", name: "MİLİLİTRE" },
  { code: "MT", name: "METRE" },
  { code: "M2", name: "METREKARE" },
  { code: "PKT", name: "PAKET" },
  { code: "KOL", name: "KOLİ" },
  { code: "KUT", name: "KUTU" },
  { code: "ŞİŞ", name: "ŞİŞE" },
  { code: "TEN", name: "TENEKE" },
  { code: "ÇFT", name: "ÇİFT" },
  { code: "DÜZ", name: "DÜZİNE" },
  { code: "TOP", name: "TOP" },
  { code: "RUL", name: "RULO" },
  { code: "SET", name: "SET" },
  { code: "TON", name: "TON" },
  { code: "TÜP", name: "TÜP" },
  { code: "TB", name: "TABLET" },
  { code: "BİR", name: "BİRİM" },
  { code: "DİĞ", name: "DİĞER" },
];

// Ürün formunda veri listesi önerisi olarak sunulan genel başlangıç
// kategorileri — alan serbest metin olarak kalır.
export const GENERIC_PRODUCT_CATEGORIES = [
  "Market Ürünleri",
  "İçecekler",
  "Atıştırmalıklar",
  "Ev Gereçleri",
  "Kişisel Bakım",
  "Kırtasiye",
  "Elektronik",
  "Giyim",
  "Ayakkabı",
  "Oyuncak",
  "Eczane",
  "Diğer",
] as const;

export const BUSINESS_TYPES = [
  "Şahıs Şirketi",
  "Adi Ortaklık",
  "Kolektif Şirket",
  "Komandit Şirket",
  "Limited Şirket",
  "Anonim Şirket",
  "Kooperatif",
  "Dernek",
  "Vakıf",
  "Serbest Meslek",
] as const;

// Yapısal doğrulama (regex formatı) — VKN 10 haneli, TCKN 11 haneli.
const PAN_RE = /^[0-9]{10,16}$/;
const GSTIN_RE = /^[0-9]{10,11}$/;

export function isValidPanFormat(pan: string): boolean {
  return PAN_RE.test(pan.trim());
}

export function isValidGstinFormat(gstin: string): boolean {
  return GSTIN_RE.test(gstin.trim());
}

export function gstStateFromGstin(gstin: string): string | null {
  // Türkiye'de TCKN'den il bilgisi çıkarılamaz, null döner
  return null;
}
