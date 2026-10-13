# 🤖 SheetKas WhatsApp Bot (Koyeb Ready)

Bot WhatsApp untuk input transaksi keuangan otomatis ke **Google Sheets (SheetKas)** langsung dari WhatsApp Group atau Chat pribadi, yang otomatis tersinkron ke aplikasi Flutter & Web.

---

## ⚡ Fitur Utama
1. **Input Santai & Fleksibel**:
   - `makan soto 25k qris` $\rightarrow$ Tercatat Rp 25.000 (QRIS), Kategori *Makanan & Minuman*.
   - `bensin 20000 cash` $\rightarrow$ Tercatat Rp 20.000 (Cash), Kategori *Transportasi*.
   - `+ 500k transfer bonus` $\rightarrow$ Tercatat Pemasukan Rp 500.000.
2. **Cek Saldo Cepat**:
   - Ketik `saldo` di WhatsApp $\rightarrow$ Bot membalas rincian Saldo Cash, QRIS, Total Saldo, & Saldo Aman.
3. **Web QR Code Viewer**:
   - Tampilan halaman web di port 8000 untuk scan QR langsung di browser tanpa pusing membaca log terminal.
4. **Gratis 24/7 di Koyeb**:
   - Siap dideploy menggunakan Dockerfile ke Koyeb Free Instance.

---

## 🚀 Panduan Deploy ke Koyeb (Lengkap)

### 1. Upload Folder ke GitHub
Pastikan folder `wa_bot` sudah terupload ke repository GitHub Anda (bisa repository baru atau repository project saat ini).

### 2. Buat Service di Koyeb
1. Buka [koyeb.com](https://www.koyeb.com) dan login dengan akun GitHub Anda.
2. Klik **Create Service**.
3. Pilih sumber: **GitHub**.
4. Pilih repository Anda.
5. Pada bagian **Work Directory**:
   - Jika `wa_bot` berada di dalam subfolder, isi dengan: `wa_bot`
   - Jika di root repo, biarkan kosong (`/`).
6. Pada bagian **Builder**, pilih **Dockerfile**.
7. Pada bagian **Environment Variables**:
   - `GAS_URL` : `https://script.google.com/macros/s/AKfycbxN3l6lTZX-UoaG0w6mM6OOe_MyuXwsOg2nyO6JIy1kpyGJtRKELYJ6MvhHDGrai01E/exec`
   - `PORT` : `8000`
8. Pada bagian **Instance**, pilih **Nano (Free)**.
9. Klik **Deploy**.

---

### 3. Tautkan WhatsApp (Scan QR)
1. Setelah status deployment di Koyeb berubah menjadi **Healthy** (biasanya 1–2 menit), klik domain Koyeb Anda (contoh: `https://sheetkas-bot-xxx.koyeb.app`).
2. Buka link tersebut di browser HP atau Laptop.
3. Di HP Anda, buka WhatsApp > **Perangkat Tertaut** > **Tautkan Perangkat**.
4. Scan QR code yang tampil di browser.
5. Halaman web akan otomatis berubah menjadi `🟢 Bot WhatsApp Aktif & Terhubung!`.

---

## 🧪 Cara Menjalankan di Komputer Lokal (Opsional)
Jika ingin menguji terlebih dahulu di laptop:

```bash
cd wa_bot
npm install
npm start
```
Buka browser di `http://localhost:8000` dan scan QR code.
