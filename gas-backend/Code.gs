const SHEETS = Object.freeze({
  APPS: 'Apps',
  ANNOUNCEMENTS: 'Announcements',
  ACCESS_LOG: 'AccessLog'
});

const DEFAULT_MASTER_CONFIG = Object.freeze({
  STAFF_SPREADSHEET_ID: '1UnBwhX8AjBY_sGXNpiYg--3BB2hgh99eu18oL1uOOts',
  STAFF_SHEET_GID: '160557983',
  STORE_SPREADSHEET_ID: '1Ozyzi3WqYh7HkYYKBObZr8Mvsm941BQh4XL4w_qp-90',
  STORE_SHEET_GID: '0'
});

const ACTIVE_STATUS_VALUES = ['', 'active', 'true', '1', 'yes', 'on', '在籍', '在職', '有効', '利用可', '勤務中', '所属'];
const INACTIVE_STATUS_VALUES = ['inactive', 'false', '0', 'no', 'off', '退職', '休職', '停止', '無効', '利用不可', '削除'];

const STAFF_HEADER_ALIASES = Object.freeze({
  email: ['email', 'emailaddress', 'mail', 'gmail', 'googlemail', 'googleaccount', 'account', 'loginemail', 'loginmail', 'メール', 'メールアドレス', '個人メール', '個人メールアドレス', '個人アドレス', 'gmailアドレス', 'googleメール', 'googleアカウント', 'googleアカウントメール', 'ログインメール', 'ログインアカウント', 'アカウント', 'col19'],
  pin: ['pin', 'password', 'passcode', '暗証番号', 'ログインpin', '認証pin', '認証コード', 'パスコード', 'col18'],
  name: ['name', 'fullname', 'staffname', 'employeename', '氏名', '名前', 'スタッフ名', '社員名', '従業員名'],
  store: ['store', 'storename', 'shop', 'shopname', 'salon', '所属店舗', '店舗', '店舗名', 'サロン', 'サロン名'],
  storeCode: ['storecode', 'shopcode', '店舗コード', '店コード', '店舗id', 'storeid'],
  department: ['department', 'division', 'dept', '所属部署', '部署', '部門'],
  position: ['position', 'title', 'role', '役職', '職位', '職種'],
  grade: ['grade', 'rank', '等級', 'グレード', 'ランク'],
  roleLevel: ['rolelevel', 'role_level', 'level', '権限レベル', '権限level', 'レベル'],
  tags: ['tags', 'tag', '権限タグ', 'タグ'],
  status: ['status', 'state', '在籍状況', 'ステータス', '状態', '利用状態']
});

const STORE_HEADER_ALIASES = Object.freeze({
  store: ['store', 'storename', 'shop', 'shopname', 'salon', '所属店舗', '店舗', '店舗名', 'サロン', 'サロン名'],
  storeCode: ['storecode', 'shopcode', '店舗コード', '店コード', '店舗id', 'storeid'],
  department: ['department', 'division', 'dept', '部署', '部門', '管轄部署'],
  status: ['status', 'state', 'ステータス', '状態', '利用状態']
});

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || '');
  if (action === 'health') return jsonOutput_(getHealthStatus_());
  return jsonOutput_({ ok: true, service: 'NOV HUB API', timestamp: new Date().toISOString() });
}

function doPost(e) {
  let stage = 'request';
  try {
    if (!e || !e.parameter) throwPortalError_('INVALID_REQUEST', 'POST parameters are missing.');

    const action = String(e.parameter.action || '');
    const token = String(e.parameter.token || '');
    const payload = parseJson_(e.parameter.payload, {});

    stage = 'authenticate';
    const authUser = authenticateRequest_(token, payload);

    stage = 'findActiveEmployee';
    const employee = authUser.authType === 'pin'
      ? authUser.employee
      : findActiveEmployee_(authUser.email);

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
      const apps = readPortalSheetObjects_(SHEETS.APPS)
        .map(normalizeApp_)
        .filter(function(app) { return canAccessApp_(employee, app); });

      stage = 'readAnnouncements';
      const announcements = readPortalSheetObjects_(SHEETS.ANNOUNCEMENTS)
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
      if (['openApp', 'logout'].indexOf(logAction) === -1) {
        throwPortalError_('INVALID_REQUEST', 'Unsupported log action.');
      }

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
    console.error(JSON.stringify({ code: code, stage: stage, message: detail, stack: error.stack || '' }));
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
  if (!idToken) throwPortalError_('TOKEN_MISSING', 'Firebase ID token is required.');

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
    const reason = upstream.error && upstream.error.message ? upstream.error.message : 'HTTP ' + responseCode;
    throwPortalError_('TOKEN_VERIFICATION_FAILED', 'Firebase token verification failed: ' + reason);
  }

  const data = parseJson_(responseText, {});
  const user = data.users && data.users[0];
  if (!user || !user.email) throwPortalError_('TOKEN_EMAIL_MISSING', 'Firebase user email was not found.');

  return {
    email: String(user.email).trim().toLowerCase(),
    displayName: String(user.displayName || '')
  };
}

function authenticateRequest_(idToken, payload) {
  const authType = String(payload.authType || 'firebase').trim().toLowerCase();
  if (authType === 'pin') {
    const email = normalizeEmailValue_(payload.email);
    return {
      authType: 'pin',
      email: email,
      displayName: '',
      employee: findActiveEmployeeByPin_(email, payload.pin)
    };
  }

  const firebaseUser = verifyFirebaseToken_(idToken);
  firebaseUser.authType = 'firebase';
  return firebaseUser;
}

function findActiveEmployee_(email) {
  const employee = readStaffRows_()
    .map(normalizeEmployee_)
    .filter(function(item) { return item.email; })
    .find(function(item) { return item.email === String(email).trim().toLowerCase(); });

  if (!employee || employee.status !== 'active') return null;
  return enrichEmployeeWithStore_(employee);
}

function findActiveEmployeeByPin_(email, pin) {
  const normalizedEmail = normalizeEmailValue_(email);
  const normalizedPin = normalizePinValue_(pin);
  if (!normalizedEmail || !normalizedPin) return null;

  const employee = readStaffRows_()
    .map(normalizeEmployee_)
    .filter(function(item) { return item.email; })
    .find(function(item) { return item.email === normalizedEmail; });

  if (!employee || employee.status !== 'active') return null;
  if (normalizePinValue_(employee.pin) !== normalizedPin) return null;
  return enrichEmployeeWithStore_(employee);
}

function findAppById_(appId) {
  const row = readPortalSheetObjects_(SHEETS.APPS).find(function(item) {
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
  const roleLevel = Number(pick_(row, STAFF_HEADER_ALIASES.roleLevel) || 1);
  const email = normalizeEmailValue_(pickLoose_(row, STAFF_HEADER_ALIASES.email)) || findEmailInRow_(row);
  return {
    email: email,
    pin: normalizePinValue_(pick_(row, STAFF_HEADER_ALIASES.pin)),
    name: String(pick_(row, STAFF_HEADER_ALIASES.name) || ''),
    store: String(pick_(row, STAFF_HEADER_ALIASES.store) || ''),
    storeCode: String(pick_(row, STAFF_HEADER_ALIASES.storeCode) || ''),
    department: String(pick_(row, STAFF_HEADER_ALIASES.department) || ''),
    position: String(pick_(row, STAFF_HEADER_ALIASES.position) || ''),
    grade: String(pick_(row, STAFF_HEADER_ALIASES.grade) || ''),
    roleLevel: isNaN(roleLevel) ? 1 : roleLevel,
    tags: splitList_(pick_(row, STAFF_HEADER_ALIASES.tags)),
    status: normalizeStatus_(pick_(row, STAFF_HEADER_ALIASES.status), true)
  };
}

function enrichEmployeeWithStore_(employee) {
  if (!employee.store && !employee.storeCode) return employee;

  const stores = readStoreRows_().map(normalizeStore_);
  const store = stores.find(function(item) {
    return (employee.storeCode && item.storeCode && item.storeCode === employee.storeCode)
      || (employee.store && item.store && item.store === employee.store);
  });

  if (!store) return employee;
  return Object.assign({}, employee, {
    store: employee.store || store.store,
    storeCode: employee.storeCode || store.storeCode,
    department: employee.department || store.department
  });
}

function normalizeStore_(row) {
  return {
    store: String(pick_(row, STORE_HEADER_ALIASES.store) || ''),
    storeCode: String(pick_(row, STORE_HEADER_ALIASES.storeCode) || ''),
    department: String(pick_(row, STORE_HEADER_ALIASES.department) || ''),
    status: normalizeStatus_(pick_(row, STORE_HEADER_ALIASES.status), true)
  };
}

function sanitizeEmployee_(employee) {
  return {
    email: employee.email,
    name: employee.name,
    store: employee.store,
    storeCode: employee.storeCode,
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
  const sheet = getPortalSpreadsheet_().getSheetByName(SHEETS.ACCESS_LOG);
  if (!sheet) throwPortalError_('ACCESS_LOG_SHEET_MISSING', 'AccessLog sheet is missing.');
  sheet.appendRow([
    new Date(), entry.email || '', entry.name || '', entry.action || '',
    entry.appId || '', entry.appName || '', entry.result || ''
  ]);
}

function appendAccessLogSafely_(entry) {
  try {
    appendAccessLog_(entry);
  } catch (error) {
    console.error(JSON.stringify({ code: error.portalCode || 'ACCESS_LOG_WRITE_FAILED', message: String(error.message || error) }));
  }
}

function readPortalSheetObjects_(sheetName) {
  const sheet = getPortalSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throwPortalError_('MASTER_SHEET_MISSING', sheetName + ' sheet is missing.');
  return sheetToObjects_(sheet);
}

function readStaffRows_() {
  const spreadsheet = openSpreadsheetByConfig_('STAFF_SPREADSHEET_ID', DEFAULT_MASTER_CONFIG.STAFF_SPREADSHEET_ID, 'STAFF_SPREADSHEET_OPEN_FAILED');
  const sheet = getConfiguredSheet_(spreadsheet, 'STAFF_SHEET_NAME', 'STAFF_SHEET_GID', DEFAULT_MASTER_CONFIG.STAFF_SHEET_GID);
  return sheetToObjects_(sheet);
}

function readStoreRows_() {
  const spreadsheet = openSpreadsheetByConfig_('STORE_SPREADSHEET_ID', DEFAULT_MASTER_CONFIG.STORE_SPREADSHEET_ID, 'STORE_SPREADSHEET_OPEN_FAILED');
  const sheet = getConfiguredSheet_(spreadsheet, 'STORE_SHEET_NAME', 'STORE_SHEET_GID', DEFAULT_MASTER_CONFIG.STORE_SHEET_GID);
  return sheetToObjects_(sheet).filter(function(row) {
    return normalizeStore_(row).status === 'active';
  });
}

function sheetToObjects_(sheet) {
  if (!sheet) throwPortalError_('MASTER_SHEET_MISSING', 'Configured sheet was not found.');
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function(header) { return normalizeHeaderKey_(header); });
  return values.slice(1)
    .filter(function(row) { return row.some(function(cell) { return String(cell).trim() !== ''; }); })
    .map(function(row) {
      return headers.reduce(function(object, header, index) {
        object['col' + (index + 1)] = row[index];
        if (header) object[header] = row[index];
        return object;
      }, {});
    });
}

function getPortalSpreadsheet_() {
  const spreadsheetId = getRequiredProperty_('SPREADSHEET_ID');
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    throwPortalError_('SPREADSHEET_OPEN_FAILED', 'Portal spreadsheet could not be opened: ' + String(error.message || error));
  }
}

function openSpreadsheetByConfig_(propertyName, defaultValue, errorCode) {
  const spreadsheetId = getOptionalProperty_(propertyName, defaultValue);
  try {
    return SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    throwPortalError_(errorCode, propertyName + ' could not be opened: ' + String(error.message || error));
  }
}

function getConfiguredSheet_(spreadsheet, nameProperty, gidProperty, defaultGid) {
  const sheetName = getOptionalProperty_(nameProperty, '');
  if (sheetName) {
    const byName = spreadsheet.getSheetByName(sheetName);
    if (!byName) throwPortalError_('MASTER_SHEET_MISSING', sheetName + ' sheet is missing.');
    return byName;
  }

  const gid = String(getOptionalProperty_(gidProperty, defaultGid || '')).trim();
  if (gid) {
    const byGid = spreadsheet.getSheets().find(function(sheet) {
      return String(sheet.getSheetId()) === gid;
    });
    if (!byGid) throwPortalError_('MASTER_SHEET_MISSING', gidProperty + '=' + gid + ' sheet is missing.');
    return byGid;
  }

  return spreadsheet.getSheets()[0];
}

function getRequiredProperty_(name) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  if (!value) throwPortalError_('SCRIPT_PROPERTY_MISSING', name + ' script property is missing.');
  return value;
}

function getOptionalProperty_(name, fallback) {
  const value = PropertiesService.getScriptProperties().getProperty(name);
  return value ? String(value).trim() : fallback;
}

function getHealthStatus_() {
  const properties = PropertiesService.getScriptProperties();
  const firebaseApiKey = properties.getProperty('FIREBASE_API_KEY');
  const result = {
    ok: false,
    service: 'NOV HUB API',
    checks: {
      portalSpreadsheetIdConfigured: Boolean(properties.getProperty('SPREADSHEET_ID')),
      staffSpreadsheetId: getOptionalProperty_('STAFF_SPREADSHEET_ID', DEFAULT_MASTER_CONFIG.STAFF_SPREADSHEET_ID),
      staffSheetGid: getOptionalProperty_('STAFF_SHEET_GID', DEFAULT_MASTER_CONFIG.STAFF_SHEET_GID),
      storeSpreadsheetId: getOptionalProperty_('STORE_SPREADSHEET_ID', DEFAULT_MASTER_CONFIG.STORE_SPREADSHEET_ID),
      storeSheetGid: getOptionalProperty_('STORE_SHEET_GID', DEFAULT_MASTER_CONFIG.STORE_SHEET_GID),
      firebaseApiKeyConfigured: Boolean(firebaseApiKey),
      firebaseApiKeyValid: false,
      portalSpreadsheetAccessible: false,
      staffSpreadsheetAccessible: false,
      storeSpreadsheetAccessible: false,
      sheets: {}
    },
    timestamp: new Date().toISOString()
  };

  try {
    const portalSpreadsheet = getPortalSpreadsheet_();
    result.checks.portalSpreadsheetAccessible = true;
    Object.keys(SHEETS).forEach(function(key) {
      const name = SHEETS[key];
      result.checks.sheets[name] = Boolean(portalSpreadsheet.getSheetByName(name));
    });
  } catch (error) {
    result.checks.portalSpreadsheetError = sanitizeErrorDetail_(String(error.message || error));
  }

  try {
    const staffSpreadsheet = openSpreadsheetByConfig_('STAFF_SPREADSHEET_ID', DEFAULT_MASTER_CONFIG.STAFF_SPREADSHEET_ID, 'STAFF_SPREADSHEET_OPEN_FAILED');
    result.checks.staffSpreadsheetAccessible = true;
    const staffSheet = getConfiguredSheet_(staffSpreadsheet, 'STAFF_SHEET_NAME', 'STAFF_SHEET_GID', DEFAULT_MASTER_CONFIG.STAFF_SHEET_GID);
    const staffRows = sheetToObjects_(staffSheet);
    const normalizedStaff = staffRows.map(normalizeEmployee_);
    result.checks.staffSheetName = staffSheet.getName();
    result.checks.staffRows = Math.max(staffSheet.getLastRow() - 1, 0);
    result.checks.staffEmailRows = normalizedStaff.filter(function(item) { return item.email; }).length;
    result.checks.staffPinRows = normalizedStaff.filter(function(item) { return item.pin; }).length;
    result.checks.staffActiveRows = normalizedStaff.filter(function(item) { return item.email && item.status === 'active'; }).length;
  } catch (error) {
    result.checks.staffSpreadsheetError = sanitizeErrorDetail_(String(error.message || error));
  }

  try {
    const storeSpreadsheet = openSpreadsheetByConfig_('STORE_SPREADSHEET_ID', DEFAULT_MASTER_CONFIG.STORE_SPREADSHEET_ID, 'STORE_SPREADSHEET_OPEN_FAILED');
    result.checks.storeSpreadsheetAccessible = true;
    const storeSheet = getConfiguredSheet_(storeSpreadsheet, 'STORE_SHEET_NAME', 'STORE_SHEET_GID', DEFAULT_MASTER_CONFIG.STORE_SHEET_GID);
    result.checks.storeSheetName = storeSheet.getName();
    result.checks.storeRows = Math.max(storeSheet.getLastRow() - 1, 0);
  } catch (error) {
    result.checks.storeSpreadsheetError = sanitizeErrorDetail_(String(error.message || error));
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

  result.ok = result.checks.portalSpreadsheetIdConfigured
    && result.checks.firebaseApiKeyConfigured
    && result.checks.firebaseApiKeyValid
    && result.checks.portalSpreadsheetAccessible
    && result.checks.staffSpreadsheetAccessible
    && result.checks.storeSpreadsheetAccessible
    && Object.keys(SHEETS).every(function(key) { return result.checks.sheets[SHEETS[key]]; });
  return result;
}

function pick_(row, aliases) {
  for (let i = 0; i < aliases.length; i++) {
    const key = normalizeHeaderKey_(aliases[i]);
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  return '';
}

function pickLoose_(row, aliases) {
  const exact = pick_(row, aliases);
  if (exact) return exact;

  const keys = Object.keys(row);
  const normalizedAliases = aliases.map(normalizeHeaderKey_).filter(function(alias) {
    return alias.length >= 3;
  });

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    for (let j = 0; j < normalizedAliases.length; j++) {
      const alias = normalizedAliases[j];
      if (key.indexOf(alias) !== -1 || alias.indexOf(key) !== -1) return row[key];
    }
  }

  return '';
}

function findEmailInRow_(row) {
  const values = Object.keys(row).map(function(key) { return row[key]; });
  for (let i = 0; i < values.length; i++) {
    const email = normalizeEmailValue_(values[i]);
    if (email) return email;
  }
  return '';
}

function normalizeEmailValue_(value) {
  const text = String(value || '').trim().toLowerCase();
  const match = text.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+/);
  return match ? match[0] : '';
}

function normalizePinValue_(value) {
  return String(value || '').trim();
}

function normalizeHeaderKey_(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[（）()［］\[\]・\/\\_-]/g, '')
    .toLowerCase();
}

function normalizeStatus_(value, defaultActive) {
  const normalized = normalizeHeaderKey_(value);
  if (!normalized && defaultActive) return 'active';
  if (INACTIVE_STATUS_VALUES.map(normalizeHeaderKey_).indexOf(normalized) !== -1) return 'inactive';
  if (ACTIVE_STATUS_VALUES.map(normalizeHeaderKey_).indexOf(normalized) !== -1) return 'active';
  return defaultActive ? 'active' : 'inactive';
}

function splitList_(value) {
  return String(value || '')
    .split(/[,、\n]/)
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
  try {
    return JSON.parse(value || '');
  } catch (error) {
    return fallback;
  }
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
    SPREADSHEET_OPEN_FAILED: 'ポータル管理スプレッドシートを開けませんでした。',
    STAFF_SPREADSHEET_OPEN_FAILED: 'スタッフマスタを開けませんでした。',
    STORE_SPREADSHEET_OPEN_FAILED: '店舗マスタを開けませんでした。',
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

function jsonOutput_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
