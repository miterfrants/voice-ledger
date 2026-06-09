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

// 共用流程:文字 → 解析 → 寫入試算表
async function handleText(text) {
  if (!text) throw new Error('沒有辨識到任何內容,請再說一次');
  const data = await parseExpense(text);
  await ensureHeaders();
  await appendRow(data);
  return { transcript: text, data };
}

// 語音記帳:上傳音檔 → Whisper → GPT 解析 → 寫入
app.post('/api/record', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '沒有收到音檔' });
    const text = await transcribe(req.file.buffer, req.file.mimetype);
    const result = await handleText(text);
    res.json(result);
  } catch (err) {
    console.error('[record]', err);
    res.status(500).json({ error: err.message });
  }
});

// 純文字記帳(方便測試或手動輸入)
app.post('/api/text', async (req, res) => {
  try {
    const result = await handleText((req.body?.text || '').trim());
    res.json(result);
  } catch (err) {
    console.error('[text]', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 語音記帳服務啟動:http://localhost:${PORT}`);
});
