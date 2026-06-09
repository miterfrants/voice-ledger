const micBtn = document.getElementById('mic');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const textForm = document.getElementById('textForm');
const textInput = document.getElementById('textInput');

let mediaRecorder = null;
let chunks = [];
let stream = null;

function setStatus(msg) {
  statusEl.textContent = msg;
}

// 把記帳結果加進畫面清單
function addLog(result, isError = false) {
  const li = document.createElement('li');
  if (isError) {
    li.className = 'error';
    li.textContent = `⚠️ ${result}`;
  } else {
    const { transcript, data } = result;
    li.innerHTML = `
      <div class="row-main">
        <span>${data.item}</span>
        <span class="amount">$${data.amount}</span>
      </div>
      <div class="meta">${data.date}・${data.category}${data.note ? '・' + data.note : ''}</div>
      <div class="meta">🗣️ ${transcript}</div>
    `;
  }
  logEl.prepend(li);
}

async function sendAudio(blob) {
  setStatus('辨識中…');
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  try {
    const res = await fetch('/api/record', { method: 'POST', body: form });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || '伺服器錯誤');
    addLog(json);
    setStatus('✅ 已記帳');
  } catch (err) {
    addLog(err.message, true);
    setStatus('❌ 失敗');
  }
}

async function sendText(text) {
  setStatus('處理中…');
  try {
    const res = await fetch('/api/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || '伺服器錯誤');
    addLog(json);
    setStatus('✅ 已記帳');
  } catch (err) {
    addLog(err.message, true);
    setStatus('❌ 失敗');
  }
}

async function startRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setStatus('❌ 無法存取麥克風,請允許權限');
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
  setStatus('🔴 錄音中…放開結束');
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  micBtn.classList.remove('recording');
}

// 按住錄音(滑鼠 + 觸控)
micBtn.addEventListener('mousedown', startRecording);
micBtn.addEventListener('mouseup', stopRecording);
micBtn.addEventListener('mouseleave', stopRecording);
micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
micBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

// 文字輸入
textForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = textInput.value.trim();
  if (!text) return;
  textInput.value = '';
  sendText(text);
});
