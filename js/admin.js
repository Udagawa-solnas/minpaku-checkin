/**
 * admin.js — 管理者ダッシュボード
 */

let allRecords = [];

async function loadRecords() {
  document.getElementById('recordsBody').innerHTML =
    '<tr><td colspan="9" class="loading-row">読み込み中...</td></tr>';
  try {
    allRecords = await fetchFromSheets();
    renderTable(allRecords);
    updateStats(allRecords);
  } catch (err) {
    document.getElementById('recordsBody').innerHTML =
      `<tr><td colspan="9" class="loading-row" style="color:#c0392b">❌ エラー: ${err.message}</td></tr>`;
  }
}

function renderTable(records) {
  if (!records.length) {
    document.getElementById('recordsBody').innerHTML =
      '<tr><td colspan="9" class="loading-row">データがありません</td></tr>';
    return;
  }

  document.getElementById('recordsBody').innerHTML = records.map((r, i) => `
    <tr>
      <td style="white-space:nowrap">${fmtDate(r.timestamp)}</td>
      <td><strong>${esc(r.guestName)}</strong></td>
      <td>${esc(r.nationality)}</td>
      <td style="white-space:nowrap">${fmtSimpleDate(r.checkinDate)}</td>
      <td style="white-space:nowrap">${fmtSimpleDate(r.checkoutDate)}</td>
      <td><strong>${esc(r.roomNumber)}</strong></td>
      <td>${esc(r.guestCount)}</td>
      <td>${sourceLabel(r)}</td>
      <td>${r.idPhoto
        ? `<img class="thumb" data-idx="${i}" data-type="id" src="${toImgUrl(r.idPhoto)}" title="クリックで拡大"/>`
        : '<span class="no-photo">—</span>'}</td>
      <td>${r.facePhoto
        ? `<img class="thumb" data-idx="${i}" data-type="face" src="${toImgUrl(r.facePhoto)}" title="クリックで拡大"/>`
        : '<span class="no-photo">—</span>'}</td>
    </tr>`).join('');

  document.querySelectorAll('.thumb').forEach(img => {
    img.addEventListener('click', () => {
      const idx  = parseInt(img.dataset.idx);
      const type = img.dataset.type;
      const src  = type === 'id' ? allRecords[idx].idPhoto : allRecords[idx].facePhoto;
      showPhoto(toImgUrl(src));
    });
  });
}

function updateStats(records) {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const todayRecs = records.filter(r => (r.timestamp || '').startsWith(today));
  const monthRecs = records.filter(r => (r.timestamp || '').startsWith(month));
  const nations   = new Set(records.map(r => r.nationality).filter(Boolean));
  const occupied  = new Set(records.filter(isCurrentlyStaying).map(r => r.roomNumber));
  document.getElementById('statTotal').textContent    = todayRecs.length;
  document.getElementById('statMonth').textContent    = monthRecs.reduce((s, r) => s + (parseInt(r.guestCount) || 0), 0);
  document.getElementById('statNations').textContent  = nations.size;
  document.getElementById('statOccupied').textContent = occupied.size;
}

function isCurrentlyStaying(r) {
  const now = new Date().toISOString().slice(0, 10);
  return r.checkinDate <= now && r.checkoutDate > now;
}

function filterRecords() {
  const date = document.getElementById('filterDate').value;
  const room = document.getElementById('filterRoom').value;
  const filtered = allRecords.filter(r => {
    const matchDate = !date || (r.checkinDate || '').startsWith(date);
    const matchRoom = !room || r.roomNumber === room;
    return matchDate && matchRoom;
  });
  renderTable(filtered);
}

function exportCSV() {
  const headers = ['登録日時','氏名','国籍','生年月日','チェックイン','チェックアウト','部屋','人数','緊急連絡先'];
  const rows = allRecords.map(r => [
    r.timestamp, r.guestName, r.nationality, r.dob,
    r.checkinDate, r.checkoutDate, r.roomNumber, r.guestCount, r.emergencyContact
  ].map(v => `"${String(v||'').replace(/"/g,'""')}"`));
  const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `checkin_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

async function exportPhotos() {
  const btn = document.querySelector('.btn-photos');
  const targets = allRecords.filter(r => r.idPhoto || r.facePhoto);
  if (!targets.length) { alert('写真データがありません'); return; }
  btn.textContent = '⏳ 作成中...';
  btn.disabled = true;
  const zip = new JSZip();
  targets.forEach((r, i) => {
    const name = `${String(i+1).padStart(3,'0')}_${sanitize(r.guestName)}_${r.checkinDate}`;
    if (r.idPhoto   && r.idPhoto.startsWith('data:'))   zip.file(`${name}_id.jpg`,   base64ToBlob(r.idPhoto),   { binary: true });
    if (r.facePhoto && r.facePhoto.startsWith('data:')) zip.file(`${name}_face.jpg`, base64ToBlob(r.facePhoto), { binary: true });
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `photos_${new Date().toISOString().slice(0,10)}.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
  btn.textContent = '🖼 写真ZIP';
  btn.disabled = false;
}

function base64ToBlob(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary  = atob(base64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sanitize(s) {
  return (s || 'unknown').replace(/[^a-zA-Z0-9\u3040-\u30ff\u4e00-\u9fff]/g, '_').slice(0, 20);
}

// 保存先ラベル
function sourceLabel(r) {
  if (r._synced === false) {
    return '<span style="background:rgba(251,191,36,.2);color:#d97706;border:1px solid #fbbf24;border-radius:4px;padding:2px 8px;font-size:11px;white-space:nowrap;">🖥 未同期</span>';
  }
  if (r.idPhoto && r.idPhoto.startsWith('data:')) {
    return '<span style="background:rgba(79,156,249,.15);color:#4f9cf9;border:1px solid #4f9cf9;border-radius:4px;padding:2px 8px;font-size:11px;white-space:nowrap;">🖥 ローカル</span>';
  }
  return '<span style="background:rgba(62,207,142,.15);color:#3ecf8e;border:1px solid #3ecf8e;border-radius:4px;padding:2px 8px;font-size:11px;white-space:nowrap;">☁ Drive</span>';
}

// 手動同期
async function manualSync() {
  const btn = document.querySelector('[onclick="manualSync()"]');
  const url = getGasUrl();

  if (!url) { alert('GAS URLが設定されていません'); return; }
  if (!navigator.onLine) { alert('オフラインです。ネットワークに接続してください'); return; }

  btn.textContent = '⏳ 同期中...';
  btn.disabled = true;

  const records = loadLocal();
  const pending = records.filter(r => r._synced === false);

  if (!pending.length) {
    btn.textContent = '🔄 今すぐ同期';
    btn.disabled = false;
    alert('未同期のデータはありません');
    return;
  }

  let success = 0;
  let fail    = 0;

  for (const r of pending) {
    try {
      await submitToGas(r);
      r._synced = true;
      success++;
    } catch(e) {
      fail++;
    }
  }

  localStorage.setItem('minpaku_records', JSON.stringify(records.slice(0, 200)));

  btn.textContent = '🔄 今すぐ同期';
  btn.disabled = false;

  const msg = success > 0
    ? `✅ ${success}件を同期しました${fail > 0 ? `（${fail}件失敗）` : ''}`
    : `❌ 同期に失敗しました（${fail}件）`;
  alert(msg);

  closeSettings();
  loadRecords();
}
function clearLocalCache() {
  if (!confirm('ローカルに保存されたデータを全て削除しますか？\n※ Google Sheetsのデータは削除されません')) return;
  localStorage.removeItem('minpaku_records');
  closeSettings();
  loadRecords();
}
function toImgUrl(src) {
  if (!src) return '';
  // Base64はそのまま
  if (src.startsWith('data:')) return src;
  // drive.google.com/uc?id=xxx → thumbnail URL に変換
  const m = src.match(/[?&]id=([^&]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w300`;
  return src;
}

function showSettings() {
  document.getElementById('gasUrl').value = getGasUrl();
  renderEmailList();
  document.getElementById('settingsModal').classList.remove('hidden');
}
function closeSettings() {
  document.getElementById('settingsModal').classList.add('hidden');
}
function saveSettings() {
  const url = document.getElementById('gasUrl').value.trim();
  if (url) localStorage.setItem('minpaku_gas_url', url);
  closeSettings();
  loadRecords();
}

// ─── メール管理 ────────────────────────────────
function getEmails() {
  try { return JSON.parse(localStorage.getItem('notify_emails') || '[]'); } catch { return []; }
}
function saveEmails(emails) {
  localStorage.setItem('notify_emails', JSON.stringify(emails));
}

function renderEmailList() {
  const emails = getEmails();
  const el = document.getElementById('emailList');
  if (!emails.length) {
    el.innerHTML = '<p style="font-size:13px;color:var(--muted);">未設定</p>';
    return;
  }
  el.innerHTML = emails.map((email, i) => `
    <div style="display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:8px 12px;">
      <span style="flex:1;font-size:13px;">✉ ${esc(email)}</span>
      <button onclick="removeEmail(${i})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:0;">✕</button>
    </div>`).join('');
}

function addEmail() {
  const input = document.getElementById('newEmail');
  const email = input.value.trim();
  if (!email || !email.includes('@')) { alert('正しいメールアドレスを入力してください'); return; }
  const emails = getEmails();
  if (emails.includes(email)) { alert('既に追加されています'); return; }
  emails.push(email);
  saveEmails(emails);
  input.value = '';
  renderEmailList();
}

function removeEmail(i) {
  const emails = getEmails();
  emails.splice(i, 1);
  saveEmails(emails);
  renderEmailList();
}

function showPhoto(src) {
  document.getElementById('modalPhoto').src = src;
  document.getElementById('photoModal').classList.remove('hidden');
}
function closePhotoModal() {
  document.getElementById('photoModal').classList.add('hidden');
  document.getElementById('modalPhoto').src = '';
}
document.getElementById('photoModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closePhotoModal();
});

// ─── ユーティリティ ────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ja-JP', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}

// ISO日付 or タイムスタンプ → MM/DD形式
function fmtSimpleDate(val) {
  if (!val) return '—';
  const s = String(val);
  // ISOタイムスタンプの場合
  if (s.includes('T')) {
    const d = new Date(s);
    return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
  }
  // YYYY-MM-DD形式はそのまま見やすく
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) {
    return s.slice(0,10).replace(/-/g, '/');
  }
  return s;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

loadRecords();
