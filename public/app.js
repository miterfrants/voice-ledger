const micBtn = document.getElementById('mic');
const statusEl = document.getElementById('status');
const feedEl = document.getElementById('log');
const emptyEl = document.getElementById('empty');
const countEl = document.getElementById('count');
const textForm = document.getElementById('textForm');
const textInput = document.getElementById('textInput');

let mediaRecorder = null;
let chunks = [];
let stream = null;
let entryCount = 0;

// 分類對應的 emoji
const CAT_ICON = {
  餐飲: '🍜', 交通: '🚇', 購物: '🛍️', 娛樂: '🎮',
  居家: '🏠', 醫療: '💊', 其他: '📌',
};

function setStatus(msg, state) {
  statusEl.textContent = msg;
  if (state) statusEl.setAttribute('data-state', state);
  else statusEl.removeAttribute('data-state');
}

function escapeHtml(s = '') {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function updateCount() {
  countEl.textContent = `${entryCount} 筆`;
  emptyEl.classList.toggle('hide', entryCount > 0);
}

// 把一筆辨識結果加進畫面:清楚顯示 時間 / 品項 / 金額 / 分類
function addEntry(result) {
  const { transcript, data } = result;
  const icon = CAT_ICON[data.category] || '📌';
  const amount = Number(data.amount).toLocaleString('zh-TW');

  const li = document.createElement('li');
  li.className = 'entry';
  li.innerHTML = `
    <div class="entry__cat">${icon}</div>
    <div class="entry__body">
      <div class="entry__top">
        <span class="entry__item">${escapeHtml(data.item)}</span>
        <span class="entry__amount"><span class="cur">$</span>${amount}</span>
      </div>
      <div class="entry__meta">
        <span>${escapeHtml(data.date)}</span>
        <span class="entry__tag">${escapeHtml(data.category)}</span>
        ${data.note ? `<span>${escapeHtml(data.note)}</span>` : ''}
      </div>
      <div class="entry__transcript">🗣️ ${escapeHtml(transcript)}</div>
    </div>
  `;
  feedEl.prepend(li);
  entryCount += 1;
  updateCount();
}

function addError(message) {
  const li = document.createElement('li');
  li.className = 'entry error';
  li.innerHTML = `
    <div class="entry__cat">⚠️</div>
    <div class="entry__body">
      <div class="entry__top"><span class="entry__item">記帳失敗</span></div>
      <div class="entry__transcript">${escapeHtml(message)}</div>
    </div>
  `;
  feedEl.prepend(li);
  emptyEl.classList.add('hide');
}

async function sendAudio(blob) {
  setStatus('辨識中…', 'busy');
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  try {
    const res = await fetch('/api/record', { method: 'POST', body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || '伺服器錯誤');
    addEntry(json);
    setStatus('✓ 已記帳', 'ok');
  } catch (err) {
    addError(err.message);
    setStatus('辨識失敗，請再試一次', 'err');
  }
}

async function sendText(text) {
  setStatus('處理中…', 'busy');
  try {
    const res = await fetch('/api/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || '伺服器錯誤');
    addEntry(json);
    setStatus('✓ 已記帳', 'ok');
  } catch (err) {
    addError(err.message);
    setStatus('記帳失敗，請再試一次', 'err');
  }
}

async function startRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setStatus('無法存取麥克風，請允許權限', 'err');
    return;
  }
  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    stream.getTracks().forEach((t) => t.stop());
    if (blob.size > 0) sendAudio(blob);
  };
  mediaRecorder.start();
  micBtn.classList.add('recording');
  setStatus('● 錄音中…放開結束', 'rec');
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  if (micBtn.classList.contains('recording')) {
    micBtn.classList.remove('recording');
    setStatus('辨識中…', 'busy');
  }
}

// 按住錄音(滑鼠 + 觸控)
micBtn.addEventListener('mousedown', startRecording);
micBtn.addEventListener('mouseup', stopRecording);
micBtn.addEventListener('mouseleave', stopRecording);
micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
micBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

// 手動輸入
textForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = textInput.value.trim();
  if (!text) return;
  textInput.value = '';
  sendText(text);
});
