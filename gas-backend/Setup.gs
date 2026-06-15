function setupMasterSheets() {
  const spreadsheet = getSpreadsheet_();
  createOrResetSheet_(spreadsheet, SHEETS.EMPLOYEES, [
    ['email', 'name', 'store', 'department', 'position', 'grade', 'roleLevel', 'tags', 'status'],
    ['staff@example.com', '佐藤 スタッフ', 'BASSA 新所沢店', 'サロン事業部', 'アシスタント', '1', 1, 'all', 'active'],
    ['manager@example.com', '鈴木 店長', 'BASSA 高田馬場店', 'サロン事業部', '店長', '3', 3, 'all,manager,sales', 'active'],
    ['hq@example.com', '田中 本部', '本部', '経営企画部', '部長', '5', 5, 'all,executive,hq,fc', 'active']
  ]);
  createOrResetSheet_(spreadsheet, SHEETS.APPS, [
    ['appId', 'appName', 'description', 'url', 'category', 'icon', 'requiredLevel', 'allowedTags', 'targetDepartment', 'targetPosition', 'isActive', 'isFeatured', 'priority'],
    ['attendance', '勤怠打刻', '出勤・退勤の打刻と勤務実績の確認', 'https://example.com/', '勤怠・シフト', '⏱️', 1, '', '', '', true, true, 10],
    ['shift', 'シフト管理', '勤務予定・希望休の確認', 'https://example.com/', '勤怠・シフト', '📅', 1, '', '', '', true, true, 20],
    ['sales-dashboard', '売上ダッシュボード', '店舗実績と目標進捗を確認', 'https://example.com/', '売上管理', '📊', 3, 'sales,executive', '', '', true, true, 30],
    ['documents', '社内資料室', '規程・申請書・ブランド資料を検索', 'https://example.com/', '資料室', '📁', 1, '', '', '', true, false, 40]
  ]);
  createOrResetSheet_(spreadsheet, SHEETS.ANNOUNCEMENTS, [
    ['type', 'title', 'body', 'isActive', 'priority'],
    ['important', 'ポータル試験運用中', '掲載アプリや権限に誤りがある場合は管理者へご連絡ください。', true, 10],
    ['info', 'スマートフォンのホーム画面に追加できます', 'ブラウザの共有メニューから追加すると、毎日のアクセスが簡単になります。', true, 20]
  ]);
  createOrResetSheet_(spreadsheet, SHEETS.ACCESS_LOG, [
    ['timestamp', 'email', 'name', 'action', 'appId', 'appName', 'result']
  ]);
}

function createOrResetSheet_(spreadsheet, name, values) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  sheet.clear();
  sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, values[0].length)
    .setFontWeight('bold')
    .setBackground('#E8B4B8')
    .setFontColor('#FFFFFF');
  sheet.autoResizeColumns(1, values[0].length);
}
