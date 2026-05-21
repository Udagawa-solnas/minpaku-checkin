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
  const checks = [
    { id: 'guestName',    key: 'err_name' },
    { id: 'nationality',  key: 'err_nationality' },
    { id: 'checkinDate',  key: 'err_checkin' },
    { id: 'checkoutDate', key: 'err_checkout' },
    { id: 'roomNumber',   key: 'err_room' },
  ];
  for (const { id, key } of checks) {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.style.borderColor = '#c0392b';
      el.focus();
      alert(t(key));
      setTimeout(() => el.style.borderColor = '', 2000);
      return false;
    }
  }
  const ci = new Date(document.getElementById('checkinDate').value);
  const co = new Date(document.getElementById('checkoutDate').value);
  if (co <= ci) {
    alert(t('err_date'));
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
    alert(t('camera_error') + err.message);
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

  // 画質チェック
  const check = checkImageQuality(canvas, type);
  if (!check.ok) {
    showQualityError(type, check.message);
    return;
  }

  // 顔写真の場合は顔検出チェック
  if (type === 'face') {
    showQualityError(type, t('checking_face'));
    checkFaceDetection(canvas).then(faceCheck => {
      // エラーメッセージを消す
      const box = document.getElementById('faceCameraBox');
      const el  = box.querySelector('.quality-error');
      if (el) el.remove();

      if (!faceCheck.ok) {
        showQualityError(type, faceCheck.message);
        return;
      }
      finishCapture(type, canvas, faceCheck.score);
    });
    return;
  }

  finishCapture(type, canvas, check.score);
}

// ─── 撮影完了処理 ─────────────────────────────
function finishCapture(type, canvas, score) {
  const preview  = document.getElementById(`${type}Preview`);
  const videoEl  = document.getElementById(`${type}Video`);
  const shootBtn = document.getElementById(`shoot${capitalize(type)}`);
  const retryBtn = document.getElementById(`retry${capitalize(type)}`);
  const nextBtn  = document.getElementById(`step${type === 'id' ? 2 : 3}Next`);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  captures[type] = dataUrl;

  preview.src = dataUrl;
  preview.classList.remove('hidden');
  videoEl.classList.add('hidden');
  shootBtn.classList.add('hidden');
  retryBtn.classList.remove('hidden');
  if (nextBtn) nextBtn.style.display = '';

  showQualityBadge(type, score);
}

// ─── 顔検出チェック (face-api.js) ────────────
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model';
let faceModelsLoaded = false;

async function loadFaceModels() {
  if (faceModelsLoaded) return;
  if (typeof faceapi === 'undefined') return;
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  faceModelsLoaded = true;
}

async function checkFaceDetection(canvas) {
  try {
    if (typeof faceapi === 'undefined') {
      return { ok: true, score: 80, message: '' };
    }
    await loadFaceModels();

    const options    = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });
    const detections = await faceapi.detectAllFaces(canvas, options);

    if (detections.length === 0) {
      return { ok: false, score: 0, message: t('no_face') };
    }

    if (detections.length > 1) {
      return { ok: false, score: 0, message: t('multi_face') };
    }

    const det        = detections[0];
    const score      = Math.round(det.score * 100);
    const faceArea   = det.box.width * det.box.height;
    const canvasArea = canvas.width * canvas.height;
    const faceRatio  = faceArea / canvasArea;

    if (faceRatio < 0.05) {
      return { ok: false, score: 0, message: t('face_small') };
    }

    return { ok: true, score, message: '' };

  } catch(e) {
    return { ok: true, score: 80, message: '' };
  }
}
function checkImageQuality(canvas, type) {
  // OpenCV未ロードの場合はスキップ
  if (typeof cv === 'undefined' || !cv.Mat) {
    return { ok: true, score: 100, message: '' };
  }

  let src  = cv.imread(canvas);
  let gray = new cv.Mat();
  let result = { ok: true, score: 100, message: '' };

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // ── 1. 明るさチェック ──────────────────────
    const mean = cv.mean(gray);
    const brightness = mean[0]; // 0-255
    if (brightness < 40) {
      result = { ok: false, score: 0, message: t('dark') };
      return result;
    }
    if (brightness > 230) {
      result = { ok: false, score: 0, message: t('bright') };
      return result;
    }

    // ── 2. ぼけチェック (ラプラシアン分散) ────
    let lap = new cv.Mat();
    cv.Laplacian(gray, lap, cv.CV_64F);
    const lapMean = cv.mean(lap);
    let lapSq = new cv.Mat();
    cv.multiply(lap, lap, lapSq);
    const lapSqMean = cv.mean(lapSq);
    const variance = lapSqMean[0] - lapMean[0] * lapMean[0];
    lap.delete(); lapSq.delete();

    if (variance < 100) {
      result = { ok: false, score: 0, message: t('blurry') };
      return result;
    }

    // ── 3. パスポート/身分証チェック (エッジ密度) ──
    if (type === 'id') {
      let edges = new cv.Mat();
      cv.Canny(gray, edges, 50, 150);
      const edgeMean    = cv.mean(edges);
      const edgeDensity = edgeMean[0];
      edges.delete();

      if (edgeDensity < 3) {
        result = { ok: false, score: 0, message: t('no_doc') };
        return result;
      }
    }

    // ── 4. スコア計算 ─────────────────────────
    const brightnessScore = 100 - Math.abs(brightness - 128) / 1.28;
    const sharpnessScore  = Math.min(100, variance / 10);
    const score = Math.round((brightnessScore + sharpnessScore) / 2);

    result = { ok: true, score, message: '' };

  } catch(e) {
    result = { ok: true, score: 80, message: '' };
  } finally {
    src.delete(); gray.delete();
  }

  return result;
}

// 品質エラー表示
function showQualityError(type, message) {
  const box = document.getElementById(`${type}CameraBox`);
  let el = box.querySelector('.quality-error');
  if (!el) {
    el = document.createElement('div');
    el.className = 'quality-error';
    el.style.cssText = 'position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(192,57,43,.9);color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;white-space:nowrap;z-index:10;';
    box.appendChild(el);
  }
  el.textContent = message;
  setTimeout(() => el.remove(), 3000);
}

// 品質バッジ表示
function showQualityBadge(type, score) {
  const wrap = document.getElementById(`${type}CameraBox`).parentElement;
  let el = wrap.querySelector('.quality-badge');
  if (!el) {
    el = document.createElement('div');
    el.className = 'quality-badge';
    el.style.cssText = 'margin-top:6px;font-size:12px;text-align:center;';
    wrap.appendChild(el);
  }
  const color = score >= 80 ? '#3ecf8e' : score >= 60 ? '#fbbf24' : '#f87171';
  const label = score >= 80 ? t('quality_good') : score >= 60 ? t('quality_ok') : t('quality_bad');
  el.innerHTML = `<span style="color:${color};font-weight:500;">${label}</span> <span style="color:#888;">(${score})</span>`;
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
    [t('confirm_name')]:        document.getElementById('guestName').value,
    [t('confirm_nationality')]: document.getElementById('nationality').value,
    [t('confirm_dob')]:         document.getElementById('dob').value || '—',
    [t('confirm_checkin')]:     document.getElementById('checkinDate').value,
    [t('confirm_checkout')]:    document.getElementById('checkoutDate').value,
    [t('confirm_room')]:        document.getElementById('roomNumber').value,
    [t('confirm_guests')]:      document.getElementById('guestCount').value + t('unit_persons'),
    [t('confirm_emergency')]:   document.getElementById('emergencyContact').value || '—',
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
    alert(t('err_agree'));
    return;
  }

  const status = document.getElementById('submitStatus');
  const btn    = document.getElementById('submitBtn');
  status.className = 'submit-status loading';
  status.textContent = t('sending');
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
    status.textContent = '❌ ' + err.message;
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
