const SHEETS = Object.freeze({
  EMPLOYEES: 'Employees',
  APPS: 'Apps',
  ANNOUNCEMENTS: 'Announcements',
  ACCESS_LOG: 'AccessLog'
});

function doGet() {
  return jsonOutput_({ ok: true, service: 'NOV HUB API', timestamp: new Date().toISOString() });
}

function doPost(e) {
  try {
    const action = String(e.parameter.action || '');
    const token = String(e.parameter.token || '');
    const payload = parseJson_(e.parameter.payload, {});
    const authUser = verifyFirebaseToken_(token);
    const employee = findActiveEmployee_(authUser.email);

    if (!employee) {
      appendAccessLog_({
        email: authUser.email,
        name: authUser.displayName || '',
        action: 'denied',
        appId: '',
        appName: '',
        result: 'denied'
      });
      return jsonOutput_({
        ok: false,
        code: 'ACCESS_DENIED',
        message: 'このアカウントは社内ポータルの利用権限がありません。管理者へお問い合わせください。'
      });
    }

    if (action === 'bootstrap') {
      const apps = readSheetObjects_(SHEETS.APPS)
        .map(normalizeApp_)
        .filter(function(app) { return canAccessApp_(employee, app); });
      const announcements = readSheetObjects_(SHEETS.ANNOUNCEMENTS)
        .map(normalizeAnnouncement_)
        .filter(function(item) { return item.isActive; })
        .sort(function(a, b) { return a.priority - b.priority; });

      appendAccessLog_({
        email: employee.email,
        name: employee.name,
        action: 'login',
        appId: '',
        appName: '',
        result: 'success'
      });
      return jsonOutput_({
        ok: true,
        employee: sanitizeEmployee_(employee),
        apps: apps,
        announcements: announcements
      });
    }

    if (action === 'log') {
      const logAction = String(payload.action || '');
      if (['openApp', 'logout'].indexOf(logAction) === -1) throw new Error('Unsupported log action.');

      if (logAction === 'openApp') {
        const app = findAppById_(payload.appId);
        if (!app || !canAccessApp_(employee, app)) {
          appendAccessLog_({
            email: employee.email,
            name: employee.name,
            action: 'openApp',
            appId: String(payload.appId || ''),
            appName: String(payload.appName || ''),
            result: 'denied'
          });
          return jsonOutput_({ ok: false, code: 'ACCESS_DENIED', message: 'このアプリを利用する権限がありません。' });
        }
      }

      appendAccessLog_({
        email: employee.email,
        name: employee.name,
        action: logAction,
        appId: String(payload.appId || ''),
        appName: String(payload.appName || ''),
        result: String(payload.result || 'success')
      });
      return jsonOutput_({ ok: true });
    }

    return jsonOutput_({ ok: false, code: 'UNKNOWN_ACTION', message: '未対応の操作です。' });
  } catch (error) {
    console.error(error);
    return jsonOutput_({ ok: false, code: 'SERVER_ERROR', message: 'サーバー処理に失敗しました。' });
  }
}

function verifyFirebaseToken_(idToken) {
  if (!idToken) throw new Error('Firebase ID token is required.');
  const apiKey = getRequiredProperty_('FIREBASE_API_KEY');
  const response = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true
    }
  );
  if (response.getResponseCode() !== 200) throw new Error('Firebase token verification failed.');
  const data = JSON.parse(response.getContentText());
  const user = data.users && data.users[0];
  if (!user || !user.email) throw new Error('Firebase user email was not found.');
  return {
    email: String(user.email).trim().toLowerCase(),
    displayName: String(user.displayName || '')
  };
}

function findActiveEmployee_(email) {
  const employee = readSheetObjects_(SHEETS.EMPLOYEES)
    .map(normalizeEmployee_)
    .find(function(item) { return item.email === String(email).trim().toLowerCase(); });
  return employee && employee.status === 'active' ? employee : null;
}

function findAppById_(appId) {
  const row = readSheetObjects_(SHEETS.APPS).find(function(item) {
    return String(item.appId || '') === String(appId || '');
  });
  return row ? normalizeApp_(row) : null;
}

function canAccessApp_(employee, app) {
  if (!employee || employee.status !== 'active' || !app.isActive) return false;
  if (Number(employee.roleLevel) < Number(app.requiredLevel || 1)) return false;
  if (app.allowedTags.length && !hasIntersection_(employee.tags, app.allowedTags)) return false;
  if (app.targetDepartment.length && app.targetDepartment.indexOf(employee.department) === -1) return false;
  if (app.targetPosition.length && app.targetPosition.indexOf(employee.position) === -1) return false;
  return true;
}

function normalizeEmployee_(row) {
  return {
    email: String(row.email || '').trim().toLowerCase(),
    name: String(row.name || ''),
    store: String(row.store || ''),
    department: String(row.department || ''),
    position: String(row.position || ''),
    grade: String(row.grade || ''),
    roleLevel: Number(row.roleLevel || 1),
    tags: splitList_(row.tags),
    status: String(row.status || '').trim().toLowerCase()
  };
}

function sanitizeEmployee_(employee) {
  return {
    email: employee.email,
    name: employee.name,
    store: employee.store,
    department: employee.department,
    position: employee.position,
    grade: employee.grade,
    roleLevel: employee.roleLevel,
    tags: employee.tags,
    status: employee.status
  };
}

function normalizeApp_(row) {
  return {
    appId: String(row.appId || ''),
    appName: String(row.appName || ''),
    description: String(row.description || ''),
    url: String(row.url || ''),
    category: String(row.category || ''),
    icon: String(row.icon || '🔗'),
    requiredLevel: Number(row.requiredLevel || 1),
    allowedTags: splitList_(row.allowedTags),
    targetDepartment: splitList_(row.targetDepartment),
    targetPosition: splitList_(row.targetPosition),
    isActive: parseBoolean_(row.isActive),
    isFeatured: parseBoolean_(row.isFeatured),
    priority: Number(row.priority || 999)
  };
}

function normalizeAnnouncement_(row) {
  return {
    type: String(row.type || 'info'),
    title: String(row.title || ''),
    body: String(row.body || ''),
    isActive: parseBoolean_(row.isActive),
    priority: Number(row.priority || 999)
  };
}

function appendAccessLog_(entry) {
  const sheet = getSpreadsheet_().getSheetByName(SHEETS.ACCESS_LOG);
  if (!sheet) throw new Error('AccessLog sheet is missing.');
  sheet.appendRow([
    new Date(), entry.email || '', entry.name || '', entry.action || '',
    entry.appId || '', entry.appName || '', entry.result || ''
  ]);
}

function readSheetObjects_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error(sheetName + ' sheet is missing.');
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function(header) { return String(header).trim(); });
  return values.slice(1)
    .filter(function(row) { return row.some(function(cell) { return cell !== ''; }); })
    .map(function(row) {
      return headers.reduce(function(object, header, index) {
        object[header] = row[index];
        return object;
      }, {});
    });
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(getRequiredProperty_('SPREADSHEET_ID'));
}

function getRequiredProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throw new Error(name + ' script property is missing.');
  return value;
}

function splitList_(value) {
  return String(value || '').split(/[,、\n]/)
    .map(function(item) { return item.trim(); })
    .filter(String);
}

function parseBoolean_(value) {
  return ['true', '1', 'yes', 'on'].indexOf(String(value || '').toLowerCase()) !== -1;
}

function hasIntersection_(left, right) {
  return left.some(function(value) { return right.indexOf(value) !== -1; });
}

function parseJson_(value, fallback) {
  try { return JSON.parse(value || ''); } catch (error) { return fallback; }
}

function jsonOutput_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
