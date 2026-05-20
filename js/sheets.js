/**
 * sheets.js — Google Sheets 連携
 * オフライン時はローカル保存、オンライン復帰時に自動同期
 */

function getGasUrl() {
  return localStorage.getItem('minpaku_gas_url') || '';
}

function getEmails() {
  try { return JSON.parse(localStorage.getItem('notify_emails') || '[]'); } catch { return []; }
}

// ─── データ送信 ───────────────────────────────
function sendToSheets(data) {
  return new Promise((resolve) => {
    // オフライン or GAS未設定 → ローカルに未送信として保存
    if (!navigator.onLine || !getGasUrl()) {
      saveLocal(data, false);  // false = 未送信
      resolve();
      return;
    }
    submitToGas(data)
      .then(() => {
        saveLocal(data, true);   // 送信済み
        resolve();
      })
      .catch(() => {
        saveLocal(data, false);  // 失敗 → 未送信
        resolve();
      });
  });
}

// ─── GASへ送信 (iframe + form) ───────────────
function submitToGas(data) {
  return new Promise((resolve, reject) => {
    const url = getGasUrl();
    if (!url) { reject(new Error('GAS URL未設定')); return; }

    const iframeId = 'gas_iframe_' + Date.now();
    const iframe   = document.createElement('iframe');
    iframe.name    = iframeId;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const timer = setTimeout(() => { cleanup(); resolve(); }, 15000);

    iframe.onload  = () => { cleanup(); resolve(); };
    iframe.onerror = () => { cleanup(); reject(new Error('送信失敗')); };

    function cleanup() {
      clearTimeout(timer);
      if (form && form.parentNode) document.body.removeChild(form);
      setTimeout(() => { if (iframe.parentNode) document.body.removeChild(iframe); }, 1000);
    }

    const form    = document.createElement('form');
    form.method   = 'POST';
    form.action   = url;
    form.target   = iframeId;
    form.style.display = 'none';

    const payload = {
      action: 'checkin',
      notifyEmails: getEmails(),
      data: {
        timestamp:        data.timestamp,
        guestName:        data.guestName,
        nationality:      data.nationality,
        dob:              data.dob,
        checkinDate:      data.checkinDate,
        checkoutDate:     data.checkoutDate,
        roomNumber:       data.roomNumber,
        guestCount:       data.guestCount,
        emergencyContact: data.emergencyContact,
        idPhoto:          data.idPhoto   || '',
        facePhoto:        data.facePhoto || '',
      }
    };

    const input  = document.createElement('input');
    input.type   = 'hidden';
    input.name   = 'payload';
    input.value  = JSON.stringify(payload);
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
  });
}

// ─── オンライン復帰時に未送信データを同期 ────
async function syncPending() {
  const url = getGasUrl();
  if (!url || !navigator.onLine) return;

  const records = loadLocal();
  const pending = records.filter(r => r._synced === false);
  if (!pending.length) return;

  console.log(`未送信データ ${pending.length}件を同期中...`);

  for (const r of pending) {
    try {
      await submitToGas(r);
      // 送信済みフラグを更新
      r._synced = true;
      console.log(`同期完了: ${r.guestName}`);
    } catch (e) {
      console.warn(`同期失敗: ${r.guestName}`);
    }
  }

  // フラグを保存
  localStorage.setItem('minpaku_records', JSON.stringify(records.slice(0, 200)));

  const doneCount = pending.filter(r => r._synced).length;
  if (doneCount > 0) {
    showSyncToast(`✅ ${doneCount}件のオフラインデータを同期しました`);
  }
}

// 同期完了トースト通知
function showSyncToast(msg) {
  const toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:#2d6a4f; color:#fff; padding:12px 24px; border-radius:8px;
    font-size:14px; z-index:9999; box-shadow:0 4px 16px rgba(0,0,0,.2);
    animation: fadeIn .3s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ─── オンライン/オフライン検知 ───────────────
window.addEventListener('online', () => {
  console.log('オンライン復帰 → 同期開始');
  syncPending();
});

window.addEventListener('offline', () => {
  console.log('オフライン → ローカル保存モード');
});

// 起動時にも未送信データをチェック
window.addEventListener('load', () => {
  if (navigator.onLine) syncPending();
});

// ─── データ取得 ───────────────────────────────
async function fetchFromSheets() {
  const url = getGasUrl();
  if (!url || !navigator.onLine) return loadLocal();

  try {
    const res  = await fetch(`${url}?action=list`, { method: 'GET' });
    const json = await res.json();
    const gasRecords   = json.records || [];
    const localRecords = loadLocal();
    const all  = [...gasRecords, ...localRecords];
    const seen = new Set();
    return all.filter(r => {
      const key = r.timestamp + r.guestName;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (e) {
    return loadLocal();
  }
}

// ─── ローカル保存 ─────────────────────────────
function saveLocal(data, synced = true) {
  const records = loadLocal();
  const exists  = records.some(r => r.timestamp === data.timestamp && r.guestName === data.guestName);
  if (!exists) {
    records.unshift({ ...data, _synced: synced });
    try {
      localStorage.setItem('minpaku_records', JSON.stringify(records.slice(0, 200)));
    } catch(e) {
      const slim = records.map(r => ({...r, idPhoto:'', facePhoto:''}));
      localStorage.setItem('minpaku_records', JSON.stringify(slim.slice(0, 200)));
    }
  }
}

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem('minpaku_records') || '[]');
  } catch { return []; }
}
