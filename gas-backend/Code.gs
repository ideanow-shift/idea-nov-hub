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

const APP_HEADER_ALIASES = Object.freeze({
  appId: ['appid', 'app_id', 'id', 'アプリid', 'アプリID', 'アプリコード', '管理id'],
  appName: ['appname', 'app_name', 'name', 'title', 'アプリ名', '名称', 'タイトル'],
  description: ['description', 'desc', 'summary', '説明', '説明文', '概要'],
  url: ['url', 'link', 'href', 'リンク', '遷移先url', '遷移先URL', 'アプリurl', 'アプリURL'],
  category: ['category', 'カテゴリ', 'カテゴリー', '分類'],
  icon: ['icon', 'emoji', 'アイコン', '絵文字'],
  requiredLevel: ['requiredlevel', 'required_level', 'level', '必要権限レベル', '権限レベル', '最低権限', '表示権限'],
  allowedTags: ['allowedtags', 'allowed_tags', 'tags', 'tag', '許可タグ', '権限タグ', 'タグ'],
  targetDepartment: ['targetdepartment', 'target_department', 'department', '対象部署', '部署'],
  targetPosition: ['targetposition', 'target_position', 'position', '対象役職', '役職'],
  isActive: ['isactive', 'active', 'enabled', 'visible', '表示', '公開', '有効', '表示可否'],
  isFeatured: ['isfeatured', 'featured', 'favorite', 'よく使う', 'おすすめ', '優先表示'],
  priority: ['priority', 'sort', 'order', '表示順', '並び順', '優先度']
});

const ANNOUNCEMENT_HEADER_ALIASES = Object.freeze({
  type: ['type', '種別', 'タイプ'],
  title: ['title', 'タイトル', '件名'],
  body: ['body', '本文', '内容', 'お知らせ内容'],
  isActive: ['isactive', 'active', 'enabled', 'visible', '表示', '公開', '有効', '表示可否'],
  priority: ['priority', 'sort', 'order', '表示順', '並び順', '優先度']
});

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || '');
  if (action === 'health') return jsonOutput_(getHealthStatus_());
  if (action === 'masterHealth') return jsonOutput_(getMasterHealthStatus_());
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
    const employee = findActivePortalEmployee_(authUser);

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
      const apps = readVisibleAppsSafely_(employee);

      stage = 'readAnnouncements';
      const announcements = readAnnouncementsSafely_();

      stage = 'appendLoginLog';
      appendAccessLogSafely_({
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

    if (action === 'masterBootstrap') {
      stage = 'authorizeMasterAdmin';
      assertMasterViewer_(employee);
      stage = 'readMasterAdminData';
      return jsonOutput_({ ok: true, data: getMasterAdminBootstrap_(employee) });
    }

    if (action === 'masterListEmployees') {
      stage = 'authorizeMasterAdmin';
      assertMasterViewer_(employee);
      stage = 'readEmployees';
      return jsonOutput_({ ok: true, employees: listCoreEmployees_() });
    }

    if (action === 'masterListStores') {
      stage = 'authorizeMasterAdmin';
      assertMasterViewer_(employee);
      stage = 'readStores';
      return jsonOutput_({ ok: true, stores: listCoreStores_() });
    }

    if (action === 'masterListChangeLogs') {
      stage = 'authorizeMasterAdmin';
      assertMasterViewer_(employee);
      stage = 'readChangeLogs';
      return jsonOutput_({ ok: true, logs: listMasterChangeLogs_() });
    }

    if (action === 'masterCreateEmployee') {
      stage = 'authorizeMasterAdmin';
      assertMasterEditor_(employee);
      stage = 'createEmployee';
      return jsonOutput_({ ok: true, employee: createCoreEmployee_(payload, employee) });
    }
    if (action === 'masterUpdateEmployee') {
      stage = 'authorizeMasterAdmin';
      assertMasterEditor_(employee);
      stage = 'updateEmployee';
      return jsonOutput_({ ok: true, employee: updateCoreEmployee_(payload, employee) });
    }

    if (action === 'masterLinkFirebaseUid') {
      stage = 'authorizeMasterAdmin';
      assertMasterEditor_(employee);
      stage = 'linkFirebaseUid';
      return jsonOutput_({ ok: true, employee: linkFirebaseUid_(payload, employee) });
    }

    if (action === 'masterUpdateStore') {
      stage = 'authorizeMasterAdmin';
      assertMasterEditor_(employee);
      stage = 'updateStore';
      return jsonOutput_({ ok: true, store: updateCoreStore_(payload, employee) });
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

function readVisibleAppsSafely_(employee) {
  let apps = [];
  try {
    apps = readPortalSheetObjects_(SHEETS.APPS)
      .map(normalizeApp_)
      .filter(function(app) { return canAccessApp_(employee, app); });
  } catch (error) {
    console.error('Failed to read portal apps. Continuing with fallback apps.', error);
  }

  try {
    apps = appendFixedPortalApps_(apps, employee);
  } catch (error) {
    console.error('Failed to add fixed portal apps.', error);
  }

  return apps;
}

function appendFixedAppIfMissing_(apps, app) {
  if (!app || !app.appId) return apps;
  const exists = apps.some(function(item) {
    return String(item.appId || '') === String(app.appId || '');
  });
  if (!exists) apps.push(app);
  return apps;
}

function appendFixedPortalApps_(apps, employee) {
  getFixedPortalApps_(employee).forEach(function(app) {
    apps = appendFixedAppIfMissing_(apps, app);
  });
  return apps;
}

function getFixedPortalApps_(employee) {
  const fixedApps = [
    createIdeaLinkApp_(),
    createHumanCapitalInvestmentApp_()
  ];
  if (isMasterAdmin_(employee)) fixedApps.push(createMasterAdminApp_());
  return fixedApps.filter(function(app) {
    return canAccessApp_(employee, app);
  });
}

function getAllFixedPortalApps_() {
  return [
    createMasterAdminApp_(),
    createIdeaLinkApp_(),
    createHumanCapitalInvestmentApp_()
  ];
}

function readAnnouncementsSafely_() {
  try {
    return readPortalSheetObjects_(SHEETS.ANNOUNCEMENTS)
      .map(normalizeAnnouncement_)
      .filter(function(item) { return item.isActive; })
      .sort(function(a, b) { return a.priority - b.priority; });
  } catch (error) {
    console.error('Failed to read portal announcements. Continuing without announcements.', error);
    return [];
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
    displayName: String(user.displayName || ''),
    uid: String(user.localId || '')
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

function findActivePortalEmployee_(authUser) {
  if (authUser.authType === 'pin') return authUser.employee;

  try {
    const coreEmployee = findActiveCoreEmployee_(authUser);
    if (coreEmployee) return coreEmployee;
  } catch (error) {
    console.error('Core employee lookup failed. Falling back to legacy staff sheet.', error);
  }

  return findActiveEmployee_(authUser.email);
}

function findActiveCoreEmployee_(authUser) {
  const uid = String(authUser && authUser.uid || '').trim();
  const email = normalizeEmailValue_(authUser && authUser.email);
  let rows = [];

  if (uid) {
    rows = queryCoreEmployeeRows_({ firebase_uid: 'eq.' + uid });
  }
  if (!rows.length && email) {
    rows = queryCoreEmployeeRows_({ email: 'eq.' + email });
  }

  const employee = rows[0];
  if (!isCoreEmployeeActiveForPortal_(employee)) return null;
  return normalizeCorePortalEmployee_(employee);
}

function queryCoreEmployeeRows_(filters) {
  const query = Object.assign({
    select: 'id,employee_id,full_name,email,employment_status,employment_type,corporation_id,store_id,department_id,position_id,firebase_uid,is_active,source_row',
    limit: '1'
  }, filters || {});
  return supabaseRequest_('employees', { query: query });
}

function isCoreEmployeeActiveForPortal_(employee) {
  if (!employee || employee.is_active === false) return false;
  const status = String(employee.employment_status || '');
  if (/退職|休職|産休|育休/.test(status)) return false;
  return true;
}

function normalizeCorePortalEmployee_(employee) {
  const source = employee.source_row || {};
  const corporation = safeCoreLookup_('corporation', employee.corporation_id, getCoreCorporationById_);
  const store = safeCoreLookup_('store', employee.store_id, getCoreStoreById_);
  const department = safeCoreLookup_('department', employee.department_id, getCoreDepartmentById_);
  const position = safeCoreLookup_('position', employee.position_id, getCorePositionById_);
  const roles = safeCoreRoles_(employee);
  const roleKeys = roles.map(function(role) { return role.roleKey; }).filter(String);
  const storeAssignments = safeCoreStoreAssignments_(employee);
  const primaryStore = buildPrimaryStoreContext_(store, storeAssignments);
  const tags = buildCorePortalTags_(employee, {
    corporation: corporation,
    store: store,
    department: department,
    position: position,
    roleKeys: roleKeys
  });

  return {
    id: employee.id,
    coreEmployeeId: employee.id,
    employeeId: employee.employee_id || '',
    employeeNumber: employee.employee_id || '',
    firebaseUid: employee.firebase_uid || '',
    email: normalizeEmailValue_(employee.email),
    name: String(employee.full_name || employee.email || ''),
    fullName: String(employee.full_name || employee.email || ''),
    store: primaryStore && primaryStore.name ? primaryStore.name : String(source.assigned_location || ''),
    storeCode: primaryStore && primaryStore.storeId ? primaryStore.storeId : '',
    department: department && department.department_name ? department.department_name : String(source.department_name || ''),
    position: position && position.position_name ? position.position_name : String(source.position_name || ''),
    grade: '',
    roleLevel: getCoreRoleLevel_(roleKeys),
    roleKeys: roleKeys,
    roles: roles,
    tags: tags,
    status: 'active',
    source: 'supabase',
    corporation: corporation && corporation.corporation_name ? corporation.corporation_name : '',
    employmentStatus: employee.employment_status || '',
    employmentType: employee.employment_type || '',
    isActive: employee.is_active !== false,
    corporationRef: corporation ? {
      id: corporation.id || '',
      code: corporation.corporation_no || '',
      name: corporation.corporation_name || ''
    } : null,
    departmentRef: department ? {
      id: department.id || '',
      code: department.department_code || '',
      name: department.department_name || ''
    } : null,
    positionRef: position ? {
      id: position.id || '',
      name: position.position_name || ''
    } : null,
    primaryStore: primaryStore,
    storeAssignments: storeAssignments
  };
}

function safeCoreLookup_(label, id, loader) {
  if (!id) return null;
  try {
    return loader(id);
  } catch (error) {
    console.error('Core ' + label + ' lookup failed', error);
    return null;
  }
}

function safeCoreRoleKeys_(employee) {
  try {
    return getCoreRoleKeysForEmployee_(employee);
  } catch (error) {
    console.error('Core role lookup failed', error);
    return [];
  }
}

function safeCoreRoles_(employee) {
  try {
    return getCoreRolesForEmployee_(employee);
  } catch (error) {
    console.error('Core roles lookup failed', error);
    return safeCoreRoleKeys_(employee).map(function(roleKey) {
      return { roleKey: roleKey, roleName: '', scopeType: '', scopeId: null };
    });
  }
}

function safeCoreStoreAssignments_(employee) {
  try {
    return getCoreStoreAssignmentsForEmployee_(employee && employee.id);
  } catch (error) {
    console.error('Core store assignment lookup failed', error);
    return [];
  }
}

function buildPrimaryStoreContext_(store, assignments) {
  const primaryAssignment = (assignments || []).filter(function(item) { return item.assignmentType === 'primary' || Number(item.priority || 0) === 1; })[0];
  if (primaryAssignment) {
    return {
      id: primaryAssignment.storeId || '',
      storeNo: primaryAssignment.storeNo || '',
      storeId: primaryAssignment.storeCode || '',
      name: primaryAssignment.storeName || ''
    };
  }
  if (!store) return null;
  return {
    id: store.id || '',
    storeNo: store.store_no || '',
    storeId: store.store_id || '',
    name: store.store_name || ''
  };
}

function buildCorePortalTags_(employee, context) {
  const tags = ['all'].concat(context.roleKeys || []);
  const departmentName = context.department && context.department.department_name ? context.department.department_name : '';
  const positionName = context.position && context.position.position_name ? context.position.position_name : '';
  const storeName = context.store && context.store.store_name ? context.store.store_name : '';
  const roleKeys = context.roleKeys || [];

  if (/営業/.test(departmentName)) tags.push('sales');
  if (/教育/.test(departmentName)) tags.push('education');
  if (/総務|人事/.test(departmentName)) tags.push('hr', 'backoffice');
  if (/経理/.test(departmentName)) tags.push('accounting');
  if (/本部/.test(storeName) || departmentName) tags.push('hq');
  if (roleKeys.indexOf('executive') !== -1 || roleKeys.indexOf('super_admin') !== -1) tags.push('executive');
  if (roleKeys.indexOf('backoffice') !== -1) tags.push('hq', 'hr', 'backoffice');
  if (roleKeys.indexOf('accounting') !== -1) tags.push('hq', 'accounting');
  if (roleKeys.indexOf('trainer') !== -1) tags.push('education');
  if (roleKeys.indexOf('store_manager') !== -1 || roleKeys.indexOf('area_manager') !== -1 || roleKeys.indexOf('department_manager') !== -1 || /店長|部長|マネージャー/.test(positionName)) tags.push('manager');
  if (roleKeys.indexOf('fc_owner') !== -1 || /FC/.test(positionName)) tags.push('fc_owner');

  return tags.filter(function(tag, index) { return tag && tags.indexOf(tag) === index; });
}

function getCoreRoleLevel_(roleKeys) {
  const roles = roleKeys || [];
  if (roles.indexOf('super_admin') !== -1 || roles.indexOf('executive') !== -1) return 5;
  if (roles.indexOf('department_manager') !== -1 || roles.indexOf('backoffice') !== -1 || roles.indexOf('accounting') !== -1) return 4;
  if (roles.indexOf('area_manager') !== -1 || roles.indexOf('store_manager') !== -1 || roles.indexOf('fc_owner') !== -1 || roles.indexOf('trainer') !== -1) return 3;
  return 1;
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
  const fixedApp = findFixedAppById_(appId);
  if (fixedApp) return fixedApp;

  const row = readPortalSheetObjects_(SHEETS.APPS).find(function(item) {
    return String(pick_(item, APP_HEADER_ALIASES.appId) || '') === String(appId || '');
  });
  return row ? normalizeApp_(row) : null;
}

function findFixedAppById_(appId) {
  const id = String(appId || '');
  return getAllFixedPortalApps_().find(function(app) {
    return String(app.appId || '') === id;
  }) || null;
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
    id: employee.id || '',
    coreEmployeeId: employee.coreEmployeeId || '',
    employeeId: employee.employeeId || '',
    employeeNumber: employee.employeeNumber || employee.employeeId || '',
    firebaseUid: employee.firebaseUid || '',
    email: employee.email,
    name: employee.name,
    fullName: employee.fullName || employee.name,
    store: employee.store,
    storeCode: employee.storeCode,
    department: employee.department,
    position: employee.position,
    grade: employee.grade,
    roleLevel: employee.roleLevel,
    roleKeys: employee.roleKeys || [],
    roles: employee.roles || [],
    tags: employee.tags,
    status: employee.status,
    source: employee.source || 'legacy',
    corporation: employee.corporation || '',
    employmentStatus: employee.employmentStatus || '',
    employmentType: employee.employmentType || '',
    isActive: employee.isActive !== false,
    corporationRef: employee.corporationRef || null,
    departmentRef: employee.departmentRef || null,
    positionRef: employee.positionRef || null,
    primaryStore: employee.primaryStore || null,
    storeAssignments: employee.storeAssignments || []
  };
}

function normalizeApp_(row) {
  return {
    appId: String(pick_(row, APP_HEADER_ALIASES.appId) || ''),
    appName: String(pick_(row, APP_HEADER_ALIASES.appName) || ''),
    description: String(pick_(row, APP_HEADER_ALIASES.description) || ''),
    url: String(pick_(row, APP_HEADER_ALIASES.url) || ''),
    category: String(pick_(row, APP_HEADER_ALIASES.category) || '社内アプリ'),
    icon: String(pick_(row, APP_HEADER_ALIASES.icon) || 'default'),
    requiredLevel: Number(pick_(row, APP_HEADER_ALIASES.requiredLevel) || 1),
    allowedTags: splitList_(pick_(row, APP_HEADER_ALIASES.allowedTags)),
    targetDepartment: splitList_(pick_(row, APP_HEADER_ALIASES.targetDepartment)),
    targetPosition: splitList_(pick_(row, APP_HEADER_ALIASES.targetPosition)),
    isActive: parseBoolean_(pick_(row, APP_HEADER_ALIASES.isActive)),
    isFeatured: parseBoolean_(pick_(row, APP_HEADER_ALIASES.isFeatured)),
    priority: Number(pick_(row, APP_HEADER_ALIASES.priority) || 999)
  };
}

function normalizeAnnouncement_(row) {
  return {
    type: String(pick_(row, ANNOUNCEMENT_HEADER_ALIASES.type) || 'info'),
    title: String(pick_(row, ANNOUNCEMENT_HEADER_ALIASES.title) || ''),
    body: String(pick_(row, ANNOUNCEMENT_HEADER_ALIASES.body) || ''),
    isActive: parseBoolean_(pick_(row, ANNOUNCEMENT_HEADER_ALIASES.isActive)),
    priority: Number(pick_(row, ANNOUNCEMENT_HEADER_ALIASES.priority) || 999)
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
      supabaseUrlConfigured: Boolean(properties.getProperty('SUPABASE_URL')),
      supabaseServiceRoleKeyConfigured: Boolean(properties.getProperty('SUPABASE_SERVICE_ROLE_KEY')),
      supabaseReachable: false,
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
    if (result.checks.sheets[SHEETS.APPS]) {
      const apps = readPortalSheetObjects_(SHEETS.APPS).map(normalizeApp_);
      result.checks.appRows = apps.length;
      result.checks.appIdRows = apps.filter(function(app) { return app.appId; }).length;
      result.checks.appActiveRows = apps.filter(function(app) { return app.appId && app.isActive; }).length;
    }
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

  try {
    if (result.checks.supabaseUrlConfigured && result.checks.supabaseServiceRoleKeyConfigured) {
      const rows = supabaseRequest_('employees', {
        query: {
          select: 'id',
          limit: '1'
        }
      });
      result.checks.supabaseReachable = Array.isArray(rows);
    }
  } catch (error) {
    result.checks.supabaseError = sanitizeErrorDetail_(String(error.message || error));
  }

  result.ok = result.checks.portalSpreadsheetIdConfigured
    && result.checks.firebaseApiKeyConfigured
    && result.checks.firebaseApiKeyValid
    && result.checks.supabaseUrlConfigured
    && result.checks.supabaseServiceRoleKeyConfigured
    && result.checks.supabaseReachable
    && result.checks.portalSpreadsheetAccessible
    && result.checks.staffSpreadsheetAccessible
    && result.checks.storeSpreadsheetAccessible
    && Object.keys(SHEETS).every(function(key) { return result.checks.sheets[SHEETS[key]]; });
  return result;
}

function createMasterAdminApp_() {
  return {
    appId: 'core-master-admin',
    appName: '社員・店舗マスタ管理',
    description: '社員情報・店舗情報の基幹マスタを管理',
    url: './master-admin/',
    category: '管理',
    icon: 'database',
    requiredLevel: 4,
    allowedTags: [],
    targetDepartment: [],
    targetPosition: [],
    isActive: true,
    isFeatured: true,
    priority: 1
  };
}
function createIdeaLinkApp_() {
  return {
    appId: 'idea-link',
    appName: 'IDEA LINK',
    description: 'サンクス投稿と理念行動共有のHUB連携準備ページ',
    url: './idea-link/',
    category: '称賛',
    icon: 'idea-link',
    requiredLevel: 1,
    allowedTags: [],
    targetDepartment: [],
    targetPosition: [],
    isActive: true,
    isFeatured: false,
    priority: 88
  };
}

function createHumanCapitalInvestmentApp_() {
  return {
    appId: 'human-capital-investment',
    appName: '人財投資管理システム',
    description: '採用活動・学校接点・人財投資状況を確認',
    url: 'https://ideanow-shift.github.io/hr-investment-dashboard/',
    category: '人財',
    icon: 'human-capital-investment',
    requiredLevel: 4,
    allowedTags: ['executive', 'backoffice'],
    targetDepartment: [],
    targetPosition: [],
    isActive: true,
    isFeatured: false,
    priority: 64
  };
}

function getCoreRoleKeysForEmployee_(employee) {
  return getCoreRolesForEmployee_(employee).map(function(role) { return role.roleKey; }).filter(String);
}

function getCoreRolesForEmployee_(employee) {
  const directId = String(employee && (employee.id || employee.coreEmployeeId) || '').trim();
  if (directId) return getCoreRolesByEmployeeId_(directId);

  const email = normalizeEmailValue_(employee && employee.email);
  if (!email) return [];
  const employees = supabaseRequest_('employees', {
    query: {
      select: 'id,email,is_active',
      email: 'eq.' + email,
      limit: '1'
    }
  });
  const coreEmployee = employees[0];
  if (!coreEmployee || coreEmployee.is_active === false) return [];
  return getCoreRolesByEmployeeId_(coreEmployee.id);
}

function getCoreRolesByEmployeeId_(employeeId) {
  const rows = supabaseRequest_('employee_roles', {
    query: {
      select: 'role_id',
      employee_id: 'eq.' + employeeId,
      is_active: 'eq.true',
      limit: '50'
    }
  });
  const roleIds = rows.map(function(row) { return row.role_id; }).filter(String);
  if (!roleIds.length) return [];
  const rolesById = indexById_(supabaseRequest_('roles', {
    query: {
      select: 'id,role_key,role_name',
      id: 'in.(' + roleIds.join(',') + ')'
    }
  }));
  return rows.map(function(row) {
    const role = rolesById[row.role_id] || {};
    return {
      roleKey: role.role_key || '',
      roleName: role.role_name || '',
      scopeType: '',
      scopeId: null
    };
  }).filter(function(role) { return role.roleKey; });
}

function getCoreRoleKeysByEmployeeId_(employeeId) {
  return getCoreRolesByEmployeeId_(employeeId).map(function(role) { return role.roleKey; }).filter(String);
}

function getCoreStoreAssignmentsForEmployee_(employeeId) {
  employeeId = String(employeeId || '').trim();
  if (!employeeId) return [];
  const assignments = supabaseRequest_('employee_store_assignments', {
    query: {
      select: 'store_id,assignment_order,assignment_type,is_active',
      employee_id: 'eq.' + employeeId,
      is_active: 'eq.true',
      order: 'assignment_order.asc',
      limit: '10'
    }
  });
  const storeIds = assignments.map(function(row) { return row.store_id; }).filter(String);
  if (!storeIds.length) return [];
  const storesById = indexById_(supabaseRequest_('stores', {
    query: {
      select: 'id,store_no,store_id,store_name',
      id: 'in.(' + storeIds.join(',') + ')'
    }
  }));
  return assignments.map(function(row) {
    const store = storesById[row.store_id] || {};
    return {
      storeId: row.store_id || '',
      storeNo: store.store_no || '',
      storeCode: store.store_id || '',
      storeName: store.store_name || '',
      assignmentType: row.assignment_type || '',
      priority: Number(row.assignment_order || 0)
    };
  });
}

function isMasterAdmin_(employee) {
  return getMasterPermissions_(employee).canView;
}

function getMasterPermissions_(employee) {
  let coreRoleKeys = [];
  try {
    coreRoleKeys = getCoreRoleKeysForEmployee_(employee);
  } catch (error) {
    console.error('Failed to load core role keys', error);
  }
  const legacyTags = employee && employee.tags ? employee.tags : [];
  const roleKeys = coreRoleKeys.concat(legacyTags);
  const canView = roleKeys.some(function(role) {
    return ['super_admin', 'executive', 'department_manager', 'backoffice', 'accounting'].indexOf(role) !== -1;
  }) || isLegacyMasterAdmin_(employee);
  const canEdit = roleKeys.some(function(role) {
    return ['super_admin', 'backoffice'].indexOf(role) !== -1;
  }) || isLegacyMasterAdmin_(employee);
  return {
    canView: canView,
    canEdit: canEdit,
    roleKeys: roleKeys.filter(function(role, index) { return roleKeys.indexOf(role) === index; })
  };
}

function isLegacyMasterAdmin_(employee) {
  if (!employee || employee.status !== 'active') return false;
  const email = normalizeEmailValue_(employee.email);
  const adminEmails = String(getOptionalProperty_('MASTER_ADMIN_EMAILS', 'm.wakita@idea-nov.com'))
    .split(/[,、\n]/)
    .map(normalizeEmailValue_)
    .filter(String);
  if (adminEmails.indexOf(email) !== -1) return true;
  if (Number(employee.roleLevel || 0) >= 5) return true;
  const tags = employee.tags || [];
  return ['super_admin', 'executive', 'backoffice', 'hr', 'department_manager'].some(function(tag) {
    return tags.indexOf(tag) !== -1;
  });
}

function assertMasterViewer_(employee) {
  if (!getMasterPermissions_(employee).canView) {
    throwPortalError_('MASTER_ADMIN_DENIED', 'Master admin permission is required.');
  }
}

function assertMasterEditor_(employee) {
  if (!getMasterPermissions_(employee).canEdit) {
    throwPortalError_('MASTER_ADMIN_DENIED', 'Master admin edit permission is required.');
  }
}

function getMasterAdminBootstrap_(employee) {
  const corporations = listCoreMaster_('corporations', 'id,corporation_no,corporation_name,is_active', 'corporation_no.asc');
  const businessUnits = listCoreMaster_('business_units', 'id,business_unit_no,business_unit_code,business_unit_name,is_active', 'business_unit_no.asc');
  const departments = listCoreMaster_('departments', 'id,department_no,department_code,department_name,is_active', 'department_no.asc');
  const stores = listCoreStores_();
  const positions = listCoreMaster_('positions', 'id,position_no,position_name,is_active', 'position_no.asc');
  const permissions = getMasterPermissions_(employee);
  return {
    permissions: permissions,
    corporations: corporations,
    businessUnits: businessUnits,
    departments: departments,
    stores: stores,
    positions: positions,
    employees: listCoreEmployees_()
  };
}

function getMasterHealthStatus_() {
  const checks = {};
  [
    ['corporations', function() { return listCoreMaster_('corporations', 'id,corporation_no,corporation_name,is_active', 'corporation_no.asc'); }],
    ['business_units', function() { return listCoreMaster_('business_units', 'id,business_unit_no,business_unit_code,business_unit_name,is_active', 'business_unit_no.asc'); }],
    ['departments', function() { return listCoreMaster_('departments', 'id,department_no,department_code,department_name,is_active', 'department_no.asc'); }],
    ['stores', function() { return listCoreStores_(); }],
    ['positions', function() { return listCoreMaster_('positions', 'id,position_no,position_name,is_active', 'position_no.asc'); }],
    ['employees', function() { return listCoreEmployees_(); }],
    ['employee_assignment_histories', function() { return listAssignmentHistories_(); }],
    ['employee_store_assignments', function() { return listEmployeeStoreAssignments_(); }]
  ].forEach(function(item) {
    const key = item[0];
    try {
      const rows = item[1]();
      checks[key] = { ok: true, count: rows.length };
    } catch (error) {
      checks[key] = { ok: false, error: sanitizeErrorDetail_(String(error.message || error)) };
    }
  });
  return {
    ok: Object.keys(checks).every(function(key) { return checks[key].ok; }),
    checks: checks,
    timestamp: new Date().toISOString()
  };
}

function listCoreMaster_(tableName, select, order) {
  return supabaseRequest_(tableName, {
    query: {
      select: select,
      order: order
    }
  });
}

function listCoreEmployees_() {
  const employees = supabaseRequest_('employees', {
    query: {
      select: 'id,employee_id,full_name,email,birth_date,joined_on,retired_on,leave_start_date,leave_end_date,leave_type,employment_status,employment_type,corporation_id,store_id,department_id,position_id,firebase_uid,is_active,updated_at,source_row',
      order: 'employee_id.asc',
      limit: '1000'
    }
  });
  const corporations = indexById_(listCoreMaster_('corporations', 'id,corporation_no,corporation_name', 'corporation_no.asc'));
  const stores = indexById_(listCoreMaster_('stores', 'id,store_id,store_name', 'store_no.asc'));
  const departments = indexById_(listCoreMaster_('departments', 'id,department_code,department_name', 'department_no.asc'));
  const positions = indexById_(listCoreMaster_('positions', 'id,position_name', 'position_no.asc'));
  const storeAssignmentsByEmployee = groupStoreAssignmentsByEmployee_(listEmployeeStoreAssignments_(), stores);
  const rolesByEmployee = groupRolesByEmployee_();
  return employees.map(function(employee) {
    const source = employee.source_row || {};
    const corporation = corporations[employee.corporation_id] || {};
    const store = stores[employee.store_id] || {};
    const department = departments[employee.department_id] || {};
    const position = positions[employee.position_id] || {};
    return Object.assign({}, employee, {
      corporation_name: corporation.corporation_name || '',
      corporation_code: corporation.corporation_no || '',
      store_name: store.store_name || '',
      store_code: store.store_id || '',
      department_name: department.department_name || '',
      department_code: department.department_code || '',
      position_name: position.position_name || '',
      store_assignments: storeAssignmentsByEmployee[employee.id] || [],
      role_keys: rolesByEmployee[employee.id] ? rolesByEmployee[employee.id].role_keys : [],
      role_names: rolesByEmployee[employee.id] ? rolesByEmployee[employee.id].role_names : [],
      source_company_name: String(source.company_name || ''),
      source_assigned_location: String(source.assigned_location || ''),
      source_position_name: String(source.position_name || '')
    });
  });
}

function listCoreStores_() {
  const stores = supabaseRequest_('stores', {
    query: {
      select: 'id,store_no,store_id,store_name,corporation_id,business_unit_id,area,store_type,is_active,updated_at',
      order: 'store_no.asc',
      limit: '500'
    }
  });
  const corporations = indexById_(listCoreMaster_('corporations', 'id,corporation_no,corporation_name', 'corporation_no.asc'));
  const businessUnits = indexById_(listCoreMaster_('business_units', 'id,business_unit_code,business_unit_name', 'business_unit_no.asc'));
  return stores.map(function(store) {
    const corporation = corporations[store.corporation_id] || {};
    const businessUnit = businessUnits[store.business_unit_id] || {};
    return Object.assign({}, store, {
      corporation_name: corporation.corporation_name || '',
      corporation_code: corporation.corporation_no || '',
      business_unit_name: businessUnit.business_unit_name || '',
      business_unit_code: businessUnit.business_unit_code || ''
    });
  });
}

function listMasterChangeLogs_() {
  return supabaseRequest_('master_change_logs', {
    query: {
      select: 'id,table_name,record_id,changed_by_email,change_payload,action_type,target_name,change_summary,created_at',
      order: 'created_at.desc',
      limit: '100'
    }
  });
}

function listAssignmentHistories_() {
  return supabaseRequest_('employee_assignment_histories', {
    query: {
      select: 'id,employee_id,change_type,effective_from,source',
      order: 'created_at.desc',
      limit: '5'
    }
  });
}

function listEmployeeStoreAssignments_() {
  return supabaseRequest_('employee_store_assignments', {
    query: {
      select: 'id,employee_id,store_id,assignment_order,assignment_type,effective_from,effective_to,is_active',
      order: 'assignment_order.asc',
      limit: '1000'
    }
  });
}

function listEmployeeRoles_() {
  return supabaseRequest_('employee_roles', {
    query: {
      select: 'employee_id,role_id,is_active',
      is_active: 'eq.true',
      limit: '2000'
    }
  });
}

function groupRolesByEmployee_() {
  const rolesById = indexById_(listCoreMaster_('roles', 'id,role_key,role_name', 'role_no.asc'));
  return listEmployeeRoles_().reduce(function(grouped, employeeRole) {
    const employeeId = employeeRole.employee_id || '';
    const role = rolesById[employeeRole.role_id] || {};
    if (!employeeId || !role.role_key) return grouped;
    if (!grouped[employeeId]) grouped[employeeId] = { role_keys: [], role_names: [] };
    if (grouped[employeeId].role_keys.indexOf(role.role_key) === -1) grouped[employeeId].role_keys.push(role.role_key);
    if (role.role_name && grouped[employeeId].role_names.indexOf(role.role_name) === -1) grouped[employeeId].role_names.push(role.role_name);
    return grouped;
  }, {});
}

function groupStoreAssignmentsByEmployee_(assignments, storesById) {
  return assignments.reduce(function(grouped, assignment) {
    const store = storesById[assignment.store_id] || {};
    const employeeId = assignment.employee_id || '';
    if (!employeeId || !assignment.is_active) return grouped;
    if (!grouped[employeeId]) grouped[employeeId] = [];
    grouped[employeeId].push(Object.assign({}, assignment, {
      store_name: store.store_name || '',
      store_code: store.store_id || ''
    }));
    return grouped;
  }, {});
}

function getCoreEmployeeById_(id) {
  const rows = supabaseRequest_('employees', {
    query: {
      select: 'id,employee_id,full_name,email,birth_date,joined_on,retired_on,leave_start_date,leave_end_date,leave_type,employment_status,employment_type,corporation_id,store_id,department_id,position_id,is_active',
      id: 'eq.' + id,
      limit: '1'
    }
  });
  return rows[0] || null;
}

function getChangedFields_(before, updates) {
  const changed = {};
  Object.keys(updates).forEach(function(key) {
    if (key === 'updated_at') return;
    if (isFieldChanged_(before && before[key], updates[key])) changed[key] = updates[key];
  });
  if (Object.keys(changed).length) changed.updated_at = updates.updated_at;
  return changed;
}

function isFieldChanged_(beforeValue, afterValue) {
  if (beforeValue === null || beforeValue === undefined) beforeValue = '';
  if (afterValue === null || afterValue === undefined) afterValue = '';
  return String(beforeValue) !== String(afterValue);
}

function appendAssignmentHistoryIfNeeded_(before, after, updates, actor) {
  if (!before || !after) return;
  const trackedFields = ['corporation_id', 'store_id', 'department_id', 'position_id', 'employment_status', 'is_active'];
  const changed = trackedFields.some(function(field) {
    return Object.prototype.hasOwnProperty.call(updates, field)
      && String(before[field] || '') !== String(after[field] || '');
  });
  if (!changed) return;

  const store = after.store_id ? getCoreStoreById_(after.store_id) : null;
  const history = {
    employee_id: after.id,
    corporation_id: after.corporation_id || null,
    business_unit_id: store && store.business_unit_id ? store.business_unit_id : null,
    department_id: after.department_id || null,
    store_id: after.store_id || null,
    position_id: after.position_id || null,
    employment_status: after.employment_status || '',
    effective_from: new Date().toISOString().slice(0, 10),
    change_type: inferAssignmentChangeType_(before, after, updates),
    change_reason: 'マスタ管理画面から更新',
    source: actor && actor.email ? 'master_admin:' + actor.email : 'master_admin'
  };
  supabaseRequest_('employee_assignment_histories', {
    method: 'post',
    payload: history
  });
}

function getCoreStoreById_(id) {
  const rows = supabaseRequest_('stores', {
    query: {
      select: 'id,store_no,store_id,store_name,area,store_type,corporation_id,business_unit_id,is_active',
      id: 'eq.' + id,
      limit: '1'
    }
  });
  return rows[0] || null;
}

function getCoreCorporationById_(id) {
  const rows = supabaseRequest_('corporations', {
    query: {
      select: 'id,corporation_no,corporation_name,is_active',
      id: 'eq.' + id,
      limit: '1'
    }
  });
  return rows[0] || null;
}

function getCoreDepartmentById_(id) {
  const rows = supabaseRequest_('departments', {
    query: {
      select: 'id,department_code,department_name,is_active',
      id: 'eq.' + id,
      limit: '1'
    }
  });
  return rows[0] || null;
}

function getCorePositionById_(id) {
  const rows = supabaseRequest_('positions', {
    query: {
      select: 'id,position_name,is_active',
      id: 'eq.' + id,
      limit: '1'
    }
  });
  return rows[0] || null;
}

function inferAssignmentChangeType_(before, after, updates) {
  const beforeStatus = String(before.employment_status || '');
  const afterStatus = String(after.employment_status || '');
  if (Object.prototype.hasOwnProperty.call(updates, 'is_active') && after.is_active === false) return 'retire';
  if (/退職/.test(afterStatus)) return 'retire';
  if (/(休職|産休|育休)/.test(afterStatus)) return 'leave';
  if (/(休職|産休|育休)/.test(beforeStatus) && !/(休職|産休|育休)/.test(afterStatus)) return 'return';
  if (before.store_id !== after.store_id || before.department_id !== after.department_id || before.corporation_id !== after.corporation_id) return 'transfer';
  if (before.position_id !== after.position_id) return 'promotion';
  return 'correction';
}

function createCoreEmployee_(payload, actor) {
  const employeeId = String(payload.employee_id || '').trim();
  const fullName = String(payload.full_name || '').trim();
  if (!employeeId) {
    throwPortalError_('INVALID_REQUEST', '社員番号を入力してください。');
  }
  if (!fullName) {
    throwPortalError_('INVALID_REQUEST', '氏名を入力してください。');
  }

  const duplicateRows = supabaseRequest_('employees', {
    query: { select: 'id,employee_id,full_name', employee_id: 'eq.' + employeeId, limit: '1' }
  });
  if (duplicateRows && duplicateRows.length) {
    throwPortalError_('DUPLICATE_EMPLOYEE_ID', '同じ社員番号がすでに存在します。');
  }

  const now = new Date().toISOString();
  const row = {
    employee_id: employeeId,
    full_name: fullName,
    is_legacy: /^LEGACY-/i.test(employeeId),
    is_active: Object.prototype.hasOwnProperty.call(payload, 'is_active') ? Boolean(payload.is_active) : true,
    created_at: now,
    updated_at: now
  };

  copyStringField_(row, payload, 'email');
  copyStringField_(row, payload, 'leave_type');
  copyStringField_(row, payload, 'employment_status');
  copyStringField_(row, payload, 'employment_type');
  if (!row.employment_status) row.employment_status = '現職';
  if (!row.employment_type) row.employment_type = '正社員';

  copyDateField_(row, payload, 'birth_date');
  copyDateField_(row, payload, 'joined_on');
  copyDateField_(row, payload, 'retired_on');
  copyDateField_(row, payload, 'leave_start_date');
  copyDateField_(row, payload, 'leave_end_date');

  copyNullableUuidField_(row, payload, 'corporation_id');
  copyNullableUuidField_(row, payload, 'store_id');
  copyNullableUuidField_(row, payload, 'department_id');
  copyNullableUuidField_(row, payload, 'position_id');

  const createdRows = supabaseRequest_('employees', {
    method: 'post',
    query: { select: '*' },
    payload: row,
    prefer: 'return=representation'
  });
  const created = createdRows && createdRows[0] ? createdRows[0] : row;

  appendMasterChangeLogSafely_('employees', created.id, row, actor, {
    actionType: 'create',
    targetName: created.full_name || fullName
  });
  appendAssignmentHistoryForCreatedEmployee_(created, actor);
  updateEmployeeStoreAssignmentsIfPresent_(created.id, payload, actor);

  return created;
}

function appendAssignmentHistoryForCreatedEmployee_(employee, actor) {
  if (!employee || !employee.id) return;
  const store = employee.store_id ? getCoreStoreById_(employee.store_id) : null;
  const history = {
    employee_id: employee.id,
    corporation_id: employee.corporation_id || null,
    business_unit_id: store && store.business_unit_id ? store.business_unit_id : null,
    department_id: employee.department_id || null,
    store_id: employee.store_id || null,
    position_id: employee.position_id || null,
    employment_status: employee.employment_status || '現職',
    effective_from: employee.joined_on || Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd'),
    change_type: 'join',
    change_reason: 'マスタ管理画面から新規追加',
    source: 'master_admin:' + (actor && actor.email ? actor.email : 'unknown')
  };
  try {
    supabaseRequest_('employee_assignment_histories', {
      method: 'post',
      payload: history,
      prefer: 'return=minimal'
    });
  } catch (error) {
    console.error('Failed to append assignment history for created employee', error);
  }
}
function updateCoreEmployee_(payload, actor) {
  const id = String(payload.id || '').trim();
  if (!id) throwPortalError_('INVALID_REQUEST', 'Employee id is required.');
  const before = getCoreEmployeeById_(id);
  const updates = {};
  copyStringField_(updates, payload, 'email');
  copyDateField_(updates, payload, 'birth_date');
  copyDateField_(updates, payload, 'joined_on');
  copyDateField_(updates, payload, 'retired_on');
  copyDateField_(updates, payload, 'leave_start_date');
  copyDateField_(updates, payload, 'leave_end_date');
  copyStringField_(updates, payload, 'leave_type');
  copyStringField_(updates, payload, 'employment_status');
  copyStringField_(updates, payload, 'employment_type');
  copyNullableUuidField_(updates, payload, 'corporation_id');
  copyNullableUuidField_(updates, payload, 'store_id');
  copyNullableUuidField_(updates, payload, 'department_id');
  copyNullableUuidField_(updates, payload, 'position_id');
  if (Object.prototype.hasOwnProperty.call(payload, 'is_active')) updates.is_active = Boolean(payload.is_active);
  updates.updated_at = new Date().toISOString();
  const changedUpdates = getChangedFields_(before, updates);
  let after = before;
  if (Object.keys(changedUpdates).length) {
    const result = supabaseRequest_('employees', {
      method: 'patch',
      query: { id: 'eq.' + id, select: '*' },
      payload: changedUpdates,
      prefer: 'return=representation'
    });
    after = result[0] || before;
    appendMasterChangeLogSafely_('employees', id, changedUpdates, actor, {
      actionType: 'update',
      targetName: after && after.full_name ? after.full_name : before.full_name
    });
    appendAssignmentHistoryIfNeeded_(before, after, changedUpdates, actor);
  }
  updateEmployeeStoreAssignmentsIfPresent_(id, payload, actor);
  return after;
}

function updateEmployeeStoreAssignmentsIfPresent_(employeeId, payload, actor) {
  const hasAssignmentPayload = ['store_id', 'store_assignment_2', 'store_assignment_3'].some(function(field) {
    return Object.prototype.hasOwnProperty.call(payload, field);
  });
  if (!hasAssignmentPayload) return;

  const desiredAssignments = buildEmployeeStoreAssignments_(employeeId, payload);
  const storeIds = desiredAssignments.map(function(assignment) { return assignment.store_id; });
  const uniqueStoreIds = storeIds.filter(function(storeId, index) {
    return storeIds.indexOf(storeId) === index;
  });
  if (storeIds.length !== uniqueStoreIds.length) {
    throwPortalError_('INVALID_REQUEST', 'Store assignments must be unique.');
  }

  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const now = new Date().toISOString();
  const existing = supabaseRequest_('employee_store_assignments', {
    query: {
      select: 'id,store_id,assignment_order,assignment_type',
      employee_id: 'eq.' + employeeId,
      is_active: 'eq.true',
      effective_to: 'is.null',
      order: 'assignment_order.asc',
      limit: '20'
    }
  });
  if (areStoreAssignmentsSame_(existing, desiredAssignments)) return;
  if (existing.length) {
    supabaseRequest_('employee_store_assignments', {
      method: 'patch',
      query: {
        employee_id: 'eq.' + employeeId,
        is_active: 'eq.true',
        effective_to: 'is.null'
      },
      payload: {
        is_active: false,
        effective_to: today,
        updated_at: now
      },
      prefer: 'return=minimal'
    });
  }
  if (desiredAssignments.length) {
    supabaseRequest_('employee_store_assignments', {
      method: 'post',
      payload: desiredAssignments.map(function(assignment) {
        return Object.assign({}, assignment, {
          effective_from: today,
          source: 'master_admin',
          updated_at: now,
          is_active: true
        });
      }),
      prefer: 'return=minimal'
    });
  }
  const employee = getCoreEmployeeById_(employeeId);
  appendMasterChangeLogSafely_('employee_store_assignments', employeeId, {
    before: existing,
    after: desiredAssignments
  }, actor, {
    actionType: 'update_store_assignments',
    targetName: employee && employee.full_name ? employee.full_name : ''
  });
}

function areStoreAssignmentsSame_(existing, desired) {
  const current = existing.slice().sort(compareAssignmentOrder_);
  const next = desired.slice().sort(compareAssignmentOrder_);
  if (current.length !== next.length) return false;
  return current.every(function(row, index) {
    const expected = next[index];
    return String(row.store_id || '') === String(expected.store_id || '')
      && Number(row.assignment_order || 0) === Number(expected.assignment_order || 0)
      && String(row.assignment_type || '') === String(expected.assignment_type || '');
  });
}

function compareAssignmentOrder_(a, b) {
  return Number(a.assignment_order || 0) - Number(b.assignment_order || 0);
}

function buildEmployeeStoreAssignments_(employeeId, payload) {
  return [
    { order: 1, field: 'store_id', type: 'primary' },
    { order: 2, field: 'store_assignment_2', type: 'secondary' },
    { order: 3, field: 'store_assignment_3', type: 'third' }
  ].map(function(item) {
    const storeId = String(payload[item.field] || '').trim();
    if (!storeId) return null;
    return {
      employee_id: employeeId,
      store_id: storeId,
      assignment_order: item.order,
      assignment_type: item.type
    };
  }).filter(Boolean);
}

function linkFirebaseUid_(payload, actor) {
  const id = String(payload.id || '').trim();
  const firebaseUid = String(payload.firebase_uid || '').trim();
  if (!id) throwPortalError_('INVALID_REQUEST', 'Employee id is required.');
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(firebaseUid)) {
    throwPortalError_('INVALID_REQUEST', 'Firebase UID format is invalid.');
  }

  const duplicates = supabaseRequest_('employees', {
    query: {
      select: 'id,employee_id,full_name,email',
      firebase_uid: 'eq.' + firebaseUid,
      limit: '2'
    }
  }).filter(function(employee) {
    return employee.id !== id;
  });
  if (duplicates.length) {
    throwPortalError_('FIREBASE_UID_DUPLICATED', 'Firebase UID is already linked to ' + (duplicates[0].full_name || duplicates[0].employee_id || 'another employee') + '.');
  }

  const before = supabaseRequest_('employees', {
    query: {
      select: 'id,full_name,firebase_uid',
      id: 'eq.' + id,
      limit: '1'
    }
  })[0] || null;
  if (before && before.firebase_uid === firebaseUid) return before;

  const updates = {
    firebase_uid: firebaseUid,
    updated_at: new Date().toISOString()
  };
  const result = supabaseRequest_('employees', {
    method: 'patch',
    query: { id: 'eq.' + id, select: '*' },
    payload: updates,
    prefer: 'return=representation'
  });
  const after = result[0] || null;
  appendMasterChangeLogSafely_('employees', id, updates, actor, {
    actionType: 'link_firebase_uid',
    targetName: after && after.full_name ? after.full_name : before && before.full_name ? before.full_name : ''
  });
  return after;
}

function updateCoreStore_(payload, actor) {
  const id = String(payload.id || '').trim();
  if (!id) throwPortalError_('INVALID_REQUEST', 'Store id is required.');
  const before = getCoreStoreById_(id);
  const updates = {};
  copyStringField_(updates, payload, 'store_name');
  copyStringField_(updates, payload, 'area');
  copyStringField_(updates, payload, 'store_type');
  copyNullableUuidField_(updates, payload, 'corporation_id');
  copyNullableUuidField_(updates, payload, 'business_unit_id');
  if (Object.prototype.hasOwnProperty.call(payload, 'is_active')) updates.is_active = Boolean(payload.is_active);
  updates.updated_at = new Date().toISOString();
  const changedUpdates = getChangedFields_(before, updates);
  if (!Object.keys(changedUpdates).length) return before;
  const result = supabaseRequest_('stores', {
    method: 'patch',
    query: { id: 'eq.' + id, select: '*' },
    payload: changedUpdates,
    prefer: 'return=representation'
  });
  const after = result[0] || before;
  appendMasterChangeLogSafely_('stores', id, changedUpdates, actor, {
    actionType: 'update',
    targetName: after && after.store_name ? after.store_name : before.store_name
  });
  return after;
}

function copyStringField_(target, source, fieldName) {
  if (Object.prototype.hasOwnProperty.call(source, fieldName)) {
    target[fieldName] = String(source[fieldName] || '').trim();
  }
}

function copyNullableUuidField_(target, source, fieldName) {
  if (Object.prototype.hasOwnProperty.call(source, fieldName)) {
    const value = String(source[fieldName] || '').trim();
    target[fieldName] = value || null;
  }
}

function copyDateField_(target, source, fieldName) {
  if (Object.prototype.hasOwnProperty.call(source, fieldName)) {
    const value = String(source[fieldName] || '').trim();
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throwPortalError_('INVALID_REQUEST', fieldName + ' must be YYYY-MM-DD.');
    }
    target[fieldName] = value || null;
  }
}

function indexById_(rows) {
  return rows.reduce(function(index, row) {
    index[row.id] = row;
    return index;
  }, {});
}

function appendMasterChangeLogSafely_(tableName, recordId, changes, actor, meta) {
  try {
    const safeMeta = meta || {};
    supabaseRequest_('master_change_logs', {
      method: 'post',
      payload: {
        table_name: tableName,
        record_id: recordId,
        changed_by_email: actor.email || '',
        change_payload: changes,
        action_type: safeMeta.actionType || 'update',
        target_name: safeMeta.targetName || '',
        change_summary: buildMasterChangeSummary_(changes)
      }
    });
  } catch (error) {
    console.error(JSON.stringify({ code: 'MASTER_CHANGE_LOG_FAILED', message: String(error.message || error) }));
  }
}

function buildMasterChangeSummary_(changes) {
  if (!changes) return '';
  if (Array.isArray(changes.before) || Array.isArray(changes.after)) {
    const beforeCount = Array.isArray(changes.before) ? changes.before.length : 0;
    const afterCount = Array.isArray(changes.after) ? changes.after.length : 0;
    return '店舗所属を変更（変更前 ' + beforeCount + '件 / 変更後 ' + afterCount + '件）';
  }
  const labels = Object.keys(changes)
    .filter(function(key) { return key !== 'updated_at'; })
    .map(function(key) { return getMasterChangeFieldLabel_(key); });
  return labels.length ? labels.join('、') + 'を変更' : '変更内容なし';
}

function getMasterChangeFieldLabel_(key) {
  return {
    email: 'メール',
    birth_date: '誕生日',
    joined_on: '入社日',
    retired_on: '退職日',
    leave_type: '休職区分',
    leave_start_date: '休職開始日',
    leave_end_date: '休職終了日・復職日',
    employment_status: '現職/休職/退職',
    employment_type: '雇用形態',
    corporation_id: '法人',
    store_id: '主店舗',
    department_id: '部署',
    position_id: '役職',
    business_unit_id: '事業部門',
    store_name: '店舗名',
    area: 'エリア',
    store_type: '店舗種別',
    firebase_uid: 'Firebase UID',
    is_active: '有効状態'
  }[key] || key;
}

function supabaseRequest_(resource, options) {
  const config = getSupabaseConfig_();
  const query = buildQueryString_(options && options.query ? options.query : {});
  const url = config.url + '/rest/v1/' + resource + (query ? '?' + query : '');
  const method = String((options && options.method) || 'get').toLowerCase();
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: 'Bearer ' + config.serviceRoleKey,
    Accept: 'application/json'
  };
  if (options && options.prefer) headers.Prefer = options.prefer;
  const request = {
    method: method,
    headers: headers,
    muteHttpExceptions: true
  };
  if (Object.prototype.hasOwnProperty.call(options || {}, 'payload')) {
    request.contentType = 'application/json';
    request.payload = JSON.stringify(options.payload);
  }
  const response = UrlFetchApp.fetch(url, request);
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code < 200 || code >= 300) {
    throwPortalError_('SUPABASE_REQUEST_FAILED', resource + ' HTTP ' + code + ': ' + text.slice(0, 240));
  }
  if (!text) return [];
  return parseJson_(text, []);
}

function getSupabaseConfig_() {
  const url = String(getRequiredProperty_('SUPABASE_URL')).replace(/\/+$/, '');
  const serviceRoleKey = getRequiredProperty_('SUPABASE_SERVICE_ROLE_KEY');
  return { url: url, serviceRoleKey: serviceRoleKey };
}

function buildQueryString_(query) {
  return Object.keys(query)
    .filter(function(key) { return query[key] !== undefined && query[key] !== null && String(query[key]) !== ''; })
    .map(function(key) { return encodeURIComponent(key) + '=' + encodeURIComponent(String(query[key])); })
    .join('&');
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
  return ['true', '1', 'yes', 'on', '表示', '公開', '有効', 'はい', '○', '〇'].indexOf(String(value || '').trim().toLowerCase()) !== -1;
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
    INVALID_REQUEST: 'APIリクエストが正しくありません。',
    MASTER_ADMIN_DENIED: 'マスタ管理を利用する権限がありません。',
    SUPABASE_REQUEST_FAILED: 'Supabaseとの通信に失敗しました。',
    FIREBASE_UID_DUPLICATED: 'このFirebase UIDはすでに別の社員に紐付いています。'
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
