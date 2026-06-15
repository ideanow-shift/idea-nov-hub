const SHEETS = Object.freeze({
  EMPLOYEES: 'Employees',
  APPS: 'Apps',
  ANNOUNCEMENTS: 'Announcements',
  ACCESS_LOG: 'AccessLog'
});

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || '');
  if (action === 'health') {
    return jsonOutput_(getHealthStatus_());
  }
  return jsonOutput_({ ok: true, service: 'NOV HUB API', timestamp: new Date().toISOString() });
}

function doPost(e) {
  let stage = 'request';
  try {
    if (!e || !e.parameter) {
      throwPortalError_('INVALID_REQUEST', 'POST parameters are missing.');
    }
    const action = String(e.parameter.action || '');
    const token = String(e.parameter.token || '');
    const payload = parseJson_(e.parameter.payload, {});

    stage = 'verifyFirebaseToken';
    const authUser = verifyFirebaseToken_(token);

    stage = 'findActiveEmployee';
    const employee = findActiveEmployee_(authUser.email);

    if (!employee) {
      stage = 'appendDeniedLog';
      appendAccessLogSafely_({
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
      stage = 'readApps';
      const apps = readSheetObjects_(SHEETS.APPS)
        .map(normalizeApp_)
        .filter(function(app) { return canAccessApp_(employee, app); });

      stage = 'readAnnouncements';
      const announcements = readSheetObjects_(SHEETS.ANNOUNCEMENTS)
        .map(normalizeAnnouncement_)
        .filter(function(item) { return item.isActive; })
        .sort(function(a, b) { return a.priority - b.priority; });

      stage = 'appendLoginLog';
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
        stage = 'findApp';
        const app = findAppById_(payload.appId);
        if (!app || !canAccessApp_(employee, app)) {
          stage = 'appendDeniedAppLog';
          appendAccessLogSafely_({
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

      stage = 'appendAccessLog';
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
    const code = error.portalCode || 'SERVER_ERROR';
    const detail = String(error.message || error);
    console.error(JSON.stringify({
      code: code,
      stage: stage,
      message: detail,
      stack: error.stack || ''
    }));
    return jsonOutput_({
      ok: false,
      code: code,
      message: getPublicErrorMessage_(code),
      stage: stage,
      detail: sanitizeErrorDetail_(detail)
    });
  }
}

function verifyFirebaseToken_(idToken) {
  if (!idToken) {
    throwPortalError_('TOKEN_MISSING', 'Firebase ID token is required.');
  }
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
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  if (responseCode !== 200) {
    const upstream = parseJson_(responseText, {});
    const reason = upstream.error && upstream.error.message
      ? upstream.error.message
      : 'HTTP ' + responseCode;
    throwPortalError_(
      'TOKEN_VERIFICATION_FAILED',
      'Firebase token verification failed: ' + reason
    );
  }
  const data = parseJson_(responseText, {});
  const user = data.users && data.users[0];
  if (!user || !user.email) {
    throwPortalError_('TOKEN_EMAIL_MISSING', 'Firebase user email was not found.');
  }
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
  if (!sheet) {
    throwPortalError_('ACCESS_LOG_SHEET_MISSING', 'AccessLog sheet is missing.');
  }
  sheet.appendRow([
    new Date(), entry.email || '', entry.name || '', entry.action || '',
    entry.appId || '', entry.appName || '', entry.result || ''
  ]);
}

function appendAccessLogSafely_(entry) {
  try {
    appendAccessLog_(entry);
  } catch (error) {
    console.error(JSON.stringify({
      code: error.portalCode || 'ACCESS_LOG_WRITE_FAILED',
      message: String(error.message || error)
    }));
  }
}

function readSheetObjects_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throwPortalError_('MASTER_SHEET_MISSING', sheetName + ' sheet is missing.');
  }
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
  const spreadsheetId = getRequiredProperty_('SPREADSHEET_ID');
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    throwPortalError_(
      'SPREADSHEET_OPEN_FAILED',
      'Spreadsheet could not be opened: ' + String(error.message || error)
    );
  }
}

function getRequiredProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) {
    throwPortalError_('SCRIPT_PROPERTY_MISSING', name + ' script property is missing.');
  }
  return value;
}

function getHealthStatus_() {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  const firebaseApiKey = properties.getProperty('FIREBASE_API_KEY');
  const result = {
    ok: false,
    service: 'NOV HUB API',
    checks: {
      spreadsheetIdConfigured: Boolean(spreadsheetId),
      firebaseApiKeyConfigured: Boolean(firebaseApiKey),
      firebaseApiKeyValid: false,
      spreadsheetAccessible: false,
      sheets: {}
    },
    timestamp: new Date().toISOString()
  };

  if (spreadsheetId) {
    try {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      result.checks.spreadsheetAccessible = true;
      Object.keys(SHEETS).forEach(function(key) {
        const name = SHEETS[key];
        result.checks.sheets[name] = Boolean(spreadsheet.getSheetByName(name));
      });
    } catch (error) {
      result.checks.spreadsheetError = sanitizeErrorDetail_(String(error.message || error));
    }
  }

  if (firebaseApiKey) {
    try {
      const firebaseResponse = UrlFetchApp.fetch(
        'https://identitytoolkit.googleapis.com/v1/projects?key=' + encodeURIComponent(firebaseApiKey),
        { muteHttpExceptions: true }
      );
      result.checks.firebaseApiKeyValid = firebaseResponse.getResponseCode() === 200;
      if (!result.checks.firebaseApiKeyValid) {
        const firebaseError = parseJson_(firebaseResponse.getContentText(), {});
        result.checks.firebaseApiKeyError = sanitizeErrorDetail_(
          firebaseError.error && firebaseError.error.message
            ? firebaseError.error.message
            : 'HTTP ' + firebaseResponse.getResponseCode()
        );
      }
    } catch (error) {
      result.checks.firebaseApiKeyError = sanitizeErrorDetail_(String(error.message || error));
    }
  }

  result.ok = result.checks.spreadsheetIdConfigured
    && result.checks.firebaseApiKeyConfigured
    && result.checks.firebaseApiKeyValid
    && result.checks.spreadsheetAccessible
    && Object.keys(SHEETS).every(function(key) {
      return result.checks.sheets[SHEETS[key]];
    });
  return result;
}

function throwPortalError_(code, message) {
  const error = new Error(message);
  error.portalCode = code;
  throw error;
}

function getPublicErrorMessage_(code) {
  const messages = {
    TOKEN_MISSING: '認証情報がありません。もう一度ログインしてください。',
    TOKEN_VERIFICATION_FAILED: 'ログイン情報を確認できませんでした。',
    TOKEN_EMAIL_MISSING: 'Googleアカウントのメールアドレスを確認できませんでした。',
    SCRIPT_PROPERTY_MISSING: 'GASの設定が不足しています。',
    SPREADSHEET_OPEN_FAILED: '社員マスタを開けませんでした。',
    MASTER_SHEET_MISSING: '必要なマスタシートがありません。',
    ACCESS_LOG_SHEET_MISSING: 'アクセスログシートがありません。',
    INVALID_REQUEST: 'APIリクエストが正しくありません。'
  };
  return messages[code] || 'サーバー処理に失敗しました。';
}

function sanitizeErrorDetail_(detail) {
  return String(detail || '')
    .replace(/AIza[0-9A-Za-z_-]+/g, '[API_KEY]')
    .replace(/[A-Za-z0-9_-]{30,}/g, '[REDACTED]')
    .slice(0, 240);
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
