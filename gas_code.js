/**
 * Google Apps Script コード (フォーム送信対応版)
 * CORSを回避するため form POST の payload パラメーターを受け取る
 */

const SHEET_ID   = '12Sdq6OCBu1FYyoHRTaKD0AkGd97NeKmNZa61NqIsxUw';
const SHEET_NAME = 'チェックイン記録';

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'list') {
    return jsonResponse({ records: getRecords() });
  }
  return jsonResponse({ status: 'ok' });
}

function doPost(e) {
  try {
    let body;

    // フォーム送信 (payload パラメーター) と JSON POST 両対応
    if (e.parameter && e.parameter.payload) {
      body = JSON.parse(e.parameter.payload);
    } else if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      return jsonResponse({ status: 'error', message: 'No data' });
    }

    if (body.action === 'checkin') {
      saveRecord(body.data);
      sendNotification(body.data, body.notifyEmails || []);
      return jsonResponse({ status: 'ok' });
    }
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

function saveRecord(data) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let   sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['登録日時','氏名','国籍','生年月日','チェックイン','チェックアウト','部屋','人数','緊急連絡先','身分証URL','顔写真URL']);
    sheet.setFrozenRows(1);
  }
  const idUrl   = savePhoto(data.idPhoto,   'id_'   + Date.now());
  const faceUrl = savePhoto(data.facePhoto, 'face_' + Date.now());
  sheet.appendRow([
    data.timestamp, data.guestName, data.nationality, data.dob,
    data.checkinDate, data.checkoutDate, data.roomNumber,
    data.guestCount, data.emergencyContact, idUrl, faceUrl
  ]);
}

function getRecords() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return [];
  const headers = ['timestamp','guestName','nationality','dob','checkinDate','checkoutDate','roomNumber','guestCount','emergencyContact','idPhoto','facePhoto'];
  return rows.slice(1).reverse().map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] || '']))
  );
}

function savePhoto(dataUrl, name) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return '';
  try {
    const folder = getOrCreateFolder('MinpakuPhotos');
    const parts  = dataUrl.split(',');
    const mime   = parts[0].match(/:(.*?);/)[1];
    const bytes  = Utilities.base64Decode(parts[1]);
    const blob   = Utilities.newBlob(bytes, mime, name + '.jpg');
    const file   = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/uc?id=' + file.getId();
  } catch (e) { return ''; }
}

function getOrCreateFolder(name) {
  const iter = DriveApp.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : DriveApp.createFolder(name);
}

// ─── メール通知 ────────────────────────────────
function sendNotification(data, emails) {
  if (!emails || !emails.length) return;

  const subject = `【チェックイン通知】${data.guestName} 様 / ${data.roomNumber}号室`;
  const body = `チェックイン通知が届きました。

━━━━━━━━━━━━━━━━━━
　宿泊者情報
━━━━━━━━━━━━━━━━━━
氏名　　　: ${data.guestName}
国籍　　　: ${data.nationality}
生年月日　: ${data.dob || '—'}
部屋　　　: ${data.roomNumber}号室
チェックイン: ${data.checkinDate}
チェックアウト: ${data.checkoutDate}
人数　　　: ${data.guestCount}名
緊急連絡先: ${data.emergencyContact || '—'}
登録日時　: ${data.timestamp}
━━━━━━━━━━━━━━━━━━

このメールは自動送信されています。`;

  emails.forEach(email => {
    try {
      MailApp.sendEmail(email, subject, body);
    } catch(e) {
      Logger.log('メール送信エラー: ' + email + ' / ' + e.message);
    }
  });
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
