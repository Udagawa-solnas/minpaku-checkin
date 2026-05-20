/**
 * checkin.js — ゲスト チェックイン ロジック
 */

// 撮影データ保持
const captures = { id: null, face: null };
const streams  = { id: null, face: null };

// ─── ステップ移動 ─────────────────────────────
function nextStep(n) {
  // バリデーション
  if (n === 2 && !validateStep1()) return;
  if (n === 4) buildConfirm();

  // 全カメラを停止
  Object.keys(streams).forEach(k => {
    if (streams[k]) { streams[k].getTracks().forEach(t => t.stop()); streams[k] = null; }
  });

  // 全パネルを隠す
  document.querySelectorAll('.form-panel').forEach(p => p.classList.add('hidden'));

  const target = n === 'done' ? document.getElementById('stepDone')
                              : document.getElementById(`step${n}`);
  target.classList.remove('hidden');

  // ステップインジケーター更新
  document.querySelectorAll('.step').forEach(s => {
    const sn = parseInt(s.dataset.step);
    s.classList.remove('active', 'done');
    if (typeof n === 'number') {
      if (sn < n) s.classList.add('done');
      if (sn === n) s.classList.add('active');
    }
  });

  // ステップ2・3ではカメラUIをリセットして自動起動
  if (n === 2) resetCameraUI('id',   () => startCamera('id'));
  if (n === 3) resetCameraUI('face', () => startCamera('face'));

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// カメラUIをリセットしてからコールバック実行
function resetCameraUI(type, cb) {
  const videoEl  = document.getElementById(`${type}Video`);
  const preview  = document.getElementById(`${type}Preview`);
  const startBtn = document.getElementById(`start${capitalize(type)}Camera`);
  const shootBtn = document.getElementById(`shoot${capitalize(type)}`);
  const retryBtn = document.getElementById(`retry${capitalize(type)}`);

  // プレビューをクリア（撮り直しのとき前の画像が残らないように）
  preview.src = '';
  preview.classList.add('hidden');
  videoEl.classList.remove('hidden');
  startBtn.classList.add('hidden');
  shootBtn.classList.remove('hidden');
  retryBtn.classList.add('hidden');

  captures[type] = null;
  cb();
}

// ─── バリデーション ────────────────────────────
function validateStep1() {
  const required = { guestName: '氏名', nationality: '国籍', checkinDate: 'チェックイン日', checkoutDate: 'チェックアウト日', roomNumber: '部屋番号' };
  for (const [id, label] of Object.entries(required)) {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.style.borderColor = '#c0392b';
      el.focus();
      const msg = currentLang === 'en' ? `Please enter ${label}` : `「${label}」を入力してください`;
      alert(msg);
      setTimeout(() => el.style.borderColor = '', 2000);
      return false;
    }
  }
  const ci = new Date(document.getElementById('checkinDate').value);
  const co = new Date(document.getElementById('checkoutDate').value);
  if (co <= ci) {
    alert(currentLang === 'en' ? 'Check-out must be after check-in' : 'チェックアウトはチェックイン日より後にしてください');
    return false;
  }
  return true;
}

// ─── カメラ起動 ────────────────────────────────
async function startCamera(type) {
  const videoEl = document.getElementById(`${type}Video`);
  const startBtn = document.getElementById(`start${capitalize(type)}Camera`);
  const shootBtn = document.getElementById(`shoot${capitalize(type)}`);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: type === 'id' ? 'environment' : 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    streams[type] = stream;
    videoEl.srcObject = stream;
    videoEl.classList.remove('hidden');

    startBtn.classList.add('hidden');
    shootBtn.classList.remove('hidden');
  } catch (err) {
    alert((currentLang === 'en' ? 'Camera error: ' : 'カメラエラー: ') + err.message);
  }
}

// ─── 撮影 ─────────────────────────────────────
function capture(type) {
  const videoEl  = document.getElementById(`${type}Video`);
  const canvas   = document.getElementById(`${type}Canvas`);
  const preview  = document.getElementById(`${type}Preview`);
  const shootBtn = document.getElementById(`shoot${capitalize(type)}`);
  const retryBtn = document.getElementById(`retry${capitalize(type)}`);
  const nextBtn  = document.getElementById(`step${type === 'id' ? 2 : 3}Next`);

  canvas.width  = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext('2d').drawImage(videoEl, 0, 0);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  captures[type] = dataUrl;

  // プレビュー表示
  preview.src = dataUrl;
  preview.classList.remove('hidden');
  videoEl.classList.add('hidden');

  shootBtn.classList.add('hidden');
  retryBtn.classList.remove('hidden');
  if (nextBtn) nextBtn.style.display = '';
}

// ─── 撮り直し ──────────────────────────────────
function retryCapture(type) {
  const videoEl  = document.getElementById(`${type}Video`);
  const preview  = document.getElementById(`${type}Preview`);
  const shootBtn = document.getElementById(`shoot${capitalize(type)}`);
  const retryBtn = document.getElementById(`retry${capitalize(type)}`);

  captures[type] = null;
  preview.src = '';
  preview.classList.add('hidden');
  videoEl.classList.remove('hidden');
  shootBtn.classList.remove('hidden');
  retryBtn.classList.add('hidden');

  // カメラを再起動
  startCamera(type);
}

// ─── 確認画面 ─────────────────────────────────
function buildConfirm() {
  const fields = {
    [currentLang === 'en' ? 'Full Name' : '氏名']: document.getElementById('guestName').value,
    [currentLang === 'en' ? 'Nationality' : '国籍']: document.getElementById('nationality').value,
    [currentLang === 'en' ? 'Date of Birth' : '生年月日']: document.getElementById('dob').value || '—',
    [currentLang === 'en' ? 'Check-in' : 'チェックイン']: document.getElementById('checkinDate').value,
    [currentLang === 'en' ? 'Check-out' : 'チェックアウト']: document.getElementById('checkoutDate').value,
    [currentLang === 'en' ? 'Room' : '部屋']: document.getElementById('roomNumber').value,
    [currentLang === 'en' ? 'Guests' : '人数']: document.getElementById('guestCount').value + (currentLang === 'en' ? ' person(s)' : '名'),
    [currentLang === 'en' ? 'Emergency' : '緊急連絡先']: document.getElementById('emergencyContact').value || '—',
  };

  document.getElementById('confirmGrid').innerHTML = Object.entries(fields).map(([k, v]) => `
    <div class="confirm-row">
      <div class="ck">${k}</div>
      <div class="cv">${v}</div>
    </div>`).join('');

  document.getElementById('confirmId').src   = captures.id   || '';
  document.getElementById('confirmFace').src = captures.face || '';
}

// ─── 送信 ─────────────────────────────────────
async function submitCheckin() {
  if (!document.getElementById('agreeCheck').checked) {
    alert(currentLang === 'en' ? 'Please agree to the house rules.' : '宿泊規約に同意してください。');
    return;
  }

  const status = document.getElementById('submitStatus');
  const btn    = document.getElementById('submitBtn');
  status.className = 'submit-status loading';
  status.textContent = currentLang === 'en' ? '⏳ Sending data...' : '⏳ データを送信中...';
  status.classList.remove('hidden');
  btn.disabled = true;

  const data = {
    timestamp:        new Date().toISOString(),
    guestName:        document.getElementById('guestName').value,
    nationality:      document.getElementById('nationality').value,
    dob:              document.getElementById('dob').value,
    checkinDate:      document.getElementById('checkinDate').value,
    checkoutDate:     document.getElementById('checkoutDate').value,
    guestCount:       document.getElementById('guestCount').value,
    roomNumber:       document.getElementById('roomNumber').value,
    emergencyContact: document.getElementById('emergencyContact').value,
    idPhoto:          captures.id   || '',
    facePhoto:        captures.face || '',
  };

  try {
    await sendToSheets(data);
    document.getElementById('doneRoom').textContent = `Room ${data.roomNumber}`;
    nextStep('done');
  } catch (err) {
    status.className = 'submit-status error';
    status.textContent = (currentLang === 'en' ? '❌ Error: ' : '❌ エラー: ') + err.message;
    btn.disabled = false;
  }
}

// ─── リセット ─────────────────────────────────
function resetForm() {
  captures.id = captures.face = null;
  document.querySelectorAll('input, select').forEach(el => {
    if (el.type !== 'checkbox') el.value = '';
  });
  document.getElementById('agreeCheck').checked = false;
  nextStep(1);
}

// ─── ユーティリティ ────────────────────────────
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
