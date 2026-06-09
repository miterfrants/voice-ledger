import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { transcribe } from './transcribe.js';
import { parseExpense } from './parse.js';
import { appendRow, ensureHeaders } from './sheets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

// 音檔上傳:存在記憶體即可,Whisper 上限 25MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// 步驟一:語音 → 文字 → 解析欄位。⚠️ 這裡「不寫入」試算表,只回傳給前端確認
app.post('/api/record', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '沒有收到音檔' });
    const text = await transcribe(req.file.buffer, req.file.mimetype);
    if (!text) return res.status(400).json({ error: '沒有辨識到內容,請再說一次' });
    const data = await parseExpense(text);
    res.json({ transcript: text, data });
  } catch (err) {
    console.error('[record]', err);
    res.status(500).json({ error: err.message });
  }
});

// 步驟二:使用者按「確認」後才真正寫入 Google Sheet
app.post('/api/confirm', async (req, res) => {
  try {
    const d = req.body?.data || req.body || {};
    if (!d.item && !d.amount) {
      return res.status(400).json({ error: '資料不完整,無法記帳' });
    }
    const row = {
      date: String(d.date || '').trim(),
      item: String(d.item || '').trim(),
      amount: Number(d.amount) || 0,
    };
    await ensureHeaders();
    await appendRow(row);
    res.json({ ok: true, data: row });
  } catch (err) {
    console.error('[confirm]', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 語音記帳服務啟動:http://localhost:${PORT}`);
});
