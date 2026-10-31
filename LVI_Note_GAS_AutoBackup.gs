/**
 * ============================================================================
 * 🛡️ LVI_Note 模組 5：Google Drive 雲端自動快照備份腳本 (Google Apps Script)
 * ============================================================================
 * 功能說明：
 * 1. 每日定時自動尋找 Google Drive 上的 LVI Note 主資料夾與主設定檔
 *    (`cloudnotes_workspace_config.json`) 及所有 `.md` 筆記檔案清單，
 *    完整複製並打包快照至指定的 `Backup` 子資料夾，命名為 `notes_backup_YYYYMMDD.json`。
 * 2. 自動巡檢 `Backup` 資料夾，刪除建立時間超過 30 天的舊備份檔以節省雲端空間。
 * 3. 內建一鍵註冊每日定時觸發器函式 `setupDailyBackupTrigger()`。
 *
 * 設定步驟說明：
 * 步驟 1：前往 https://script.google.com/ 點擊「新專案」。
 * 步驟 2：將本檔案內容完整貼入 `Code.gs` 並按 Ctrl+S 儲存。
 * 步驟 3：在上方函式下拉選單選擇 `setupDailyBackupTrigger`，點擊「執行 (Run)」，
 *         並依畫面提示完成 Google 帳號授權（僅需執行一次，即會自動建立每日凌晨 02:00 排程）。
 *         或者您也可以手動點擊左側「觸發條件 (Triggers) ⏰」->「＋ 新增觸發條件」：
 *         - 選擇要執行的函式：`runDailyLviNoteBackup`
 *         - 選取活動來源：`時間驅動 (Time-driven)`
 *         - 選取時間型觸發條件類型：`日計時器 (Day timer)` -> `午夜至凌晨 1 點` (或任意時段)
 * ============================================================================
 */

const LVI_CONFIG = {
  // LVI Note 在 Google Drive 中的主資料夾名稱（若您有自訂資料夾 ID，亦可直接填入 ROOT_FOLDER_ID）
  ROOT_FOLDER_NAME: 'LVI_Note_Workspace',
  FALLBACK_FOLDER_NAMES: ['LVI_Note', 'CloudNotes_Workspace', 'LVI_Note_雲端工作筆記'],
  ROOT_FOLDER_ID: '', // 選填：若留空，腳本會自動依上方名稱搜尋主資料夾
  MAIN_CONFIG_FILENAME: 'cloudnotes_workspace_config.json',
  BACKUP_SUBFOLDER_NAME: 'Backup',
  RETENTION_DAYS: 30, // 自動保留最近 30 天的備份，超過 30 天自動刪除
  TIMEZONE: 'Asia/Taipei'
};

/**
 * 每日排程主函式：複製主 JSON 資料檔並建立完整筆記快照 `notes_backup_YYYYMMDD.json`，再清理超過 30 天的舊備份
 */
function runDailyLviNoteBackup() {
  const rootFolder = getOrLocateLviRootFolder_();
  if (!rootFolder) {
    Logger.log('⚠️ 找不到 LVI Note 主資料夾，請確認資料夾名稱或設定 ROOT_FOLDER_ID。');
    return;
  }

  const backupFolder = getOrCreateSubfolder_(rootFolder, LVI_CONFIG.BACKUP_SUBFOLDER_NAME);
  const todayStr = Utilities.formatDate(new Date(), LVI_CONFIG.TIMEZONE, 'yyyyMMdd');
  const backupFileName = 'notes_backup_' + todayStr + '.json';

  // 1. 尋找主資料檔 cloudnotes_workspace_config.json
  const configFiles = rootFolder.getFilesByName(LVI_CONFIG.MAIN_CONFIG_FILENAME);
  let workspaceConfigObj = {};
  let mainConfigFile = null;

  if (configFiles.hasNext()) {
    mainConfigFile = configFiles.next();
    try {
      const rawJson = mainConfigFile.getBlob().getDataAsString('UTF-8');
      workspaceConfigObj = JSON.parse(rawJson);
    } catch (e) {
      Logger.log('解析主設定檔警告: ' + e);
    }
  }

  // 2. 收集主資料夾與各機型分類子資料夾內的 .md 筆記內容，連同主設定檔一起封裝為完整單一 JSON 快照
  const notesSnapshot = collectAllMarkdownNotesSnapshot_(rootFolder);
  const fullBackupPayload = JSON.stringify({
    backupVersion: 'v2.9.5',
    backupDate: todayStr,
    backupTimestamp: new Date().toISOString(),
    rootFolderId: rootFolder.getId(),
    workspaceConfig: workspaceConfigObj,
    notesCount: notesSnapshot.length,
    notes: notesSnapshot
  }, null, 2);

  // 若當日已存在同名備份檔則更新內容，否則建立新檔案
  const existingToday = backupFolder.getFilesByName(backupFileName);
  if (existingToday.hasNext()) {
    const existingFile = existingToday.next();
    existingFile.setContent(fullBackupPayload);
    Logger.log('✅ 已更新今日備份檔：' + backupFileName + ' (ID: ' + existingFile.getId() + ')');
  } else if (mainConfigFile && notesSnapshot.length === 0) {
    // 若無額外 .md 檔，直接使用 Drive 原生 makeCopy 複製主 JSON 檔
    const copied = mainConfigFile.makeCopy(backupFileName, backupFolder);
    Logger.log('✅ 已複製主資料檔至 Backup：' + backupFileName + ' (ID: ' + copied.getId() + ')');
  } else {
    const created = backupFolder.createFile(backupFileName, fullBackupPayload, MimeType.PLAIN_TEXT);
    Logger.log('✅ 已建立今日完整備份檔：' + backupFileName + ' (ID: ' + created.getId() + ')');
  }

  // 3. 自動檢查 Backup 資料夾，刪除超過 30 天的舊備份檔
  const deletedCount = purgeExpiredBackups_(backupFolder, LVI_CONFIG.RETENTION_DAYS);
  Logger.log('🧹 備份清理完成，共移除 ' + deletedCount + ' 個超過 ' + LVI_CONFIG.RETENTION_DAYS + ' 天的舊備份檔。');
}

/**
 * 檢查 Backup 資料夾並將超過指定天數的舊備份移至垃圾桶
 */
function purgeExpiredBackups_(backupFolder, retentionDays) {
  const nowMs = new Date().getTime();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  const files = backupFolder.getFiles();
  let deletedCount = 0;

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    if (name.indexOf('notes_backup_') !== 0) continue;

    const createdMs = file.getDateCreated().getTime();
    if ((nowMs - createdMs) > maxAgeMs) {
      file.setTrashed(true);
      deletedCount++;
      Logger.log('🗑️ 已刪除過期備份：' + name + ' (建立於 ' + file.getDateCreated().toISOString() + ')');
    }
  }
  return deletedCount;
}

/**
 * 定位 Google Drive 上的 LVI Note 主資料夾
 */
function getOrLocateLviRootFolder_() {
  if (LVI_CONFIG.ROOT_FOLDER_ID) {
    try {
      return DriveApp.getFolderById(LVI_CONFIG.ROOT_FOLDER_ID);
    } catch (e) {}
  }

  const candidateNames = [LVI_CONFIG.ROOT_FOLDER_NAME].concat(LVI_CONFIG.FALLBACK_FOLDER_NAMES);
  for (let i = 0; i < candidateNames.length; i++) {
    const folders = DriveApp.getFoldersByName(candidateNames[i]);
    if (folders.hasNext()) {
      return folders.next();
    }
  }

  // 若名稱經過自訂，可透過搜尋 cloudnotes_workspace_config.json 反向定位其父資料夾
  const cfgFiles = DriveApp.getFilesByName(LVI_CONFIG.MAIN_CONFIG_FILENAME);
  if (cfgFiles.hasNext()) {
    const parents = cfgFiles.next().getParents();
    if (parents.hasNext()) {
      return parents.next();
    }
  }
  return null;
}

function getOrCreateSubfolder_(parentFolder, subfolderName) {
  const iter = parentFolder.getFoldersByName(subfolderName);
  if (iter.hasNext()) {
    return iter.next();
  }
  return parentFolder.createFolder(subfolderName);
}

function collectAllMarkdownNotesSnapshot_(rootFolder) {
  const list = [];
  const collectFromFolder = (folder, categoryName) => {
    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      const fname = f.getName();
      if (fname === LVI_CONFIG.MAIN_CONFIG_FILENAME || !fname.toLowerCase().endsWith('.md')) continue;
      try {
        list.push({
          id: f.getId(),
          name: fname,
          categoryFolder: categoryName || 'ROOT',
          modifiedTime: f.getLastUpdated().toISOString(),
          description: f.getDescription() || '',
          content: f.getBlob().getDataAsString('UTF-8')
        });
      } catch (e) {}
    }
  };

  collectFromFolder(rootFolder, 'ROOT');
  const subFolders = rootFolder.getFolders();
  while (subFolders.hasNext()) {
    const sub = subFolders.next();
    const sName = sub.getName();
    if (sName === LVI_CONFIG.BACKUP_SUBFOLDER_NAME || sName === '_assets' || sName.indexOf('_deprecated') === 0) continue;
    collectFromFolder(sub, sName);
  }
  return list;
}

/**
 * 一鍵註冊每日自動備份排程觸發器（只需手動執行一次此函式即可）
 */
function setupDailyBackupTrigger() {
  const existingTriggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < existingTriggers.length; i++) {
    if (existingTriggers[i].getHandlerFunction() === 'runDailyLviNoteBackup') {
      ScriptApp.deleteTrigger(existingTriggers[i]);
    }
  }

  ScriptApp.newTrigger('runDailyLviNoteBackup')
    .timeBased()
    .everyDays(1)
    .atHour(2) // 每日凌晨 02:00 ~ 03:00 自動執行
    .inTimezone(LVI_CONFIG.TIMEZONE)
    .create();

  Logger.log('🎉 已成功建立每日凌晨 02:00 自動執行的 LVI Note 雲端快照備份排程！');
}
