// wa_bot/index.js
require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const axios = require('axios');
const path = require('path');
const pino = require('pino');
const { parseTransaction } = require('./parser');

const app = express();
const PORT = process.env.PORT || 8000;
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxN3l6lTZX-UoaG0w6mM6OOe_MyuXwsOg2nyO6JIy1kpyGJtRKELYJ6MvhHDGrai01E/exec';
const GAS_URL = process.env.GAS_URL || DEFAULT_GAS_URL;

// KATA KUNCI NAMA GRUP (HANYA respons grup yang mengandung kata ini di namanya)
// Anda bisa ubah atau sesuaikan dengan nama grup Anda
const TARGET_GROUP_KEYWORDS = (process.env.TARGET_GROUP_KEYWORDS || 'sheetkas,catatan,keuangan,duit,dompet,pribadi,kas').toLowerCase().split(',');

let currentQR = '';
let connectionStatus = 'Menunggu Scan QR';
let lastConnectedTime = null;
const botStartTime = Date.now();
const sentMessageIds = new Set();
const groupMetadataCache = new Map(); // Cache nama grup agar hemat request

// Helper untuk mengirim pesan & mencatat ID agar tidak loop
async function sendBotMessage(sock, jid, content, options = {}) {
  try {
    const sent = await sock.sendMessage(jid, content, options);
    if (sent?.key?.id) {
      sentMessageIds.add(sent.key.id);
      if (sentMessageIds.size > 500) {
        const firstKey = sentMessageIds.values().next().value;
        sentMessageIds.delete(firstKey);
      }
    }
    return sent;
  } catch (err) {
    console.error('[Error Kirim Pesan]', err.message);
  }
}

// ==========================================
// 1. Web Dashboard (Untuk Scan QR di Browser)
// ==========================================
app.get('/', async (req, res) => {
  if (connectionStatus === 'Terhubung') {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SheetKas WhatsApp Bot</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center; max-width: 420px; width: 90%; }
          .badge { display: inline-block; background: #10b981; color: #fff; padding: 6px 16px; border-radius: 999px; font-weight: bold; font-size: 14px; margin-bottom: 16px; }
          h2 { margin: 0 0 8px 0; }
          p { color: #94a3b8; line-height: 1.5; font-size: 14px; }
          .box { background: #0f172a; border-radius: 8px; padding: 12px; margin-top: 16px; text-align: left; font-size: 13px; color: #cbd5e1; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">🟢 AKTIF & TERHUBUNG</div>
          <h2>SheetKas Bot Berjalan!</h2>
          <p>Bot WhatsApp sudah terhubung dan <b>DILOCK KHUSUS GRUP KEUANGAN ANDA</b>.</p>
          <div class="box">
            <b>Tips Penggunaan di Grup WA:</b><br/>
            • <code>makan bakso 25k qris</code><br/>
            • <code>bensin 20000 cash</code><br/>
            • <code>+ 1jt bonus freelance tf</code><br/>
            • <code>saldo</code>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  if (!currentQR) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>SheetKas WhatsApp Bot - Menyiapkan</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="3">
        <style>
          body { font-family: -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
          .card { background: #1e293b; padding: 32px; border-radius: 16px; }
          .spinner { border: 4px solid #334155; border-top: 4px solid #38bdf8; border-radius: 50%; width: 36px; height: 36px; animation: spin 1s linear infinite; margin: 0 auto 16px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h2>Sedang Menyiapkan QR Code...</h2>
          <p style="color:#94a3b8;">Halaman otomatis refresh dalam 3 detik...</p>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const qrImage = await QRCode.toDataURL(currentQR, { width: 300, margin: 2 });
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Scan WhatsApp - SheetKas</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="20">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #1e293b; padding: 32px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); text-align: center; max-width: 400px; width: 90%; }
          img { border-radius: 12px; margin: 16px 0; background: #fff; padding: 8px; }
          p { color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.5; }
          .hint { font-size: 12px; color: #64748b; margin-top: 12px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>📱 Hubungkan WhatsApp</h2>
          <p>Buka WA di HP > <b>Perangkat Tertaut</b> > <b>Tautkan Perangkat</b> lalu scan kode di bawah:</p>
          <img src="${qrImage}" alt="QR Code" width="260" height="260"/>
          <p class="hint">QR Code diperbarui otomatis tiap 20 detik.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Gagal membuat QR image: ' + err.message);
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', connection: connectionStatus, lastConnected: lastConnectedTime });
});

app.listen(PORT, () => {
  console.log(`[HTTP] Server aktif di port ${PORT}`);
});

// ==========================================
// 2. WhatsApp Bot Listener (Baileys)
// ==========================================
async function startBot() {
  const sessionPath = path.join(__dirname, 'session_auth');
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    browser: ['SheetKas Laptop', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      currentQR = qr;
      console.log('[WA] QR Code baru telah dibuat. Silakan buka browser untuk scan.');
    }

    if (connection === 'close') {
      connectionStatus = 'Terputus';
      const statusCode = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[WA] Koneksi terputus (status: ${statusCode}). Reconnecting...`);
      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        console.log('[WA] Logged out. Silakan scan QR ulang.');
        currentQR = '';
      }
    } else if (connection === 'open') {
      connectionStatus = 'Terhubung';
      lastConnectedTime = new Date().toISOString();
      currentQR = '';
      console.log('🎉 [WA] Berhasil terhubung ke WhatsApp! Pengaman grup aktif.');
    }
  });

  // Handle Pesan Masuk
  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (!m.messages || m.messages.length === 0) return;
      const msg = m.messages[0];
      if (!msg || !msg.message) return;

      // 1. Abaikan pesan dari balasan bot sendiri (mencegah loop)
      if (sentMessageIds.has(msg.key.id)) return;

      // 2. Abaikan pesan riwayat lama sebelum bot start
      const msgTime = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now();
      if (msgTime < botStartTime - 10000) return;

      const from = msg.key.remoteJid;
      if (!from) return;

      const isGroup = from.endsWith('@g.us');

      // ================================================================
      // 🔒 PENGAMAN SUPER KETAT:
      // HANYA GRUP DENGAN NAMA 'SHEETKAS' / 'SEETKAS' & MAKSIMAL 2 ORANG!
      // ================================================================
      if (isGroup) {
        let groupMeta = groupMetadataCache.get(from);
        if (!groupMeta) {
          try {
            groupMeta = await sock.groupMetadata(from);
            groupMetadataCache.set(from, groupMeta);
          } catch (e) {
            console.log('[Filter] Gagal mengambil metadata grup:', from);
            return;
          }
        }

        const groupSubject = (groupMeta?.subject || '').toLowerCase();
        const participantCount = groupMeta?.participants?.length || 99;

        const isSheetkasName = /s[he]*etkas/i.test(groupSubject);
        const isMax2People = participantCount <= 2;

        if (!isSheetkasName || !isMax2People) {
          // BUKAN GRUP SHEETKAS ATAU ANGGOTA LEBIH DARI 2 ORANG! TOLAK & ABAIKAN TOTAL!
          return;
        }

        console.log(`[Grup Terverifikasi]: "${groupMeta?.subject}" (${participantCount} anggota)`);
      } else {
        // Jika bukan grup, abaikan pesan pribadi dari orang lain (kecuali dari diri sendiri)
        if (!msg.key.fromMe) return;
      }

      // 3. Ekstraksi teks pesan
      let messageContent = msg.message;
      if (messageContent?.ephemeralMessage?.message) {
        messageContent = messageContent.ephemeralMessage.message;
      }
      if (messageContent?.viewOnceMessage?.message) {
        messageContent = messageContent.viewOnceMessage.message;
      }

      const body = messageContent?.conversation ||
                   messageContent?.extendedTextMessage?.text ||
                   messageContent?.imageMessage?.caption || '';

      if (!body || typeof body !== 'string') return;

      // 4. Parser SheetKas
      const parsed = parseTransaction(body);
      if (!parsed) return; // Bukan perintah transaksi

      console.log(`[Perintah Diterima di Grup Khusus]: "${body}"`);

      // --- Perintah Bantuan ---
      if (parsed.type === 'HELP') {
        await sendBotMessage(sock, from, {
          text: `📌 *Panduan Format Input SheetKas*\n\n` +
                `• *Pengeluaran:*\n` +
                `  - \`makan siang 25k qris\`\n` +
                `  - \`bensin 20000 cash\`\n` +
                `  - \`kopi 18rb transfer\`\n\n` +
                `• *Pemasukan:*\n` +
                `  - \`+ 500k gaji freelance\`\n` +
                `  - \`+ 1jt bonus transfer\`\n\n` +
                `• *Cek Saldo:*\n` +
                `  - Ketik \`saldo\`\n\n` +
                `_Metode otomatis: Cash / QRIS / Transfer_`
        }, { quoted: msg });
        return;
      }

      // --- Perintah Cek Saldo ---
      if (parsed.type === 'CHECK_BALANCE') {
        try {
          console.log('[Mengambil Saldo dari Sheets...]');
          const res = await axios.get(GAS_URL, { timeout: 15000 });
          const summary = res.data?.summary || {};
          const formatRp = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID');

          const replyText =
            `📊 *Status Saldo SheetKas Saat Ini*\n\n` +
            `💵 Saldo Cash: ${formatRp(summary.balanceCash)}\n` +
            `💳 Saldo QRIS: ${formatRp(summary.balanceQris)}\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `💰 *Total Saldo:* ${formatRp(summary.balance)}\n` +
            `🛡️ *Saldo Aman:* ${formatRp(summary.safeBalance)}\n\n` +
            `_Terakhir diperbarui: ${new Date().toLocaleTimeString('id-ID')}_`;

          await sendBotMessage(sock, from, { text: replyText }, { quoted: msg });
        } catch (err) {
          console.error('[Error Check Balance]', err.message);
          await sendBotMessage(sock, from, { text: '❌ Gagal mengambil saldo dari Google Sheets: ' + err.message }, { quoted: msg });
        }
        return;
      }

      // --- Tambah Transaksi ke Google Sheets ---
      if (parsed.type === 'TRANSACTION') {
        try {
          const now = new Date();
          const tglStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const formatRp = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID');

          const payload = {
            action: 'add',
            requestId: 'wa-' + Date.now(),
            tanggalKejadian: tglStr,
            description: parsed.description,
            metode: parsed.metode,
            income: parsed.isIncome ? parsed.amount : 0,
            expense: parsed.isIncome ? 0 : parsed.amount,
            category: parsed.category
          };

          console.log('[Kirim Transaksi ke Sheets]:', payload);
          const res = await axios.post(GAS_URL, payload, { timeout: 20000 });

          if (res.data && res.data.success !== false) {
            const tipeLabel = parsed.isIncome ? '💰 *Pemasukan*' : '💸 *Pengeluaran*';
            const sisaSaldo = res.data.transaction?.balance !== undefined 
              ? `\n📊 *Sisa Saldo:* ${formatRp(res.data.transaction.balance)}` 
              : '';

            const replyText =
              `✅ *Transaksi Berhasil Dicatat!*\n\n` +
              `📝 Deskripsi: ${parsed.description}\n` +
              `${tipeLabel}: ${formatRp(parsed.amount)}\n` +
              `💳 Metode: ${parsed.metode}\n` +
              `🏷️ Kategori: ${parsed.category}\n` +
              `📅 Tanggal: ${tglStr}${sisaSaldo}\n\n` +
              `_Data otomatis tersinkron ke Flutter & Web!_`;

            await sendBotMessage(sock, from, { text: replyText }, { quoted: msg });
            console.log('✅ Transaksi berhasil dicatat dan dibalas ke WhatsApp!');
          } else {
            throw new Error(res.data?.error || 'Gagal menyimpan transaksi.');
          }
        } catch (err) {
          console.error('[Error Add Transaction]', err.message);
          await sendBotMessage(sock, from, { text: '❌ Gagal mencatat ke Google Sheets: ' + err.message }, { quoted: msg });
        }
      }
    } catch (outerErr) {
      console.error('[Error Handling Message]', outerErr);
    }
  });
}

// Mulai bot
startBot().catch((err) => console.error('[Fatal Start Bot]', err));
