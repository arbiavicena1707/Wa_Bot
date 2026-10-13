// wa_bot/parser.js
/**
 * Smart Transaction Parser untuk WhatsApp Bot SheetKas.
 * Mendeteksi:
 * 1. Perintah cek saldo: 'saldo', 'cek saldo'
 * 2. Perintah bantuan: 'help', 'bantuan', 'menu'
 * 3. Transaksi Pengeluaran / Pemasukan:
 *    - 'makan soto 25k qris'
 *    - 'bensin 20000 cash'
 *    - '+ 500k transfer bonus'
 *    - 'beli kopi 18rb'
 */

function parseTransaction(text) {
  if (!text || typeof text !== 'string') return null;

  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Cek perintah Saldo
  if (['saldo', 'cek saldo', 'info saldo', '/saldo', '!saldo'].includes(lower)) {
    return { type: 'CHECK_BALANCE' };
  }

  // 2. Cek perintah Bantuan / Help
  if (['help', 'bantuan', 'menu', '/help', '!help', 'panduan'].includes(lower)) {
    return { type: 'HELP' };
  }

  // 3. Deteksi Pemasukan (+)
  const isIncome = clean.startsWith('+') || lower.startsWith('masuk') || lower.startsWith('income');
  let rawText = clean.replace(/^\+/, '').replace(/^(masuk|income)\s*/i, '').trim();

  // 4. Deteksi Metode Pembayaran (QRIS, Cash, Transfer)
  let metode = 'Cash'; // Default jika tidak disebutkan
  if (/\bqris\b/i.test(rawText)) {
    metode = 'QRIS';
    rawText = rawText.replace(/\bqris\b/gi, '').trim();
  } else if (/\b(tf|transfer|bank|bca|bri|mandiri|jago|seabank|bni|bsi)\b/i.test(rawText)) {
    metode = 'Transfer';
    rawText = rawText.replace(/\b(tf|transfer|bank|bca|bri|mandiri|jago|seabank|bni|bsi)\b/gi, '').trim();
  } else if (/\bcash|tunai\b/i.test(rawText)) {
    metode = 'Cash';
    rawText = rawText.replace(/\bcash|tunai\b/gi, '').trim();
  }

  // 5. Ekstraksi Nominal (contoh: 25k, 25rb, 1.5jt, 25000, 25.000)
  const nominalRegex = /(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta)?\b/i;
  const nominalMatch = rawText.match(nominalRegex);

  if (!nominalMatch) return null;

  let baseNum = parseFloat(nominalMatch[1].replace(',', '.'));
  const unit = (nominalMatch[2] || '').toLowerCase();

  if (unit === 'k' || unit === 'rb' || unit === 'ribu') {
    baseNum *= 1000;
  } else if (unit === 'jt' || unit === 'juta') {
    baseNum *= 1000000;
  } else if (nominalMatch[1].includes('.') && baseNum < 1000) {
    baseNum = parseFloat(nominalMatch[1].replace('.', ''));
  }

  const amount = Math.round(baseNum);
  if (amount <= 0 || isNaN(amount)) return null;

  // 6. Ekstraksi Deskripsi (sisa teks tanpa angka nominal)
  let description = rawText.replace(nominalMatch[0], '').replace(/\s+/g, ' ').trim();
  if (!description) description = isIncome ? 'Pemasukan' : 'Pengeluaran';

  // 7. Auto Kategori Otomatis
  let category = 'Lain-lain';
  const descLower = description.toLowerCase();
  if (/makan|minum|kopi|sate|bakso|nasi|snack|jajan|kafe|resto|mie|ayam|sarapan|siang|malam/i.test(descLower)) {
    category = 'Makanan & Minuman';
  } else if (/bensin|pertalite|pertamax|parkir|gojek|grab|tol|ojol|angkot|service|cuci|ongkir/i.test(descLower)) {
    category = 'Transportasi';
  } else if (/belanja|beli|shopee|tokped|tiktok|baju|celana|alat|sepatu|tas|indomaret|alfamart/i.test(descLower)) {
    category = 'Belanja';
  } else if (/listrik|pln|pulsa|kuota|paket|wifi|pdam|indihome|iuran|bpjs|sewa|kontrakan/i.test(descLower)) {
    category = 'Tagihan & Utilitas';
  } else if (/obat|dokter|klinik|apotek|vitamin|sehat|sakit/i.test(descLower)) {
    category = 'Kesehatan';
  } else if (/nonton|bioskop|game|topup|spotify|netflix|liburan/i.test(descLower)) {
    category = 'Hiburan';
  } else if (/gaji|bonus|freelance|proyek|penjualan|cuan|komisi|sampingan/i.test(descLower)) {
    category = 'Pendapatan';
  }

  return {
    type: 'TRANSACTION',
    isIncome: isIncome,
    amount: amount,
    description: description,
    metode: metode,
    category: category
  };
}

module.exports = { parseTransaction };
