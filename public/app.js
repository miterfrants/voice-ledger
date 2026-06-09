const stageEl = document.getElementById('stage');
const reviewEl = document.getElementById('review');
const doneEl = document.getElementById('done');

const micBtn = document.getElementById('mic');
const statusEl = document.getElementById('status');
const promptEl = document.getElementById('prompt');

const bubbleEl = document.getElementById('bubble');
const fItem = document.getElementById('f-item');
const fAmount = document.getElementById('f-amount');
const fDate = document.getElementById('f-date');

const retryBtn = document.getElementById('retry');
const confirmBtn = document.getElementById('confirm');
const doneSub = document.getElementById('doneSub');

let mediaRecorder = null;
let chunks = [];
let stream = null;

function setStatus(msg, state) {
  statusEl.textContent = msg;
  if (state) statusEl.setAttribute('data-state', state);
  else statusEl.removeAttribute('data-state');
}

function show(section) {
  for (const el of [stageEl, reviewEl, doneEl]) {
    el.classList.toggle('hide', el !== section);
  }
}

// 回到麥克風起始畫面
function resetToMic() {
  show(stageEl);
  setStatus('準備好囉 ✨');
}

// ── 錄音 ──────────────────────────────────────────────────
async function startRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setStatus('要開麥克風權限才能聽你說喔 🥺', 'err');
    return;
  }
  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    stream.getTracks().forEach((t) => t.stop());
    if (blob.size > 0) sendAudio(blob);
  };
  mediaRecorder.start();
  micBtn.classList.add('recording');
  setStatus('我在聽…放開就好 👂', 'rec');
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
  if (micBtn.classList.contains('recording')) {
    micBtn.classList.remove('recording');
    setStatus('辨識中… 🤔', 'busy');
  }
}

// ── 辨識(不寫入,回傳結果讓使用者確認)──────────────────────
async function sendAudio(blob) {
  setStatus('辨識中… 🤔', 'busy');
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  try {
    const res = await fetch('/api/record', { method: 'POST', body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || '出錯了');
    fillReview(json);
  } catch (err) {
    setStatus(err.message + ' 再試一次吧', 'err');
  }
}

// 把辨識結果填入確認卡片
function fillReview({ transcript, data }) {
  bubbleEl.textContent = transcript || '';
  fItem.value = data.item || '';
  fAmount.value = data.amount || 0;
  fDate.value = data.date || '';
  show(reviewEl);
}

// ── 確認才真正寫入 Google Sheet ──────────────────────────────
async function confirmEntry() {
  const data = {
    item: fItem.value.trim(),
    amount: Number(fAmount.value) || 0,
    date: fDate.value,
  };
  if (!data.item && !data.amount) {
    fItem.focus();
    return;
  }
  confirmBtn.disabled = true;
  confirmBtn.textContent = '記帳中…';
  try {
    const res = await fetch('/api/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || '寫入失敗');
    doneSub.textContent = `${data.item}　$${Number(data.amount).toLocaleString('zh-TW')}`;
    show(doneEl);
    setTimeout(resetToMic, 1800);
  } catch (err) {
    alert('記帳失敗:' + err.message);
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = '確認記帳 ✓';
  }
}

// ── 事件 ──────────────────────────────────────────────────
micBtn.addEventListener('mousedown', startRecording);
micBtn.addEventListener('mouseup', stopRecording);
micBtn.addEventListener('mouseleave', stopRecording);
micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
micBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

retryBtn.addEventListener('click', resetToMic);
confirmBtn.addEventListener('click', confirmEntry);
