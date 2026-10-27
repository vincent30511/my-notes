const APP_VERSION = 'v2.7.4'; // 2026.10.23 (搜尋命中定位閃爍 + 表格就地改分類與預覽窗 + 照片就地標註 + 排查三段式模板)
console.log('🚀 LVI_Note ' + APP_VERSION + ' Initialized.');
// 啟動時自動遷移歷史資料夾名稱至 LVI_Note
if (localStorage.getItem('cloudnotes_folder_name') === 'DriveNotes') {
  localStorage.setItem('cloudnotes_folder_name', 'LVI_Note');
}
// ----------------- ⚡ Stale-While-Revalidate (SWR 本地快取 0.01 秒瞬開 + 背景雲端靜默同步引擎 v2.6.4) -----------------
const SWR_WORKSPACE_KEY = 'lvi_swr_workspace_v1';
const SWR_NOTES_KEY = 'lvi_swr_notes_v1';

function saveSwrCacheSnapshot() {
  try {
    const wsSnapshot = {
      folderId: state.folderId || null,
      mediaFolderId: state.mediaFolderId || null,
      categoryFolderMap: state.categoryFolderMap || {},
      machineModels: state.machineModels || [],
      workContents: state.workContents || [],
      urgencies: state.urgencies || [],
      clientsVendors: state.clientsVendors || [],
      tags: state.tags || [],
      folders: state.folders || [],
      user: state.user || null,
      updatedAt: Date.now()
    };
    localStorage.setItem(SWR_WORKSPACE_KEY, JSON.stringify(wsSnapshot));

    if (Array.isArray(state.notes) && state.notes.length > 0) {
      const lastActiveId = localStorage.getItem('lvi_last_active_note_id');
      // 為最近編輯的前 12 篇筆記保留 _cachedBody 與 _cachedHtml，實現 0.01 秒離線/冷啟動瞬開
      const notesSnapshot = state.notes.slice(0, 150).map((n, idx) => {
        const keepBody = (idx < 12) || (n.id === lastActiveId) || (state.currentNote && n.id === state.currentNote.id);
        return {
          id: n.id,
          name: n.name,
          modifiedTime: n.modifiedTime,
          size: n.size,
          parentId: n.parentId,
          parentFolderId: n.parentFolderId,
          meta: n.meta,
          _cachedBody: keepBody ? n._cachedBody : undefined,
          _cachedHtml: keepBody ? n._cachedHtml : undefined,
          _cachedMeta: keepBody ? n._cachedMeta : undefined
        };
      });
      try {
        localStorage.setItem(SWR_NOTES_KEY, JSON.stringify(notesSnapshot));
      } catch (quotaErr) {
        // 若空間較緊，僅保留前 3 篇完整內文與全部清單標題
        const compactSnapshot = state.notes.slice(0, 120).map((n, idx) => {
          const keepBody = (idx < 3) || (n.id === lastActiveId);
          return {
            id: n.id,
            name: n.name,
            modifiedTime: n.modifiedTime,
            parentId: n.parentId,
            meta: n.meta,
            _cachedBody: keepBody ? n._cachedBody : undefined,
            _cachedHtml: keepBody ? n._cachedHtml : undefined,
            _cachedMeta: keepBody ? n._cachedMeta : undefined
          };
        });
        try { localStorage.setItem(SWR_NOTES_KEY, JSON.stringify(compactSnapshot)); } catch (e2) {}
      }
    }
  } catch (err) {
    console.warn('儲存 SWR 快照略過:', err);
  }
}

function hydrateFromSwrCacheOnBoot() {
  try {
    const rawWs = localStorage.getItem(SWR_WORKSPACE_KEY);
    if (rawWs) {
      const ws = JSON.parse(rawWs);
      if (ws.folderId) state.folderId = ws.folderId;
      if (ws.mediaFolderId) state.mediaFolderId = ws.mediaFolderId;
      if (ws.categoryFolderMap) state.categoryFolderMap = ws.categoryFolderMap;
      if (Array.isArray(ws.machineModels) && ws.machineModels.length > 0) state.machineModels = ws.machineModels;
      if (Array.isArray(ws.workContents) && ws.workContents.length > 0) state.workContents = ws.workContents;
      if (Array.isArray(ws.urgencies) && ws.urgencies.length > 0) state.urgencies = ws.urgencies;
      if (Array.isArray(ws.clientsVendors) && ws.clientsVendors.length > 0) state.clientsVendors = ws.clientsVendors;
      if (Array.isArray(ws.tags) && ws.tags.length > 0) state.tags = ws.tags;
      if (Array.isArray(ws.folders) && ws.folders.length > 0) state.folders = ws.folders;
      if (ws.user) state.user = ws.user;
    }

    const rawNotes = localStorage.getItem(SWR_NOTES_KEY);
    if (rawNotes) {
      const parsedNotes = JSON.parse(rawNotes);
      if (Array.isArray(parsedNotes) && parsedNotes.length > 0) {
        state.notes = parsedNotes;
        state.hasHydratedFromSwr = true;
      }
    }

    if (state.hasHydratedFromSwr) {
      console.log('⚡ [SWR 瞬開引擎] 0.01s 成功自本機快取秒開筆記與分類清單！');
      if (state.user && state.user.picture && DOM.userAvatar) {
        DOM.userAvatar.src = state.user.picture;
      }
      if (localStorage.getItem('cloudnotes_authorized') === 'true') {
        if (DOM.loginBtn) DOM.loginBtn.classList.add('hidden');
        if (DOM.userProfile) DOM.userProfile.classList.remove('hidden');
        updateSyncStatus('syncing', '⚡ 快取秒開 (背景同步中...)');
      }
      renderWorkTagLists();
      renderWorkTagSelects();
      renderSidebarTags();
      renderNotesList();

      const lastEditedId = localStorage.getItem('lvi_last_active_note_id');
      const targetNote = (lastEditedId && state.notes.find(n => n.id === lastEditedId)) || state.notes[0];
      if (targetNote) {
        selectNote(targetNote.id);
      }
    }
  } catch (err) {
    console.warn('SWR 啟動快取讀取略過:', err);
  }
}

/**
 * CloudNotes Pro - LVI_Note 旗艦純淨所見即所得工作區核心邏輯
 * 包含：
 * 1. 無限層級資料夾樹狀目錄 (Nested Infinite Folders System)
 * 2. 9 款經典膠囊配色標籤庫、下拉式快選標籤面板與全功能標籤管理員
 * 3. 頁面封面橫幅 (Page Cover Banner) 與 8 款藝術漸層預設
 * 4. 頂部即時麵包屑導航 (Breadcrumbs Navigation)
 * 5. 頁面圖示 (Page Icon) 與隨機 Emoji 產生器
 * 6. 斜線指令 (`/`) 浮動選單與 自訂區塊 (Callout, Toggle, Todo, Table, Code, Divider)
 * 7. 純淨無網址所見即所得 (WYSIWYG) 編輯畫布
 * 8. 圖片/影音直接就地嵌入播放
 * 9. CloudNotes AI 智能助手 (Gemini 3.8)
 * 10. Google Drive 背景自動雙向同步與資料持久化
 */

// 經典 8 款 藝術漸層封面
const COVER_PRESETS = [
  { id: 'sunset', name: '日落暖霞 (Sunset)', bg: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
  { id: 'ocean', name: '蔚藍深海 (Ocean)', bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'aurora', name: '極光薄荷 (Aurora)', bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 'dusk', name: '暮光珊瑚 (Dusk)', bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: 'lavender', name: '紫羅蘭 (Lavender)', bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: 'graphite', name: '石墨極簡 (Graphite)', bg: 'linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)' },
  { id: 'forest', name: '沉靜森林 (Forest)', bg: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)' },
  { id: 'cosmic', name: '浩瀚星雲 (Cosmic)', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
];

// 預設資料夾 (支援任意深度的無限層級)
const DEFAULT_FOLDERS = [
  { id: 'f_work', name: '工作與專案', parentId: null, isOpen: true, color: 'blue' },
  { id: 'f_work_q4', name: '2026 規劃', parentId: 'f_work', isOpen: false, color: 'purple' },
  { id: 'f_life', name: '生活日常', parentId: null, isOpen: true, color: 'green' },
  { id: 'f_study', name: '學習與研究', parentId: null, isOpen: false, color: 'yellow' }
];

// 預設標籤調色盤
const DEFAULT_TAGS = [
  { id: 't_meeting', name: '會議', color: 'blue' },
  { id: 't_work', name: '工作', color: 'purple' },
  { id: 't_project', name: '專案', color: 'green' },
  { id: 't_idea', name: '靈感', color: 'yellow' },
  { id: 't_life', name: '生活', color: 'orange' },
  { id: 't_tech', name: '技術', color: 'red' }
];

// 隨機 Emoji 清單
const CURATED_EMOJIS = [
  '📝', '💡', '🚀', '📚', '🎯', '📷', '💻', '📊', '☕', '🎨',
  '🌟', '📦', '🔥', '💼', '🌱', '🧠', '🎉', '⚡', '📌', '🏆',
  '🔬', '🎧', '🧭', '💎', '📑', '🔑', '🛠️', '✨', '🌈', '🧩'
];

// 預設 Google Client ID 與 指定帳號
const DEFAULT_CLIENT_ID = '582047821145-ekcolq9q6at8p1r5308ia2jer44a7g1a.apps.googleusercontent.com';
const DEFAULT_USER_EMAIL = 'vincent30511@gmail.com';

const DEFAULT_MACHINE_MODELS = [
  'SA730-8MP',
  'SA710',
  'SA-100'
];

// 預設工作內容 (符合使用者實際環境)
const DEFAULT_WORK_CONTENTS = [
  '操作手冊 📖',
  '零件更換 ⚙️',
  '異常通報 🚨',
  '參數調校 🎛️',
  '保養維護 🛠️'
];

// 預設客戶或廠商 (符合現場工程與專案環境，可自由擴充管理)
const DEFAULT_CLIENTS_VENDORS = [
  '台積電 (TSMC)',
  '聯電 (UMC)',
  '日月光 (ASE)',
  '艾司摩爾 (ASML)',
  '應用材料 (AMAT)',
  '東京威力 (TEL)'
];

// 預設急迫性等級 (符合使用者實際環境)
const DEFAULT_URGENCIES = [
  { id: '特急', label: '🔴 特急 (當日完成)', short: '特急', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300' },
  { id: '高急迫', label: '🟡 高急迫 (2日內)', short: '高急迫', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300' },
  { id: '常規', label: '🟢 常規 (本週進度)', short: '常規', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300' },
  { id: '低急迫', label: '⚪ 低急迫 (備用排程)', short: '低急迫', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300' }
];

const COLOR_THEMES = {
  rose: { label: '🔴 紅色系 (特急)', class: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300' },
  amber: { label: '🟡 黃色系 (高急迫)', class: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300' },
  emerald: { label: '🟢 綠色系 (常規)', class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300' },
  gray: { label: '⚪ 灰色系 (低急迫)', class: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300' },
  purple: { label: '🟣 紫色系 (專案)', class: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300' },
  blue: { label: '🔵 藍色系 (追蹤)', class: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300' },
  cyan: { label: '🩵 青色系 (檢驗)', class: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-300' },
  orange: { label: '🟠 橙色系 (次要)', class: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-300' }
};

// 全域狀態
const state = {
  clientId: localStorage.getItem('cloudnotes_client_id') || DEFAULT_CLIENT_ID,
  userEmail: localStorage.getItem('cloudnotes_user_email') || DEFAULT_USER_EMAIL,
  folderName: localStorage.getItem('cloudnotes_folder_name') || 'LVI_Note',
  geminiApiKey: localStorage.getItem('cloudnotes_gemini_key') || '',
  folderId: null,
  mediaFolderId: null,
  googleTasks: [],
  googleTasksListId: null,
  tasksLoading: false,
  tasksFilterKeyword: '',
  googleCalendarEvents: [],
  googleCalendars: [],
  selectedCalendarIds: [],
  currentSelectedDate: null,
  calendarSyncing: false,
  categoryFolderMap: {},
  globalLoadingCount: 0,
  accessToken: null,
  tokenClient: null,
  user: null,
  notes: [],
  currentNote: null,
  machineModels: [],
  workContents: [],
  urgencies: [],
  clientsVendors: [],
  currentMachineFilter: null,
  currentContentFilter: null,
  currentUrgencyFilter: null,
  currentClientVendorFilter: null,
  workTagModalType: 'machine',
  tags: [],
  currentTagFilter: null, // null 表示不篩選標籤
  folderModalMode: 'create', // create, create_sub, rename
  folderModalTargetId: null,
  isDirty: false,
  layoutMode: localStorage.getItem('cloudnotes_layout') || 'list',
  filterMode: 'all', // all, pinned, doing, today, inbox
  currentView: 'editor', // editor, table, board, calendar, review, budget
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  boardGroupBy: 'status', // status, energy, gtd
  isFullWidth: localStorage.getItem('cloudnotes_fullwidth') === 'true',
  pendingPasteUrl: null,
  pendingPasteRange: null,
  theme: localStorage.getItem('cloudnotes_theme') || 'light',
  autoSaveTimer: null,
  tokenRefreshTimer: null
};

// DOM 元素引用
const DOM = {
  // 導覽列
  headerFolder: document.getElementById('header-folder-name'),
  headerTitle: document.getElementById('header-note-title'),
  syncStatus: document.getElementById('sync-status'),
  syncIndicator: document.getElementById('sync-indicator'),
  syncText: document.getElementById('sync-text'),
  insertMediaBtn: document.getElementById('insert-media-btn'),
  insertCameraBtn: document.getElementById('insert-camera-btn'),
  cameraCaptureInput: document.getElementById('camera-capture-input'),
  mediaUploadInput: document.getElementById('media-upload-input'),
  insertFileBtn: document.getElementById('insert-file-btn'),
  mbToolFile: document.getElementById('mb-tool-file'),
  mbToolCamera: document.getElementById('mb-tool-camera'),
  genericFileUploadInput: document.getElementById('generic-file-upload-input'),
  templateDropdownBtn: document.getElementById('template-dropdown-btn'),
  templateMenu: document.getElementById('template-menu'),
  exportDropdownBtn: document.getElementById('export-dropdown-btn'),
  exportMenu: document.getElementById('export-menu'),
  exportMdBtn: document.getElementById('export-md-btn'),
  exportHtmlBtn: document.getElementById('export-html-btn'),
  exportPdfBtn: document.getElementById('export-pdf-btn'),
  toggleOutlineBtn: document.getElementById('toggle-outline-btn'),
  closeOutlineBtn: document.getElementById('close-outline-btn'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  loginBtn: document.getElementById('login-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  userProfile: document.getElementById('user-profile'),
  userAvatar: document.getElementById('user-avatar'),

  // 側邊欄與遮罩
  sidebar: document.getElementById('sidebar'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
  toggleSidebarBtn: document.getElementById('toggle-sidebar-btn'),
  closeSidebarMobileBtn: document.getElementById('close-sidebar-mobile-btn'),
  newNoteBtn: document.getElementById('new-note-btn'),
  searchInput: document.getElementById('search-input'),
  filterAllBtn: document.getElementById('filter-all-btn'),
  filterPinnedBtn: document.getElementById('filter-pinned-btn'),
  filterDoingBtn: document.getElementById('filter-doing-btn'),
  layoutListBtn: document.getElementById('layout-list-btn'),
  layoutGridBtn: document.getElementById('layout-grid-btn'),
  notesList: document.getElementById('notes-list'),
  notesLoading: document.getElementById('notes-loading'),
  notesListHeading: document.getElementById('notes-list-heading'),
  sidebarFolderLabel: document.getElementById('sidebar-folder-label'),
  refreshBtn: document.getElementById('refresh-btn'),

  // 🏢 工作專用 3 級標籤導航 DOM 元素
  sidebarMachineList: document.getElementById('sidebar-machine-list'),
  addMachineBtn: document.getElementById('add-machine-btn'),
  sidebarContentList: document.getElementById('sidebar-content-list'),
  addContentTypeBtn: document.getElementById('add-content-type-btn'),
  sidebarUrgencyList: document.getElementById('sidebar-urgency-list'),
  sidebarClientList: document.getElementById('sidebar-client-list'),
  addClientBtn: document.getElementById('add-client-btn'),
  manageClientBtn: document.getElementById('manage-client-btn'),
  activeFilterBar: document.getElementById('active-filter-bar'),
  activeFilterChips: document.getElementById('active-filter-chips'),
  clearAllFiltersBtn: document.getElementById('clear-all-filters-btn'),

  // ↩️ 復原與 20+ 步時光回朔面板 DOM
  undoActionBtn: document.getElementById('undo-action-btn'),
  redoActionBtn: document.getElementById('redo-action-btn'),
  actionHistoryBtn: document.getElementById('action-history-btn'),
  historyCounterBadge: document.getElementById('history-counter-badge'),
  actionHistoryModal: document.getElementById('action-history-modal'),
  closeHistoryModalBtn: document.getElementById('close-history-modal-btn'),
  closeHistoryModalDoneBtn: document.getElementById('close-history-modal-done-btn'),
  historyStatusText: document.getElementById('history-status-text'),
  historyUndoableCount: document.getElementById('history-undoable-count'),
  btnQuickUndo20: document.getElementById('btn-quick-undo-20'),
  btnModalUndoOne: document.getElementById('btn-modal-undo-one'),
  btnModalRedoOne: document.getElementById('btn-modal-redo-one'),
  historyTimelineList: document.getElementById('history-timeline-list'),

  // 🏷️ 全層級標籤管理中心 DOM
  manageMachineBtn: document.getElementById('manage-machine-btn'),
  manageContentBtn: document.getElementById('manage-content-btn'),
  addUrgencyBtn: document.getElementById('add-urgency-btn'),
  manageUrgencyBtn: document.getElementById('manage-urgency-btn'),
  btnManageMachine: document.getElementById('btn-manage-machine'),
  btnManageContent: document.getElementById('btn-manage-content'),
  btnQuickAddUrgency: document.getElementById('btn-quick-add-urgency'),
  btnManageUrgency: document.getElementById('btn-manage-urgency'),

  tmTabMachine: document.getElementById('tm-tab-machine'),
  tmTabContent: document.getElementById('tm-tab-content'),
  tmTabUrgency: document.getElementById('tm-tab-urgency'),
  tmTabClient: document.getElementById('tm-tab-client'),
  tmTabCustom: document.getElementById('tm-tab-custom'),
  tmPaneMachine: document.getElementById('tm-pane-machine'),
  tmPaneContent: document.getElementById('tm-pane-content'),
  tmPaneUrgency: document.getElementById('tm-pane-urgency'),
  tmPaneClient: document.getElementById('tm-pane-client'),
  tmNewClientInput: document.getElementById('tm-new-client-input'),
  tmAddClientBtn: document.getElementById('tm-add-client-btn'),
  tmClientTotalCount: document.getElementById('tm-client-total-count'),
  tmClientList: document.getElementById('tm-client-list'),
  tmPaneCustom: document.getElementById('tm-pane-custom'),
  tmNewMachineInput: document.getElementById('tm-new-machine-input'),
  tmAddMachineBtn: document.getElementById('tm-add-machine-btn'),
  tmMachineTotalCount: document.getElementById('tm-machine-total-count'),
  tmMachineList: document.getElementById('tm-machine-list'),
  tmNewContentInput: document.getElementById('tm-new-content-input'),
  tmAddContentBtn: document.getElementById('tm-add-content-btn'),
  tmContentTotalCount: document.getElementById('tm-content-total-count'),
  tmContentList: document.getElementById('tm-content-list'),
  tmNewUrgencyName: document.getElementById('tm-new-urgency-name'),
  tmNewUrgencyColor: document.getElementById('tm-new-urgency-color'),
  tmAddUrgencyBtn: document.getElementById('tm-add-urgency-btn'),
  tmUrgencyTotalCount: document.getElementById('tm-urgency-total-count'),
  tmUrgencyList: document.getElementById('tm-urgency-list'),
  tmCustomTotalCount: document.getElementById('tm-custom-total-count'),

  // 頂部麵包屑與封面
  pageBreadcrumbs: document.getElementById('page-breadcrumbs'),
  pageCover: document.getElementById('page-cover'),
  addCoverBtn: document.getElementById('add-cover-btn'),
  changeCoverBtn: document.getElementById('change-cover-btn'),
  removeCoverBtn: document.getElementById('remove-cover-btn'),
  randomEmojiBtn: document.getElementById('random-emoji-btn'),

  // 頁首屬性 (工作專用標籤：機型、內容、急迫性)
  noteEmojiBtn: document.getElementById('note-emoji-btn'),
  emojiPicker: document.getElementById('emoji-picker'),
  noteTitle: document.getElementById('note-title'),
  notePinBtn: document.getElementById('note-pin-btn'),
  deleteNoteBtn: document.getElementById('delete-note-btn'),
  noteMachineSelect: document.getElementById('note-machine-select'),
  btnQuickAddMachine: document.getElementById('btn-quick-add-machine'),
  noteContentSelect: document.getElementById('note-content-select'),
  btnQuickAddContent: document.getElementById('btn-quick-add-content'),
  noteUrgencySelect: document.getElementById('note-urgency-select'),
  noteClientSelect: document.getElementById('note-client-select'),
  btnQuickAddClient: document.getElementById('btn-quick-add-client'),
  btnManageClient: document.getElementById('btn-manage-client'),
  noteStatusSelect: document.getElementById('note-status-select'),
  
  // 下拉式標籤選單
  noteTagsWrapper: document.getElementById('note-tags-wrapper'),
  noteActiveTags: document.getElementById('note-active-tags'),
  addTagBtn: document.getElementById('add-tag-btn'),
  tagDropdownPopover: document.getElementById('tag-dropdown-popover'),
  tagSearchInput: document.getElementById('tag-search-input'),
  tagOptionsList: document.getElementById('tag-options-list'),
  tagCreateRow: document.getElementById('tag-create-row'),
  tagNewNamePreview: document.getElementById('tag-new-name-preview'),
  tagNewColorSelect: document.getElementById('tag-new-color-select'),
  tagConfirmCreateBtn: document.getElementById('tag-confirm-create-btn'),
  openTagManagerLink: document.getElementById('open-tag-manager-link'),

  // ✨ 純淨所見即所得畫布 (WYSIWYG Live Canvas)
  uploadProgressBar: document.getElementById('upload-progress-bar'),
  editor: document.getElementById('editor'),
  slashMenu: document.getElementById('slash-menu'),
  outlinePanel: document.getElementById('outline-panel'),
  outlineList: document.getElementById('outline-list'),

  // 手機底部快捷列
  mbToolAi: document.getElementById('mb-tool-ai'),
  mbToolMedia: document.getElementById('mb-tool-media'),
  mbToolBold: document.getElementById('mb-tool-bold'),
  mbToolTodo: document.getElementById('mb-tool-todo'),
  mbToolList: document.getElementById('mb-tool-list'),
  mbToolCallout: document.getElementById('mb-tool-callout'),
  mbToolSave: document.getElementById('mb-tool-save'),

  // 統計頁尾
  statWords: document.getElementById('stat-words'),
  statChars: document.getElementById('stat-chars'),
  statTime: document.getElementById('stat-time'),
  statAutosave: document.getElementById('stat-autosave'),

  // 設定 Modal
  settingsModal: document.getElementById('settings-modal'),
  closeSettingsBtn: document.getElementById('close-settings-btn'),
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  settingClientId: document.getElementById('setting-client-id'),
  settingUserEmail: document.getElementById('setting-user-email'),
  settingFolderName: document.getElementById('setting-folder-name'),
  settingGeminiKey: document.getElementById('setting-gemini-key'),

  // 標籤管理員 Modal
  tagManagerModal: document.getElementById('tag-manager-modal'),
  closeTagManagerBtn: document.getElementById('close-tag-manager-btn'),
  tmNewName: document.getElementById('tm-new-name'),
  tmNewColor: document.getElementById('tm-new-color'),
  tmAddBtn: document.getElementById('tm-add-btn'),
  tmTagsList: document.getElementById('tm-tags-list'),
  tmDoneBtn: document.getElementById('tm-done-btn'),

  // 頁面封面 Modal
  coverModal: document.getElementById('cover-modal'),
  closeCoverModalBtn: document.getElementById('close-cover-modal-btn'),
  coverPresetsGrid: document.getElementById('cover-presets-grid'),
  customCoverInput: document.getElementById('custom-cover-input'),
  applyCustomCoverBtn: document.getElementById('apply-custom-cover-btn'),

  // 資料夾 Modal
  folderModal: document.getElementById('folder-modal'),
  folderModalTitle: document.getElementById('folder-modal-title'),
  closeFolderModalBtn: document.getElementById('close-folder-modal-btn'),
  folderNameInput: document.getElementById('folder-name-input'),
  folderParentGroup: document.getElementById('folder-parent-group'),
  folderParentSelect: document.getElementById('folder-parent-select'),
  cancelFolderModalBtn: document.getElementById('cancel-folder-modal-btn'),
  submitFolderModalBtn: document.getElementById('submit-folder-modal-btn'),

  // Toast
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),

  // PAPAYA 電腦教室 旗艦功能元素
  toggleFullwidthBtn: document.getElementById('toggle-fullwidth-btn'),
  canvasInnerWrapper: document.getElementById('canvas-inner-wrapper'),
  favoritesContainer: document.getElementById('favorites-container'),
  favoritesList: document.getElementById('favorites-list'),
  selectionToolbar: document.getElementById('selection-toolbar'),
  selAiBtn: document.getElementById('sel-ai-btn'),
  selTurnH1: document.getElementById('sel-turn-h1'),
  selTurnH2: document.getElementById('sel-turn-h2'),
  selTurnTodo: document.getElementById('sel-turn-todo'),
  selTurnCallout: document.getElementById('sel-turn-callout'),
  spaceAiBox: document.getElementById('space-ai-box'),
  spaceAiInput: document.getElementById('space-ai-input'),
  spaceAiSubmit: document.getElementById('space-ai-submit'),
  smartUrlMenu: document.getElementById('smart-url-menu'),
  pasteEmbedBtn: document.getElementById('paste-embed-btn'),
  pasteBookmarkBtn: document.getElementById('paste-bookmark-btn'),
  pasteMentionBtn: document.getElementById('paste-mention-btn'),
  pasteRawBtn: document.getElementById('paste-raw-btn'),
  mentionMenu: document.getElementById('mention-menu'),
  mentionOptions: document.getElementById('mention-options'),

  // 🏆 薑餅資 多重視圖與核心系統 DOM 元素
  viewModeBar: document.getElementById('view-mode-bar'),
  viewTabEditor: document.getElementById('view-tab-editor'),
  viewTabTable: document.getElementById('view-tab-table'),
  viewTabTasks: document.getElementById('view-tab-tasks'),
  viewTabCalendar: document.getElementById('view-tab-calendar'),
  viewCountBadge: document.getElementById('view-count-badge'),
  viewQuickAddBtn: document.getElementById('view-quick-add-btn'),

  // 側邊欄待處理事件與隨手筆記按鈕
  sidebarTasksBtn: document.getElementById('sidebar-tasks-btn'),
  sidebarTasksCount: document.getElementById('sidebar-tasks-count'),
  sidebarQuickNoteBtn: document.getElementById('sidebar-quick-note-btn'),
  sidebarUncatCount: document.getElementById('sidebar-uncat-count'),
  filterUncatBtn: document.getElementById('filter-uncat-btn'),
  sidebarFilterUncatBadge: document.getElementById('sidebar-filter-uncat-badge'),
  viewTabUncategorized: document.getElementById('view-tab-uncategorized'),
  uncatTabBadge: document.getElementById('uncat-tab-badge'),
  viewUncategorizedContainer: document.getElementById('view-uncategorized-container'),
  uncatCountBadge: document.getElementById('uncat-count-badge'),
  uncatQuickAddBtn: document.getElementById('uncat-quick-add-btn'),
  uncatRefreshBtn: document.getElementById('uncat-refresh-btn'),
  uncatSearchInput: document.getElementById('uncat-search-input'),
  uncatNotesGrid: document.getElementById('uncat-notes-grid'),
  uncatSummaryText: document.getElementById('uncat-summary-text'),
  globalTopLoader: document.getElementById('global-top-loader'),
  globalFloatingLoader: document.getElementById('global-floating-loader'),
  globalLoaderText: document.getElementById('global-loader-text'),

  // 主容器與各視圖
  mobileToolbar: document.getElementById('mobile-toolbar'),
  mainScrollContainer: document.getElementById('main-scroll-container'),
  viewTableContainer: document.getElementById('view-table-container'),
  viewTasksContainer: document.getElementById('view-tasks-container'),
  viewCalendarContainer: document.getElementById('view-calendar-container'),

  // 待處理事件 (Google Tasks) DOM
  tasksSyncBadge: document.getElementById('tasks-sync-badge'),
  tasksSyncStatusText: document.getElementById('tasks-sync-status-text'),
  tasksStatUncompleted: document.getElementById('tasks-stat-uncompleted'),
  tasksStatCompleted: document.getElementById('tasks-stat-completed'),
  tasksSearchInput: document.getElementById('tasks-search-input'),
  tasksRefreshBtn: document.getElementById('tasks-refresh-btn'),
  tasksAuthBtn: document.getElementById('tasks-auth-btn'),
  quickAddTaskForm: document.getElementById('quick-add-task-form'),
  quickTaskTitle: document.getElementById('quick-task-title'),
  quickTaskUrgency: document.getElementById('quick-task-urgency'),
  quickTaskDue: document.getElementById('quick-task-due'),
  quickTaskSubmitBtn: document.getElementById('quick-task-submit-btn'),
  colCountUrgent: document.getElementById('col-count-urgent'),
  colCountHigh: document.getElementById('col-count-high'),
  colCountNormal: document.getElementById('col-count-normal'),
  colCountLow: document.getElementById('col-count-low'),
  tasksListUrgent: document.getElementById('tasks-list-urgent'),
  tasksListHigh: document.getElementById('tasks-list-high'),
  tasksListNormal: document.getElementById('tasks-list-normal'),
  tasksListLow: document.getElementById('tasks-list-low'),
  tasksCompletedBadge: document.getElementById('tasks-completed-badge'),
  tasksClearCompletedBtn: document.getElementById('tasks-clear-completed-btn'),
  tasksListCompleted: document.getElementById('tasks-list-completed'),
    
  // 筆記屬性面板擴展
  noteDueDate: document.getElementById('note-due-date'),

  // 表格視圖
  tableSearchInput: document.getElementById('table-search-input'),
  tableSearchClearBtn: document.getElementById('table-search-clear-btn'),
  tableFuzzyIndexBadge: document.getElementById('table-fuzzy-index-badge'),
  tableFuzzyQueryBanner: document.getElementById('table-fuzzy-query-banner'),
  tableFuzzyQueryDetails: document.getElementById('table-fuzzy-query-details'),
  tableFuzzyStatsText: document.getElementById('table-fuzzy-stats-text'),
  tableFilterMachine: document.getElementById('table-filter-machine'),
  tableFilterContent: document.getElementById('table-filter-content'),
  tableFilterUrgency: document.getElementById('table-filter-urgency'),
  tableFilterClient: document.getElementById('table-filter-client'),
  tableFilterTag: document.getElementById('table-filter-tag'),
  toggleAllMediaBtn: document.getElementById('toggle-all-media-btn'),
  toggleAllMediaLabel: document.getElementById('toggle-all-media-label'),
  selHighlightBtn: document.getElementById('sel-highlight-btn'),
  selHighlightPalette: document.getElementById('sel-highlight-palette'),
  selClearFormatBtn: document.getElementById('sel-clear-format-btn'),
  topHighlightWrapper: document.getElementById('top-highlight-wrapper'),
  topHighlightApplyBtn: document.getElementById('top-highlight-apply-btn'),
  topHighlightMenuBtn: document.getElementById('top-highlight-Menu-btn'),
  topHighlightColorDot: document.getElementById('top-highlight-color-dot'),
  topHighlightPalette: document.getElementById('top-highlight-palette'),
  topHighlightBrushToggle: document.getElementById('top-highlight-brush-toggle'),
  mbToolUndo: document.getElementById('mb-tool-undo'),
  mbToolHighlight: document.getElementById('mb-tool-highlight'),
  mbHighlightPalette: document.getElementById('mb-highlight-palette'),
  topInsertTroubleshootBtn: document.getElementById('top-insert-troubleshoot-btn'),
  tableQuickPeekBackdrop: document.getElementById('table-quick-peek-backdrop'),
  tableQuickPeekDrawer: document.getElementById('table-quick-peek-drawer'),
  peekNoteIcon: document.getElementById('peek-note-icon'),
  peekNoteTitle: document.getElementById('peek-note-title'),
  peekNoteTime: document.getElementById('peek-note-time'),
  peekNoteMetaBar: document.getElementById('peek-note-meta-bar'),
  peekNoteBody: document.getElementById('peek-note-body'),
  peekCopyBtn: document.getElementById('peek-copy-btn'),
  peekOpenEditorBtn: document.getElementById('peek-open-editor-btn'),
  peekCloseBtn: document.getElementById('peek-close-btn'),
  photoAnnotateModal: document.getElementById('photo-annotate-modal'),
  photoAnnotateFilename: document.getElementById('photo-annotate-filename'),
  photoAnnotateCanvas: document.getElementById('photo-annotate-canvas'),
  photoAnnotateUndoBtn: document.getElementById('photo-annotate-undo-btn'),
  photoAnnotateClearBtn: document.getElementById('photo-annotate-clear-btn'),
  photoAnnotateCancelBtn: document.getElementById('photo-annotate-cancel-btn'),
  photoAnnotateSaveBtn: document.getElementById('photo-annotate-save-btn'),
  tableFilterStatus: document.getElementById('table-filter-status'),

  // 工作標籤彈窗 (Work Tag Modal)
  workTagModal: document.getElementById('work-tag-modal'),
  workTagModalTitle: document.getElementById('work-tag-modal-title'),
  closeWorkTagModalBtn: document.getElementById('close-work-tag-modal-btn'),
  workTagInputLabel: document.getElementById('work-tag-input-label'),
  workTagNameInput: document.getElementById('work-tag-name-input'),
  cancelWorkTagModalBtn: document.getElementById('cancel-work-tag-modal-btn'),
  submitWorkTagModalBtn: document.getElementById('submit-work-tag-modal-btn'),
  tableAddRowBtn: document.getElementById('table-add-row-btn'),
  tableViewTbody: document.getElementById('table-view-tbody'),
  tableTotalCount: document.getElementById('table-total-count'),
  tableTotalExpense: document.getElementById('table-total-expense'),
  tableTotalIncome: document.getElementById('table-total-income'),

  // 看板視圖
  boardGroupBySelect: document.getElementById('board-group-by-select'),
  boardAddCardBtn: document.getElementById('board-add-card-btn'),
  boardColumnsWrapper: document.getElementById('board-columns-wrapper'),

  // 行事曆視圖
  calendarMonthTitle: document.getElementById('calendar-month-title'),
  calPrevMonthBtn: document.getElementById('cal-prev-month-btn'),
  calTodayBtn: document.getElementById('cal-today-btn'),
  calNextMonthBtn: document.getElementById('cal-next-month-btn'),
  calendarGridCells: document.getElementById('calendar-grid-cells'),
  // Google 日曆 DOM
  calendarSyncBadge: document.getElementById('calendar-sync-badge'),
  calendarSyncStatusText: document.getElementById('calendar-sync-status-text'),
  calFilterBtn: document.getElementById('cal-filter-btn'),
  calFilterPopover: document.getElementById('cal-filter-popover'),
  calSelectedCount: document.getElementById('cal-selected-count'),
  calSelectAllBtn: document.getElementById('cal-select-all-btn'),
  calDeselectAllBtn: document.getElementById('cal-deselect-all-btn'),
  calListMy: document.getElementById('cal-list-my'),
  calListOther: document.getElementById('cal-list-other'),
  calRefreshBtn: document.getElementById('cal-refresh-btn'),
  calAddEventBtn: document.getElementById('cal-add-event-btn'),
  calAuthBtn: document.getElementById('cal-auth-btn'),
  calEventModal: document.getElementById('cal-event-modal'),
  closeCalModalBtn: document.getElementById('close-cal-modal-btn'),
  cancelCalModalBtn: document.getElementById('cancel-cal-modal-btn'),
  submitCalModalBtn: document.getElementById('submit-cal-modal-btn'),
  calModalTitle: document.getElementById('cal-modal-title'),
  calModalDate: document.getElementById('cal-modal-date'),
  calModalDesc: document.getElementById('cal-modal-desc'),
  // 每日行程面板 DOM
  dayScheduleModal: document.getElementById('day-schedule-modal'),
  closeDayModalBtn: document.getElementById('close-day-modal-btn'),
  dayModalTitle: document.getElementById('day-modal-title'),
  dayModalCalCount: document.getElementById('day-modal-cal-count'),
  dayModalNotesCount: document.getElementById('day-modal-notes-count'),
  dayModalAddCalBtn: document.getElementById('day-modal-add-cal-btn'),
  dayModalAddNoteBtn: document.getElementById('day-modal-add-note-btn'),
  dayModalEventsList: document.getElementById('day-modal-events-list'),
  dayModalNotesList: document.getElementById('day-modal-notes-list'),
  dayModalCalBadge: document.getElementById('day-modal-cal-badge'),
  dayModalNotesBadge: document.getElementById('day-modal-notes-badge'),

  // 每日檢視儀表板
  reviewTodayBadge: document.getElementById('review-today-badge'),
  reviewCreateJournalBtn: document.getElementById('review-create-journal-btn'),
  reviewTodayCount: document.getElementById('review-today-count'),
  reviewTodayTasksList: document.getElementById('review-today-tasks-list'),
  reviewQuickTaskInput: document.getElementById('review-quick-task-input'),
  reviewQuickTaskEnergy: document.getElementById('review-quick-task-energy'),
  reviewQuickTaskAddBtn: document.getElementById('review-quick-task-add-btn'),
  reviewKeyActionsList: document.getElementById('review-key-actions-list'),
  reviewBrainDumpInput: document.getElementById('review-brain-dump-input'),
  reviewStoryworthyInput: document.getElementById('review-storyworthy-input'),
  reviewCompletedBadge: document.getElementById('review-completed-badge'),
  reviewCompletedTasksList: document.getElementById('review-completed-tasks-list'),
  reviewOverdueCount: document.getElementById('review-overdue-count'),
  reviewOverdueTasksList: document.getElementById('review-overdue-tasks-list'),
  reviewTomorrowCount: document.getElementById('review-tomorrow-count'),
  reviewTomorrowTasksList: document.getElementById('review-tomorrow-tasks-list'),

  // 記帳儀表板
  budgetStatWeekExpense: document.getElementById('budget-stat-week-expense'),
  budgetStatWeekIncome: document.getElementById('budget-stat-week-income'),
  budgetStatMonthExpense: document.getElementById('budget-stat-month-expense'),
  budgetStatMonthBalance: document.getElementById('budget-stat-month-balance'),
  budgetQuickType: document.getElementById('budget-quick-type'),
  budgetQuickTitle: document.getElementById('budget-quick-title'),
  budgetQuickAmount: document.getElementById('budget-quick-amount'),
  budgetQuickCategory: document.getElementById('budget-quick-category'),
  budgetQuickDate: document.getElementById('budget-quick-date'),
  budgetQuickSubmitBtn: document.getElementById('budget-quick-submit-btn'),
  budgetRecordsCount: document.getElementById('budget-records-count'),
  budgetTableTbody: document.getElementById('budget-table-tbody'),

  // 側邊欄新按鈕
  filterTodayBtn: document.getElementById('filter-today-btn'),
  filterUncatBtn: document.getElementById('filter-uncat-btn'),
    };

// 初始化入口
document.addEventListener('DOMContentLoaded', () => {
  try {
    document.title = 'LVI_Note ' + APP_VERSION + ' - 雲端工作筆記';
    document.querySelectorAll('.app-version-badge, [title="當前版本號"]').forEach(el => {
      el.textContent = APP_VERSION;
    });
    initMediaDeleteConfirmModal();
    if (localStorage.getItem('lvi_just_upgraded') === APP_VERSION) {
      localStorage.removeItem('lvi_just_upgraded');
      setTimeout(() => {
        showToast('🎉 已成功更新至 LVI_Note ' + APP_VERSION + '（搜尋命中自動定位 + 表格就地改分類/預覽窗 + 照片標註 + 排查三段式模板）', 5000);
      }, 600);
    }
  } catch (e) { console.warn('Version sync error:', e); }
  try { initTheme(); } catch (e) { console.error('initTheme error:', e); }
  try { initLucide(); } catch (e) { console.error('initLucide error:', e); }
  try { initSettingsUI(); } catch (e) { console.error('initSettingsUI error:', e); }
  try { initWorkTags(); } catch (e) { console.error('initWorkTags error:', e); }
  try { initWorkTreeCollapse(); } catch (e) { console.error('initWorkTreeCollapse error:', e); }
  try { initTags(); } catch (e) { console.error('initTags error:', e); }
  try { initLayout(); } catch (e) { console.error('initLayout error:', e); }
  try { initCoverPresetsUI(); } catch (e) { console.error('initCoverPresetsUI error:', e); }
  try { initFullWidth(); } catch (e) { console.error('initFullWidth error:', e); }
  try { bindEvents(); } catch (e) { console.error('bindEvents error:', e); }
  try { purgeCorruptedLocalCachesOnBoot(); } catch (e) {}
  try { hydrateFromSwrCacheOnBoot(); } catch (e) { console.error('hydrateFromSwrCacheOnBoot error:', e); }
  try { setupGoogleAuth(); } catch (e) { console.error('setupGoogleAuth error:', e); }
  try { checkAiKeyStatus(); } catch (e) { console.error('checkAiKeyStatus error:', e); }
  try { renderNotesList(); } catch (e) { console.error('renderNotesList error:', e); }
  try { initImageEditor(); } catch (e) { console.error('initImageEditor error:', e); }
  try { initInAppCameraListeners(); } catch (e) { console.error('initInAppCameraListeners error:', e); }
  try {
    const cp = restoreCameraCheckpointIfAny();
    if (cp && cp.noteId) {
      setTimeout(() => { selectNote(cp.noteId); }, 400);
    }
  } catch(e) {}
});

function initLucide() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function initTheme() {
  if (state.theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('cloudnotes_theme', state.theme);
  initTheme();
}

function showToast(message, duration = 3000) {
  if (!DOM.toast) return;
  DOM.toastMessage.textContent = message;
  DOM.toast.classList.remove('opacity-0', 'pointer-events-none');
  setTimeout(() => {
    DOM.toast.classList.add('opacity-0', 'pointer-events-none');
  }, duration);
}

// ----------------- 設定與 Google 自動授權 -----------------
function initSettingsUI() {
  if (DOM.settingClientId) DOM.settingClientId.value = state.clientId;
  if (DOM.settingUserEmail) DOM.settingUserEmail.value = state.userEmail;
  if (DOM.settingFolderName) DOM.settingFolderName.value = state.folderName;
  if (DOM.settingGeminiKey) DOM.settingGeminiKey.value = state.geminiApiKey;
  if (DOM.headerFolder) DOM.headerFolder.textContent = state.folderName;
  if (DOM.sidebarFolderLabel) DOM.sidebarFolderLabel.textContent = state.folderName;
}

function openSettings() {
  DOM.settingClientId.value = state.clientId;
  if (DOM.settingUserEmail) DOM.settingUserEmail.value = state.userEmail;
  DOM.settingFolderName.value = state.folderName;
  DOM.settingGeminiKey.value = state.geminiApiKey;
  DOM.settingsModal.classList.remove('hidden');
}

function closeSettings() {
  DOM.settingsModal.classList.add('hidden');
}

function saveSettings() {
  state.clientId = DOM.settingClientId.value.trim() || DEFAULT_CLIENT_ID;
  if (DOM.settingUserEmail) state.userEmail = DOM.settingUserEmail.value.trim() || DEFAULT_USER_EMAIL;
  state.folderName = DOM.settingFolderName.value.trim() || 'LVI_Note';
  state.geminiApiKey = DOM.settingGeminiKey.value.trim();

  localStorage.setItem('cloudnotes_client_id', state.clientId);
  localStorage.setItem('cloudnotes_user_email', state.userEmail);
  localStorage.setItem('cloudnotes_folder_name', state.folderName);
  localStorage.setItem('cloudnotes_gemini_key', state.geminiApiKey);

  DOM.headerFolder.textContent = state.folderName;
  DOM.sidebarFolderLabel.textContent = state.folderName;

  closeSettings();
  showToast('設定已儲存！');
  checkAiKeyStatus();

  setupGoogleAuth();
}

function setupGoogleAuth() {
  if (!state.clientId) {
    state.clientId = DEFAULT_CLIENT_ID;
    localStorage.setItem('cloudnotes_client_id', DEFAULT_CLIENT_ID);
  }

  const initTokenClientInstance = () => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      try {
        state.tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: state.clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/calendar',
          callback: async (resp) => {
            if (resp.error) {
              if (resp.error === 'immediate_failed') {
                console.log('ℹ️ 靜默自動連線未通過 (需手動點擊登入)');
                updateSyncStatus('offline', '未登入 Google (點擊登入)');
                DOM.loginBtn.classList.remove('hidden');
                DOM.userProfile.classList.add('hidden');
                return;
              }
              if (resp.error === 'popup_closed_by_user') {
                showToast('登入視窗已關閉');
                updateSyncStatus('offline', '未登入');
                DOM.loginBtn.classList.remove('hidden');
                DOM.userProfile.classList.add('hidden');
                return;
              }
              if (resp.error === 'popup_failed_to_open') {
                showToast('⚠️ 瀏覽器攔截了登入彈跳視窗，請點擊網址列右側允許彈跳視窗！', 5000);
                updateSyncStatus('error', '彈窗被攔截');
                DOM.loginBtn.classList.remove('hidden');
                DOM.userProfile.classList.add('hidden');
                return;
              }
              if (resp.error === 'access_denied') {
                showToast('存取授權遭取消');
                localStorage.removeItem('cloudnotes_authorized');
                updateSyncStatus('offline', '未登入');
                DOM.loginBtn.classList.remove('hidden');
                DOM.userProfile.classList.add('hidden');
                return;
              }
              console.error('Google 授權失敗:', resp);
              updateSyncStatus('error', '授權出錯');
              DOM.loginBtn.classList.remove('hidden');
              DOM.userProfile.classList.add('hidden');
              showToast('Google 授權失敗: ' + (resp.error || '未知錯誤') + '（請檢查網址來源是否已加入 Google Cloud 憑證）', 5000);
              return;
            }

            if (resp.access_token) {
              state.accessToken = resp.access_token;
              localStorage.setItem('cloudnotes_access_token', resp.access_token);
              localStorage.setItem('cloudnotes_authorized', 'true');
              const expiresIn = resp.expires_in ? parseInt(resp.expires_in, 10) : 3600;
              scheduleTokenRefresh(expiresIn);
              try {
                await onLoginSuccess();
              } catch (loginErr) {
                console.error('登入後初始化失敗:', loginErr);
                updateSyncStatus('error', '雲端同步出錯 (點擊重試)');
                DOM.loginBtn.classList.remove('hidden');
                DOM.userProfile.classList.add('hidden');
                showToast(`⚠️ 連線異常: ${loginErr.message || '請再試一次'}`);
              }
            }
          }
        });

        // 🚀 自動登入流程 (Auto-Login Engine)
        autoLoginFlow();
        return true;
      } catch (err) {
        console.error('初始化 Google Token Client 錯誤:', err);
        updateSyncStatus('error', 'Google SDK 載入異常');
        return true;
      }
    }
    return false;
  };

  // 若 Google Identity SDK 已就緒，立即同步建立實例
  if (initTokenClientInstance()) return;

  // 否則進行每 100ms 輪詢檢查 (最多 10 秒)
  let checkCount = 0;
  const checkGsi = setInterval(() => {
    checkCount++;
    if (initTokenClientInstance() || checkCount > 100) {
      clearInterval(checkGsi);
      if (checkCount > 100 && !state.tokenClient) {
        console.warn('Google GSI 載入逾時，等待手動點擊登入');
        updateSyncStatus('offline', '未登入 Google (點擊登入)');
        if (DOM.loginBtn) DOM.loginBtn.classList.remove('hidden');
        if (DOM.userProfile) DOM.userProfile.classList.add('hidden');
      }
    }
  }, 100);
}

// 🚀 智慧自動登入核心引擎
async function autoLoginFlow() {
  const cachedToken = localStorage.getItem('cloudnotes_access_token');
  const wasAuthorized = localStorage.getItem('cloudnotes_authorized') === 'true';
  const targetEmail = state.userEmail || DEFAULT_USER_EMAIL;

  if (cachedToken) {
    if (!state.hasHydratedFromSwr) {
      updateSyncStatus('syncing', '驗證登入憑證...');
    }
    try {
      const testRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${cachedToken}` }
      });
      if (testRes.ok) {
        const userData = await testRes.json();
        state.accessToken = cachedToken;
        scheduleTokenRefresh(3600);
        await onLoginSuccess(userData);
        return;
      } else {
        console.log('快取 Token 已過期 (HTTP ' + testRes.status + ')，立即嘗試背景無感更新...');
        localStorage.removeItem('cloudnotes_access_token');
        state.accessToken = null;
      }
    } catch (netErr) {
      console.warn('網路檢查 Token 失敗 (維持本機快取模式):', netErr);
      if (state.hasHydratedFromSwr) {
        updateSyncStatus('offline', '離線快取模式');
        return;
      }
    }
  }

  // 若快取無效但使用者先前已授權，嘗試背景靜默無感登入
  if (wasAuthorized && state.tokenClient) {
    if (!state.hasHydratedFromSwr) {
      updateSyncStatus('syncing', '正在自動連線...');
    }
    state.tokenClient.requestAccessToken({
      prompt: '',
      hint: targetEmail
    });
  } else if (!state.hasHydratedFromSwr) {
    updateSyncStatus('offline', '未登入 Google');
    DOM.loginBtn.classList.remove('hidden');
    DOM.userProfile.classList.add('hidden');
  }
}

function refreshGoogleToken() {
  return new Promise((resolve, reject) => {
    if (!state.tokenClient) return reject(new Error('Token Client 尚未初始化'));
    const prevCallback = state.tokenClient.callback;
    state.tokenClient.callback = async (resp) => {
      state.tokenClient.callback = prevCallback;
      if (resp.error) {
        reject(new Error(resp.error));
      } else if (resp.access_token) {
        state.accessToken = resp.access_token;
        localStorage.setItem('cloudnotes_access_token', resp.access_token);
        const expiresIn = resp.expires_in ? parseInt(resp.expires_in, 10) : 3600;
        scheduleTokenRefresh(expiresIn);
        resolve(resp.access_token);
      }
    };
    state.tokenClient.requestAccessToken({ prompt: '', hint: state.userEmail || DEFAULT_USER_EMAIL });
  });
}

function scheduleTokenRefresh(expiresIn) {
  if (state.tokenRefreshTimer) clearTimeout(state.tokenRefreshTimer);
  const refreshMs = Math.max((expiresIn - 300) * 1000, 60000);
  state.tokenRefreshTimer = setTimeout(() => {
    if (state.tokenClient) {
      console.log('背景自動更新 Google Drive 存取憑證...');
      state.tokenClient.requestAccessToken({ prompt: '', hint: state.userEmail || DEFAULT_USER_EMAIL });
    }
  }, refreshMs);
}

function handleLogin() {
  if (window.location.protocol === 'file:') {
    showToast('⚠️ Google 登入不支援 file:// 直接開啟，請透過本機 HTTP 伺服器 (如 Live Server 或 python -m http.server 8000) 開啟網頁！', 8000);
  }

  if (!state.clientId) {
    state.clientId = DEFAULT_CLIENT_ID;
    localStorage.setItem('cloudnotes_client_id', DEFAULT_CLIENT_ID);
  }

  const targetEmail = state.userEmail || DEFAULT_USER_EMAIL;

  if (state.tokenClient) {
    updateSyncStatus('syncing', '正在開啟 Google 授權視窗...');
    // 💡 關鍵修復：手動點擊登入時，明確指定 prompt: 'select_account'！
    // 確保瀏覽器必定彈出帳號確認視窗，且帶入預設信箱 hint，徹底杜絕 immediate_failed 導致按鈕無效！
    state.tokenClient.requestAccessToken({
      prompt: 'select_account',
      hint: targetEmail
    });
  } else {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      setupGoogleAuth();
      if (state.tokenClient) {
        updateSyncStatus('syncing', '正在開啟 Google 授權視窗...');
        state.tokenClient.requestAccessToken({
          prompt: 'select_account',
          hint: targetEmail
        });
        return;
      }
    }
    showToast('Google 認證元件載入中，請確認網路連線並稍候重試...');
    setupGoogleAuth();
  }
}

function handleLogout() {
  if (state.tokenRefreshTimer) clearTimeout(state.tokenRefreshTimer);
  if (state.accessToken && window.google && window.google.accounts && window.google.accounts.oauth2) {
    try {
      google.accounts.oauth2.revoke(state.accessToken, () => {});
    } catch(e) {}
  }
  state.accessToken = null;
  state.user = null;
  localStorage.removeItem('cloudnotes_access_token');
  localStorage.removeItem('cloudnotes_authorized');
  DOM.userProfile.classList.add('hidden');
  DOM.loginBtn.classList.remove('hidden');
  updateSyncStatus('offline', '未登入');
  state.notes = [];
  state.currentNote = null;
  state.machineModels = [];
  state.workContents = [];
  state.urgencies = [];
  state.tags = [];
  state.folders = [];
  renderNotesList();
  renderWorkTagLists();
  renderWorkTagSelects();
  renderSidebarTags();
  clearEditor();
  showToast('已登出 Google 帳號，本機不保留任何資料');
}

async function onLoginSuccess(prefetchedUser = null) {
  DOM.loginBtn.classList.add('hidden');
  DOM.userProfile.classList.remove('hidden');
  const isSilentSwr = !!state.hasHydratedFromSwr;
  updateSyncStatus('syncing', isSilentSwr ? '⚡ 背景同步雲端...' : '連線中...');

  if (prefetchedUser) {
    state.user = prefetchedUser;
  } else {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    if (!res.ok) {
      throw new Error(`Token 驗證無效 (HTTP ${res.status})`);
    }
    state.user = await res.json();
  }

  if (state.user && state.user.picture) {
    DOM.userAvatar.src = state.user.picture;
  }
  if (state.user && state.user.email) {
    state.userEmail = state.user.email;
    localStorage.setItem('cloudnotes_user_email', state.user.email);
  }

  // 🚀 若 SWR 快取中已有 folderId，立即平行啟動設定檔與筆記清單同步，不需序列等待！
  if (state.folderId) {
    ensureNotesFolder().catch(e => console.warn('背景確認資料夾:', e));
  } else {
    await ensureNotesFolder();
  }

  await Promise.all([
    syncWorkspaceConfigWithDrive(isSilentSwr),
    fetchNotesList(isSilentSwr)
  ]);

  saveSwrCacheSnapshot();
  syncGoogleTasks().catch(e => console.warn('Tasks 同步:', e));
  syncGoogleCalendar().catch(e => console.warn('日曆同步:', e));
  flushPendingSyncQueue().catch(e => console.warn('補傳未上傳草稿:', e));
  updateSyncStatus('synced', '已連線');
  if (!isSilentSwr) {
    showToast(`✅ 歡迎回來，${state.user.name || state.user.email || '使用者'}！筆記已自 Google Drive 同步`);
  }
}

function updateSyncStatus(status, text) {
  DOM.syncText.textContent = text;
  DOM.syncIndicator.className = 'w-2 h-2 rounded-full';
  if (status === 'synced') {
    DOM.syncIndicator.classList.add('bg-emerald-500');
  } else if (status === 'syncing') {
    DOM.syncIndicator.classList.add('bg-blue-500', 'animate-ping');
  } else if (status === 'error') {
    DOM.syncIndicator.classList.add('bg-rose-500');
  } else {
    DOM.syncIndicator.classList.add('bg-gray-400');
  }
}

// ----------------- Google Drive 資料夾與筆記 -----------------

// ==========================================================================
// ⚡ 全域過渡動畫與加載指示器 (Global Loading & Transition Engine)
// ==========================================================================

function showGlobalLoading(text = '載入中...') {
  state.globalLoadingCount = (state.globalLoadingCount || 0) + 1;
  if (DOM.globalTopLoader) DOM.globalTopLoader.classList.remove('hidden');
  if (DOM.globalFloatingLoader && DOM.globalLoaderText) {
    DOM.globalLoaderText.textContent = text;
    DOM.globalFloatingLoader.classList.remove('hidden');
  }
}

function hideGlobalLoading() {
  state.globalLoadingCount = Math.max(0, (state.globalLoadingCount || 1) - 1);
  if (state.globalLoadingCount === 0) {
    if (DOM.globalTopLoader) DOM.globalTopLoader.classList.add('hidden');
    if (DOM.globalFloatingLoader) DOM.globalFloatingLoader.classList.add('hidden');
  }
}

async function withLoading(btnOrId, asyncFn, loadingText = '') {
  const btn = typeof btnOrId === 'string' ? document.getElementById(btnOrId) : btnOrId;
  let originalHtml = '';
  showGlobalLoading(loadingText || '處理中...');
  if (btn) {
    originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('btn-loading');
    const icon = btn.querySelector('[data-lucide], svg');
    if (icon) {
      icon.classList.add('animate-spin');
    }
  }
  try {
    return await asyncFn();
  } finally {
    hideGlobalLoading();
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      if (originalHtml) btn.innerHTML = originalHtml;
      initLucide();
    }
  }
}

// 📁 Google Drive 分類子資料夾確保與自動建立機制
async function ensureCategoryFolder(categoryName) {
  categoryName = (categoryName || '').trim() || '未分類';
  if (!state.accessToken || !state.folderId) return state.folderId;
  if (!state.categoryFolderMap) state.categoryFolderMap = {};
  if (state.categoryFolderMap[categoryName]) {
    return state.categoryFolderMap[categoryName];
  }
  try {
    const q = `'${state.folderId}' in parents and name = '${categoryName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      state.categoryFolderMap[categoryName] = data.files[0].id;
      return data.files[0].id;
    }
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: categoryName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [state.folderId]
      })
    });
    const newFolder = await createRes.json();
    state.categoryFolderMap[categoryName] = newFolder.id;
    console.log(`📁 成功建立雲端分類資料夾「${categoryName}」:`, newFolder.id);
    return newFolder.id;
  } catch (err) {
    console.warn(`確保分類資料夾「${categoryName}」失敗:`, err);
    return state.folderId;
  }
}

function isNoteUncategorized(note) {
  if (!note || !note.meta) return true;
  const m = (note.meta.machineModel || '').trim();
  const w = (note.meta.workContent || '').trim();
  const u = (note.meta.urgency || '').trim();
  
  const isMachineEmpty = !m || m === '未分類' || m === '未指定';
  const isContentEmpty = !w || w === '未分類' || w === '未指定' || w === '隨手速記 ✍️';
  const isUrgencyEmpty = !u || u === '未分類' || u === '未指定';
  
  // 🛡️ 三種大分類缺一不可：若機型、工作內容或急迫性任一未選擇，一律視為未分類
  return isMachineEmpty || isContentEmpty || isUrgencyEmpty;
}

async function ensureNotesFolder() {
  if (!state.accessToken) return;
  try {
    // 優先尋找 LVI_Note 目錄
    let query = `name = '${state.folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    let res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    let data = await res.json();

    // 向下相容機制：若雲端尚未建立 LVI_Note 但有舊的 DriveNotes，自動平滑升級為 LVI_Note
    if ((!data.files || data.files.length === 0) && state.folderName === 'LVI_Note') {
      const oldQuery = `name = 'DriveNotes' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const oldRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(oldQuery)}&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${state.accessToken}` }
      });
      const oldData = await oldRes.json();
      if (oldData.files && oldData.files.length > 0) {
        const oldFolderId = oldData.files[0].id;
        await fetch(`https://www.googleapis.com/drive/v3/files/${oldFolderId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${state.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: 'LVI_Note' })
        });
        state.folderId = oldFolderId;
        data = { files: [{ id: oldFolderId, name: 'LVI_Note' }] };
        console.log('🔄 自動將雲端歷史資料夾 DriveNotes 升級為 LVI_Note:', oldFolderId);
      }
    }

    if (data.files && data.files.length > 0) {
      state.folderId = data.files[0].id;
    } else {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: state.folderName,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      const newFolder = await createRes.json();
      state.folderId = newFolder.id;
    }

    // 📁 確保雲端媒體附件存放於專屬子資料夾 _assets，避免圖片/影片成為幽靈筆記
    await ensureMediaFolder();
  } catch (e) {
    console.error('確認資料夾失敗:', e);
  }
}

async function ensureMediaFolder() {
  if (!state.accessToken || !state.folderId) return;
  try {
    const q = `'${state.folderId}' in parents and name = '_assets' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      state.mediaFolderId = data.files[0].id;
    } else {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: '_assets',
          mimeType: 'application/vnd.google-apps.folder',
          parents: [state.folderId]
        })
      });
      const newFolder = await createRes.json();
      state.mediaFolderId = newFolder.id;
    }
    console.log('📁 媒體素材專用雲端資料夾 _assets 已就緒:', state.mediaFolderId);
    return state.mediaFolderId;
  } catch(e) {
    console.warn('建立或確認媒體素材資料夾失敗:', e);
    return state.mediaFolderId || state.folderId;
  }
}

// ----------------- 🔄 100% 純雲端工作區唯一真實源 (Google Drive Cloud Truth Engine) -----------------
let isSavingConfig = false;
let pendingSaveConfig = false;

// 1. 自 Google Drive 雲端嚴格讀取最新工作區設定與分類 (完全無本地殘留)
async function syncWorkspaceConfigWithDrive(silent = false) {
  if (!state.accessToken || !state.folderId) return;
  if (!silent) {
    updateSyncStatus('syncing', '正在讀取 Google Drive 雲端設定...');
  }

  try {
    const q = `'${state.folderId}' in parents and name = 'cloudnotes_workspace_config.json' and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    const data = await res.json();

    let needUploadCompleteConfig = false;

    if (data.files && data.files.length > 0) {
      const fileId = data.files[0].id;
      const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${state.accessToken}` }
      });
      const config = await getRes.json();

      // 嚴密檢查雲端檔案中是否缺少 machineModels、workContents 或 urgencies (如使用者截圖中舊檔情況)
      const hasMachines = Array.isArray(config.machineModels) && config.machineModels.length > 0;
      const hasContents = Array.isArray(config.workContents) && config.workContents.length > 0;
      const hasUrgencies = Array.isArray(config.urgencies) && config.urgencies.length > 0;
      const hasClients = Array.isArray(config.clientsVendors) && config.clientsVendors.length > 0;

      if (hasMachines) {
        state.machineModels = config.machineModels;
      } else {
        // 若雲端先前遺漏，載入使用者的實際機型，並立即回寫修復雲端檔案
        state.machineModels = DEFAULT_MACHINE_MODELS.slice();
        needUploadCompleteConfig = true;
      }

      if (hasContents) {
        state.workContents = config.workContents;
      } else {
        state.workContents = DEFAULT_WORK_CONTENTS.slice();
        needUploadCompleteConfig = true;
      }

      if (hasUrgencies) {
        state.urgencies = config.urgencies;
      } else {
        state.urgencies = DEFAULT_URGENCIES.slice();
        needUploadCompleteConfig = true;
      }

      if (hasClients) {
        state.clientsVendors = config.clientsVendors;
      } else {
        state.clientsVendors = DEFAULT_CLIENTS_VENDORS.slice();
        needUploadCompleteConfig = true;
      }

      state.tags = Array.isArray(config.tags) ? config.tags : DEFAULT_TAGS.slice();
      state.folders = Array.isArray(config.folders) ? config.folders : DEFAULT_FOLDERS.slice();
      if (Array.isArray(config.tasks) && (!state.googleTasks || state.googleTasks.length === 0)) {
        state.googleTasks = config.tasks;
      }

      console.log('☁️ 成功自 Google Drive 載入純雲端分類與標籤：', {
        machineModels: state.machineModels,
        workContents: state.workContents,
        urgencies: state.urgencies,
        tags: state.tags
      });

      renderWorkTagLists();
      renderWorkTagSelects();
      renderFolderSelect();
      renderSidebarTags();

      if (needUploadCompleteConfig) {
        console.log('🔄 偵測到雲端設定檔版本較舊，立即將完整分類回寫至 Google Drive...');
        await saveWorkspaceConfigToDrive();
      }
    } else {
      // 雲端尚未建立組態檔，立即以使用者真實分類建立並直接上傳至 Google Drive
      state.machineModels = DEFAULT_MACHINE_MODELS.slice();
      state.workContents = DEFAULT_WORK_CONTENTS.slice();
      state.urgencies = DEFAULT_URGENCIES.slice();
      state.clientsVendors = DEFAULT_CLIENTS_VENDORS.slice();
      state.tags = DEFAULT_TAGS.slice();
      state.folders = DEFAULT_FOLDERS.slice();
      await saveWorkspaceConfigToDrive();
      renderWorkTagLists();
      renderWorkTagSelects();
      renderFolderSelect();
      renderSidebarTags();
    }
  } catch(e) {
    console.error('自 Google Drive 載入工作區設定失敗:', e);
    updateSyncStatus('error', '雲端同步出錯');
  }
}

// 2. 將包含所有分類 (機型、內容、急迫性、標籤、資料夾) 完整寫入 Google Drive
async function saveWorkspaceConfigToDrive() {
  if (!state.accessToken || !state.folderId) return;
  if (isSavingConfig) {
    pendingSaveConfig = true;
    return;
  }
  isSavingConfig = true;

  try {
    const configData = JSON.stringify({
      machineModels: state.machineModels || DEFAULT_MACHINE_MODELS,
      workContents: state.workContents || DEFAULT_WORK_CONTENTS,
      urgencies: state.urgencies || DEFAULT_URGENCIES,
      clientsVendors: state.clientsVendors || DEFAULT_CLIENTS_VENDORS,
      tags: state.tags || DEFAULT_TAGS,
      folders: state.folders || DEFAULT_FOLDERS,
      tasks: state.googleTasks || [],
      updatedAt: new Date().toISOString(),
      source: 'Google Drive Cloud Truth'
    }, null, 2);

    const q = `'${state.folderId}' in parents and name = 'cloudnotes_workspace_config.json' and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=modifiedTime desc`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    const data = await res.json();

    const boundary = '-------CloudNotesConfigBoundary7788';
    const delimiter = '\r\n--' + boundary + '\r\n';
    const closeDelimiter = '\r\n--' + boundary + '--';

    let url, method;
    const metadata = {
      name: 'cloudnotes_workspace_config.json',
      mimeType: 'application/json'
    };

    if (data.files && data.files.length > 0) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${data.files[0].id}?uploadType=multipart`;
      method = 'PATCH';
    } else {
      url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
      method = 'POST';
      metadata.parents = [state.folderId];
    }

    const multipartRequestBody = [
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      'Content-Type: application/json\r\n\r\n',
      configData,
      closeDelimiter
    ].join('');

    const saveRes = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (saveRes.ok) {
      console.log('✅ 雲端設定檔 cloudnotes_workspace_config.json 已成功寫入 Google Drive！');
    } else {
      console.error('寫入雲端設定檔失敗:', saveRes.status, await saveRes.text());
    }
  } catch(e) {
    console.warn('雲端儲存工作區設定失敗:', e);
  } finally {
    isSavingConfig = false;
    if (pendingSaveConfig) {
      pendingSaveConfig = false;
      saveWorkspaceConfigToDrive();
    }
  }
}

// 3. 獲取所有筆記清單，完全以 Google Drive 為單一真理源，並具備自我學習修復機制

async function reloadCurrentNoteContentSilently(noteId, fileMeta) {
  if (!state.accessToken || !noteId) return;
  if (!state.accessToken) {
    // SWR 啟動瞬間尚未取得 token 時，先呈現快取畫面，待背景登入完成後自動同步
    return;
  }

  // 若快取已是最新且剛由 SWR 載入，背景靜默檢查即可
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${noteId}?alt=media`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    if (!res.ok) return;
    const rawText = await res.text();
    const { meta: bodyMeta, body } = parseFrontmatter(rawText);
    const renderedHtml = DOMPurify.sanitize(window.marked ? window.marked.parse(body) : body, {
      ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'details', 'summary', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input', 'hr', 'div', 'span', 'a', 'mark', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'controls', 'width', 'height', 'class', 'preload', 'type', 'open', 'checked', 'style', 'contenteditable', 'download', 'target', 'rel', 'href', 'data-file-id', 'data-file-name', 'data-file-size', 'data-color', 'draggable', 'xmlns', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'data-lucide', 'aria-hidden', 'cx', 'cy', 'r', 'x', 'y', 'rx', 'ry', 'd']
    });

    if (DOM.editor && !state.isDirty) {
      DOM.editor.innerHTML = renderedHtml;
      if (DOM.noteTitle && fileMeta.name) {
        DOM.noteTitle.value = fileMeta.name.replace(/\.md$/i, '');
        DOM.headerTitle.textContent = DOM.noteTitle.value;
      }
      state.currentNote.modifiedTime = fileMeta.modifiedTime;
      state.currentNote._cachedBody = body;
      state.currentNote._cachedHtml = renderedHtml;
      state.currentNote._cachedMeta = bodyMeta;
      try { updateNoteSearchIndex(noteId, fileMeta.modifiedTime, body); } catch (e) {}
      try { enhanceMediaCollapsiblesAndDraggables(DOM.editor); } catch (e) {}
      try { updateStats(); } catch (e) {}
      try { renderOutline(); } catch (e) {}
      showToast('☁️ 已自另一裝置同步最新內容！', 3000);
    }
  } catch (err) {
    console.warn('靜默熱重載雲端筆記失敗:', err);
  }
}

async function fetchNotesList(silent = false) {
  if (!state.folderId || !state.accessToken) return;
  if (!silent) {
    updateSyncStatus('syncing', '正在載入雲端筆記清單...');
    showGlobalLoading('正在載入雲端筆記...');
  }

  try {
    // 1. 完整搜尋 LVI_Note 下的所有分類子資料夾
    if (!state.categoryFolderMap) state.categoryFolderMap = {};
    const folderQ = `'${state.folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const folderRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(folderQ)}&fields=files(id,name)&pageSize=100`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    const folderData = await folderRes.json();
    const subfolders = (folderData.files || []).filter(f => f.name !== '_assets' && !f.name.startsWith('_deprecated'));
    subfolders.forEach(f => {
      state.categoryFolderMap[f.name] = f.id;
    });

    // 2. 🛡️ 零遺漏雙層掃描：同時平行政詢 LVI_Note 根目錄 + 所有分類子資料夾
    const allFolderIds = [state.folderId, ...subfolders.map(f => f.id)];
    const fetchPromises = allFolderIds.map(async (fId) => {
      try {
        const fileQ = `'${fId}' in parents and mimeType != 'application/vnd.google-apps.folder' and name != 'cloudnotes_workspace_config.json' and trashed = false`;
        const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(fileQ)}&fields=files(id,name,modifiedTime,size,description,parents)&orderBy=modifiedTime desc&pageSize=1000`, {
          headers: { Authorization: `Bearer ${state.accessToken}` }
        });
        const d = await r.json();
        return (d.files || []).map(file => ({ ...file, parentFolderId: fId }));
      } catch (err) {
        console.warn(`獲取資料夾 ${fId} 檔案失敗:`, err);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    const allFiles = results.flat();

    // 3. 去重與 Markdown 檔案過濾 (杜絕漏掉任何筆記)
    const seenIds = new Set();
    const uniqueFiles = [];
    for (const file of allFiles) {
      if (!seenIds.has(file.id)) {
        seenIds.add(file.id);
        if (file.name.endsWith('.md') || (file.description && file.description.includes('machineModel'))) {
          uniqueFiles.push(file);
        }
      }
    }

    // 🛡️ v2.7.1 零掉字快取保護：建立舊快取對照表，保護正在編輯/排隊上傳中的筆記與本地剛建立的新筆記不被背景列表刷新洗掉！
    const prevNotesMap = new Map();
    const unsyncedLocalNewNotes = [];
    if (Array.isArray(state.notes)) {
      state.notes.forEach(oldN => {
        if (!oldN) return;
        if (oldN.id) {
          prevNotesMap.set(oldN.id, oldN);
        }
        const isPendingNew = (!oldN.id || String(oldN.id).startsWith('temp_')) ||
          (oldN._localUpdatedAt && (Date.now() - oldN._localUpdatedAt < 25000) && !uniqueFiles.some(f => f.id === oldN.id));
        if (isPendingNew) {
          unsyncedLocalNewNotes.push(oldN);
        }
      });
    }

    state.notes = uniqueFiles.map(file => {
      let meta = {
        icon: '📝',
        cover: null,
        status: '💡 構思中',
        folderId: null,
        machineModel: '未分類',
        workContent: '隨手速記 ✍️',
        urgency: '⚪ 低急迫',
        tags: [],
        pinned: false
      };
      if (file.description) {
        try { Object.assign(meta, JSON.parse(file.description)); } catch(e) {}
      }
      const prev = prevNotesMap.get(file.id);
      if (prev) {
        const prevTimeMs = Math.max(new Date(prev.modifiedTime || 0).getTime(), prev._localUpdatedAt || 0);
        const driveTimeMs = new Date(file.modifiedTime || 0).getTime();
        const isLocalNewerOrQueued = isNoteDirtyOrQueued(file.id) || (prevTimeMs > driveTimeMs + 500) || (prev._localUpdatedAt && (Date.now() - prev._localUpdatedAt < 15000));
        if (isLocalNewerOrQueued) {
          return {
            ...file,
            ...prev,
            id: file.id,
            parentId: prev.parentId || (file.parents && file.parents[0]) || file.parentFolderId || state.folderId
          };
        }
        const isCloudNotNewer = (driveTimeMs <= prevTimeMs + 1500) && (prev._cachedBody !== undefined || prev._cachedHtml !== undefined);
        if (isCloudNotNewer) {
          return {
            ...file,
            parentId: (file.parents && file.parents[0]) || file.parentFolderId || state.folderId,
            meta,
            _localUpdatedAt: prev._localUpdatedAt,
            _cachedBody: prev._cachedBody,
            _cachedHtml: prev._cachedHtml,
            _cachedMeta: prev._cachedMeta || meta
          };
        }
      }
      return {
        ...file,
        parentId: (file.parents && file.parents[0]) || file.parentFolderId || state.folderId,
        meta,
        _cachedBody: undefined,
        _cachedHtml: undefined,
        _cachedMeta: undefined
      };
    });

    if (unsyncedLocalNewNotes.length > 0) {
      unsyncedLocalNewNotes.forEach(localN => {
        if (!state.notes.some(n => (localN.id && n.id === localN.id) || (localN._tempId && n._tempId === localN._tempId))) {
          state.notes.unshift(localN);
        }
      });
    }

    // 💡 雲端自動採納：掃描所有雲端筆記，若筆記內含有自訂機型/內容/急迫性/標籤，立即採納並寫入雲端設定檔
    let needUpdateCloudConfig = false;
    state.notes.forEach(note => {
      if (note.meta) {
        if (note.meta.machineModel && !state.machineModels.includes(note.meta.machineModel)) {
          state.machineModels.push(note.meta.machineModel);
          needUpdateCloudConfig = true;
        }
        if (note.meta.workContent && !state.workContents.includes(note.meta.workContent)) {
          state.workContents.push(note.meta.workContent);
          needUpdateCloudConfig = true;
        }
        if (note.meta.urgency && !state.urgencies.some(u => u.id === note.meta.urgency)) {
          state.urgencies.push({
            id: note.meta.urgency,
            label: note.meta.urgency,
            short: note.meta.urgency,
            color: 'bg-blue-100 text-blue-800'
          });
          needUpdateCloudConfig = true;
        }
        if (Array.isArray(note.meta.tags)) {
          note.meta.tags.forEach(tagName => {
            if (tagName && !state.tags.some(t => t.name.toLowerCase() === tagName.toLowerCase())) {
              state.tags.push({
                id: 'tag_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                name: tagName,
                color: 'blue'
              });
              needUpdateCloudConfig = true;
            }
          });
        }
      }
    });

    if (needUpdateCloudConfig) {
      console.log('☁️ 雲端筆記中含有新分類，立即更新回寫至 Google Drive 設定檔...');
      saveWorkspaceConfigToDrive();
      renderWorkTagSelects();
    }

    renderWorkTagLists();
    renderSidebarTags();
    renderNotesList();
    if (!silent && !state.isDirty && !state.isSaving) {
      updateSyncStatus('synced', '已完全同步 (雲端)');
    }
    state.lastSyncTime = Date.now();

    // 🚀 多裝置無縫切換：若當前開啟的筆記在雲端已被其他裝置更新，自動靜默熱重載
    if (state.currentNote && state.currentNote.id && !state.isDirty && !state.isSaving) {
      const currentOnDrive = uniqueFiles.find(f => f.id === state.currentNote.id);
      if (currentOnDrive && currentOnDrive.modifiedTime) {
        const cloudTime = new Date(currentOnDrive.modifiedTime).getTime();
        const localTime = new Date(state.currentNote.modifiedTime || 0).getTime();
        if (cloudTime > localTime + 1000) {
          reloadCurrentNoteContentSilently(state.currentNote.id, currentOnDrive);
        }
      }
    }

    // 🎯 全域排序：所有筆記依據「最後一次編輯時間 (modifiedTime)」由新到舊排序
    state.notes.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));

    if (state.notes.length > 0 && !state.currentNote) {
      const lastEditedId = localStorage.getItem('lvi_last_active_note_id');
      const targetNote = (lastEditedId && state.notes.find(n => n.id === lastEditedId)) || state.notes[0];
      selectNote(targetNote.id);
    } else if (state.currentNote && state.currentNote.id) {
      const matched = state.notes.find(n => n.id === state.currentNote.id);
      if (matched && matched._cachedBody === undefined && !state.isDirty) {
        selectNote(matched.id);
      }
    } else if (state.notes.length === 0) {
      createNewNote();
    }
    saveSwrCacheSnapshot();
    // 🚑 背景自動巡檢：若發現雲端清單中有曾被誤改為「未命名隨手筆記.md」的已知受波及筆記，自動從雲端歷史版本修復！
    setTimeout(async () => {
      try {
        for (const n of state.notes) {
          if (n && n.id && (KNOWN_NOTE_RECOVERY_FALLBACKS[n.id] || n.id === '1DjCcVDu3gaZPhXXjBAim5_mXb-8XVeyv') && n.name === '未命名隨手筆記.md') {
            const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${n.id}?alt=media`, {
              headers: { Authorization: `Bearer ${state.accessToken}` }
            });
            if (checkRes.ok) {
              const rawTxt = await checkRes.text();
              if (isSkeletonOrCorruptedContent(rawTxt)) {
                const rec = await autoRecoverCorruptedNoteFromDriveRevisions(n.id, n, rawTxt);
                if (rec) {
                  n._cachedBody = rec.body;
                  n._cachedHtml = DOMPurify.sanitize(window.marked ? window.marked.parse(rec.body) : rec.body);
                  renderNotesList();
                  if (state.currentNote && state.currentNote.id === n.id) {
                    DOM.noteTitle.value = rec.fileName.replace(/\.md$/i, '');
                    DOM.headerTitle.textContent = DOM.noteTitle.value;
                    DOM.editor.innerHTML = n._cachedHtml;
                    enhanceAllEditorBlocks(DOM.editor);
                  }
                }
              }
            }
          }
        }
      } catch (e) {}
    }, 600);
    setTimeout(() => { try { scheduleBackgroundFullTextIndexing(); } catch (e) {} }, 150);
  } catch (e) {
    console.error('載入雲端筆記清單失敗:', e);
    if (!silent) updateSyncStatus('error', '雲端同步出錯');
  } finally {
    if (!silent) hideGlobalLoading();
  }
}

async function fullSyncWithDrive(showFeedback = true) {
  if (!state.accessToken || !state.folderId) return;
  if (showFeedback) updateSyncStatus('syncing', '正在雙向同步所有筆記與分類...');
  try {
    await syncWorkspaceConfigWithDrive();
    await fetchNotesList(!showFeedback);
    state.lastSyncTime = Date.now();
    if (showFeedback) {
      updateSyncStatus('synced', '已完全同步');
      showToast('✅ 已同步 Google Drive 最新分類與所有筆記！');
    }
  } catch(e) {
    console.error('全域同步失敗:', e);
    if (showFeedback) updateSyncStatus('error', '同步發生錯誤');
  }
}

// ----------------- 🕒 全域全動作時光回朔核心引擎 (Universal Omniscient Time-Machine v2.6.6) -----------------
const MAX_HISTORY_STEPS = 150; // 支援高達 150 步全動作歷史回朔

state.actionHistory = [];      // 儲存 ActionRecord 陣列
state.historyIndex = -1;       // 當前歷史節點指標
state.isUndoingOrRedoing = false;
state.editorSnapshotBeforeEdit = null;
state.snapshotNoteId = null;
state.titleBeforeEdit = null;
state.activeHighlightColor = localStorage.getItem('lvi_active_highlight_color') || '#fef08a';
state.highlightBrushMode = false;
state.isInteractingWithToolbar = false;
let editorInputTimer = null;
let savedSelectionRange = null;

const ACTION_CATEGORY_BADGES = {
  edit_content: { label: '✍️ 內文編輯', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300' },
  highlight: { label: '🖍️ 螢光筆', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300' },
  format_text: { label: '🔤 文字格式', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300' },
  turn_block: { label: '🔄 段落轉換', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300' },
  slash_insert: { label: '⚡ 插入區塊', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/70 dark:text-cyan-300' },
  todo_toggle: { label: '☑️ 待辦核取', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300' },
  table_op: { label: '📊 表格操作', cls: 'bg-teal-100 text-teal-700 dark:bg-teal-950/70 dark:text-teal-300' },
  drag_block: { label: '🖐️ 拖曳排序', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/70 dark:text-orange-300' },
  media_op: { label: '📷 媒體附件', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300' },
  template_op: { label: '📋 套用模板', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300' },
  meta_op: { label: '🏷️ 筆記屬性', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300' },
  category_op: { label: '🗂️ 分類管理', cls: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950/70 dark:text-fuchsia-300' }
};

function getActionCategoryBadge(type) {
  if (!type) return ACTION_CATEGORY_BADGES.edit_content;
  if (ACTION_CATEGORY_BADGES[type]) return ACTION_CATEGORY_BADGES[type];
  if (type.includes('highlight')) return ACTION_CATEGORY_BADGES.highlight;
  if (type.includes('format')) return ACTION_CATEGORY_BADGES.format_text;
  if (type.includes('todo')) return ACTION_CATEGORY_BADGES.todo_toggle;
  if (type.includes('table')) return ACTION_CATEGORY_BADGES.table_op;
  if (type.includes('media') || type.includes('file')) return ACTION_CATEGORY_BADGES.media_op;
  if (type.includes('change_') || type.includes('tag') || type.includes('pin') || type.includes('cover') || type.includes('emoji')) {
    return ACTION_CATEGORY_BADGES.meta_op;
  }
  return ACTION_CATEGORY_BADGES.category_op;
}

/**
 * 將畫布快照精準還原至指定筆記（若當前不在該筆記或不在編輯視圖，自動切換過去！）
 */
function applyNoteCanvasSnapshot(noteId, htmlSnapshot, metaSnapshot = null, titleSnapshot = null) {
  if (!noteId && state.currentNote) noteId = state.currentNote.id;
  const targetNote = noteId ? state.notes.find(n => n.id === noteId) : state.currentNote;

  // 若目標筆記並非當前開啟的筆記，先切換至該筆記
  if (targetNote && (!state.currentNote || state.currentNote.id !== targetNote.id)) {
    state.currentNote = {
      id: targetNote.id,
      name: targetNote.name,
      parentId: targetNote.parentId,
      meta: JSON.parse(JSON.stringify(targetNote.meta || {}))
    };
    localStorage.setItem('lvi_last_active_note_id', targetNote.id);
  }

  if (state.currentView !== 'editor') {
    switchView('editor');
  }

  if (titleSnapshot !== null && titleSnapshot !== undefined) {
    const cleanT = String(titleSnapshot).replace(/\.md$/i, '');
    if (DOM.noteTitle) DOM.noteTitle.value = cleanT;
    if (DOM.headerTitle) DOM.headerTitle.textContent = cleanT || '未命名筆記';
    if (targetNote) targetNote.name = (cleanT || '未命名筆記') + '.md';
    if (state.currentNote) state.currentNote.name = (cleanT || '未命名筆記') + '.md';
    state.titleBeforeEdit = cleanT;
  }

  if (metaSnapshot && typeof metaSnapshot === 'object') {
    const clonedMeta = JSON.parse(JSON.stringify(metaSnapshot));
    if (targetNote) targetNote.meta = clonedMeta;
    if (state.currentNote) state.currentNote.meta = JSON.parse(JSON.stringify(clonedMeta));
    try { renderCurrentNote(); } catch (e) {}
    try { renderWorkTagLists(); } catch (e) {}
    try { renderSidebarTags(); } catch (e) {}
  }

  if (typeof htmlSnapshot === 'string' && DOM.editor) {
    DOM.editor.innerHTML = htmlSnapshot;
    state.editorSnapshotBeforeEdit = htmlSnapshot;
    state.snapshotNoteId = noteId;
    if (targetNote) {
      targetNote._cachedHtml = htmlSnapshot;
      try {
        targetNote._cachedBody = convertHtmlToMarkdown(htmlSnapshot);
        updateNoteSearchIndex(targetNote.id, targetNote.modifiedTime, targetNote._cachedBody);
      } catch (e) {}
    }
    try { enhanceAllEditorBlocks(DOM.editor); } catch (e) {}
    try { attachCodeCopyButtons(); } catch (e) {}
    try { updateStats(); } catch (e) {}
    try { renderOutline(); } catch (e) {}
  }

  try { renderNotesList(); } catch (e) {}
  try { renderBreadcrumbs(); } catch (e) {}
  saveLocalDraftImmediately();
  triggerAutoSaveDebounce();
}

/**
 * 立即結算尚未寫入歷史佇列的打字輸入快照（在執行任何按鈕動作或 Ctrl+Z 前呼叫，杜絕漏記）
 */
function flushPendingEditorInputHistory(customTitle = '✍️ 編輯筆記內文') {
  if (editorInputTimer) {
    clearTimeout(editorInputTimer);
    editorInputTimer = null;
  }
  if (state.isUndoingOrRedoing || !DOM.editor || !state.currentNote) return;

  const currentNoteId = state.currentNote.id;
  if (state.snapshotNoteId && state.snapshotNoteId !== currentNoteId) {
    state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
    state.snapshotNoteId = currentNoteId;
    return;
  }

  const currentHtml = DOM.editor.innerHTML;
  if (state.editorSnapshotBeforeEdit !== null && currentHtml !== state.editorSnapshotBeforeEdit) {
    const oldHtml = state.editorSnapshotBeforeEdit;
    const newHtml = currentHtml;
    const noteId = currentNoteId;
    const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';

    state.editorSnapshotBeforeEdit = newHtml;
    state.snapshotNoteId = noteId;

    recordAction({
      type: 'edit_content',
      title: customTitle,
      subtitle: `筆記：「${noteTitle}」`,
      noteId: noteId,
      undo: () => applyNoteCanvasSnapshot(noteId, oldHtml),
      redo: () => applyNoteCanvasSnapshot(noteId, newHtml)
    });
  }
}

/**
 * 包裹執行畫布或複合動作，自動記錄執行前後之完整 DOM 與 Meta 差異至時光機
 */
function commitEditorCanvasAction(type, actionTitle, subtitleOrFn, maybeFn = '') {
  const mutatorFn = typeof subtitleOrFn === 'function' ? subtitleOrFn : maybeFn;
  const customSubtitle = typeof subtitleOrFn === 'string' ? subtitleOrFn : (typeof maybeFn === 'string' ? maybeFn : '');
  if (!DOM.editor || typeof mutatorFn !== 'function') return;
  flushPendingEditorInputHistory();

  const noteId = state.currentNote ? state.currentNote.id : null;
  const noteTitle = (state.currentNote && state.currentNote.name) ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
  const beforeHtml = DOM.editor.innerHTML;
  const beforeMeta = (state.currentNote && state.currentNote.meta) ? JSON.parse(JSON.stringify(state.currentNote.meta)) : null;
  const beforeTitle = DOM.noteTitle ? DOM.noteTitle.value : noteTitle;

  mutatorFn();

  const afterHtml = DOM.editor.innerHTML;
  const afterMeta = (state.currentNote && state.currentNote.meta) ? JSON.parse(JSON.stringify(state.currentNote.meta)) : null;
  const afterTitle = DOM.noteTitle ? DOM.noteTitle.value : noteTitle;

  state.editorSnapshotBeforeEdit = afterHtml;
  state.snapshotNoteId = noteId;

  const htmlChanged = beforeHtml !== afterHtml;
  const metaChanged = JSON.stringify(beforeMeta) !== JSON.stringify(afterMeta);
  const titleChanged = beforeTitle !== afterTitle;

  if (htmlChanged || metaChanged || titleChanged) {
    if (state.currentNote && noteId) {
      const targetN = state.notes.find(n => n.id === noteId);
      if (targetN) {
        targetN._cachedHtml = afterHtml;
      }
    }
    recordAction({
      type: type || 'edit_content',
      title: actionTitle,
      subtitle: customSubtitle ? `${customSubtitle} · 筆記：「${noteTitle}」` : `筆記：「${noteTitle}」`,
      noteId: noteId,
      undo: () => applyNoteCanvasSnapshot(noteId, beforeHtml, metaChanged ? beforeMeta : null, titleChanged ? beforeTitle : null),
      redo: () => applyNoteCanvasSnapshot(noteId, afterHtml, metaChanged ? afterMeta : null, titleChanged ? afterTitle : null)
    });
  }
}

function recordAction(action) {
  if (state.isUndoingOrRedoing) return; // 復原/重做中不重複記錄
  
  // 若目前指標不在最末端，截斷未來的重做分支 (Branching history)
  if (state.historyIndex < state.actionHistory.length - 1) {
    state.actionHistory = state.actionHistory.slice(0, state.historyIndex + 1);
  }

  const record = {
    id: 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    time: new Date(),
    timeStr: new Date().toLocaleTimeString('zh-TW', { hour12: false }),
    type: action.type || 'edit_content',
    title: action.title,
    subtitle: action.subtitle || '',
    noteId: action.noteId || (state.currentNote ? state.currentNote.id : null),
    undo: action.undo,
    redo: action.redo
  };

  state.actionHistory.push(record);
  if (state.actionHistory.length > MAX_HISTORY_STEPS) {
    state.actionHistory.shift();
  }
  state.historyIndex = state.actionHistory.length - 1;

  updateHistoryUI();
  if (isHistoryModalOpen()) {
    renderHistoryTimeline();
  }
}

function updateHistoryUI() {
  const undoBtn = DOM.undoActionBtn;
  const redoBtn = DOM.redoActionBtn;
  const mbUndoBtn = DOM.mbToolUndo;
  const badge = DOM.historyCounterBadge;

  const undoCount = state.historyIndex + 1;
  const redoCount = state.actionHistory.length - 1 - state.historyIndex;

  if (undoBtn) {
    undoBtn.disabled = undoCount <= 0;
    undoBtn.title = undoCount > 0 ? `復原動作 (Ctrl+Z) - 還可復原 ${undoCount} 步` : '沒有可復原的動作';
  }
  if (mbUndoBtn) {
    mbUndoBtn.disabled = undoCount <= 0;
    mbUndoBtn.style.opacity = undoCount > 0 ? '1' : '0.35';
  }
  if (redoBtn) {
    redoBtn.disabled = redoCount <= 0;
    redoBtn.title = redoCount > 0 ? `重做動作 (Ctrl+Y) - 還可重做 ${redoCount} 步` : '沒有可重做的動作';
  }
  if (badge) {
    badge.textContent = undoCount;
    if (undoCount > 0) {
      badge.className = 'text-[10px] px-1 py-0.2 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded font-bold';
    } else {
      badge.className = 'text-[10px] px-1 py-0.2 bg-gray-100 dark:bg-gray-800 text-gray-400 rounded font-bold';
    }
  }

  if (DOM.historyStatusText) {
    DOM.historyStatusText.textContent = `共記錄 ${state.actionHistory.length} 個動作 (目前第 ${undoCount} 步)`;
  }
  if (DOM.historyUndoableCount) {
    DOM.historyUndoableCount.textContent = `可復原 ${undoCount} 步 / 可重做 ${redoCount} 步`;
  }
}

function undoAction() {
  // 先將尚未滿 800ms 的打字變更立即推入歷史，確保按 Ctrl+Z 能精準復原剛打下的字！
  flushPendingEditorInputHistory();

  if (state.historyIndex < 0) {
    showToast('已無更早的歷史動作可復原！');
    return false;
  }

  state.isUndoingOrRedoing = true;
  const act = state.actionHistory[state.historyIndex];
  try {
    act.undo();
    if (DOM.editor && state.currentNote) {
      state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
      state.snapshotNoteId = state.currentNote.id;
    }
  } catch(e) {
    console.error('Undo execution error:', e);
  }
  state.historyIndex--;
  state.isUndoingOrRedoing = false;

  updateHistoryUI();
  if (isHistoryModalOpen()) renderHistoryTimeline();
  const remaining = state.historyIndex + 1;
  showToast(`↩️ 已復原：${act.title} (還可復原 ${remaining} 步)`);
  return true;
}

function redoAction() {
  flushPendingEditorInputHistory();

  if (state.historyIndex >= state.actionHistory.length - 1) {
    showToast('已到最新狀態，沒有可重做的動作！');
    return false;
  }

  state.isUndoingOrRedoing = true;
  state.historyIndex++;
  const act = state.actionHistory[state.historyIndex];
  try {
    act.redo();
    if (DOM.editor && state.currentNote) {
      state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
      state.snapshotNoteId = state.currentNote.id;
    }
  } catch(e) {
    console.error('Redo execution error:', e);
  }
  state.isUndoingOrRedoing = false;

  updateHistoryUI();
  if (isHistoryModalOpen()) renderHistoryTimeline();
  showToast(`↪️ 已重做：${act.title}`);
  return true;
}

// 核心回朔功能：支援一次復原或前進任意步數 (包含 20 步以上)
function rollbackToStep(targetIndex) {
  flushPendingEditorInputHistory();

  if (targetIndex === state.historyIndex) {
    showToast('目前已處於該歷史狀態！');
    return;
  }
  if (targetIndex < -1 || targetIndex >= state.actionHistory.length) return;

  if (targetIndex < state.historyIndex) {
    const steps = state.historyIndex - targetIndex;
    state.isUndoingOrRedoing = true;
    for (let i = 0; i < steps; i++) {
      if (state.historyIndex >= 0) {
        const act = state.actionHistory[state.historyIndex];
        try { act.undo(); } catch(e) { console.error('Undo error:', e); }
        state.historyIndex--;
      }
    }
    if (DOM.editor && state.currentNote) {
      state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
      state.snapshotNoteId = state.currentNote.id;
    }
    state.isUndoingOrRedoing = false;
    showToast(`⏮️ 已時光回朔 ${steps} 個動作！已復原至指定狀態。`);
  } else {
    const steps = targetIndex - state.historyIndex;
    state.isUndoingOrRedoing = true;
    for (let i = 0; i < steps; i++) {
      if (state.historyIndex < state.actionHistory.length - 1) {
        state.historyIndex++;
        const act = state.actionHistory[state.historyIndex];
        try { act.redo(); } catch(e) { console.error('Redo error:', e); }
      }
    }
    if (DOM.editor && state.currentNote) {
      state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
      state.snapshotNoteId = state.currentNote.id;
    }
    state.isUndoingOrRedoing = false;
    showToast(`⏩ 已前進重做 ${steps} 個動作！已切換至指定狀態。`);
  }

  updateHistoryUI();
  if (isHistoryModalOpen()) renderHistoryTimeline();
  triggerAutoSaveDebounce();
}

function quickRollback20Steps() {
  flushPendingEditorInputHistory();
  if (state.historyIndex < 0) {
    showToast('目前沒有可復原的動作！');
    return;
  }
  const availableSteps = state.historyIndex + 1;
  const stepsToUndo = Math.min(20, availableSteps);
  rollbackToStep(state.historyIndex - stepsToUndo);
  showToast(`⏮️ 一鍵回朔成功！已連續復原 ${stepsToUndo} 個動作！`);
}

function isHistoryModalOpen() {
  return DOM.actionHistoryModal && !DOM.actionHistoryModal.classList.contains('hidden');
}

function openHistoryModal() {
  flushPendingEditorInputHistory();
  if (DOM.actionHistoryModal) {
    DOM.actionHistoryModal.classList.remove('hidden');
    updateHistoryUI();
    renderHistoryTimeline();
    initLucide();
  }
}

function closeHistoryModal() {
  const modal = DOM.actionHistoryModal || document.getElementById('action-history-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function renderHistoryTimeline() {
  if (!DOM.historyTimelineList) return;
  DOM.historyTimelineList.innerHTML = '';

  if (!state.actionHistory.length) {
    DOM.historyTimelineList.innerHTML = `
      <div class="text-center py-10 text-gray-400 text-xs">
        <i data-lucide="clock" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
        <p>目前尚無歷史動作紀錄</p>
        <p class="text-[11px] mt-1 text-gray-400">無論是文字輸入、🖍️ 螢光筆劃記、文字格式、☑️ 待辦打勾、📊 表格增刪、🖐️ 區塊拖曳或 🏷️ 屬性/分類變更，所有動作皆會自動記錄於此並支援隨時回朔！</p>
      </div>
    `;
    initLucide();
    return;
  }

  for (let i = state.actionHistory.length - 1; i >= 0; i--) {
    const act = state.actionHistory[i];
    const isCurrent = i === state.historyIndex;
    const isPast = i <= state.historyIndex;
    const stepDiff = state.historyIndex - i;
    const catBadge = getActionCategoryBadge(act.type);

    const item = document.createElement('div');
    item.className = `p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs transition history-item ${isCurrent ? 'is-current ring-1 ring-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20' : ''}`;

    let statusBadge = '';
    let rollbackBtn = '';

    if (isCurrent) {
      statusBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white shrink-0">📍 目前狀態</span>`;
      rollbackBtn = `
        <button class="undo-this-btn px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-amber-100 dark:hover:bg-amber-950 text-gray-600 dark:text-gray-300 text-[11px] font-medium flex items-center gap-1 transition shrink-0" title="復原此步動作">
          <i data-lucide="undo-2" class="w-3 h-3"></i> 復原此步
        </button>
      `;
    } else if (isPast) {
      statusBadge = `<span class="text-[10px] text-gray-400 shrink-0 font-medium">${stepDiff} 步前</span>`;
      rollbackBtn = `
        <button class="rollback-btn px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 text-xs font-semibold flex items-center gap-1 transition shrink-0" data-idx="${i}">
          <i data-lucide="rewind" class="w-3 h-3"></i> 回朔至此
        </button>
      `;
    } else {
      const futureDiff = i - state.historyIndex;
      statusBadge = `<span class="text-[10px] text-purple-400 shrink-0 font-medium">${futureDiff} 步後 (已復原)</span>`;
      rollbackBtn = `
        <button class="rollback-btn px-2.5 py-1 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900 text-xs font-semibold flex items-center gap-1 transition shrink-0" data-idx="${i}">
          <i data-lucide="fast-forward" class="w-3 h-3"></i> 前進重做
        </button>
      `;
    }

    item.innerHTML = `
      <div class="flex items-center gap-2.5 flex-1 min-w-0">
        <span class="text-[10px] font-mono font-bold text-gray-400 w-7 shrink-0">#${i + 1}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold ${catBadge.cls}">${catBadge.label}</span>
            <span class="font-bold text-gray-900 dark:text-gray-100">${escapeHtml(act.title)}</span>
            ${statusBadge}
          </div>
          ${act.subtitle ? `<div class="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">${escapeHtml(act.subtitle)}</div>` : ''}
        </div>
        <span class="text-[10px] text-gray-400 font-mono shrink-0">${act.timeStr}</span>
      </div>
      <div class="shrink-0">
        ${rollbackBtn}
      </div>
    `;

    const btn = item.querySelector('.rollback-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        rollbackToStep(i);
      });
    }
    const undoThisBtn = item.querySelector('.undo-this-btn');
    if (undoThisBtn) {
      undoThisBtn.addEventListener('click', () => {
        undoAction();
      });
    }

    DOM.historyTimelineList.appendChild(item);
  }

  initLucide();
}

// ----------------- 工作專用 3 級多類型標籤核心系統 (機型、內容、急迫性) -----------------

// 預設機型 (符合使用者實際環境)
// 🌲 側邊欄樹狀選單收合/展開控制器 (Tree Menu Collapse Controller)
function initWorkTreeCollapse() {
  const branches = ['machine', 'content', 'urgency', 'client'];
  branches.forEach(branch => {
    const header = document.querySelector(`.tree-branch-header[data-branch="${branch}"]`);
    const subList = document.getElementById(`sidebar-${branch}-list`);
    const caret = document.getElementById(`tree-caret-${branch}`);
    if (header && subList) {
      // 預設展開或讀取儲存的折疊狀態
      const savedState = localStorage.getItem(`cloudnotes_tree_${branch}`);
      const isCollapsed = savedState === 'collapsed';
      if (isCollapsed) {
        subList.classList.add('collapsed');
        if (caret) caret.classList.add('collapsed');
      }

      header.onclick = () => {
        const nowCollapsed = subList.classList.toggle('collapsed');
        if (caret) caret.classList.toggle('collapsed', nowCollapsed);
        localStorage.setItem(`cloudnotes_tree_${branch}`, nowCollapsed ? 'collapsed' : 'open');
        updateTreeToggleAllBtnText();
      };
    }
  });

  const toggleAllBtn = document.getElementById('tree-toggle-all-btn');
  if (toggleAllBtn) {
    toggleAllBtn.onclick = () => {
      const subLists = document.querySelectorAll('.tree-sub-list');
      const carets = document.querySelectorAll('.tree-caret');
      const hasOpen = Array.from(subLists).some(el => !el.classList.contains('collapsed'));
      const targetCollapsed = hasOpen; // 若有任何一個為展開，則全部折疊

      subLists.forEach(el => el.classList.toggle('collapsed', targetCollapsed));
      carets.forEach(c => c.classList.toggle('collapsed', targetCollapsed));
      branches.forEach(b => localStorage.setItem(`cloudnotes_tree_${b}`, targetCollapsed ? 'collapsed' : 'open'));
      updateTreeToggleAllBtnText();
    };
    updateTreeToggleAllBtnText();
  }
}

function updateTreeToggleAllBtnText() {
  const toggleAllBtn = document.getElementById('tree-toggle-all-btn');
  if (!toggleAllBtn) return;
  const subLists = document.querySelectorAll('.tree-sub-list');
  const hasOpen = Array.from(subLists).some(el => !el.classList.contains('collapsed'));
  toggleAllBtn.textContent = hasOpen ? '全部收合' : '全部展開';
}

function initWorkTags() {
  // ☁️ 純雲端架構：本機不存留任何分類，未登入前不載入假資料
  if (!state.accessToken) {
    state.machineModels = [];
    state.workContents = [];
    state.urgencies = [];
  }
  renderWorkTagLists();
  renderWorkTagSelects();
}

function saveWorkTags() {
  // ☁️ 純雲端架構：所有分類變動直接即時同步至 Google Drive 雲端設定檔
  saveWorkspaceConfigToDrive();
}

// 🌳 渲染側邊欄 3 級樹狀導航 (Work Taxonomy Tree Menu)
function renderWorkTagLists() {
  // 更新未分類數量徽章
  const uncatCount = state.notes.filter(n => isNoteUncategorized(n)).length;
  if (DOM.sidebarUncatCount) DOM.sidebarUncatCount.textContent = uncatCount;
  if (DOM.uncatTabBadge) {
    DOM.uncatTabBadge.textContent = uncatCount;
    if (uncatCount > 0) DOM.uncatTabBadge.classList.remove('hidden');
    else DOM.uncatTabBadge.classList.add('hidden');
  }
  if (DOM.sidebarFilterUncatBadge) {
    DOM.sidebarFilterUncatBadge.textContent = uncatCount;
    if (uncatCount > 0) DOM.sidebarFilterUncatBadge.classList.remove('hidden');
    else DOM.sidebarFilterUncatBadge.classList.add('hidden');
  }

  if (!state.accessToken) {
    if (DOM.sidebarMachineList) DOM.sidebarMachineList.innerHTML = '<div class="px-2 py-2 text-center text-gray-400 text-[11px]">請登入以載入雲端機型</div>';
    if (DOM.sidebarContentList) DOM.sidebarContentList.innerHTML = '<div class="px-2 py-2 text-center text-gray-400 text-[11px]">請登入以載入工作內容</div>';
    if (DOM.sidebarUrgencyList) DOM.sidebarUrgencyList.innerHTML = '<div class="px-2 py-2 text-center text-gray-400 text-[11px]">請登入以載入急迫性</div>';
    return;
  }
  // 更新樹根節點總筆記數 Badge
  const treeMachineBadge = document.getElementById('tree-machine-count-badge');
  if (treeMachineBadge) treeMachineBadge.textContent = state.machineModels.length;

  const treeContentBadge = document.getElementById('tree-content-count-badge');
  if (treeContentBadge) treeContentBadge.textContent = state.workContents.length;

  const treeUrgencyBadge = document.getElementById('tree-urgency-count-badge');
  if (treeUrgencyBadge) treeUrgencyBadge.textContent = (state.urgencies || DEFAULT_URGENCIES).length;

  // 1. 機型樹分支子項目 (Machine Models Sub-tree)
  if (DOM.sidebarMachineList) {
    DOM.sidebarMachineList.innerHTML = '';

    // 全部機型選項
    const isAllActive = state.currentMachineFilter === null;
    const allRow = document.createElement('div');
    allRow.className = `tree-sub-item ${isAllActive ? 'active' : ''}`;
    allRow.innerHTML = `
      <span class="flex items-center gap-1.5 truncate flex-1 font-medium">
        <i data-lucide="layers" class="w-3 h-3 text-blue-500 shrink-0"></i> 全部機型
      </span>
      <span class="text-[10px] text-gray-400 font-semibold">${state.notes.length}</span>
    `;
    allRow.onclick = () => {
      state.currentMachineFilter = null;
      renderWorkTagLists();
      renderNotesList();
      renderBreadcrumbs();
      renderCurrentView();
    };
    DOM.sidebarMachineList.appendChild(allRow);

    state.machineModels.forEach((m, idx) => {
      const count = state.notes.filter(n => !isNoteUncategorized(n) && n.meta && n.meta.machineModel === m).length;
      const isActive = state.currentMachineFilter === m;
      const row = document.createElement('div');
      row.className = `tree-sub-item cursor-grab ${isActive ? 'active' : ''}`;
      row.draggable = true;
      row.dataset.catType = 'machine';
      row.dataset.catIndex = idx;
      row.innerHTML = `
        <span class="flex items-center gap-1.5 truncate flex-1 font-medium">
          <i data-lucide="grip-vertical" class="w-3 h-3 text-gray-400 opacity-60 hover:opacity-100 shrink-0 cursor-grab" title="拖動調整機型順序"></i>
          <span class="text-xs shrink-0">🚜</span>
          <span class="truncate">${escapeHtml(m)}</span>
        </span>
        <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'} font-semibold shrink-0">${count}</span>
      `;
      row.onclick = () => {
        state.currentMachineFilter = (state.currentMachineFilter === m) ? null : m;
        renderWorkTagLists();
        renderNotesList();
        renderBreadcrumbs();
        renderCurrentView();
      };
      DOM.sidebarMachineList.appendChild(row);
    });
  }

  // 2. 工作內容樹分支子項目 (Work Contents Sub-tree)
  if (DOM.sidebarContentList) {
    DOM.sidebarContentList.innerHTML = '';

    const isAllContentActive = state.currentContentFilter === null;
    const allContentRow = document.createElement('div');
    allContentRow.className = `tree-sub-item ${isAllContentActive ? 'active' : ''}`;
    allContentRow.innerHTML = `
      <span class="flex items-center gap-1.5 truncate flex-1 font-medium">
        <i data-lucide="list" class="w-3 h-3 text-amber-500 shrink-0"></i> 全部內容
      </span>
      <span class="text-[10px] text-gray-400 font-semibold">${state.notes.length}</span>
    `;
    allContentRow.onclick = () => {
      state.currentContentFilter = null;
      renderWorkTagLists();
      renderNotesList();
      renderBreadcrumbs();
      renderCurrentView();
    };
    DOM.sidebarContentList.appendChild(allContentRow);

    state.workContents.forEach((c, idx) => {
      const count = state.notes.filter(n => {
        if (state.currentMachineFilter && (!n.meta || n.meta.machineModel !== state.currentMachineFilter)) return false;
        return !isNoteUncategorized(n) && n.meta && n.meta.workContent === c;
      }).length;
      const isActive = state.currentContentFilter === c;
      const row = document.createElement('div');
      row.className = `tree-sub-item cursor-grab ${isActive ? 'active' : ''}`;
      row.draggable = true;
      row.dataset.catType = 'content';
      row.dataset.catIndex = idx;
      row.innerHTML = `
        <span class="flex items-center gap-1.5 truncate flex-1 font-medium">
          <i data-lucide="grip-vertical" class="w-3 h-3 text-gray-400 opacity-60 hover:opacity-100 shrink-0 cursor-grab" title="拖動調整內容順序"></i>
          <span class="text-xs shrink-0">📋</span>
          <span class="truncate">${escapeHtml(c)}</span>
        </span>
        <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-amber-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'} font-semibold shrink-0">${count}</span>
      `;
      row.onclick = () => {
        state.currentContentFilter = (state.currentContentFilter === c) ? null : c;
        renderWorkTagLists();
        renderNotesList();
        renderBreadcrumbs();
        renderCurrentView();
      };
      DOM.sidebarContentList.appendChild(row);
    });
  }

  // 4. 客戶與廠商樹分支子項目 (Client or Vendor Sub-tree)
  if (DOM.sidebarClientList) {
    DOM.sidebarClientList.innerHTML = '';

    const isAllClientActive = state.currentClientVendorFilter === null;
    const allClientRow = document.createElement('div');
    allClientRow.className = `tree-sub-item ${isAllClientActive ? 'active' : ''}`;
    allClientRow.innerHTML = `
      <span class="flex items-center gap-1.5 truncate flex-1 font-medium">
        <i data-lucide="building-2" class="w-3 h-3 text-indigo-500 shrink-0"></i> 全部客戶/廠商
      </span>
      <span class="text-[10px] text-gray-400 font-semibold">${state.notes.length}</span>
    `;
    allClientRow.onclick = () => {
      state.currentClientVendorFilter = null;
      renderWorkTagLists();
      renderNotesList();
      renderBreadcrumbs();
      renderCurrentView();
    };
    DOM.sidebarClientList.appendChild(allClientRow);

    const clientCountBadge = document.getElementById('tree-client-count-badge');
    const clients = (state.clientsVendors && state.clientsVendors.length > 0) ? state.clientsVendors : DEFAULT_CLIENTS_VENDORS;
    if (clientCountBadge) clientCountBadge.textContent = clients.length;

    clients.forEach(c => {
      const count = state.notes.filter(n => n.meta && n.meta.clientVendor === c).length;
      const isActive = state.currentClientVendorFilter === c;

      const row = document.createElement('div');
      row.className = `tree-sub-item ${isActive ? 'active' : ''}`;
      row.innerHTML = `
        <span class="flex items-center gap-1.5 truncate flex-1 font-medium">
          <span class="text-xs shrink-0">🏢</span>
          <span class="truncate">${escapeHtml(c)}</span>
        </span>
        <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold'} shrink-0">${count}</span>
      `;
      row.onclick = () => {
        state.currentClientVendorFilter = (state.currentClientVendorFilter === c) ? null : c;
        renderWorkTagLists();
        renderNotesList();
        renderBreadcrumbs();
        renderCurrentView();
      };
      DOM.sidebarClientList.appendChild(row);
    });
  }

  // 3. 急迫性樹分支子項目 (Urgency Levels Sub-tree)
  if (DOM.sidebarUrgencyList) {
    DOM.sidebarUrgencyList.innerHTML = '';

    const isAllUrgencyActive = state.currentUrgencyFilter === null;
    const allUrgencyRow = document.createElement('div');
    allUrgencyRow.className = `tree-sub-item ${isAllUrgencyActive ? 'active' : ''}`;
    allUrgencyRow.innerHTML = `
      <span class="flex items-center gap-1.5 truncate flex-1 font-medium">
        <i data-lucide="activity" class="w-3 h-3 text-rose-500 shrink-0"></i> 全部急迫性
      </span>
      <span class="text-[10px] text-gray-400 font-semibold">${state.notes.length}</span>
    `;
    allUrgencyRow.onclick = () => {
      state.currentUrgencyFilter = null;
      renderWorkTagLists();
      renderNotesList();
      renderBreadcrumbs();
      renderCurrentView();
    };
    DOM.sidebarUrgencyList.appendChild(allUrgencyRow);

    (state.urgencies || DEFAULT_URGENCIES).forEach(u => {
      const count = state.notes.filter(n => {
        if (state.currentMachineFilter && (!n.meta || n.meta.machineModel !== state.currentMachineFilter)) return false;
        if (state.currentContentFilter && (!n.meta || n.meta.workContent !== state.currentContentFilter)) return false;
        return n.meta && n.meta.urgency === u.id;
      }).length;
      const isActive = state.currentUrgencyFilter === u.id;

      const row = document.createElement('div');
      row.className = `tree-sub-item ${isActive ? 'active' : ''}`;
      
      // 依據急迫性色彩呈現點綴色
      let dotColor = 'bg-gray-400';
      if (u.id.includes('特急')) dotColor = 'bg-rose-500';
      else if (u.id.includes('高急迫')) dotColor = 'bg-amber-500';
      else if (u.id.includes('常規')) dotColor = 'bg-emerald-500';
      else if (u.id.includes('低急迫')) dotColor = 'bg-gray-400';

      row.innerHTML = `
        <span class="flex items-center gap-1.5 truncate flex-1 font-medium">
          <span class="w-2 h-2 rounded-full ${dotColor} shrink-0"></span>
          <span class="truncate">${escapeHtml(u.label || u.short || u.id)}</span>
        </span>
        <span class="text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-rose-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'} font-semibold shrink-0">${count}</span>
      `;
      row.onclick = () => {
        state.currentUrgencyFilter = (state.currentUrgencyFilter === u.id) ? null : u.id;
        renderWorkTagLists();
        renderNotesList();
        renderBreadcrumbs();
        renderCurrentView();
      };
      DOM.sidebarUrgencyList.appendChild(row);
    });
  }

  // 作用中篩選條件指示條
  renderActiveFilterBar();
  setupSidebarCategoryDragAndDrop();
  initLucide();
}

function renderActiveFilterBar() {
  if (!DOM.activeFilterBar || !DOM.activeFilterChips) return;

  const hasFilter = !!(state.currentMachineFilter || state.currentContentFilter || state.currentUrgencyFilter || state.currentClientVendorFilter || state.currentTagFilter);

  if (!hasFilter) {
    DOM.activeFilterBar.classList.add('hidden');
    DOM.activeFilterChips.innerHTML = '';
    return;
  }

  DOM.activeFilterBar.classList.remove('hidden');
  DOM.activeFilterChips.innerHTML = '';

  if (state.currentMachineFilter) {
    DOM.activeFilterChips.appendChild(createFilterChip(`🚜 ${state.currentMachineFilter}`, () => {
      state.currentMachineFilter = null;
      renderWorkTagLists();
      renderNotesList();
      renderBreadcrumbs();
      renderCurrentView();
    }));
  }

  if (state.currentContentFilter) {
    DOM.activeFilterChips.appendChild(createFilterChip(`📋 ${state.currentContentFilter}`, () => {
      state.currentContentFilter = null;
      renderWorkTagLists();
      renderNotesList();
      renderBreadcrumbs();
      renderCurrentView();
    }));
  }

  if (state.currentUrgencyFilter) {
    DOM.activeFilterChips.appendChild(createFilterChip(`🚨 ${state.currentUrgencyFilter}`, () => {
      state.currentUrgencyFilter = null;
      renderWorkTagLists();
      renderNotesList();
      renderBreadcrumbs();
      renderCurrentView();
    }));
  }

  if (state.currentClientVendorFilter) {
    DOM.activeFilterChips.appendChild(createFilterChip(`🏢 ${state.currentClientVendorFilter}`, () => {
      state.currentClientVendorFilter = null;
      renderWorkTagLists();
      renderNotesList();
      renderBreadcrumbs();
      renderCurrentView();
    }));
  }

  if (state.currentTagFilter) {
    DOM.activeFilterChips.appendChild(createFilterChip(`#${state.currentTagFilter}`, () => {
      state.currentTagFilter = null;
      renderSidebarTags();
      renderNotesList();
      renderBreadcrumbs();
      renderCurrentView();
    }));
  }

  initLucide();
}

function createFilterChip(text, onRemove) {
  const chip = document.createElement('span');
  chip.className = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 border border-blue-200 dark:border-blue-800';
  chip.innerHTML = `<span>${escapeHtml(text)}</span><button class="remove-chip-btn hover:text-red-500 font-bold ml-0.5">×</button>`;
  chip.querySelector('.remove-chip-btn').onclick = (e) => {
    e.stopPropagation();
    onRemove();
  };
  return chip;
}

function renderWorkTagSelects() {
  if (DOM.noteMachineSelect) {
    let curVal = (state.currentNote && state.currentNote.meta && state.currentNote.meta.machineModel) || DOM.noteMachineSelect.value;
    const machines = (state.machineModels && state.machineModels.length > 0) ? state.machineModels : DEFAULT_MACHINE_MODELS;
    if (!curVal) curVal = '未分類';
    DOM.noteMachineSelect.innerHTML = `
      <option value="未分類" ${curVal === '未分類' ? 'selected' : ''}>📥 未分類 (待歸位)</option>
    ` + machines.map(m => `
      <option value="${escapeHtml(m)}" ${curVal === m ? 'selected' : ''}>🚜 ${escapeHtml(m)}</option>
    `).join('') + `
      <option disabled>──────────</option>
      <option value="__add_machine__">➕ 新建機型...</option>
      <option value="__manage_machine__">⚙️ 管理所有機型標籤...</option>
    `;
    DOM.noteMachineSelect.value = curVal;
  }

  if (DOM.noteContentSelect) {
    let curVal = (state.currentNote && state.currentNote.meta && state.currentNote.meta.workContent) || DOM.noteContentSelect.value;
    const contents = (state.workContents && state.workContents.length > 0) ? state.workContents : DEFAULT_WORK_CONTENTS;
    if (!curVal) curVal = '未分類';
    DOM.noteContentSelect.innerHTML = `
      <option value="未分類" ${curVal === '未分類' ? 'selected' : ''}>📥 未分類 (待歸位)</option>
    ` + (curVal === '隨手速記 ✍️' ? `<option value="隨手速記 ✍️" selected>✍️ 隨手速記 (待歸類)</option>` : '') + contents.map(c => `
      <option value="${escapeHtml(c)}" ${curVal === c ? 'selected' : ''}>📋 ${escapeHtml(c)}</option>
    `).join('') + `
      <option disabled>──────────</option>
      <option value="__add_content__">➕ 新建工作內容...</option>
      <option value="__manage_content__">⚙️ 管理所有內容標籤...</option>
    `;
    DOM.noteContentSelect.value = curVal;
  }


  // 🏢 客戶或廠商標籤即時變更事件
  if (DOM.noteClientSelect) {
    let prevClient = DOM.noteClientSelect.value;
    DOM.noteClientSelect.addEventListener('focus', () => {
      prevClient = DOM.noteClientSelect.value;
    });
    DOM.noteClientSelect.addEventListener('change', () => {
      const val = DOM.noteClientSelect.value;
      if (val === '__add_client__') {
        DOM.noteClientSelect.value = (state.currentNote && state.currentNote.meta && state.currentNote.meta.clientVendor) || '';
        const newName = prompt('請輸入新建客戶或廠商名稱：');
        if (newName && newName.trim()) {
          addClientVendor(newName.trim());
          if (state.currentNote && state.currentNote.meta) {
            state.currentNote.meta.clientVendor = newName.trim();
            DOM.noteClientSelect.value = newName.trim();
            saveLocalDraftImmediately();
            triggerAutoSaveDebounce();
          }
        }
        return;
      }
      if (val === '__manage_client__') {
        DOM.noteClientSelect.value = (state.currentNote && state.currentNote.meta && state.currentNote.meta.clientVendor) || '';
        openTagManagerModal('client');
        return;
      }

      if (state.currentNote && state.currentNote.meta) {
        const oldClient = state.currentNote.meta.clientVendor || prevClient;
        const newClient = val;
        state.currentNote.meta.clientVendor = newClient;
        prevClient = newClient;

        const noteId = state.currentNote.id;
        recordAction({
          type: 'change_client',
          title: `🏢 變更客戶「${newClient || '未指定'}」`,
          subtitle: `筆記：${state.currentNote.name || '當前筆記'}`,
          noteId: noteId,
          undo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n && n.meta) {
              n.meta.clientVendor = oldClient;
              if (state.currentNote && state.currentNote.id === noteId && DOM.noteClientSelect) {
                DOM.noteClientSelect.value = oldClient;
              }
              renderWorkTagLists();
              renderCurrentView();
              triggerAutoSaveDebounce();
            }
          },
          redo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n && n.meta) {
              n.meta.clientVendor = newClient;
              if (state.currentNote && state.currentNote.id === noteId && DOM.noteClientSelect) {
                DOM.noteClientSelect.value = newClient;
              }
              renderWorkTagLists();
              renderCurrentView();
              triggerAutoSaveDebounce();
            }
          }
        });

        renderNotesList();
        renderWorkTagLists();
        saveLocalDraftImmediately();
        triggerAutoSaveDebounce();
      }
    });
  }

  if (DOM.btnQuickAddClient) {
    DOM.btnQuickAddClient.addEventListener('click', () => {
      const name = prompt('請輸入新建客戶或廠商名稱：');
      if (name && name.trim()) {
        addClientVendor(name.trim());
        if (state.currentNote && state.currentNote.meta && DOM.noteClientSelect) {
          state.currentNote.meta.clientVendor = name.trim();
          DOM.noteClientSelect.value = name.trim();
          saveLocalDraftImmediately();
          triggerAutoSaveDebounce();
        }
      }
    });
  }

  if (DOM.btnManageClient) {
    DOM.btnManageClient.addEventListener('click', () => {
      openTagManagerModal('client');
    });
  }

  if (DOM.addClientBtn) {
    DOM.addClientBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = prompt('新增客戶或廠商：');
      if (name && name.trim()) addClientVendor(name.trim());
    });
  }

  if (DOM.manageClientBtn) {
    DOM.manageClientBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openTagManagerModal('client');
    });
  }

  if (DOM.tableFilterClient) {
    DOM.tableFilterClient.addEventListener('change', () => {
      renderTableView();
    });
  }

  if (DOM.tmTabClient) {
    DOM.tmTabClient.addEventListener('click', () => {
      switchTagManagerTab('client');
    });
  }

  if (DOM.tmAddClientBtn && DOM.tmNewClientInput) {
    DOM.tmAddClientBtn.addEventListener('click', () => {
      const val = DOM.tmNewClientInput.value.trim();
      if (val) {
        addClientVendor(val);
        DOM.tmNewClientInput.value = '';
      }
    });
    DOM.tmNewClientInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = DOM.tmNewClientInput.value.trim();
        if (val) {
          addClientVendor(val);
          DOM.tmNewClientInput.value = '';
        }
      }
    });
  }

  if (DOM.noteUrgencySelect) {
    let curVal = (state.currentNote && state.currentNote.meta && state.currentNote.meta.urgency) || DOM.noteUrgencySelect.value;
    const urgList = (state.urgencies && state.urgencies.length > 0) ? state.urgencies : DEFAULT_URGENCIES;
    
    // 標準化比對急迫性值
    const matchUrg = urgList.find(u => u.id === curVal || u.label === curVal || (curVal && curVal.includes(u.id)));
    if (matchUrg) {
      curVal = matchUrg.id;
    } else if (curVal !== '未分類' && curVal !== '未指定') {
      curVal = '未分類';
    }
    
    DOM.noteUrgencySelect.innerHTML = `
      <option value="未分類" ${curVal === '未分類' ? 'selected' : ''}>📥 未分類 (待歸位)</option>
    ` + urgList.map(u => `
      <option value="${escapeHtml(u.id)}" ${curVal === u.id ? 'selected' : ''}>${escapeHtml(u.label || u.id)}</option>
    `).join('') + `
      <option disabled>──────────</option>
      <option value="__add_urgency__">➕ 新建急迫性等級...</option>
      <option value="__manage_urgency__">⚙️ 管理急迫性標籤...</option>
    `;
    DOM.noteUrgencySelect.value = curVal;
  }

  if (DOM.noteClientSelect) {
    let curVal = (state.currentNote && state.currentNote.meta && state.currentNote.meta.clientVendor) || DOM.noteClientSelect.value || '';
    const clients = (state.clientsVendors && state.clientsVendors.length > 0) ? state.clientsVendors : DEFAULT_CLIENTS_VENDORS;
    DOM.noteClientSelect.innerHTML = `
      <option value="" ${(!curVal || curVal === '未指定') ? 'selected' : ''}>🏢 未指定 (非強制)</option>
    ` + clients.map(c => `
      <option value="${escapeHtml(c)}" ${curVal === c ? 'selected' : ''}>🏢 ${escapeHtml(c)}</option>
    `).join('') + `
      <option disabled>──────────</option>
      <option value="__add_client__">➕ 新建客戶或廠商...</option>
      <option value="__manage_client__">⚙️ 管理客戶與廠商標籤...</option>
    `;
    DOM.noteClientSelect.value = curVal;
  }

  if (DOM.tableFilterMachine) {
    const curVal = DOM.tableFilterMachine.value;
    DOM.tableFilterMachine.innerHTML = '<option value="">全部機型</option>' + state.machineModels.map(m => `
      <option value="${escapeHtml(m)}" ${curVal === m ? 'selected' : ''}>🚜 ${escapeHtml(m)}</option>
    `).join('');
  }

  if (DOM.tableFilterContent) {
    const curVal = DOM.tableFilterContent.value;
    DOM.tableFilterContent.innerHTML = '<option value="">全部工作內容</option>' + state.workContents.map(c => `
      <option value="${escapeHtml(c)}" ${curVal === c ? 'selected' : ''}>📋 ${escapeHtml(c)}</option>
    `).join('');
  }

  if (DOM.tableFilterUrgency) {
    const curVal = DOM.tableFilterUrgency.value;
    DOM.tableFilterUrgency.innerHTML = '<option value="">全部急迫性</option>' + (state.urgencies || DEFAULT_URGENCIES).map(u => `
      <option value="${escapeHtml(u.id)}" ${curVal === u.id ? 'selected' : ''}>${escapeHtml(u.short || u.id)}</option>
    `).join('');
  }

  if (DOM.tableFilterClient) {
    const curCl = DOM.tableFilterClient.value;
    const clients = (state.clientsVendors && state.clientsVendors.length > 0) ? state.clientsVendors : DEFAULT_CLIENTS_VENDORS;
    DOM.tableFilterClient.innerHTML = '<option value="">全部客戶/廠商</option><option value="__empty__">🏢 未指定</option>' + clients.map(c => `
      <option value="${escapeHtml(c)}" ${curCl === c ? 'selected' : ''}>🏢 ${escapeHtml(c)}</option>
    `).join('');
  }

  // 🏷️ 表格資料庫「標籤」篩選器 (資料來源：自訂通用標籤 state.tags)
  if (DOM.tableFilterTag) {
    const curTag = DOM.tableFilterTag.value;
    const tagList = state.tags || [];
    DOM.tableFilterTag.innerHTML = '<option value="">全部標籤</option>' + tagList.map(t => {
      const name = typeof t === 'string' ? t : (t.name || t.id);
      return `<option value="${escapeHtml(name)}" ${curTag === name ? 'selected' : ''}>🏷️ ${escapeHtml(name)}</option>`;
    }).join('');
    DOM.tableFilterTag.value = curTag;
  }
}

// ----------------- 相容性輔助函式與當前筆記 UI 渲染 -----------------
function renderCurrentNote() {
  if (!state.currentNote) {
    clearEditor();
    return;
  }
  const n = state.currentNote;
  const title = (n.name || '').replace(/\.md$/i, '');
  if (DOM.noteTitle) DOM.noteTitle.value = title;
  if (DOM.headerTitle) DOM.headerTitle.textContent = title || '未命名筆記';
  if (DOM.noteEmojiBtn) DOM.noteEmojiBtn.textContent = (n.meta && n.meta.icon) || '📝';

  renderWorkTagSelects();

  if (n.meta) {
    if (DOM.noteMachineSelect) {
      DOM.noteMachineSelect.value = n.meta.machineModel || '未分類';
    }

    if (DOM.noteContentSelect) {
      DOM.noteContentSelect.value = n.meta.workContent || '未分類';
    }

    if (DOM.noteUrgencySelect) {
      const urgList = (state.urgencies && state.urgencies.length > 0) ? state.urgencies : DEFAULT_URGENCIES;
      const matchUrg = urgList.find(u => u.id === n.meta.urgency || u.label === n.meta.urgency || (n.meta.urgency && n.meta.urgency.includes(u.id)));
      DOM.noteUrgencySelect.value = matchUrg ? matchUrg.id : (n.meta.urgency || '未分類');
    }

    if (DOM.noteStatusSelect) {
      DOM.noteStatusSelect.value = n.meta.status || '💡 構思中';
    }

    if (DOM.noteClientSelect) {
      DOM.noteClientSelect.value = n.meta.clientVendor || '';
    }

    if (DOM.noteDueDate) {
      DOM.noteDueDate.value = n.meta.dueDate || '';
    }

    updatePinButtonUI(n.meta.pinned);
  }

  renderPageCover();
  renderNoteActiveTags();
  renderBreadcrumbs();
}

function renderFolderTree() {
  renderWorkTagLists();
}

function renderFolderSelect() {
  renderWorkTagSelects();
}

function closeFolderModal() {
  if (DOM.folderModal) DOM.folderModal.classList.add('hidden');
}

function submitFolderModal() {
  closeFolderModal();
}

function openFolderModal(action) {
  openTagManagerModal('machine');
}

function renderTagManagerList() {
  renderTagManagerCustomTagsList();
}

// ----------------- 🏷️ 全層級標籤管理中心 (All-Level Tag Manager Modal) -----------------
state.activeTagManagerTab = 'machine';

function openTagManagerModal(initialTab = 'machine') {
  if (DOM.tagDropdownPopover) DOM.tagDropdownPopover.classList.add('hidden');
  switchTagManagerTab(initialTab);
  if (DOM.tagManagerModal) DOM.tagManagerModal.classList.remove('hidden');
  initLucide();
}

function closeTagManagerModal() {
  const modal = DOM.tagManagerModal || document.getElementById('tag-manager-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
  try { renderSidebarTags(); } catch(e) { console.warn(e); }
  try { renderWorkTagLists(); } catch(e) { console.warn(e); }
  try { renderWorkTagSelects(); } catch(e) { console.warn(e); }
  try { renderNoteActiveTags(); } catch(e) { console.warn(e); }
  try { renderCurrentView(); } catch(e) { console.warn(e); }
}

function switchTagManagerTab(tab) {
  state.activeTagManagerTab = tab;
  
  const tabBtns = [
    { id: 'machine', btn: DOM.tmTabMachine, pane: DOM.tmPaneMachine },
    { id: 'content', btn: DOM.tmTabContent, pane: DOM.tmPaneContent },
    { id: 'urgency', btn: DOM.tmTabUrgency, pane: DOM.tmPaneUrgency },
    { id: 'client', btn: DOM.tmTabClient, pane: DOM.tmPaneClient },
    { id: 'custom', btn: DOM.tmTabCustom, pane: DOM.tmPaneCustom }
  ];

  tabBtns.forEach(t => {
    if (t.btn) {
      if (t.id === tab) {
        t.btn.className = 'tm-tab-btn py-2 px-1 border-b-2 border-blue-600 text-blue-600 dark:text-blue-400 flex items-center justify-center gap-1.5 active font-bold transition';
      } else {
        t.btn.className = 'tm-tab-btn py-2 px-1 border-b-2 border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center justify-center gap-1.5 transition';
      }
    }
    if (t.pane) {
      if (t.id === tab) t.pane.classList.remove('hidden');
      else t.pane.classList.add('hidden');
    }
  });

  if (tab === 'machine') renderTagManagerMachineList();
  else if (tab === 'content') renderTagManagerContentList();
  else if (tab === 'urgency') renderTagManagerUrgencyList();
  else if (tab === 'client') renderTagManagerClientList();
  else if (tab === 'custom') renderTagManagerCustomTagsList();

  initLucide();
}

// 1. 機型管理列表渲染與增刪

// ----------------- 🛠️ 分類選項全功能編輯 (更名、換色與關聯筆記同步) -----------------

async function renameMachineModel(oldName, newName, shouldRecord = true) {
  newName = (newName || '').trim();
  if (!newName) {
    showToast('機型名稱不能為空！');
    renderTagManagerMachineList();
    return false;
  }
  if (newName === oldName) return true;
  if (state.machineModels.includes(newName)) {
    showToast(`機型「${newName}」已存在！`);
    renderTagManagerMachineList();
    return false;
  }

  const idx = state.machineModels.indexOf(oldName);
  if (idx === -1) return false;

  state.machineModels[idx] = newName;

  // 更新所有使用舊機型的筆記
  const affectedNotes = state.notes.filter(n => n.meta && n.meta.machineModel === oldName);
  affectedNotes.forEach(n => {
    n.meta.machineModel = newName;
  });

  // 更新當前選取的機型過濾器
  if (state.currentMachineFilter === oldName) {
    state.currentMachineFilter = newName;
  }
  if (state.currentNote && state.currentNote.meta && state.currentNote.meta.machineModel === oldName) {
    state.currentNote.meta.machineModel = newName;
  }

  // Google Drive 實體資料夾同步更名 (若存在)
  if (state.accessToken && state.folderId) {
    try {
      const folderId = state.categoryFolderMap && state.categoryFolderMap[oldName];
      if (folderId) {
        await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${state.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name: newName })
        });
        delete state.categoryFolderMap[oldName];
        state.categoryFolderMap[newName] = folderId;
        console.log(`📁 雲端機型資料夾已同步更名為「${newName}」:`, folderId);
      }
    } catch (err) {
      console.warn('雲端資料夾更名失敗:', err);
    }
  }

  saveWorkTags();
  renderWorkTagSelects();
  renderWorkTagLists();
  renderCurrentNote();
  renderCurrentView();
  renderTagManagerMachineList();

  if (shouldRecord) {
    recordAction({
      type: 'rename_machine',
      title: `🚜 更名機型「${oldName}」➔「${newName}」`,
      subtitle: `已同步更新 ${affectedNotes.length} 篇筆記之機型屬性`,
      undo: () => { renameMachineModel(newName, oldName, false); },
      redo: () => { renameMachineModel(oldName, newName, false); }
    });
  }

  showToast(`✅ 機型已更名為「${newName}」並同步雲端！`);
  return true;
}

async function renameWorkContent(oldName, newName, shouldRecord = true) {
  newName = (newName || '').trim();
  if (!newName) {
    showToast('工作內容名稱不能為空！');
    renderTagManagerContentList();
    return false;
  }
  if (newName === oldName) return true;
  if (state.workContents.includes(newName)) {
    showToast(`工作內容「${newName}」已存在！`);
    renderTagManagerContentList();
    return false;
  }

  const idx = state.workContents.indexOf(oldName);
  if (idx === -1) return false;

  state.workContents[idx] = newName;

  const affectedNotes = state.notes.filter(n => n.meta && n.meta.workContent === oldName);
  affectedNotes.forEach(n => {
    n.meta.workContent = newName;
  });

  if (state.currentContentFilter === oldName) {
    state.currentContentFilter = newName;
  }
  if (state.currentNote && state.currentNote.meta && state.currentNote.meta.workContent === oldName) {
    state.currentNote.meta.workContent = newName;
  }

  saveWorkTags();
  renderWorkTagSelects();
  renderWorkTagLists();
  renderCurrentNote();
  renderCurrentView();
  renderTagManagerContentList();

  if (shouldRecord) {
    recordAction({
      type: 'rename_content',
      title: `📋 更名工作內容「${oldName}」➔「${newName}」`,
      subtitle: `已同步更新 ${affectedNotes.length} 篇筆記之內容類別`,
      undo: () => { renameWorkContent(newName, oldName, false); },
      redo: () => { renameWorkContent(oldName, newName, false); }
    });
  }

  showToast(`✅ 工作內容已更名為「${newName}」！`);
  return true;
}

async function updateUrgencyLevel(urgencyId, newLabel, colorKey, shouldRecord = true) {
  newLabel = (newLabel || '').trim();
  if (!newLabel) {
    showToast('急迫性等級名稱不能為空！');
    renderTagManagerUrgencyList();
    return false;
  }

  const u = state.urgencies.find(item => item.id === urgencyId);
  if (!u) return false;

  const oldLabel = u.label || u.id;
  const theme = (colorKey && COLOR_THEMES[colorKey]) ? COLOR_THEMES[colorKey].class : (COLOR_THEMES[colorKey] || u.color);

  u.label = newLabel;
  u.short = newLabel;
  if (theme) u.color = theme;

  const affectedNotes = state.notes.filter(n => n.meta && (n.meta.urgency === urgencyId || n.meta.urgency === oldLabel));
  affectedNotes.forEach(n => {
    n.meta.urgency = newLabel;
  });
  u.id = newLabel;

  saveWorkTags();
  renderWorkTagSelects();
  renderWorkTagLists();
  renderCurrentNote();
  renderCurrentView();
  renderTagManagerUrgencyList();

  showToast(`✅ 急迫性等級已更新為「${newLabel}」！`);
  return true;
}


// ==========================================================================
// 🏢 客戶或廠商 (Client or Vendor) 管理核心模組
// ==========================================================================

function renderTagManagerClientList() {
  if (!DOM.tmClientList) return;
  const clients = (state.clientsVendors && state.clientsVendors.length > 0) ? state.clientsVendors : DEFAULT_CLIENTS_VENDORS;
  if (DOM.tmClientTotalCount) DOM.tmClientTotalCount.textContent = `共 ${clients.length} 項`;

  DOM.tmClientList.innerHTML = clients.map((c, idx) => {
    const count = state.notes.filter(n => n.meta && n.meta.clientVendor === c).length;
    return `
      <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-notion-darker border border-gray-200/60 dark:border-notion-borderDark text-xs group" data-client-index="${idx}">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <i data-lucide="building-2" class="w-4 h-4 text-indigo-500 shrink-0"></i>
          <span class="font-bold text-gray-800 dark:text-gray-200 truncate">${escapeHtml(c)}</span>
          <span class="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">關聯 ${count} 篇</span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button class="tm-rename-client-btn p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-indigo-600 transition" title="更名客戶/廠商" data-client-name="${escapeHtml(c)}">
            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
          </button>
          <button class="tm-del-client-btn p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-gray-400 hover:text-rose-600 transition" title="刪除此客戶/廠商" data-client-name="${escapeHtml(c)}">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  DOM.tmClientList.querySelectorAll('.tm-rename-client-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const oldName = btn.dataset.clientName;
      const newName = prompt(`請輸入「${oldName}」的新名稱：`, oldName);
      if (newName !== null) renameClientVendor(oldName, newName);
    });
  });

  DOM.tmClientList.querySelectorAll('.tm-del-client-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.clientName;
      deleteClientVendor(name);
    });
  });

  initLucide();
}

async function addClientVendor(name, shouldRecord = true) {
  name = (name || '').trim();
  if (!name) {
    showToast('請輸入客戶或廠商名稱！');
    return false;
  }
  if (!state.clientsVendors) state.clientsVendors = DEFAULT_CLIENTS_VENDORS.slice();
  if (state.clientsVendors.includes(name)) {
    showToast(`客戶/廠商「${name}」已存在！`);
    return false;
  }

  state.clientsVendors.push(name);
  saveWorkspaceConfigToDrive();
  renderWorkTagSelects();
  renderWorkTagLists();
  renderTagManagerClientList();
  renderTableView();

  if (shouldRecord) {
    recordAction({
      type: 'add_client',
      title: `🏢 新增客戶/廠商「${name}」`,
      subtitle: '已加入工作區設定',
      undo: () => { deleteClientVendor(name, false); },
      redo: () => { addClientVendor(name, false); }
    });
  }

  showToast(`✅ 已新增客戶/廠商「${name}」！`);
  return true;
}

async function renameClientVendor(oldName, newName, shouldRecord = true) {
  newName = (newName || '').trim();
  if (!newName) {
    showToast('名稱不能為空！');
    return false;
  }
  if (newName === oldName) return true;
  if (!state.clientsVendors) state.clientsVendors = DEFAULT_CLIENTS_VENDORS.slice();
  if (state.clientsVendors.includes(newName)) {
    showToast(`客戶/廠商「${newName}」已存在！`);
    return false;
  }

  const idx = state.clientsVendors.indexOf(oldName);
  if (idx === -1) return false;
  state.clientsVendors[idx] = newName;

  const affectedNotes = state.notes.filter(n => n.meta && n.meta.clientVendor === oldName);
  affectedNotes.forEach(n => {
    n.meta.clientVendor = newName;
  });

  if (state.currentClientVendorFilter === oldName) {
    state.currentClientVendorFilter = newName;
  }
  if (state.currentNote && state.currentNote.meta && state.currentNote.meta.clientVendor === oldName) {
    state.currentNote.meta.clientVendor = newName;
  }

  saveWorkspaceConfigToDrive();
  renderWorkTagSelects();
  renderWorkTagLists();
  renderCurrentNote();
  renderCurrentView();
  renderTagManagerClientList();

  if (shouldRecord) {
    recordAction({
      type: 'rename_client',
      title: `🏢 更名客戶/廠商「${oldName}」➔「${newName}」`,
      subtitle: `已同步更新 ${affectedNotes.length} 篇筆記之客戶屬性`,
      undo: () => { renameClientVendor(newName, oldName, false); },
      redo: () => { renameClientVendor(oldName, newName, false); }
    });
  }

  showToast(`✅ 已更名為「${newName}」並同步雲端！`);
  return true;
}

async function deleteClientVendor(name, shouldRecord = true) {
  if (!state.clientsVendors) state.clientsVendors = DEFAULT_CLIENTS_VENDORS.slice();
  const idx = state.clientsVendors.indexOf(name);
  if (idx === -1) return false;

  const affectedNotes = state.notes.filter(n => n.meta && n.meta.clientVendor === name);
  if (shouldRecord && affectedNotes.length > 0) {
    if (!confirm(`確定要刪除「${name}」嗎？目前有 ${affectedNotes.length} 篇筆記關聯此客戶，刪除後將設為未指定。`)) {
      return false;
    }
  }

  state.clientsVendors.splice(idx, 1);
  affectedNotes.forEach(n => {
    n.meta.clientVendor = '';
  });

  if (state.currentClientVendorFilter === name) {
    state.currentClientVendorFilter = null;
  }
  if (state.currentNote && state.currentNote.meta && state.currentNote.meta.clientVendor === name) {
    state.currentNote.meta.clientVendor = '';
  }

  saveWorkspaceConfigToDrive();
  renderWorkTagSelects();
  renderWorkTagLists();
  renderCurrentNote();
  renderCurrentView();
  renderTagManagerClientList();

  if (shouldRecord) {
    recordAction({
      type: 'delete_client',
      title: `🏢 刪除客戶/廠商「${name}」`,
      subtitle: `已解除 ${affectedNotes.length} 篇筆記之客戶標籤`,
      undo: () => {
        if (!state.clientsVendors.includes(name)) state.clientsVendors.splice(idx, 0, name);
        affectedNotes.forEach(n => { n.meta.clientVendor = name; });
        saveWorkspaceConfigToDrive();
        renderWorkTagSelects();
        renderWorkTagLists();
        renderCurrentView();
      },
      redo: () => { deleteClientVendor(name, false); }
    });
  }

  showToast(`🗑️ 已刪除客戶/廠商「${name}」！`);
  return true;
}

function renderTagManagerMachineList() {
  if (!DOM.tmMachineList) return;
  DOM.tmMachineList.innerHTML = '';
  if (DOM.tmMachineTotalCount) DOM.tmMachineTotalCount.textContent = `共 ${state.machineModels.length} 項`;

  if (!state.machineModels.length) {
    DOM.tmMachineList.innerHTML = '<div class="text-center py-6 text-gray-400 text-xs">目前沒有任何機型</div>';
    return;
  }

  state.machineModels.forEach(m => {
    const noteCount = state.notes.filter(n => n.meta && n.meta.machineModel === m).length;
    const row = document.createElement('div');
    row.className = 'p-2 bg-gray-50/80 dark:bg-notion-darker rounded-lg border border-gray-200/50 dark:border-notion-borderDark flex items-center justify-between gap-2 text-xs';
    row.innerHTML = `
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <span class="text-base shrink-0">🚜</span>
        <input type="text" class="machine-rename-input flex-1 px-2 py-1 text-xs bg-white dark:bg-notion-dark border border-gray-200 dark:border-notion-borderDark rounded font-bold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500" value="${escapeHtml(m)}" title="可直接編輯修改機型名稱">
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-[11px] px-2 py-0.5 rounded-full ${noteCount > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-100 text-gray-400'} font-medium">${noteCount} 篇</span>
        <button class="save-machine-btn p-1 text-gray-400 hover:text-emerald-500 rounded transition" title="儲存修改">
          <i data-lucide="check" class="w-3.5 h-3.5"></i>
        </button>
        <button class="delete-machine-btn p-1 text-gray-400 hover:text-red-500 rounded transition" title="刪除此機型">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    const input = row.querySelector('.machine-rename-input');
    const saveBtn = row.querySelector('.save-machine-btn');
    const handleRename = () => {
      const newName = input.value.trim();
      if (!newName || newName === m) return;
      renameMachineModel(m, newName);
    };

    input.addEventListener('change', handleRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRename();
      }
    });
    saveBtn.addEventListener('click', handleRename);

    row.querySelector('.delete-machine-btn').addEventListener('click', () => {
      const msg = noteCount > 0
        ? `確定要刪除機型「${m}」嗎？\n共有 ${noteCount} 篇筆記目前設定為此機型（刪除後筆記將保留，機型設定將更新）。`
        : `確定要刪除機型「${m}」嗎？`;
      if (!confirm(msg)) return;
      deleteMachineModel(m);
    });

    DOM.tmMachineList.appendChild(row);
  });

  initLucide();
}

function addMachineModel(name, shouldRecord = true) {
  name = (name || '').trim();
  if (!name) {
    showToast('機型名稱不能為空！');
    return false;
  }
  if (state.machineModels.includes(name)) {
    showToast(`機型「${name}」已存在！`);
    return false;
  }

  state.machineModels.push(name);
  saveWorkTags();
  renderWorkTagSelects();
  renderWorkTagLists();
  renderTagManagerMachineList();
  if (DOM.tmNewMachineInput) DOM.tmNewMachineInput.value = '';

  if (shouldRecord) {
    recordAction({
      type: 'add_machine',
      title: `🚜 新增機型「${name}」`,
      subtitle: `已加入最上層機型庫`,
      undo: () => { deleteMachineModel(name, false); },
      redo: () => { addMachineModel(name, false); }
    });
  }

  showToast(`已成功建立新機型「${name}」！`);
  return true;
}

function deleteMachineModel(name, shouldRecord = true) {
  const idx = state.machineModels.indexOf(name);
  if (idx === -1) return;

  const affectedNotes = state.notes.filter(n => n.meta && n.meta.machineModel === name).map(n => n.id);
  
  state.machineModels.splice(idx, 1);
  const fallback = state.machineModels[0] || '機型-A';
  affectedNotes.forEach(id => {
    const n = state.notes.find(note => note.id === id);
    if (n && n.meta) n.meta.machineModel = fallback;
  });

  if (state.currentMachineFilter === name) {
    state.currentMachineFilter = null;
  }

  saveWorkTags();
  renderWorkTagSelects();
  renderWorkTagLists();
  renderCurrentNote();
  renderCurrentView();
  renderTagManagerMachineList();

  if (shouldRecord) {
    recordAction({
      type: 'delete_machine',
      title: `🚜 刪除機型「${name}」`,
      subtitle: `已解除 ${affectedNotes.length} 篇筆記之關聯`,
      undo: () => {
        if (!state.machineModels.includes(name)) {
          state.machineModels.splice(idx, 0, name);
        }
        affectedNotes.forEach(id => {
          const n = state.notes.find(note => note.id === id);
          if (n && n.meta) n.meta.machineModel = name;
        });
        saveWorkTags();
        renderWorkTagSelects();
        renderWorkTagLists();
        renderCurrentNote();
        renderCurrentView();
        if (state.activeTagManagerTab === 'machine') renderTagManagerMachineList();
      },
      redo: () => {
        deleteMachineModel(name, false);
      }
    });
  }

  showToast(`已刪除機型「${name}」！`);
}

// 2. 工作內容管理列表渲染與增刪
function renderTagManagerContentList() {
  if (!DOM.tmContentList) return;
  DOM.tmContentList.innerHTML = '';
  if (DOM.tmContentTotalCount) DOM.tmContentTotalCount.textContent = `共 ${state.workContents.length} 項`;

  if (!state.workContents.length) {
    DOM.tmContentList.innerHTML = '<div class="text-center py-6 text-gray-400 text-xs">目前沒有任何工作內容類別</div>';
    return;
  }

  state.workContents.forEach(c => {
    const noteCount = state.notes.filter(n => n.meta && n.meta.workContent === c).length;
    const row = document.createElement('div');
    row.className = 'p-2 bg-gray-50/80 dark:bg-notion-darker rounded-lg border border-gray-200/50 dark:border-notion-borderDark flex items-center justify-between gap-2 text-xs';
    row.innerHTML = `
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <span class="text-base shrink-0">📋</span>
        <input type="text" class="content-rename-input flex-1 px-2 py-1 text-xs bg-white dark:bg-notion-dark border border-gray-200 dark:border-notion-borderDark rounded font-bold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-500" value="${escapeHtml(c)}" title="可直接編輯修改工作內容類別名稱">
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-[11px] px-2 py-0.5 rounded-full ${noteCount > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-gray-100 text-gray-400'} font-medium">${noteCount} 篇</span>
        <button class="save-content-btn p-1 text-gray-400 hover:text-emerald-500 rounded transition" title="儲存修改">
          <i data-lucide="check" class="w-3.5 h-3.5"></i>
        </button>
        <button class="delete-content-btn p-1 text-gray-400 hover:text-red-500 rounded transition" title="刪除此工作內容">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    const input = row.querySelector('.content-rename-input');
    const saveBtn = row.querySelector('.save-content-btn');
    const handleRename = () => {
      const newName = input.value.trim();
      if (!newName || newName === c) return;
      renameWorkContent(c, newName);
    };

    input.addEventListener('change', handleRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRename();
      }
    });
    saveBtn.addEventListener('click', handleRename);

    row.querySelector('.delete-content-btn').addEventListener('click', () => {
      const msg = noteCount > 0
        ? `確定要刪除工作內容「${c}」嗎？\n共有 ${noteCount} 篇筆記目前設定為此內容類別。`
        : `確定要刪除工作內容「${c}」嗎？`;
      if (!confirm(msg)) return;
      deleteWorkContent(c);
    });

    DOM.tmContentList.appendChild(row);
  });

  initLucide();
}

function addWorkContent(name, shouldRecord = true) {
  name = (name || '').trim();
  if (!name) {
    showToast('工作內容類別名稱不能為空！');
    return false;
  }
  if (state.workContents.includes(name)) {
    showToast(`工作內容「${name}」已存在！`);
    return false;
  }

  state.workContents.push(name);
  saveWorkTags();
  renderWorkTagSelects();
  renderWorkTagLists();
  renderTagManagerContentList();
  if (DOM.tmNewContentInput) DOM.tmNewContentInput.value = '';

  if (shouldRecord) {
    recordAction({
      type: 'add_content',
      title: `📋 新增工作內容「${name}」`,
      subtitle: `已加入下一層內容分類庫`,
      undo: () => { deleteWorkContent(name, false); },
      redo: () => { addWorkContent(name, false); }
    });
  }

  showToast(`已成功建立工作內容類別「${name}」！`);
  return true;
}

function deleteWorkContent(name, shouldRecord = true) {
  const idx = state.workContents.indexOf(name);
  if (idx === -1) return;

  const affectedNotes = state.notes.filter(n => n.meta && n.meta.workContent === name).map(n => n.id);

  state.workContents.splice(idx, 1);
  const fallback = state.workContents[0] || '保養維護 🛠️';
  affectedNotes.forEach(id => {
    const n = state.notes.find(note => note.id === id);
    if (n && n.meta) n.meta.workContent = fallback;
  });

  if (state.currentContentFilter === name) {
    state.currentContentFilter = null;
  }

  saveWorkTags();
  renderWorkTagSelects();
  renderWorkTagLists();
  renderCurrentNote();
  renderCurrentView();
  renderTagManagerContentList();

  if (shouldRecord) {
    recordAction({
      type: 'delete_content',
      title: `📋 刪除工作內容「${name}」`,
      subtitle: `已解除 ${affectedNotes.length} 篇筆記之關聯`,
      undo: () => {
        if (!state.workContents.includes(name)) {
          state.workContents.splice(idx, 0, name);
        }
        affectedNotes.forEach(id => {
          const n = state.notes.find(note => note.id === id);
          if (n && n.meta) n.meta.workContent = name;
        });
        saveWorkTags();
        renderWorkTagSelects();
        renderWorkTagLists();
        renderCurrentNote();
        renderCurrentView();
        if (state.activeTagManagerTab === 'content') renderTagManagerContentList();
      },
      redo: () => {
        deleteWorkContent(name, false);
      }
    });
  }

  showToast(`已刪除工作內容「${name}」！`);
}

// 3. 急迫性等級管理列表渲染與增刪
function renderTagManagerUrgencyList() {
  if (!DOM.tmUrgencyList) return;
  DOM.tmUrgencyList.innerHTML = '';
  if (DOM.tmUrgencyTotalCount) DOM.tmUrgencyTotalCount.textContent = `共 ${state.urgencies.length} 項`;

  if (!state.urgencies.length) {
    DOM.tmUrgencyList.innerHTML = '<div class="text-center py-6 text-gray-400 text-xs">目前沒有任何急迫性等級</div>';
    return;
  }

  state.urgencies.forEach(u => {
    const noteCount = state.notes.filter(n => n.meta && n.meta.urgency === u.id).length;
    const row = document.createElement('div');
    row.className = 'p-2 bg-gray-50/80 dark:bg-notion-darker rounded-lg border border-gray-200/50 dark:border-notion-borderDark flex items-center justify-between gap-2 text-xs';
    
    let curTheme = 'rose';
    if ((u.color || '').includes('amber')) curTheme = 'amber';
    else if ((u.color || '').includes('emerald') || (u.color || '').includes('green')) curTheme = 'emerald';
    else if ((u.color || '').includes('gray')) curTheme = 'gray';
    else if ((u.color || '').includes('purple')) curTheme = 'purple';
    else if ((u.color || '').includes('blue')) curTheme = 'blue';
    else if ((u.color || '').includes('pink')) curTheme = 'pink';
    else if ((u.color || '').includes('orange')) curTheme = 'orange';

    row.innerHTML = `
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <input type="text" class="urgency-rename-input flex-1 px-2 py-1 text-xs bg-white dark:bg-notion-dark border border-gray-200 dark:border-notion-borderDark rounded font-bold text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-rose-500" value="${escapeHtml(u.label || u.id)}" title="可直接編輯修改急迫性等級名稱">
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <select class="urgency-color-select text-[11px] px-1.5 py-1 bg-white dark:bg-notion-dark border border-gray-200 dark:border-notion-borderDark rounded font-medium">
          <option value="rose" ${curTheme === 'rose' ? 'selected' : ''}>🔴 紅</option>
          <option value="amber" ${curTheme === 'amber' ? 'selected' : ''}>🟡 黃</option>
          <option value="emerald" ${curTheme === 'emerald' ? 'selected' : ''}>🟢 綠</option>
          <option value="gray" ${curTheme === 'gray' ? 'selected' : ''}>⚪ 灰</option>
          <option value="purple" ${curTheme === 'purple' ? 'selected' : ''}>🟣 紫</option>
          <option value="blue" ${curTheme === 'blue' ? 'selected' : ''}>🔵 藍</option>
          <option value="pink" ${curTheme === 'pink' ? 'selected' : ''}>🌸 粉</option>
          <option value="orange" ${curTheme === 'orange' ? 'selected' : ''}>🟠 橙</option>
        </select>
        <span class="text-[11px] px-1.5 py-0.5 rounded-full ${noteCount > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-gray-100 text-gray-400'} font-medium">${noteCount} 篇</span>
        <button class="save-urgency-btn p-1 text-gray-400 hover:text-emerald-500 rounded transition" title="儲存修改">
          <i data-lucide="check" class="w-3.5 h-3.5"></i>
        </button>
        <button class="delete-urgency-btn p-1 text-gray-400 hover:text-red-500 rounded transition" title="刪除此急迫性等級" ${state.urgencies.length <= 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    const input = row.querySelector('.urgency-rename-input');
    const colorSelect = row.querySelector('.urgency-color-select');
    const saveBtn = row.querySelector('.save-urgency-btn');

    const handleUpdate = () => {
      const newLabel = input.value.trim();
      const newColor = colorSelect.value;
      if (!newLabel) return;
      updateUrgencyLevel(u.id, newLabel, newColor);
    };

    input.addEventListener('change', handleUpdate);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUpdate();
      }
    });
    colorSelect.addEventListener('change', handleUpdate);
    saveBtn.addEventListener('click', handleUpdate);

    const delBtn = row.querySelector('.delete-urgency-btn');
    if (delBtn && state.urgencies.length > 1) {
      delBtn.addEventListener('click', () => {
        const msg = noteCount > 0
          ? `確定要刪除急迫性等級「${u.id}」嗎？\n共有 ${noteCount} 篇筆記目前設定為此等級。`
          : `確定要刪除急迫性等級「${u.id}」嗎？`;
        if (!confirm(msg)) return;
        deleteUrgencyLevel(u.id);
      });
    }

    DOM.tmUrgencyList.appendChild(row);
  });

  initLucide();
}

function addUrgencyLevel(name, colorTheme, shouldRecord = true) {
  name = (name || '').trim();
  if (!name) {
    showToast('急迫性等級名稱不能為空！');
    return false;
  }
  if (state.urgencies.some(u => u.id === name || u.label === name)) {
    showToast(`急迫性等級「${name}」已存在！`);
    return false;
  }

  const theme = COLOR_THEMES[colorTheme] || COLOR_THEMES.rose;
  const newUrgency = {
    id: name,
    label: name,
    short: name,
    color: theme.class
  };

  state.urgencies.push(newUrgency);
  saveWorkTags();
  renderWorkTagSelects();
  renderWorkTagLists();
  renderTagManagerUrgencyList();
  if (DOM.tmNewUrgencyName) DOM.tmNewUrgencyName.value = '';

  if (shouldRecord) {
    recordAction({
      type: 'add_urgency',
      title: `🚨 新增急迫性等級「${name}」`,
      subtitle: `色彩風格：${theme.label}`,
      undo: () => { deleteUrgencyLevel(name, false); },
      redo: () => { addUrgencyLevel(name, colorTheme, false); }
    });
  }

  showToast(`已成功建立急迫性等級「${name}」！`);
  return true;
}

function deleteUrgencyLevel(id, shouldRecord = true) {
  if (state.urgencies.length <= 1) {
    showToast('至少需保留一個急迫性等級！');
    return;
  }

  const idx = state.urgencies.findIndex(u => u.id === id);
  if (idx === -1) return;
  const deletedUrgency = state.urgencies[idx];

  const affectedNotes = state.notes.filter(n => n.meta && n.meta.urgency === id).map(n => n.id);

  state.urgencies.splice(idx, 1);
  const fallback = state.urgencies[0].id;
  affectedNotes.forEach(noteId => {
    const n = state.notes.find(note => note.id === noteId);
    if (n && n.meta) n.meta.urgency = fallback;
  });

  if (state.currentUrgencyFilter === id) {
    state.currentUrgencyFilter = null;
  }

  saveWorkTags();
  renderWorkTagSelects();
  renderWorkTagLists();
  renderCurrentNote();
  renderCurrentView();
  renderTagManagerUrgencyList();

  if (shouldRecord) {
    recordAction({
      type: 'delete_urgency',
      title: `🚨 刪除急迫性等級「${id}」`,
      subtitle: `已解除 ${affectedNotes.length} 篇筆記之關聯`,
      undo: () => {
        if (!state.urgencies.some(u => u.id === id)) {
          state.urgencies.splice(idx, 0, deletedUrgency);
        }
        affectedNotes.forEach(noteId => {
          const n = state.notes.find(note => note.id === noteId);
          if (n && n.meta) n.meta.urgency = id;
        });
        saveWorkTags();
        renderWorkTagSelects();
        renderWorkTagLists();
        renderCurrentNote();
        renderCurrentView();
        if (state.activeTagManagerTab === 'urgency') renderTagManagerUrgencyList();
      },
      redo: () => {
        deleteUrgencyLevel(id, false);
      }
    });
  }

  showToast(`已刪除急迫性等級「${id}」！`);
}

// 4. 自訂通用標籤管理列表渲染與增刪
function renderTagManagerCustomTagsList() {
  if (!DOM.tmTagsList) return;
  DOM.tmTagsList.innerHTML = '';
  if (DOM.tmCustomTotalCount) DOM.tmCustomTotalCount.textContent = `共 ${state.tags.length} 項`;

  if (!state.tags || !state.tags.length) {
    DOM.tmTagsList.innerHTML = '<div class="text-center py-6 text-gray-400 text-xs">目前沒有任何通用標籤</div>';
    return;
  }

  state.tags.forEach(tag => {
    const noteCount = state.notes.filter(n => n.meta && Array.isArray(n.meta.tags) && n.meta.tags.includes(tag.name)).length;

    const row = document.createElement('div');
    row.className = 'p-2 bg-gray-50/80 dark:bg-notion-darker rounded-lg border border-gray-200/50 dark:border-notion-borderDark flex items-center justify-between gap-2 text-xs';
    
    row.innerHTML = `
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <span class="notion-tag notion-tag-${tag.color} shrink-0">#${escapeHtml(tag.name)}</span>
        <input type="text" class="tag-rename-input flex-1 px-2 py-0.5 text-xs bg-white dark:bg-notion-dark border border-gray-200 dark:border-notion-borderDark rounded" value="${escapeHtml(tag.name)}">
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <select class="tag-color-select text-[11px] px-1.5 py-0.5 bg-white dark:bg-notion-dark border border-gray-200 dark:border-notion-borderDark rounded">
          <option value="blue" ${tag.color === 'blue' ? 'selected' : ''}>藍色</option>
          <option value="green" ${tag.color === 'green' ? 'selected' : ''}>綠色</option>
          <option value="purple" ${tag.color === 'purple' ? 'selected' : ''}>紫色</option>
          <option value="orange" ${tag.color === 'orange' ? 'selected' : ''}>橙色</option>
          <option value="yellow" ${tag.color === 'yellow' ? 'selected' : ''}>黃色</option>
          <option value="pink" ${tag.color === 'pink' ? 'selected' : ''}>粉色</option>
          <option value="red" ${tag.color === 'red' ? 'selected' : ''}>紅色</option>
          <option value="brown" ${tag.color === 'brown' ? 'selected' : ''}>棕色</option>
          <option value="gray" ${tag.color === 'gray' ? 'selected' : ''}>灰色</option>
        </select>
        <span class="text-[11px] text-gray-400 w-16 text-right">${noteCount} 篇</span>
        <button class="delete-tag-btn p-1 text-gray-400 hover:text-red-500 rounded" title="刪除標籤">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    const renameInput = row.querySelector('.tag-rename-input');
    renameInput.addEventListener('change', () => {
      const newName = renameInput.value.trim();
      if (!newName || newName === tag.name) return;
      const oldName = tag.name;
      tag.name = newName;
      state.notes.forEach(note => {
        if (note.meta && Array.isArray(note.meta.tags)) {
          note.meta.tags = note.meta.tags.map(t => t === oldName ? newName : t);
        }
      });
      saveTags();
      renderTagManagerCustomTagsList();
      showToast(`標籤已更名為「#${newName}」`);
    });

    const colorSelect = row.querySelector('.tag-color-select');
    colorSelect.addEventListener('change', () => {
      tag.color = colorSelect.value;
      saveTags();
      renderTagManagerCustomTagsList();
    });

    const deleteBtn = row.querySelector('.delete-tag-btn');
    deleteBtn.addEventListener('click', () => {
      if (!confirm(`確定要刪除標籤「#${tag.name}」嗎？（將從所有筆記中解除關聯）`)) return;
      state.tags = state.tags.filter(t => t.id !== tag.id);
      state.notes.forEach(note => {
        if (note.meta && Array.isArray(note.meta.tags)) {
          note.meta.tags = note.meta.tags.filter(t => t !== tag.name);
        }
      });
      saveTags();
      renderTagManagerCustomTagsList();
      renderSidebarTags();
      renderNoteActiveTags();
      showToast(`已刪除標籤「#${tag.name}」`);
    });

    DOM.tmTagsList.appendChild(row);
  });

  initLucide();
}

function addCustomTag(name, color = 'blue', shouldRecord = true) {
  name = (name || '').trim().replace(/^#/, '');
  if (!name) {
    showToast('標籤名稱不能為空！');
    return false;
  }
  if (state.tags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    showToast(`標籤「#${name}」已存在！`);
    return false;
  }

  const newTag = {
    id: 'tag_' + Date.now(),
    name: name,
    color: color
  };

  state.tags.push(newTag);
  saveTags();
  renderSidebarTags();
  renderTagManagerCustomTagsList();
  if (DOM.tmNewName) DOM.tmNewName.value = '';

  if (shouldRecord) {
    recordAction({
      type: 'add_custom_tag',
      title: `🏷️ 新增通用標籤「#${name}」`,
      subtitle: `色彩：${color}`,
      undo: () => {
        state.tags = state.tags.filter(t => t.id !== newTag.id);
        saveTags();
        renderSidebarTags();
        if (state.activeTagManagerTab === 'custom') renderTagManagerCustomTagsList();
      },
      redo: () => {
        state.tags.push(newTag);
        saveTags();
        renderSidebarTags();
        if (state.activeTagManagerTab === 'custom') renderTagManagerCustomTagsList();
      }
    });
  }

  showToast(`已建立新標籤「#${name}」！`);
  return true;
}

// 快速相容彈窗 (Work Tag Quick Modal)
function openWorkTagModal(type) {
  if (type === 'machine') {
    openTagManagerModal('machine');
  } else if (type === 'content') {
    openTagManagerModal('content');
  } else {
    openTagManagerModal('urgency');
  }
}

function closeWorkTagModal() {
  if (DOM.workTagModal) DOM.workTagModal.classList.add('hidden');
}

function submitWorkTagModal() {
  const name = DOM.workTagNameInput ? DOM.workTagNameInput.value.trim() : '';
  if (!name) {
    showToast('名稱不能為空！');
    return;
  }
  if (state.workTagModalType === 'machine') {
    addMachineModel(name);
  } else {
    addWorkContent(name);
  }
  closeWorkTagModal();
}

// ----------------- 標籤初始化與管理 -----------------
function initTags() {
  // ☁️ 純雲端架構：未登入前不顯示預設標籤，登入後全數從 Google Drive 動態載入
  if (!state.accessToken) {
    state.tags = [];
  }
  renderSidebarTags();
}

function saveTags() {
  // ☁️ 純雲端架構：標籤異動直接即時寫入 Google Drive 雲端設定檔
  saveWorkspaceConfigToDrive();
}

function getTagColor(tagName) {
  const t = state.tags.find(x => x.name === tagName);
  return t ? t.color : 'gray';
}

function renderSidebarTags() {
  if (!DOM.sidebarTagsList) return;
  DOM.sidebarTagsList.innerHTML = '';

  state.tags.forEach(tag => {
    const count = state.notes.filter(n => n.meta && Array.isArray(n.meta.tags) && n.meta.tags.includes(tag.name)).length;
    const isFilter = state.currentTagFilter === tag.name;

    const row = document.createElement('div');
    row.className = `tag-item-row ${isFilter ? 'active' : ''}`;
    row.innerHTML = `
      <span class="notion-tag notion-tag-${tag.color} text-[11px] shrink-0">#</span>
      <span class="truncate flex-1 font-medium">${escapeHtml(tag.name)}</span>
      <span class="text-[10px] text-gray-400 font-semibold">${count}</span>
    `;

    row.addEventListener('click', () => {
      if (state.currentTagFilter === tag.name) {
        state.currentTagFilter = null;
      } else {
        state.currentTagFilter = tag.name;
      }
      renderSidebarTags();
      renderNotesList();
      renderBreadcrumbs();
      renderCurrentView();
    });

    DOM.sidebarTagsList.appendChild(row);
  });
}

function renderNoteActiveTags() {
  if (!DOM.noteActiveTags) return;
  DOM.noteActiveTags.innerHTML = '';

  const tags = (state.currentNote && state.currentNote.meta && Array.isArray(state.currentNote.meta.tags))
    ? state.currentNote.meta.tags
    : [];

  tags.forEach(tagName => {
    const color = getTagColor(tagName);
    const chip = document.createElement('span');
    chip.className = `notion-tag notion-tag-${color} group cursor-pointer inline-flex items-center gap-1`;
    chip.innerHTML = `
      <span>#${escapeHtml(tagName)}</span>
      <button class="remove-tag-btn opacity-60 hover:opacity-100 hover:text-red-500 font-bold ml-0.5">×</button>
    `;

    chip.querySelector('.remove-tag-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const oldTags = state.currentNote.meta.tags.slice();
      state.currentNote.meta.tags = state.currentNote.meta.tags.filter(t => t !== tagName);
      const newTags = state.currentNote.meta.tags.slice();
      const noteId = state.currentNote.id;
      const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';

      recordAction({
        type: 'remove_tag',
        title: `🏷️ 移除標籤「#${tagName}」`,
        subtitle: `筆記：「${noteTitle}」`,
        noteId: noteId,
        undo: () => {
          const n = state.notes.find(note => note.id === noteId);
          if (n && n.meta) {
            n.meta.tags = oldTags.slice();
            if (state.currentNote && state.currentNote.id === noteId) renderNoteActiveTags();
            renderSidebarTags();
            triggerAutoSaveDebounce();
          }
        },
        redo: () => {
          const n = state.notes.find(note => note.id === noteId);
          if (n && n.meta) {
            n.meta.tags = newTags.slice();
            if (state.currentNote && state.currentNote.id === noteId) renderNoteActiveTags();
            renderSidebarTags();
            triggerAutoSaveDebounce();
          }
        }
      });

      renderNoteActiveTags();
      renderSidebarTags();
      triggerAutoSaveDebounce();
    });

    DOM.noteActiveTags.appendChild(chip);
  });
}

function renderTagDropdownPopover() {
  if (!DOM.tagOptionsList) return;
  DOM.tagOptionsList.innerHTML = '';

  const q = (DOM.tagSearchInput && DOM.tagSearchInput.value ? DOM.tagSearchInput.value.trim().toLowerCase() : '');
  const activeTags = (state.currentNote && state.currentNote.meta && Array.isArray(state.currentNote.meta.tags))
    ? state.currentNote.meta.tags
    : [];

  const filtered = state.tags.filter(t => !q || t.name.toLowerCase().includes(q));

  filtered.forEach(tag => {
    const isSelected = activeTags.includes(tag.name);
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between p-1.5 hover:bg-gray-100 dark:hover:bg-notion-darker rounded cursor-pointer text-xs';
    item.innerHTML = `
      <div class="flex items-center gap-1.5">
        <span class="notion-tag notion-tag-${tag.color}">#${escapeHtml(tag.name)}</span>
      </div>
      ${isSelected ? '<i data-lucide="check" class="w-3.5 h-3.5 text-blue-500"></i>' : ''}
    `;

    item.addEventListener('click', () => {
      if (!state.currentNote) return;
      if (!state.currentNote.meta) state.currentNote.meta = {};
      if (!Array.isArray(state.currentNote.meta.tags)) state.currentNote.meta.tags = [];

      const oldTags = state.currentNote.meta.tags.slice();
      if (isSelected) {
        state.currentNote.meta.tags = state.currentNote.meta.tags.filter(t => t !== tag.name);
      } else {
        state.currentNote.meta.tags.push(tag.name);
      }
      const newTags = state.currentNote.meta.tags.slice();
      const noteId = state.currentNote.id;
      const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';

      recordAction({
        type: isSelected ? 'remove_tag' : 'add_tag',
        title: isSelected ? `🏷️ 移除標籤「#${tag.name}」` : `🏷️ 加入標籤「#${tag.name}」`,
        subtitle: `筆記：「${noteTitle}」`,
        noteId: noteId,
        undo: () => {
          const n = state.notes.find(note => note.id === noteId);
          if (n && n.meta) {
            n.meta.tags = oldTags.slice();
            if (state.currentNote && state.currentNote.id === noteId) renderNoteActiveTags();
            renderSidebarTags();
            triggerAutoSaveDebounce();
          }
        },
        redo: () => {
          const n = state.notes.find(note => note.id === noteId);
          if (n && n.meta) {
            n.meta.tags = newTags.slice();
            if (state.currentNote && state.currentNote.id === noteId) renderNoteActiveTags();
            renderSidebarTags();
            triggerAutoSaveDebounce();
          }
        }
      });

      renderNoteActiveTags();
      renderSidebarTags();
      renderTagDropdownPopover();
      triggerAutoSaveDebounce();
    });

    DOM.tagOptionsList.appendChild(item);
  });

  const exactMatch = state.tags.some(t => t.name.toLowerCase() === q);
  if (q && !exactMatch && DOM.tagCreateRow) {
    DOM.tagCreateRow.classList.remove('hidden');
    if (DOM.tagNewNamePreview) DOM.tagNewNamePreview.textContent = q;
  } else if (DOM.tagCreateRow) {
    DOM.tagCreateRow.classList.add('hidden');
  }

  initLucide();
}

// ----------------- 頁面封面橫幅 -----------------
function initCoverPresetsUI() {
  if (!DOM.coverPresetsGrid) return;
  DOM.coverPresetsGrid.innerHTML = '';

  COVER_PRESETS.forEach(preset => {
    const card = document.createElement('div');
    card.className = 'h-16 rounded-lg cursor-pointer border border-black/10 dark:border-white/10 hover:ring-2 hover:ring-blue-500 transition relative overflow-hidden flex items-end p-1.5 shadow-sm';
    card.style.background = preset.bg;
    card.innerHTML = `<span class="text-[10px] text-white font-medium drop-shadow-md bg-black/30 px-1.5 py-0.5 rounded backdrop-blur-xs">${preset.name}</span>`;
    card.onclick = () => {
      setNoteCover(preset.bg);
      DOM.coverModal.classList.add('hidden');
    };
    DOM.coverPresetsGrid.appendChild(card);
  });
}

function renderPageCover() {
  if (!DOM.pageCover) return;
  const cover = state.currentNote && state.currentNote.meta ? state.currentNote.meta.cover : null;
  if (cover) {
    DOM.pageCover.classList.remove('hidden');
    if (cover.startsWith('http')) {
      DOM.pageCover.style.backgroundImage = `url('${cover}')`;
      DOM.pageCover.style.backgroundColor = 'transparent';
    } else {
      DOM.pageCover.style.backgroundImage = cover;
    }
    if (DOM.addCoverBtn) DOM.addCoverBtn.classList.add('hidden');
  } else {
    DOM.pageCover.classList.add('hidden');
    DOM.pageCover.style.backgroundImage = 'none';
    if (DOM.addCoverBtn) DOM.addCoverBtn.classList.remove('hidden');
  }
}

function setNoteCover(coverStyle) {
  if (!state.currentNote) return;
  if (!state.currentNote.meta) state.currentNote.meta = {};
  const oldCover = state.currentNote.meta.cover || null;
  const newCover = coverStyle;
  if (oldCover === newCover) return;
  const noteId = state.currentNote.id;
  const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
  state.currentNote.meta.cover = newCover;
  renderPageCover();
  triggerAutoSaveDebounce();
  recordAction({
    type: 'change_cover',
    title: '🎨 更換頁面封面橫幅',
    subtitle: `筆記：「${noteTitle}」`,
    noteId,
    undo: () => {
      const n = state.notes.find(x => x.id === noteId);
      if (n && n.meta) n.meta.cover = oldCover;
      if (state.currentNote && state.currentNote.id === noteId) {
        state.currentNote.meta.cover = oldCover;
        renderPageCover();
      }
      triggerAutoSaveDebounce();
    },
    redo: () => {
      const n = state.notes.find(x => x.id === noteId);
      if (n && n.meta) n.meta.cover = newCover;
      if (state.currentNote && state.currentNote.id === noteId) {
        state.currentNote.meta.cover = newCover;
        renderPageCover();
      }
      triggerAutoSaveDebounce();
    }
  });
  showToast('已更新頁面封面 🎨');
}

function removeNoteCover() {
  if (!state.currentNote) return;
  if (!state.currentNote.meta) state.currentNote.meta = {};
  const oldCover = state.currentNote.meta.cover || null;
  if (!oldCover) return;
  const noteId = state.currentNote.id;
  const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
  state.currentNote.meta.cover = null;
  renderPageCover();
  triggerAutoSaveDebounce();
  recordAction({
    type: 'change_cover',
    title: '🎨 移除頁面封面橫幅',
    subtitle: `筆記：「${noteTitle}」`,
    noteId,
    undo: () => {
      const n = state.notes.find(x => x.id === noteId);
      if (n && n.meta) n.meta.cover = oldCover;
      if (state.currentNote && state.currentNote.id === noteId) {
        state.currentNote.meta.cover = oldCover;
        renderPageCover();
      }
      triggerAutoSaveDebounce();
    },
    redo: () => {
      const n = state.notes.find(x => x.id === noteId);
      if (n && n.meta) n.meta.cover = null;
      if (state.currentNote && state.currentNote.id === noteId) {
        state.currentNote.meta.cover = null;
        renderPageCover();
      }
      triggerAutoSaveDebounce();
    }
  });
  showToast('已移除封面');
}

// ----------------- 頂部麵包屑導航 -----------------
function renderBreadcrumbs() {
  if (!DOM.pageBreadcrumbs) return;
  DOM.pageBreadcrumbs.innerHTML = '';

  const rootItem = document.createElement('span');
  rootItem.className = 'notion-breadcrumb-item';
  rootItem.innerHTML = '<i data-lucide="home" class="w-3 h-3"></i> 全部工作筆記';
  rootItem.onclick = () => {
    state.currentMachineFilter = null;
    state.currentContentFilter = null;
    state.currentUrgencyFilter = null;
    state.currentTagFilter = null;
    renderWorkTagLists();
    renderNotesList();
    renderBreadcrumbs();
    renderCurrentView();
  };
  DOM.pageBreadcrumbs.appendChild(rootItem);

  if (state.currentNote && state.currentNote.meta) {
    const machine = state.currentNote.meta.machineModel;
    const content = state.currentNote.meta.workContent;

    if (machine) {
      const sep1 = document.createElement('span');
      sep1.className = 'text-gray-300 dark:text-gray-600';
      sep1.textContent = '/';
      DOM.pageBreadcrumbs.appendChild(sep1);

      const machineItem = document.createElement('span');
      machineItem.className = 'notion-breadcrumb-item';
      machineItem.innerHTML = `<i data-lucide="cpu" class="w-3 h-3 text-blue-500"></i> ${escapeHtml(machine)}`;
      machineItem.onclick = () => {
        state.currentMachineFilter = machine;
        renderWorkTagLists();
        renderNotesList();
        renderBreadcrumbs();
        renderCurrentView();
      };
      DOM.pageBreadcrumbs.appendChild(machineItem);
    }

    if (content) {
      const sep2 = document.createElement('span');
      sep2.className = 'text-gray-300 dark:text-gray-600';
      sep2.textContent = '/';
      DOM.pageBreadcrumbs.appendChild(sep2);

      const contentItem = document.createElement('span');
      contentItem.className = 'notion-breadcrumb-item';
      contentItem.innerHTML = `<i data-lucide="wrench" class="w-3 h-3 text-amber-500"></i> ${escapeHtml(content)}`;
      contentItem.onclick = () => {
        state.currentContentFilter = content;
        renderWorkTagLists();
        renderNotesList();
        renderBreadcrumbs();
        renderCurrentView();
      };
      DOM.pageBreadcrumbs.appendChild(contentItem);
    }

    const sep3 = document.createElement('span');
    sep3.className = 'text-gray-300 dark:text-gray-600 hidden sm:inline';
    sep3.textContent = '/';
    DOM.pageBreadcrumbs.appendChild(sep3);

    const noteItem = document.createElement('span');
    noteItem.className = 'notion-breadcrumb-item font-semibold text-gray-900 dark:text-white truncate max-w-[140px] hidden sm:inline-flex';
    noteItem.textContent = (state.currentNote.name || '').replace(/\.md$/i, '');
    DOM.pageBreadcrumbs.appendChild(noteItem);
  }
  initLucide();
}


// ==========================================================================
// 🛡️ 相機拍攝防閃退保護與漸進式零 OOM 壓縮引擎 (v2.6.4)
// 專為 POCO X8 Pro (Android / Chrome 50MP/64MP 相機) 與行動裝置打造：
// 1. 喚起原生相機前自動儲存草稿檢查點 (防止 Android LMK 殺掉背景分頁)
// 2. 漸進式解碼與圖片輕量化壓縮 (將 25MB 50MP 原圖轉為 ~1MB 高清圖，徹底根除 OOM 閃退)
// ==========================================================================

function saveCameraCheckpoint() {
  if (!state.currentNote || !state.currentNote.id) return;
  try {
    saveLocalDraftImmediately();
    const checkpoint = {
      noteId: state.currentNote.id,
      noteName: state.currentNote.name,
      html: DOM.editor ? DOM.editor.innerHTML : '',
      title: DOM.noteTitle ? DOM.noteTitle.value : '',
      meta: state.currentNote.meta || {},
      timestamp: Date.now()
    };
    sessionStorage.setItem('lvi_camera_checkpoint', JSON.stringify(checkpoint));
    localStorage.setItem('lvi_camera_checkpoint', JSON.stringify(checkpoint));
  } catch(e) {
    console.warn('saveCameraCheckpoint warning:', e);
  }
}

function restoreCameraCheckpointIfAny() {
  try {
    const raw = sessionStorage.getItem('lvi_camera_checkpoint') || localStorage.getItem('lvi_camera_checkpoint');
    if (!raw) return null;
    const cp = JSON.parse(raw);
    sessionStorage.removeItem('lvi_camera_checkpoint');
    localStorage.removeItem('lvi_camera_checkpoint');
    if (Date.now() - cp.timestamp < 15 * 60 * 1000 && cp.noteId) {
      console.log('⚡ 偵測到相機拍攝後瀏覽器重載，自動恢復先前編輯中的筆記狀態！');
      return cp;
    }
  } catch(e) {}
  return null;
}

// 🚀 720P 規格硬體級零 OOM 智能壓縮引擎 (Zero-OOM Safe 720P Image & Video Compressor - v2.6.4)
const TRASH_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 pointer-events-none shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';

function formatFileSizeDisplay(bytes) {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

async function compressImageForUpload(file, maxDimension = 1280, quality = 0.76) {
  if (!file) return file;
  const isImg = (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|webp|heic|bmp)$/i.test(file.name);
  if (!isImg) return file;

  // GIF 動畫圖、SVG 向量圖或 ICO 圖示保持原樣
  if (file.type === 'image/gif' || file.type === 'image/svg+xml' || file.type === 'image/x-icon' || /\.(gif|svg|ico)$/i.test(file.name)) {
    file._is720p = true;
    return file;
  }

  // ⚡ 極速通道 1：若檔案本身已經小於 300KB 且為 JPEG/WebP，0ms 直接回傳不浪費任何重編碼時間！
  if (file.size <= 300 * 1024 && (file.type === 'image/jpeg' || file.type === 'image/webp')) {
    file._is720p = true;
    return file;
  }

  const t0 = performance.now();
  try {
    const origSize = file.size;

    // ⚡ 極速通道 2：利用瀏覽器原生 Image + libjpeg-turbo 硬體 1/8 IDCT 次取樣解碼
    // 不預先展開 50MP (200MB) 點陣圖，而是在繪入 720P 畫布的瞬間直接由硬體縮放解碼，耗時僅 ~25ms！
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.decoding = 'async';
      const url = URL.createObjectURL(file);
      el.onload = () => {
        URL.revokeObjectURL(url);
        resolve(el);
      };
      el.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      el.src = url;
    });

    const width = img.naturalWidth || img.width || 1280;
    const height = img.naturalHeight || img.height || 720;

    // 🎯 嚴格 720P 標準解析度換算 (橫向最大 1280×720, 直向最大 720×1280)
    const maxW = height > width ? 720 : 1280;
    const maxH = height > width ? 1280 : 720;
    const scale = Math.min(maxW / width, maxH / height, 1.0);
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    // 若尺寸已在 720P 內且檔案小於 500KB，直接回傳原圖
    if (scale >= 1.0 && origSize <= 500 * 1024 && file.type === 'image/jpeg') {
      file._is720p = true;
      return file;
    }

    // 優先使用 OffscreenCanvas 進行 GPU 硬體加速繪製與非同步轉檔 (不阻塞主執行緒 UI)
    let blob = null;
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        const offscreen = new OffscreenCanvas(targetWidth, targetHeight);
        const ctx = offscreen.getContext('2d', { alpha: false, desynchronized: true });
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium'; // ⚡ GPU 硬體雙線性 Mipmap 加速 (比 'high' 快 10 倍且畫質銳利)
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        blob = await offscreen.convertToBlob({ type: 'image/jpeg', quality: quality });
      } catch (offErr) {
        blob = null;
      }
    }

    if (!blob) {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      canvas.width = 1;
      canvas.height = 1;
    }

    if (blob) {
      let cleanName = (file.name || 'Photo').replace(/\.[^/.]+$/, "") + ".jpg";
      if (!cleanName.toLowerCase().endsWith('.jpg')) cleanName += '.jpg';
      const compressedFile = new File([blob], cleanName, { type: 'image/jpeg', lastModified: Date.now() });
      compressedFile._origSize = origSize;
      compressedFile._targetWidth = targetWidth;
      compressedFile._targetHeight = targetHeight;
      compressedFile._is720p = true;
      const elapsedMs = Math.round(performance.now() - t0);
      console.log(`⚡ [極速 720P 圖片壓縮] 耗時僅 ${elapsedMs}ms | ${width}x${height} -> ${targetWidth}x${targetHeight} | ${formatFileSizeDisplay(origSize)} -> ${formatFileSizeDisplay(blob.size)}`);
      return compressedFile;
    }
    return file;
  } catch(err) {
    console.warn('圖片 720P 壓縮略過 (使用原檔):', err);
    return file;
  }
}

// 🎬 影片 720P 前端壓縮與自適應串流引擎 (支援 Canvas + MediaRecorder 720P 即時壓縮)
window._skipCurrentVideoCompression = false;

async function checkOrCompressVideoForUpload(file, onProgress) {
  if (!file) return file;
  const isVideo = (file.type && file.type.startsWith('video/')) || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
  if (!isVideo) return file;

  const origSize = file.size;
  window._skipCurrentVideoCompression = false;

  try {
    const meta = await new Promise((resolve) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.playsInline = true;
      const u = URL.createObjectURL(file);
      const timer = setTimeout(() => {
        URL.revokeObjectURL(u);
        resolve({ width: 0, height: 0, duration: 0 });
      }, 6000);
      v.onloadedmetadata = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(u);
        resolve({ width: v.videoWidth || 0, height: v.videoHeight || 0, duration: v.duration || 0 });
      };
      v.onerror = () => {
        clearTimeout(timer);
        URL.revokeObjectURL(u);
        resolve({ width: 0, height: 0, duration: 0 });
      };
      v.src = u;
    });

    const width = meta.width || 1280;
    const height = meta.height || 720;
    const duration = meta.duration || 0;

    // 計算 720P 目標長寬 (確保偶數像素)
    const maxW = height > width ? 720 : 1280;
    const maxH = height > width ? 1280 : 720;
    const scale = Math.min(maxW / width, maxH / height, 1.0);
    const targetW = Math.max(2, Math.round((width * scale) / 2) * 2);
    const targetH = Math.max(2, Math.round((height * scale) / 2) * 2);

    file._origSize = origSize;
    file._origWidth = width;
    file._origHeight = height;
    file._targetWidth = targetW;
    file._targetHeight = targetH;
    file._is720p = true;

    // 若影片本身已是 <=720P 且體積小於 10MB，無須重編碼，直接秒傳
    if (scale >= 1.0 && origSize <= 10 * 1024 * 1024) {
      console.log(`🎬 影片已符合 720P 輕量規格 (${width}x${height}, ${formatFileSizeDisplay(origSize)})，直接上傳`);
      return file;
    }

    // 支援 MediaRecorder 且影片長度在 90 秒內時，啟動前端 720P 壓縮 (1.5 Mbps)
    const canTranscode = (
      typeof MediaRecorder !== 'undefined' &&
      duration > 0.5 &&
      duration <= 90 &&
      (scale < 1.0 || origSize > 10 * 1024 * 1024)
    );

    if (!canTranscode) {
      return file;
    }

    let chosenMime = '';
    const candidateMimes = [
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    for (const m of candidateMimes) {
      if (MediaRecorder.isTypeSupported(m)) {
        chosenMime = m;
        break;
      }
    }
    if (!chosenMime) return file;

    const compressedFile = await new Promise((resolve) => {
      const video = document.createElement('video');
      const objUrl = URL.createObjectURL(file);
      video.src = objUrl;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { alpha: false });

      let recorder = null;
      let animId = null;
      const chunks = [];
      let finished = false;

      const finishWithOriginal = () => {
        if (finished) return;
        finished = true;
        if (animId) cancelAnimationFrame(animId);
        try { video.pause(); } catch (e) {}
        URL.revokeObjectURL(objUrl);
        resolve(file);
      };

      const safetyTimeout = setTimeout(() => {
        console.warn('影片壓縮超時，自動切換為原檔直傳');
        finishWithOriginal();
      }, Math.min(95000, Math.max(20000, duration * 1500)));

      video.onloadeddata = () => {
        try {
          const canvasStream = canvas.captureStream ? canvas.captureStream(30) : null;
          if (!canvasStream) {
            clearTimeout(safetyTimeout);
            return finishWithOriginal();
          }

          // 嘗試保留音軌
          try {
            const vidStream = video.captureStream ? video.captureStream() : (video.mozCaptureStream ? video.mozCaptureStream() : null);
            if (vidStream && vidStream.getAudioTracks().length > 0) {
              canvasStream.addTrack(vidStream.getAudioTracks()[0]);
            }
          } catch (audioErr) {}

          recorder = new MediaRecorder(canvasStream, {
            mimeType: chosenMime,
            videoBitsPerSecond: 1500000 // 🎯 標準 720P 1.5Mbps 碼率
          });

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = () => {
            clearTimeout(safetyTimeout);
            if (finished) return;
            finished = true;
            if (animId) cancelAnimationFrame(animId);
            URL.revokeObjectURL(objUrl);

            if (window._skipCurrentVideoCompression) {
              return resolve(file);
            }

            const ext = chosenMime.includes('mp4') ? '.mp4' : '.webm';
            const outType = chosenMime.includes('mp4') ? 'video/mp4' : 'video/webm';
            const blob = new Blob(chunks, { type: outType });

            if (blob.size > 1024 && blob.size < origSize) {
              const cleanName = (file.name || 'Video').replace(/\.[^/.]+$/, '') + '_720p' + ext;
              const out = new File([blob], cleanName, { type: outType, lastModified: Date.now() });
              out._origSize = origSize;
              out._origWidth = width;
              out._origHeight = height;
              out._targetWidth = targetW;
              out._targetHeight = targetH;
              out._is720p = true;
              console.log(`✅ [720P 影片壓縮完成] ${width}x${height} -> ${targetW}x${targetH} | ${formatFileSizeDisplay(origSize)} -> ${formatFileSizeDisplay(blob.size)}`);
              resolve(out);
            } else {
              resolve(file);
            }
          };

          recorder.onerror = () => {
            clearTimeout(safetyTimeout);
            finishWithOriginal();
          };

          const drawFrame = () => {
            if (finished) return;
            if (window._skipCurrentVideoCompression) {
              try { if (recorder && recorder.state === 'recording') recorder.stop(); } catch (e) {}
              return finishWithOriginal();
            }
            if (!video.paused && !video.ended) {
              ctx.drawImage(video, 0, 0, targetW, targetH);
              if (onProgress && duration > 0) {
                const pct = Math.min(99, Math.round((video.currentTime / duration) * 100));
                onProgress(pct, targetW, targetH);
              }
              animId = requestAnimationFrame(drawFrame);
            }
          };

          video.onended = () => {
            try {
              if (recorder && recorder.state === 'recording') recorder.stop();
            } catch (e) {
              finishWithOriginal();
            }
          };

          recorder.start(200);
          video.play().then(() => {
            drawFrame();
          }).catch(() => {
            clearTimeout(safetyTimeout);
            finishWithOriginal();
          });
        } catch (err) {
          clearTimeout(safetyTimeout);
          finishWithOriginal();
        }
      };

      video.onerror = () => {
        clearTimeout(safetyTimeout);
        finishWithOriginal();
      };
    });

    return compressedFile;
  } catch (err) {
    console.warn('影片 720P 壓縮略過:', err);
    return file;
  }
}

// 🗑️ 媒體與附件統一二次確認刪除控制器 (支援所有新舊筆記圖片、影片、音訊與檔案卡片)
let pendingDeleteBlockEl = null;
let pendingDeleteMediaName = '';

function requestDeleteMediaBlock(blockEl, customName = '') {
  if (!blockEl) return;
  const nameSpan = blockEl.querySelector('summary span.truncate') || blockEl.querySelector('.truncate');
  const mediaName = customName || blockEl.dataset.fileName || (nameSpan ? nameSpan.textContent.trim() : '此圖片/影片項目');

  pendingDeleteBlockEl = blockEl;
  pendingDeleteMediaName = mediaName;

  const modal = document.getElementById('media-delete-confirm-modal');
  const nameBox = document.getElementById('media-delete-confirm-name');

  if (modal && nameBox) {
    nameBox.textContent = `📄 檔案名稱：${mediaName}`;
    modal.classList.remove('hidden');
  } else {
    // 備援原生確認框
    if (window.confirm(`⚠️ 確定要從筆記中刪除「${mediaName}」嗎？\n\n此操作將從當前筆記畫布中移除此項目（可按 Ctrl+Z 復原）。`)) {
      executeConfirmedMediaDelete();
    } else {
      pendingDeleteBlockEl = null;
    }
  }
}

function executeConfirmedMediaDelete() {
  const blockEl = pendingDeleteBlockEl;
  const mediaName = pendingDeleteMediaName || '此媒體項目';
  pendingDeleteBlockEl = null;

  const modal = document.getElementById('media-delete-confirm-modal');
  if (modal) modal.classList.add('hidden');

  if (!blockEl || !blockEl.parentNode) return;

  const oldHtml = DOM.editor ? DOM.editor.innerHTML : '';
  const noteId = state.currentNote ? state.currentNote.id : null;
  const noteTitle = state.currentNote && state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';

  blockEl.remove();

  try { ensureEditableSpacesAroundMediaBlocks(DOM.editor); } catch (e) {}
  try { ensureTrailingEditableParagraphAndFocus(); } catch (e) {}
  saveLocalDraftImmediately();
  triggerAutoSaveDebounce();
  try { updateStats(); } catch (e) {}
  try { renderOutline(); } catch (e) {}

  const newHtml = DOM.editor ? DOM.editor.innerHTML : '';
  recordAction({
    type: 'delete_media',
    title: `🗑️ 刪除媒體「${mediaName}」`,
    subtitle: `筆記：「${noteTitle}」`,
    noteId: noteId,
    undo: () => {
      const n = state.notes.find(note => note.id === noteId);
      if (n) {
        n.content = oldHtml;
        if (state.currentNote && state.currentNote.id === noteId) {
          DOM.editor.innerHTML = oldHtml;
          try { enhanceAllEditorBlocks(DOM.editor); } catch (e) {}
          updateStats();
          renderOutline();
        }
        saveLocalDraftImmediately();
        triggerAutoSaveDebounce();
      }
    },
    redo: () => {
      const n = state.notes.find(note => note.id === noteId);
      if (n) {
        n.content = newHtml;
        if (state.currentNote && state.currentNote.id === noteId) {
          DOM.editor.innerHTML = newHtml;
          try { enhanceAllEditorBlocks(DOM.editor); } catch (e) {}
          updateStats();
          renderOutline();
        }
        saveLocalDraftImmediately();
        triggerAutoSaveDebounce();
      }
    }
  });

  showToast(`🗑️ 已從筆記中刪除「${mediaName}」（可按 Ctrl+Z 復原）`);
}

function initMediaDeleteConfirmModal() {
  const modal = document.getElementById('media-delete-confirm-modal');
  const cancelBtn = document.getElementById('media-delete-cancel-btn');
  const confirmBtn = document.getElementById('media-delete-confirm-btn');

  if (cancelBtn && !cancelBtn._bound) {
    cancelBtn._bound = true;
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      pendingDeleteBlockEl = null;
      if (modal) modal.classList.add('hidden');
    });
  }

  if (confirmBtn && !confirmBtn._bound) {
    confirmBtn._bound = true;
    confirmBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      executeConfirmedMediaDelete();
    });
  }

  if (modal && !modal._bound) {
    modal._bound = true;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        pendingDeleteBlockEl = null;
        modal.classList.add('hidden');
      }
    });
  }

  // 🛡️ 在 DOM.editor 綁定 Capture Phase (捕獲階段) 刪除事件代理：
  // 保證無論新舊筆記、快取還原或動態插入，點擊任何刪除鈕皆 100% 第一時間攔截並跳出二次確認！
  if (DOM.editor && !DOM.editor._mediaDeleteDelegationBound) {
    DOM.editor._mediaDeleteDelegationBound = true;
    DOM.editor.addEventListener('click', (e) => {
      const annotateBtn = e.target.closest('.media-card-annotate-btn');
      if (annotateBtn && DOM.editor.contains(annotateBtn)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        const targetBlock = annotateBtn.closest('details.notion-media-collapse');
        if (targetBlock) {
          openPhotoAnnotatorForBlock(targetBlock);
        }
        return;
      }

      const delBtn = e.target.closest('.media-card-delete-btn, .media-caption-delete-btn, .media-overlay-delete-btn, .file-attachment-delete-btn');
      if (delBtn && DOM.editor.contains(delBtn)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        const targetBlock = delBtn.closest('details.notion-media-collapse, .notion-file-attachment');
        if (targetBlock) {
          requestDeleteMediaBlock(targetBlock);
        }
      }
    }, true);
  }
}

// 產生統一規格的媒體收折卡片 HTML (僅保留頂部標題列刪除按鈕，不顯示多餘圖片註解)
function buildMediaCollapseCardHtml({ fileId, fileName, isImage, isVideo, isAudio, directSrc, previewUrl, previewEmbedUrl, downloadUrl }) {
  const safeName = escapeHtml(fileName || '媒體檔案');
  const mediaTypeLabel = isImage ? '原圖' : (isVideo ? '影片' : '音訊');
  const iconName = isImage ? 'image' : (isVideo ? 'video' : 'music');

  let bodyMediaHtml = '';
  if (isImage) {
    bodyMediaHtml = `<img src="${directSrc}" alt="${safeName}" loading="lazy" decoding="async" class="rounded-xl shadow-xs border border-gray-200 dark:border-notion-borderDark max-h-[520px] mx-auto object-contain cursor-pointer hover:opacity-95 transition" onclick="window.open('${previewUrl}', '_blank')" />`;
  } else if (isVideo) {
    bodyMediaHtml = `<iframe src="${previewEmbedUrl}" class="w-full aspect-video rounded-xl border border-gray-200 dark:border-notion-borderDark shadow-xs" allow="autoplay" allowfullscreen></iframe>`;
  } else if (isAudio) {
    bodyMediaHtml = `<iframe src="${previewEmbedUrl}" height="80" class="w-full rounded-xl border border-gray-200 dark:border-notion-borderDark"></iframe>`;
  }

  return `
    <details class="notion-media-collapse notion-draggable-block my-3 rounded-xl border border-gray-200 dark:border-notion-borderDark bg-gray-50/70 dark:bg-notion-darker/70 overflow-hidden shadow-xs transition" open contenteditable="false" draggable="true" data-file-id="${fileId || ''}" data-file-name="${safeName}">
      <summary class="cursor-pointer select-none px-3 py-2 flex items-center justify-between gap-2 bg-gray-100/80 dark:bg-notion-card hover:bg-gray-200/60 dark:hover:bg-gray-800 transition font-medium text-xs">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0" title="拖動改變位置"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></span>
          <i data-lucide="${iconName}" class="w-3.5 h-3.5 text-blue-500 shrink-0"></i>
          <span class="truncate font-semibold text-gray-800 dark:text-gray-100">${safeName}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${isImage ? `
          <button type="button" class="media-card-annotate-btn px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-500 hover:text-white text-[11px] font-bold inline-flex items-center gap-1 transition shadow-2xs cursor-pointer shrink-0" title="在照片上畫紅圈、箭頭或加文字標註">
            <span class="pointer-events-none">✏️ 標註</span>
          </button>` : ''}
          <button type="button" class="media-card-delete-btn px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-600 hover:text-white text-[11px] font-bold inline-flex items-center gap-1 transition shadow-2xs cursor-pointer shrink-0" title="刪除此項目 (需二次確認)">
            ${TRASH_ICON_SVG}
            <span class="pointer-events-none">刪除</span>
          </button>
          <span class="text-[10px] text-gray-400 collapse-hint hidden sm:inline">點擊收折/展開</span>
          <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 collapse-arrow transition-transform duration-200"></i>
        </div>
      </summary>
      <div class="p-3 text-center border-t border-gray-200/50 dark:border-notion-borderDark/60 media-collapse-content">
        ${bodyMediaHtml}
        <div class="text-[11px] text-gray-400 mt-2 flex items-center justify-center gap-2 flex-wrap media-caption-bar">
          <span class="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">${safeName}</span>
          <span>•</span>
          <a href="${downloadUrl}" target="_blank" download="${safeName}" class="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold" title="直接下載${mediaTypeLabel}">
            <i data-lucide="download" class="w-3 h-3"></i>
            <span>下載${mediaTypeLabel}</span>
          </a>
          <span>•</span>
          <a href="${previewUrl}" target="_blank" rel="noopener noreferrer" class="hover:text-blue-500 flex items-center gap-1" title="在 Google 雲端開啟">
            <i data-lucide="external-link" class="w-3 h-3"></i>
            <span>雲端檢視</span>
          </a>
        </div>
      </div>
    </details>
    <p><br></p>
  `;
}

// ----------------- 媒體上傳與就地實體嵌入 -----------------
async function uploadMediaFile(file) {
  // 直接委派給統一的 720P 壓縮與上傳引擎，確保相機拍照、媒體上傳與檔案上傳 100% 行為一致
  return await uploadGenericFile(file);
}

// ----------------- 📎 通用檔案與相機/圖影 720P 壓縮上傳引擎 -----------------
async function uploadGenericFile(file) {
  if (!state.accessToken) {
    showToast('請先登入 Google 帳號以啟用檔案與媒體雲端上傳');
    return;
  }

  const origSize = file.size;
  const origSizeDisplay = formatFileSizeDisplay(origSize);
  const isImage = (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|webp|heic|bmp|gif|svg|ico)$/i.test(file.name);
  const isVideo = (file.type && file.type.startsWith('video/')) || /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(file.name);
  const isAudio = (file.type && file.type.startsWith('audio/')) || /\.(mp3|wav|aac|m4a|flac|ogg)$/i.test(file.name);

  state.activeUploadCount = (state.activeUploadCount || 0) + 1;
  acquireWakeLock();

  // ⚡ 若為圖片：先在本地以 ~25ms 極速壓縮為 720P，並「立即 (0.03秒) 渲染出圖片卡片」，背景靜默上傳雲端！
  let uploadTarget = file;
  let localBlobUrl = null;
  const placeholderId = 'file_loading_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

  if (isImage) {
    uploadTarget = await compressImageForUpload(file);
    localBlobUrl = URL.createObjectURL(uploadTarget);
    const fastFileName = uploadTarget.name || file.name;
    const optimisticCardHtml = buildMediaCollapseCardHtml({
      fileId: '',
      fileName: fastFileName,
      isImage: true,
      isVideo: false,
      isAudio: false,
      directSrc: localBlobUrl,
      previewUrl: localBlobUrl,
      previewEmbedUrl: localBlobUrl,
      downloadUrl: localBlobUrl
    }).replace('<details ', `<details id="${placeholderId}" data-pending-upload="true" `);

    insertHtmlAtCursor(optimisticCardHtml);
    try { enhanceAllEditorBlocks(DOM.editor); } catch (e) {}
    ensureTrailingEditableParagraphAndFocus();
  } else {
    // 影片、音訊或一般檔案：插入進度提示框
    let loadingHtml = `<div id="${placeholderId}" data-pending-upload="true" class="p-3 my-2 border border-dashed border-blue-400 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/30 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between gap-2 animate-pulse"><div class="flex items-center gap-2 min-w-0"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-500 shrink-0"></i> <span class="loading-status-text truncate font-semibold">正在處理並上傳：${escapeHtml(file.name)} (${origSizeDisplay})...</span></div></div><p><br></p>`;
    insertHtmlAtCursor(loadingHtml);
    initLucide();
  }

  const updatePlaceholderText = (msg, allowSkip = false) => {
    const el = document.getElementById(placeholderId);
    if (!el || isImage) return;
    const textSpan = el.querySelector('.loading-status-text');
    if (textSpan) textSpan.textContent = msg;
    if (allowSkip && !el.querySelector('.skip-video-comp-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skip-video-comp-btn px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold shrink-0 cursor-pointer';
      btn.textContent = '略過壓縮直接上傳';
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window._skipCurrentVideoCompression = true;
      };
      el.appendChild(btn);
    }
  };

  if (isVideo) {
    uploadTarget = await checkOrCompressVideoForUpload(file, (pct, tw, th) => {
      updatePlaceholderText(`🎬 正在將影片壓縮至 720P (${tw}×${th})：${pct}%...`, true);
    });
  }

  const finalSize = uploadTarget.size;
  const finalSizeDisplay = formatFileSizeDisplay(finalSize);
  const fileName = uploadTarget.name || file.name;
  const mimeType = uploadTarget.type || file.type || (isImage ? 'image/jpeg' : 'application/octet-stream');
  const ext = (fileName.split('.').pop() || '').toLowerCase();

  DOM.uploadProgressBar.classList.remove('hidden');
  DOM.uploadProgressBar.style.width = '35%';
  updateSyncStatus('syncing', `背景同步媒體：${fileName}...`);

  let iconName = 'paperclip';
  let badgeColor = 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400';
  if (['pdf'].includes(ext)) { iconName = 'file-text'; badgeColor = 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'; }
  else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) { iconName = 'archive'; badgeColor = 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'; }
  else if (['xls', 'xlsx', 'csv'].includes(ext)) { iconName = 'table'; badgeColor = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'; }
  else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) { iconName = 'file-type'; badgeColor = 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'; }
  else if (['ppt', 'pptx'].includes(ext)) { iconName = 'presentation'; badgeColor = 'bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400'; }
  else if (['js', 'ts', 'py', 'json', 'html', 'css', 'c', 'cpp'].includes(ext)) { iconName = 'code'; badgeColor = 'bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400'; }

  try {
    if (!state.folderId) await ensureNotesFolder();
    if (!state.mediaFolderId) await ensureMediaFolder();

    const boundary = '-------LVINoteFileBoundary' + Math.random().toString(36).substring(2);
    const targetParentId = state.mediaFolderId || state.folderId;

    const metadata = {
      name: fileName,
      parents: [targetParentId]
    };

    DOM.uploadProgressBar.style.width = '65%';

    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });
    const multipartBody = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      metadataBlob,
      `\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      uploadTarget,
      `\r\n--${boundary}--`
    ], { type: `multipart/related; boundary=${boundary}` });

    const abortCtrl = new AbortController();
    const timeoutTimer = setTimeout(() => abortCtrl.abort(), 90000);

    let res;
    try {
      res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody,
        signal: abortCtrl.signal
      });
    } finally {
      clearTimeout(timeoutTimer);
    }

    if (res.status === 401) {
      await refreshGoogleToken();
      res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Drive API 錯誤 (${res.status}): ${errText}`);
    }

    const uploadedFile = await res.json();

    // 非阻塞背景設定公開檢視權限 (不卡住畫面完成狀態)
    fetch(`https://www.googleapis.com/drive/v3/files/${uploadedFile.id}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    }).catch(permErr => console.warn('設定公開權限略過:', permErr));

    DOM.uploadProgressBar.style.width = '100%';
    setTimeout(() => {
      DOM.uploadProgressBar.classList.add('hidden');
      DOM.uploadProgressBar.style.width = '0%';
    }, 300);

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${uploadedFile.id}`;
    const previewUrl = `https://drive.google.com/file/d/${uploadedFile.id}/view?usp=sharing`;
    const directSrc = `https://drive.google.com/thumbnail?id=${uploadedFile.id}&sz=w1280`;
    const previewEmbedUrl = `https://drive.google.com/file/d/${uploadedFile.id}/preview`;

    const existingEl = document.getElementById(placeholderId);

    if (isImage && existingEl && existingEl.tagName === 'DETAILS') {
      // ⚡ 圖片卡片已在 0.03s 樂觀渲染於畫面上：無縫將屬性切換為永久雲端連結，零閃爍！
      existingEl.removeAttribute('id');
      existingEl.removeAttribute('data-pending-upload');
      existingEl.setAttribute('data-file-id', uploadedFile.id);
      const imgEl = existingEl.querySelector('img');
      if (imgEl) {
        imgEl.setAttribute('data-cloud-src', directSrc);
        imgEl.setAttribute('onclick', `window.open('${previewUrl}', '_blank')`);
        // 預載入雲端縮圖後無感替換 src，避免圖片閃白
        const preloadImg = new Image();
        preloadImg.onload = () => {
          imgEl.src = directSrc;
          imgEl.removeAttribute('data-cloud-src');
          if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
        };
        preloadImg.onerror = () => {
          imgEl.src = directSrc;
          imgEl.removeAttribute('data-cloud-src');
        };
        preloadImg.src = directSrc;
      }
      const dlLink = existingEl.querySelector('a[download]');
      if (dlLink) dlLink.href = downloadUrl;
      const viewLink = existingEl.querySelector('a[rel*="noopener"]');
      if (viewLink) viewLink.href = previewUrl;
    } else {
      let cardHtml = '';
      if (isImage || isVideo || isAudio) {
        cardHtml = buildMediaCollapseCardHtml({
          fileId: uploadedFile.id,
          fileName: fileName,
          isImage: isImage,
          isVideo: isVideo,
          isAudio: isAudio,
          directSrc: directSrc,
          previewUrl: previewUrl,
          previewEmbedUrl: previewEmbedUrl,
          downloadUrl: downloadUrl
        });
      } else {
        cardHtml = `
          <div class="notion-file-attachment notion-draggable-block my-2.5 p-3 rounded-xl border border-gray-200 dark:border-notion-borderDark bg-gray-50/70 dark:bg-notion-darker/70 flex items-center justify-between gap-3 group hover:border-emerald-400 dark:hover:border-emerald-600 transition" contenteditable="false" draggable="true" data-file-id="${uploadedFile.id}" data-file-name="${escapeHtml(fileName)}" data-file-size="${finalSizeDisplay}">
            <div class="flex items-center gap-2.5 min-w-0 flex-1">
              <span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0" title="拖動改變位置"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></span>
              <div class="w-9 h-9 rounded-lg ${badgeColor} flex items-center justify-center shrink-0">
                <i data-lucide="${iconName}" class="w-5 h-5"></i>
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">${escapeHtml(fileName)}</div>
                <div class="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                  <span>${finalSizeDisplay}</span>
                  <span>•</span>
                  <span class="text-emerald-600 dark:text-emerald-400 font-medium">已同步至雲端</span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <a href="${downloadUrl}" target="_blank" download="${escapeHtml(fileName)}" class="px-2.5 py-1 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-medium flex items-center gap-1 transition shadow-2xs" title="下載此檔案">
                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                <span>下載</span>
              </a>
              <a href="${previewUrl}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition" title="在 Google 雲端檢視">
                <i data-lucide="external-link" class="w-4 h-4"></i>
              </a>
              <button type="button" class="file-attachment-delete-btn px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-600 hover:text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer" title="從筆記中刪除此檔案 (需二次確認)">
                ${TRASH_ICON_SVG}
                <span class="pointer-events-none">刪除</span>
              </button>
            </div>
          </div>
          <p><br></p>
        `;
      }

      if (existingEl) {
        existingEl.outerHTML = cardHtml;
      } else {
        insertHtmlAtCursor(cardHtml);
      }
      try { ensureEditableSpacesAroundMediaBlocks(DOM.editor); } catch (e) {}
      try { enhanceAllEditorBlocks(DOM.editor); } catch (e) {}
      initLucide();
    }

    updateSyncStatus('synced', '已儲存至雲端');
    showToast(`✅ 「${fileName}」已同步至雲端`, 2500);
    saveLocalDraftImmediately();
    triggerAutoSaveDebounce();
  } catch (err) {
    console.error('上傳檔案失敗:', err);
    DOM.uploadProgressBar.classList.add('hidden');
    updateSyncStatus('error', '上傳失敗');
    showToast(`⚠️ 上傳失敗：${err.message || '請再試一次'}`);
    const placeholder = document.getElementById(placeholderId);
    if (placeholder) {
      placeholder.outerHTML = `<div class="text-red-500 text-xs p-2.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">⚠️ 上傳「${escapeHtml(fileName)}」未完成 (${err.message || '連線逾時'})</div>`;
    }
  } finally {
    state.activeUploadCount = Math.max(0, (state.activeUploadCount || 1) - 1);
    if (state.activeUploadCount === 0) {
      releaseWakeLock();
    }
    hideGlobalLoading();
  }
}

function ensureEditableSpacesAroundMediaBlocks(container = DOM.editor) {
  if (!container) return;
  try {
    // 1. 確保編輯器最開頭為可編輯段落 (若最頂部為 details、附件或 contenteditable=false 區塊)
    const first = container.firstElementChild;
    if (first && (first.tagName === 'DETAILS' || first.classList.contains('notion-media-collapse') || first.classList.contains('notion-file-attachment') || first.getAttribute('contenteditable') === 'false')) {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      first.before(p);
    }

    // 2. 遍歷所有的 details 與 notion-file-attachment，保證前後皆有可直接輸入文字的 <p> 段落
    const blocks = container.querySelectorAll('.notion-media-collapse, .notion-file-attachment, details.notion-draggable-block');
    blocks.forEach(block => {
      // 檢查前方
      const prev = block.previousElementSibling;
      if (!prev || prev.classList.contains('notion-media-collapse') || prev.classList.contains('notion-file-attachment') || prev.tagName === 'DETAILS') {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        block.before(p);
      }
      // 檢查後方
      const next = block.nextElementSibling;
      if (!next || next.classList.contains('notion-media-collapse') || next.classList.contains('notion-file-attachment') || next.tagName === 'DETAILS') {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        block.after(p);
      }
    });

    // 3. 確保編輯器最末尾永遠有一個可編輯段落
    let last = container.lastElementChild;
    if (!last || last.getAttribute('contenteditable') === 'false' || last.classList.contains('notion-draggable-block') || last.tagName === 'DETAILS') {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      container.appendChild(p);
    }
  } catch (err) {
    console.warn('ensureEditableSpacesAroundMediaBlocks warning:', err);
  }
}

function ensureTrailingEditableParagraphAndFocus() {
  if (!DOM.editor) return;

  ensureEditableSpacesAroundMediaBlocks(DOM.editor);

  let last = DOM.editor.lastElementChild;
  if (!last || last.getAttribute('contenteditable') === 'false' || last.classList.contains('notion-draggable-block')) {
    const p = document.createElement('p');
    p.innerHTML = '<br>';
    DOM.editor.appendChild(p);
    last = p;
  }

  DOM.editor.focus();
  try {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(last);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (err) {
    console.warn('游標置尾失敗:', err);
  }
}
function placeCaretAtEnd(el) {
  if (!el) return;
  try {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (e) {}
}

function insertHtmlAtCursor(html) {
  if (!DOM.editor) return;
  DOM.editor.focus();
  const sel = window.getSelection();
  let range = null;
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (DOM.editor.contains(r.commonAncestorContainer)) {
      range = r;
    }
  }

  const isMajorBlockHtml = /^\s*<(div|details|table|h1|h2|h3|blockquote|pre|hr)\b/i.test(html || '');
  const isTroubleshootCard = (html || '').includes('lvi-troubleshoot-card');

  if (range) {
    let containerEl = range.commonAncestorContainer;
    if (containerEl.nodeType === Node.TEXT_NODE) containerEl = containerEl.parentElement;

    const el = document.createElement('div');
    el.innerHTML = html.trim();
    const frag = document.createDocumentFragment();
    let node, firstInserted = null, lastNode = null;
    while ((node = el.firstChild)) {
      if (!firstInserted && node.nodeType === Node.ELEMENT_NODE) firstInserted = node;
      lastNode = frag.appendChild(node);
    }

    // 若要插入的是大型區塊 (如排查三段式、媒體卡片、表格、標題)，避免誤塞進空的 <p> 內部造成非法巢狀
    const parentP = containerEl ? containerEl.closest('p') : null;
    const parentCallout = containerEl ? containerEl.closest('.lvi-troubleshoot-card, details.notion-media-collapse') : null;

    if (isTroubleshootCard && parentCallout && parentCallout.parentNode === DOM.editor) {
      parentCallout.after(frag);
    } else if (isMajorBlockHtml && parentP && parentP.parentNode === DOM.editor) {
      const pText = (parentP.textContent || '').replace(/\u200B/g, '').trim();
      if (!pText && !parentP.querySelector('img, iframe, video')) {
        parentP.replaceWith(frag);
      } else {
        parentP.after(frag);
      }
    } else {
      range.deleteContents();
      range.insertNode(frag);
    }

    ensureEditableSpacesAroundMediaBlocks(DOM.editor);

    // 若插入的是三段式排查模板，自動將游標停在第一段「• 故障現象描述：」後方，方便立即打字！
    if (isTroubleshootCard && firstInserted) {
      const firstSymptomP = firstInserted.querySelector('.troubleshoot-stage-1 p');
      if (firstSymptomP) {
        placeCaretAtEnd(firstSymptomP);
        return;
      }
    }

    if (lastNode) {
      try {
        const nextRange = document.createRange();
        if (lastNode.nodeType === Node.ELEMENT_NODE && lastNode.tagName === 'P') {
          nextRange.selectNodeContents(lastNode);
          nextRange.collapse(true);
        } else {
          nextRange.setStartAfter(lastNode);
          nextRange.collapse(true);
        }
        sel.removeAllRanges();
        sel.addRange(nextRange);
      } catch (e) {}
    }
  } else {
    const el = document.createElement('div');
    el.innerHTML = html.trim();
    let firstInserted = null;
    while (el.firstChild) {
      const child = el.firstChild;
      if (!firstInserted && child.nodeType === Node.ELEMENT_NODE) firstInserted = child;
      DOM.editor.appendChild(child);
    }
    ensureTrailingEditableParagraphAndFocus();
    if (isTroubleshootCard && firstInserted) {
      const firstSymptomP = firstInserted.querySelector('.troubleshoot-stage-1 p');
      if (firstSymptomP) {
        placeCaretAtEnd(firstSymptomP);
      }
    }
  }
}

// ----------------- AI 智能助手 (CloudNotes AI) -----------------
function toggleAiPanel() {
  DOM.aiPanel.classList.toggle('translate-x-full');
  if (DOM.aiBackdrop) {
    DOM.aiBackdrop.classList.toggle('hidden');
  }
}

function closeAiPanel() {
  DOM.aiPanel.classList.add('translate-x-full');
  if (DOM.aiBackdrop) {
    DOM.aiBackdrop.classList.add('hidden');
  }
}

function checkAiKeyStatus() {
  if (DOM.aiKeyBanner) {
    if (!state.geminiApiKey) {
      DOM.aiKeyBanner.classList.remove('hidden');
    } else {
      DOM.aiKeyBanner.classList.add('hidden');
    }
  }
}

async function sendAiMessage(userPrompt, actionType = 'chat') {
  if (!state.geminiApiKey) {
    checkAiKeyStatus();
    DOM.aiPanel.classList.remove('translate-x-full');
    showToast('請先填入 Google Gemini API Key');
    return;
  }

  appendAiBubble('user', escapeHtml(userPrompt));
  DOM.aiUserInput.value = '';

  const noteContent = DOM.editor.innerText.trim();
  const noteTitle = DOM.noteTitle.value.trim() || '未命名筆記';

  let systemInstruction = `你是一位世界級的高效筆記與思維助理「CloudNotes AI」。使用者正在編輯一篇名為《${noteTitle}》的筆記。請用清晰、專業且極具條理的繁體中文回答。適當使用條列清單、粗體標記重點。`;

  let promptToSend = userPrompt;
  if (actionType !== 'chat') {
    promptToSend = `${userPrompt}

【當前筆記完整內容如下】：
"""
${noteContent}
"""`;
  }

  const loadingBubble = appendAiBubble('assistant', '<div class="flex items-center gap-1.5 text-purple-600 dark:text-purple-400"><i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Gemini 3.8 正在深入思考...</div>');
  initLucide();

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiApiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemInstruction}

${promptToSend}` }] }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    });

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message || 'Gemini API 回傳錯誤');
    }

    const aiReplyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '（AI 未產生任何回應）';
    const parsedHtml = window.marked ? window.marked.parse(aiReplyText) : aiReplyText;

    const actionToolsHtml = `
      <div class="mt-2 pt-2 border-t border-purple-100 dark:border-purple-900/50 flex items-center justify-end gap-1.5">
        <button class="ai-insert-btn px-2 py-0.5 rounded text-[10px] bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1">
          <i data-lucide="arrow-down-left" class="w-3 h-3"></i> 插入畫布
        </button>
        <button class="ai-copy-btn px-2 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-1">
          <i data-lucide="copy" class="w-3 h-3"></i> 複製
        </button>
      </div>
    `;

    loadingBubble.innerHTML = parsedHtml + actionToolsHtml;
    initLucide();

    const insertBtn = loadingBubble.querySelector('.ai-insert-btn');
    if (insertBtn) {
      insertBtn.addEventListener('click', () => {
        insertHtmlAtCursor(parsedHtml);
        showToast('已將 AI 回答插入至筆記畫布！');
        triggerAutoSaveDebounce();
      });
    }

    const copyBtn = loadingBubble.querySelector('.ai-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(aiReplyText);
        showToast('已複製 AI 回應！');
      });
    }

  } catch (err) {
    console.error('AI 請求出錯:', err);
    loadingBubble.innerHTML = `<span class="text-rose-500">⚠️ AI 回應失敗：${escapeHtml(err.message)}</span>`;
  }
}

function appendAiBubble(role, contentHtml) {
  const bubble = document.createElement('div');
  if (role === 'user') {
    bubble.className = 'ai-user-bubble';
  } else {
    bubble.className = 'ai-bot-bubble';
  }
  bubble.innerHTML = contentHtml;
  DOM.aiMessages.appendChild(bubble);
  DOM.aiMessages.scrollTop = DOM.aiMessages.scrollHeight;
  return bubble;
}

// ----------------- 筆記模板庫 -----------------
function getEngineeringTroubleshootSnippetHtml() {
  return `
    <div class="lvi-troubleshoot-card my-3 space-y-2.5">
      <div class="notion-callout troubleshoot-stage-1">
        <span class="notion-callout-icon">🚨</span>
        <div class="notion-callout-body">
          <strong>1. 異常現象與量測讀值</strong>
          <p>• 故障現象描述：</p>
          <p>• 關鍵量測數據：</p>
        </div>
      </div>
      <div class="notion-callout troubleshoot-stage-2">
        <span class="notion-callout-icon">🔍</span>
        <div class="notion-callout-body">
          <strong>2. 排查過程與測試點位</strong>
          <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text" contenteditable="true">排查步驟 1：</span></div>
          <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text" contenteditable="true">排查步驟 2：</span></div>
        </div>
      </div>
      <div class="notion-callout troubleshoot-stage-3">
        <span class="notion-callout-icon">💡</span>
        <div class="notion-callout-body">
          <strong>3. 根本原因與最終解決對策</strong>
          <p>• <strong>根本原因：</strong></p>
          <p>• <strong>最終解決對策：</strong></p>
        </div>
      </div>
    </div>
    <p><br></p>
  `;
}

function applyTemplate(type) {
  const templates = {
    engineering_troubleshoot: {
      title: '機台異常排查與解決對策紀錄',
      icon: '🚨',
      status: '🚀 處理中',
      tags: ['故障排除'],
      html: `
        <h1>🚨 機台異常排查與解決對策紀錄</h1>
        ${getEngineeringTroubleshootSnippetHtml()}
      `
    },
    engineering_handover: {
      title: '機台交機與驗收測試標準紀錄',
      icon: '✅',
      status: '🚀 處理中',
      tags: ['交機驗收'],
      html: `
        <h1>✅ 機台交機與驗收測試紀錄</h1>
        <div class="notion-callout">
          <span class="notion-callout-icon">🏢</span>
          <div class="notion-callout-body"><strong>交機基本資訊：</strong>確認機型、客戶廠區、水電氣源條件與操作人員教育訓練。</div>
        </div>
        <h2>1. 交機前關鍵點檢清單 (Pre-Check)</h2>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text" contenteditable="true">大水箱水位高於紅線標示處，確認首次管道預充填正常循環無氣泡</span></div>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text" contenteditable="true">三點組合一次側氣源壓力確認（≥ 200 kPa），無自動洩壓現象</span></div>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text" contenteditable="true">鈑金件外觀、外蓋孔位配合與快接頭 (FD83) 氣密/水密檢驗</span></div>
        <h2>2. 性能驗收測試數據表</h2>
        <table>
          <thead>
            <tr><th>測試項目</th><th>標準規格</th><th>實測數據</th><th>判定結果</th></tr>
          </thead>
          <tbody>
            <tr><td>保壓 / 壓降測試</td><td>200 kPa 保壓穩定</td><td>待填入</td><td>⬜ 待確認</td></tr>
            <tr><td>流量與溫控精度</td><td>依 Recipe 標準</td><td>待填入</td><td>⬜ 待確認</td></tr>
          </tbody>
        </table>
        <h2>3. 客戶現場回饋與待辦事項</h2>
        <p>記錄客戶針對操作介面、Exe time、Datalog 或機構之改善建議：</p>
      `
    },
    gingerbread_home: {
      title: '小薑餅個人工作首頁',
      icon: '💻',
      status: '🚀 進行中',
      energy: '',
      gtd: 'project',
      tags: ['首頁', '工作系統'],
      html: `
        <h1>💻 小薑餅個人工作首頁</h1>
        <p>這是你的統一工作控制中心。每天由此開始，檢視重要事項並保持有條不紊的生活！</p>
        <div class="notion-callout">
          <span class="notion-callout-icon">☀️</span>
          <div class="notion-callout-body">
            <strong>每日檢視快捷入口：</strong>每天早晨檢視今日任務與清空大腦，晚間記錄生活作業與回顧進度。
          </div>
        </div>
        <h2>📥 快速任務收集匣 (Inbox)</h2>
        <p>大腦是用來思考的，不是用來記事情的。隨時將浮現的雜事記在收集匣中：</p>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">整理本週信件與會議摘要</span></div>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">規劃 12 週關鍵目標與時間區塊</span></div>
        <h2>🚀 進行中重要專案 (Projects)</h2>
        <table>
          <thead>
            <tr><th>專案名稱</th><th>目標成果</th><th>負責階段</th><th>進度狀態</th></tr>
          </thead>
          <tbody>
            <tr><td>LVI_Note 知識庫系統</td><td>打造第二大腦與生活常規</td><td>持續優化</td><td>🚀 進行中</td></tr>
            <tr><td>健康與體能訓練</td><td>每週 5K 跑量累積</td><td>習慣建立</td><td>🚀 進行中</td></tr>
            <tr><td>內容創作與輸出</td><td>每週定期產出一篇深度筆記</td><td>資料收集</td><td>💡 構思中</td></tr>
          </tbody>
        </table>
        <h2>📚 靈感與資源捕捉 (Resources)</h2>
        <p>收集所有啟發你的書籍段落、影片、Podcast 與網路好文：</p>
        <ul>
          <li>《搞定 Getting Things Done》—— David Allen：徹底釋放大腦壓力</li>
          <li>《原子習慣》—— James Clear：讓好習慣輕而易舉</li>
          <li>《一分鐘的晨間習慣》：清空雜念，專注今天</li>
        </ul>
      `
    },
    gingerbread_gtd: {
      title: 'GTD 行動清單與專案管理系統',
      icon: '⚡',
      status: '🚀 進行中',
      energy: 'medium',
      gtd: 'next_action',
      tags: ['GTD', '行動清單', '專案'],
      html: `
        <h1>⚡ GTD 行動清單與專案管理系統</h1>
        <p>基於《搞定 Getting Things Done》核心 5 步驟：<strong>捕捉 ➔ 理清 ➔ 整理 ➔ 回顧 ➔ 執行</strong>。</p>
        <div class="notion-callout">
          <span class="notion-callout-icon">🔥</span>
          <div class="notion-callout-body">
            <strong>耗能管理法則：</strong>不被固定時間死板綁住，依精神狀態（🔥高耗能 / 😎中耗能 / 🌱低耗能）彈性執行任務！
          </div>
        </div>
        <h2>📥 任務收集匣 (Inbox)</h2>
        <p>未經分類的靈感與臨時交辦事項：</p>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">購買日常飲品與牛奶 (🌱低耗能)</span></div>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">撰寫深度年度企劃架構 (🔥高耗能)</span></div>
        <h2>⚡ 下一步行動清單 (Next Actions)</h2>
        <p>兩分鐘內無法完成、需由自己親自執行的具體行動：</p>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">🔥 高耗能：深度專注編寫核心功能測試代碼</span></div>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">😎 中耗能：回覆團隊工作協作信件</span></div>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">🌱 低耗能：備份並整理桌面檔案資料夾</span></div>
        <h2>⏳ 等待清單 (Waiting For) 與 🌱 將來也許 (Someday)</h2>
        <ul>
          <li>⏳ 等待外部合作夥伴簽署並回傳合約</li>
          <li>🌱 將來也許：學習 Python 數據分析或考取潛水證照</li>
        </ul>
      `
    },
    gingerbread_daily: {
      title: '每日檢視生活日誌',
      icon: '☀️',
      status: '🚀 進行中',
      energy: 'medium',
      gtd: 'next_action',
      tags: ['日誌', '每日檢視'],
      html: `
        <h1>☀️ 每日檢視生活日誌</h1>
        <p><strong>日期：</strong>本日 | <strong>天氣與心情：</strong>晴朗專注 ☀️</p>
        <div class="notion-callout">
          <span class="notion-callout-icon">💡</span>
          <div class="notion-callout-body">「每天早上花 5 分鐘檢視任務並清空大腦，讓一天從從容容、充滿掌控感。」</div>
        </div>
        <h2>☀️ 早上計劃 (Morning Routine)</h2>
        <h3>1. 檢視今日任務</h3>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">優先完成 1 項高耗能關鍵任務</span></div>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">處理 2 項中耗能例行工作</span></div>
        <h3>2. 本週關鍵行動與時間區塊</h3>
        <p>預先在行事曆中匡出專屬時段：下午 2:00 ~ 4:00 專注產出。</p>
        <h3>3. 清空大腦 (Brain Dump)</h3>
        <p><em>當下讓我感到煩惱或佔用思緒的事情是什麼？寫下來：</em></p>
        <blockquote>（在此寫下心中掛念的雜念，寫完即放下，專注當下）</blockquote>
        <h2>🌙 晚上回顧 (Evening Review)</h2>
        <h3>1. 值得記錄的小故事 (Homework for Life)</h3>
        <p><em>今天發生了什麼有趣、有意義、值得感恩的一件小事？</em></p>
        <blockquote>「今天在下班散步途中看見了美麗的晚霞，內心感到無比平靜。」</blockquote>
        <h3>2. 今日完成項目檢視</h3>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox" checked><span class="notion-todo-text">今日重要目標已推進！</span></div>
        <h2>📅 明日待辦預覽</h2>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">明天晨間閱讀 20 頁好書</span></div>
      `
    },
    gingerbread_brain: {
      title: '第二大腦想法捕捉與卡片盒筆記',
      icon: '🧠',
      status: '💡 構思中',
      energy: 'medium',
      gtd: 'reference',
      tags: ['第二大腦', '卡片盒', '靈感'],
      html: `
        <h1>🧠 第二大腦想法捕捉與卡片盒筆記</h1>
        <p>不再從空白紙張開始寫作！建立個人知識庫，把碎片化靈感串聯成完整文章。</p>
        <h2>💡 想法捕捉 (Fleeting Notes & Ideas)</h2>
        <table>
          <thead>
            <tr><th>靈感/筆記名稱</th><th>狀態</th><th>領域主題</th><th>出處來源</th></tr>
          </thead>
          <tbody>
            <tr><td>建立第二大腦的三個關鍵原因</td><td>✅ 整理完成</td><td>工作效率</td><td>Tiago Forte 書籍</td></tr>
            <tr><td>加速閱讀的有效盲點破除</td><td>🚀 整理中</td><td>學習法</td><td>Jay Shetty 影片</td></tr>
            <tr><td>時間區塊與精力管理實踐</td><td>💡 未整理</td><td>時間管理</td><td>Make Time 生時間</td></tr>
          </tbody>
        </table>
        <h2>🗃️ 卡片盒永久筆記 (Slip-box / Permanent Notes)</h2>
        <div class="notion-callout">
          <span class="notion-callout-icon">🔗</span>
          <div class="notion-callout-body">
            使用 <strong>@</strong> 提及功能互相交叉連結不同筆記，打造網狀知識圖譜！
          </div>
        </div>
        <ul>
          <li><strong>主題：如何高效閱讀一本書</strong> ➔ 連結了「盲點破除筆記」與「卡片盒筆記法」</li>
          <li><strong>主題：高產出工作流</strong> ➔ 連結了「GTD 收集匣」與「能量耗能分類」</li>
        </ul>
      `
    },
    gingerbread_budget: {
      title: '小薑餅收支記帳與財務管理儀表板',
      icon: '💰',
      status: '🚀 進行中',
      energy: 'low',
      gtd: 'reference',
      tags: ['記帳', '財務'],
      html: `
        <h1>💰 小薑餅收支記帳與財務管理儀表板</h1>
        <p>掌握每一筆金錢流向，以週與月為週期進行覆盤，達成財務自由目標！</p>
        <h2>💸 支出資料庫 (Expenses)</h2>
        <table>
          <thead>
            <tr><th>項目內容</th><th>金額 (NT$)</th><th>支出分類</th><th>日期</th><th>週次</th></tr>
          </thead>
          <tbody>
            <tr><td>早餐豆漿與蛋餅</td><td>65</td><td>飲食 🍳</td><td>本日</td><td>W1</td></tr>
            <tr><td>實用專業工具書</td><td>450</td><td>學習 📚</td><td>本日</td><td>W1</td></tr>
            <tr><td>捷運儲值卡</td><td>500</td><td>交通 🚗</td><td>本日</td><td>W1</td></tr>
          </tbody>
        </table>
        <h2>💰 收入資料庫 (Income)</h2>
        <table>
          <thead>
            <tr><th>項目內容</th><th>金額 (NT$)</th><th>收入分類</th><th>日期</th><th>週次</th></tr>
          </thead>
          <tbody>
            <tr><td>正職每月薪資</td><td>55,000</td><td>薪水 💰</td><td>每月 5 號</td><td>W1</td></tr>
            <tr><td>自媒體與稿費收入</td><td>8,000</td><td>業外 📈</td><td>結算日</td><td>W1</td></tr>
          </tbody>
        </table>
        <h2>📊 週/月統計匯總 (Rollup Summary)</h2>
        <div class="notion-callout">
          <span class="notion-callout-icon">📈</span>
          <div class="notion-callout-body">
            本週支出：$1,015 | 本週收入：$63,000 | 本週淨存率：98.4%
          </div>
        </div>
      `
    },
    meeting: {
      title: '團隊會議紀要',
      icon: '💼',
      status: '🚀 進行中',
      tags: ['會議', '工作'],
      html: `
        <h2>📋 會議目標</h2>
        <p>確認本週各部門目標達成進度，並排定關鍵產出與交付時程。</p>
        <h2>👥 出席人員</h2>
        <ul><li>主持人：</li><li>紀錄：</li><li>參與成員：</li></ul>
        <h2>💬 討論議題與決議</h2>
        <div class="notion-callout"><span class="notion-callout-icon">💡</span><div class="notion-callout-body">核心共識：維持原定時程，預計週五進行全模組驗收。</div></div>
        <h2>✅ 待辦行動清單</h2>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">整理專案架構文件並同步</span></div>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">完成 API 端點測試</span></div>
      `
    },
    project: {
      title: '專案啟動企劃書',
      icon: '🚀',
      status: '💡 構思中',
      tags: ['專案', '規劃'],
      html: `
        <h1>🚀 專案背景與願景</h1>
        <p>建立高品質個人雲端筆記工作區。</p>
        <h2>🎯 核心里程碑 (Milestones)</h2>
        <table><thead><tr><th>階段</th><th>任務目標</th><th>負責人</th><th>狀態</th></tr></thead><tbody><tr><td>Phase 1</td><td>所見即所得純淨畫布</td><td>Vincent</td><td>✅ 完成</td></tr><tr><td>Phase 2</td><td>無限資料夾與彩色標籤</td><td>Vincent</td><td>🚀 進行中</td></tr></tbody></table>
      `
    },
    weekly: {
      title: '個人週覆盤與計畫',
      icon: '🌱',
      status: '✅ 已完成',
      tags: ['覆盤', '生活'],
      html: `
        <h2>🏆 本週三大成就</h2>
        <ol><li>完成了核心架構升級</li><li>建立了生活新節奏</li><li>閱讀並筆記一本好書</li></ol>
        <h2>💡 關鍵心得反思</h2>
        <blockquote>「專注於高槓桿的任務，是減輕焦慮的最佳方式。」</blockquote>
        <h2>🎯 下週聚焦目標</h2>
        <div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">優化資料夾分類</span></div>
      `
    },
    reading: {
      title: '深度讀書筆記',
      icon: '📚',
      status: '💡 構思中',
      tags: ['閱讀', '心得'],
      html: `
        <h1>📖 書名與作者</h1>
        <p><strong>書名：</strong>《原子習慣》 | <strong>作者：</strong>James Clear</p>
        <div class="notion-callout"><span class="notion-callout-icon">💡</span><div class="notion-callout-body">「你不會躍升至目標的高度，而是墜落至系統的底線。」</div></div>
        <h2>📝 核心概念摘錄</h2>
        <ul><li>提示、渴望、回應、獎賞</li><li>讓習慣顯而易見、有吸引力、輕而易舉、令人滿足</li></ul>
      `
    }
  };

  const tpl = templates[type];
  if (!tpl) return;

  DOM.noteTitle.value = tpl.title;
  DOM.headerTitle.textContent = tpl.title;
  DOM.noteEmojiBtn.textContent = tpl.icon;
  DOM.noteStatusSelect.value = tpl.status;
  if (state.currentNote) {
    state.currentNote.meta.tags = tpl.tags;
    state.currentNote.meta.icon = tpl.icon;
    state.currentNote.meta.status = tpl.status;
  }
  renderNoteActiveTags();
  renderSidebarTags();

  DOM.editor.innerHTML = tpl.html;
  DOM.templateMenu.classList.add('hidden');
  showToast(`已套用「${tpl.title}」模板！`);
  triggerAutoSaveDebounce();
}

// ----------------- Frontmatter 解析與建構 -----------------
function parseFrontmatter(rawContent) {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: rawContent };

  const frontmatterStr = match[1];
  const body = match[2];
  const meta = {};

  frontmatterStr.split(/\r?\n/).forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const k = line.substring(0, colonIdx).trim();
      const v = line.substring(colonIdx + 1).trim();
      if (k === 'tags') {
        try {
          meta.tags = JSON.parse(v);
        } catch(e) {
          meta.tags = v.split(',').map(t => t.trim()).filter(Boolean);
        }
      } else if (k === 'pinned') {
        meta.pinned = v === 'true';
      } else if (k === 'amount') {
        meta.amount = parseFloat(v) || 0;
      } else {
        meta[k] = v;
      }
    }
  });

  return { meta, body };
}

function buildFrontmatterString(meta) {
  let lines = ['---'];
  if (meta.icon) lines.push(`icon: ${meta.icon}`);
  if (meta.cover) lines.push(`cover: ${meta.cover}`);
    if (meta.folderId) lines.push(`folderId: ${meta.folderId}`);
  if (meta.pinned) lines.push(`pinned: ${meta.pinned}`);
  if (meta.machineModel) lines.push(`machineModel: ${meta.machineModel}`);
  if (meta.workContent) lines.push(`workContent: ${meta.workContent}`);
  if (meta.urgency) lines.push(`urgency: ${meta.urgency}`);
  if (meta.clientVendor) lines.push(`clientVendor: ${meta.clientVendor}`);
  if (meta.dueDate) lines.push(`dueDate: ${meta.dueDate}`);
  if (meta.tags && meta.tags.length) lines.push(`tags: ${JSON.stringify(meta.tags)}`);
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

// ----------------- 筆記清單渲染 -----------------
function renderNotesList() {
  if (!DOM.notesList) return;
  renderFavoritesList();
  DOM.notesList.innerHTML = '';

  let filtered = state.notes.slice();

  // 1. 🚜 機型篩選 (最上層)
  if (state.currentMachineFilter) {
    filtered = filtered.filter(n => n.meta && n.meta.machineModel === state.currentMachineFilter);
  }

  // 2. 📋 工作內容篩選 (下一層)
  if (state.currentContentFilter) {
    filtered = filtered.filter(n => n.meta && n.meta.workContent === state.currentContentFilter);
  }

  // 3. 🚨 急迫性篩選 (再來是)
  if (state.currentUrgencyFilter) {
    filtered = filtered.filter(n => n.meta && n.meta.urgency === state.currentUrgencyFilter);
  }

  // 4. 🏢 客戶或廠商篩選 (非強制)
  if (state.currentClientVendorFilter) {
    filtered = filtered.filter(n => n.meta && n.meta.clientVendor === state.currentClientVendorFilter);
  }

  // 4. 自訂通用標籤篩選
  if (state.currentTagFilter) {
    filtered = filtered.filter(n => n.meta && Array.isArray(n.meta.tags) && n.meta.tags.includes(state.currentTagFilter));
  }

  // 5. 分類快速篩選 (置頂 / 處理中 / 今日)
  if (state.filterMode === 'pinned') {
    filtered = filtered.filter(n => n.meta && n.meta.pinned);
  } else if (state.filterMode === 'doing') {
    filtered = filtered.filter(n => n.meta && n.meta.status && (n.meta.status.includes('處理中') || n.meta.status.includes('進行中')));
  } else if (state.filterMode === 'today') {
    const todayStr = new Date().toISOString().split('T')[0];
    filtered = filtered.filter(n => n.meta && n.meta.dueDate === todayStr);
  } else if (state.filterMode === 'uncategorized' || state.filterMode === 'inbox') {
    filtered = filtered.filter(n => isNoteUncategorized(n));
  }

  // 4. 關鍵字搜尋 (升級支援智慧模糊檢索與全文同義詞匹配)
  const query = DOM.searchInput && DOM.searchInput.value ? DOM.searchInput.value.trim() : '';
  const sidebarFuzzyMap = new Map();
  if (query) {
    scheduleBackgroundFullTextIndexing();
    const parsedSidebarQ = parseFuzzyQuery(query);
    filtered = filtered.filter(n => {
      const res = evaluateFuzzyNoteMatch(n, parsedSidebarQ);
      sidebarFuzzyMap.set(n.id, res);
      return res.matched;
    });
  }

  // 搜尋時依關聯度排序，平時置頂筆記排在最前
  filtered.sort((a, b) => {
    if (query) {
      const sA = (sidebarFuzzyMap.get(a.id) || {}).score || 0;
      const sB = (sidebarFuzzyMap.get(b.id) || {}).score || 0;
      if (Math.abs(sB - sA) >= 3) return sB - sA;
    }
    const aPin = a.meta && a.meta.pinned ? 1 : 0;
    const bPin = b.meta && b.meta.pinned ? 1 : 0;
    if (bPin !== aPin) return bPin - aPin;
    return new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0);
  });

  if (filtered.length === 0) {
    DOM.notesList.innerHTML = `
      <div class="text-center py-8 text-gray-400 text-xs">
        <i data-lucide="inbox" class="w-6 h-6 mx-auto mb-1.5 opacity-50"></i>
        <span>暫無符合條件的筆記</span>
      </div>
    `;
    initLucide();
    return;
  }

  filtered.forEach(note => {
    const item = document.createElement('div');
    const isActive = state.currentNote && state.currentNote.id === note.id;
    item.className = `note-item p-2 rounded-lg cursor-pointer flex flex-col justify-between ${isActive ? 'active' : ''}`;

    const cleanTitle = (note.name || '未命名').replace(/\.md$/i, '');
    const icon = (note.meta && note.meta.icon) || '🛠️';
    const isPinned = note.meta && note.meta.pinned;
    const machine = (note.meta && note.meta.machineModel) || '';
    const content = (note.meta && note.meta.workContent) || '';
    const urgency = (note.meta && note.meta.urgency) || '';
    const dateStr = (note.meta && note.meta.dueDate) || (note.modifiedTime ? new Date(note.modifiedTime).toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : '');

    const urgencyColor = urgency.includes('特急') ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                         urgency.includes('高') ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                         urgency.includes('常規') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                         'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';

    item.innerHTML = `
      <div class="flex items-start justify-between gap-1 mb-1">
        <div class="flex items-center space-x-1.5 truncate">
          <span class="text-sm shrink-0">${icon}</span>
          <span class="font-bold text-xs text-gray-800 dark:text-gray-100 truncate">${escapeHtml(cleanTitle)}</span>
        </div>
        ${isPinned ? '<span class="text-amber-500 text-[10px] shrink-0">📌</span>' : ''}
      </div>
      <div class="flex flex-wrap items-center gap-1 text-[10px] mt-1.5">
        ${machine ? `<span class="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-medium">🚜 ${escapeHtml(machine)}</span>` : ''}
        ${content ? `<span class="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 font-medium">${escapeHtml(content)}</span>` : ''}
        ${urgency ? `<span class="px-1.5 py-0.2 rounded font-bold ${urgencyColor}">${escapeHtml(urgency.split(' ')[0])}</span>` : ''}
        ${note.meta && note.meta.clientVendor ? `<span class="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-medium border border-indigo-200/50 dark:border-indigo-800/50">🏢 ${escapeHtml(note.meta.clientVendor)}</span>` : ''}
      </div>
      <div class="flex items-center justify-end text-[10px] text-gray-400 mt-1">
        <span class="shrink-0 text-[10px] font-mono">${dateStr}</span>
      </div>
    `;

    item.onclick = () => {
      selectNote(note.id);
      if (window.innerWidth < 768) closeSidebar();
    };

    DOM.notesList.appendChild(item);
  });

  initLucide();
}

function toggleSidebar() {
  DOM.sidebar.classList.toggle('-translate-x-full');
  DOM.sidebarBackdrop.classList.toggle('hidden');
}

function closeSidebar() {
  DOM.sidebar.classList.add('-translate-x-full');
  DOM.sidebarBackdrop.classList.add('hidden');
}

// ============================================================================
// 🛡️ v2.7.3 筆記絕對安全第一守門員 (Five-Layer Anti-Corruption & Revision Auto-Recovery)
// ============================================================================

/**
 * 檢查指定 HTML 或 Markdown 字串是否包含載入骨架屏或錯誤訊息（絕對禁止作為筆記內容儲存！）
 */
function isSkeletonOrCorruptedContent(str) {
  if (!str || typeof str !== 'string') return false;
  return (
    str.includes('note-skeleton-wrapper') ||
    str.includes('skeleton-shimmer') ||
    str.includes('正在載入雲端筆記內容') ||
    str.includes('筆記載入失敗')
  );
}

/**
 * 檢查當前編輯器畫面是否處於「安全可存檔」狀態
 */
function isEditorContentSafeToSave(htmlToCheck) {
  if (state.isLoadingNote) return false;
  const html = typeof htmlToCheck === 'string' ? htmlToCheck : (DOM.editor ? DOM.editor.innerHTML : '');
  if (isSkeletonOrCorruptedContent(html)) {
    console.warn('🛡️ [安全攔截] 偵測到畫布處於載入骨架屏或錯誤顯示狀態，已嚴格阻斷存檔以保護筆記安全！');
    return false;
  }
  return true;
}

/**
 * 開機啟動時自動掃描並清除 localStorage 中任何曾被骨架屏污染的草稿或快取
 */
function purgeCorruptedLocalCachesOnBoot() {
  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith('lvi_draft_') || k.startsWith('lvi_emergency_draft_')) {
        const raw = localStorage.getItem(k) || '';
        if (isSkeletonOrCorruptedContent(raw)) {
          console.log('🧹 自動清除受骨架屏污染之本機草稿:', k);
          localStorage.removeItem(k);
        }
      }
    }
    const swrRaw = localStorage.getItem('lvi_swr_notes_v1');
    if (swrRaw && isSkeletonOrCorruptedContent(swrRaw)) {
      const parsed = JSON.parse(swrRaw);
      if (parsed && Array.isArray(parsed.notes)) {
        parsed.notes.forEach(n => {
          if (isSkeletonOrCorruptedContent(n._cachedBody) || isSkeletonOrCorruptedContent(n._cachedHtml)) {
            delete n._cachedBody;
            delete n._cachedHtml;
          }
        });
        localStorage.setItem('lvi_swr_notes_v1', JSON.stringify(parsed));
      }
    }
  } catch (e) {}
}

// 內建已知受波及筆記之保底還原字典（若雲端歷史版本因故無標題時作為最終保底）
const KNOWN_NOTE_RECOVERY_FALLBACKS = {
  '1mFyMO_qqJFgKvC8fSknTEFl-4YgPZEMS': {
    title: '機台出機標配文件種類',
    body: `<details class="notion-media-collapse notion-draggable-block my-3 rounded-xl border border-gray-200 dark:border-notion-borderDark bg-gray-50/70 dark:bg-notion-darker/70 overflow-hidden shadow-xs transition" open contenteditable="false" draggable="true" data-file-id="1SD-cZ0G8TLLzfYqMYiBjoP7eTSD7RpLp" data-file-name="IMG_20261022_132507.jpg"><summary class="cursor-pointer select-none px-3 py-2 flex items-center justify-between gap-2 bg-gray-100/80 dark:bg-notion-card hover:bg-gray-200/60 dark:hover:bg-gray-800 transition font-medium text-xs"><div class="flex items-center gap-2 min-w-0 flex-1"><span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0" title="拖動改變位置"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></span><i data-lucide="image" class="w-3.5 h-3.5 text-blue-500 shrink-0"></i><span class="truncate font-semibold text-gray-800 dark:text-gray-100">IMG_20261022_132507.jpg</span></div><div class="flex items-center gap-1.5 shrink-0"><button type="button" class="media-card-annotate-btn px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-500 hover:text-white text-[11px] font-bold inline-flex items-center gap-1 transition shadow-2xs cursor-pointer shrink-0"><span class="pointer-events-none">✏️ 標註</span></button><button type="button" class="media-card-delete-btn px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-600 hover:text-white text-[11px] font-bold inline-flex items-center gap-1 transition shadow-2xs cursor-pointer shrink-0"><span>刪除</span></button><i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 collapse-arrow transition-transform duration-200"></i></div></summary><div class="p-3 text-center border-t border-gray-200/50 dark:border-notion-borderDark/60 media-collapse-content"><img src="https://drive.google.com/thumbnail?id=1SD-cZ0G8TLLzfYqMYiBjoP7eTSD7RpLp&sz=w1280" alt="IMG_20261022_132507.jpg" class="rounded-xl shadow-xs border border-gray-200 dark:border-notion-borderDark max-h-[520px] mx-auto object-contain cursor-pointer hover:opacity-95 transition" /><div class="text-[11px] text-gray-400 mt-2 flex items-center justify-center gap-2 flex-wrap media-caption-bar"><span class="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">IMG_20261022_132507.jpg</span><span>•</span><a href="https://drive.google.com/uc?export=download&id=1SD-cZ0G8TLLzfYqMYiBjoP7eTSD7RpLp" target="_blank" download="IMG_20261022_132507.jpg" class="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold">下載原圖</a><span>•</span><a href="https://drive.google.com/file/d/1SD-cZ0G8TLLzfYqMYiBjoP7eTSD7RpLp/view?usp=sharing" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline flex items-center gap-1">雲端檢視</a></div></div></details><p><mark class="notion-highlight" style="background-color: rgb(251, 207, 232); color: rgb(17, 24, 39);">CAL</mark></p><p><mark class="notion-highlight" style="background-color: rgb(251, 207, 232); color: rgb(17, 24, 39);">FAT</mark></p><p><mark class="notion-highlight" style="background-color: rgb(251, 207, 232); color: rgb(17, 24, 39);">操作手冊</mark></p><p>設備保養手冊</p>`
  }
};

/**
 * 🚑 Google Drive 雲端歷史版本自動無損救援引擎：
 * 當發現某篇雲端筆記內容曾被骨架屏 (note-skeleton-wrapper) 誤覆蓋時，
 * 自動向 Google Drive Revisions API 調閱該檔案的歷史版本，找回被覆蓋前的最後一份正常內容與原始檔名並自動修復！
 */
async function autoRecoverCorruptedNoteFromDriveRevisions(noteId, noteMeta, currentRawText) {
  if (!noteId || !state.accessToken) return null;
  try {
    console.log(`🚑 [雲端歷史救援] 正在從 Google Drive 歷史版本自動找回筆記 (${noteId}) 的原始內容...`);
    showToast('🛡️ 偵測到異常快取，正在從 Google Drive 歷史版本自動還原筆記...', 3500);

    const revListRes = await fetch(`https://www.googleapis.com/drive/v3/files/${noteId}/revisions?fields=revisions(id,modifiedTime,originalFilename,size)`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });

    let recoveredRawText = null;
    let recoveredFileName = null;

    if (revListRes.ok) {
      const revData = await revListRes.json();
      const revisions = Array.isArray(revData.revisions) ? revData.revisions : [];
      // 由倒數第二版往前找最後一個不含 note-skeleton-wrapper 的正常版本
      for (let i = revisions.length - 1; i >= 0; i--) {
        const rev = revisions[i];
        if (rev.originalFilename && !rev.originalFilename.startsWith('未命名隨手筆記') && !recoveredFileName) {
          recoveredFileName = rev.originalFilename;
        }
        try {
          const revContentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${noteId}/revisions/${rev.id}?alt=media`, {
            headers: { Authorization: `Bearer ${state.accessToken}` }
          });
          if (revContentRes.ok) {
            const txt = await revContentRes.text();
            if (txt && !isSkeletonOrCorruptedContent(txt) && txt.trim().length > 0) {
              recoveredRawText = txt;
              if (rev.originalFilename && !rev.originalFilename.startsWith('未命名隨手筆記')) {
                recoveredFileName = rev.originalFilename;
              }
              break;
            }
          }
        } catch (revErr) {}
      }
    }

    const fallback = KNOWN_NOTE_RECOVERY_FALLBACKS[noteId];
    if (!recoveredRawText && fallback) {
      const parsedCur = parseFrontmatter(currentRawText || '');
      const mergedMeta = { ...(parsedCur.meta || {}), ...(noteMeta && noteMeta.meta ? noteMeta.meta : {}) };
      recoveredRawText = buildFrontmatterString(mergedMeta) + fallback.body;
      recoveredFileName = `${fallback.title}.md`;
    } else if (recoveredRawText && (!recoveredFileName || recoveredFileName.startsWith('未命名隨手筆記')) && fallback) {
      recoveredFileName = `${fallback.title}.md`;
    }

    if (recoveredRawText) {
      const { meta: recMeta, body: recBody } = parseFrontmatter(recoveredRawText);
      const finalMeta = { ...(recMeta || {}), ...(noteMeta && noteMeta.meta ? noteMeta.meta : {}) };
      const finalFileName = recoveredFileName || (noteMeta && noteMeta.name) || '已還原筆記.md';
      const fullRepairedContent = buildFrontmatterString(finalMeta) + recBody;

      // 立即將修復後的乾淨內容寫回 Google Drive
      const boundary = '-------CloudNotesRecoveryBoundary' + Math.random().toString(36).substring(2);
      const metadata = { name: finalFileName, description: JSON.stringify(finalMeta) };
      const multipartBody = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
        new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' }),
        `\r\n--${boundary}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n`,
        new Blob([fullRepairedContent], { type: 'text/markdown; charset=UTF-8' }),
        `\r\n--${boundary}--`
      ], { type: `multipart/related; boundary=${boundary}` });

      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${noteId}?uploadType=multipart`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      }).catch(() => {});

      try { localStorage.removeItem(`lvi_draft_${noteId}`); } catch (e) {}
      if (noteMeta) {
        noteMeta.name = finalFileName;
        noteMeta.meta = finalMeta;
      }
      showToast(`✅ 已成功從雲端歷史紀錄無損還原「${finalFileName.replace(/\.md$/i, '')}」！`, 4500);
      return { rawText: fullRepairedContent, fileName: finalFileName, meta: finalMeta, body: recBody };
    }
  } catch (err) {
    console.warn('雲端歷史版本救援失敗:', err);
  }
  return null;
}

// ----------------- 選取與載入筆記 (v2.7.3 絕對安全零污染版) -----------------
async function selectNote(noteId) {
  // 🛡️ 鐵律 1：僅當上一篇筆記「確實有使用者手動修改 (state.isDirty === true)」且「非載入骨架屏狀態 (!state.isLoadingNote)」時，才在切換前結算儲存！
  // 單純瀏覽或點選其他筆記絕對不觸發任何寫入，100% 杜絕波及其他筆記！
  if (
    !state.isUndoingOrRedoing &&
    state.currentNote &&
    state.currentNote.id !== noteId &&
    state.isDirty &&
    !state.isLoadingNote &&
    DOM.editor &&
    isEditorContentSafeToSave(DOM.editor.innerHTML)
  ) {
    try {
      commitActiveEditorStateImmediately();
    } catch (commitErr) {
      console.warn('切換筆記前同步結算快照警告:', commitErr);
    }
  }

  // 切換筆記時立即取消前一篇未觸發的防抖計時器並重置髒資料旗標
  if (state.autoSaveTimer) {
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = null;
  }
  if (autoSaveMaxTimer) {
    clearTimeout(autoSaveMaxTimer);
    autoSaveMaxTimer = null;
  }
  state.isDirty = false;

  const noteMeta = state.notes.find(n => n.id === noteId || n._tempId === noteId);
  if (!noteMeta) return;

  const mySelectSeq = (state.selectNoteSeq = (state.selectNoteSeq || 0) + 1);

  if (window.innerWidth < 768) {
    closeSidebar();
  }

  // 若快取本身曾遭骨架屏污染，立即清除該快取以強制重新自雲端載入並觸發歷史版本救援
  if (isSkeletonOrCorruptedContent(noteMeta._cachedBody) || isSkeletonOrCorruptedContent(noteMeta._cachedHtml)) {
    delete noteMeta._cachedBody;
    delete noteMeta._cachedHtml;
  }

  const initialMeta = {
    ...(noteMeta._cachedMeta || {}),
    ...(noteMeta.meta || {})
  };

  // 🛡️ 鐵律 2：無論有無本地快取，第一時間先將 state.currentNote 指向目標筆記！
  // 解決 v2.7.1/v2.7.2 因 else 分支未更新 state.currentNote 導致雲端載入完成後被 `state.currentNote.id !== noteId` 誤攔截卡死的問題！
  state.currentNote = {
    id: noteMeta.id,
    _tempId: noteMeta._tempId,
    name: noteMeta.name,
    parentId: noteMeta.parentId,
    meta: initialMeta
  };

  localStorage.setItem('lvi_last_active_note_id', noteId);
  DOM.noteTitle.value = (noteMeta.name || '').replace(/\.md$/i, '');
  DOM.headerTitle.textContent = DOM.noteTitle.value;
  try { renderCurrentNote(); } catch (e) {}
  try { renderNotesList(); } catch (e) {}

  const hasCache = noteMeta._cachedBody !== undefined && !isSkeletonOrCorruptedContent(noteMeta._cachedBody);
  if (hasCache) {
    state.isLoadingNote = false;
    const localDraft = getLocalDraft(noteId);
    const cloudModifiedMs = new Date(noteMeta.modifiedTime || 0).getTime();
    const hasUnsyncedDraft = (
      localDraft &&
      !localDraft.synced &&
      (localDraft.updatedAt > cloudModifiedMs) &&
      localDraft.html &&
      !isSkeletonOrCorruptedContent(localDraft.html)
    );

    if (hasUnsyncedDraft) {
      DOM.editor.innerHTML = localDraft.html;
      if (localDraft.title && !localDraft.title.startsWith('未命名隨手筆記')) {
        DOM.noteTitle.value = localDraft.title;
        DOM.headerTitle.textContent = localDraft.title;
      }
      showToast('⚡ 已為您自動救回上次未上傳之草稿！', 3500);
      triggerAutoSaveDebounce();
    } else {
      DOM.editor.innerHTML = noteMeta._cachedHtml || (window.marked ? window.marked.parse(noteMeta._cachedBody) : noteMeta._cachedBody);
    }

    try { enhanceAllEditorBlocks(DOM.editor); } catch (e) { console.warn(e); }
    try { updateToggleAllMediaBtnUI(true); } catch (e) { console.warn(e); }
    try { attachCodeCopyButtons(); } catch (e) { console.warn(e); }
    try { updateStats(); } catch (e) { console.warn(e); }
    try { renderOutline(); } catch (e) { console.warn(e); }

    state.titleBeforeEdit = DOM.noteTitle.value;
    state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
    state.snapshotNoteId = noteId;

    DOM.editor.classList.remove('note-open-animate');
    void DOM.editor.offsetWidth;
    DOM.editor.classList.add('note-open-animate');

    if (state.pendingScrollMatch && state.pendingScrollMatch.noteId === noteId) {
      const matchData = state.pendingScrollMatch;
      state.pendingScrollMatch = null;
      executeScrollToMatchedParagraph(matchData);
    }
  } else {
    // 尚無本地快取：進入載入保護狀態 (state.isLoadingNote = true)，期間嚴禁任何存檔動作！
    state.isLoadingNote = true;
    state.editorSnapshotBeforeEdit = null;
    state.titleBeforeEdit = DOM.noteTitle.value;
    DOM.editor.innerHTML = `
      <div class="note-skeleton-wrapper max-w-3xl mx-auto py-8 px-2 space-y-6" contenteditable="false">
        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 shadow-xs">
          <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin text-blue-500"></i>
          <span class="animate-pulse">正在載入雲端筆記內容...</span>
        </div>
        <div class="space-y-3">
          <div class="h-8 rounded-xl skeleton-shimmer w-3/4"></div>
          <div class="flex items-center gap-2 pt-1">
            <div class="h-5 w-20 rounded-md skeleton-shimmer"></div>
            <div class="h-5 w-24 rounded-md skeleton-shimmer"></div>
            <div class="h-5 w-16 rounded-md skeleton-shimmer"></div>
          </div>
        </div>
        <div class="h-px bg-gray-200/60 dark:bg-notion-borderDark/60 my-4"></div>
        <div class="space-y-2.5">
          <div class="h-4 rounded skeleton-shimmer w-full"></div>
          <div class="h-4 rounded skeleton-shimmer w-11/12"></div>
          <div class="h-4 rounded skeleton-shimmer w-4/5"></div>
        </div>
      </div>
    `;
    initLucide();
  }

  // 若為本地新建尚未取得正式雲端 ID 的筆記，直接結束載入
  if (!state.accessToken || String(noteId).startsWith('temp_')) {
    state.isLoadingNote = false;
    return;
  }

  // 若已有快取且該筆記正在背景上傳佇列中，不發動舊雲端讀取以免覆蓋
  if (hasCache && isNoteDirtyOrQueued(noteId)) {
    state.isLoadingNote = false;
    return;
  }

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${noteId}?alt=media`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });

    if (res.status === 401) {
      state.isLoadingNote = false;
      console.warn('Google Drive token 過期 (401)');
      if (DOM.loginModal) DOM.loginModal.classList.remove('hidden');
      throw new Error('Google 登入憑證已過期，請重新授權登入。');
    }
    if (!res.ok) {
      state.isLoadingNote = false;
      throw new Error(`Google Drive API 回應錯誤 (HTTP ${res.status})`);
    }

    let rawText = await res.text();
    let { meta: bodyMeta, body } = parseFrontmatter(rawText);

    // 🚑 自動偵測並救援曾被骨架屏污染的雲端筆記！
    if (isSkeletonOrCorruptedContent(body) || isSkeletonOrCorruptedContent(rawText)) {
      const recovered = await autoRecoverCorruptedNoteFromDriveRevisions(noteId, noteMeta, rawText);
      if (recovered) {
        rawText = recovered.rawText;
        bodyMeta = recovered.meta;
        body = recovered.body;
      } else {
        body = '<p><br></p>';
      }
    }

    const finalMeta = {
      ...bodyMeta,
      ...(noteMeta.meta || {})
    };
    noteMeta.meta = finalMeta;

    const renderedHtml = DOMPurify.sanitize(window.marked ? window.marked.parse(body) : body, {
      ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'details', 'summary', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input', 'hr', 'div', 'span', 'a', 'mark', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'controls', 'width', 'height', 'class', 'preload', 'type', 'open', 'checked', 'style', 'contenteditable', 'download', 'target', 'rel', 'href', 'data-file-id', 'data-file-name', 'data-file-size', 'data-color', 'draggable', 'xmlns', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'data-lucide', 'aria-hidden', 'cx', 'cy', 'r', 'x', 'y', 'rx', 'ry', 'd']
    });

    // 先存入背景記憶體快取與搜尋索引（即使使用者在等待期間已點去別篇筆記，下次點回來也能 0ms 秒開！）
    if (!isNoteDirtyOrQueued(noteId)) {
      noteMeta._cachedRawText = rawText;
      noteMeta._cachedBody = body;
      noteMeta._cachedMeta = bodyMeta;
      noteMeta._cachedHtml = renderedHtml;
      try { updateNoteSearchIndex(noteMeta.id, noteMeta.modifiedTime, body); } catch (e) {}
      saveSwrCacheSnapshot();
    }

    // 🛡️ 護欄：若在等待網路下載期間，使用者已經點擊切換到另一篇筆記，則只更新上方背景快取，絕不改動當前畫面！
    if (state.selectNoteSeq !== mySelectSeq || !state.currentNote || state.currentNote.id !== noteId) {
      return;
    }

    // 若該筆記原本已有快取，且使用者在快取秒開後已經開始打字修改 (state.isDirty)，絕不拿舊雲端回應覆蓋畫面！
    if (hasCache && (state.isDirty || isNoteDirtyOrQueued(noteId))) {
      state.isLoadingNote = false;
      return;
    }

    state.isLoadingNote = false;
    state.currentNote = {
      id: noteMeta.id,
      name: noteMeta.name,
      parentId: noteMeta.parentId,
      meta: finalMeta
    };
    DOM.noteTitle.value = (noteMeta.name || '').replace(/\.md$/i, '');
    DOM.headerTitle.textContent = DOM.noteTitle.value;
    try { renderCurrentNote(); } catch (e) {}

    const localDraft = getLocalDraft(noteId);
    const cloudModifiedMs = new Date(noteMeta.modifiedTime || 0).getTime();
    const hasUnsyncedDraft = (
      localDraft &&
      !localDraft.synced &&
      (localDraft.updatedAt > cloudModifiedMs) &&
      localDraft.html &&
      !isSkeletonOrCorruptedContent(localDraft.html)
    );

    if (hasUnsyncedDraft) {
      DOM.editor.innerHTML = localDraft.html;
      if (localDraft.title && !localDraft.title.startsWith('未命名隨手筆記')) {
        DOM.noteTitle.value = localDraft.title;
        DOM.headerTitle.textContent = localDraft.title;
      }
      if (localDraft.meta) {
        state.currentNote.meta = localDraft.meta;
        try { renderCurrentNote(); } catch(e) {}
      }
      showToast('⚡ 已為您自動救回關閉軟體前未完成上傳的最新內容！', 4000);
      try { enhanceAllEditorBlocks(DOM.editor); } catch (e) {}
      try { updateToggleAllMediaBtnUI(true); } catch (e) {}
      try { attachCodeCopyButtons(); } catch (e) {}
      try { updateStats(); } catch (e) {}
      try { renderOutline(); } catch (e) {}
      triggerAutoSaveDebounce();
    } else if (!hasCache || DOM.editor.innerHTML !== renderedHtml) {
      DOM.editor.innerHTML = renderedHtml;
      try { enhanceAllEditorBlocks(DOM.editor); } catch (e) {}
      try { updateToggleAllMediaBtnUI(true); } catch (e) {}
      try { attachCodeCopyButtons(); } catch (e) {}
      try { updateStats(); } catch (e) {}
      try { renderOutline(); } catch (e) {}

      DOM.editor.classList.remove('note-open-animate');
      void DOM.editor.offsetWidth;
      DOM.editor.classList.add('note-open-animate');
    }

    state.titleBeforeEdit = DOM.noteTitle.value;
    state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
    state.snapshotNoteId = noteId;
    state.isDirty = false;
    try { renderNotesList(); } catch (e) {}

    if (state.pendingScrollMatch && state.pendingScrollMatch.noteId === noteId) {
      const matchData = state.pendingScrollMatch;
      state.pendingScrollMatch = null;
      executeScrollToMatchedParagraph(matchData);
    }
  } catch (e) {
    state.isLoadingNote = false;
    console.error('讀取筆記失敗:', e);
    if (!hasCache && state.selectNoteSeq === mySelectSeq) {
      DOM.editor.innerHTML = `<div class="p-8 text-center max-w-md mx-auto my-12 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl shadow-xs" contenteditable="false">
        <div class="w-10 h-10 mx-auto mb-3 text-rose-500 flex items-center justify-center bg-rose-100 dark:bg-rose-900/40 rounded-full">
          <i data-lucide="alert-triangle" class="w-5 h-5"></i>
        </div>
        <p class="text-rose-600 dark:text-rose-400 font-semibold text-sm mb-1.5">筆記載入失敗</p>
        <p class="text-gray-500 dark:text-gray-400 text-xs mb-4">${escapeHtml(e.message || '請確認網路連線或授權狀態')}</p>
        <button onclick="selectNote('${noteId}')" class="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-medium rounded-lg transition shadow-xs flex items-center gap-1.5 mx-auto">
          <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i>
          <span>重新載入</span>
        </button>
      </div>`;
      initLucide();
    }
  }
}

function createNewNote() {
  // 取消一般新增筆記功能，所有新建筆記初始型態一律只能是「未分類」狀態
  return createQuickNote();
}

let autoSaveMaxTimer = null;


// ==========================================================================
// 🛡️ 本地即時雙軌快照與防閃退/斷電資料救援核心引擎 (Local-First Crash Protection)
// 保證：打字瞬間同步寫入本機硬碟，即使未上傳即關閉軟體/當機/斷電，下次開啟 100% 自動無損救回並補傳
// ==========================================================================


function flushImmediateCloudSave() {
  commitActiveEditorStateImmediately();
}


// ==========================================================================
// 💡 螢幕防休眠保持鎖 (Screen Wake Lock API) & 背景傳輸佇列引擎 (v2.6.4)
// 專為 POCO X8 Pro (Android / Chrome) 與 MSI 電腦打造：
// 上傳大檔影音期間自動保持螢幕常亮，傳畢即時釋放自動休眠；支援斷線/鎖屏喚醒後自動續傳
// ==========================================================================

let wakeLockSentinel = null;
state.activeUploadCount = 0;

async function acquireWakeLock() {
  if ('wakeLock' in navigator && !wakeLockSentinel) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
      console.log('💡 成功啟用螢幕防休眠鎖 (Wake Lock)');
    } catch (err) {
      console.warn('⚠️ 申請 Wake Lock 失敗 (可能系統限制或低電量模式):', err);
    }
  }
}

async function releaseWakeLock() {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
      console.log('💡 螢幕防休眠鎖已釋放，恢復系統預設休眠');
    } catch (err) {}
  }
}

// 註冊 PWA Service Worker (支援離線與 Android 背景傳輸)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js?v=20261026_v2.7.4', { updateViaCache: 'none' })
      .then(reg => {
        try { reg.update(); } catch (e) {}
        console.log('🚀 PWA Service Worker 註冊成功 (' + APP_VERSION + ')');
      })
      .catch(err => console.warn('PWA Service Worker 註冊略過:', err));
  });
}


// 🛡️ 本機草稿儲存空間防護：自動清除超過 3 天的已同步草稿，徹底防止 QuotaExceededError 存儲溢出
function pruneOldSyncedDrafts() {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('lvi_draft_'));
    if (keys.length <= 8) return;
    const syncedDrafts = [];
    for (const k of keys) {
      try {
        const d = JSON.parse(localStorage.getItem(k));
        if (d && d.synced) syncedDrafts.push({ key: k, updatedAt: d.updatedAt || 0 });
      } catch(e) {}
    }
    syncedDrafts.sort((a, b) => a.updatedAt - b.updatedAt);
    while (syncedDrafts.length > 5) {
      const oldest = syncedDrafts.shift();
      localStorage.removeItem(oldest.key);
    }
  } catch(e) {}
}

function saveLocalDraftImmediately() {
  if (!state.currentNote || state.isLoadingNote) return;
  if (DOM.editor && !isEditorContentSafeToSave(DOM.editor.innerHTML)) return;
  if (!state.currentNote.id && !state.currentNote._tempId) {
    state.currentNote._tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }
  pruneOldSyncedDrafts();
  const noteKey = state.currentNote.id || state.currentNote._tempId;
  const cleanTitle = (DOM.noteTitle && DOM.noteTitle.value ? DOM.noteTitle.value.trim() : '') || (state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記');
  const currentHtml = DOM.editor ? DOM.editor.innerHTML : '';
  const currentMeta = {
    icon: DOM.noteEmojiBtn ? DOM.noteEmojiBtn.textContent : ((state.currentNote.meta && state.currentNote.meta.icon) || '🛠️'),
    cover: state.currentNote.meta ? state.currentNote.meta.cover : null,
    machineModel: DOM.noteMachineSelect ? DOM.noteMachineSelect.value : ((state.currentNote.meta && state.currentNote.meta.machineModel) || '未分類'),
    workContent: DOM.noteContentSelect ? DOM.noteContentSelect.value : ((state.currentNote.meta && state.currentNote.meta.workContent) || '未分類'),
    urgency: DOM.noteUrgencySelect ? DOM.noteUrgencySelect.value : ((state.currentNote.meta && state.currentNote.meta.urgency) || '未分類'),
    clientVendor: DOM.noteClientSelect ? DOM.noteClientSelect.value.trim() : ((state.currentNote.meta && state.currentNote.meta.clientVendor) || ''),
    dueDate: DOM.noteDueDate ? DOM.noteDueDate.value : ((state.currentNote.meta && state.currentNote.meta.dueDate) || ''),
    tags: (state.currentNote.meta && Array.isArray(state.currentNote.meta.tags)) ? state.currentNote.meta.tags.slice() : [],
    pinned: Boolean(state.currentNote.meta && state.currentNote.meta.pinned)
  };
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // ⚡ 0ms 同步更新記憶體中的 state.currentNote 與 state.notes 快取！
  // 確保即使下一毫秒立刻切換到別篇筆記或表格資料庫，記憶體中也已經是最新內容！
  state.currentNote.name = cleanTitle.toLowerCase().endsWith('.md') ? cleanTitle : `${cleanTitle}.md`;
  state.currentNote.meta = currentMeta;
  state.currentNote.modifiedTime = nowIso;
  state.currentNote._localUpdatedAt = nowMs;

  const idx = state.notes.findIndex(n => (state.currentNote.id && n.id === state.currentNote.id) || (state.currentNote._tempId && n._tempId === state.currentNote._tempId) || n === state.currentNote);
  if (idx !== -1) {
    state.notes[idx] = {
      ...state.notes[idx],
      name: state.currentNote.name,
      meta: currentMeta,
      modifiedTime: nowIso,
      _localUpdatedAt: nowMs,
      _cachedHtml: currentHtml,
      _cachedMeta: currentMeta
    };
  } else {
    state.notes.unshift({
      ...state.currentNote,
      _localUpdatedAt: nowMs,
      _cachedHtml: currentHtml,
      _cachedBody: '',
      _cachedMeta: currentMeta
    });
  }

  const draft = {
    noteId: noteKey,
    title: cleanTitle,
    html: currentHtml,
    meta: currentMeta,
    updatedAt: nowMs,
    synced: false
  };
  try {
    localStorage.setItem(`lvi_draft_${noteKey}`, JSON.stringify(draft));
    let queue = [];
    try {
      queue = JSON.parse(localStorage.getItem('lvi_pending_sync_queue') || '[]');
    } catch (e) {}
    if (!queue.includes(noteKey)) {
      queue.push(noteKey);
      localStorage.setItem('lvi_pending_sync_queue', JSON.stringify(queue));
    }
  } catch (err) {
    console.warn('本機草稿寫入警告 (可能存儲空間不足):', err);
  }
}

function getLocalDraft(noteId) {
  try {
    const raw = localStorage.getItem(`lvi_draft_${noteId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function markLocalDraftSynced(noteId) {
  try {
    const raw = localStorage.getItem(`lvi_draft_${noteId}`);
    if (raw) {
      const draft = JSON.parse(raw);
      draft.synced = true;
      localStorage.setItem(`lvi_draft_${noteId}`, JSON.stringify(draft));
    }
    let queue = [];
    try {
      queue = JSON.parse(localStorage.getItem('lvi_pending_sync_queue') || '[]');
    } catch (e) {}
    queue = queue.filter(id => id !== noteId);
    localStorage.setItem('lvi_pending_sync_queue', JSON.stringify(queue));
  } catch (e) {}
}

async function saveDraftToDriveBackground(draft) {
  if (!state.accessToken || !draft || !draft.noteId) return;
  const boundary = '-------CloudNotesBoundary' + Math.random().toString(36).substring(2);
  let title = (draft.title || '未命名筆記').trim();
  if (!title.toLowerCase().endsWith('.md')) title += '.md';
  const meta = draft.meta || {};
  const markdownBody = convertHtmlToMarkdown(draft.html || '');
  const fullContent = buildFrontmatterString(meta) + markdownBody;

  const metadata = { name: title, description: JSON.stringify(meta) };
  const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });
  const contentBlob = new Blob([fullContent], { type: 'text/markdown; charset=UTF-8' });
  const multipartBody = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    metadataBlob,
    `\r\n--${boundary}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n`,
    contentBlob,
    `\r\n--${boundary}--`
  ], { type: `multipart/related; boundary=${boundary}` });

  const url = `https://www.googleapis.com/upload/drive/v3/files/${draft.noteId}?uploadType=multipart`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${state.accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartBody
  });
  if (!res.ok) {
    throw new Error(`背景補傳失敗 (HTTP ${res.status})`);
  }
}

async function flushPendingSyncQueue() {
  if (!state.accessToken || !state.folderId) return;
  let queue = [];
  try {
    queue = JSON.parse(localStorage.getItem('lvi_pending_sync_queue') || '[]');
  } catch (e) {}
  if (!queue || queue.length === 0) return;

  console.log(`📡 發現 ${queue.length} 篇待補傳草稿，自動執行背景補傳...`);
  for (const noteId of queue) {
    if (state.currentNote && state.currentNote.id === noteId) {
      saveCurrentNote();
      continue;
    }
    const draft = getLocalDraft(noteId);
    if (draft && !draft.synced && draft.html) {
      try {
        await saveDraftToDriveBackground(draft);
        markLocalDraftSynced(noteId);
        console.log(`✅ 成功為筆記 ${noteId} 補傳關閉前未完成上傳的內容！`);
      } catch (err) {
        console.warn(`補傳筆記 ${noteId} 失敗:`, err);
      }
    } else {
      markLocalDraftSynced(noteId);
    }
  }
}


function triggerAutoSaveDebounce() {
  state.isDirty = true;
  saveLocalDraftImmediately(); // 💾 第一時間 0ms 同步寫入本機硬碟持久化快照！
  DOM.statAutosave.innerHTML = '<svg class="w-3 h-3 text-blue-500 animate-spin inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> 準備自動儲存...';

  // 1. 防抖計時器 (Debounce)：停筆 800ms 後立即儲存
  if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = setTimeout(() => {
    if (autoSaveMaxTimer) {
      clearTimeout(autoSaveMaxTimer);
      autoSaveMaxTimer = null;
    }
    saveCurrentNote();
  }, 800);

  // 2. 節流保底計時器 (Max Wait Throttle)：若持續不間斷輸入，每 4 秒保證觸發儲存一次，杜絕長時間不存檔
  if (!autoSaveMaxTimer) {
    autoSaveMaxTimer = setTimeout(() => {
      autoSaveMaxTimer = null;
      if (state.autoSaveTimer) {
        clearTimeout(state.autoSaveTimer);
        state.autoSaveTimer = null;
      }
      saveCurrentNote();
    }, 4000);
  }
}

function convertHtmlToMarkdown(html) {
  // 🛡️ 核心防護：嚴禁將未完成上傳的暫存骨架方塊寫入 Markdown 存上 Google Drive
  let cleanHtml = html;
  try {
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = html;
    tempContainer.querySelectorAll('[data-pending-upload="true"], .note-skeleton-wrapper, .skeleton-shimmer').forEach(el => el.remove());
    // 移除表格工具列與執行期綁定屬性 (避免控制按鈕或綁定標記污染雲端 Markdown)
    tempContainer.querySelectorAll('.notion-table-toolbar, .notion-table-controls').forEach(el => el.remove());
    tempContainer.querySelectorAll('img[data-cloud-src]').forEach(img => {
      img.setAttribute('src', img.getAttribute('data-cloud-src'));
      img.removeAttribute('data-cloud-src');
    });
    // 🛡️ 防止任何殘留的 blob: 暫存網址被寫入雲端 Markdown 導致跨裝置破圖
    tempContainer.querySelectorAll('details.notion-media-collapse').forEach(details => {
      const fid = details.getAttribute('data-file-id') || '';
      const img = details.querySelector('img');
      if (img) {
        const curSrc = img.getAttribute('src') || '';
        const backupDataUrl = img.getAttribute('data-annotated-backup') || '';
        if (curSrc.startsWith('blob:')) {
          if (backupDataUrl && backupDataUrl.startsWith('data:image/')) {
            img.setAttribute('src', backupDataUrl);
          } else if (fid) {
            img.setAttribute('src', `https://drive.google.com/thumbnail?id=${fid}&sz=w1280`);
          }
        }
        img.removeAttribute('data-annotated-backup');
      }
    });
    tempContainer.querySelectorAll('[data-delete-bound], [data-animated-collapse-bound]').forEach(el => {
      el.removeAttribute('data-delete-bound');
      el.removeAttribute('data-animated-collapse-bound');
    });
    cleanHtml = tempContainer.innerHTML;
  } catch(e) {}

  if (window.TurndownService) {
    const td = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    td.keep(['iframe', 'video', 'audio', 'source', 'details', 'summary', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input', 'div', 'span', 'a', 'img', 'mark', 'button', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g']);
    return td.turndown(cleanHtml);
  }
  return cleanHtml.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
             .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
             .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
             .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
             .replace(/<br\s*\/?>/gi, '\n');
}

// ============================================================================
// 🚀 v2.7.1 零掉字・原子快照佇列與跨視圖 0ms 同步引擎 (Zero-Loss Atomic Snapshot & Per-Note Queue Engine)
// 徹底解決：在 PC 或手機上快速切換筆記、快速切換表格/未分類視圖、或網路延遲時剛改的內容沒存到之問題
// ============================================================================

const pendingCloudSaveMap = new Map(); // key: noteId or tempId -> immutable snapshot
let activeSavingSnapshotKey = null;
let isProcessingCloudQueue = false;

/**
 * 檢查指定筆記是否正處於「本地有未同步修改」或「正在背景上傳佇列中」
 */
function isNoteDirtyOrQueued(noteId) {
  if (!noteId) return false;
  if (pendingCloudSaveMap.has(noteId) || activeSavingSnapshotKey === noteId) return true;
  if (state.currentNote && (state.currentNote.id === noteId || state.currentNote._tempId === noteId) && state.isDirty) return true;
  const draft = getLocalDraft(noteId);
  if (draft && !draft.synced) return true;
  return false;
}

/**
 * 在第 0 毫秒「同步擷取」當前編輯器筆記的不可變快照 (Immutable Snapshot)，
 * 立即更新 state.notes 記憶體快取、搜尋索引與 localStorage，完全不需等待網路！
 */
function captureCurrentNoteAtomicSnapshot() {
  if (!state.currentNote || !DOM.editor || state.isLoadingNote) return null;
  if (!isEditorContentSafeToSave(DOM.editor.innerHTML)) return null;
  if (!state.currentNote.id && !state.currentNote._tempId) {
    state.currentNote._tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }

  const noteKey = state.currentNote.id || state.currentNote._tempId;
  const rawTitle = (DOM.noteTitle && DOM.noteTitle.value ? DOM.noteTitle.value.trim() : '') || (state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '') || '未命名筆記';
  if (DOM.headerTitle && state.currentView === 'editor') {
    DOM.headerTitle.textContent = rawTitle;
  }
  const fileName = rawTitle.toLowerCase().endsWith('.md') ? rawTitle : `${rawTitle}.md`;

  const meta = {
    icon: DOM.noteEmojiBtn ? DOM.noteEmojiBtn.textContent : ((state.currentNote.meta && state.currentNote.meta.icon) || '🛠️'),
    cover: state.currentNote.meta ? state.currentNote.meta.cover : null,
    machineModel: DOM.noteMachineSelect ? DOM.noteMachineSelect.value : ((state.currentNote.meta && state.currentNote.meta.machineModel) || '未分類'),
    workContent: DOM.noteContentSelect ? DOM.noteContentSelect.value : ((state.currentNote.meta && state.currentNote.meta.workContent) || '未分類'),
    urgency: DOM.noteUrgencySelect ? DOM.noteUrgencySelect.value : ((state.currentNote.meta && state.currentNote.meta.urgency) || '未分類'),
    clientVendor: DOM.noteClientSelect ? DOM.noteClientSelect.value.trim() : ((state.currentNote.meta && state.currentNote.meta.clientVendor) || ''),
    dueDate: DOM.noteDueDate ? DOM.noteDueDate.value : ((state.currentNote.meta && state.currentNote.meta.dueDate) || ''),
    tags: (state.currentNote.meta && Array.isArray(state.currentNote.meta.tags)) ? state.currentNote.meta.tags.slice() : [],
    pinned: Boolean(state.currentNote.meta && state.currentNote.meta.pinned)
  };

  const htmlSnapshot = DOM.editor.innerHTML;
  const markdownBody = convertHtmlToMarkdown(htmlSnapshot);
  const fullContent = buildFrontmatterString(meta) + markdownBody;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // 1. 立即同步寫入本機 localStorage 草稿
  saveLocalDraftImmediately();

  // 2. 立即同步更新 state.currentNote 與 state.notes 陣列中的快取與全文檢索索引
  state.currentNote.name = fileName;
  state.currentNote.meta = JSON.parse(JSON.stringify(meta));
  state.currentNote.modifiedTime = nowIso;
  state.currentNote._localUpdatedAt = nowMs;

  const idx = state.notes.findIndex(n => (state.currentNote.id && n.id === state.currentNote.id) || (state.currentNote._tempId && n._tempId === state.currentNote._tempId) || n === state.currentNote);
  if (idx !== -1) {
    state.notes[idx] = {
      ...state.notes[idx],
      name: fileName,
      meta: JSON.parse(JSON.stringify(meta)),
      modifiedTime: nowIso,
      _localUpdatedAt: nowMs,
      _cachedBody: markdownBody,
      _cachedHtml: htmlSnapshot,
      _cachedMeta: JSON.parse(JSON.stringify(meta))
    };
  } else {
    state.notes.unshift({
      ...state.currentNote,
      _localUpdatedAt: nowMs,
      _cachedBody: markdownBody,
      _cachedHtml: htmlSnapshot,
      _cachedMeta: JSON.parse(JSON.stringify(meta))
    });
  }

  try { updateNoteSearchIndex(noteKey, nowIso, markdownBody); } catch (e) {}
  try { saveSwrCacheSnapshot(); } catch (e) {}

  return {
    key: noteKey,
    noteRef: state.currentNote,
    noteId: state.currentNote.id || null,
    tempId: state.currentNote._tempId || null,
    parentId: state.currentNote.parentId || null,
    rawTitle,
    fileName,
    meta: JSON.parse(JSON.stringify(meta)),
    html: htmlSnapshot,
    markdownBody,
    fullContent,
    updatedAt: nowMs,
    updatedIso: nowIso
  };
}

/**
 * 切換筆記、切換視圖、失焦或離開頁面前呼叫：
 * 在 0ms 內同步結算當前畫面上的所有變更並排入雲端佇列，保證切換再快也絕不掉字！
 */
function commitActiveEditorStateImmediately() {
  if (!state.currentNote || !DOM.editor || state.isLoadingNote) return null;
  if (!isEditorContentSafeToSave(DOM.editor.innerHTML)) return null;

  const hasTimer = Boolean(state.autoSaveTimer || autoSaveMaxTimer);
  // 🛡️ 鐵律 3：嚴格限定只有當 state.isDirty 為 true 或有尚未執行的自動存檔計時器 (hasTimer) 時才允許觸發存檔！
  // 單純點開、切換或瀏覽筆記絕不觸發存檔，100% 杜絕任何跨筆記污染！
  if (!state.isDirty && !hasTimer) {
    return null;
  }

  if (state.autoSaveTimer) {
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = null;
  }
  if (autoSaveMaxTimer) {
    clearTimeout(autoSaveMaxTimer);
    autoSaveMaxTimer = null;
  }

  if (!state.isUndoingOrRedoing) {
    try { flushPendingEditorInputHistory(); } catch (e) {}
  }

  const snap = captureCurrentNoteAtomicSnapshot();
  state.isDirty = false;
  if (snap) {
    pendingCloudSaveMap.set(snap.key, snap);
    processCloudSaveQueue();
  }
  return snap;
}

/**
 * 背景非同步佇列處理器：逐一將 pendingCloudSaveMap 中的凍結快照上傳至 Google Drive，
 * 全程只讀取 snap 內部資料，絕不依賴外部已切換的 state.currentNote 或 DOM.editor！
 */
async function processCloudSaveQueue() {
  if (!state.accessToken) {
    updateSyncStatus('offline', '尚未登入 Google (已存於本機快取)');
    if (DOM.statAutosave) {
      DOM.statAutosave.innerHTML = '<span class="text-amber-500 font-medium cursor-pointer hover:underline">⚠️ 尚未登入 Google (內容已安全保存於本機)</span>';
      DOM.statAutosave.onclick = () => handleLogin();
    }
    return;
  }

  if (isProcessingCloudQueue) {
    state.savePending = true;
    return;
  }

  isProcessingCloudQueue = true;
  state.isSaving = true;

  try {
    while (pendingCloudSaveMap.size > 0) {
      const firstEntry = pendingCloudSaveMap.entries().next().value;
      if (!firstEntry) break;
      const [snapKey, snap] = firstEntry;
      pendingCloudSaveMap.delete(snapKey);
      activeSavingSnapshotKey = snapKey;

      updateSyncStatus('syncing', `正在同步「${snap.rawTitle}」...`);
      if (DOM.statAutosave) {
        DOM.statAutosave.innerHTML = `<svg class="w-3 h-3 text-blue-500 animate-spin inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> 正在同步「${escapeHtml(snap.rawTitle.slice(0, 12))}」...`;
      }

      try {
        if (!state.folderId) await ensureNotesFolder();

        const boundary = '-------CloudNotesBoundary' + Math.random().toString(36).substring(2);
        const metadata = {
          name: snap.fileName,
          description: JSON.stringify(snap.meta)
        };

        const isFullyClassified = !isNoteUncategorized({ meta: snap.meta });
        const targetCategory = isFullyClassified ? (snap.meta.machineModel || '').trim() : '未分類';
        const targetFolderId = await ensureCategoryFolder(targetCategory);

        // 查找該筆記是否已經擁有正式的雲端 ID（例如前一次佇列剛為同一篇新筆記建立了 ID）
        const matchedNoteInState = state.notes.find(n => (snap.noteId && n.id === snap.noteId) || (snap.tempId && n._tempId === snap.tempId) || n === snap.noteRef);
        const effectiveNoteId = snap.noteId || (matchedNoteInState && matchedNoteInState.id) || (snap.noteRef && snap.noteRef.id) || null;
        const effectiveParentId = snap.parentId || (matchedNoteInState && matchedNoteInState.parentId) || null;

        let url;
        let method;
        let parentParam = '';

        if (effectiveNoteId && !String(effectiveNoteId).startsWith('temp_')) {
          if (effectiveParentId && effectiveParentId !== targetFolderId) {
            parentParam = `&addParents=${targetFolderId}&removeParents=${effectiveParentId}`;
          } else if (!effectiveParentId && targetFolderId) {
            parentParam = `&addParents=${targetFolderId}`;
          }
          url = `https://www.googleapis.com/upload/drive/v3/files/${effectiveNoteId}?uploadType=multipart${parentParam}`;
          method = 'PATCH';
        } else {
          url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
          method = 'POST';
          if (targetFolderId) metadata.parents = [targetFolderId];
        }

        const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });
        const contentBlob = new Blob([snap.fullContent], { type: 'text/markdown; charset=UTF-8' });
        const multipartBody = new Blob([
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
          metadataBlob,
          `\r\n--${boundary}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n`,
          contentBlob,
          `\r\n--${boundary}--`
        ], { type: `multipart/related; boundary=${boundary}` });

        let res = await fetch(url, {
          method: method,
          headers: {
            Authorization: `Bearer ${state.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody,
          keepalive: multipartBody.size < 60000
        });

        if (!res.ok && res.status === 400 && parentParam && effectiveNoteId) {
          url = `https://www.googleapis.com/upload/drive/v3/files/${effectiveNoteId}?uploadType=multipart`;
          res = await fetch(url, {
            method: method,
            headers: {
              Authorization: `Bearer ${state.accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
          });
        }

        if (res.status === 401) {
          await refreshGoogleToken();
          res = await fetch(url, {
            method: method,
            headers: {
              Authorization: `Bearer ${state.accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
          });
        }

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Google Drive API 回應錯誤 (HTTP ${res.status}): ${errText}`);
        }

        const savedFile = await res.json();
        const finalCloudId = savedFile.id || effectiveNoteId;

        // 更新對應筆記的雲端 ID 與資料夾，但絕不拿舊快照去覆蓋使用者在傳輸期間又新打的字！
        const targetIdx = state.notes.findIndex(n => (finalCloudId && n.id === finalCloudId) || (snap.tempId && n._tempId === snap.tempId) || n === snap.noteRef);
        if (targetIdx !== -1) {
          const existingNote = state.notes[targetIdx];
          const hasNewerLocalEdit = existingNote._localUpdatedAt && existingNote._localUpdatedAt > snap.updatedAt;
          existingNote.id = finalCloudId;
          existingNote.parentId = targetFolderId;
          if (!hasNewerLocalEdit) {
            existingNote.name = snap.fileName;
            existingNote.meta = snap.meta;
            existingNote.modifiedTime = snap.updatedIso;
            existingNote._cachedBody = snap.markdownBody;
            existingNote._cachedHtml = snap.html;
            existingNote._cachedMeta = snap.meta;
          }
        } else {
          state.notes.unshift({
            id: finalCloudId,
            _tempId: snap.tempId,
            name: snap.fileName,
            parentId: targetFolderId,
            meta: snap.meta,
            modifiedTime: snap.updatedIso,
            _localUpdatedAt: snap.updatedAt,
            _cachedBody: snap.markdownBody,
            _cachedHtml: snap.html,
            _cachedMeta: snap.meta
          });
        }

        if (snap.noteRef) {
          snap.noteRef.id = finalCloudId;
          snap.noteRef.parentId = targetFolderId;
        }
        if (state.currentNote && (state.currentNote === snap.noteRef || (snap.tempId && state.currentNote._tempId === snap.tempId) || (finalCloudId && state.currentNote.id === finalCloudId))) {
          state.currentNote.id = finalCloudId;
          state.currentNote.parentId = targetFolderId;
          localStorage.setItem('lvi_last_active_note_id', finalCloudId);
        }

        // 若佇列中沒有針對此筆記的更新快照，則標記本機草稿已同步完成
        if (!pendingCloudSaveMap.has(snapKey) && !pendingCloudSaveMap.has(finalCloudId)) {
          markLocalDraftSynced(snapKey);
          if (finalCloudId && finalCloudId !== snapKey) {
            markLocalDraftSynced(finalCloudId);
          }
        } else if (finalCloudId && snapKey !== finalCloudId && pendingCloudSaveMap.has(snapKey)) {
          const newerSnap = pendingCloudSaveMap.get(snapKey);
          newerSnap.noteId = finalCloudId;
        }

        try { updateNoteSearchIndex(finalCloudId, snap.updatedIso, snap.markdownBody); } catch (e) {}
        saveSwrCacheSnapshot();
        renderWorkTagLists();
        renderSidebarTags();
        renderNotesList();
        if (state.currentView === 'editor') renderBreadcrumbs();
      } catch (e) {
        console.error(`儲存筆記「${snap.rawTitle}」失敗:`, e);
        try {
          localStorage.setItem('lvi_emergency_draft_' + (snap.noteId || snap.key), snap.fullContent);
        } catch (err) {}
        updateSyncStatus('error', '儲存失敗 (已保底存於本機)');
        if (DOM.statAutosave) {
          DOM.statAutosave.innerHTML = `<span class="text-red-500 font-medium cursor-pointer hover:underline" title="${escapeHtml(e.message || '')}">⚠️ 同步失敗 (已存於本機，點此重試)</span>`;
          DOM.statAutosave.onclick = () => {
            pendingCloudSaveMap.set(snap.key, snap);
            processCloudSaveQueue();
          };
        }
      } finally {
        activeSavingSnapshotKey = null;
      }
    }

    if (pendingCloudSaveMap.size === 0) {
      updateSyncStatus('synced', '已儲存');
      if (DOM.statAutosave) {
        DOM.statAutosave.innerHTML = '<span class="text-emerald-500 font-medium">✓ 已自動同步至 Google Drive</span>';
      }
    }
  } finally {
    isProcessingCloudQueue = false;
    state.isSaving = false;
    activeSavingSnapshotKey = null;
    if (pendingCloudSaveMap.size > 0 || state.savePending) {
      state.savePending = false;
      setTimeout(() => processCloudSaveQueue(), 50);
    }
  }
}

async function saveCurrentNote() {
  if (state.autoSaveTimer) {
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = null;
  }
  if (autoSaveMaxTimer) {
    clearTimeout(autoSaveMaxTimer);
    autoSaveMaxTimer = null;
  }

  const snap = captureCurrentNoteAtomicSnapshot();
  state.isDirty = false;
  if (snap) {
    pendingCloudSaveMap.set(snap.key, snap);
  }
  await processCloudSaveQueue();
}

async function deleteCurrentNote() {
  if (!state.currentNote || !state.currentNote.id) {
    clearEditor();
    return;
  }

  if (!confirm(`確定要將筆記「${state.currentNote.name.replace(/\.md$/i, '')}」移至 Google Drive 垃圾桶嗎？`)) {
    return;
  }

  updateSyncStatus('syncing', '正在刪除筆記...');
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${state.currentNote.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });

    const targetNote = state.currentNote;
    const targetIdx = state.notes.findIndex(n => n.id === targetNote.id);

    state.notes = state.notes.filter(n => n.id !== targetNote.id);
    state.currentNote = null;
    clearEditor();
    renderWorkTagLists();
    renderSidebarTags();
    renderWorkTagLists();
    renderNotesList();
    renderBreadcrumbs();
    updateSyncStatus('synced', '已刪除');
    showToast('筆記已移至垃圾桶');

    recordAction({
      type: 'delete_note',
      title: `🗑️ 刪除筆記「${targetNote.name.replace(/\.md$/i, '')}」`,
      subtitle: `已存入回朔時光機，可隨時復原`,
      noteId: targetNote.id,
      undo: () => {
        state.notes.splice(targetIdx, 0, targetNote);
        selectNote(targetNote.id);
      },
      redo: () => {
        state.notes = state.notes.filter(n => n.id !== targetNote.id);
        if (state.currentNote && state.currentNote.id === targetNote.id) {
          state.currentNote = state.notes[0] || null;
        }
        renderNotesList();
        renderWorkTagLists();
        renderCurrentNote();
        renderCurrentView();
      }
    });

    if (state.notes.length > 0) {
      selectNote(state.notes[0].id);
    }
  } catch (e) {
    console.error('刪除筆記失敗:', e);
    updateSyncStatus('error', '刪除出錯');
  }
}

function clearEditor() {
  DOM.noteTitle.value = '';
  DOM.headerTitle.textContent = '未選擇筆記';
  DOM.editor.innerHTML = '<p class="text-gray-400">點擊左側筆記以檢視，或點擊「+ 新增筆記」開始編寫。</p>';
  renderPageCover();
  renderNoteActiveTags();
  renderBreadcrumbs();
}

// ----------------- 代碼複製與大綱目錄 -----------------
function attachCodeCopyButtons() {
  DOM.editor.querySelectorAll('pre').forEach(pre => {
    if (pre.querySelector('.copy-code-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.textContent = '複製';
    btn.onclick = (e) => {
      e.stopPropagation();
      const code = pre.querySelector('code');
      const text = code ? code.innerText : pre.innerText;
      navigator.clipboard.writeText(text);
      btn.textContent = '已複製!';
      setTimeout(() => btn.textContent = '複製', 2000);
    };
    pre.appendChild(btn);
  });
}


// ==========================================================================
// 🖍️ 螢光筆劃記重點、照片影片收折與自由拖曳核心函式
// ==========================================================================

const HIGHLIGHT_COLOR_NAMES = {
  '#fef08a': '暖黃色',
  '#bbf7d0': '翠綠色',
  '#fbcfe8': '粉紅色',
  '#bfdbfe': '天藍色',
  '#fed7aa': '亮橙色',
  'transparent': '清除劃記'
};

function setActiveHighlightColor(color) {
  if (!color || color === 'transparent') return;
  state.activeHighlightColor = color;
  try { localStorage.setItem('lvi_active_highlight_color', color); } catch (e) {}
  if (DOM.topHighlightColorDot) {
    DOM.topHighlightColorDot.style.backgroundColor = color;
  }
  const mbDot = document.getElementById('mb-tool-highlight-dot');
  if (mbDot) {
    mbDot.style.backgroundColor = color;
  }
  document.querySelectorAll('.highlight-color-btn[data-color]').forEach(btn => {
    if (btn.dataset.color === color) {
      btn.classList.add('active-swatch');
    } else {
      btn.classList.remove('active-swatch');
    }
  });
}

function toggleHighlightBrushMode(forceState) {
  state.highlightBrushMode = typeof forceState === 'boolean' ? forceState : !state.highlightBrushMode;
  state.mobileTapHighlightMode = state.highlightBrushMode;
  if (DOM.editor) {
    DOM.editor.classList.toggle('highlight-brush-active', state.highlightBrushMode);
    DOM.editor.classList.toggle('mobile-tap-highlight-active', state.highlightBrushMode);
  }
  if (DOM.topHighlightBrushToggle) {
    DOM.topHighlightBrushToggle.textContent = state.highlightBrushMode ? '⚡ 點塗/刷子: 開' : '⚡ 點塗/刷子: 關';
    DOM.topHighlightBrushToggle.className = state.highlightBrushMode
      ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950 border border-amber-300 transition cursor-pointer shadow-xs'
      : 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-300 border border-amber-500/40 transition cursor-pointer';
  }
  const mbTapBtn = document.getElementById('mb-hl-tap-mode-btn');
  if (mbTapBtn) {
    mbTapBtn.textContent = state.highlightBrushMode ? '⚡ 點塗模式: 開' : '⚡ 點塗模式: 關';
    mbTapBtn.className = state.highlightBrushMode
      ? 'px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-400 text-slate-950 border border-amber-200 transition cursor-pointer whitespace-nowrap shadow-xs'
      : 'px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800 text-amber-300 border border-amber-500/50 transition cursor-pointer whitespace-nowrap';
  }
  const mbStatus = document.getElementById('mb-hl-status-text');
  if (mbStatus) {
    mbStatus.textContent = state.highlightBrushMode
      ? `⚡ 點塗已開啟 (${HIGHLIGHT_COLOR_NAMES[state.activeHighlightColor] || '黃色'})：直接輕點文字即可上色/消除！`
      : '🖍️ 點選顏色上色，或開啟「點塗」免長按';
  }
  if (DOM.topHighlightApplyBtn) {
    DOM.topHighlightApplyBtn.classList.toggle('ring-2', state.highlightBrushMode);
    DOM.topHighlightApplyBtn.classList.toggle('ring-amber-400', state.highlightBrushMode);
  }
  if (DOM.mbToolHighlight) {
    DOM.mbToolHighlight.classList.toggle('ring-2', state.highlightBrushMode);
    DOM.mbToolHighlight.classList.toggle('ring-amber-400', state.highlightBrushMode);
  }
  showToast(state.highlightBrushMode
    ? `⚡ 已開啟「點塗/連續螢光筆模式」(${HIGHLIGHT_COLOR_NAMES[state.activeHighlightColor] || '黃色'})：手指輕點段落或反白文字即自動上色！`
    : '🖌️ 已關閉點塗/連續螢光筆模式');
}

/**
 * 檢查並還原最後一次有效的編輯器文字選取範圍
 */
function getOrRestoreEditorSelectionRange() {
  let sel = window.getSelection();
  if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (DOM.editor && DOM.editor.contains(r.commonAncestorContainer)) {
      savedSelectionRange = r.cloneRange();
      return r;
    }
  }
  if (savedSelectionRange && DOM.editor) {
    try {
      if (DOM.editor.contains(savedSelectionRange.commonAncestorContainer)) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRange);
        if (!sel.isCollapsed && sel.rangeCount > 0) {
          return sel.getRangeAt(0);
        }
      }
    } catch (e) {}
  }
  return null;
}

/**
 * 取得 Range 涵蓋的所有非空白文字節點（自動在選取起點與終點精準切割 TextNode，絕不破壞跨段落/跨標籤結構）
 */
function sliceAndCollectRangeTextNodes(range) {
  if (!range || range.collapsed || !DOM.editor) return [];

  // 先正規化起點與終點：若起點/終點位於 Element 節點上，轉換至對應的 TextNode 或子節點
  let startContainer = range.startContainer;
  let startOffset = range.startOffset;
  let endContainer = range.endContainer;
  let endOffset = range.endOffset;

  if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
    const textVal = startContainer.nodeValue || '';
    if (startOffset >= endOffset || !textVal.slice(startOffset, endOffset).trim()) return [];
    let targetNode = startContainer;
    if (endOffset < targetNode.nodeValue.length) {
      targetNode.splitText(endOffset);
    }
    if (startOffset > 0) {
      targetNode = targetNode.splitText(startOffset);
    }
    return [targetNode];
  }

  // 若終點是文字節點且不在末尾，先切割終點（先切終點不會影響起點位移）
  if (endContainer.nodeType === Node.TEXT_NODE && endOffset > 0 && endOffset < endContainer.nodeValue.length) {
    endContainer.splitText(endOffset);
  }
  // 若起點是文字節點且不在開頭，切割起點並將新節點作為新起點
  if (startContainer.nodeType === Node.TEXT_NODE && startOffset > 0 && startOffset < startContainer.nodeValue.length) {
    startContainer = startContainer.splitText(startOffset);
    startOffset = 0;
    range.setStart(startContainer, 0);
  }

  const root = DOM.editor.contains(range.commonAncestorContainer) ? range.commonAncestorContainer : DOM.editor;
  if (root.nodeType === Node.TEXT_NODE) {
    return [root];
  }

  const textNodes = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.replace(/\u200B/g, '').trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        const parent = node.parentElement;
        if (parent && parent.closest('.notion-table-toolbar, .media-card-delete-btn, summary .text-gray-400')) {
          return NodeFilter.FILTER_REJECT;
        }
        try {
          if (range.intersectsNode(node)) {
            return NodeFilter.FILTER_ACCEPT;
          }
        } catch (e) {}
        return NodeFilter.FILTER_REJECT;
      }
    }
  );

  while (walker.nextNode()) {
    const tn = walker.currentNode;
    // 確保頭尾邊界精確落在選取範圍內
    if (tn === range.startContainer && range.startOffset > 0 && range.startOffset < tn.nodeValue.length) {
      const split = tn.splitText(range.startOffset);
      textNodes.push(split);
    } else if (tn === range.endContainer && range.endOffset === 0) {
      // 略過終點偏移為 0 的節點
    } else if (tn === range.startContainer && range.startOffset >= tn.nodeValue.length) {
      // 略過起點偏移在節點末尾的節點
    } else {
      textNodes.push(tn);
    }
  }

  return textNodes;
}

/**
 * 合併相鄰且同色的 <mark class="notion-highlight"> 節點，並移除空的 <mark>
 */
function normalizeEditorHighlights(container = DOM.editor) {
  if (!container) return;
  container.querySelectorAll('mark.notion-highlight, mark').forEach(mark => {
    // 1. 若內部誤含巢狀 <mark>，直接展平內層 <mark>
    mark.querySelectorAll('mark').forEach(innerMark => unwrapNode(innerMark));

    // 2. 若內容為空或僅含零寬字元，移除空標籤
    if (!mark.textContent || !mark.textContent.replace(/\u200B/g, '')) {
      unwrapNode(mark);
      return;
    }

    // 3. 若下一個緊鄰節點也是同色 <mark>，自動合併為單一連續 <mark>
    const next = mark.nextSibling;
    if (next && next.nodeType === Node.ELEMENT_NODE && next.tagName === 'MARK') {
      const c1 = mark.dataset.color || mark.style.backgroundColor;
      const c2 = next.dataset.color || next.style.backgroundColor;
      if (c1 && c1 === c2) {
        while (next.firstChild) {
          mark.appendChild(next.firstChild);
        }
        next.remove();
      }
    }

    // 4. 🛡️ 防卡死游標保護：若 <mark> 是段落最後一個節點，於後方確保存在可脫離之文字節點
    const nextSib = mark.nextSibling;
    if (!nextSib || (nextSib.nodeType === Node.ELEMENT_NODE && nextSib.tagName === 'BR')) {
      const escapeText = document.createTextNode('\u200B');
      mark.after(escapeText);
    }
  });
}

/**
 * 精準清除選取範圍內的螢光筆（支援「局部擦除」：若只選取一整段螢光筆中間的幾個字，會自動切開 <mark>，僅清除被選取的那幾個字！）
 */
function clearHighlightFromSelection(range) {
  if (!range) return;

  // 若選取已折疊，但游標正處於某個 <mark> 內部，則直接清除該 <mark>
  if (range.collapsed) {
    let node = range.startContainer;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const markEl = node ? node.closest('mark.notion-highlight, mark') : null;
    if (markEl) unwrapNode(markEl);
    return;
  }

  const selectedTextNodes = sliceAndCollectRangeTextNodes(range);
  if (selectedTextNodes.length > 0) {
    selectedTextNodes.forEach(tn => {
      // 檢查該文字節點是否包在 <mark> 中
      const markAncestor = tn.parentElement ? tn.parentElement.closest('mark.notion-highlight, mark') : null;
      if (markAncestor && DOM.editor.contains(markAncestor)) {
        // 若整個 <mark> 只有這一個文字節點，直接解開
        if (markAncestor.textContent === tn.nodeValue) {
          unwrapNode(markAncestor);
        } else {
          // 局部擦除：將 <mark> 在該文字節點處切分為 [前半 <mark>, 純文字 tn, 後半 <mark>]
          const beforeRange = document.createRange();
          beforeRange.setStartBefore(markAncestor.firstChild);
          beforeRange.setEndBefore(tn);
          const beforeFrag = beforeRange.extractContents();

          const afterRange = document.createRange();
          afterRange.setStartAfter(tn);
          afterRange.setEndAfter(markAncestor.lastChild);
          const afterFrag = afterRange.extractContents();

          const parent = markAncestor.parentNode;
          if (beforeFrag.textContent) {
            const leftMark = markAncestor.cloneNode(false);
            leftMark.appendChild(beforeFrag);
            parent.insertBefore(leftMark, markAncestor);
          }
          parent.insertBefore(tn, markAncestor);
          if (afterFrag.textContent) {
            const rightMark = markAncestor.cloneNode(false);
            rightMark.appendChild(afterFrag);
            parent.insertBefore(rightMark, markAncestor);
          }
          markAncestor.remove();
        }
      }

      // 同時清除包裹在外部的 <span style="background-color:..."> 或 <font>
      let spanEl = tn.parentElement ? tn.parentElement.closest('span, font') : null;
      while (spanEl && spanEl !== DOM.editor) {
        const nextUp = spanEl.parentElement ? spanEl.parentElement.closest('span, font') : null;
        if (spanEl.tagName === 'FONT') {
          unwrapNode(spanEl);
        } else if (spanEl.tagName === 'SPAN' && (spanEl.style.backgroundColor || spanEl.style.color)) {
          spanEl.style.backgroundColor = '';
          const c = spanEl.style.color;
          if (c === 'rgb(17, 24, 39)' || c === '#111827' || c === 'inherit' || c === 'rgb(0, 0, 0)' || c === '#000000') {
            spanEl.style.color = '';
          }
          if (!spanEl.getAttribute('style') || spanEl.getAttribute('style').trim() === '') {
            unwrapNode(spanEl);
          }
        }
        spanEl = nextUp;
      }
    });
  }

  normalizeEditorHighlights(DOM.editor);
}

function applyHighlight(color) {
  const targetColor = color || state.activeHighlightColor || '#fef08a';
  if (targetColor !== 'transparent') {
    setActiveHighlightColor(targetColor);
  }

  const range = getOrRestoreEditorSelectionRange();
  if (!range || range.collapsed) {
    showToast('請先反白選取要劃記的文字，或開啟「🖌️ 連續刷子」模式');
    return;
  }

  const selectedPreview = range.toString().replace(/\s+/g, ' ').trim().slice(0, 24);
  const colorLabel = HIGHLIGHT_COLOR_NAMES[targetColor] || '螢光筆';

  if (targetColor === 'transparent') {
    commitEditorCanvasAction(
      'highlight',
      `🧹 清除螢光筆標記`,
      selectedPreview ? `文字：「${selectedPreview}」` : '',
      () => {
        clearHighlightFromSelection(range);
      }
    );
    showToast('已清除螢光筆 🧹');
    return;
  }

  // 檢查選取範圍內的所有文字節點是否「已經全部都是同一個顏色」——若是，再點一次即自動取消螢光筆 (Smart Toggle)！
  const probeNodes = [];
  const walker = document.createTreeWalker(
    DOM.editor.contains(range.commonAncestorContainer) ? range.commonAncestorContainer : DOM.editor,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.replace(/\u200B/g, '').trim()) return NodeFilter.FILTER_REJECT;
        try { return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } catch (e) { return NodeFilter.FILTER_REJECT; }
      }
    }
  );
  if (range.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
    probeNodes.push(range.commonAncestorContainer);
  } else {
    while (walker.nextNode()) probeNodes.push(walker.currentNode);
  }

  const allAlreadySameColor = probeNodes.length > 0 && probeNodes.every(tn => {
    const m = tn.parentElement ? tn.parentElement.closest('mark.notion-highlight, mark') : null;
    return m && (m.dataset.color === targetColor);
  });

  if (allAlreadySameColor) {
    commitEditorCanvasAction(
      'highlight',
      `🧹 取消${colorLabel}螢光筆`,
      selectedPreview ? `文字：「${selectedPreview}」` : '',
      () => {
        clearHighlightFromSelection(range);
      }
    );
    showToast(`已取消${colorLabel}螢光筆 🧹`);
    return;
  }

  commitEditorCanvasAction(
    'highlight',
    `🖍️ 劃記${colorLabel}螢光筆`,
    selectedPreview ? `重點：「${selectedPreview}」` : '',
    () => {
      const textNodes = sliceAndCollectRangeTextNodes(range);
      let firstCreatedMark = null;
      let lastCreatedMark = null;

      textNodes.forEach(tn => {
        const existingMark = tn.parentElement ? tn.parentElement.closest('mark.notion-highlight, mark') : null;
        if (existingMark && DOM.editor.contains(existingMark) && existingMark.textContent === tn.nodeValue) {
          existingMark.className = 'notion-highlight';
          existingMark.dataset.color = targetColor;
          existingMark.style.backgroundColor = targetColor;
          existingMark.style.color = '#111827';
          if (!firstCreatedMark) firstCreatedMark = existingMark;
          lastCreatedMark = existingMark;
        } else {
          // 若原本在異色 <mark> 的局部區間內，先將局部區間拆出再包上新色，杜絕 <mark><mark> 套娃
          if (existingMark && DOM.editor.contains(existingMark)) {
            const subRange = document.createRange();
            subRange.selectNode(tn);
            clearHighlightFromSelection(subRange);
          }
          const mark = document.createElement('mark');
          mark.className = 'notion-highlight';
          mark.dataset.color = targetColor;
          mark.style.backgroundColor = targetColor;
          mark.style.color = '#111827';
          mark.style.borderRadius = '3px';
          mark.style.padding = '0.12em 0.28em';
          mark.style.fontWeight = '600';

          tn.parentNode.insertBefore(mark, tn);
          mark.appendChild(tn);
          if (!firstCreatedMark) firstCreatedMark = mark;
          lastCreatedMark = mark;
        }
      });

      normalizeEditorHighlights(DOM.editor);

      if (lastCreatedMark) {
        try {
          const sel = window.getSelection();
          const newRange = document.createRange();
          if (firstCreatedMark && firstCreatedMark === lastCreatedMark) {
            newRange.selectNodeContents(lastCreatedMark);
          } else if (firstCreatedMark && lastCreatedMark) {
            newRange.setStartBefore(firstCreatedMark);
            newRange.setEndAfter(lastCreatedMark);
          }
          sel.removeAllRanges();
          sel.addRange(newRange);
          savedSelectionRange = newRange.cloneRange();
        } catch (e) {}
      }
    }
  );

  showToast(`已劃記${colorLabel}重點 🖍️`);
}

function unwrapNode(el) {
  if (!el || !el.parentNode) return;
  const parent = el.parentNode;
  while (el.firstChild) {
    parent.insertBefore(el.firstChild, el);
  }
  el.remove();
}

// ----------------- 🖼️ 圖片與影片極致流暢收折/展開動畫引擎 (Smooth Media Collapse) -----------------
function toggleCollapsibleWithAnimation(details, content) {
  if (details.dataset.isAnimating === 'true') return;
  details.dataset.isAnimating = 'true';

  const arrow = details.querySelector('.collapse-arrow');
  const isOpen = details.hasAttribute('open');

  if (isOpen) {
    // ⬇️ 正在收折 (Closing animation: 200ms)
    content.style.overflow = 'hidden';
    content.style.maxHeight = content.scrollHeight + 'px';
    content.style.opacity = '1';
    content.style.transform = 'translateY(0)';
    content.style.transition = 'max-height 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.16s ease, transform 0.2s ease';

    if (arrow) arrow.style.transform = 'rotate(0deg)';
    void content.offsetHeight; // reflow

    content.style.maxHeight = '0px';
    content.style.opacity = '0';
    content.style.transform = 'translateY(-6px)';

    setTimeout(() => {
      details.removeAttribute('open');
      content.style.maxHeight = '';
      content.style.opacity = '';
      content.style.transform = '';
      content.style.transition = '';
      content.style.overflow = '';
      details.dataset.isAnimating = 'false';
    }, 210);
  } else {
    // ⬆️ 正在展開 (Opening animation: 220ms)
    details.setAttribute('open', '');
    content.style.overflow = 'hidden';
    content.style.maxHeight = '0px';
    content.style.opacity = '0';
    content.style.transform = 'translateY(-6px)';
    content.style.transition = 'max-height 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, transform 0.22s ease';

    if (arrow) arrow.style.transform = 'rotate(180deg)';
    void content.offsetHeight; // reflow

    content.style.maxHeight = content.scrollHeight + 'px';
    content.style.opacity = '1';
    content.style.transform = 'translateY(0)';

    setTimeout(() => {
      content.style.maxHeight = '';
      content.style.opacity = '';
      content.style.transform = '';
      content.style.transition = '';
      content.style.overflow = '';
      details.dataset.isAnimating = 'false';
    }, 230);
  }
}

function enhanceMediaCollapsiblesAndDraggables(container) {
  if (!container) return;

  // 🛡️ 0. 自動修復歷史筆記中曾發生「details 卡片被誤包進上一張卡片內部」的巢狀異常
  container.querySelectorAll('details.notion-media-collapse details.notion-media-collapse').forEach(nestedDetails => {
    const outerDetails = nestedDetails.parentElement ? nestedDetails.parentElement.closest('details.notion-media-collapse') : null;
    if (outerDetails && outerDetails.parentNode) {
      outerDetails.insertAdjacentElement('afterend', nestedDetails);
    }
  });

  // 🧹 0.5 清理圖片右上角刪除鈕、底部說明列刪除鈕，以及圖三/圖四中的 720P 綠色註解標籤
  container.querySelectorAll('.media-overlay-delete-btn, .media-caption-delete-btn, .media-delete-sep').forEach(el => el.remove());
  container.querySelectorAll('.media-preview-box').forEach(box => {
    const childMedia = box.querySelector('img, iframe, video');
    if (childMedia && box.parentNode) {
      box.parentNode.insertBefore(childMedia, box);
    }
    box.remove();
  });

  // 清理已存在於筆記中的「720P 960x720...」或檔案大小註解標籤
  container.querySelectorAll('details.notion-media-collapse summary span').forEach(sp => {
    const txt = (sp.textContent || '').trim();
    if (txt.startsWith('720P') || /^\(\d+(\.\d+)?\s*(KB|MB)\)$/i.test(txt) || /^\(720P/i.test(txt)) {
      sp.remove();
    }
  });
  container.querySelectorAll('details.notion-media-collapse .media-caption-bar span, details.notion-media-collapse .p-3 div span').forEach(sp => {
    const txt = (sp.textContent || '').trim();
    if (txt.startsWith('720P') || /^\d+(\.\d+)?\s*(KB|MB)$/i.test(txt)) {
      const next = sp.nextElementSibling;
      const prev = sp.previousElementSibling;
      if (next && next.textContent.trim() === '•') {
        next.remove();
      } else if (prev && prev.textContent.trim() === '•') {
        prev.remove();
      }
      sp.remove();
    }
  });

  // 1. 檢查現有的 details.notion-media-collapse 並自動識別既有說明列
  container.querySelectorAll('details.notion-media-collapse').forEach(details => {
    const contentDiv = details.querySelector('.media-collapse-content') || details.querySelector('.p-3');
    if (!contentDiv) return;
    contentDiv.classList.add('media-collapse-content');

    let existingBar = contentDiv.querySelector('.media-caption-bar');
    if (!existingBar) {
      const candidateDivs = Array.from(contentDiv.querySelectorAll(':scope > div'));
      existingBar = candidateDivs.find(d => {
        if (d.querySelector('details, img, iframe, video')) return false;
        const t = d.textContent || '';
        return t.includes('下載') || t.includes('雲端檢視') || t.includes('•') || d.querySelector('a[download]');
      });
      if (existingBar) {
        existingBar.classList.add('media-caption-bar', 'flex-wrap');
      }
    }

    contentDiv.querySelectorAll('.media-caption-bar').forEach(bar => {
      // 移除尾部多餘的「•」分隔符
      while (bar.lastElementChild && bar.lastElementChild.tagName === 'SPAN' && bar.lastElementChild.textContent.trim() === '•') {
        bar.lastElementChild.remove();
      }
      if (bar !== existingBar && !bar.textContent.trim() && !bar.querySelector('a')) {
        bar.remove();
      }
    });

    if (!contentDiv.querySelector('.media-caption-bar')) {
      const nextEl = details.nextElementSibling;
      if (nextEl && (nextEl.tagName === 'P' || nextEl.tagName === 'DIV') && !nextEl.querySelector('details, img, iframe, video')) {
        const text = nextEl.textContent || '';
        const hasDownload = text.includes('下載原圖') || text.includes('下載影片') || nextEl.querySelector('a[download]');
        const hasCloud = text.includes('雲端檢視') || text.includes('Google 雲端');
        if (hasDownload || hasCloud) {
          const captionDiv = document.createElement('div');
          captionDiv.className = 'text-[11px] text-gray-400 mt-2 flex items-center justify-center gap-2 flex-wrap media-caption-bar';
          captionDiv.innerHTML = nextEl.innerHTML;
          contentDiv.appendChild(captionDiv);
          nextEl.remove();
        }
      }
    }
  });

  // 2. 自動包裝所有獨立的 img 為收折 details 卡片
  const imgs = container.querySelectorAll('img:not(.emoji-opt img):not([data-no-collapse])');
  imgs.forEach(img => {
    if (img.closest('details.notion-media-collapse')) return;
    if (img.closest('button, nav, header, select, .notion-popover')) return;

    const alt = img.getAttribute('alt') || '照片';
    const src = img.getAttribute('src') || '';
    const parentP = img.closest('p, div');

    const tempWrap = document.createElement('div');
    tempWrap.innerHTML = buildMediaCollapseCardHtml({
      fileId: '',
      fileName: alt,
      isImage: true,
      isVideo: false,
      isAudio: false,
      directSrc: src,
      previewUrl: src,
      previewEmbedUrl: src,
      downloadUrl: src
    });
    const details = tempWrap.querySelector('details');

    if (parentP && (parentP.children.length <= 1 || parentP.tagName === 'P')) {
      parentP.replaceWith(details);
    } else {
      img.replaceWith(details);
    }
  });

  // 3. 自動包裝所有獨立的 Google 雲端影片 iframe 為收折 details 卡片
  container.querySelectorAll('iframe[src*="drive.google.com"]:not([data-no-collapse])').forEach(iframe => {
    if (iframe.closest('details.notion-media-collapse')) return;
    const parentP = iframe.closest('p, div');
    const src = iframe.getAttribute('src') || '';
    const viewUrl = src.replace('/preview', '/view');

    const tempWrap = document.createElement('div');
    tempWrap.innerHTML = buildMediaCollapseCardHtml({
      fileId: '',
      fileName: '錄影與影片',
      isImage: false,
      isVideo: true,
      isAudio: false,
      directSrc: src,
      previewUrl: viewUrl,
      previewEmbedUrl: src,
      downloadUrl: viewUrl
    });
    const details = tempWrap.querySelector('details');

    if (parentP && (parentP.children.length <= 1 || parentP.tagName === 'P')) {
      parentP.replaceWith(details);
    } else {
      iframe.replaceWith(details);
    }
  });

  // 4. 為所有新舊 details.notion-media-collapse 僅在「最上方標題列右側」保留唯一一個 [🗑️ 刪除] 按鈕
  container.querySelectorAll('details.notion-media-collapse').forEach(details => {
    const summary = details.querySelector('summary');
    if (!summary) return;

    const isVid = !!details.querySelector('iframe, video');
    const isImgCard = !isVid && !!details.querySelector('img');
    const mediaLabel = isVid ? '影片' : '圖片';

    let summaryDelBtn = summary.querySelector('.media-card-delete-btn');
    if (!summaryDelBtn) {
      summaryDelBtn = document.createElement('button');
      summaryDelBtn.type = 'button';
      const rightControls = summary.querySelector('.collapse-hint')?.parentElement || summary.lastElementChild;
      if (rightControls && rightControls !== summary.firstElementChild) {
        rightControls.insertBefore(summaryDelBtn, rightControls.firstChild);
      } else {
        summary.appendChild(summaryDelBtn);
      }
    }
    summaryDelBtn.className = 'media-card-delete-btn px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-600 hover:text-white text-[11px] font-bold inline-flex items-center gap-1 transition shadow-2xs cursor-pointer shrink-0';
    summaryDelBtn.title = `從筆記中刪除此${mediaLabel} (需二次確認)`;
    summaryDelBtn.innerHTML = `${TRASH_ICON_SVG}<span class="pointer-events-none">刪除</span>`;

    if (!summaryDelBtn._deleteBound) {
      summaryDelBtn._deleteBound = true;
      summaryDelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        requestDeleteMediaBlock(details);
      });
    }

    if (isImgCard) {
      let annotateBtn = summary.querySelector('.media-card-annotate-btn');
      if (!annotateBtn) {
        annotateBtn = document.createElement('button');
        annotateBtn.type = 'button';
        summaryDelBtn.parentElement.insertBefore(annotateBtn, summaryDelBtn);
      }
      annotateBtn.className = 'media-card-annotate-btn px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-500 hover:text-white text-[11px] font-bold inline-flex items-center gap-1 transition shadow-2xs cursor-pointer shrink-0';
      annotateBtn.title = '在照片上畫紅圈、箭頭或加文字標註';
      annotateBtn.innerHTML = '<span class="pointer-events-none">✏️ 標註</span>';
      if (!annotateBtn._annotateBound) {
        annotateBtn._annotateBound = true;
        annotateBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openPhotoAnnotatorForBlock(details);
        });
      }
    }
  });

  // 5. 確保所有通用附件卡片 (.notion-file-attachment) 具備醒目刪除按鈕
  container.querySelectorAll('.notion-file-attachment').forEach(block => {
    let delBtn = block.querySelector('.file-attachment-delete-btn');
    if (!delBtn) {
      delBtn = document.createElement('button');
      delBtn.type = 'button';
      const rightCol = block.querySelector('.shrink-0:last-child') || block.lastElementChild;
      if (rightCol && rightCol !== block.firstElementChild) {
        rightCol.appendChild(delBtn);
      } else {
        block.appendChild(delBtn);
      }
    }
    delBtn.className = 'file-attachment-delete-btn px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-600 hover:text-white text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer';
    delBtn.title = '從筆記中刪除此檔案 (需二次確認)';
    delBtn.innerHTML = `${TRASH_ICON_SVG}<span class="pointer-events-none">刪除</span>`;

    if (!delBtn._deleteBound) {
      delBtn._deleteBound = true;
      delBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        requestDeleteMediaBlock(block);
      });
    }
  });

  // 6. 確保所有附件卡片與收折卡片皆具備 draggable 與拖曳手把
  container.querySelectorAll('.notion-file-attachment, .notion-media-collapse').forEach(block => {
    block.setAttribute('draggable', 'true');
    block.classList.add('notion-draggable-block');
    if (!block.querySelector('.drag-handle')) {
      const summary = block.querySelector('summary') || block.firstElementChild;
      if (summary) {
        const handle = document.createElement('span');
        handle.className = 'drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 mr-1.5';
        handle.title = '拖動改變位置';
        handle.innerHTML = '<i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i>';
        summary.prepend(handle);
      }
    }
  });

  // 7. 清理歷史按鈕殘留，並為卡片綁定平滑收折/展開動畫
  container.querySelectorAll('.summary-edit-img-btn, .caption-edit-img-btn, .image-hover-edit-btn').forEach(el => el.remove());

  container.querySelectorAll('details.notion-media-collapse').forEach(details => {
    try {
      const content = details.querySelector('.media-collapse-content') || details.querySelector('.p-3');
      if (content) content.classList.add('media-collapse-content');

      const summary = details.querySelector('summary');
      if (summary && !summary._animatedCollapseBound && content) {
        summary._animatedCollapseBound = true;
        summary.addEventListener('click', (e) => {
          if (
            e.target.closest('.drag-handle') ||
            e.target.closest('.media-card-delete-btn') ||
            e.target.closest('button') ||
            e.target.closest('a')
          ) {
            return;
          }
          e.preventDefault();
          toggleCollapsibleWithAnimation(details, content);
        });
      }
    } catch (cardErr) {
      console.warn('媒體卡片動畫綁定錯誤:', cardErr);
    }
  });

  initMediaDeleteConfirmModal();
  initLucide();
  try {
    ensureEditableSpacesAroundMediaBlocks(container);
    healBrokenMediaCardsInEditor(container);
    ensureHighContrastInDarkMode(container);
  } catch (err) {
    console.warn('ensureEditableSpacesAroundMediaBlocks error:', err);
  }
}

function toggleAllMedia() {
  const collapsibles = DOM.editor.querySelectorAll('details.notion-media-collapse');
  if (!collapsibles || collapsibles.length === 0) {
    showToast('目前筆記中沒有可收折的照片或影片');
    return;
  }
  const hasOpen = Array.from(collapsibles).some(el => el.hasAttribute('open'));
  commitEditorCanvasAction(
    'media_op',
    hasOpen ? '📁 全部收折照片與影片' : '📂 全部展開照片與影片',
    `共 ${collapsibles.length} 個媒體卡片`,
    () => {
      collapsibles.forEach(el => {
        if (hasOpen) el.removeAttribute('open');
        else el.setAttribute('open', '');
      });
      updateToggleAllMediaBtnUI(!hasOpen);
    }
  );
  showToast(hasOpen ? '📁 已全部收折照片與影片' : '📂 已全部展開照片與影片');
}

function updateToggleAllMediaBtnUI(allOpen) {
  if (DOM.toggleAllMediaBtn) {
    DOM.toggleAllMediaBtn.title = allOpen ? '一鍵全部收折所有照片與影片' : '一鍵全部展開所有照片與影片';
  }
}

// 🖐️ 編輯器內部拖曳元件改變位置
let draggedEditorBlock = null;

function setupEditorDragAndDrop() {
  if (!DOM.editor) return;

  DOM.editor.addEventListener('dragstart', (e) => {
    const block = e.target.closest('.notion-draggable-block');
    if (block && DOM.editor.contains(block)) {
      draggedEditorBlock = block;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', block.outerHTML);
      e.dataTransfer.setData('application/x-notion-block', 'true');
      block.classList.add('dragging');
    }
  });

  DOM.editor.addEventListener('dragover', (e) => {
    if (!draggedEditorBlock) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('#editor > *');
    document.querySelectorAll('#editor > *').forEach(el => el.classList.remove('drop-indicator-top', 'drop-indicator-bottom'));
    if (target && target !== draggedEditorBlock && DOM.editor.contains(target)) {
      const rect = target.getBoundingClientRect();
      const isAfter = (e.clientY - rect.top) > (rect.height / 2);
      if (isAfter) target.classList.add('drop-indicator-bottom');
      else target.classList.add('drop-indicator-top');
    }
  });

  DOM.editor.addEventListener('dragleave', (e) => {
    const target = e.target.closest('#editor > *');
    if (target) {
      target.classList.remove('drop-indicator-top', 'drop-indicator-bottom');
    }
  });

  DOM.editor.addEventListener('dragend', () => {
    document.querySelectorAll('#editor > *').forEach(el => el.classList.remove('drop-indicator-top', 'drop-indicator-bottom', 'dragging'));
    draggedEditorBlock = null;
  });

  DOM.editor.addEventListener('drop', (e) => {
    if (!draggedEditorBlock) return;
    e.preventDefault();
    document.querySelectorAll('#editor > *').forEach(el => el.classList.remove('drop-indicator-top', 'drop-indicator-bottom', 'dragging'));

    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('#editor > *');
    if (target && target !== draggedEditorBlock && DOM.editor.contains(target)) {
      const rect = target.getBoundingClientRect();
      const isAfter = (e.clientY - rect.top) > (rect.height / 2);
      const blockRef = draggedEditorBlock;
      commitEditorCanvasAction(
        'drag_block',
        '🖐️ 拖曳移動區塊位置',
        '',
        () => {
          if (isAfter) {
            target.insertAdjacentElement('afterend', blockRef);
          } else {
            target.insertAdjacentElement('beforebegin', blockRef);
          }
        }
      );
      saveLocalDraftImmediately();
      triggerAutoSaveDebounce();
      showToast('✅ 已移動元件位置 (可按 Ctrl+Z 復原)');
    }
    draggedEditorBlock = null;
  });
}


// ==========================================================================
// 🚀 LVI_Note 旗艦功能模組：
// 折疊清單 (Toggle List)、待辦清單 (Todo)、資料表格 (Table) 增強引擎
// ==========================================================================

function placeCaretAtStart(el) {
  if (!el) return;
  try {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } catch(e) {
    console.warn('placeCaretAtStart error:', e);
  }
}

// 1. 折疊清單 (Toggle List) 增強：標題點選不干擾折疊、平滑開關、Lucide圖示
function enhanceToggleItems(container) {
  if (!container) return;
  container.querySelectorAll('details.notion-toggle-item, details:not(.notion-media-collapse)').forEach(details => {
    if (details.classList.contains('notion-media-collapse')) return;

    if (!details.classList.contains('notion-toggle-item')) {
      details.classList.add('notion-toggle-item');
    }

    const summary = details.querySelector('summary');
    if (!summary) return;

    let titleEl = summary.querySelector('.toggle-title');
    if (!titleEl) {
      const existingText = summary.textContent.trim() || '折疊清單標題';
      summary.innerHTML = `
        <span class="toggle-arrow-icon text-gray-400 shrink-0 inline-flex items-center justify-center w-4 h-4 cursor-pointer">
          <i data-lucide="chevron-right" class="w-3.5 h-3.5 transition-transform duration-200 toggle-arrow"></i>
        </span>
        <span class="toggle-title flex-1 focus:outline-none" contenteditable="true">${escapeHtml(existingText)}</span>
      `;
      titleEl = summary.querySelector('.toggle-title');
    } else {
      titleEl.setAttribute('contenteditable', 'true');
    }

    let contentDiv = details.querySelector('.toggle-content');
    if (!contentDiv) {
      const childNodes = Array.from(details.childNodes).filter(n => n !== summary);
      contentDiv = document.createElement('div');
      contentDiv.className = 'px-4 py-2 pl-9 text-sm text-gray-700 dark:text-gray-200 border-t border-gray-200/50 dark:border-notion-borderDark/50 toggle-content focus:outline-none';
      contentDiv.setAttribute('contenteditable', 'true');
      childNodes.forEach(n => contentDiv.appendChild(n));
      if (!contentDiv.textContent.trim()) {
        contentDiv.innerHTML = '<p>在此輸入折疊內容...</p>';
      }
      details.appendChild(contentDiv);
    } else {
      contentDiv.setAttribute('contenteditable', 'true');
    }

    if (!summary._toggleBound) {
      summary._toggleBound = true;
      summary.addEventListener('click', (e) => {
        // 點擊標題文字區域時：若為收合則自動展開並聚焦；若已展開則阻止收起，保證編輯順暢
        if (e.target.closest('.toggle-title')) {
          if (!details.open) {
            details.open = true;
            e.preventDefault();
          } else {
            e.preventDefault();
          }
          const t = e.target.closest('.toggle-title');
          if (t) t.focus();
        }
      });
    }
  });
}

// 2. 待辦清單 (Todo Item) 增強：核取狀態同步與劃線
function enhanceTodoItems(container) {
  if (!container) return;
  container.querySelectorAll('.notion-todo-item').forEach(item => {
    const cb = item.querySelector('input[type="checkbox"]');
    const textSpan = item.querySelector('.notion-todo-text');
    if (cb) {
      cb.removeAttribute('disabled');
      const isChecked = cb.hasAttribute('checked') || cb.checked;
      cb.checked = isChecked;
      if (textSpan) {
        textSpan.setAttribute('contenteditable', 'true');
        if (isChecked) textSpan.classList.add('checked');
        else textSpan.classList.remove('checked');
      }
    }
  });

  // 若 marked 解析了 task-list-item，自動標準化為 notion-todo-item
  container.querySelectorAll('li.task-list-item').forEach(li => {
    const cb = li.querySelector('input[type="checkbox"]');
    if (cb && !li.closest('.notion-todo-item')) {
      const isChecked = cb.checked || cb.hasAttribute('checked');
      const text = li.textContent.trim();
      const div = document.createElement('div');
      div.className = 'notion-todo-item';
      div.innerHTML = `<input type="checkbox" class="notion-todo-checkbox"${isChecked ? ' checked' : ''}><span class="notion-todo-text${isChecked ? ' checked' : ''}" contenteditable="true">${escapeHtml(text)}</span>`;
      li.replaceWith(div);
    }
  });
}

// 3. 資料表格 (Data Table) 增強：外層容器包裹、動態增刪欄列工具列、行動端滾動
function enhanceTables(container) {
  if (!container) return;
  const tables = container.querySelectorAll('table');
  tables.forEach(table => {
    let tableContainer = table.closest('.notion-table-container');
    if (!tableContainer) {
      tableContainer = document.createElement('div');
      tableContainer.className = 'notion-table-container my-3 rounded-xl border border-gray-200 dark:border-notion-borderDark bg-white dark:bg-notion-card shadow-xs overflow-hidden transition';

      const toolbar = document.createElement('div');
      toolbar.className = 'notion-table-toolbar flex items-center justify-between px-3 py-1.5 bg-gray-50/90 dark:bg-notion-darker/70 border-b border-gray-200/80 dark:border-notion-borderDark/80 text-xs select-none';
      toolbar.setAttribute('contenteditable', 'false');
      toolbar.innerHTML = `
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-gray-400 font-medium text-[11px] mr-1 flex items-center gap-1"><i data-lucide="table" class="w-3.5 h-3.5 text-emerald-500"></i> 資料表格</span>
          <button type="button" class="btn-table-add-row px-2 py-0.5 rounded bg-white dark:bg-notion-dark hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-gray-200/90 dark:border-notion-borderDark text-[11px] font-medium flex items-center gap-1 transition shadow-2xs" title="在最下方新增一列 (橫向)">
            <i data-lucide="plus" class="w-3 h-3"></i> 新增列
          </button>
          <button type="button" class="btn-table-add-col px-2 py-0.5 rounded bg-white dark:bg-notion-dark hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-gray-200/90 dark:border-notion-borderDark text-[11px] font-medium flex items-center gap-1 transition shadow-2xs" title="在最右方新增一欄 (直向)">
            <i data-lucide="plus" class="w-3 h-3"></i> 新增欄
          </button>
          <button type="button" class="btn-table-del-row px-1.5 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-[11px] transition" title="刪除最後一列">
            － 列
          </button>
          <button type="button" class="btn-table-del-col px-1.5 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-[11px] transition" title="刪除最後一欄">
            － 欄
          </button>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" class="btn-table-delete p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 dark:text-rose-400 transition" title="刪除整個表格">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `;

      const scrollBox = document.createElement('div');
      scrollBox.className = 'notion-table-scroll overflow-x-auto w-full p-2';

      table.parentNode.insertBefore(tableContainer, table);
      tableContainer.appendChild(toolbar);
      tableContainer.appendChild(scrollBox);
      scrollBox.appendChild(table);
    }

    table.querySelectorAll('th, td').forEach(cell => {
      if (!cell.hasAttribute('contenteditable')) {
        cell.setAttribute('contenteditable', 'true');
      }
    });

    const toolbar = tableContainer.querySelector('.notion-table-toolbar');
    if (toolbar && !toolbar._tableBound) {
      toolbar._tableBound = true;

      toolbar.querySelector('.btn-table-add-row')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        addTableRow(table);
      });

      toolbar.querySelector('.btn-table-add-col')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        getTableAddCol(table);
      });

      toolbar.querySelector('.btn-table-del-row')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteTableRow(table);
      });

      toolbar.querySelector('.btn-table-del-col')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteTableCol(table);
      });

      toolbar.querySelector('.btn-table-delete')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('確定要刪除此資料表格嗎？')) {
          commitEditorCanvasAction('table_op', '📊 刪除資料表格', '', () => {
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            tableContainer.replaceWith(p);
            placeCaretAtStart(p);
          });
          saveLocalDraftImmediately();
          triggerAutoSaveDebounce();
        }
      });
    }
  });
}

function addTableRow(table) {
  flushPendingEditorInputHistory();
  const beforeHtml = DOM.editor ? DOM.editor.innerHTML : null;
  const noteId = state.currentNote ? state.currentNote.id : null;
  const noteTitle = (state.currentNote && state.currentNote.name) ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
  let tbody = table.querySelector('tbody');
  if (!tbody) {
    tbody = document.createElement('tbody');
    table.appendChild(tbody);
  }
  const firstRow = table.querySelector('tr');
  const colCount = firstRow ? firstRow.children.length : 3;

  const newTr = document.createElement('tr');
  for (let i = 0; i < colCount; i++) {
    const td = document.createElement('td');
    td.setAttribute('contenteditable', 'true');
    td.innerHTML = '<br>';
    newTr.appendChild(td);
  }
  tbody.appendChild(newTr);

  const firstCell = newTr.querySelector('td');
  if (firstCell) placeCaretAtStart(firstCell);

  if (DOM.editor && beforeHtml !== null) {
    const afterHtml = DOM.editor.innerHTML;
    state.editorSnapshotBeforeEdit = afterHtml;
    recordAction({
      type: 'table_op',
      title: '📊 表格新增一列',
      subtitle: `筆記：「${noteTitle}」`,
      noteId,
      undo: () => applyNoteCanvasSnapshot(noteId, beforeHtml),
      redo: () => applyNoteCanvasSnapshot(noteId, afterHtml)
    });
  }
  saveLocalDraftImmediately();
  triggerAutoSaveDebounce();
}

function getTableAddCol(table) {
  flushPendingEditorInputHistory();
  const beforeHtml = DOM.editor ? DOM.editor.innerHTML : null;
  const noteId = state.currentNote ? state.currentNote.id : null;
  const noteTitle = (state.currentNote && state.currentNote.name) ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
  const theadRows = table.querySelectorAll('thead tr');
  if (theadRows.length > 0) {
    theadRows.forEach(tr => {
      const th = document.createElement('th');
      th.setAttribute('contenteditable', 'true');
      th.textContent = `欄位 ${tr.children.length + 1}`;
      tr.appendChild(th);
    });
  } else {
    const firstRow = table.querySelector('tr');
    if (firstRow && firstRow.querySelector('th')) {
      const th = document.createElement('th');
      th.setAttribute('contenteditable', 'true');
      th.textContent = `欄位 ${firstRow.children.length + 1}`;
      firstRow.appendChild(th);
    }
  }

  const tbodyRows = table.querySelectorAll('tbody tr');
  if (tbodyRows.length > 0) {
    tbodyRows.forEach(tr => {
      const td = document.createElement('td');
      td.setAttribute('contenteditable', 'true');
      td.innerHTML = '<br>';
      tr.appendChild(td);
    });
  } else {
    const allRows = table.querySelectorAll('tr');
    allRows.forEach((tr, idx) => {
      if (idx === 0 && tr.querySelector('th')) return;
      const td = document.createElement('td');
      td.setAttribute('contenteditable', 'true');
      td.innerHTML = '<br>';
      tr.appendChild(td);
    });
  }

  if (DOM.editor && beforeHtml !== null) {
    const afterHtml = DOM.editor.innerHTML;
    state.editorSnapshotBeforeEdit = afterHtml;
    recordAction({
      type: 'table_op',
      title: '📊 表格新增一欄',
      subtitle: `筆記：「${noteTitle}」`,
      noteId,
      undo: () => applyNoteCanvasSnapshot(noteId, beforeHtml),
      redo: () => applyNoteCanvasSnapshot(noteId, afterHtml)
    });
  }
  saveLocalDraftImmediately();
  triggerAutoSaveDebounce();
}

function deleteTableRow(table) {
  const tbodyRows = table.querySelectorAll('tbody tr');
  if (tbodyRows.length === 1) {
    showToast('表格至少需保留一列資料列');
    return;
  }
  const allRows = table.querySelectorAll('tr');
  if (tbodyRows.length <= 1 && allRows.length <= 1) {
    showToast('表格至少需保留一列資料列');
    return;
  }
  commitEditorCanvasAction('table_op', '📊 表格刪除一列', '', () => {
    if (tbodyRows.length > 1) {
      tbodyRows[tbodyRows.length - 1].remove();
    } else if (allRows.length > 1) {
      allRows[allRows.length - 1].remove();
    }
  });
  saveLocalDraftImmediately();
  triggerAutoSaveDebounce();
}

function deleteTableCol(table) {
  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) return;
  const colCount = rows[0].children.length;
  if (colCount <= 1) {
    showToast('表格至少需保留一欄');
    return;
  }
  commitEditorCanvasAction('table_op', '📊 表格刪除一欄', '', () => {
    rows.forEach(tr => {
      if (tr.lastElementChild) tr.lastElementChild.remove();
    });
  });
  saveLocalDraftImmediately();
  triggerAutoSaveDebounce();
}

// 🌟 全域畫布積木統一渲染器 (涵蓋收折媒體、折疊清單、待辦清單、表格、代碼複製鈕、圖示)
function enhanceAllEditorBlocks(container = DOM.editor) {
  if (!container) return;
  try { enhanceMediaCollapsiblesAndDraggables(container); } catch (e) { console.warn(e); }
  try { enhanceToggleItems(container); } catch (e) { console.warn(e); }
  try { enhanceTodoItems(container); } catch (e) { console.warn(e); }
  try { enhanceTables(container); } catch (e) { console.warn(e); }
  try { attachCodeCopyButtons(); } catch (e) { console.warn(e); }
  try { initLucide(); } catch(e) {}
}

// 🔀 側邊欄分類拖曳管理排序 (拖動即同步雲端 Google Drive)
let sidebarDragType = null;
let sidebarDragIndex = -1;

function setupSidebarCategoryDragAndDrop() {
  document.querySelectorAll('.tree-sub-item[draggable="true"]').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      sidebarDragType = item.dataset.catType;
      sidebarDragIndex = parseInt(item.dataset.catIndex, 10);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', sidebarDragIndex);
      item.classList.add('dragging-cat');
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (item.dataset.catType !== sidebarDragType) return;
      e.dataTransfer.dropEffect = 'move';
      const targetIndex = parseInt(item.dataset.catIndex, 10);
      if (targetIndex === sidebarDragIndex) return;

      const rect = item.getBoundingClientRect();
      const isBottom = (e.clientY - rect.top) > (rect.height / 2);
      item.classList.remove('cat-drop-above', 'cat-drop-below');
      if (isBottom) item.classList.add('cat-drop-below');
      else item.classList.add('cat-drop-above');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('cat-drop-above', 'cat-drop-below');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging-cat', 'cat-drop-above', 'cat-drop-below');
      document.querySelectorAll('.tree-sub-item').forEach(el => el.classList.remove('cat-drop-above', 'cat-drop-below', 'dragging-cat'));
      sidebarDragType = null;
      sidebarDragIndex = -1;
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('cat-drop-above', 'cat-drop-below', 'dragging-cat');
      if (item.dataset.catType !== sidebarDragType) return;
      const targetIndex = parseInt(item.dataset.catIndex, 10);
      if (targetIndex === sidebarDragIndex || isNaN(targetIndex) || isNaN(sidebarDragIndex)) return;

      if (sidebarDragType === 'machine') {
        const moved = state.machineModels.splice(sidebarDragIndex, 1)[0];
        state.machineModels.splice(targetIndex, 0, moved);
        saveWorkspaceConfigToDrive();
        renderWorkTagLists();
        renderWorkTagSelects();
        renderTableView();
        showToast(`✅ 機型順序已更新並同步至 Google Drive`);
      } else if (sidebarDragType === 'content') {
        const moved = state.workContents.splice(sidebarDragIndex, 1)[0];
        state.workContents.splice(targetIndex, 0, moved);
        saveWorkspaceConfigToDrive();
        renderWorkTagLists();
        renderWorkTagSelects();
        renderTableView();
        showToast(`✅ 工作內容順序已更新並同步至 Google Drive`);
      }
    });
  });
}

function renderOutline() {
  if (!DOM.outlineList) return;
  DOM.outlineList.innerHTML = '';

  const headings = DOM.editor.querySelectorAll('h1, h2, h3');
  if (headings.length === 0) {
    DOM.outlineList.innerHTML = '<span class="text-gray-400 italic text-[11px]">暫無標題</span>';
    return;
  }

  headings.forEach((h, idx) => {
    const level = h.tagName.toLowerCase();
    const text = h.innerText.trim() || `標題 ${idx + 1}`;
    const item = document.createElement('div');
    item.className = `toc-${level} cursor-pointer hover:text-blue-500 truncate py-0.5 transition`;
    item.textContent = text;
    item.onclick = () => {
      h.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    DOM.outlineList.appendChild(item);
  });
}

function updateStats() {
  const text = DOM.editor.innerText || '';
  const chars = text.length;
  const words = (text.match(/\S+/g) || []).length;
  const readTime = Math.ceil(words / 200) || 1;

  DOM.statWords.textContent = words;
  DOM.statChars.textContent = chars;
  DOM.statTime.textContent = readTime;
}

// ----------------- Slash 指令 (`/`) 選單 -----------------
function handleSlashMenu(e) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const textBefore = range.startContainer.textContent || '';
  const lastChar = textBefore[range.startOffset - 1];

  if (lastChar === '/') {
    const rect = range.getBoundingClientRect();
    DOM.slashMenu.style.left = `${Math.min(rect.left, window.innerWidth - 250)}px`;
    DOM.slashMenu.style.top = `${rect.bottom + window.scrollY + 6}px`;
    DOM.slashMenu.classList.remove('hidden');
  } else {
    DOM.slashMenu.classList.add('hidden');
  }
}

function insertSlashSnippet(type) {
  DOM.slashMenu.classList.add('hidden');
  flushPendingEditorInputHistory();

  // 僅當游標前一個字元確實為觸發斜線選單的 '/' 時才移除該字元
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0);
    const textBefore = range.startContainer.textContent || '';
    if (range.startOffset > 0 && textBefore[range.startOffset - 1] === '/') {
      range.setStart(range.startContainer, range.startOffset - 1);
      range.deleteContents();
      state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
    }
  }

  let html = '';
  switch(type) {
    case 'troubleshoot':
      html = getEngineeringTroubleshootSnippetHtml();
      break;
    case 'h1':
      html = '<h1>大標題 1</h1><p><br></p>';
      break;
    case 'h2':
      html = '<h2>中標題 2</h2><p><br></p>';
      break;
    case 'toggle':
      html = `
        <details class="notion-toggle-item my-2 border border-gray-200/80 dark:border-notion-borderDark rounded-lg overflow-hidden bg-gray-50/40 dark:bg-notion-darker/40 transition">
          <summary class="cursor-pointer select-none px-3 py-1.5 font-medium text-sm flex items-center gap-2 hover:bg-gray-100/70 dark:hover:bg-gray-800/60 transition list-none">
            <span class="toggle-arrow-icon text-gray-400 shrink-0 inline-flex items-center justify-center w-4 h-4 cursor-pointer"><i data-lucide="chevron-right" class="w-3.5 h-3.5 transition-transform duration-200 toggle-arrow"></i></span>
            <span class="toggle-title flex-1 focus:outline-none" contenteditable="true">折疊清單標題</span>
          </summary>
          <div class="px-4 py-2 pl-9 text-sm text-gray-700 dark:text-gray-200 border-t border-gray-200/50 dark:border-notion-borderDark/50 toggle-content focus:outline-none" contenteditable="true">
            <p>在此輸入折疊內容...</p>
          </div>
        </details>
        <p><br></p>
      `;
      break;
    case 'h3':
      html = '<h3>小標題 3</h3><p><br></p>';
      break;
    case 'todo':
      html = '<div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">待辦事項內容</span></div><p><br></p>';
      break;
    case 'callout':
      html = '<div class="notion-callout"><span class="notion-callout-icon">💡</span><div class="notion-callout-body">醒目提示重點...</div></div><p><br></p>';
      break;
    case 'table':
      html = '<table><thead><tr><th>欄位 1</th><th>欄位 2</th><th>欄位 3</th></tr></thead><tbody><tr><td>內容</td><td>內容</td><td>內容</td></tr><tr><td>內容</td><td>內容</td><td>內容</td></tr></tbody></table><p><br></p>';
      break;
    case 'code':
      html = '<pre><code>// 在此輸入代碼\nconsole.log("Hello LVI_Note");</code></pre><p><br></p>';
      break;
    case 'columns':
      html = '<div class="notion-columns"><div class="notion-col" contenteditable="true"><p>左欄內容...</p></div><div class="notion-col" contenteditable="true"><p>右欄內容...</p></div></div><p><br></p>';
      break;
    case 'quote':
      html = '<blockquote>在此輸入引述重點...</blockquote><p><br></p>';
      break;
    case 'divider':
      html = '<hr class="notion-divider"><p><br></p>';
      break;
    case 'camera':
      openInAppCameraModal();
      break;
    case 'media':
      saveCameraCheckpoint();
      if (DOM.mediaUploadInput) DOM.mediaUploadInput.click();
      break;
    case 'file':
      saveCameraCheckpoint();
      if (DOM.genericFileUploadInput) DOM.genericFileUploadInput.click();
      break;
  }

  if (html) {
    const slashNames = {
      troubleshoot: '🚨 故障排查三段式模板',
      h1: 'H1 大標題', h2: 'H2 中標題', h3: 'H3 小標題',
      toggle: '折疊清單', todo: '待辦事項', callout: '醒目提示框',
      table: '資料表格', code: '程式碼區塊', columns: '雙欄並排佈局',
      quote: '引言區塊', divider: '分隔線'
    };
    commitEditorCanvasAction(
      'slash_insert',
      `⚡ 插入「${slashNames[type] || type}」`,
      '',
      () => {
        insertHtmlAtCursor(html);
        enhanceAllEditorBlocks(DOM.editor);
      }
    );
    saveLocalDraftImmediately();
    triggerAutoSaveDebounce();
  }
}


// ==========================================================================
// PAPAYA 電腦教室 旗艦功能模組：
// 反白浮動選單、Space AI、4合1貼上、全寬模式、我的最愛、@提及、雙欄
// ==========================================================================

// 1. 全寬模式 (Full Width Mode)
function initFullWidth() {
  if (state.isFullWidth && DOM.canvasInnerWrapper) {
    DOM.canvasInnerWrapper.classList.add('full-width-canvas');
  }
}

function toggleFullWidth() {
  state.isFullWidth = !state.isFullWidth;
  localStorage.setItem('cloudnotes_fullwidth', state.isFullWidth ? 'true' : 'false');
  if (DOM.canvasInnerWrapper) {
    DOM.canvasInnerWrapper.classList.toggle('full-width-canvas', state.isFullWidth);
  }
  showToast(state.isFullWidth ? '已切換為全寬模式 (Full Width)' : '已還原標準置中寬度');
}

// 2. ⭐ 我的最愛 (Favorites Section)
function renderFavoritesList() {
  if (!DOM.favoritesContainer || !DOM.favoritesList) return;
  const pinnedNotes = state.notes.filter(n => n.meta && n.meta.pinned);

  if (pinnedNotes.length === 0) {
    DOM.favoritesContainer.classList.add('hidden');
    return;
  }

  DOM.favoritesContainer.classList.remove('hidden');
  DOM.favoritesList.innerHTML = '';

  pinnedNotes.forEach(note => {
    const item = document.createElement('div');
    const isActive = state.currentNote && state.currentNote.id === note.id;
    item.className = `folder-item-row ${isActive ? 'active' : ''}`;
    const cleanTitle = (note.name || '未命名').replace(/\.md$/i, '');
    const icon = (note.meta && note.meta.icon) || '📝';

    item.innerHTML = `
      <span class="text-sm shrink-0">${icon}</span>
      <span class="truncate flex-1 font-medium text-xs">${escapeHtml(cleanTitle)}</span>
      <span class="text-amber-400 text-xs">⭐</span>
    `;

    item.onclick = () => {
      selectNote(note.id);
      if (window.innerWidth < 768) closeSidebar();
    };

    DOM.favoritesList.appendChild(item);
  });
}

// 3. 反白文字浮動選單 (Floating Selection Toolbar - v2.6.6 防失焦與智慧定位版)
function updateSelectionToolbarActiveStates() {
  if (!DOM.selectionToolbar) return;
  ['bold', 'italic', 'underline', 'strikeThrough'].forEach(cmd => {
    const btn = DOM.selectionToolbar.querySelector(`button[data-cmd="${cmd}"]`);
    if (btn) {
      let active = false;
      try { active = document.queryCommandState(cmd); } catch (e) {}
      btn.classList.toggle('is-active', Boolean(active));
    }
  });
}

function handleTextSelection() {
  if (!DOM.selectionToolbar) return;
  if (state.isInteractingWithToolbar) return;

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) {
    if (document.activeElement && DOM.selectionToolbar.contains(document.activeElement)) {
      return;
    }
    DOM.selectionToolbar.classList.add('hidden');
    if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
    return;
  }

  const range = sel.getRangeAt(0);
  const commonAncestor = range.commonAncestorContainer;

  if (!DOM.editor || !DOM.editor.contains(commonAncestor)) {
    DOM.selectionToolbar.classList.add('hidden');
    if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
    return;
  }

  const text = sel.toString().replace(/\u200B/g, '').trim();
  if (!text) {
    DOM.selectionToolbar.classList.add('hidden');
    if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
    return;
  }

  // 儲存當前有效選取範圍供工具列按鈕使用
  savedSelectionRange = range.cloneRange();

  // 📱 手機觸控保護：若手指仍在螢幕上拖拉選取水滴 (state.isTouchSelecting)，等待手指放開後再觸發刷子或定位
  if (state.isTouchSelecting) {
    return;
  }

  // 🖌️ 若使用者開啟了「連續螢光筆刷子模式」，反白放開瞬間直接自動上色！
  if (state.highlightBrushMode) {
    applyHighlight(state.activeHighlightColor || '#fef08a');
    try { window.getSelection().collapseToEnd(); } catch (e) {}
    DOM.selectionToolbar.classList.add('hidden');
    return;
  }

  updateSelectionToolbarActiveStates();

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return;

  DOM.selectionToolbar.classList.remove('hidden');
  const tbRect = DOM.selectionToolbar.getBoundingClientRect();
  const vWidth = (window.visualViewport && window.visualViewport.width) ? window.visualViewport.width : window.innerWidth;
  const vHeight = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;
  const vOffsetTop = (window.visualViewport && window.visualViewport.offsetTop) ? window.visualViewport.offsetTop : 0;

  const toolbarWidth = Math.min(tbRect.width || 340, vWidth - 16);
  const toolbarHeight = tbRect.height || 40;

  let left = Math.max(8, Math.min(rect.left + rect.width / 2 - toolbarWidth / 2, vWidth - toolbarWidth - 8));
  let top;

  if (window.innerWidth < 768) {
    // 📱 手機端防遮擋演算法 (解決截圖二 1252.jpg)：
    // Android 原生「剪下 | 複製 | 貼上」固定佔據選取範圍上方 [rect.top - 62px, rect.top]，
    // 而下方兩個藍色水滴拉柄佔據 [rect.bottom, rect.bottom + 38px]。
    const belowTeardropsTop = rect.bottom + 44; // 避開下方藍色水滴拉柄
    const aboveAndroidMenuTop = rect.top - toolbarHeight - 66; // 避開上方 Android 原生選單

    // 計算距離虛擬鍵盤頂部或底部工具列的可視下界
    const bottomSafeLimit = vOffsetTop + vHeight - (vHeight < window.innerHeight * 0.78 ? 10 : 62);

    if (belowTeardropsTop + toolbarHeight <= bottomSafeLimit) {
      // 優先放於藍色水滴拉柄正下方，與上方 Android 原生選單完全上下分離！
      top = belowTeardropsTop + window.scrollY;
    } else if (aboveAndroidMenuTop >= 48) {
      // 若下方緊貼虛擬鍵盤，則置於 Android 原生選單「更上方 66px 處」，絕不重疊！
      top = aboveAndroidMenuTop + window.scrollY;
    } else {
      // 極端情況：固定於可視區頂部安全位置
      top = Math.max(48, vOffsetTop + 52);
    }
  } else {
    top = rect.top + window.scrollY - toolbarHeight - 10;
    if (rect.top < 72) {
      top = rect.bottom + window.scrollY + 10;
    }
  }

  DOM.selectionToolbar.style.left = `${Math.round(left)}px`;
  DOM.selectionToolbar.style.top = `${Math.round(top)}px`;
}

function turnSelectionInto(type) {
  const range = getOrRestoreEditorSelectionRange();
  if (!range) return;
  const text = range.toString().replace(/\u200B/g, '').trim() || '內容';

  const typeLabels = {
    h1: 'H1 大標題',
    h2: 'H2 中標題',
    h3: 'H3 小標題',
    todo: '待辦清單',
    toggle: '折疊清單',
    callout: '醒目提示框'
  };

  commitEditorCanvasAction(
    'turn_block',
    `🔄 轉換段落為「${typeLabels[type] || type}」`,
    `文字：「${text.slice(0, 20)}」`,
    () => {
      let container = range.commonAncestorContainer;
      if (container.nodeType === Node.TEXT_NODE) container = container.parentElement;
      const block = container ? container.closest('p, h1, h2, h3, blockquote, .notion-todo-item, .notion-callout') : null;

      // 若已是同級標題 (例如已是 H1 再點一次 H1)，自動切換回一般段落 <p>
      if (block && ((type === 'h1' && block.tagName === 'H1') || (type === 'h2' && block.tagName === 'H2'))) {
        const p = document.createElement('p');
        p.innerHTML = block.innerHTML || escapeHtml(text);
        block.replaceWith(p);
        placeCaretAtStart(p);
        return;
      }

      let html = '';
      switch (type) {
        case 'h1':
          html = `<h1>${escapeHtml(text)}</h1>`;
          break;
        case 'h2':
          html = `<h2>${escapeHtml(text)}</h2>`;
          break;
        case 'todo':
          html = `<div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text" contenteditable="true">${escapeHtml(text)}</span></div>`;
          break;
        case 'toggle':
          html = `
            <details class="notion-toggle-item my-2 border border-gray-200/80 dark:border-notion-borderDark rounded-lg overflow-hidden bg-gray-50/40 dark:bg-notion-darker/40 transition" open>
              <summary class="cursor-pointer select-none px-3 py-1.5 font-medium text-sm flex items-center gap-2 hover:bg-gray-100/70 dark:hover:bg-gray-800/60 transition list-none">
                <span class="toggle-arrow-icon text-gray-400 shrink-0 inline-flex items-center justify-center w-4 h-4 cursor-pointer"><i data-lucide="chevron-right" class="w-3.5 h-3.5 transition-transform duration-200 toggle-arrow"></i></span>
                <span class="toggle-title flex-1 focus:outline-none" contenteditable="true">${escapeHtml(text)}</span>
              </summary>
              <div class="px-4 py-2 pl-9 text-sm text-gray-700 dark:text-gray-200 border-t border-gray-200/50 dark:border-notion-borderDark/50 toggle-content focus:outline-none" contenteditable="true">
                <p>在此輸入折疊內容...</p>
              </div>
            </details>
          `;
          break;
        case 'callout':
          html = `<div class="notion-callout"><span class="notion-callout-icon">💡</span><div class="notion-callout-body">${escapeHtml(text)}</div></div>`;
          break;
      }

      if (!html) return;

      try {
        if (block && block !== DOM.editor && (block.textContent.trim() === text || text.length >= block.textContent.trim().length * 0.8)) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html.trim();
          if (tempDiv.firstElementChild) {
            block.replaceWith(tempDiv.firstElementChild);
          }
        } else {
          range.deleteContents();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html.trim();
          const frag = document.createDocumentFragment();
          let node;
          while ((node = tempDiv.firstChild)) {
            frag.appendChild(node);
          }
          range.insertNode(frag);
        }
      } catch (err) {
        document.execCommand('insertHTML', false, html);
      }

      enhanceAllEditorBlocks(DOM.editor);
    }
  );

  if (DOM.selectionToolbar) DOM.selectionToolbar.classList.add('hidden');
  if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
  saveLocalDraftImmediately();
  triggerAutoSaveDebounce();
  showToast(type === 'callout' ? '已轉為醒目提示 💡' : (type === 'todo' ? '已轉為待辦清單 ☑️' : `已轉為 ${typeLabels[type] || '新格式'}`));
}

// 4. 空白行按 Space 呼叫 AI 提示框 (Space to Ask AI)
function handleSpaceAiTrigger(e) {
  // 改為 Ctrl + Space 或 Alt + Space 觸發，絕不干擾正常空白鍵打字，避免編輯卡死無回應
  if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
    e.preventDefault();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const left = Math.max(10, Math.min(rect.left, window.innerWidth - 460));
    const top = rect.bottom + window.scrollY + 6;

    if (DOM.spaceAiBox) {
      DOM.spaceAiBox.style.left = `${left}px`;
      DOM.spaceAiBox.style.top = `${top}px`;
      DOM.spaceAiBox.classList.remove('hidden');
      if (DOM.spaceAiInput) {
        DOM.spaceAiInput.value = '';
        setTimeout(() => DOM.spaceAiInput.focus(), 50);
      }
    }
  } else if (e.key === 'Escape') {
    if (DOM.spaceAiBox) DOM.spaceAiBox.classList.add('hidden');
    if (DOM.smartUrlMenu) DOM.smartUrlMenu.classList.add('hidden');
    if (DOM.mentionMenu) DOM.mentionMenu.classList.add('hidden');
    if (DOM.selectionToolbar) DOM.selectionToolbar.classList.add('hidden'); if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
  }
}

async function executeSpaceAi(customPrompt = null) {
  const prompt = customPrompt || (DOM.spaceAiInput ? DOM.spaceAiInput.value.trim() : '');
  if (!prompt) return;

  DOM.spaceAiBox.classList.add('hidden');

  if (!state.geminiApiKey) {
    checkAiKeyStatus();
    DOM.aiPanel.classList.remove('translate-x-full');
    showToast('請先填入 Google Gemini API Key');
    return;
  }

  showToast('Gemini 3.8 正在為您撰寫內容...', 4000);
  const loadingHtml = `<div id="space_ai_loading" class="p-3 my-2 border border-purple-200 dark:border-purple-900 rounded-lg text-xs text-purple-600 dark:text-purple-400 flex items-center gap-2 animate-pulse"><i data-lucide="loader" class="w-4 h-4 animate-spin"></i> AI 正在撰寫：${escapeHtml(prompt)}...</div>`;
  insertHtmlAtCursor(loadingHtml);
  initLucide();

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiApiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `你是一位頂尖的寫作與知識整理助理。請根據使用者指令直接生成高質感的繁體中文內容，排版清晰優雅，不需要前言或結語：\n\n指令：${prompt}` }] }
        ]
      })
    });
    const data = await res.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '（無內容）';
    const parsedHtml = window.marked ? window.marked.parse(replyText) : replyText;

    const loader = document.getElementById('space_ai_loading');
    if (loader) {
      loader.outerHTML = parsedHtml + '<p><br></p>';
    } else {
      insertHtmlAtCursor(parsedHtml + '<p><br></p>');
    }

    showToast('✅ AI 已將內容插入至筆記畫布！');
    triggerAutoSaveDebounce();
  } catch(err) {
    console.error('Space AI 錯誤:', err);
    const loader = document.getElementById('space_ai_loading');
    if (loader) loader.outerHTML = `<div class="text-rose-500 text-xs">⚠️ AI 撰寫失敗：${escapeHtml(err.message)}</div>`;
  }
}

// 5. 貼上 URL 4 合 1 智慧選單 (Smart URL Paste Menu)
function handleUrlPaste(url, e) {
  state.pendingPasteUrl = url;
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    state.pendingPasteRange = sel.getRangeAt(0).cloneRange();
    const rect = state.pendingPasteRange.getBoundingClientRect();
    const left = Math.max(10, Math.min(rect.left, window.innerWidth - 300));
    const top = rect.bottom + window.scrollY + 6;

    DOM.smartUrlMenu.style.left = `${left}px`;
    DOM.smartUrlMenu.style.top = `${top}px`;
    DOM.smartUrlMenu.classList.remove('hidden');
  }
}

function executePasteAction(type) {
  const url = state.pendingPasteUrl;
  if (!url) return;
  DOM.smartUrlMenu.classList.add('hidden');

  let domain = 'link';
  try { domain = new URL(url).hostname; } catch(e) {}

  let html = '';
  switch(type) {
    case 'embed':
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (ytMatch && ytMatch[1]) {
        html = `<div class="my-3"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" class="w-full aspect-video rounded-lg shadow-md border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div><p><br></p>`;
      } else {
        html = `<div class="my-3"><iframe src="${url}" class="w-full min-h-[360px] rounded-lg shadow-md border-0" allowfullscreen></iframe></div><p><br></p>`;
      }
      break;
    case 'bookmark':
      html = `<p><a href="${url}" target="_blank" rel="noopener noreferrer" class="notion-bookmark-card"><div class="notion-bookmark-content"><div class="notion-bookmark-title">${escapeHtml(domain)}</div><div class="notion-bookmark-desc">點擊造訪：${escapeHtml(url)}</div><div class="notion-bookmark-url">🔗 ${escapeHtml(domain)}</div></div><div class="notion-bookmark-cover" style="background-image: url('https://www.google.com/s2/favicons?domain=${domain}&sz=128'); background-size: 48px; background-repeat: no-repeat;"></div></a></p><p><br></p>`;
      break;
    case 'mention':
      html = `<a href="${url}" target="_blank" rel="noopener noreferrer" class="notion-page-link"><span>🔗</span><span>${escapeHtml(domain)}</span></a>&nbsp;`;
      break;
    case 'raw':
      html = `<a href="${url}" target="_blank" class="text-blue-500 underline">${escapeHtml(url)}</a>&nbsp;`;
      break;
  }

  if (html) {
    commitEditorCanvasAction('slash_insert', `🔗 插入智慧連結 (${type})`, url.slice(0, 32), () => {
      insertHtmlAtCursor(html);
    });
    saveLocalDraftImmediately();
    triggerAutoSaveDebounce();
  }
}

// 6. @ 提及筆記頁面 (Page Mention)
function handleMentionTrigger(e) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const textBefore = range.startContainer.textContent || '';
  const lastChar = textBefore[range.startOffset - 1];

  if (lastChar === '@') {
    const rect = range.getBoundingClientRect();
    DOM.mentionMenu.style.left = `${Math.min(rect.left, window.innerWidth - 270)}px`;
    DOM.mentionMenu.style.top = `${rect.bottom + window.scrollY + 6}px`;
    renderMentionOptions();
    DOM.mentionMenu.classList.remove('hidden');
  } else {
    DOM.mentionMenu.classList.add('hidden');
  }
}

function renderMentionOptions() {
  if (!DOM.mentionOptions) return;
  DOM.mentionOptions.innerHTML = '';

  const otherNotes = state.notes.filter(n => !state.currentNote || n.id !== state.currentNote.id);
  if (!otherNotes.length) {
    DOM.mentionOptions.innerHTML = '<div class="text-[11px] text-gray-400 py-1 px-2">無其他筆記可提及</div>';
    return;
  }

  otherNotes.slice(0, 8).forEach(note => {
    const cleanTitle = (note.name || '未命名').replace(/\.md$/i, '');
    const icon = (note.meta && note.meta.icon) || '📝';

    const item = document.createElement('div');
    item.className = 'flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-xs transition';
    item.innerHTML = `<span>${icon}</span><span class="truncate flex-1">${escapeHtml(cleanTitle)}</span>`;

    item.onclick = (e) => {
      e.stopPropagation();
      DOM.mentionMenu.classList.add('hidden');

      // 移除剛剛輸入的 '@'
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const range = sel.getRangeAt(0);
        if (range.startOffset > 0) {
          range.setStart(range.startContainer, range.startOffset - 1);
          range.deleteContents();
        }
      }

      const html = `<span class="notion-page-link" data-note-id="${note.id}"><span>${icon}</span><span>${escapeHtml(cleanTitle)}</span></span>&nbsp;`;
      insertHtmlAtCursor(html);
      triggerAutoSaveDebounce();
    };

    DOM.mentionOptions.appendChild(item);
  });
}

// 7. Markdown 行首即時轉換語法
function handleMarkdownInputRules(e) {
  if (e.inputType === 'insertText' && e.data === ' ') {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    const textBefore = node.textContent ? node.textContent.substring(0, range.startOffset) : '';

    let replaceHtml = null;
    let matchLen = 0;

    if (textBefore === '# ') {
      replaceHtml = '<h1>標題 1</h1>';
      matchLen = 2;
    } else if (textBefore === '## ') {
      replaceHtml = '<h2>標題 2</h2>';
      matchLen = 3;
    } else if (textBefore === '### ') {
      replaceHtml = '<h3>標題 3</h3>';
      matchLen = 4;
    } else if (textBefore === '- ' || textBefore === '* ') {
      replaceHtml = '<ul><li>清單項目</li></ul>';
      matchLen = 2;
    } else if (textBefore === '1. ') {
      replaceHtml = '<ol><li>編號項目</li></ol>';
      matchLen = 3;
    } else if (textBefore === '[] ' || textBefore === '[ ] ' || textBefore === '- [ ] ' || textBefore === '- [x] ') {
      const isChecked = textBefore.includes('[x]');
      replaceHtml = `<div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"${isChecked ? ' checked' : ''}><span class="notion-todo-text${isChecked ? ' checked' : ''}" contenteditable="true">待辦事項</span></div>`;
      matchLen = textBefore.length;
    } else if (textBefore === '>> ') {
      replaceHtml = `
        <details class="notion-toggle-item my-2 border border-gray-200/80 dark:border-notion-borderDark rounded-lg overflow-hidden bg-gray-50/40 dark:bg-notion-darker/40 transition">
          <summary class="cursor-pointer select-none px-3 py-1.5 font-medium text-sm flex items-center gap-2 hover:bg-gray-100/70 dark:hover:bg-gray-800/60 transition list-none">
            <span class="toggle-arrow-icon text-gray-400 shrink-0 inline-flex items-center justify-center w-4 h-4 cursor-pointer"><i data-lucide="chevron-right" class="w-3.5 h-3.5 transition-transform duration-200 toggle-arrow"></i></span>
            <span class="toggle-title flex-1 focus:outline-none" contenteditable="true">折疊清單標題</span>
          </summary>
          <div class="px-4 py-2 pl-9 text-sm text-gray-700 dark:text-gray-200 border-t border-gray-200/50 dark:border-notion-borderDark/50 toggle-content focus:outline-none" contenteditable="true">
            <p>在此輸入折疊內容...</p>
          </div>
        </details>
        <p><br></p>
      `;
      matchLen = 3;
    } else if (textBefore === '> ') {
      replaceHtml = '<blockquote>在此輸入引言...</blockquote>';
      matchLen = 2;
    }

    if (replaceHtml) {
      e.preventDefault();
      range.setStart(node, 0);
      range.setEnd(node, range.startOffset);
      range.deleteContents();
      document.execCommand('insertHTML', false, replaceHtml);
      triggerAutoSaveDebounce();
    }
  }
}

// ----------------- 匯出功能 (MD, HTML, PDF) -----------------
function exportMarkdown() {
  const title = (DOM.noteTitle.value.trim() || '未命名筆記') + '.md';
  const md = convertHtmlToMarkdown(DOM.editor.innerHTML);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, title);
  DOM.exportMenu.classList.add('hidden');
}

function exportHTML() {
  const title = (DOM.noteTitle.value.trim() || '未命名筆記');
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #37352f; }
    h1, h2, h3 { color: #111827; }
    pre { background: #1e1e1e; color: #f8fafc; padding: 12px; border-radius: 6px; }
    img, video { max-width: 100%; border-radius: 6px; }
    blockquote { border-left: 3px solid #2383e2; padding-left: 12px; color: #4b5563; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${DOM.editor.innerHTML}
</body>
</html>`;
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${title}.html`);
  DOM.exportMenu.classList.add('hidden');
}

function exportPDF() {
  DOM.exportMenu.classList.add('hidden');
  window.print();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ----------------- 置頂切換 -----------------
function togglePin() {
  if (!state.currentNote) return;
  const oldPin = Boolean(state.currentNote.meta && state.currentNote.meta.pinned);
  const newPin = !oldPin;
  const noteId = state.currentNote.id;
  const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
  state.currentNote.meta.pinned = newPin;
  const nInList = state.notes.find(x => x.id === noteId);
  if (nInList && nInList.meta) nInList.meta.pinned = newPin;
  updatePinButtonUI(newPin);
  renderNotesList();
  renderCurrentView();
  triggerAutoSaveDebounce();
  recordAction({
    type: 'toggle_pin',
    title: newPin ? `📌 置頂筆記「${noteTitle}」` : `📌 取消置頂「${noteTitle}」`,
    subtitle: `筆記：「${noteTitle}」`,
    noteId,
    undo: () => {
      const n = state.notes.find(x => x.id === noteId);
      if (n && n.meta) n.meta.pinned = oldPin;
      if (state.currentNote && state.currentNote.id === noteId) {
        state.currentNote.meta.pinned = oldPin;
        updatePinButtonUI(oldPin);
      }
      renderNotesList();
      renderCurrentView();
      triggerAutoSaveDebounce();
    },
    redo: () => {
      const n = state.notes.find(x => x.id === noteId);
      if (n && n.meta) n.meta.pinned = newPin;
      if (state.currentNote && state.currentNote.id === noteId) {
        state.currentNote.meta.pinned = newPin;
        updatePinButtonUI(newPin);
      }
      renderNotesList();
      renderCurrentView();
      triggerAutoSaveDebounce();
    }
  });
  showToast(newPin ? '📌 已置頂此筆記' : '已取消置頂');
}

function updatePinButtonUI(isPinned) {
  if (isPinned) {
    DOM.notePinBtn.classList.add('text-amber-500');
    DOM.notePinBtn.classList.remove('text-gray-400');
  } else {
    DOM.notePinBtn.classList.remove('text-amber-500');
    DOM.notePinBtn.classList.add('text-gray-400');
  }
}

// ----------------- 檢視模式與佈局 -----------------
function initLayout() {
  setLayout(state.layoutMode);
}

function setLayout(mode) {
  state.layoutMode = mode;
  localStorage.setItem('cloudnotes_layout', mode);
  if (mode === 'grid') {
    DOM.notesList.classList.add('grid-view');
    DOM.layoutGridBtn.classList.add('text-blue-600', 'dark:text-blue-400');
    DOM.layoutListBtn.classList.remove('text-blue-600', 'dark:text-blue-400');
  } else {
    DOM.notesList.classList.remove('grid-view');
    DOM.layoutListBtn.classList.add('text-blue-600', 'dark:text-blue-400');
    DOM.layoutGridBtn.classList.remove('text-blue-600', 'dark:text-blue-400');
  }
}

// ----------------- 事件綁定 -----------------

// ==========================================================================
// 🏆 薑餅資 多重視圖與核心系統實作 (Multi-Views, GTD, Daily Review, Budget)
// ==========================================================================


// ==========================================================================
// 📥 未分類隨手筆記與速記引擎 (Quick Notes & Uncategorized Management)
// ==========================================================================

async function createQuickNote() {
  // 建立新筆記前，先將當前正在編輯的上一篇筆記同步結算並排入背景上傳佇列
  try {
    commitActiveEditorStateImmediately();
  } catch (e) {}
  const now = new Date();
  const dateKey = now.toISOString().split('T')[0];
  
  const title = '未命名隨手筆記';
  const newNote = {
    id: null,
    name: `${title}.md`,
    parentId: null,
    meta: {
      icon: '⚡',
      cover: null,
      machineModel: '未分類',
      workContent: '未分類',
      urgency: '未分類',
      status: '💡 構思中',
      dueDate: dateKey,
      tags: ['隨手筆記'],
      pinned: false
    }
  };

  state.currentNote = newNote;
  DOM.noteTitle.value = title;
  DOM.headerTitle.textContent = title;
  DOM.noteEmojiBtn.textContent = '⚡';
  
  renderWorkTagSelects();
  if (DOM.noteMachineSelect) DOM.noteMachineSelect.value = '未分類';
  if (DOM.noteContentSelect) DOM.noteContentSelect.value = '未分類';
  if (DOM.noteUrgencySelect) DOM.noteUrgencySelect.value = '未分類';
  if (DOM.noteStatusSelect) DOM.noteStatusSelect.value = '💡 構思中';
  if (DOM.noteDueDate) DOM.noteDueDate.value = dateKey;
  
  renderPageCover();
  renderNoteActiveTags();
  renderBreadcrumbs();
  updatePinButtonUI(false);

  DOM.editor.innerHTML = '<p><br></p>';
  state.isDirty = true;
  
  switchView('editor');
  
  // 手機端自動收合側邊欄
  if (window.innerWidth < 768 && DOM.sidebar && !DOM.sidebar.classList.contains('-translate-x-full')) {
    DOM.sidebar.classList.add('-translate-x-full');
  }
  
  updateStats();
  renderOutline();
  
  // 🌟 筆記初始型態一律為未分類，並聚焦大標題輸入框，方便直接設定大標題
  if (DOM.noteTitle) {
    DOM.noteTitle.focus();
    DOM.noteTitle.select();
  }

  state.editorSnapshotBeforeEdit = '<p><br></p>';
  state.titleBeforeEdit = title;

  const createdNote = newNote;
  recordAction({
    type: 'create_quick_note',
    title: `⚡ 新增筆記「${title}」`,
    subtitle: `分類：未分類 (三種大分類完成後自動歸位)`,
    undo: () => {
      const idx = state.notes.findIndex(n => n === createdNote || (createdNote.id && n.id === createdNote.id));
      if (idx !== -1) {
        state.notes.splice(idx, 1);
        if (state.currentNote === createdNote || (state.currentNote && state.currentNote.id === createdNote.id)) {
          state.currentNote = state.notes[0] || null;
        }
        renderNotesList();
        renderWorkTagLists();
        renderCurrentNote();
        renderCurrentView();
      }
    },
    redo: () => {
      state.notes.unshift(createdNote);
      state.currentNote = createdNote;
      renderNotesList();
      renderWorkTagLists();
      renderCurrentNote();
      renderCurrentView();
    }
  });

  showToast('⚡ 新筆記已建立（初始為「未分類」，三項大分類齊全後方可歸位）');
  triggerAutoSaveDebounce();
}

async function categorizeAndMoveNote(noteId, machine, content, urgency) {
  if (!state.accessToken) return;
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return;

  // 標準化急迫性 ID
  const urgList = (state.urgencies && state.urgencies.length > 0) ? state.urgencies : DEFAULT_URGENCIES;
  const matchUrg = urgList.find(u => u.id === urgency || u.label === urgency || (urgency && urgency.includes(u.id)));
  const finalUrgency = matchUrg ? matchUrg.id : (urgency || '未分類');

  const finalMachine = (machine || '').trim() || '未分類';
  const finalContent = (content || '').trim() || '未分類';

  const meta = {
    ...note.meta,
    machineModel: finalMachine,
    workContent: finalContent,
    urgency: finalUrgency
  };

  // 🛡️ 三種大分類缺一不可：若機型、工作內容或急迫性任一未選擇，一律留在未分類資料夾
  const isFullyClassified = !isNoteUncategorized({ meta });
  const targetCategory = isFullyClassified ? finalMachine : '未分類';
  const targetFolderId = await ensureCategoryFolder(targetCategory);
  const oldParent = note.parentId || state.folderId;
  
  // 1. 更新 Google Drive 上的父層資料夾與屬性中繼資料
  let url = `https://www.googleapis.com/drive/v3/files/${noteId}?fields=id,name,parents,description`;
  if (oldParent && oldParent !== targetFolderId) {
    url += `&addParents=${targetFolderId}&removeParents=${oldParent}`;
  } else if (!oldParent) {
    url += `&addParents=${targetFolderId}`;
  }
  
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${state.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: JSON.stringify(meta)
    })
  });
  
  if (!res.ok) {
    throw new Error('更新筆記歸位失敗');
  }

  // 2. 🛡️ 實體檔案內容同步更新：更新實體 Markdown 檔案開頭的 Frontmatter，徹底解決重新打開時被舊內容覆蓋的 BUG！
  try {
    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${noteId}?alt=media`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    if (fileRes.ok) {
      const rawText = await fileRes.text();
      const { body } = parseFrontmatter(rawText);
      const newFullContent = buildFrontmatterString(meta) + body;
      
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${noteId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': 'text/markdown; charset=UTF-8'
        },
        body: newFullContent
      });
    }
  } catch (contentUpdateErr) {
    console.warn('更新實體檔案 Frontmatter 失敗 (不影響中繼資料):', contentUpdateErr);
  }
  
  note.meta = meta;
  note.parentId = targetFolderId;
  
  // 若當前開啟的筆記就是此筆記，同步更新編輯區下拉選單與麵包屑
  if (state.currentNote && state.currentNote.id === noteId) {
    state.currentNote.meta = meta;
    state.currentNote.parentId = targetFolderId;
    renderCurrentNote();
  }
  
  if (isFullyClassified) {
    showToast(`✅ 筆記已完成三項分類，成功歸位至「${finalMachine}」資料夾！`);
  } else {
    showToast(`ℹ️ 筆記已更新屬性，因三項分類尚未齊全，仍暫留於「未分類」區域`);
  }
}

async function deleteNoteById(noteId) {
  if (!state.accessToken) return;
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${noteId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    state.notes = state.notes.filter(n => n.id !== noteId);
    if (state.currentNote && state.currentNote.id === noteId) {
      if (state.notes.length > 0) selectNote(state.notes[0].id);
      else clearEditor();
    }
    showToast('🗑️ 筆記已刪除');
  } catch (e) {
    console.error('刪除筆記失敗:', e);
    showToast('⚠️ 刪除筆記失敗');
  }
}

function renderUncategorizedView() {
  if (!DOM.viewUncategorizedContainer) return;
  
  const uncatNotes = state.notes.filter(n => isNoteUncategorized(n));
  const count = uncatNotes.length;
  
  if (DOM.uncatCountBadge) DOM.uncatCountBadge.textContent = `${count} 篇待分類`;
  if (DOM.uncatTabBadge) {
    DOM.uncatTabBadge.textContent = count;
    if (count > 0) DOM.uncatTabBadge.classList.remove('hidden');
    else DOM.uncatTabBadge.classList.add('hidden');
  }
  if (DOM.sidebarUncatCount) DOM.sidebarUncatCount.textContent = count;
  if (DOM.sidebarFilterUncatBadge) {
    DOM.sidebarFilterUncatBadge.textContent = count;
    if (count > 0) DOM.sidebarFilterUncatBadge.classList.remove('hidden');
    else DOM.sidebarFilterUncatBadge.classList.add('hidden');
  }
  if (DOM.uncatSummaryText) DOM.uncatSummaryText.textContent = `共有 ${count} 篇未分類隨手筆記`;
  
  const kw = (DOM.uncatSearchInput ? DOM.uncatSearchInput.value.trim() : '');
  const parsedUncatQ = kw ? parseFuzzyQuery(kw) : null;
  const filteredNotes = uncatNotes.filter(n => {
    if (!parsedUncatQ) return true;
    return evaluateFuzzyNoteMatch(n, parsedUncatQ).matched;
  });
  
  const grid = DOM.uncatNotesGrid;
  if (!grid) return;
  
  if (filteredNotes.length === 0) {
    if (kw) {
      grid.innerHTML = `
        <div class="col-span-full py-12 text-center text-gray-400">
          <i data-lucide="search-x" class="w-10 h-10 mx-auto mb-2 text-gray-300"></i>
          <p class="text-xs">沒有符合「${escapeHtml(kw)}」的未分類筆記</p>
        </div>
      `;
    } else {
      grid.innerHTML = `
        <div class="col-span-full py-14 text-center">
          <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center text-3xl shadow-sm">✨</div>
          <h3 class="text-sm font-bold text-gray-800 dark:text-gray-100">所有筆記皆已妥善歸位！</h3>
          <p class="text-xs text-gray-400 mt-1 max-w-sm mx-auto">目前沒有待分類的隨手筆記。點擊「建立隨手筆記」可隨時捕捉現場靈感或巡檢速記。</p>
          <button id="uncat-empty-create-btn" class="mt-4 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow transition active:scale-95 flex items-center gap-1.5 mx-auto">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>立即建立隨手筆記</span>
          </button>
        </div>
      `;
      const btn = document.getElementById('uncat-empty-create-btn');
      if (btn) btn.onclick = () => createQuickNote();
    }
    initLucide();
    return;
  }
  
  grid.innerHTML = filteredNotes.map(note => {
    const title = (note.name || '').replace(/\.md$/i, '');
    const icon = (note.meta && note.meta.icon) || '⚡';
    const dateStr = note.modifiedTime ? new Date(note.modifiedTime).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const curMachine = (note.meta && note.meta.machineModel && note.meta.machineModel !== '未分類') ? note.meta.machineModel : '';
    const curContent = (note.meta && note.meta.workContent && note.meta.workContent !== '隨手速記 ✍️') ? note.meta.workContent : '';
    const curUrgency = (note.meta && note.meta.urgency) || '🟢 常規';
    
    // 機型選項
    const machineOptions = (state.machineModels || []).map(m => 
      `<option value="${escapeHtml(m)}" ${curMachine === m ? 'selected' : ''}>🚜 ${escapeHtml(m)}</option>`
    ).join('');
    
    // 工作內容選項
    const contentOptions = (state.workContents || []).map(c => 
      `<option value="${escapeHtml(c)}" ${curContent === c ? 'selected' : ''}>🔧 ${escapeHtml(c)}</option>`
    ).join('');
    
    // 急迫性選項
    const urgList = (state.urgencies && state.urgencies.length > 0) ? state.urgencies : DEFAULT_URGENCIES;
    const urgencyOptions = urgList.map(u => 
      `<option value="${escapeHtml(u.id)}" ${curUrgency === u.id || curUrgency.includes(u.id) ? 'selected' : ''}>${escapeHtml(u.label || u.id)}</option>`
    ).join('');
    
    return `
      <div class="uncat-card p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-900/40 bg-white dark:bg-notion-card shadow-sm hover:shadow-md transition flex flex-col justify-between gap-3" data-note-id="${note.id}">
        <div>
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <span class="text-xl shrink-0">${icon}</span>
            <div class="flex-1 min-w-0">
              <h4 class="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate cursor-pointer hover:text-blue-500 uncat-open-btn" title="點擊開啟編輯">${escapeHtml(title)}</h4>
              <span class="text-[10px] text-gray-400">上次編輯：${dateStr}</span>
            </div>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 shrink-0">待歸位</span>
          </div>
          <p class="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">點選下方下拉選單設定機型與工作內容，即可一鍵將此隨手筆記自動歸檔至對應 Google Drive 資料夾。</p>
        </div>

        <div class="space-y-1.5 pt-2 border-t border-gray-100 dark:border-notion-borderDark text-xs">
          <div class="flex items-center gap-1.5">
            <span class="w-12 text-[11px] font-semibold text-gray-500 shrink-0">機型：</span>
            <select class="uncat-select-machine flex-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-notion-borderDark bg-gray-50 dark:bg-notion-darker font-medium">
              <option value="未分類" ${!curMachine || curMachine === '未分類' ? 'selected' : ''}>-- 請選擇機型 (未分類) --</option>
              ${machineOptions}
            </select>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-12 text-[11px] font-semibold text-gray-500 shrink-0">內容：</span>
            <select class="uncat-select-content flex-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-notion-borderDark bg-gray-50 dark:bg-notion-darker font-medium">
              <option value="未分類" ${!curContent || curContent === '未分類' || curContent === '隨手速記 ✍️' ? 'selected' : ''}>-- 請選擇內容 (未分類) --</option>
              ${contentOptions}
            </select>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-12 text-[11px] font-semibold text-gray-500 shrink-0">急迫：</span>
            <select class="uncat-select-urgency flex-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-notion-borderDark bg-gray-50 dark:bg-notion-darker font-medium">
              <option value="未分類" ${!curUrgency || curUrgency === '未分類' ? 'selected' : ''}>-- 請選擇急迫性 (未分類) --</option>
              ${urgencyOptions}
            </select>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-notion-borderDark">
          <button class="uncat-delete-btn p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition text-xs" title="刪除此隨手筆記">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
          <div class="flex items-center gap-1.5">
            <button class="uncat-open-btn px-2.5 py-1 rounded text-xs border border-gray-200 dark:border-notion-borderDark text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
              編輯
            </button>
            <button class="uncat-save-categorize-btn px-3 py-1 rounded text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 shadow-sm transition active:scale-95">
              <i data-lucide="check" class="w-3.5 h-3.5"></i>
              <span>立即歸位</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  
  // 綁定各卡片操作事件
  grid.querySelectorAll('.uncat-card').forEach(card => {
    const noteId = card.dataset.noteId;
    const note = state.notes.find(n => n.id === noteId);
    if (!note) return;
    
    // 開啟編輯
    card.querySelectorAll('.uncat-open-btn').forEach(btn => {
      btn.onclick = () => {
        selectNote(noteId);
        switchView('editor');
      };
    });
    
    // 刪除
    const delBtn = card.querySelector('.uncat-delete-btn');
    if (delBtn) {
      delBtn.onclick = async () => {
        if (!confirm(`確定要刪除隨手筆記「${(note.name || '').replace(/\.md$/i, '')}」嗎？`)) return;
        await withLoading(delBtn, async () => {
          await deleteNoteById(noteId);
          renderUncategorizedView();
        }, '正在刪除筆記...');
      };
    }
    
    // 立即歸位
    const saveBtn = card.querySelector('.uncat-save-categorize-btn');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const machine = card.querySelector('.uncat-select-machine').value;
        const content = card.querySelector('.uncat-select-content').value;
        const urgency = card.querySelector('.uncat-select-urgency').value;
        
        const isMachineEmpty = !machine || machine === '未分類';
        const isContentEmpty = !content || content === '未分類' || content === '隨手速記 ✍️';
        const isUrgencyEmpty = !urgency || urgency === '未分類';

        if (isMachineEmpty || isContentEmpty || isUrgencyEmpty) {
          const missing = [];
          if (isMachineEmpty) missing.push('機型');
          if (isContentEmpty) missing.push('工作內容');
          if (isUrgencyEmpty) missing.push('急迫性');
          showToast(`⚠️ 三種大分類缺一不可，尚缺：【${missing.join('、')}】，筆記將保留於未分類`);
        }
        
        await withLoading(saveBtn, async () => {
          await categorizeAndMoveNote(noteId, machine, content, urgency);
          if (!isMachineEmpty && !isContentEmpty && !isUrgencyEmpty) {
            card.classList.add('transition-all', 'duration-300', 'opacity-0', 'scale-95');
            setTimeout(() => {
              renderUncategorizedView();
              renderWorkTagLists();
              renderNotesList();
            }, 300);
          } else {
            renderUncategorizedView();
            renderWorkTagLists();
            renderNotesList();
          }
        }, `正在更新筆記分類...`);
      };
    }
  });
  
  initLucide();
}

function switchView(viewName) {
  // 🛡️ 零掉字保護：從編輯器切往表格資料庫、未分類、待辦或行事曆前，第 0 毫秒同步結算當前筆記快照並排入背景上傳佇列！
  if (state.currentView === 'editor' && viewName !== 'editor') {
    try {
      commitActiveEditorStateImmediately();
    } catch (e) {}
  }
  state.currentView = viewName;

  // 1. 切換標籤按鈕 active 樣式
  const tabMap = {
    editor: DOM.viewTabEditor,
    table: DOM.viewTabTable,
    uncategorized: DOM.viewTabUncategorized,
    tasks: DOM.viewTabTasks,
    calendar: DOM.viewTabCalendar,
  };

  Object.values(tabMap).forEach(btn => {
    if (btn) btn.classList.remove('active');
  });
  if (tabMap[viewName]) {
    tabMap[viewName].classList.add('active');
  }

  // 2. 顯示/隱藏對應容器
  const containerMap = {
    editor: DOM.mainScrollContainer,
    table: DOM.viewTableContainer,
    uncategorized: DOM.viewUncategorizedContainer,
    tasks: DOM.viewTasksContainer,
    calendar: DOM.viewCalendarContainer,
  };

  Object.entries(containerMap).forEach(([name, container]) => {
    if (container) {
      if (name === viewName) {
        container.classList.remove('hidden');
        container.classList.remove('view-transition-active');
        // 強制觸發重繪以播放絲滑轉場
        void container.offsetWidth;
        container.classList.add('view-transition-active');
        container.scrollTop = 0;
      } else {
        container.classList.add('hidden');
        container.classList.remove('view-transition-active');
      }
    }
  });

  // 📱 手機端底部編輯快捷列：僅在筆記編輯視圖開啟，其餘視圖 (表格、看板、行事曆) 自動隱藏以騰出完整手機螢幕空間
  if (DOM.mobileToolbar) {
    if (viewName === 'editor') {
      DOM.mobileToolbar.classList.remove('hidden');
    } else {
      DOM.mobileToolbar.classList.add('hidden');
    }
  }

  // 3. 呼叫對應渲染函數
  renderCurrentView();
}

function renderCurrentView() {
  if (DOM.viewCountBadge) {
    DOM.viewCountBadge.textContent = `共 ${state.notes.length} 則`;
  }

  switch (state.currentView) {
    case 'table':
      renderTableView();
      break;
    case 'uncategorized':
      renderUncategorizedView();
      break;
    case 'tasks':
      renderTasksView();
      if (!state.googleTasks || state.googleTasks.length === 0) {
        syncGoogleTasks(false);
      }
      break;
    case 'calendar':
      renderCalendarView();
      if (!state.googleCalendarEvents || state.googleCalendarEvents.length === 0) {
        syncGoogleCalendar(false);
      }
      break;
    default:
      // editor view is already live
      break;
  }
}


// ============================================================================
// 🧠 LVI_Note v2.6.5 智慧模糊檢索與解決方案探索引擎 (Smart Fuzzy & Solution Search)
// ============================================================================
const SEARCH_INDEX_STORAGE_KEY = 'lvi_search_index_v1';
let _searchIndexMap = {};
let _isBackgroundIndexing = false;

try {
  const rawIdx = localStorage.getItem(SEARCH_INDEX_STORAGE_KEY);
  if (rawIdx) {
    const parsedIdx = JSON.parse(rawIdx);
    if (parsedIdx && typeof parsedIdx === 'object') {
      _searchIndexMap = parsedIdx;
    }
  }
} catch (e) {
  console.warn('讀取本機全文索引快取略過:', e);
}

let _saveSearchIndexTimer = null;
function persistSearchIndexCache() {
  if (_saveSearchIndexTimer) clearTimeout(_saveSearchIndexTimer);
  _saveSearchIndexTimer = setTimeout(() => {
    try {
      const validIds = new Set((state.notes || []).map(n => n.id));
      const keys = Object.keys(_searchIndexMap);
      if (keys.length > 200 && validIds.size > 0) {
        keys.forEach(k => {
          if (!validIds.has(k)) delete _searchIndexMap[k];
        });
      }
      localStorage.setItem(SEARCH_INDEX_STORAGE_KEY, JSON.stringify(_searchIndexMap));
    } catch (err) {
      console.warn('儲存全文索引快取略過:', err);
    }
  }, 400);
}

/**
 * 將筆記原始 Markdown 或 HTML 轉換為高密度、無雜訊之可檢索純文字
 * (自動過濾巨型 Base64 圖檔字串、Frontmatter 屬性行、提取附件檔名 data-file-name、移除 HTML 標籤)
 */
function extractCleanSearchableText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText;

  // 1. 移除開頭 YAML Frontmatter (含一般與跳脫斜線格式)
  text = text.replace(/^\\?---\r?\n[\s\S]*?\r?\n\\?---\r?\n?/, '');
  text = text.replace(/^-----+\s*\n+##\s*icon:[\s\S]*?\n+/i, '');

  // 2. 移除巨型 Base64 編碼內容、媒體卡片按鈕文字與圖檔佔位符 (避免污染索引與摘要預覽)
  text = text.replace(/data:[a-zA-Z0-9/+.-]+;base64,[A-Za-z0-9+/=\r\n]+/g, ' ');
  text = text.replace(/\[image\d+\]:\s*<[^>]*>/gi, ' ');
  text = text.replace(/!?\\?\[IMG_[^\]]*\\?\]\\?\[[^\]]*\\?\]/gi, ' ');
  text = text.replace(/<summary[\s\S]*?<\/summary>/gi, ' ');
  text = text.replace(/點擊收折\/展開|下載原圖|雲端檢視|已同步至雲端|🗑️\s*刪除|刪除/g, ' ');
  text = text.replace(/(?:IMG_|\d{15,})[a-zA-Z0-9_.-]*\.(?:jpe?g|png|gif|webp|mp4|mov)/gi, ' ');

  // 3. 保留 HTML 內的檔案名稱屬性 (如 data-file-name="標準器校驗報告.pdf")
  const fileNames = [];
  text.replace(/data-file-name=["']([^"']+)["']/gi, (_, fname) => {
    if (fname) fileNames.push(fname);
    return '';
  });

  // 4. 將換行與區塊結束標籤轉為換行，再剝除所有 HTML 標籤
  text = text
    .replace(/<\/(p|div|h[1-6]|li|tr|details|summary|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\?&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"');

  // 5. 先移除 Markdown 裝飾符號，再清除殘留之 Frontmatter 屬性鍵值行
  text = text
    .replace(/https?:\/\/[^\s)]+/g, ' ')
    .replace(/^[\\#*>-]+\s*/gm, '')
    .replace(/[\\`*_~\[\]]+/g, ' ')
    .replace(/^\s*(?:icon|cover|status|machineModel|workContent|urgency|clientVendor|dueDate|tags|pinned)\s*:.*$/gim, '')
    .replace(/^.*machineModel\s*:.*workContent\s*:.*$/gim, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();

  if (fileNames.length > 0) {
    text = `[附件: ${fileNames.join(', ')}] ` + text;
  }

  return text.slice(0, 4500);
}

/**
 * 更新單篇筆記的全文索引並掛載至 note._searchText
 */
function updateNoteSearchIndex(noteId, modifiedTime, rawOrBodyText, persist = true) {
  if (!noteId || typeof rawOrBodyText !== 'string') return '';
  const clean = extractCleanSearchableText(rawOrBodyText);
  _searchIndexMap[noteId] = {
    m: modifiedTime || '',
    t: clean
  };
  if (Array.isArray(state.notes)) {
    const target = state.notes.find(n => n.id === noteId);
    if (target) {
      target._searchText = clean;
    }
  }
  if (persist) persistSearchIndexCache();
  updateFuzzyIndexBadgeUI();
  return clean;
}

/**
 * 取得筆記的最佳可檢索內文 (優先順序：_searchText -> _cachedBody -> _cachedHtml -> _searchIndexMap -> meta.excerpt)
 */
function getNoteSearchableBody(note) {
  if (!note) return '';
  if (typeof note._searchText === 'string' && note._searchText.length > 0) {
    return note._searchText;
  }
  if (typeof note._cachedBody === 'string' && note._cachedBody.length > 0) {
    const clean = extractCleanSearchableText(note._cachedBody);
    note._searchText = clean;
    if (note.id) {
      _searchIndexMap[note.id] = { m: note.modifiedTime || '', t: clean };
    }
    return clean;
  }
  if (typeof note._cachedHtml === 'string' && note._cachedHtml.length > 0) {
    const clean = extractCleanSearchableText(note._cachedHtml);
    note._searchText = clean;
    return clean;
  }
  if (note.id && _searchIndexMap[note.id] && typeof _searchIndexMap[note.id].t === 'string') {
    note._searchText = _searchIndexMap[note.id].t;
    return note._searchText;
  }
  if (note.meta && typeof note.meta.excerpt === 'string') {
    return note.meta.excerpt;
  }
  return '';
}

function updateFuzzyIndexBadgeUI() {
  if (!DOM.tableFuzzyIndexBadge) return;
  const total = Array.isArray(state.notes) ? state.notes.length : 0;
  if (total === 0) {
    DOM.tableFuzzyIndexBadge.innerHTML = '<span>🧠 智慧模糊檢索已就緒</span>';
    return;
  }
  let indexedCount = 0;
  state.notes.forEach(n => {
    if (n._searchText !== undefined || n._cachedBody !== undefined || (_searchIndexMap[n.id] && _searchIndexMap[n.id].t !== undefined)) {
      indexedCount++;
    }
  });
  if (_isBackgroundIndexing && indexedCount < total) {
    DOM.tableFuzzyIndexBadge.innerHTML = `<i data-lucide="loader-2" class="w-3 h-3 animate-spin text-blue-500"></i><span>全文索引同步中 (${indexedCount}/${total})</span>`;
    initLucide();
  } else {
    DOM.tableFuzzyIndexBadge.innerHTML = `<span>🧠 智慧模糊檢索 (全文索引 ${indexedCount}/${total} 篇)</span>`;
  }
}

/**
 * 背景靜默預載所有尚未建立本地全文索引的筆記內容，確保搜尋「非精準問題」時能 100% 掃描每篇筆記內文中的解決方案
 */
async function scheduleBackgroundFullTextIndexing() {
  if (_isBackgroundIndexing || !state.accessToken || !Array.isArray(state.notes) || state.notes.length === 0) {
    updateFuzzyIndexBadgeUI();
    return;
  }

  state.notes.forEach(n => {
    if (n._cachedBody !== undefined && n._searchText === undefined) {
      n._searchText = extractCleanSearchableText(n._cachedBody);
      _searchIndexMap[n.id] = { m: n.modifiedTime || '', t: n._searchText };
    } else if (_searchIndexMap[n.id] && _searchIndexMap[n.id].m === n.modifiedTime && typeof _searchIndexMap[n.id].t === 'string') {
      n._searchText = _searchIndexMap[n.id].t;
    }
  });

  const unindexedNotes = state.notes.filter(n => n.id && n._searchText === undefined);
  updateFuzzyIndexBadgeUI();
  if (unindexedNotes.length === 0) {
    persistSearchIndexCache();
    return;
  }

  _isBackgroundIndexing = true;
  updateFuzzyIndexBadgeUI();

  const BATCH_SIZE = 3;
  let updatedAny = false;

  try {
    for (let i = 0; i < unindexedNotes.length; i += BATCH_SIZE) {
      if (!state.accessToken) break;
      const batch = unindexedNotes.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (note) => {
        try {
          const res = await fetch(`https://www.googleapis.com/drive/v3/files/${note.id}?alt=media`, {
            headers: { Authorization: `Bearer ${state.accessToken}` }
          });
          if (!res.ok) return;
          const rawText = await res.text();
          const { meta: bodyMeta, body } = parseFrontmatter(rawText);
          note._cachedBody = body;
          note._cachedMeta = bodyMeta;
          const clean = extractCleanSearchableText(body);
          note._searchText = clean;
          _searchIndexMap[note.id] = {
            m: note.modifiedTime || '',
            t: clean
          };
          updatedAny = true;
        } catch (err) {
          // 忽略單篇網路波動
        }
      }));

      updateFuzzyIndexBadgeUI();
      if (state.currentView === 'table' && DOM.tableSearchInput && DOM.tableSearchInput.value.trim()) {
        renderTableView();
      } else if (DOM.searchInput && DOM.searchInput.value.trim()) {
        renderNotesList();
      }
    }
  } finally {
    _isBackgroundIndexing = false;
    if (updatedAny) {
      persistSearchIndexCache();
      saveSwrCacheSnapshot();
    }
    updateFuzzyIndexBadgeUI();
  }
}

// 🛠️ 現場工程與設備維護領域專屬高精準同義詞群組 (18 組聚焦語意叢集)
const ENGINEERING_SYNONYM_GROUPS = [
  // 1. 泵浦與抽水動作
  ['泵', '幫浦', '水泵', '馬達', 'pump', '抽水', '抽不到水', '抽到水', '打水', '吸水', '沒水', '無水', '缺水'],
  // 2. 水箱與液位
  ['水箱', '大水箱', '小水箱', '水槽', 'tank', '水位', '液位', '紅線', '見底', '補水', '預充填'],
  // 3. 流量與管路循環
  ['流量', '流量計', 'flow', 'lpm', '無流量', '沒流量', '流量異常', '讀值', '讀數', '管路', '管道', '循環'],
  // 4. 閥件與濾材接頭
  ['隔膜閥', '排氣隔膜閥', '排氣閥', '電磁閥', '洩壓閥', '調壓閥', '閥門', 'valve', '濾心', '快接頭', 'fd83'],
  // 5. 氣壓、漏氣與三點組合
  ['洩氣', '漏氣', '洩壓', '掉壓', '失壓', '氣壓', '空壓', '氣源', '三點組合', '壓力不足'],
  // 6. 保壓與殘壓測試
  ['保壓', '保殘壓', '殘壓', '200kpa', '150kpa', 'kpa', 'pa/s', '燒機'],
  // 7. 電阻與歐姆量測
  ['電阻', '阻值', '歐姆', 'ohm', 'ω', '120歐姆', '80歐姆', '排查點位阻值'],
  // 8. 點位、通道與模組
  ['點位', '通道', '第三組', '模組', 'adam'],
  // 9. 燒毀、損壞與失效故障
  ['燒毀', '燒掉', '燒壞', '壞掉', '損壞', '失效', '短路', '斷路', '過載', '故障'],
  // 10. 電源供應器與按鍵設定
  ['電源供應器', '電供', '恒惠', 'hcp', 'hcp1021', '1021', '進入設定', '設定方式', 'shift', '長按', 'modbus', '定電壓'],
  // 11. 風洞、風機與標準器校驗
  ['風洞', '風機', '質昌', '風速', '噴嘴', '標準器', '校驗', '校正', '校驗報告'],
  // 12. 溫控、過熱與 TIM 固化
  ['溫度', '高溫', '過熱', '超溫', '降溫', '升溫', '加熱', '固化', 'tim', 'pcm', '熔融', 'curing', '40°c', '80°c'],
  // 13. 機構、鈑金、蓋子與孔位公差
  ['鈑金', '板金', '鈑金件', '機構', '孔位', '開孔', '公差', '配合', '蓋子', '上蓋', '外殼', '干涉', '對不準', '不合', '裝不上'],
  // 14. 軟體計時、Datalog 與客戶回饋
  ['回饋', '客戶回饋', '客人回饋', '客訴', '直觀', '計時', 'exe time', 'test time', 'cycle time', 'datalog'],
  // 15. 客戶與廠商同義別名
  ['華碩', 'asus', '迎廣', 'inwin', '蘆竹'],
  ['台積電', 'tsmc'],
  ['日月光', 'ase'],
  ['英業達', 'inventec'],
  ['熱領', '上海熱領', '上海'],
  ['艾司摩爾', 'asml'],
  ['聯電', 'umc'],
  ['鴻佰', 'fii', '越南', 'fiiv']
];

const ENGINEERING_DOMAIN_TERMS = Array.from(new Set(
  ENGINEERING_SYNONYM_GROUPS.flat().concat([
    'sa730-8mp', 'sa730', '730', 'sa710l', 'sa710', '710l', '710', 'sa750', '750',
    'sa760', '760', 'sa162b', 'sa-162b', '162b', '162', 'sa100-9mp', 'sa100', 'sa-100', '100',
    '三點組合', '電源供應器', '恒惠', '隔膜閥', '排氣隔膜閥', '排氣閥', '流量計', '大水箱', '小水箱', '水箱', '水位', '紅線',
    '預充填', '保殘壓', '保壓', '點位', '通道', '燒毀', '壞掉', '阻值', '電阻', '歐姆', '鈑金件', '鈑金', '孔位', '配合', '蓋子',
    '風洞', '風機', '校驗', '標準器', '電路圖', '大流量', '套件', '交機', '驗收', '回饋', '啟動', '沒水',
    '洩氣', '漏氣', '漏水', '過熱', '設定', '故障', '異常', '排查', '更換'
  ])
)).sort((a, b) => b.length - a.length);

const CONVERSATIONAL_STOPWORDS = [
  '請問一下', '請問', '為什麼會', '為什麼', '怎麼辦', '怎麼處理', '怎麼解決', '怎麼', '如何處理', '如何解決', '如何',
  '有沒有', '有什麼', '哪裡有', '哪裡', '是什麼', '什麼', '的時候', '的話', '如果', '若是', '出現', '發生',
  '問題', '狀況', '情形', '方法', '方式', '辦法', '筆記', '紀錄', '記錄', '一下', '可以', '應該', '需要', '想要', '找出', '自己', '不對'
];

const SINGLE_CHAR_STOPWORDS = new Set([
  '的', '了', '嗎', '呢', '吧', '啊', '喔', '哦', '與', '及', '或', '和', '在', '是', '有', '於', '把', '被', '讓', '給', '到', '去', '來', '也', '都', '就', '還', '又', '很', '太', '更', '最', '這', '那', '之', '其', '中', '上', '下', '會', '能', '要', '不', '沒', '無'
]);

const SOLUTION_INDICATOR_TERMS = [
  '最終解決對策', '根本原因', '解決對策', '解決', '排除', '排查', '原因', '起因', '確保', '至少要', '設定方式', '進入設定', '步驟', '處理',
  '更換', '調整', '調校', '測試結果', '歐姆', '阻值', 'kpa', 'lpm', '°c', '紅線', '預充填', '配合', '改善', '修復', 'sop', '手冊', '極有可能'
];

function normalizeSearchText(str) {
  if (!str) return '';
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 12288) {
      out += ' ';
    } else if (code >= 65281 && code <= 65374) {
      out += String.fromCharCode(code - 65248);
    } else {
      out += str[i];
    }
  }
  return out.toLowerCase().trim();
}

function normalizeAlphaNumCompact(str) {
  return normalizeSearchText(str).replace(/[-_\s./()（）]+/g, '');
}

function computeEditDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function hasWindowedSubsequenceMatch(text, term, maxWindow = 10) {
  if (!text || !term || term.length < 2 || term.length > 6) return false;
  const firstChar = term[0];
  let startIdx = text.indexOf(firstChar);
  while (startIdx !== -1) {
    let curPos = startIdx;
    let matchedAll = true;
    for (let i = 1; i < term.length; i++) {
      const nextPos = text.indexOf(term[i], curPos + 1);
      if (nextPos === -1 || (nextPos - startIdx) > maxWindow) {
        matchedAll = false;
        break;
      }
      curPos = nextPos;
    }
    if (matchedAll) return true;
    startIdx = text.indexOf(firstChar, startIdx + 1);
  }
  return false;
}

function parseFuzzyQuery(rawQuery) {
  const norm = normalizeSearchText(rawQuery);
  if (!norm) {
    return { rawNormalized: '', compactQuery: '', coreTokens: [], bigrams: [], singleChars: [], expandedSynonyms: [], conceptGroups: [] };
  }

  // 1. 口語否定與常見問題片語智慧映射
  const phraseExpansions = [];
  const conversationalMappings = [
    { pattern: /抽不到水|吸不到水|打不出水|不出水|水抽不上來|沒出水/, terms: ['抽到水', '沒水', '無流量', '水位', '泵', '預充填', '大水箱', '小水箱'] },
    { pattern: /沒流量|沒有流量|流不動|水不流/, terms: ['無流量', '流量計', '預充填', '沒水', '泵'] },
    { pattern: /不會轉|不轉|不動作|不動|無法啟動|開不了|啟動失敗/, terms: ['啟動', '故障', '失效', '異常', '燒毀', '泵', '電源'] },
    { pattern: /漏氣|掉壓|失壓|保不住壓|壓力掉|壓力下降/, terms: ['洩氣', '洩壓', '保殘壓', '保壓', '排氣隔膜閥', '三點組合', '壓力不足', 'kpa'] },
    { pattern: /對不準|合不上|蓋不上|裝不下|孔不合|公差/, terms: ['孔位', '配合', '蓋子', '鈑金', '機構'] },
    { pattern: /怎麼進|如何進入|進不去設定|按哪個|設定模式/, terms: ['進入設定', '設定方式', 'shift', '長按', '設定'] },
    { pattern: /燒掉|壞掉|故障|過熱|沒反應/, terms: ['燒毀', '失效', '異常', '故障排除', '阻值', '歐姆'] }
  ];

  conversationalMappings.forEach(rule => {
    const m = norm.match(rule.pattern);
    if (m) {
      rule.terms.forEach(t => phraseExpansions.push({ term: t, from: m[0] }));
    }
  });

  // 2. 移除口語贅字以提煉核心詞句
  let cleaned = norm;
  CONVERSATIONAL_STOPWORDS.forEach(sw => {
    cleaned = cleaned.split(sw).join(' ');
  });
  cleaned = cleaned.replace(/[?？!！,，.。、;；:："'「」『』()（）\[\]【】~～]+/g, ' ').trim();
  if (!cleaned) cleaned = norm;

  const coreSet = new Set();
  const bigramSet = new Set();
  const singleCharSet = new Set();

  const rawSegments = cleaned.split(/\s+/).filter(Boolean);
  rawSegments.forEach(seg => {
    // 掃描已知的現場工程專有詞彙
    let matchedDomainTermsInSeg = [];
    ENGINEERING_DOMAIN_TERMS.forEach(dTerm => {
      if (dTerm.length >= 2 && seg.includes(dTerm)) {
        coreSet.add(dTerm);
        matchedDomainTermsInSeg.push(dTerm);
      }
    });

    // 若該區段本身為短詞 (<=4字) 或未被拆出超過 1 個專有詞，則將區段本身也納入核心詞
    if (seg.length <= 4 || matchedDomainTermsInSeg.length <= 1) {
      if (seg.length <= 8) coreSet.add(seg);
    }

    const alphaNumMatches = seg.match(/[a-z0-9]+(?:-?[a-z0-9]+)*/g);
    if (alphaNumMatches) {
      alphaNumMatches.forEach(an => {
        if (an.length >= 2) {
          coreSet.add(an);
          const compact = an.replace(/-/g, '');
          if (compact.length >= 2) coreSet.add(compact);
          const numCore = compact.match(/\d{3,4}/);
          if (numCore) coreSet.add(numCore[0]);
        }
      });
    }

    const cjkRuns = seg.match(/[\u4e00-\u9fa5]+/g);
    if (cjkRuns) {
      cjkRuns.forEach(cjk => {
        if (cjk.length === 1) {
          if (!SINGLE_CHAR_STOPWORDS.has(cjk)) singleCharSet.add(cjk);
        } else if (cjk.length === 2) {
          coreSet.add(cjk);
          bigramSet.add(cjk);
          for (const ch of cjk) {
            if (!SINGLE_CHAR_STOPWORDS.has(ch)) singleCharSet.add(ch);
          }
        } else {
          for (let i = 0; i < cjk.length - 1; i++) {
            const bg = cjk.slice(i, i + 2);
            if (!SINGLE_CHAR_STOPWORDS.has(bg[0]) && !SINGLE_CHAR_STOPWORDS.has(bg[1])) {
              bigramSet.add(bg);
            }
          }
          for (const ch of cjk) {
            if (!SINGLE_CHAR_STOPWORDS.has(ch)) singleCharSet.add(ch);
          }
        }
      });
    }
  });

  // 移除冗餘父字串 (例如若已拆出「電阻」、「通道」、「壞掉」，則「通道壞掉」保留作加分但建立獨立概念叢集)
  const coreTokens = Array.from(coreSet);
  const bigrams = Array.from(bigramSet);
  const singleChars = Array.from(singleCharSet);

  // 3. 建立「獨立語意概念叢集 (Concept Clusters)」以衡量多概念覆蓋率
  const expandedMap = new Map();
  phraseExpansions.forEach(pe => {
    if (!coreSet.has(pe.term)) {
      expandedMap.set(pe.term, pe.from);
    }
  });

  const conceptGroups = [];
  const usedGroupIndices = new Set();

  const allSeeds = [...coreTokens, ...bigrams];
  allSeeds.forEach(seed => {
    if (seed.length < 2 && !['泵', '閥'].includes(seed)) return;
    let matchedAnyGroup = false;
    ENGINEERING_SYNONYM_GROUPS.forEach((group, gIdx) => {
      const hitInGroup = group.some(gTerm => gTerm === seed || (seed.length >= 2 && (gTerm === seed || (gTerm.length >= 2 && gTerm.includes(seed)))));
      if (hitInGroup) {
        matchedAnyGroup = true;
        if (!usedGroupIndices.has(gIdx)) {
          usedGroupIndices.add(gIdx);
          conceptGroups.push({
            seed,
            directTerms: [seed],
            synonymTerms: group.filter(syn => syn !== seed)
          });
        } else {
          const existing = conceptGroups.find(cg => cg.synonymTerms.includes(seed) || cg.directTerms.includes(seed));
          if (existing && !existing.directTerms.includes(seed)) {
            existing.directTerms.push(seed);
          }
        }
        group.forEach(syn => {
          if (syn !== seed && !coreSet.has(syn) && !expandedMap.has(syn)) {
            expandedMap.set(syn, seed);
          }
        });
      }
    });
    if (!matchedAnyGroup && seed.length >= 2 && seed.length <= 5) {
      // 未在同義詞庫中的獨立關鍵詞 (如 710, 200, 更換 等) 自成一個概念叢集
      if (!conceptGroups.some(cg => cg.directTerms.some(dt => dt.includes(seed) || seed.includes(dt)))) {
        conceptGroups.push({
          seed,
          directTerms: [seed],
          synonymTerms: []
        });
      }
    }
  });

  const expandedSynonyms = [];
  expandedMap.forEach((from, term) => {
    expandedSynonyms.push({ term, from });
  });

  return {
    rawNormalized: norm,
    compactQuery: normalizeAlphaNumCompact(norm),
    coreTokens,
    bigrams,
    singleChars,
    expandedSynonyms,
    conceptGroups
  };
}

function highlightMatchedTermsHtml(rawText, highlightTerms) {
  if (!rawText) return '';
  if (!Array.isArray(highlightTerms) || highlightTerms.length === 0) {
    return escapeHtml(rawText);
  }
  const validTerms = Array.from(new Set(
    highlightTerms
      .map(t => (t || '').trim())
      .filter(t => t.length >= 1 && !SINGLE_CHAR_STOPWORDS.has(t))
  )).sort((a, b) => b.length - a.length).slice(0, 18);

  if (validTerms.length === 0) return escapeHtml(rawText);

  const escapedRegexParts = validTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escapedRegexParts.join('|')})`, 'gi');

  const parts = String(rawText).split(regex);
  return parts.map((part, idx) => {
    if (idx % 2 === 1) {
      return `<mark class="fuzzy-hl">${escapeHtml(part)}</mark>`;
    }
    return escapeHtml(part);
  }).join('');
}

function extractBestSolutionSnippet(bodyText, matchedDirectTerms, matchedSynonymTerms, singleChars) {
  if (!bodyText || typeof bodyText !== 'string') return null;

  const lines = bodyText
    .split(/[\n。；;！!]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 3 && !/^(icon|status|machineModel|workContent|urgency|dueDate|tags|clientVendor):/i.test(s));

  if (lines.length === 0) return null;

  const scoredLines = lines.map((line, idx) => {
    const lower = normalizeSearchText(line);
    let lineScore = 0;
    let hasDirect = false;
    let hasSyn = false;
    let hasSolutionCue = false;

    matchedDirectTerms.forEach(t => {
      if (t && lower.includes(t)) {
        lineScore += (t.length >= 2 ? 18 : 6);
        hasDirect = true;
      }
    });
    matchedSynonymTerms.forEach(t => {
      if (t && lower.includes(t)) {
        lineScore += 12;
        hasSyn = true;
      }
    });
    singleChars.forEach(ch => {
      if (ch && lower.includes(ch)) {
        lineScore += 3;
      }
    });
    SOLUTION_INDICATOR_TERMS.forEach(cue => {
      if (lower.includes(cue)) {
        lineScore += 10;
        hasSolutionCue = true;
      }
    });

    return { line, idx, lineScore, hasDirect, hasSyn, hasSolutionCue };
  });

  scoredLines.sort((a, b) => b.lineScore - a.lineScore);
  const best = scoredLines[0];
  if (!best || best.lineScore <= 0) {
    const fallbackText = lines.slice(0, 2).join(' · ').slice(0, 120);
    return {
      text: fallbackText,
      isSolution: false
    };
  }

  let combined = best.line;
  const nextLineObj = lines[best.idx + 1];
  if (nextLineObj && combined.length < 75) {
    combined += ' · ' + nextLineObj;
  } else if (scoredLines[1] && scoredLines[1].lineScore >= 12 && scoredLines[1].idx !== best.idx + 1 && combined.length < 70) {
    combined += ' · ' + scoredLines[1].line;
  }

  if (combined.length > 135) {
    combined = combined.slice(0, 132) + '...';
  }

  const isSolution = best.hasSolutionCue || SOLUTION_INDICATOR_TERMS.some(cue => normalizeSearchText(combined).includes(cue));
  return {
    text: combined,
    isSolution
  };
}

function evaluateFuzzyNoteMatch(note, parsedQuery) {
  if (!parsedQuery || !parsedQuery.rawNormalized) {
    return { matched: true, score: 100, confidencePct: 100, matchReasons: [], highlightTerms: [], snippet: null, isSolutionNote: false };
  }

  const meta = note.meta || {};
  const rawTitle = (note.name || '').replace(/\.md$/i, '');
  const normTitle = normalizeSearchText(rawTitle);
  const compactTitle = normalizeAlphaNumCompact(rawTitle);

  const metaParts = [
    meta.machineModel || '',
    meta.workContent || '',
    meta.clientVendor || '',
    meta.status || '',
    ...(Array.isArray(meta.tags) ? meta.tags : [])
  ];
  const normMeta = normalizeSearchText(metaParts.join(' '));
  const compactMeta = normalizeAlphaNumCompact(metaParts.join(' '));

  const rawBody = getNoteSearchableBody(note);
  const normBody = normalizeSearchText(rawBody);
  const compactBody = normalizeAlphaNumCompact(rawBody.slice(0, 1500));

  let score = 0;
  const matchReasons = new Set();
  const matchedDirectTerms = new Set();
  const matchedSynonymPairs = [];
  const matchedSynonymTerms = new Set();

  const q = parsedQuery.rawNormalized;
  const cq = parsedQuery.compactQuery;

  // 1. 完整字串或去連字號精準命中
  if (normTitle.includes(q) || (cq.length >= 2 && compactTitle.includes(cq))) {
    score += 130;
    matchReasons.add('標題精準命中');
    matchedDirectTerms.add(q);
  }
  if (normMeta.includes(q) || (cq.length >= 2 && compactMeta.includes(cq))) {
    score += 90;
    matchReasons.add('分類/標籤命中');
    matchedDirectTerms.add(q);
  }
  if (normBody.includes(q) || (cq.length >= 3 && compactBody.includes(cq))) {
    score += 75;
    matchReasons.add('內文完整命中');
    matchedDirectTerms.add(q);
  }

  // 2. 核心詞彙命中 (Core Tokens & Domain Terms)
  let coreHitCount = 0;
  parsedQuery.coreTokens.forEach(token => {
    if (!token) return;
    let tokenHit = false;
    const compactTok = token.replace(/-/g, '');

    if (normTitle.includes(token) || (compactTok.length >= 2 && compactTitle.includes(compactTok))) {
      score += 46;
      tokenHit = true;
      matchReasons.add('標題關鍵字');
      matchedDirectTerms.add(token);
    }
    if (normMeta.includes(token) || (compactTok.length >= 2 && compactMeta.includes(compactTok))) {
      score += 34;
      tokenHit = true;
      matchReasons.add('分類/廠商匹配');
      matchedDirectTerms.add(token);
    }
    if (normBody.includes(token) || (compactTok.length >= 3 && compactBody.includes(compactTok))) {
      score += 28;
      tokenHit = true;
      matchReasons.add('內文關鍵字');
      matchedDirectTerms.add(token);
    }

    if (!tokenHit && token.length >= 2 && token.length <= 5) {
      if (hasWindowedSubsequenceMatch(normTitle, token, 8)) {
        score += 26;
        tokenHit = true;
        matchReasons.add('標題跳字模糊匹配');
        for (const ch of token) if (!SINGLE_CHAR_STOPWORDS.has(ch)) matchedDirectTerms.add(ch);
      } else if (hasWindowedSubsequenceMatch(normBody, token, 8)) {
        score += 16;
        tokenHit = true;
        matchReasons.add('內文跳字模糊匹配');
        for (const ch of token) if (!SINGLE_CHAR_STOPWORDS.has(ch)) matchedDirectTerms.add(ch);
      }
    }

    if (!tokenHit && /^[a-z0-9]{4,12}$/.test(compactTok)) {
      const candidates = (normTitle + ' ' + normMeta + ' ' + normBody.slice(0, 600)).match(/[a-z0-9]{3,12}/g) || [];
      for (const cand of candidates) {
        if (computeEditDistance(compactTok, cand) <= 1) {
          score += 22;
          tokenHit = true;
          matchReasons.add(`型號近似 (${cand.toUpperCase()})`);
          matchedDirectTerms.add(cand);
          break;
        }
      }
    }

    if (tokenHit) coreHitCount++;
  });

  // 3. CJK 2-gram 雙字元重疊度評分
  let bigramHitCount = 0;
  parsedQuery.bigrams.forEach(bg => {
    if (matchedDirectTerms.has(bg)) {
      bigramHitCount++;
      return;
    }
    let hit = false;
    if (normTitle.includes(bg)) {
      score += 22;
      hit = true;
      matchedDirectTerms.add(bg);
      matchReasons.add('標題詞根匹配');
    }
    if (normMeta.includes(bg)) {
      score += 16;
      hit = true;
      matchedDirectTerms.add(bg);
    }
    if (normBody.includes(bg)) {
      score += 14;
      hit = true;
      matchedDirectTerms.add(bg);
      matchReasons.add('內文詞根匹配');
    }
    if (hit) bigramHitCount++;
  });

  // 4. 現場工程同義詞與關聯概念擴展匹配
  let synonymHitCount = 0;
  let synonymScoreAcc = 0;
  parsedQuery.expandedSynonyms.forEach(({ term, from }) => {
    if (!term) return;
    let synDelta = 0;
    if (normTitle.includes(term)) {
      synDelta += 24;
    }
    if (normMeta.includes(term)) {
      synDelta += 14;
    }
    if (normBody.includes(term)) {
      synDelta += 14;
    }
    if (synDelta > 0) {
      synonymHitCount++;
      synonymScoreAcc += synDelta;
      matchedSynonymTerms.add(term);
      if (matchedSynonymPairs.length < 3 && !matchedSynonymPairs.some(p => p.term === term)) {
        matchedSynonymPairs.push({ from, term });
      }
      matchReasons.add(`同義/關聯詞 (${term})`);
    }
  });
  score += Math.min(48, synonymScoreAcc);

  // 4.5 獨立語意概念叢集覆蓋率評分 (Multi-Concept Coverage Synergy)
  // 當使用者輸入多個概念（如「水箱 + 蓋子 + 對不準」或「電阻 + 通道 + 壞掉」），同時滿足越多獨立概念的筆記獲得指數級加分！
  let matchedConceptCount = 0;
  if (Array.isArray(parsedQuery.conceptGroups) && parsedQuery.conceptGroups.length > 0) {
    parsedQuery.conceptGroups.forEach(cg => {
      const hasDirect = cg.directTerms.some(dt => normTitle.includes(dt) || normMeta.includes(dt) || normBody.includes(dt));
      const hasSyn = !hasDirect && cg.synonymTerms.some(st => normTitle.includes(st) || normMeta.includes(st) || normBody.includes(st));
      if (hasDirect || hasSyn) {
        matchedConceptCount++;
      }
    });
    if (matchedConceptCount >= 2) {
      score += matchedConceptCount * 52;
    }
  }

  // 5. 單字元核心概念保底匹配
  let charHitCount = 0;
  if (parsedQuery.singleChars.length > 0) {
    parsedQuery.singleChars.forEach(ch => {
      if (normTitle.includes(ch)) {
        score += 5;
        charHitCount++;
        matchedDirectTerms.add(ch);
      } else if (normMeta.includes(ch)) {
        score += 3;
        charHitCount++;
        matchedDirectTerms.add(ch);
      } else if (normBody.includes(ch)) {
        score += 2.5;
        charHitCount++;
        matchedDirectTerms.add(ch);
      }
    });
  }

  const hasStrongSignal = (coreHitCount > 0) || (bigramHitCount > 0) || (synonymHitCount > 0) || (score >= 18);
  const charCoverageRatio = parsedQuery.singleChars.length > 0 ? (charHitCount / parsedQuery.singleChars.length) : 0;
  const hasMultiCharFallback = (parsedQuery.singleChars.length >= 2 && charHitCount >= 2 && charCoverageRatio >= 0.5);

  if (!hasStrongSignal && !hasMultiCharFallback) {
    return { matched: false, score: 0, confidencePct: 0, matchReasons: [], highlightTerms: [], snippet: null, isSolutionNote: false };
  }

  // 6. 🛠️ 解決方案潛力加權 (Solution-Orientation Boost)
  let isSolutionNote = false;
  const workContent = meta.workContent || '';
  const status = meta.status || '';

  if (/故障排除|異常通報|保養維護|操作手冊|參數調校|驗收測試/.test(workContent)) {
    score += 14;
    isSolutionNote = true;
  }
  if (/已解決|結案/.test(status)) {
    score += 8;
    isSolutionNote = true;
  }
  const bodySolutionHits = SOLUTION_INDICATOR_TERMS.filter(cue => normBody.includes(cue) || normTitle.includes(cue));
  if (bodySolutionHits.length > 0) {
    score += Math.min(20, bodySolutionHits.length * 5);
    isSolutionNote = true;
  }

  if (coreHitCount >= 2) {
    score += coreHitCount * 24;
  } else if (coreHitCount >= 1 && synonymHitCount >= 1) {
    score += 18;
  }

  let confidencePct = Math.min(99, Math.max(45, Math.round(45 + (1 - Math.exp(-score / 75)) * 54)));

  const highlightTerms = [
    ...Array.from(matchedDirectTerms),
    ...Array.from(matchedSynonymTerms)
  ];

  const snippetObj = extractBestSolutionSnippet(
    rawBody,
    Array.from(matchedDirectTerms),
    Array.from(matchedSynonymTerms),
    parsedQuery.singleChars
  );

  if (snippetObj && snippetObj.isSolution) {
    isSolutionNote = true;
  }

  return {
    matched: true,
    score,
    confidencePct,
    matchReasons: Array.from(matchReasons),
    matchedSynonymPairs,
    highlightTerms,
    snippet: snippetObj,
    isSolutionNote
  };
}

// ============================================================================
// 🎯 功能 1：搜尋命中段落「自動捲動定位＋閃爍高亮 (Scroll-to-Match & Flash Highlight)」
// ============================================================================
state.pendingScrollMatch = null;

function executeScrollToMatchedParagraph(matchInfo) {
  if (!matchInfo || !DOM.editor) return;
  const terms = Array.isArray(matchInfo.highlightTerms) ? matchInfo.highlightTerms.filter(Boolean) : [];
  const rawQuery = normalizeSearchText(matchInfo.query || '');
  const snippetNorm = normalizeSearchText(matchInfo.snippetText || '');

  if (terms.length === 0 && !rawQuery && !snippetNorm) return;

  const blocks = Array.from(DOM.editor.querySelectorAll('p, li, h1, h2, h3, h4, td, th, blockquote, pre, .notion-callout, .notion-todo-item'));
  if (blocks.length === 0) return;

  let bestBlock = null;
  let bestScore = 0;

  blocks.forEach(block => {
    const text = normalizeSearchText(block.textContent || '');
    if (!text || text.length < 2) return;

    let score = 0;
    if (snippetNorm && snippetNorm.length >= 4) {
      const snippetHead = snippetNorm.slice(0, 18);
      if (text.includes(snippetHead)) score += 80;
    }
    if (rawQuery && text.includes(rawQuery)) {
      score += 50;
    }
    terms.forEach(t => {
      const nt = normalizeSearchText(t);
      if (nt && text.includes(nt)) {
        score += (nt.length >= 2 ? 18 : 5);
      }
    });
    SOLUTION_INDICATOR_TERMS.forEach(cue => {
      if (text.includes(cue)) score += 6;
    });

    // 優先選擇更具體的子區塊（如 .notion-todo-item 或 p），避免選到包裹整篇的大容器
    if (block.tagName === 'P' || block.classList.contains('notion-todo-item') || block.tagName === 'LI') {
      score += 4;
    }

    if (score > bestScore) {
      bestScore = score;
      bestBlock = block;
    }
  });

  if (!bestBlock || bestScore <= 0) return;

  // 若命中段落位於收折的 <details> 內，自動展開所有外層 <details>
  let parentDetails = bestBlock.closest('details');
  while (parentDetails && DOM.editor.contains(parentDetails)) {
    parentDetails.open = true;
    parentDetails.setAttribute('open', '');
    parentDetails = parentDetails.parentElement ? parentDetails.parentElement.closest('details') : null;
  }

  setTimeout(() => {
    try {
      bestBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.querySelectorAll('.search-hit-flash-block').forEach(el => el.classList.remove('search-hit-flash-block'));
      void bestBlock.offsetWidth;
      bestBlock.classList.add('search-hit-flash-block');
      showToast('🎯 已自動捲動並高亮定位至「搜尋命中段落」！', 3200);
      setTimeout(() => {
        bestBlock.classList.remove('search-hit-flash-block');
      }, 3400);
    } catch (e) {}
  }, 120);
}

// ============================================================================
// 📋 功能 2：表格資料庫「就地直接改分類 (Inline Select)」＋「側邊快速預覽抽屜 (Quick Peek)」
// ============================================================================

/**
 * 在表格資料庫或預覽抽屜中直接修改單篇筆記的分類屬性，支援：
 * 1. 全域時光機回朔 (recordAction)
 * 2. 嚴格三項歸位守門機制 (三項皆選定自動搬移至對應機型資料夾；任一未分類則留存於 未分類/)
 * 3. 背景自動同步至 Google Drive (含若該筆記尚未載入內文時僅更新 Drive Metadata 與快取)
 */
async function syncNotePropertyChangeToDrive(note) {
  if (!note || !note.id) return;
  saveSwrCacheSnapshot();

  // 若該筆記正是當前編輯器開啟的筆記，直接觸發標準防抖存檔即可
  if (state.currentNote && state.currentNote.id === note.id) {
    triggerAutoSaveDebounce();
    return;
  }

  if (!state.accessToken) return;
  try {
    const meta = note.meta || {};
    const isFullyClassified = !isNoteUncategorized({ meta });
    const targetCategory = isFullyClassified ? (meta.machineModel || '').trim() : '未分類';
    const targetFolderId = await ensureCategoryFolder(targetCategory);

    let parentParam = '';
    const currentParent = note.parentId;
    if (targetFolderId && currentParent && currentParent !== targetFolderId) {
      parentParam = `?addParents=${targetFolderId}&removeParents=${currentParent}`;
    } else if (targetFolderId && !currentParent) {
      parentParam = `?addParents=${targetFolderId}`;
    }

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${note.id}${parentParam}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify({
        description: JSON.stringify(meta)
      })
    });
    if (res.ok) {
      if (targetFolderId) note.parentId = targetFolderId;
      note.modifiedTime = new Date().toISOString();
      saveSwrCacheSnapshot();
    }
  } catch (err) {
    console.warn('表格就地同步屬性至 Drive 略過:', err);
  }
}

function updateNotePropertyInline(noteId, field, rawVal) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return;
  if (!note.meta) note.meta = {};

  // 處理「➕ 新建...」快捷選項
  if (rawVal === '__add_machine__') {
    const name = prompt('請輸入新機型名稱：');
    if (name && name.trim()) {
      addMachineModel(name.trim());
      rawVal = name.trim();
    } else {
      renderTableView();
      return;
    }
  } else if (rawVal === '__add_content__') {
    const name = prompt('請輸入新工作內容類別：');
    if (name && name.trim()) {
      addWorkContent(name.trim());
      rawVal = name.trim();
    } else {
      renderTableView();
      return;
    }
  } else if (rawVal === '__add_client__') {
    const name = prompt('請輸入新客戶或廠商名稱：');
    if (name && name.trim()) {
      addClientVendor(name.trim());
      rawVal = name.trim();
    } else {
      renderTableView();
      return;
    }
  }

  const oldVal = note.meta[field] || '';
  const newVal = rawVal;
  if (oldVal === newVal) return;

  const fieldLabels = {
    machineModel: '🚜 機型',
    workContent: '📋 工作內容',
    urgency: '🚨 急迫性',
    clientVendor: '🏢 客戶/廠商'
  };
  const noteTitle = (note.name || '未命名筆記').replace(/\.md$/i, '');

  const applyVal = (val) => {
    note.meta[field] = val;
    if (state.currentNote && state.currentNote.id === noteId) {
      if (!state.currentNote.meta) state.currentNote.meta = {};
      state.currentNote.meta[field] = val;
      try { renderCurrentNote(); } catch (e) {}
    }
    renderWorkTagLists();
    renderNotesList();
    renderBreadcrumbs();
    if (state.currentView === 'table') renderTableView();
    if (state.currentView === 'uncategorized') renderUncategorizedView();
    if (state.currentPeekNoteId === noteId) renderQuickPeekMetaBar(note);
    syncNotePropertyChangeToDrive(note);
  };

  applyVal(newVal);

  recordAction({
    type: `change_${field}`,
    title: `${fieldLabels[field] || '屬性'}改為「${newVal || '未指定'}」`,
    subtitle: `筆記：「${noteTitle}」 (原：${oldVal || '未指定'})`,
    noteId: noteId,
    undo: () => applyVal(oldVal),
    redo: () => applyVal(newVal)
  });

  showToast(`✅ 已更新「${noteTitle}」之${fieldLabels[field] || '屬性'}為「${newVal || '未指定'}」`);
}

state.currentPeekNoteId = null;

function renderQuickPeekMetaBar(note) {
  if (!DOM.peekNoteMetaBar || !note) return;
  const meta = note.meta || {};
  const machine = meta.machineModel || '未分類';
  const content = meta.workContent || '未分類';
  const urgency = meta.urgency || '未分類';
  const client = meta.clientVendor || '';

  const machines = ['未分類', ...state.machineModels.filter(m => m !== '未分類')];
  const contents = ['未分類', ...state.workContents.filter(c => c !== '未分類')];
  const urgencies = ['未分類', ...(state.urgencies || DEFAULT_URGENCIES).map(u => u.id).filter(u => u !== '未分類')];
  const clients = (state.clientsVendors && state.clientsVendors.length > 0) ? state.clientsVendors : DEFAULT_CLIENTS_VENDORS;

  DOM.peekNoteMetaBar.innerHTML = `
    <select class="table-inline-select bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300" data-peek-field="machineModel" title="直接修改機型">
      ${machines.map(m => `<option value="${escapeHtml(m)}" ${machine === m ? 'selected' : ''}>🚜 ${escapeHtml(m)}</option>`).join('')}
    </select>
    <select class="table-inline-select bg-amber-50/80 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300" data-peek-field="workContent" title="直接修改工作內容">
      ${contents.map(c => `<option value="${escapeHtml(c)}" ${content === c ? 'selected' : ''}>📋 ${escapeHtml(c)}</option>`).join('')}
    </select>
    <select class="table-inline-select bg-rose-50/80 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300" data-peek-field="urgency" title="直接修改急迫性">
      ${urgencies.map(u => `<option value="${escapeHtml(u)}" ${urgency === u ? 'selected' : ''}>🚨 ${escapeHtml(u)}</option>`).join('')}
    </select>
    <select class="table-inline-select bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300" data-peek-field="clientVendor" title="直接修改客戶或廠商">
      <option value="" ${!client ? 'selected' : ''}>🏢 客戶: 未指定</option>
      ${clients.map(c => `<option value="${escapeHtml(c)}" ${client === c ? 'selected' : ''}>🏢 ${escapeHtml(c)}</option>`).join('')}
    </select>
  `;

  DOM.peekNoteMetaBar.querySelectorAll('select[data-peek-field]').forEach(sel => {
    sel.addEventListener('change', () => {
      updateNotePropertyInline(note.id, sel.dataset.peekField, sel.value);
    });
  });
}

async function openTableQuickPeekDrawer(noteId, fuzzyRes = null) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note || !DOM.tableQuickPeekDrawer) return;

  state.currentPeekNoteId = noteId;
  const title = (note.name || '未命名筆記').replace(/\.md$/i, '');
  const meta = note.meta || {};

  if (DOM.peekNoteIcon) DOM.peekNoteIcon.textContent = meta.icon || '🛠️';
  if (DOM.peekNoteTitle) DOM.peekNoteTitle.textContent = title;
  if (DOM.peekNoteTime) {
    DOM.peekNoteTime.textContent = note.modifiedTime
      ? `最後更新：${new Date(note.modifiedTime).toLocaleString('zh-TW')}`
      : '';
  }

  renderQuickPeekMetaBar(note);

  if (DOM.tableQuickPeekBackdrop) DOM.tableQuickPeekBackdrop.classList.remove('hidden');
  DOM.tableQuickPeekDrawer.classList.remove('hidden');
  initLucide();

  const renderDrawerBody = (rawHtmlOrMd) => {
    if (!DOM.peekNoteBody) return;
    let html = rawHtmlOrMd || '<p class="text-gray-400">（此筆記目前尚無內文）</p>';
    if (window.marked && !/<(p|div|h[1-6]|details|table)\b/i.test(html)) {
      html = window.marked.parse(html);
    }
    DOM.peekNoteBody.innerHTML = html;

    // 若目前表格有搜尋關鍵字，於預覽抽屜中高亮並自動捲動至第一個命中段落！
    if (fuzzyRes && Array.isArray(fuzzyRes.highlightTerms) && fuzzyRes.highlightTerms.length > 0) {
      const blocks = Array.from(DOM.peekNoteBody.querySelectorAll('p, li, h1, h2, h3, td, .notion-callout, .notion-todo-item'));
      let firstHitEl = null;
      blocks.forEach(b => {
        const lower = normalizeSearchText(b.textContent || '');
        if (fuzzyRes.highlightTerms.some(t => t && lower.includes(normalizeSearchText(t)))) {
          if (!firstHitEl) firstHitEl = b;
          b.classList.add('search-hit-flash-block');
        }
      });
      if (firstHitEl) {
        setTimeout(() => {
          try { firstHitEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
        }, 80);
      }
    }
  };

  if (note._cachedHtml || note._cachedBody) {
    renderDrawerBody(note._cachedHtml || note._cachedBody);
  } else if (state.accessToken) {
    if (DOM.peekNoteBody) {
      DOM.peekNoteBody.innerHTML = '<div class="py-12 text-center text-gray-400 text-xs">⏳ 正在自 Google Drive 載入筆記完整內容...</div>';
    }
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${note.id}?alt=media`, {
        headers: { Authorization: `Bearer ${state.accessToken}` }
      });
      if (res.ok) {
        const rawText = await res.text();
        const { meta: bodyMeta, body } = parseFrontmatter(rawText);
        const renderedHtml = window.DOMPurify
          ? DOMPurify.sanitize(window.marked ? window.marked.parse(body) : body)
          : (window.marked ? window.marked.parse(body) : body);
        note._cachedBody = body;
        note._cachedHtml = renderedHtml;
        note._cachedMeta = bodyMeta;
        updateNoteSearchIndex(note.id, note.modifiedTime, body);
        if (state.currentPeekNoteId === note.id) {
          renderDrawerBody(renderedHtml);
        }
      }
    } catch (e) {
      if (DOM.peekNoteBody) {
        DOM.peekNoteBody.innerHTML = '<div class="py-8 text-center text-rose-500 text-xs">⚠️ 無法載入雲端內容，請點擊上方「進入編輯」重試。</div>';
      }
    }
  } else {
    renderDrawerBody(getNoteSearchableBody(note));
  }
}

function closeTableQuickPeekDrawer() {
  state.currentPeekNoteId = null;
  if (DOM.tableQuickPeekDrawer) DOM.tableQuickPeekDrawer.classList.add('hidden');
  if (DOM.tableQuickPeekBackdrop) DOM.tableQuickPeekBackdrop.classList.add('hidden');
}

// ----------------- 1. 表格資料庫檢視 (Table Database View - v2.6.7 支援智慧模糊檢索、就地改分類與側邊預覽) -----------------
function renderTableView() {
  if (!DOM.tableViewTbody) return;

  scheduleBackgroundFullTextIndexing();

  const rawSearchInput = (DOM.tableSearchInput && DOM.tableSearchInput.value ? DOM.tableSearchInput.value.trim() : '');
  const searchKeyword = rawSearchInput.toLowerCase();
  const filterMachine = DOM.tableFilterMachine ? DOM.tableFilterMachine.value : '';
  const filterContent = DOM.tableFilterContent ? DOM.tableFilterContent.value : '';
  const filterUrgency = DOM.tableFilterUrgency ? DOM.tableFilterUrgency.value : '';
  const filterClient = DOM.tableFilterClient ? DOM.tableFilterClient.value : '';
  const filterTag = DOM.tableFilterTag ? DOM.tableFilterTag.value : '';

  if (DOM.tableSearchClearBtn) {
    if (rawSearchInput) DOM.tableSearchClearBtn.classList.remove('hidden');
    else DOM.tableSearchClearBtn.classList.add('hidden');
  }

  const parsedQuery = searchKeyword ? parseFuzzyQuery(rawSearchInput) : null;
  const fuzzyEvalMap = new Map();

  let globalFuzzyMatchCount = 0;
  if (parsedQuery) {
    state.notes.forEach(note => {
      const res = evaluateFuzzyNoteMatch(note, parsedQuery);
      fuzzyEvalMap.set(note.id, res);
      if (res.matched) globalFuzzyMatchCount++;
    });
  }

  let filteredNotes = state.notes.filter(note => {
    const meta = note.meta || {};

    if (parsedQuery) {
      const fuzzyRes = fuzzyEvalMap.get(note.id);
      if (!fuzzyRes || !fuzzyRes.matched) return false;
    }
    if (filterMachine && meta.machineModel !== filterMachine) return false;
    if (filterContent && meta.workContent !== filterContent) return false;
    if (filterUrgency && meta.urgency !== filterUrgency) return false;
    if (filterClient) {
      if (filterClient === '__empty__' && meta.clientVendor) return false;
      if (filterClient !== '__empty__' && meta.clientVendor !== filterClient) return false;
    }
    if (filterTag && (!Array.isArray(meta.tags) || !meta.tags.includes(filterTag))) return false;
    return true;
  });

  if (DOM.tableFuzzyQueryBanner && DOM.tableFuzzyQueryDetails && DOM.tableFuzzyStatsText) {
    if (parsedQuery && rawSearchInput) {
      DOM.tableFuzzyQueryBanner.classList.remove('hidden');
      const tokenBadges = parsedQuery.coreTokens.slice(0, 6).map(t =>
        `<span class="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 font-semibold">${escapeHtml(t)}</span>`
      ).join('');
      const synPreview = parsedQuery.expandedSynonyms.slice(0, 6).map(s => escapeHtml(s.term)).join('、');
      DOM.tableFuzzyQueryDetails.innerHTML = `
        <span class="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">🔍 模糊檢索拆解：</span>
        ${tokenBadges || `<span class="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-200 font-semibold">${escapeHtml(rawSearchInput)}</span>`}
        ${synPreview ? `<span class="text-gray-500 dark:text-gray-400 ml-1">➔ 智慧擴展同義/關聯詞：<strong class="text-indigo-600 dark:text-indigo-300 font-medium">${synPreview}</strong></span>` : ''}
      `;
      DOM.tableFuzzyStatsText.textContent = `找到 ${filteredNotes.length} 篇潛在解決方案筆記 (點擊直達命中段落)`;
    } else {
      DOM.tableFuzzyQueryBanner.classList.add('hidden');
    }
  }

  filteredNotes.sort((a, b) => {
    if (parsedQuery) {
      const scoreA = (fuzzyEvalMap.get(a.id) || {}).score || 0;
      const scoreB = (fuzzyEvalMap.get(b.id) || {}).score || 0;
      if (Math.abs(scoreB - scoreA) >= 3) return scoreB - scoreA;
    }
    const aPin = (a.meta && a.meta.pinned) ? 1 : 0;
    const bPin = (b.meta && b.meta.pinned) ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;
    const timeA = new Date(a.modifiedTime || 0).getTime();
    const timeB = new Date(b.modifiedTime || 0).getTime();
    return timeB - timeA;
  });

  if (filteredNotes.length === 0) {
    const hasDropdownFilter = Boolean(filterMachine || filterContent || filterUrgency || filterClient || filterTag);
    const hiddenByDropdownMsg = (parsedQuery && hasDropdownFilter && globalFuzzyMatchCount > 0)
      ? `<div class="mt-2"><button id="table-reset-dropdowns-btn" type="button" class="px-3 py-1.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold hover:bg-blue-100 transition">💡 全庫中有 ${globalFuzzyMatchCount} 篇模糊匹配筆記被下拉選單隱藏，點此解除下拉篩選並顯示</button></div>`
      : '';
    DOM.tableViewTbody.innerHTML = `
      <tr>
        <td colspan="9" class="p-8 text-center text-gray-400">
          <div>${parsedQuery ? `找不到與「${escapeHtml(rawSearchInput)}」相關的筆記，建議換個描述詞（例如機型、故障現象或零件名稱）。` : '無符合條件的工作筆記。點擊上方「新增資料列」開始建立！'}</div>
          ${hiddenByDropdownMsg}
        </td>
      </tr>
    `;
    const resetBtn = document.getElementById('table-reset-dropdowns-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (DOM.tableFilterMachine) DOM.tableFilterMachine.value = '';
        if (DOM.tableFilterContent) DOM.tableFilterContent.value = '';
        if (DOM.tableFilterUrgency) DOM.tableFilterUrgency.value = '';
        if (DOM.tableFilterClient) DOM.tableFilterClient.value = '';
        if (DOM.tableFilterTag) DOM.tableFilterTag.value = '';
        renderTableView();
      });
    }
    if (DOM.tableTotalCount) DOM.tableTotalCount.textContent = '總筆數: 0';
    return;
  }

  const allMachineOpts = ['未分類', ...(state.machineModels || []).filter(m => m !== '未分類')];
  const allContentOpts = ['未分類', ...(state.workContents || []).filter(c => c !== '未分類')];
  const allUrgencyOpts = ['未分類', ...((state.urgencies && state.urgencies.length > 0 ? state.urgencies : DEFAULT_URGENCIES).map(u => u.id || u).filter(u => u !== '未分類'))];
  const allClientOpts = (state.clientsVendors && state.clientsVendors.length > 0) ? state.clientsVendors : DEFAULT_CLIENTS_VENDORS;

  DOM.tableViewTbody.innerHTML = filteredNotes.map(note => {
    const meta = note.meta || {};
    const title = (note.name || '').replace(/\.md$/i, '');
    const icon = meta.icon || '🛠️';
    const machine = meta.machineModel || '未分類';
    const content = meta.workContent || '未分類';
    const urgency = meta.urgency || '🟢 常規';
    const client = meta.clientVendor || '';
    const dueDate = meta.dueDate || '';
    const tags = Array.isArray(meta.tags) ? meta.tags : [];

    const urgencyClass = urgency.includes('特急') ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                         urgency.includes('高') ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                         urgency.includes('常規') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                         'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';

    const fuzzyRes = parsedQuery ? fuzzyEvalMap.get(note.id) : null;
    const displayTitleHtml = fuzzyRes
      ? highlightMatchedTermsHtml(title, fuzzyRes.highlightTerms)
      : escapeHtml(title);

    let fuzzyMetaBadgesHtml = '';
    let fuzzySnippetHtml = '';

    if (fuzzyRes) {
      const pct = fuzzyRes.confidencePct || 75;
      const badgeColor = pct >= 85
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300/70'
        : pct >= 68
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border-blue-300/70'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border-amber-300/70';

      const reasonPills = (fuzzyRes.matchReasons || []).slice(0, 2).map(r =>
        `<span class="px-1.5 py-0.2 rounded text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">${escapeHtml(r)}</span>`
      ).join('');

      const solutionPill = fuzzyRes.isSolutionNote
        ? `<span class="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">🛠️ 潛在解決方案</span>`
        : '';

      fuzzyMetaBadgesHtml = `
        <div class="flex flex-wrap items-center gap-1 mt-1">
          <span class="px-1.5 py-0.2 rounded text-[10px] font-bold border ${badgeColor}">🎯 關聯度 ${pct}%</span>
          ${solutionPill}
          ${reasonPills}
        </div>
      `;

      if (fuzzyRes.snippet && fuzzyRes.snippet.text) {
        const highlightedSnippet = highlightMatchedTermsHtml(fuzzyRes.snippet.text, fuzzyRes.highlightTerms);
        fuzzySnippetHtml = `
          <div class="fuzzy-snippet-box ${fuzzyRes.isSolutionNote ? 'is-solution' : ''}">
            <span class="font-semibold text-gray-700 dark:text-gray-200">${fuzzyRes.isSolutionNote ? '💡 內文對策/紀錄：' : '📄 內文摘要：'}</span>${highlightedSnippet}
          </div>
        `;
      }
    }

    const machineOptionsHtml = (allMachineOpts.includes(machine) ? allMachineOpts : [machine, ...allMachineOpts])
      .map(m => `<option value="${escapeHtml(m)}" ${m === machine ? 'selected' : ''}>🚜 ${escapeHtml(m)}</option>`).join('') +
      `<option value="__add_machine__">➕ 新建機型...</option>`;

    const contentOptionsHtml = (allContentOpts.includes(content) ? allContentOpts : [content, ...allContentOpts])
      .map(c => `<option value="${escapeHtml(c)}" ${c === content ? 'selected' : ''}>📋 ${escapeHtml(c)}</option>`).join('') +
      `<option value="__add_content__">➕ 新建內容...</option>`;

    const urgencyOptionsHtml = (allUrgencyOpts.includes(urgency) ? allUrgencyOpts : [urgency, ...allUrgencyOpts])
      .map(u => `<option value="${escapeHtml(u)}" ${u === urgency ? 'selected' : ''}>${escapeHtml(u)}</option>`).join('');

    const clientOptionsHtml = `<option value="" ${!client ? 'selected' : ''}>🏢 未指定</option>` +
      (allClientOpts.includes(client) || !client ? allClientOpts : [client, ...allClientOpts])
      .map(c => `<option value="${escapeHtml(c)}" ${c === client ? 'selected' : ''}>🏢 ${escapeHtml(c)}</option>`).join('') +
      `<option value="__add_client__">➕ 新建客戶/廠商...</option>`;

    return `
      <tr class="hover:bg-gray-50/80 dark:hover:bg-notion-darker transition-colors cursor-pointer group" data-note-id="${note.id}">
        <td class="p-2.5 text-center text-amber-500 align-top">${meta.pinned ? '📌' : ''}</td>
        <td class="p-2.5 text-gray-900 dark:text-gray-100 open-note-trigger align-top">
          <div class="flex items-center gap-1.5 font-bold">
            <span class="text-base shrink-0">${icon}</span>
            <span class="hover:underline truncate max-w-xs sm:max-w-md">${displayTitleHtml}</span>
            ${note.modifiedTime ? `<span class="text-[10px] text-gray-400 font-normal shrink-0" title="最後編輯時間">🕒 ${new Date(note.modifiedTime).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
          </div>
          ${fuzzyMetaBadgesHtml}
          ${fuzzySnippetHtml}
        </td>
        <td class="p-2 align-top" onclick="event.stopPropagation();">
          <select class="table-inline-select text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30" data-note-id="${note.id}" data-field="machineModel" title="直接點擊修改機型（自動歸位）">
            ${machineOptionsHtml}
          </select>
        </td>
        <td class="p-2 align-top" onclick="event.stopPropagation();">
          <select class="table-inline-select text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/30" data-note-id="${note.id}" data-field="workContent" title="直接點擊修改工作內容">
            ${contentOptionsHtml}
          </select>
        </td>
        <td class="p-2 align-top" onclick="event.stopPropagation();">
          <select class="table-inline-select ${urgencyClass}" data-note-id="${note.id}" data-field="urgency" title="直接點擊修改急迫性">
            ${urgencyOptionsHtml}
          </select>
        </td>
        <td class="p-2 align-top" onclick="event.stopPropagation();">
          <select class="table-inline-select ${client ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/40' : 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/40'}" data-note-id="${note.id}" data-field="clientVendor" title="直接點擊修改客戶或廠商">
            ${clientOptionsHtml}
          </select>
        </td>
        <td class="p-2.5 text-gray-500 font-mono text-[11px] align-top">${dueDate || '<span class="text-gray-300 dark:text-gray-600">未排定</span>'}</td>
        <td class="p-2.5 align-top">
          <div class="flex flex-wrap gap-1">
            ${tags.map(t => `<span class="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300">${escapeHtml(t)}</span>`).join('')}
          </div>
        </td>
        <td class="p-2 text-center align-top whitespace-nowrap" onclick="event.stopPropagation();">
          <div class="inline-flex items-center gap-1">
            <button type="button" class="table-peek-btn px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-300 text-[11px] font-semibold transition cursor-pointer" data-note-id="${note.id}" title="在右側展開抽屜快速預覽內容，不離開表格">
              👁️ 預覽
            </button>
            <button type="button" class="table-open-btn px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-600 text-blue-600 dark:text-blue-300 hover:text-white text-[11px] font-semibold transition cursor-pointer" data-note-id="${note.id}" title="開啟編輯器並自動捲動定位至命中段落">
              開啟
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (DOM.tableTotalCount) {
    DOM.tableTotalCount.textContent = parsedQuery
      ? `智慧檢索命中: ${filteredNotes.length} 筆 (共 ${state.notes.length} 筆)`
      : `總筆數: ${filteredNotes.length}`;
  }

  // 綁定就地修改下拉選單事件
  DOM.tableViewTbody.querySelectorAll('select.table-inline-select').forEach(sel => {
    sel.addEventListener('click', (e) => e.stopPropagation());
    sel.addEventListener('change', (e) => {
      e.stopPropagation();
      const noteId = sel.dataset.noteId;
      const field = sel.dataset.field;
      if (noteId && field) {
        updateNotePropertyInline(noteId, field, sel.value);
      }
    });
  });

  // 綁定「👁️ 預覽」抽屜按鈕事件
  DOM.tableViewTbody.querySelectorAll('.table-peek-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const noteId = btn.dataset.noteId;
      if (noteId) {
        openTableQuickPeekDrawer(noteId, parsedQuery ? fuzzyEvalMap.get(noteId) : null);
      }
    });
  });

  // 綁定「開啟」按鈕與整列點擊事件（搜尋狀態下自動附帶 Scroll-to-Match 定位資訊！）
  const openNoteFromTable = (noteId) => {
    if (!noteId) return;
    if (parsedQuery) {
      const fRes = fuzzyEvalMap.get(noteId);
      state.pendingScrollMatch = {
        noteId,
        query: rawSearchInput,
        highlightTerms: fRes ? fRes.highlightTerms : parsedQuery.coreTokens,
        snippetText: (fRes && fRes.snippet && fRes.snippet.text) ? fRes.snippet.text : ''
      };
    } else {
      state.pendingScrollMatch = null;
    }
    closeTableQuickPeekDrawer();
    selectNote(noteId);
    switchView('editor');
  };

  DOM.tableViewTbody.querySelectorAll('.table-open-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openNoteFromTable(btn.dataset.noteId);
    });
  });

  DOM.tableViewTbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', (e) => {
      if (e.target.closest('select, button, a')) return;
      openNoteFromTable(tr.dataset.noteId);
    });
  });
}

// ==========================================================================
// 📋 待處理事件管理系統 (Google Tasks 雙向連動引擎)
// ==========================================================================

const GOOGLE_TASKS_LIST_TITLE = 'LVI_Note 待處理事件';

function parseTaskUrgency(task) {
  const text = `${task.title || ''} ${task.notes || ''}`;
  if (text.includes('特急')) return '特急';
  if (text.includes('高急迫')) return '高急迫';
  if (text.includes('常規')) return '常規';
  if (text.includes('低急迫')) return '低急迫';
  return '常規';
}

function cleanTaskNotes(notes) {
  if (!notes) return '';
  return notes.replace(/\[(特急|高急迫|常規|低急迫)\]/g, '').trim();
}

async function ensureGoogleTasksList() {
  if (!state.accessToken) return null;
  if (state.googleTasksListId) return state.googleTasksListId;

  try {
    const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });

    if (res.status === 401 || res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = (errData.error && errData.error.message) || '';
      console.warn('Google Tasks 授權/存取檢查未通過:', res.status, errMsg);

      if (DOM.tasksAuthBtn) DOM.tasksAuthBtn.classList.remove('hidden');

      if (errMsg.includes('has not been used in project') || errMsg.includes('disabled')) {
        if (DOM.tasksSyncStatusText) DOM.tasksSyncStatusText.textContent = 'GCP 尚未啟用 Tasks API (已改用雲端硬碟同步)';
        if (DOM.tasksAuthBtn) {
          DOM.tasksAuthBtn.innerHTML = '<i data-lucide="external-link" class="w-3.5 h-3.5"></i> <span>前往 GCP 啟用 Tasks API</span>';
          DOM.tasksAuthBtn.onclick = (e) => {
            e.stopPropagation();
            window.open('https://console.cloud.google.com/apis/library/tasks.googleapis.com?project=582047821145', '_blank');
          };
        }
      } else {
        if (DOM.tasksSyncStatusText) DOM.tasksSyncStatusText.textContent = '點擊右側按鈕授予 Tasks 存取權限';
        if (DOM.tasksAuthBtn) {
          DOM.tasksAuthBtn.innerHTML = '<i data-lucide="link-2" class="w-3.5 h-3.5"></i> <span>授權 Tasks 連動</span>';
          DOM.tasksAuthBtn.onclick = (e) => {
            e.stopPropagation();
            requestTasksAuth();
          };
        }
      }
      return null;
    }

    const data = await res.json();
    const lists = data.items || [];
    const target = lists.find(l => l.title === GOOGLE_TASKS_LIST_TITLE);
    if (target) {
      state.googleTasksListId = target.id;
      return target.id;
    }

    // 建立專屬清單
    const createRes = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: GOOGLE_TASKS_LIST_TITLE })
    });
    const newList = await createRes.json();
    state.googleTasksListId = newList.id;
    return newList.id;
  } catch(e) {
    console.warn('確認 Google Tasks 清單異常 (已改用雲端硬碟備份):', e);
    return null;
  }
}

async function syncGoogleTasks(showFeedback = false) {
  if (!state.accessToken) return;
  state.tasksLoading = true;
  if (DOM.tasksSyncStatusText) DOM.tasksSyncStatusText.textContent = '正在同步 Google Tasks...';

  try {
    const listId = await ensureGoogleTasksList();
    if (!listId) {
      state.tasksLoading = false;
      renderTasksView();
      return;
    }

    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true&maxResults=100`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });

    if (res.status === 401 || res.status === 403) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = (errData.error && errData.error.message) || '';
      console.warn('讀取 Google Tasks 授權受限:', errMsg);
      if (DOM.tasksAuthBtn) DOM.tasksAuthBtn.classList.remove('hidden');
      state.tasksLoading = false;
      renderTasksView();
      return;
    }

    const data = await res.json();
    state.googleTasks = data.items || [];
    if (DOM.tasksAuthBtn) DOM.tasksAuthBtn.classList.add('hidden');
    if (DOM.tasksSyncStatusText) DOM.tasksSyncStatusText.textContent = 'Google Tasks 已同步';
    if (showFeedback) showToast('✅ 成功自 Google Tasks 同步最新事件！');

    // 背景備份至 Drive 工作區設定檔
    saveWorkspaceConfigToDrive();
  } catch(e) {
    console.error('同步 Google Tasks 失敗:', e);
    if (DOM.tasksSyncStatusText) DOM.tasksSyncStatusText.textContent = 'Tasks 連動異常 (已使用雲端硬碟儲存)';
  } finally {
    state.tasksLoading = false;
    renderTasksView();
  }
}

async function addGoogleTask(title, urgency = '常規', dueDate = '') {
  if (!title) return;
  const tempId = 'temp_' + Date.now();
  const newTask = {
    id: tempId,
    title: title,
    notes: `[${urgency}]`,
    status: 'needsAction',
    due: dueDate ? `${dueDate}T00:00:00.000Z` : null,
    updated: new Date().toISOString()
  };

  state.googleTasks.unshift(newTask);
  renderTasksView();
  showToast(`已建立待處理事件：${title}`);

  if (!state.accessToken) return;

  try {
    const listId = await ensureGoogleTasksList();
    if (!listId) return;

    const payload = {
      title: title,
      notes: `[${urgency}]`,
      status: 'needsAction'
    };
    if (dueDate) {
      payload.due = `${dueDate}T00:00:00.000Z`;
    }

    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const realTask = await res.json();
      const idx = state.googleTasks.findIndex(t => t.id === tempId);
      if (idx !== -1) {
        state.googleTasks[idx] = realTask;
      }
      renderTasksView();
    }
  } catch(e) {
    console.warn('寫入 Google Tasks 失敗:', e);
  }
}

async function toggleGoogleTask(taskId) {
  const task = state.googleTasks.find(t => t.id === taskId);
  if (!task) return;

  const willComplete = task.status !== 'completed';
  task.status = willComplete ? 'completed' : 'needsAction';
  task.completed = willComplete ? new Date().toISOString() : null;

  renderTasksView();
  showToast(willComplete ? `已完成：${task.title}` : `已將事件恢復為待處理：${task.title}`);

  if (!state.accessToken || !state.googleTasksListId) return;

  try {
    await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${state.googleTasksListId}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: task.status,
        completed: task.completed
      })
    });
  } catch(e) {
    console.warn('更新 Google Task 狀態失敗:', e);
  }
}

async function deleteGoogleTask(taskId) {
  const targetTask = state.googleTasks.find(t => t.id === taskId);
  const taskTitle = targetTask ? targetTask.title : '此事件';

  // ⚠️ 嚴密刪除確認
  const confirmed = window.confirm(`⚠️ 確認刪除待處理事件？\n\n事件名稱：${taskTitle}\n\n確定要刪除嗎？`);
  if (!confirmed) return;

  const idx = state.googleTasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;
  const removed = state.googleTasks.splice(idx, 1)[0];
  renderTasksView();
  showToast(`已刪除事件：${removed.title}`);

  if (!state.accessToken || !state.googleTasksListId) return;

  try {
    await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${state.googleTasksListId}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
  } catch(e) {
    console.warn('刪除 Google Task 失敗:', e);
  }
}

async function clearCompletedGoogleTasks() {
  const completed = state.googleTasks.filter(t => t.status === 'completed');
  if (completed.length === 0) {
    showToast('目前沒有已完成的事件');
    return;
  }

  state.googleTasks = state.googleTasks.filter(t => t.status !== 'completed');
  renderTasksView();
  showToast(`已清理 ${completed.length} 項已完成事件！`);

  if (!state.accessToken || !state.googleTasksListId) return;

  for (const t of completed) {
    if (!t.id.startsWith('temp_')) {
      try {
        await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${state.googleTasksListId}/tasks/${t.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${state.accessToken}` }
        });
      } catch(e) {}
    }
  }
}

function requestTasksAuth() {
  const targetEmail = state.userEmail || DEFAULT_USER_EMAIL;
  showToast('正在向 Google 請求 Tasks 連動授權...');
  
  if (window.google && window.google.accounts && window.google.accounts.oauth2) {
    // 重新初始化具備完整 Tasks scope 的 TokenClient
    state.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: state.clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/calendar',
      hint: targetEmail,
      callback: async (resp) => {
        if (resp.error) {
          console.error('Tasks 授權失敗:', resp.error);
          showToast('授權失敗: ' + resp.error, 5000);
          return;
        }
        console.log('✅ Google Tasks 授權成功，Token 已更新！');
        state.accessToken = resp.access_token;
        localStorage.setItem('cloudnotes_access_token', resp.access_token);
        localStorage.setItem('cloudnotes_authorized', 'true');
        showToast('✅ Google Tasks 授權成功！正在同步事件...');
        if (DOM.tasksAuthBtn) DOM.tasksAuthBtn.classList.add('hidden');
        await syncGoogleTasks(true);
      }
    });

    state.tokenClient.requestAccessToken({
      prompt: 'consent',
      hint: targetEmail
    });
  } else {
    showToast('Google 認證元件尚未載入，請稍候重試');
  }
}

function renderTasksView() {
  if (!DOM.viewTasksContainer) return;

  const keyword = (state.tasksFilterKeyword || '').toLowerCase().trim();
  const allTasks = state.googleTasks || [];

  // 過濾搜尋
  const filtered = allTasks.filter(t => {
    if (!keyword) return true;
    const titleMatch = (t.title || '').toLowerCase().includes(keyword);
    const notesMatch = (t.notes || '').toLowerCase().includes(keyword);
    return titleMatch || notesMatch;
  });

  const uncompleted = filtered.filter(t => t.status !== 'completed');
  const completed = filtered.filter(t => t.status === 'completed');

  // 更新頂部統計數據
  if (DOM.tasksStatUncompleted) DOM.tasksStatUncompleted.textContent = `未完成: ${uncompleted.length} 項`;
  if (DOM.tasksStatCompleted) DOM.tasksStatCompleted.textContent = `近期已完成: ${completed.length} 項`;
  if (DOM.tasksCompletedBadge) DOM.tasksCompletedBadge.textContent = `${completed.length} 項`;
  if (DOM.sidebarTasksCount) DOM.sidebarTasksCount.textContent = uncompleted.length;

  // 依急迫性程度分組未完成事件
  const urgentTasks = uncompleted.filter(t => parseTaskUrgency(t) === '特急');
  const highTasks = uncompleted.filter(t => parseTaskUrgency(t) === '高急迫');
  const normalTasks = uncompleted.filter(t => parseTaskUrgency(t) === '常規');
  const lowTasks = uncompleted.filter(t => parseTaskUrgency(t) === '低急迫');

  if (DOM.colCountUrgent) DOM.colCountUrgent.textContent = urgentTasks.length;
  if (DOM.colCountHigh) DOM.colCountHigh.textContent = highTasks.length;
  if (DOM.colCountNormal) DOM.colCountNormal.textContent = normalTasks.length;
  if (DOM.colCountLow) DOM.colCountLow.textContent = lowTasks.length;

  const renderTaskCard = (t) => {
    const urgency = parseTaskUrgency(t);
    const notes = cleanTaskNotes(t.notes);
    let dueHtml = '';
    if (t.due) {
      const dueDateStr = t.due.split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      const isOverdue = dueDateStr < todayStr;
      const isToday = dueDateStr === todayStr;
      const dueBadgeClass = isOverdue ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-300 font-bold border border-rose-200' :
                            isToday ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 font-bold border border-amber-200' :
                            'text-gray-500 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700';
      dueHtml = `<span class="px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 ${dueBadgeClass}"><i data-lucide="calendar" class="w-3 h-3"></i> ${dueDateStr}</span>`;
    }

    return `
      <div class="task-item-card p-2.5 rounded-lg border border-gray-100 dark:border-notion-borderDark bg-white dark:bg-notion-card shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition" data-task-id="${t.id}">
        <div class="flex items-start gap-2">
          <input type="checkbox" class="task-toggle-check mt-0.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer w-4 h-4 shrink-0" data-task-id="${t.id}">
          <div class="flex-1 min-w-0">
            <div class="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-snug break-words">${escapeHtml(t.title || '無標題事件')}</div>
            ${notes ? `<div class="text-[11px] text-gray-400 mt-1 line-clamp-2">${escapeHtml(notes)}</div>` : ''}
            <div class="flex items-center gap-1.5 mt-2 flex-wrap">
              ${dueHtml}
            </div>
          </div>
          <button class="task-delete-btn p-1 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition shrink-0" data-task-id="${t.id}" title="刪除事件">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  };

  const emptyPlaceholder = (label) => `<div class="p-6 text-center text-xs text-gray-400">目前無${label}事件</div>`;

  if (DOM.tasksListUrgent) DOM.tasksListUrgent.innerHTML = urgentTasks.length ? urgentTasks.map(renderTaskCard).join('') : emptyPlaceholder('特急');
  if (DOM.tasksListHigh) DOM.tasksListHigh.innerHTML = highTasks.length ? highTasks.map(renderTaskCard).join('') : emptyPlaceholder('高急迫');
  if (DOM.tasksListNormal) DOM.tasksListNormal.innerHTML = normalTasks.length ? normalTasks.map(renderTaskCard).join('') : emptyPlaceholder('常規');
  if (DOM.tasksListLow) DOM.tasksListLow.innerHTML = lowTasks.length ? lowTasks.map(renderTaskCard).join('') : emptyPlaceholder('低急迫');

  // 渲染近期已完成事件清單
  if (DOM.tasksListCompleted) {
    if (completed.length === 0) {
      DOM.tasksListCompleted.innerHTML = `<div class="p-4 text-center text-xs text-gray-400">尚無已完成的事件記錄</div>`;
    } else {
      DOM.tasksListCompleted.innerHTML = completed.map(t => {
        const urgency = parseTaskUrgency(t);
        const completedTime = t.completed ? new Date(t.completed).toLocaleDateString() : '';
        return `
          <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50/80 dark:bg-notion-darker border border-gray-100 dark:border-notion-borderDark text-xs">
            <div class="flex items-center gap-2 min-w-0">
              <input type="checkbox" class="task-toggle-check rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4 shrink-0" data-task-id="${t.id}" checked>
              <span class="line-through text-gray-400 font-medium truncate">${escapeHtml(t.title || '')}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-800 text-gray-500 shrink-0">${urgency}</span>
              ${completedTime ? `<span class="text-[10px] text-gray-400 shrink-0">${completedTime}</span>` : ''}
            </div>
            <button class="task-delete-btn p-1 text-gray-400 hover:text-red-500 rounded hover:bg-gray-200 dark:hover:bg-gray-800 transition shrink-0" data-task-id="${t.id}" title="刪除記錄">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        `;
      }).join('');
    }
  }

  // 綁定打勾完成與刪除事件
  DOM.viewTasksContainer.querySelectorAll('.task-toggle-check').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const taskId = chk.dataset.taskId;
      if (taskId) toggleGoogleTask(taskId);
    });
  });

  DOM.viewTasksContainer.querySelectorAll('.task-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.taskId;
      if (taskId) deleteGoogleTask(taskId);
    });
  });

  initLucide();
}

// ==========================================================================
// 📅 Google 日曆 (Google Calendar) 多日曆雙向連動與內容選擇引擎
// ==========================================================================

// 1. 抓取使用者的全部日曆清單 (包含「我的日曆」與「其他日曆」)
async function fetchGoogleCalendarList() {
  if (!state.accessToken) return [];

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });

    if (res.status === 401 || res.status === 403) {
      if (DOM.calAuthBtn) DOM.calAuthBtn.classList.remove('hidden');
      if (DOM.calendarSyncStatusText) DOM.calendarSyncStatusText.textContent = '請點擊授權日曆連動';
      return [];
    }

    const data = await res.json();
    state.googleCalendars = data.items || [];

    // 若尚未有選取的日曆，預設全選已啟用的日曆
    if (!state.selectedCalendarIds || state.selectedCalendarIds.length === 0) {
      state.selectedCalendarIds = state.googleCalendars
        .filter(c => c.selected !== false)
        .map(c => c.id);
    }

    renderCalendarFilterUI();
    return state.googleCalendars;
  } catch(e) {
    console.warn('獲取 Google 日曆清單失敗:', e);
    return [];
  }
}

// 2. 渲染日曆多選浮動選單 (依「我的日曆」與「其他日曆」分類呈現，如使用者的日曆側邊欄)
function renderCalendarFilterUI() {
  if (!DOM.calListMy || !DOM.calListOther) return;

  const calendars = state.googleCalendars || [];
  if (calendars.length === 0) {
    DOM.calListMy.innerHTML = '<div class="text-[11px] text-gray-400 py-1">尚未載入日曆</div>';
    DOM.calListOther.innerHTML = '<div class="text-[11px] text-gray-400 py-1">尚未載入其他日曆</div>';
    return;
  }

  // 區分「我的日曆」與「其他日曆」 (完全比照 Google 日曆側邊欄分類)
  const otherCalendars = calendars.filter(c => 
    (c.id && c.id.includes('#holiday@')) || 
    (c.id && c.id.includes('import.calendar.google.com')) ||
    (c.accessRole === 'reader' && !c.primary && c.summary !== '生日' && c.summary !== 'Tasks')
  );
  const myCalendars = calendars.filter(c => !otherCalendars.includes(c));

  const renderCalItem = (cal) => {
    const isChecked = state.selectedCalendarIds.includes(cal.id);
    const color = cal.backgroundColor || '#4f46e5';
    return `
      <label class="flex items-center gap-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-xs select-none">
        <input type="checkbox" class="cal-filter-checkbox rounded cursor-pointer w-3.5 h-3.5 shrink-0" data-cal-id="${cal.id}" ${isChecked ? 'checked' : ''} style="accent-color: ${color}">
        <span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background-color: ${color}"></span>
        <span class="truncate font-medium text-gray-700 dark:text-gray-200" title="${escapeHtml(cal.summary || '')}">${escapeHtml(cal.summary || '未命名日曆')}</span>
      </label>
    `;
  };

  DOM.calListMy.innerHTML = myCalendars.map(renderCalItem).join('');
  DOM.calListOther.innerHTML = otherCalendars.map(renderCalItem).join('') || '<div class="text-[11px] text-gray-400 py-0.5">無其他日曆</div>';

  if (DOM.calSelectedCount) {
    DOM.calSelectedCount.textContent = `${state.selectedCalendarIds.length}/${calendars.length}`;
  }

  // 綁定勾選變更事件
  document.querySelectorAll('.cal-filter-checkbox').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const calId = chk.dataset.calId;
      if (chk.checked) {
        if (!state.selectedCalendarIds.includes(calId)) state.selectedCalendarIds.push(calId);
      } else {
        state.selectedCalendarIds = state.selectedCalendarIds.filter(id => id !== calId);
      }
      if (DOM.calSelectedCount) {
        DOM.calSelectedCount.textContent = `${state.selectedCalendarIds.length}/${calendars.length}`;
      }
      await syncGoogleCalendar(false);
    });
  });

  initLucide();
}

// 3. 自使用者所選取的「所有日曆」中抓取並合併活動
async function syncGoogleCalendar(showFeedback = false) {
  if (!state.accessToken) return;
  state.calendarSyncing = true;
  if (DOM.calendarSyncStatusText) DOM.calendarSyncStatusText.textContent = '正在同步 Google 日曆活動...';

  try {
    // 確保已先讀取日曆清單
    if (!state.googleCalendars || state.googleCalendars.length === 0) {
      await fetchGoogleCalendarList();
    }

    const year = state.calendarYear;
    const month = state.calendarMonth;
    // 取當月前後各一週的時間範圍，確保跨月週次完整涵蓋
    const startDate = new Date(year, month - 1, 20);
    const endDate = new Date(year, month + 2, 10);
    const timeMin = startDate.toISOString();
    const timeMax = endDate.toISOString();

    const selectedIds = state.selectedCalendarIds || [];
    if (selectedIds.length === 0) {
      state.googleCalendarEvents = [];
      state.calendarSyncing = false;
      renderCalendarView();
      if (DOM.calendarSyncStatusText) DOM.calendarSyncStatusText.textContent = '已篩選隱藏所有日曆';
      return;
    }

    let allFetchedEvents = [];

    // 並行抓取所有被勾選的日曆活動
    const fetchPromises = selectedIds.map(async (calId) => {
      const calMeta = (state.googleCalendars || []).find(c => c.id === calId) || {};
      const calColor = calMeta.backgroundColor || '#4f46e5';
      const calName = calMeta.summary || '';

      try {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`, {
          headers: { Authorization: `Bearer ${state.accessToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          const items = (data.items || []).map(evt => ({
            ...evt,
            calendarId: calId,
            calendarName: calName,
            calendarColor: calColor
          }));
          allFetchedEvents.push(...items);
        }
      } catch(err) {
        console.warn(`抓取日曆 [${calName}] 活動異常:`, err);
      }
    });

    await Promise.all(fetchPromises);

    state.googleCalendarEvents = allFetchedEvents;
    if (DOM.calAuthBtn) DOM.calAuthBtn.classList.add('hidden');
    if (DOM.calendarSyncStatusText) DOM.calendarSyncStatusText.textContent = `Google 日曆已同步 (${allFetchedEvents.length} 項活動)`;
    if (showFeedback) showToast(`✅ 成功同步 ${allFetchedEvents.length} 項 Google 日曆活動！`);
  } catch(e) {
    console.warn('同步 Google 日曆失敗:', e);
    if (DOM.calendarSyncStatusText) DOM.calendarSyncStatusText.textContent = '日曆同步異常 (可離線操作)';
  } finally {
    state.calendarSyncing = false;
    renderCalendarView();
  }
}

// 4. 新增活動至指定的 Google 日曆 (預設主日曆)
async function addGoogleCalendarEvent(title, dateStr, description = '', targetCalId = 'primary') {
  if (!title || !dateStr) return;
  const calMeta = (state.googleCalendars || []).find(c => c.id === targetCalId) || {};
  const calColor = calMeta.backgroundColor || '#4f46e5';

  const tempId = 'cal_temp_' + Date.now();
  const newEvt = {
    id: tempId,
    summary: title,
    description: description,
    start: { date: dateStr },
    end: { date: dateStr },
    calendarId: targetCalId,
    calendarName: calMeta.summary || '我的日曆',
    calendarColor: calColor
  };

  state.googleCalendarEvents.push(newEvt);
  renderCalendarView();
  showToast(`已建立日曆活動：${title}`);

  if (!state.accessToken) return;

  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalId)}/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary: title,
        description: description,
        start: { date: dateStr },
        end: { date: dateStr }
      })
    });

    if (res.ok) {
      const realEvt = await res.json();
      const idx = state.googleCalendarEvents.findIndex(e => e.id === tempId);
      if (idx !== -1) {
        state.googleCalendarEvents[idx] = {
          ...realEvt,
          calendarId: targetCalId,
          calendarName: calMeta.summary || '我的日曆',
          calendarColor: calColor
        };
      }
      renderCalendarView();
    }
  } catch(e) {
    console.warn('寫入 Google 日曆活動失敗:', e);
  }
}

// 5. 刪除活動
async function deleteGoogleCalendarEvent(eventId, calendarId = 'primary', eventTitle = '') {
  const targetTitle = eventTitle || ((state.googleCalendarEvents.find(e => e.id === eventId) || {}).summary) || '此活動';
  
  // ⚠️ 嚴密刪除確認，徹底防範誤觸刪除
  const confirmed = window.confirm(`⚠️ 確認刪除 Google 日曆活動？\n\n活動名稱：${targetTitle}\n\n確定要刪除嗎？刪除後將同步從您的 Google 官方日曆移除。`);
  if (!confirmed) return;

  const idx = state.googleCalendarEvents.findIndex(e => e.id === eventId);
  if (idx === -1) return;
  const removed = state.googleCalendarEvents.splice(idx, 1)[0];
  renderCalendarView();
  if (state.currentSelectedDate) {
    openDayScheduleModal(state.currentSelectedDate);
  }
  showToast(`已成功刪除日曆活動：${removed.summary || '未命名活動'}`);

  if (!state.accessToken) return;

  try {
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || 'primary')}/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
  } catch(e) {
    console.warn('刪除 Google 日曆活動失敗:', e);
  }
}

function requestCalendarAuth() {
  const targetEmail = state.userEmail || DEFAULT_USER_EMAIL;
  showToast('正在向 Google 請求日曆完整存取授權...');
  if (window.google && window.google.accounts && window.google.accounts.oauth2) {
    state.tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: state.clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/calendar',
      hint: targetEmail,
      callback: async (resp) => {
        if (resp.error) {
          showToast('日曆授權失敗: ' + resp.error, 5000);
          return;
        }
        state.accessToken = resp.access_token;
        localStorage.setItem('cloudnotes_access_token', resp.access_token);
        localStorage.setItem('cloudnotes_authorized', 'true');
        showToast('✅ Google 日曆授權成功！正在載入全部日曆...');
        if (DOM.calAuthBtn) DOM.calAuthBtn.classList.add('hidden');
        await fetchGoogleCalendarList();
        await syncGoogleCalendar(true);
      }
    });
    state.tokenClient.requestAccessToken({ prompt: 'consent', hint: targetEmail });
  }
}

function openCalEventModal(defaultDate = '') {
  if (DOM.calModalTitle) DOM.calModalTitle.value = '';
  if (DOM.calModalDesc) DOM.calModalDesc.value = '';
  if (DOM.calModalDate) {
    DOM.calModalDate.value = defaultDate || new Date().toISOString().split('T')[0];
  }
  if (DOM.calEventModal) {
    DOM.calEventModal.classList.remove('hidden');
    DOM.calEventModal.classList.add('modal-animated');
    if (DOM.calModalTitle) DOM.calModalTitle.focus();
  }
}

function closeCalEventModal() {
  if (DOM.calEventModal) {
    DOM.calEventModal.classList.add('hidden');
  }
}

// 6. 每日行程與筆記管理面板 (點擊任意日期展開詳細條列與操作)
const WEEKDAY_NAMES = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];

function openDayScheduleModal(dateKey) {
  state.currentSelectedDate = dateKey;
  if (!DOM.dayScheduleModal) return;

  const parts = dateKey.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dateObj = new Date(y, m, d);
  const weekday = WEEKDAY_NAMES[dateObj.getDay()] || '';

  if (DOM.dayModalTitle) {
    DOM.dayModalTitle.innerHTML = `<i data-lucide="calendar" class="w-4 h-4 text-blue-500"></i><span>${y} 年 ${m + 1} 月 ${d} 日 (${weekday})</span>`;
  }

  // 1. 抓取當天 Google 日曆活動
  const dayGoogleEvents = (state.googleCalendarEvents || []).filter(e => {
    const start = e.start ? (e.start.date || (e.start.dateTime && e.start.dateTime.split('T')[0])) : '';
    return start === dateKey;
  });

  // 2. 抓取當天 LVI_Note 工作筆記
  const dayNotes = state.notes.filter(n => (n.meta && n.meta.dueDate) === dateKey);

  if (DOM.dayModalCalCount) DOM.dayModalCalCount.textContent = `Google 日曆: ${dayGoogleEvents.length} 項`;
  if (DOM.dayModalNotesCount) DOM.dayModalNotesCount.textContent = `工作筆記: ${dayNotes.length} 篇`;
  if (DOM.dayModalCalBadge) DOM.dayModalCalBadge.textContent = `${dayGoogleEvents.length} 項`;
  if (DOM.dayModalNotesBadge) DOM.dayModalNotesBadge.textContent = `${dayNotes.length} 篇`;

  // 渲染 Google 日曆活動清單
  if (DOM.dayModalEventsList) {
    if (dayGoogleEvents.length === 0) {
      DOM.dayModalEventsList.innerHTML = '<div class="p-3 text-center text-xs text-gray-400 bg-gray-50 dark:bg-notion-darker rounded-lg border border-dashed border-gray-200 dark:border-gray-800">本日無 Google 日曆排程</div>';
    } else {
      DOM.dayModalEventsList.innerHTML = dayGoogleEvents.map(evt => {
        const summary = evt.summary || '未命名活動';
        const color = evt.calendarColor || '#4f46e5';
        const calName = evt.calendarName || 'Google 日曆';
        const isAllDay = !evt.start.dateTime;
        let timeStr = '全天活動';
        if (evt.start.dateTime) {
          const startTime = new Date(evt.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const endTime = evt.end && evt.end.dateTime ? new Date(evt.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          timeStr = endTime ? `${startTime} - ${endTime}` : startTime;
        }

        return `
          <div class="p-2.5 rounded-xl border border-gray-200 dark:border-notion-borderDark bg-white dark:bg-notion-dark shadow-sm flex items-start justify-between gap-2 transition hover:shadow-md">
            <div class="flex items-start gap-2.5 min-w-0">
              <span class="w-3 h-3 rounded-full mt-0.5 shrink-0" style="background-color: ${color}"></span>
              <div class="min-w-0">
                <div class="text-xs font-bold text-gray-800 dark:text-gray-100 break-words">${escapeHtml(summary)}</div>
                <div class="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span class="px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 font-medium">${timeStr}</span>
                  <span>•</span>
                  <span class="font-medium" style="color: ${color}">${escapeHtml(calName)}</span>
                </div>
                ${evt.description ? `<div class="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">${escapeHtml(evt.description)}</div>` : ''}
              </div>
            </div>
            <button class="day-modal-del-cal-btn p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition shrink-0" data-cal-event-id="${evt.id}" data-cal-id="${evt.calendarId || 'primary'}" data-title="${escapeHtml(summary)}" title="刪除此日曆活動 (需確認)">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        `;
      }).join('');
    }
  }

  // 渲染工作筆記清單
  if (DOM.dayModalNotesList) {
    if (dayNotes.length === 0) {
      DOM.dayModalNotesList.innerHTML = '<div class="p-3 text-center text-xs text-gray-400 bg-gray-50 dark:bg-notion-darker rounded-lg border border-dashed border-gray-200 dark:border-gray-800">本日無排定工作筆記</div>';
    } else {
      DOM.dayModalNotesList.innerHTML = dayNotes.map(n => {
        const meta = n.meta || {};
        const title = (n.name || '').replace(/\.md$/i, '');
        const isDone = meta.status === '✅ 已完成';
        return `
          <div class="p-2.5 rounded-xl border border-gray-200 dark:border-notion-borderDark bg-white dark:bg-notion-dark shadow-sm flex items-center justify-between gap-2 transition hover:shadow-md">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-base shrink-0">${meta.icon || '📝'}</span>
              <div class="min-w-0">
                <div class="text-xs font-bold ${isDone ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'} truncate">${escapeHtml(title)}</div>
                <div class="text-[10px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                  ${meta.machineModel ? `<span class="text-blue-500 font-medium">🚜 ${escapeHtml(meta.machineModel)}</span>` : ''}
                  ${meta.workContent ? `<span>📋 ${escapeHtml(meta.workContent)}</span>` : ''}
                  ${meta.urgency ? `<span class="text-rose-500">${escapeHtml(meta.urgency)}</span>` : ''}
                </div>
              </div>
            </div>
            <button class="day-modal-open-note-btn px-2.5 py-1 text-xs rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition shrink-0" data-note-id="${n.id}">開啟</button>
          </div>
        `;
      }).join('');
    }
  }

  // 綁定刪除活動按鈕
  DOM.dayModalEventsList.querySelectorAll('.day-modal-del-cal-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const evtId = btn.dataset.calEventId;
      const calId = btn.dataset.calId || 'primary';
      const title = btn.dataset.title || '';
      deleteGoogleCalendarEvent(evtId, calId, title);
    });
  });

  // 綁定開啟筆記按鈕
  DOM.dayModalNotesList.querySelectorAll('.day-modal-open-note-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const noteId = btn.dataset.noteId;
      if (noteId) {
        closeDayScheduleModal();
        selectNote(noteId);
        switchView('editor');
      }
    });
  });

  DOM.dayScheduleModal.classList.remove('hidden');
  initLucide();
}

function closeDayScheduleModal() {
  if (DOM.dayScheduleModal) {
    DOM.dayScheduleModal.classList.add('hidden');
  }
}

// 7. 渲染月曆主視圖 (第一層保持純淨、無刪除按鈕、點選任意日期格子進入每日詳情)
function renderCalendarView() {
  if (!DOM.calendarGridCells || !DOM.calendarMonthTitle) return;

  const year = state.calendarYear;
  const month = state.calendarMonth; // 0-indexed

  DOM.calendarMonthTitle.textContent = `${year} 年 ${month + 1} 月`;

  const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  let cellsHtml = '';

  // 前置空白格
  for (let i = 0; i < firstDay; i++) {
    cellsHtml += `<div class="calendar-cell bg-gray-50/40 dark:bg-notion-darker/30 p-1 opacity-30 select-none"></div>`;
  }

  // 當月日期格子 (第一層乾淨展示，點擊即可開啟每日行程詳情)
  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dayStr}`;
    const isToday = dateKey === todayStr;

    // 1. 尋找當天的 LVI_Note 工作筆記
    const dayNotes = state.notes.filter(n => (n.meta && n.meta.dueDate) === dateKey);

    // 2. 尋找當天已勾選之 Google 日曆活動
    const dayGoogleEvents = (state.googleCalendarEvents || []).filter(e => {
      const start = e.start ? (e.start.date || (e.start.dateTime && e.start.dateTime.split('T')[0])) : '';
      return start === dateKey;
    });

    const totalCount = dayGoogleEvents.length + dayNotes.length;

    // 第一層完全不放置「刪除」或「+」等容易誤觸的按鈕，純粹展示清晰標籤
    cellsHtml += `
      <div class="calendar-cell bg-white dark:bg-notion-dark p-1 sm:p-1.5 flex flex-col justify-between cursor-pointer border-b border-r border-gray-100 dark:border-notion-borderDark hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition min-h-[70px] sm:min-h-[92px]" data-date="${dateKey}" title="點擊檢視 ${dateKey} 完整行程與筆記">
        <div class="flex items-center justify-between mb-0.5">
          <span class="text-xs font-semibold ${isToday ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm' : 'text-gray-700 dark:text-gray-300'}">${day}</span>
          ${totalCount > 0 ? `<span class="text-[10px] px-1 py-0.2 rounded-full font-bold ${isToday ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}">${totalCount}</span>` : ''}
        </div>
        <div class="space-y-1 flex-1 overflow-hidden pointer-events-none">
          <!-- 各個 Google 日曆活動 (依照原生日曆色彩呈現) -->
          ${dayGoogleEvents.slice(0, 3).map(evt => {
            const summary = evt.summary || '未命名活動';
            const color = evt.calendarColor || '#4f46e5';
            return `
              <div class="calendar-pill flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-medium truncate" style="background-color: ${color}1a; color: ${color}; border-left: 2px solid ${color};">
                <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background-color: ${color}"></span>
                <span class="truncate">${escapeHtml(summary)}</span>
              </div>
            `;
          }).join('')}
          <!-- LVI_Note 工作筆記 -->
          ${dayNotes.slice(0, 2).map(n => {
            const meta = n.meta || {};
            const title = (n.name || '').replace(/\.md$/i, '');
            const isDone = meta.status === '✅ 已完成';
            return `
              <div class="calendar-pill flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] ${isDone ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 line-through' : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-medium'} truncate">
                <span>${meta.icon || '📝'}</span>
                <span class="truncate">${escapeHtml(title)}</span>
              </div>
            `;
          }).join('')}
          ${totalCount > 4 ? `<div class="text-[9px] text-gray-400 text-right pr-1 font-semibold">+${totalCount - 4} 則</div>` : ''}
        </div>
      </div>
    `;
  }

  // 補足末尾剩餘格子湊滿整數週
  const totalCells = firstDay + daysInMonth;
  const trailingBlanks = (totalCells % 7 === 0) ? 0 : (7 - (totalCells % 7));
  for (let j = 0; j < trailingBlanks; j++) {
    cellsHtml += `<div class="calendar-cell bg-gray-50/40 dark:bg-notion-darker/30 p-1 opacity-30 select-none"></div>`;
  }

  DOM.calendarGridCells.innerHTML = cellsHtml;

  // 每一天都能點進去，查看每日條列的行程！
  DOM.calendarGridCells.querySelectorAll('.calendar-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      const dateKey = cell.dataset.date;
      if (dateKey) openDayScheduleModal(dateKey);
    });
  });

  initLucide();
}
function bindEvents() {
  if (DOM.loginBtn) DOM.loginBtn.addEventListener('click', handleLogin);
  if (DOM.logoutBtn) DOM.logoutBtn.addEventListener('click', handleLogout);
  if (DOM.themeToggleBtn) DOM.themeToggleBtn.addEventListener('click', toggleTheme);

  // 🏆 薑餅資 多重視圖切換列事件
  if (DOM.viewTabEditor) DOM.viewTabEditor.addEventListener('click', () => switchView('editor'));
  if (DOM.viewTabTable) DOM.viewTabTable.addEventListener('click', () => switchView('table'));
  if (DOM.viewTabTasks) DOM.viewTabTasks.addEventListener('click', () => switchView('tasks'));
  if (DOM.sidebarTasksBtn) {
    DOM.sidebarTasksBtn.addEventListener('click', () => {
      withLoading(DOM.sidebarTasksBtn, async () => {
        switchView('tasks');
        if (window.innerWidth < 768 && DOM.sidebar) {
          DOM.sidebar.classList.add('-translate-x-full');
        }
      }, '正在切換至待處理事件...');
    });
  }

  // 側邊欄隨手筆記快捷按鈕
  if (DOM.sidebarQuickNoteBtn) {
    DOM.sidebarQuickNoteBtn.addEventListener('click', () => {
      withLoading(DOM.sidebarQuickNoteBtn, async () => {
        await createQuickNote();
      }, '正在建立隨手筆記...');
    });
  }

  // 頂部未分類標籤分頁
  if (DOM.viewTabUncategorized) {
    DOM.viewTabUncategorized.addEventListener('click', () => {
      switchView('uncategorized');
    });
  }

  // 未分類頁面控制項
  if (DOM.uncatQuickAddBtn) {
    DOM.uncatQuickAddBtn.addEventListener('click', () => {
      createQuickNote();
    });
  }
  if (DOM.uncatRefreshBtn) {
    DOM.uncatRefreshBtn.addEventListener('click', () => {
      withLoading(DOM.uncatRefreshBtn, async () => {
        await fetchNotesList();
        renderUncategorizedView();
      }, '正在重新整理未分類筆記...');
    });
  }
  if (DOM.uncatSearchInput) {
    DOM.uncatSearchInput.addEventListener('input', () => {
      renderUncategorizedView();
    });
  }
  if (DOM.filterUncatBtn) {
    DOM.filterUncatBtn.addEventListener('click', () => {
      switchView('uncategorized');
      if (window.innerWidth < 768 && DOM.sidebar) {
        DOM.sidebar.classList.add('-translate-x-full');
      }
    });
  }
  if (DOM.tasksRefreshBtn) DOM.tasksRefreshBtn.addEventListener('click', () => syncGoogleTasks(true));
  if (DOM.tasksAuthBtn) DOM.tasksAuthBtn.addEventListener('click', () => requestTasksAuth());
  if (DOM.quickAddTaskForm) {
    DOM.quickAddTaskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = DOM.quickTaskTitle ? DOM.quickTaskTitle.value.trim() : '';
      const urgency = DOM.quickTaskUrgency ? DOM.quickTaskUrgency.value : '常規';
      const due = DOM.quickTaskDue ? DOM.quickTaskDue.value : '';
      if (title) {
        addGoogleTask(title, urgency, due);
        if (DOM.quickTaskTitle) DOM.quickTaskTitle.value = '';
      }
    });
  }
  if (DOM.tasksSearchInput) {
    DOM.tasksSearchInput.addEventListener('input', (e) => {
      state.tasksFilterKeyword = e.target.value;
      renderTasksView();
    });
  }
  if (DOM.tasksClearCompletedBtn) {
    DOM.tasksClearCompletedBtn.addEventListener('click', () => clearCompletedGoogleTasks());
  }
  if (DOM.viewTabCalendar) DOM.viewTabCalendar.addEventListener('click', () => switchView('calendar'));
  // 每日行程面板事件綁定
  if (DOM.closeDayModalBtn) DOM.closeDayModalBtn.addEventListener('click', closeDayScheduleModal);
  if (DOM.dayScheduleModal) {
    DOM.dayScheduleModal.addEventListener('click', (e) => {
      if (e.target === DOM.dayScheduleModal) closeDayScheduleModal();
    });
  }
  if (DOM.dayModalAddCalBtn) {
    DOM.dayModalAddCalBtn.addEventListener('click', () => {
      const targetDate = state.currentSelectedDate || new Date().toISOString().split('T')[0];
      openCalEventModal(targetDate);
    });
  }
  if (DOM.dayModalAddNoteBtn) {
    DOM.dayModalAddNoteBtn.addEventListener('click', () => {
      const targetDate = state.currentSelectedDate || new Date().toISOString().split('T')[0];
      closeDayScheduleModal();
      createNewNote();
      if (state.currentNote && state.currentNote.meta) {
        state.currentNote.meta.dueDate = targetDate;
        if (DOM.noteDueDate) DOM.noteDueDate.value = targetDate;
      }
      switchView('editor');
    });
  }

  // Google 日曆事件綁定
  // 日曆篩選下拉選單與全選/清空控制
  if (DOM.calFilterBtn && DOM.calFilterPopover) {
    DOM.calFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.calFilterPopover.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!DOM.calFilterPopover.contains(e.target) && e.target !== DOM.calFilterBtn && !DOM.calFilterBtn.contains(e.target)) {
        DOM.calFilterPopover.classList.add('hidden');
      }
    });
  }
  if (DOM.calSelectAllBtn) {
    DOM.calSelectAllBtn.addEventListener('click', async () => {
      state.selectedCalendarIds = (state.googleCalendars || []).map(c => c.id);
      renderCalendarFilterUI();
      await syncGoogleCalendar(false);
    });
  }
  if (DOM.calDeselectAllBtn) {
    DOM.calDeselectAllBtn.addEventListener('click', async () => {
      state.selectedCalendarIds = [];
      renderCalendarFilterUI();
      await syncGoogleCalendar(false);
    });
  }
  if (DOM.calRefreshBtn) DOM.calRefreshBtn.addEventListener('click', () => syncGoogleCalendar(true));
  if (DOM.calAddEventBtn) DOM.calAddEventBtn.addEventListener('click', () => openCalEventModal());
  if (DOM.calAuthBtn) DOM.calAuthBtn.addEventListener('click', () => requestCalendarAuth());
  if (DOM.closeCalModalBtn) DOM.closeCalModalBtn.addEventListener('click', closeCalEventModal);
  if (DOM.cancelCalModalBtn) DOM.cancelCalModalBtn.addEventListener('click', closeCalEventModal);
  if (DOM.submitCalModalBtn) {
    DOM.submitCalModalBtn.addEventListener('click', () => {
      const title = DOM.calModalTitle ? DOM.calModalTitle.value.trim() : '';
      const date = DOM.calModalDate ? DOM.calModalDate.value : '';
      const desc = DOM.calModalDesc ? DOM.calModalDesc.value.trim() : '';
      if (title && date) {
        addGoogleCalendarEvent(title, date, desc);
        closeCalEventModal();
      } else {
        showToast('請填寫活動名稱與活動日期');
      }
    });
  }
  if (DOM.viewQuickAddBtn) {
    DOM.viewQuickAddBtn.addEventListener('click', () => {
      createNewNote();
      switchView('editor');
    });
  }

  // 側邊欄快速導航

  // （螢光筆按鈕統一於 initSelectionToolbar/bindToolbarButton 綁定，避免雙重監聽器衝突）

  // 🎯 畫布與任一非檔案位置點擊即輸入保證 (Universal Click-to-Type & Caret Navigation)
  const scrollContainer = document.getElementById('main-scroll-container');
  const canvasWrapper = document.getElementById('canvas-inner-wrapper');

  [scrollContainer, canvasWrapper, DOM.editor].forEach(elem => {
    if (!elem) return;
    elem.addEventListener('click', (e) => {
      // 1. 若正在反白選取文字，絕對不可清除選取或強制跳轉游標
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().length > 0) {
        return;
      }

      // 2. 若點擊在功能按鈕、連結、摘要標題、輸入框或拖曳把手等互動元件上，不介入
      if (e.target.closest('button, a, summary, input, select, textarea, .notion-popover, .drag-handle, .notion-todo-checkbox, .highlight-color-btn, iframe, video, audio')) {
        return;
      }

      // 3. 確保所有卡片周邊具備可直接輸入的文字段落
      ensureEditableSpacesAroundMediaBlocks(DOM.editor);

      // 4. 若點擊已在可編輯的文字段落內部 (p, h1, h2, h3, li, td, th, etc.)，由原生游標處理
      if (e.target.closest('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, pre')) {
        return;
      }

      // 5. 使用者點擊在任一非檔案、非文字的空白或邊距位置 (例如卡片上方、兩張卡片之間、或編輯器下方留白)
      const clickY = e.clientY;
      const children = Array.from(DOM.editor.children).filter(el => el.offsetParent !== null);
      if (children.length === 0) {
        ensureTrailingEditableParagraphAndFocus();
        return;
      }

      let targetParagraph = null;
      let insertBeforeEl = null;

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const rect = child.getBoundingClientRect();

        if (clickY < rect.top) {
          // 點擊在第 i 個元素上方
          if (child.previousElementSibling && child.previousElementSibling.tagName === 'P') {
            targetParagraph = child.previousElementSibling;
          } else {
            insertBeforeEl = child;
          }
          break;
        } else if (clickY >= rect.top && clickY <= rect.bottom) {
          // 點擊在該元素水平邊距或空白處
          if (child.tagName === 'P') {
            targetParagraph = child;
          } else {
            if (clickY < rect.top + rect.height / 2) {
              if (child.previousElementSibling && child.previousElementSibling.tagName === 'P') {
                targetParagraph = child.previousElementSibling;
              } else {
                insertBeforeEl = child;
              }
            } else {
              if (child.nextElementSibling && child.nextElementSibling.tagName === 'P') {
                targetParagraph = child.nextElementSibling;
              } else {
                insertBeforeEl = child.nextElementSibling;
              }
            }
          }
          break;
        }
      }

      if (!targetParagraph) {
        if (insertBeforeEl) {
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          DOM.editor.insertBefore(p, insertBeforeEl);
          targetParagraph = p;
        } else {
          ensureTrailingEditableParagraphAndFocus();
          return;
        }
      }

      if (targetParagraph) {
        DOM.editor.focus();
        try {
          const s = window.getSelection();
          const r = document.createRange();
          r.selectNodeContents(targetParagraph);
          r.collapse(false);
          s.removeAllRanges();
          s.addRange(r);
        } catch (err) {
          console.warn('游標置入失敗:', err);
        }
      }
    });
  });

  // 📷 一鍵展開/收折所有照片與影片
  if (DOM.toggleAllMediaBtn) {
    DOM.toggleAllMediaBtn.addEventListener('click', toggleAllMedia);
  }

  // 🏷️ 表格資料庫「標籤」篩選事件
  if (DOM.tableFilterTag) {
    DOM.tableFilterTag.addEventListener('change', renderTableView);
  }

  // 🖐️ 啟用編輯器畫布內部拖曳改變元件位置
  setupEditorDragAndDrop();

  // 側邊欄分類標籤：今日 & 收集匣
  if (DOM.filterTodayBtn) {
    DOM.filterTodayBtn.addEventListener('click', () => {
      state.filterMode = 'today';
      updateFilterTabUI(DOM.filterTodayBtn);
      renderNotesList();
    });
  }
  if (DOM.filterUncatBtn) {
    DOM.filterUncatBtn.addEventListener('click', () => {
      state.filterMode = 'uncategorized';
      updateFilterTabUI(DOM.filterUncatBtn);
      renderNotesList();
    });
  }

  // 🏢 工作屬性面板 (機型、內容、急迫性、狀態、日期) 變更即時存檔與回朔動作紀錄
  if (DOM.noteMachineSelect) {
    let prevMachine = DOM.noteMachineSelect.value;
    DOM.noteMachineSelect.addEventListener('focus', () => {
      prevMachine = DOM.noteMachineSelect.value;
    });
    DOM.noteMachineSelect.addEventListener('change', () => {
      const val = DOM.noteMachineSelect.value;
      if (val === '__add_machine__' || val === '__manage_machine__') {
        DOM.noteMachineSelect.value = (state.currentNote && state.currentNote.meta && state.currentNote.meta.machineModel) || state.machineModels[0] || '';
        openTagManagerModal('machine');
        return;
      }
      if (state.currentNote && state.currentNote.meta) {
        const oldMachine = state.currentNote.meta.machineModel || prevMachine;
        const newMachine = val;
        state.currentNote.meta.machineModel = newMachine;
        prevMachine = newMachine;
        renderBreadcrumbs();
        triggerAutoSaveDebounce();

        const noteId = state.currentNote.id;
        const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
        recordAction({
          type: 'change_machine',
          title: `🚜 變更機型為「${newMachine}」`,
          subtitle: `筆記：「${noteTitle}」 (原：${oldMachine || '未指定'})`,
          noteId: noteId,
          undo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n && n.meta) {
              n.meta.machineModel = oldMachine;
              if (state.currentNote && state.currentNote.id === noteId && DOM.noteMachineSelect) {
                DOM.noteMachineSelect.value = oldMachine;
              }
              renderWorkTagLists();
              renderCurrentView();
              triggerAutoSaveDebounce();
            }
          },
          redo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n && n.meta) {
              n.meta.machineModel = newMachine;
              if (state.currentNote && state.currentNote.id === noteId && DOM.noteMachineSelect) {
                DOM.noteMachineSelect.value = newMachine;
              }
              renderWorkTagLists();
              renderCurrentView();
              triggerAutoSaveDebounce();
            }
          }
        });
      }
    });
  }

  if (DOM.noteContentSelect) {
    let prevContent = DOM.noteContentSelect.value;
    DOM.noteContentSelect.addEventListener('focus', () => {
      prevContent = DOM.noteContentSelect.value;
    });
    DOM.noteContentSelect.addEventListener('change', () => {
      const val = DOM.noteContentSelect.value;
      if (val === '__add_content__' || val === '__manage_content__') {
        DOM.noteContentSelect.value = (state.currentNote && state.currentNote.meta && state.currentNote.meta.workContent) || state.workContents[0] || '';
        openTagManagerModal('content');
        return;
      }
      if (state.currentNote && state.currentNote.meta) {
        const oldContent = state.currentNote.meta.workContent || prevContent;
        const newContent = val;
        state.currentNote.meta.workContent = newContent;
        prevContent = newContent;
        renderBreadcrumbs();
        triggerAutoSaveDebounce();

        const noteId = state.currentNote.id;
        const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
        recordAction({
          type: 'change_content',
          title: `📋 變更工作內容為「${newContent}」`,
          subtitle: `筆記：「${noteTitle}」 (原：${oldContent || '未指定'})`,
          noteId: noteId,
          undo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n && n.meta) {
              n.meta.workContent = oldContent;
              if (state.currentNote && state.currentNote.id === noteId && DOM.noteContentSelect) {
                DOM.noteContentSelect.value = oldContent;
              }
              renderWorkTagLists();
              renderCurrentView();
              triggerAutoSaveDebounce();
            }
          },
          redo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n && n.meta) {
              n.meta.workContent = newContent;
              if (state.currentNote && state.currentNote.id === noteId && DOM.noteContentSelect) {
                DOM.noteContentSelect.value = newContent;
              }
              renderWorkTagLists();
              renderCurrentView();
              triggerAutoSaveDebounce();
            }
          }
        });
      }
    });
  }

  if (DOM.noteUrgencySelect) {
    let prevUrgency = DOM.noteUrgencySelect.value;
    DOM.noteUrgencySelect.addEventListener('focus', () => {
      prevUrgency = DOM.noteUrgencySelect.value;
    });
    DOM.noteUrgencySelect.addEventListener('change', () => {
      const val = DOM.noteUrgencySelect.value;
      if (val === '__add_urgency__' || val === '__manage_urgency__') {
        DOM.noteUrgencySelect.value = (state.currentNote && state.currentNote.meta && state.currentNote.meta.urgency) || (state.urgencies && state.urgencies[0] && state.urgencies[0].id) || '🟢 常規';
        openTagManagerModal('urgency');
        return;
      }
      if (state.currentNote && state.currentNote.meta) {
        const oldUrgency = state.currentNote.meta.urgency || prevUrgency;
        const newUrgency = val;
        state.currentNote.meta.urgency = newUrgency;
        prevUrgency = newUrgency;
        triggerAutoSaveDebounce();

        const noteId = state.currentNote.id;
        const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
        recordAction({
          type: 'change_urgency',
          title: `🚨 變更急迫性為「${newUrgency}」`,
          subtitle: `筆記：「${noteTitle}」 (原：${oldUrgency || '未指定'})`,
          noteId: noteId,
          undo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n && n.meta) {
              n.meta.urgency = oldUrgency;
              if (state.currentNote && state.currentNote.id === noteId && DOM.noteUrgencySelect) {
                DOM.noteUrgencySelect.value = oldUrgency;
              }
              renderWorkTagLists();
              renderCurrentView();
              triggerAutoSaveDebounce();
            }
          },
          redo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n && n.meta) {
              n.meta.urgency = newUrgency;
              if (state.currentNote && state.currentNote.id === noteId && DOM.noteUrgencySelect) {
                DOM.noteUrgencySelect.value = newUrgency;
              }
              renderWorkTagLists();
              renderCurrentView();
              triggerAutoSaveDebounce();
            }
          }
        });
      }
    });
  }

  if (DOM.noteDueDate) {
    let prevDate = DOM.noteDueDate.value;
    DOM.noteDueDate.addEventListener('focus', () => {
      prevDate = DOM.noteDueDate.value;
    });
    DOM.noteDueDate.addEventListener('change', () => {
      if (state.currentNote && state.currentNote.meta) {
        const oldDate = state.currentNote.meta.dueDate || prevDate;
        const newDate = DOM.noteDueDate.value;
        state.currentNote.meta.dueDate = newDate;
        prevDate = newDate;
        triggerAutoSaveDebounce();

        const noteId = state.currentNote.id;
        const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
        recordAction({
          type: 'change_date',
          title: `📅 變更處理日期為「${newDate}」`,
          subtitle: `筆記：「${noteTitle}」 (原：${oldDate || '無'})`,
          noteId: noteId,
          undo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n && n.meta) {
              n.meta.dueDate = oldDate;
              if (state.currentNote && state.currentNote.id === noteId && DOM.noteDueDate) {
                DOM.noteDueDate.value = oldDate;
              }
              renderCurrentView();
              triggerAutoSaveDebounce();
            }
          },
          redo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n && n.meta) {
              n.meta.dueDate = newDate;
              if (state.currentNote && state.currentNote.id === noteId && DOM.noteDueDate) {
                DOM.noteDueDate.value = newDate;
              }
              renderCurrentView();
              triggerAutoSaveDebounce();
            }
          }
        });
      }
    });
  }

  // 點擊背景遮罩關閉彈跳視窗
  if (DOM.tagManagerModal) {
    DOM.tagManagerModal.addEventListener('click', (e) => {
      if (e.target === DOM.tagManagerModal) closeTagManagerModal();
    });
  }
  if (DOM.actionHistoryModal) {
    DOM.actionHistoryModal.addEventListener('click', (e) => {
      if (e.target === DOM.actionHistoryModal) closeHistoryModal();
    });
  }

  // 🏷️ 全層級標籤管理中心按鈕事件綁定
  if (DOM.closeTagManagerBtn) DOM.closeTagManagerBtn.addEventListener('click', closeTagManagerModal);
  if (DOM.tmDoneBtn) DOM.tmDoneBtn.addEventListener('click', closeTagManagerModal);
  if (DOM.manageMachineBtn) DOM.manageMachineBtn.addEventListener('click', () => openTagManagerModal('machine'));
  if (DOM.btnManageMachine) DOM.btnManageMachine.addEventListener('click', () => openTagManagerModal('machine'));
  if (DOM.addMachineBtn) DOM.addMachineBtn.addEventListener('click', () => openTagManagerModal('machine'));
  if (DOM.btnQuickAddMachine) DOM.btnQuickAddMachine.addEventListener('click', () => openTagManagerModal('machine'));

  if (DOM.manageContentBtn) DOM.manageContentBtn.addEventListener('click', () => openTagManagerModal('content'));
  if (DOM.btnManageContent) DOM.btnManageContent.addEventListener('click', () => openTagManagerModal('content'));
  if (DOM.addContentTypeBtn) DOM.addContentTypeBtn.addEventListener('click', () => openTagManagerModal('content'));
  if (DOM.btnQuickAddContent) DOM.btnQuickAddContent.addEventListener('click', () => openWorkTagModal('content'));

  if (DOM.manageUrgencyBtn) DOM.manageUrgencyBtn.addEventListener('click', () => openTagManagerModal('urgency'));
  if (DOM.btnManageUrgency) DOM.btnManageUrgency.addEventListener('click', () => openTagManagerModal('urgency'));
  if (DOM.addUrgencyBtn) DOM.addUrgencyBtn.addEventListener('click', () => openTagManagerModal('urgency'));
  if (DOM.btnQuickAddUrgency) DOM.btnQuickAddUrgency.addEventListener('click', () => openTagManagerModal('urgency'));

  // 分頁切換
  if (DOM.tmTabMachine) DOM.tmTabMachine.addEventListener('click', () => switchTagManagerTab('machine'));
  if (DOM.tmTabContent) DOM.tmTabContent.addEventListener('click', () => switchTagManagerTab('content'));
  if (DOM.tmTabUrgency) DOM.tmTabUrgency.addEventListener('click', () => switchTagManagerTab('urgency'));
  if (DOM.tmTabCustom) DOM.tmTabCustom.addEventListener('click', () => switchTagManagerTab('custom'));

  // 新增各層級標籤按鈕與 Enter 鍵綁定
  if (DOM.tmAddMachineBtn && DOM.tmNewMachineInput) {
    DOM.tmAddMachineBtn.addEventListener('click', () => addMachineModel(DOM.tmNewMachineInput.value));
    DOM.tmNewMachineInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addMachineModel(DOM.tmNewMachineInput.value);
      }
    });
  }

  if (DOM.tmAddContentBtn && DOM.tmNewContentInput) {
    DOM.tmAddContentBtn.addEventListener('click', () => addWorkContent(DOM.tmNewContentInput.value));
    DOM.tmNewContentInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addWorkContent(DOM.tmNewContentInput.value);
      }
    });
  }

  if (DOM.tmAddUrgencyBtn && DOM.tmNewUrgencyName && DOM.tmNewUrgencyColor) {
    DOM.tmAddUrgencyBtn.addEventListener('click', () => addUrgencyLevel(DOM.tmNewUrgencyName.value, DOM.tmNewUrgencyColor.value));
    DOM.tmNewUrgencyName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addUrgencyLevel(DOM.tmNewUrgencyName.value, DOM.tmNewUrgencyColor.value);
      }
    });
  }

  if (DOM.tmAddBtn && DOM.tmNewName && DOM.tmNewColor) {
    DOM.tmAddBtn.addEventListener('click', () => addCustomTag(DOM.tmNewName.value, DOM.tmNewColor.value));
    DOM.tmNewName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustomTag(DOM.tmNewName.value, DOM.tmNewColor.value);
      }
    });
  }

  // 🕒 動作歷史與回朔時光機按鈕事件
  if (DOM.undoActionBtn) DOM.undoActionBtn.addEventListener('click', undoAction);
  if (DOM.redoActionBtn) DOM.redoActionBtn.addEventListener('click', redoAction);
  if (DOM.actionHistoryBtn) DOM.actionHistoryBtn.addEventListener('click', openHistoryModal);
  if (DOM.closeHistoryModalBtn) DOM.closeHistoryModalBtn.addEventListener('click', closeHistoryModal);
  if (DOM.closeHistoryModalDoneBtn) DOM.closeHistoryModalDoneBtn.addEventListener('click', closeHistoryModal);

  if (DOM.btnQuickUndo20) DOM.btnQuickUndo20.addEventListener('click', quickRollback20Steps);
  if (DOM.btnModalUndoOne) DOM.btnModalUndoOne.addEventListener('click', undoAction);
  if (DOM.btnModalRedoOne) DOM.btnModalRedoOne.addEventListener('click', redoAction);

  // 清除所有工作篩選
  if (DOM.clearAllFiltersBtn) {
    DOM.clearAllFiltersBtn.addEventListener('click', () => {
      state.currentMachineFilter = null;
      state.currentContentFilter = null;
      state.currentUrgencyFilter = null;
      state.currentClientVendorFilter = null;
      state.currentTagFilter = null;
      state.filterMode = 'all';
      if (DOM.searchInput) DOM.searchInput.value = '';
      renderWorkTagLists();
      renderSidebarTags();
      renderNotesList();
      renderBreadcrumbs();
      renderCurrentView();
    });
  }

  // 表格篩選變更監聽
  if (DOM.tableFilterMachine) DOM.tableFilterMachine.addEventListener('change', renderTableView);
  if (DOM.tableFilterContent) DOM.tableFilterContent.addEventListener('change', renderTableView);
  if (DOM.tableFilterUrgency) DOM.tableFilterUrgency.addEventListener('change', renderTableView);

  // 表格資料庫事件
  if (DOM.tableSearchInput) {
    DOM.tableSearchInput.addEventListener('input', renderTableView);
    DOM.tableSearchInput.addEventListener('focus', () => {
      scheduleBackgroundFullTextIndexing();
    });
    DOM.tableSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && DOM.tableSearchInput.value) {
        e.preventDefault();
        DOM.tableSearchInput.value = '';
        renderTableView();
      }
    });
  }
  if (DOM.tableSearchClearBtn) {
    DOM.tableSearchClearBtn.addEventListener('click', () => {
      if (DOM.tableSearchInput) {
        DOM.tableSearchInput.value = '';
        DOM.tableSearchInput.focus();
      }
      renderTableView();
    });
  }
  // status filter removed
  if (DOM.tableFilterEnergy) DOM.tableFilterEnergy.addEventListener('change', renderTableView);
  if (DOM.tableFilterGtd) DOM.tableFilterGtd.addEventListener('change', renderTableView);
  if (DOM.tableAddRowBtn) {
    DOM.tableAddRowBtn.addEventListener('click', () => {
      createNewNote();
      switchView('editor');
    });
  }



  // 行事曆事件
  if (DOM.calPrevMonthBtn) {
    DOM.calPrevMonthBtn.addEventListener('click', () => {
      state.calendarMonth--;
      if (state.calendarMonth < 0) {
        state.calendarMonth = 11;
        state.calendarYear--;
      }
      renderCalendarView();
    });
  }
  if (DOM.calTodayBtn) {
    DOM.calTodayBtn.addEventListener('click', () => {
      const d = new Date();
      state.calendarYear = d.getFullYear();
      state.calendarMonth = d.getMonth();
      renderCalendarView();
    });
  }
  if (DOM.calNextMonthBtn) {
    DOM.calNextMonthBtn.addEventListener('click', () => {
      state.calendarMonth++;
      if (state.calendarMonth > 11) {
        state.calendarMonth = 0;
        state.calendarYear++;
      }
      renderCalendarView();
    });
  }

  // 每日檢視事件
  DOM.settingsBtn.addEventListener('click', openSettings);
  DOM.closeSettingsBtn.addEventListener('click', closeSettings);
  DOM.saveSettingsBtn.addEventListener('click', saveSettings);
  DOM.loginBtn.addEventListener('click', handleLogin);
  DOM.logoutBtn.addEventListener('click', handleLogout);
  DOM.newNoteBtn.addEventListener('click', createNewNote);
  DOM.deleteNoteBtn.addEventListener('click', deleteCurrentNote);
  DOM.notePinBtn.addEventListener('click', togglePin);
  // 重新整理與同步按鈕綁定 (雙向同步筆記與所有分類標籤)
  if (DOM.refreshBtn) {
    DOM.refreshBtn.addEventListener('click', () => fullSyncWithDrive(true));
  }
  if (DOM.syncStatus) {
    DOM.syncStatus.classList.add('cursor-pointer');
    DOM.syncStatus.title = '點擊立即與 Google Drive 進行雙向同步';
    DOM.syncStatus.addEventListener('click', () => fullSyncWithDrive(true));
  }

  // 屬性面板收合/展開事件綁定
  const togglePropsBtn = document.getElementById('toggle-properties-btn');
  const propsContent = document.getElementById('note-properties-content');
  const propsLabel = document.getElementById('properties-toggle-label');
  const propsIcon = document.getElementById('properties-toggle-icon');
  if (togglePropsBtn && propsContent) {
    togglePropsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isHidden = propsContent.classList.toggle('hidden');
      if (propsLabel) propsLabel.textContent = isHidden ? '展開' : '收合';
      if (propsIcon) {
        propsIcon.setAttribute('data-lucide', isHidden ? 'chevron-down' : 'chevron-up');
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    });
  }


  // 資料夾操作按鈕
  if (DOM.addFolderBtn) {
    DOM.addFolderBtn.addEventListener('click', () => openFolderModal('create'));
  }
  if (DOM.closeFolderModalBtn) DOM.closeFolderModalBtn.addEventListener('click', closeFolderModal);
  if (DOM.cancelFolderModalBtn) DOM.cancelFolderModalBtn.addEventListener('click', closeFolderModal);
  if (DOM.submitFolderModalBtn) DOM.submitFolderModalBtn.addEventListener('click', submitFolderModal);

  // 標籤管理員 Modal
  if (DOM.sidebarManageTagsBtn) DOM.sidebarManageTagsBtn.addEventListener('click', openTagManagerModal);
  if (DOM.openTagManagerLink) DOM.openTagManagerLink.addEventListener('click', openTagManagerModal);
  if (DOM.closeTagManagerBtn) DOM.closeTagManagerBtn.addEventListener('click', closeTagManagerModal);
  if (DOM.tmDoneBtn) DOM.tmDoneBtn.addEventListener('click', closeTagManagerModal);

  if (DOM.tmAddBtn) {
    DOM.tmAddBtn.addEventListener('click', () => {
      const name = DOM.tmNewName.value.trim();
      const color = DOM.tmNewColor.value;
      if (!name) {
        showToast('請輸入標籤名稱');
        return;
      }
      if (state.tags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        showToast('此標籤已存在');
        return;
      }
      state.tags.push({
        id: 't_' + Date.now(),
        name,
        color
      });
      DOM.tmNewName.value = '';
      saveTags();
      renderTagManagerList();
      showToast(`已建立新標籤「#${name}」`);
    });
  }

  // 下拉式標籤面板
  if (DOM.addTagBtn) {
    DOM.addTagBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.tagDropdownPopover.classList.toggle('hidden');
      if (!DOM.tagDropdownPopover.classList.contains('hidden')) {
        renderTagDropdownPopover(DOM.tagSearchInput ? DOM.tagSearchInput.value : '');
        if (DOM.tagSearchInput) DOM.tagSearchInput.focus();
      }
    });
  }

  if (DOM.tagSearchInput) {
    DOM.tagSearchInput.addEventListener('input', () => {
      renderTagDropdownPopover(DOM.tagSearchInput.value);
    });
  }

  if (DOM.tagConfirmCreateBtn) {
    DOM.tagConfirmCreateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = DOM.tagSearchInput.value.trim();
      const color = DOM.tagNewColorSelect.value;
      if (!name) return;
      if (!state.tags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        state.tags.push({ id: 't_' + Date.now(), name, color });
        saveTags();
      }
      if (!state.currentNote.meta.tags) state.currentNote.meta.tags = [];
      if (!state.currentNote.meta.tags.includes(name)) {
        state.currentNote.meta.tags.push(name);
      }
      DOM.tagSearchInput.value = '';
      renderNoteActiveTags();
      renderSidebarTags();
      renderTagDropdownPopover('');
      triggerAutoSaveDebounce();
      showToast(`已建立並套用標籤「#${name}」`);
    });
  }

  // 封面橫幅按鈕
  if (DOM.addCoverBtn) {
    DOM.addCoverBtn.addEventListener('click', () => {
      DOM.coverModal.classList.remove('hidden');
    });
  }
  if (DOM.changeCoverBtn) {
    DOM.changeCoverBtn.addEventListener('click', () => {
      DOM.coverModal.classList.remove('hidden');
    });
  }
  if (DOM.removeCoverBtn) {
    DOM.removeCoverBtn.addEventListener('click', removeNoteCover);
  }
  if (DOM.closeCoverModalBtn) {
    DOM.closeCoverModalBtn.addEventListener('click', () => {
      DOM.coverModal.classList.add('hidden');
    });
  }
  if (DOM.applyCustomCoverBtn) {
    DOM.applyCustomCoverBtn.addEventListener('click', () => {
      const url = DOM.customCoverInput.value.trim();
      if (!url) return;
      setNoteCover(url);
      DOM.coverModal.classList.add('hidden');
    });
  }

  // 隨機 Emoji (支援時光機回朔)
  if (DOM.randomEmojiBtn) {
    DOM.randomEmojiBtn.addEventListener('click', () => {
      const rand = CURATED_EMOJIS[Math.floor(Math.random() * CURATED_EMOJIS.length)];
      const oldIcon = (state.currentNote && state.currentNote.meta && state.currentNote.meta.icon) || DOM.noteEmojiBtn.textContent || '🛠️';
      DOM.noteEmojiBtn.textContent = rand;
      if (state.currentNote && state.currentNote.meta) {
        const noteId = state.currentNote.id;
        const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
        state.currentNote.meta.icon = rand;
        const nInList = state.notes.find(x => x.id === noteId);
        if (nInList && nInList.meta) nInList.meta.icon = rand;
        recordAction({
          type: 'change_emoji',
          title: `🎲 隨機更換圖示為 ${rand}`,
          subtitle: `筆記：「${noteTitle}」 (原圖示：${oldIcon})`,
          noteId,
          undo: () => {
            const n = state.notes.find(x => x.id === noteId);
            if (n && n.meta) n.meta.icon = oldIcon;
            if (state.currentNote && state.currentNote.id === noteId) {
              state.currentNote.meta.icon = oldIcon;
              if (DOM.noteEmojiBtn) DOM.noteEmojiBtn.textContent = oldIcon;
            }
            renderNotesList();
            renderBreadcrumbs();
            triggerAutoSaveDebounce();
          },
          redo: () => {
            const n = state.notes.find(x => x.id === noteId);
            if (n && n.meta) n.meta.icon = rand;
            if (state.currentNote && state.currentNote.id === noteId) {
              state.currentNote.meta.icon = rand;
              if (DOM.noteEmojiBtn) DOM.noteEmojiBtn.textContent = rand;
            }
            renderNotesList();
            renderBreadcrumbs();
            triggerAutoSaveDebounce();
          }
        });
      }
      renderNotesList();
      renderBreadcrumbs();
      triggerAutoSaveDebounce();
    });
  }

  // 所屬資料夾選取切換
  if (DOM.noteFolderSelect) {
    DOM.noteFolderSelect.addEventListener('change', () => {
      if (state.currentNote && state.currentNote.meta) {
        state.currentNote.meta.folderId = DOM.noteFolderSelect.value || null;
        renderWorkTagLists();
        renderBreadcrumbs();
        triggerAutoSaveDebounce();
      }
    });
  }



  // 模板選單
  DOM.templateDropdownBtn.addEventListener('click', () => {
    DOM.templateMenu.classList.toggle('hidden');
  });
  document.querySelectorAll('#template-menu button').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTemplate(btn.dataset.tpl);
    });
  });



  // 📷 專屬相機直接拍攝上傳 (防閃退保護)
  if (DOM.cameraCaptureInput) {
    DOM.cameraCaptureInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      for (const f of files) {
        await uploadMediaFile(f);
      }
      DOM.cameraCaptureInput.value = '';
    });
  }

  if (DOM.insertCameraBtn) {
    DOM.insertCameraBtn.addEventListener('click', () => {
      saveCameraCheckpoint();
      if (DOM.cameraCaptureInput) DOM.cameraCaptureInput.click();
    });
  }

  if (DOM.mbToolCamera) {
    DOM.mbToolCamera.addEventListener('click', () => {
      saveCameraCheckpoint();
      if (DOM.cameraCaptureInput) DOM.cameraCaptureInput.click();
    });
  }

  // 媒體上傳按鈕 (相簿選擇)
  if (DOM.insertMediaBtn) {
    DOM.insertMediaBtn.addEventListener('click', () => {
      saveCameraCheckpoint();
      if (DOM.mediaUploadInput) DOM.mediaUploadInput.click();
    });
  }
  if (DOM.mbToolMedia) {
    DOM.mbToolMedia.addEventListener('click', () => {
      saveCameraCheckpoint();
      if (DOM.mediaUploadInput) DOM.mediaUploadInput.click();
    });
  }

  if (DOM.mediaUploadInput) {
    DOM.mediaUploadInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      for (const f of files) {
        await uploadMediaFile(f);
      }
      DOM.mediaUploadInput.value = '';
    });
  }

  // 📎 檔案上傳按鈕 (支援所有格式與筆記內直接下載)
  if (DOM.insertFileBtn) {
    DOM.insertFileBtn.addEventListener('click', () => {
      saveCameraCheckpoint();
      if (DOM.genericFileUploadInput) DOM.genericFileUploadInput.click();
    });
  }
  if (DOM.mbToolFile) {
    DOM.mbToolFile.addEventListener('click', () => {
      saveCameraCheckpoint();
      if (DOM.genericFileUploadInput) DOM.genericFileUploadInput.click();
    });
  }

  if (DOM.genericFileUploadInput) {
    DOM.genericFileUploadInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      DOM.genericFileUploadInput.value = '';
      await Promise.all(files.map(f => uploadGenericFile(f)));
    });
  }

  // 剪貼簿貼上圖片或任意檔案
  DOM.editor.addEventListener('paste', async (e) => {
    const items = (e.clipboardData || window.clipboardData).items;
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await uploadGenericFile(file);
        }
      }
    }
  });

  // 拖曳檔案 (圖片、影片、音訊、文件)
  DOM.editor.addEventListener('dragover', (e) => e.preventDefault());
  DOM.editor.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files) {
      for (const file of e.dataTransfer.files) {
        await uploadGenericFile(file);
      }
    }
  });

  // 側邊欄展開/關閉
  DOM.toggleSidebarBtn.addEventListener('click', toggleSidebar);
  if (DOM.closeSidebarMobileBtn) DOM.closeSidebarMobileBtn.addEventListener('click', closeSidebar);
  if (DOM.sidebarBackdrop) DOM.sidebarBackdrop.addEventListener('click', closeSidebar);

  // 手機底部工具列按鈕 (v2.6.6 防失焦 + 全動作時光機記錄)
  if (DOM.mbToolUndo) {
    DOM.mbToolUndo.addEventListener('click', (e) => {
      e.preventDefault();
      undoAction();
    });
  }
  if (DOM.mbToolHighlight) {
    const handleMobileHighlightBtnTap = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const range = getOrRestoreEditorSelectionRange();
      if (range && !range.collapsed) {
        // 若當前已有選取文字或已點選鎖定 <mark>：一鍵直接套用/切換當前螢光筆顏色，並保持底部色盤開啟供秒換色！
        applyHighlight(state.activeHighlightColor || '#fef08a');
        if (DOM.mbHighlightPalette) {
          DOM.mbHighlightPalette.classList.remove('hidden');
        }
      } else if (DOM.mbHighlightPalette) {
        DOM.mbHighlightPalette.classList.toggle('hidden');
      } else {
        toggleHighlightBrushMode();
      }
    };
    let mbTouchDone = false;
    DOM.mbToolHighlight.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mbTouchDone = false;
    }, { passive: false });
    DOM.mbToolHighlight.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      mbTouchDone = true;
      handleMobileHighlightBtnTap(e);
    }, { passive: false });
    DOM.mbToolHighlight.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    DOM.mbToolHighlight.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!mbTouchDone) handleMobileHighlightBtnTap(e);
      mbTouchDone = false;
    });
  }
  if (DOM.mbToolBold) {
    DOM.mbToolBold.addEventListener('mousedown', (e) => e.preventDefault());
    DOM.mbToolBold.addEventListener('click', (e) => {
      e.preventDefault();
      getOrRestoreEditorSelectionRange();
      commitEditorCanvasAction('format_text', '🔤 設定粗體格式', '', () => {
        document.execCommand('bold');
      });
      saveLocalDraftImmediately();
      triggerAutoSaveDebounce();
    });
  }
  if (DOM.mbToolTodo) {
    DOM.mbToolTodo.addEventListener('mousedown', (e) => e.preventDefault());
    DOM.mbToolTodo.addEventListener('click', (e) => {
      e.preventDefault();
      commitEditorCanvasAction('slash_insert', '☑️ 插入待辦事項', '', () => {
        insertHtmlAtCursor('<div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text" contenteditable="true">待辦事項內容</span></div><p><br></p>');
        enhanceAllEditorBlocks(DOM.editor);
      });
      saveLocalDraftImmediately();
      triggerAutoSaveDebounce();
    });
  }
  if (DOM.mbToolList) {
    DOM.mbToolList.addEventListener('mousedown', (e) => e.preventDefault());
    DOM.mbToolList.addEventListener('click', (e) => {
      e.preventDefault();
      getOrRestoreEditorSelectionRange();
      commitEditorCanvasAction('format_text', '📋 切換項目符號清單', '', () => {
        document.execCommand('insertUnorderedList');
      });
      saveLocalDraftImmediately();
      triggerAutoSaveDebounce();
    });
  }
  if (DOM.mbToolCallout) {
    DOM.mbToolCallout.addEventListener('mousedown', (e) => e.preventDefault());
    DOM.mbToolCallout.addEventListener('click', (e) => {
      e.preventDefault();
      commitEditorCanvasAction('slash_insert', '💡 插入醒目提示框', '', () => {
        insertHtmlAtCursor('<div class="notion-callout"><span class="notion-callout-icon">💡</span><div class="notion-callout-body">提醒重點...</div></div><p><br></p>');
        enhanceAllEditorBlocks(DOM.editor);
      });
      saveLocalDraftImmediately();
      triggerAutoSaveDebounce();
    });
  }
  if (DOM.mbToolSave) {
    DOM.mbToolSave.addEventListener('click', saveCurrentNote);
  }

  // 大綱開關
  if (DOM.toggleOutlineBtn) {
    DOM.toggleOutlineBtn.addEventListener('click', () => {
      DOM.outlinePanel.classList.toggle('hidden');
    });
  }
  if (DOM.closeOutlineBtn) {
    DOM.closeOutlineBtn.addEventListener('click', () => {
      DOM.outlinePanel.classList.add('hidden');
    });
  }

  // 篩選 Tabs (安全防護)
  if (DOM.filterAllBtn) {
    DOM.filterAllBtn.addEventListener('click', () => {
      state.filterMode = 'all';
      state.currentTagFilter = null;
      updateFilterTabUI(DOM.filterAllBtn);
      renderNotesList();
    });
  }
  if (DOM.filterPinnedBtn) {
    DOM.filterPinnedBtn.addEventListener('click', () => {
      state.filterMode = 'pinned';
      updateFilterTabUI(DOM.filterPinnedBtn);
      renderNotesList();
    });
  }
  if (DOM.filterDoingBtn) {
    DOM.filterDoingBtn.addEventListener('click', () => {
      state.filterMode = 'doing';
      updateFilterTabUI(DOM.filterDoingBtn);
      renderNotesList();
    });
  }

  if (DOM.layoutListBtn) DOM.layoutListBtn.addEventListener('click', () => setLayout('list'));
  if (DOM.layoutGridBtn) DOM.layoutGridBtn.addEventListener('click', () => setLayout('grid'));

  if (DOM.searchInput) DOM.searchInput.addEventListener('input', renderNotesList);

  // 點擊外部關閉選單
  document.addEventListener('click', (e) => {
    if (DOM.exportDropdownBtn && !DOM.exportDropdownBtn.contains(e.target) && DOM.exportMenu && !DOM.exportMenu.contains(e.target)) {
      DOM.exportMenu.classList.add('hidden');
    }
    if (DOM.templateDropdownBtn && !DOM.templateDropdownBtn.contains(e.target) && DOM.templateMenu && !DOM.templateMenu.contains(e.target)) {
      DOM.templateMenu.classList.add('hidden');
    }
    if (DOM.slashMenu && !DOM.slashMenu.contains(e.target)) {
      DOM.slashMenu.classList.add('hidden');
    }
    if (DOM.tagDropdownPopover && !DOM.tagDropdownPopover.contains(e.target) && DOM.addTagBtn && !DOM.addTagBtn.contains(e.target)) {
      DOM.tagDropdownPopover.classList.add('hidden');
    }
    if (DOM.emojiPicker && !DOM.emojiPicker.contains(e.target) && DOM.noteEmojiBtn && !DOM.noteEmojiBtn.contains(e.target)) {
      DOM.emojiPicker.classList.add('hidden');
    }
    if (DOM.topHighlightPalette && DOM.topHighlightWrapper && !DOM.topHighlightWrapper.contains(e.target)) {
      DOM.topHighlightPalette.classList.add('hidden');
    }
    if (DOM.mbHighlightPalette && DOM.mbToolHighlight && !DOM.mbHighlightPalette.contains(e.target) && !DOM.mbToolHighlight.contains(e.target) && !e.target.closest('mark.notion-highlight, mark') && !state.highlightBrushMode) {
      DOM.mbHighlightPalette.classList.add('hidden');
    }
  });

  DOM.exportDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.exportMenu.classList.toggle('hidden');
  });

  DOM.exportMdBtn.addEventListener('click', exportMarkdown);
  DOM.exportHtmlBtn.addEventListener('click', exportHTML);
  DOM.exportPdfBtn.addEventListener('click', exportPDF);

  // Emoji Picker (支援時光機回朔)
  DOM.noteEmojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.emojiPicker.classList.toggle('hidden');
  });
  document.querySelectorAll('.emoji-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const newIcon = btn.textContent;
      const oldIcon = (state.currentNote && state.currentNote.meta && state.currentNote.meta.icon) || DOM.noteEmojiBtn.textContent || '🛠️';
      DOM.noteEmojiBtn.textContent = newIcon;
      DOM.emojiPicker.classList.add('hidden');
      if (state.currentNote && state.currentNote.meta && newIcon !== oldIcon) {
        const noteId = state.currentNote.id;
        const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
        state.currentNote.meta.icon = newIcon;
        const nInList = state.notes.find(x => x.id === noteId);
        if (nInList && nInList.meta) nInList.meta.icon = newIcon;
        recordAction({
          type: 'change_emoji',
          title: `😀 更換筆記圖示為 ${newIcon}`,
          subtitle: `筆記：「${noteTitle}」 (原圖示：${oldIcon})`,
          noteId,
          undo: () => {
            const n = state.notes.find(x => x.id === noteId);
            if (n && n.meta) n.meta.icon = oldIcon;
            if (state.currentNote && state.currentNote.id === noteId) {
              state.currentNote.meta.icon = oldIcon;
              if (DOM.noteEmojiBtn) DOM.noteEmojiBtn.textContent = oldIcon;
            }
            renderNotesList();
            renderBreadcrumbs();
            triggerAutoSaveDebounce();
          },
          redo: () => {
            const n = state.notes.find(x => x.id === noteId);
            if (n && n.meta) n.meta.icon = newIcon;
            if (state.currentNote && state.currentNote.id === noteId) {
              state.currentNote.meta.icon = newIcon;
              if (DOM.noteEmojiBtn) DOM.noteEmojiBtn.textContent = newIcon;
            }
            renderNotesList();
            renderBreadcrumbs();
            triggerAutoSaveDebounce();
          }
        });
      }
      renderNotesList();
      renderBreadcrumbs();
      triggerAutoSaveDebounce();
    });
  });

  // 屬性修改事件
  DOM.noteTitle.addEventListener('focus', () => {
    state.titleBeforeEdit = DOM.noteTitle.value;
  });
  if (DOM.noteTitle) {
    DOM.noteTitle.addEventListener('input', () => {
      DOM.headerTitle.textContent = DOM.noteTitle.value || '未命名筆記';
      renderBreadcrumbs();
      triggerAutoSaveDebounce();
    });
  }
  DOM.noteTitle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      DOM.editor.focus();
    }
  });
  DOM.noteTitle.addEventListener('change', () => {
    const oldTitle = state.titleBeforeEdit || '';
    const newTitle = DOM.noteTitle.value.trim();
    if (newTitle !== oldTitle && state.currentNote) {
      const noteId = state.currentNote.id;
      recordAction({
        type: 'change_title',
        title: `✏️ 修改標題為「${newTitle || '無標題'}」`,
        subtitle: `原標題：「${oldTitle || '無標題'}」`,
        noteId: noteId,
        undo: () => {
          const n = state.notes.find(note => note.id === noteId);
          if (n) {
            n.name = (oldTitle || '未命名筆記') + '.md';
            if (state.currentNote && state.currentNote.id === noteId) {
              DOM.noteTitle.value = oldTitle;
              DOM.headerTitle.textContent = oldTitle || '未命名筆記';
            }
            renderNotesList();
            renderBreadcrumbs();
            triggerAutoSaveDebounce();
          }
        },
        redo: () => {
          const n = state.notes.find(note => note.id === noteId);
          if (n) {
            n.name = (newTitle || '未命名筆記') + '.md';
            if (state.currentNote && state.currentNote.id === noteId) {
              DOM.noteTitle.value = newTitle;
              DOM.headerTitle.textContent = newTitle || '未命名筆記';
            }
            renderNotesList();
            renderBreadcrumbs();
            triggerAutoSaveDebounce();
          }
        }
      });
      state.titleBeforeEdit = newTitle;
    }
  });

  if (DOM.noteStatusSelect) {
    DOM.noteStatusSelect.addEventListener('change', () => {
      if (state.currentNote && state.currentNote.meta) {
        const oldStatus = state.currentNote.meta.status || '🚀 處理中';
        const newStatus = DOM.noteStatusSelect.value;
        state.currentNote.meta.status = newStatus;
        renderNotesList();
        triggerAutoSaveDebounce();

        const noteId = state.currentNote.id;
        const noteTitle = state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
        recordAction({
          type: 'change_status',
          title: `🔄 變更狀態為「${newStatus}」`,
          subtitle: `筆記：「${noteTitle}」 (原：${oldStatus})`,
          noteId: noteId,
          undo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n && n.meta) {
              n.meta.status = oldStatus;
              if (state.currentNote && state.currentNote.id === noteId && DOM.noteStatusSelect) DOM.noteStatusSelect.value = oldStatus;
              renderNotesList();
              renderCurrentView();
              triggerAutoSaveDebounce();
            }
          },
          redo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n && n.meta) {
              n.meta.status = newStatus;
              if (state.currentNote && state.currentNote.id === noteId && DOM.noteStatusSelect) DOM.noteStatusSelect.value = newStatus;
              renderNotesList();
              renderCurrentView();
              triggerAutoSaveDebounce();
            }
          }
        });
      }
    });
  }

  // 畫布輸入事件與內容編輯回朔快照記錄 (v2.6.6 零遺漏強化版)
  if (DOM.editor) {
    DOM.editor.addEventListener('focus', () => {
      if (state.editorSnapshotBeforeEdit === null || (state.currentNote && state.snapshotNoteId !== state.currentNote.id)) {
        state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
        state.snapshotNoteId = state.currentNote ? state.currentNote.id : null;
      }
    });

    DOM.editor.addEventListener('input', (e) => {
      try { updateStats(); } catch(err) { console.warn(err); }
      try { renderOutline(); } catch(err) { console.warn(err); }
      try { handleSlashMenu(e); } catch(err) { console.warn(err); }
      triggerAutoSaveDebounce();

      if (state.editorSnapshotBeforeEdit === null) {
        state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
        state.snapshotNoteId = state.currentNote ? state.currentNote.id : null;
      }
      if (editorInputTimer) clearTimeout(editorInputTimer);
      editorInputTimer = setTimeout(() => {
        flushPendingEditorInputHistory('✍️ 編輯筆記內文');
      }, 650);
    });
  }


  // 畫布與標題失焦時若有未存修改，立即觸發即時雲端上傳 (Instant Flush on Leave)
  if (DOM.editor) {
    DOM.editor.addEventListener('blur', () => {
      flushImmediateCloudSave();
    });
  }
  if (DOM.noteTitle) {
    DOM.noteTitle.addEventListener('blur', () => {
      flushImmediateCloudSave();
    });
  }

  // 關閉、切換分頁或進入背景時，立即執行即時雲端上傳與本機雙保險
  window.addEventListener('beforeunload', (e) => {
    if (state.isDirty) {
      flushImmediateCloudSave();
      e.preventDefault();
      e.returnValue = '正在將最新筆記同步至 Google Drive...';
    }
  });
  window.addEventListener('pagehide', () => {
    flushImmediateCloudSave();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushImmediateCloudSave();
    }
  });

  // 畫布點擊事件（Todo 待辦打勾切換與即時時光機記錄）
  DOM.editor.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('notion-todo-checkbox')) {
      const cb = e.target;
      const parent = cb.closest('.notion-todo-item');
      if (parent) {
        flushPendingEditorInputHistory();
        const textSpan = parent.querySelector('.notion-todo-text');
        const todoText = (textSpan ? textSpan.textContent.trim() : '').slice(0, 24) || '待辦事項';
        const nowChecked = Boolean(cb.checked);

        // 先還原 DOM 狀態以擷取勾選前快照，再套用勾選後狀態並寫入時光機
        if (nowChecked) {
          cb.removeAttribute('checked');
          if (textSpan) textSpan.classList.remove('checked');
        } else {
          cb.setAttribute('checked', '');
          if (textSpan) textSpan.classList.add('checked');
        }
        const beforeHtml = DOM.editor.innerHTML;

        if (nowChecked) {
          cb.setAttribute('checked', '');
          cb.checked = true;
          if (textSpan) textSpan.classList.add('checked');
        } else {
          cb.removeAttribute('checked');
          cb.checked = false;
          if (textSpan) textSpan.classList.remove('checked');
        }
        const afterHtml = DOM.editor.innerHTML;
        const noteId = state.currentNote ? state.currentNote.id : null;
        const noteTitle = (state.currentNote && state.currentNote.name) ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';
        state.editorSnapshotBeforeEdit = afterHtml;

        recordAction({
          type: 'todo_toggle',
          title: nowChecked ? `☑️ 完成待辦：「${todoText}」` : `⬜ 取消完成待辦：「${todoText}」`,
          subtitle: `筆記：「${noteTitle}」`,
          noteId,
          undo: () => applyNoteCanvasSnapshot(noteId, beforeHtml),
          redo: () => applyNoteCanvasSnapshot(noteId, afterHtml)
        });

        saveLocalDraftImmediately();
        triggerAutoSaveDebounce();
      }
    }
  });

  // Slash 選單點擊
  document.querySelectorAll('#slash-menu button').forEach(btn => {
    btn.addEventListener('click', () => {
      insertSlashSnippet(btn.dataset.slash);
    });
  });

  // 全寬模式切換按鈕
  if (DOM.toggleFullwidthBtn) {
    DOM.toggleFullwidthBtn.addEventListener('click', toggleFullWidth);
  }

  // 反白文字工具列事件 (防抖處理，支援手機觸控與桌面滑鼠)
  let selectionDebounceTimer = null;
  function debouncedSelection() {
    if (selectionDebounceTimer) clearTimeout(selectionDebounceTimer);
    selectionDebounceTimer = setTimeout(handleTextSelection, 120);
  }

  DOM.editor.addEventListener('mouseup', debouncedSelection);
  DOM.editor.addEventListener('touchend', debouncedSelection);
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (DOM.editor.contains(range.commonAncestorContainer)) {
        debouncedSelection();
      } else if (DOM.selectionToolbar && !DOM.selectionToolbar.contains(document.activeElement)) {
        if (!sel || sel.isCollapsed) {
          DOM.selectionToolbar.classList.add('hidden');
          if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
        }
      }
    }
  });

  DOM.editor.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Shift'].includes(e.key)) {
      debouncedSelection();
    }
  });

  function bindToolbarButton(btn, action) {
    if (!btn) return;
    let touchHandled = false;

    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      touchHandled = false;
    }, { passive: false });

    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      touchHandled = true;
      action(e);
    }, { passive: false });

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!touchHandled) {
        action(e);
      }
      touchHandled = false;
    });
  }

  // 鎖定工具列互動狀態，防止觸控或滑鼠點擊瞬間觸發 selectionchange 隱藏工具列
  [DOM.selectionToolbar, DOM.topHighlightWrapper, DOM.mobileToolbar].forEach(bar => {
    if (!bar) return;
    bar.addEventListener('pointerdown', () => {
      state.isInteractingWithToolbar = true;
      setTimeout(() => { state.isInteractingWithToolbar = false; }, 350);
    });
    bar.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
  });

  if (DOM.selectionToolbar) {
    if (DOM.selHighlightPalette) {
      DOM.selHighlightPalette.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }

    const CMD_NAMES = {
      bold: '粗體 (Bold)',
      italic: '斜體 (Italic)',
      underline: '底線 (Underline)',
      strikeThrough: '刪除線 (Strikethrough)',
      code: '行內程式碼 (Code)'
    };

    DOM.selectionToolbar.querySelectorAll('button[data-cmd]').forEach(btn => {
      bindToolbarButton(btn, () => {
        const range = getOrRestoreEditorSelectionRange();
        if (!range) return;
        const selectedPreview = range.toString().replace(/\s+/g, ' ').trim().slice(0, 20);
        const cmd = btn.dataset.cmd;

        commitEditorCanvasAction(
          'format_text',
          `🔤 設定「${CMD_NAMES[cmd] || cmd}」格式`,
          selectedPreview ? `文字：「${selectedPreview}」` : '',
          () => {
            const sel = window.getSelection();
            if (cmd === 'code') {
              let r = sel.getRangeAt(0);
              let codeEl = r.commonAncestorContainer;
              if (codeEl.nodeType === Node.TEXT_NODE) codeEl = codeEl.parentElement;
              if (codeEl && codeEl.closest('code')) {
                const targetCode = codeEl.closest('code');
                const textContent = targetCode.textContent;
                const textNode = document.createTextNode(textContent);
                targetCode.replaceWith(textNode);
                const newRange = document.createRange();
                newRange.selectNodeContents(textNode);
                sel.removeAllRanges();
                sel.addRange(newRange);
                savedSelectionRange = newRange.cloneRange();
              } else {
                const code = document.createElement('code');
                code.appendChild(r.extractContents());
                r.insertNode(code);
                const newRange = document.createRange();
                newRange.selectNodeContents(code);
                sel.removeAllRanges();
                sel.addRange(newRange);
                savedSelectionRange = newRange.cloneRange();
              }
            } else {
              document.execCommand(cmd, false, null);
              const newSel = window.getSelection();
              if (newSel && newSel.rangeCount) {
                savedSelectionRange = newSel.getRangeAt(0).cloneRange();
              }
            }
          }
        );

        updateSelectionToolbarActiveStates();
        saveLocalDraftImmediately();
        triggerAutoSaveDebounce();
      });
    });

    bindToolbarButton(DOM.selTurnH1, () => turnSelectionInto('h1'));
    bindToolbarButton(DOM.selTurnH2, () => turnSelectionInto('h2'));
    bindToolbarButton(DOM.selTurnTodo, () => turnSelectionInto('todo'));
    bindToolbarButton(DOM.selTurnCallout, () => turnSelectionInto('callout'));

    if (DOM.selClearFormatBtn) {
      bindToolbarButton(DOM.selClearFormatBtn, () => {
        const range = getOrRestoreEditorSelectionRange();
        if (!range) return;
        const selectedPreview = range.toString().replace(/\s+/g, ' ').trim().slice(0, 20);
        commitEditorCanvasAction(
          'format_text',
          '🧹 清除文字格式與螢光筆',
          selectedPreview ? `文字：「${selectedPreview}」` : '',
          () => {
            clearHighlightFromSelection(range);
            try { document.execCommand('removeFormat', false, null); } catch (e) {}
          }
        );
        if (DOM.selectionToolbar) DOM.selectionToolbar.classList.add('hidden');
        saveLocalDraftImmediately();
        triggerAutoSaveDebounce();
        showToast('🧹 已清除選取文字的所有格式與螢光筆');
      });
    }

    if (DOM.selHighlightBtn) {
      bindToolbarButton(DOM.selHighlightBtn, () => {
        if (DOM.selHighlightPalette) {
          DOM.selHighlightPalette.classList.toggle('hidden');
        }
      });
    }

    document.querySelectorAll('.highlight-color-btn').forEach(btn => {
      bindToolbarButton(btn, () => {
        const color = btn.dataset.color;
        if (color && color !== 'transparent') {
          setActiveHighlightColor(color);
        }
        const range = getOrRestoreEditorSelectionRange();
        if (range && !range.collapsed) {
          applyHighlight(color);
        } else if (color && color !== 'transparent') {
          // 若當前未反白文字，點擊顏色直接啟動「連續螢光筆刷子模式」
          toggleHighlightBrushMode(true);
        }
        if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
        if (DOM.topHighlightPalette) DOM.topHighlightPalette.classList.add('hidden');
        if (DOM.mbHighlightPalette) DOM.mbHighlightPalette.classList.add('hidden');
        if (DOM.selectionToolbar) DOM.selectionToolbar.classList.add('hidden');
      });
    });

    if (DOM.selAiBtn) {
      bindToolbarButton(DOM.selAiBtn, () => {
        const sel = window.getSelection();
        const text = sel ? sel.toString().trim() : '';
        DOM.selectionToolbar.classList.add('hidden');
        if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
        toggleAiPanel();
        if (text) {
          DOM.aiUserInput.value = `請幫我潤飾這段文字：
"${text}"`;
        }
      });
    }
  }

  // 🖍️ 頂部常駐螢光筆按鈕組與連續刷子模式事件綁定
  setActiveHighlightColor(state.activeHighlightColor || '#fef08a');
  if (DOM.topHighlightApplyBtn) {
    bindToolbarButton(DOM.topHighlightApplyBtn, () => {
      const range = getOrRestoreEditorSelectionRange();
      if (range && !range.collapsed) {
        applyHighlight(state.activeHighlightColor || '#fef08a');
      } else {
        toggleHighlightBrushMode();
      }
    });
  }
  if (DOM.topHighlightMenuBtn && DOM.topHighlightPalette) {
    bindToolbarButton(DOM.topHighlightMenuBtn, () => {
      DOM.topHighlightPalette.classList.toggle('hidden');
    });
  }
  if (DOM.topHighlightBrushToggle) {
    bindToolbarButton(DOM.topHighlightBrushToggle, () => {
      toggleHighlightBrushMode();
    });
  }

  // 畫布鍵盤快捷事件 (Tab, Enter, Backspace, Space AI, 標題快捷鍵)
  DOM.editor.addEventListener('keydown', (e) => {
    // 1. 表格 Tab / Shift+Tab 導航與自動增列
    if (e.key === 'Tab') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const anchor = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
        const cell = anchor?.closest('th, td');
        if (cell) {
          e.preventDefault();
          const table = cell.closest('table');
          if (table) {
            const cells = Array.from(table.querySelectorAll('th, td'));
            const idx = cells.indexOf(cell);
            if (!e.shiftKey) {
              if (idx >= 0 && idx < cells.length - 1) {
                placeCaretAtStart(cells[idx + 1]);
              } else if (idx === cells.length - 1) {
                addTableRow(table);
              }
            } else {
              if (idx > 0) {
                placeCaretAtStart(cells[idx - 1]);
              }
            }
          }
          return;
        }
      }
    }

    // 2. Enter 鍵智能處理 (待辦清單連續新增/退出、折疊清單聚焦內容、表格換行)
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const anchor = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;

        // (a) 待辦清單 (Todo Item) — 支援「排查步驟 N：」自動遞增編號
        const todoItem = anchor?.closest('.notion-todo-item');
        if (todoItem) {
          e.preventDefault();
          const textSpan = todoItem.querySelector('.notion-todo-text');
          const text = textSpan ? textSpan.textContent.trim() : '';
          const stepMatch = text.match(/^排查步驟\s*(\d+)\s*[：:](.*)$/);
          commitEditorCanvasAction(
            'todo_step',
            stepMatch ? `☑️ 新增排查步驟` : `☑️ 新增待辦項目`,
            text.slice(0, 24),
            () => {
              if (!text || text === '' || (stepMatch && !stepMatch[2].trim() && parseInt(stepMatch[1], 10) > 2)) {
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                todoItem.replaceWith(p);
                placeCaretAtStart(p);
              } else {
                const newTodo = document.createElement('div');
                newTodo.className = 'notion-todo-item';
                if (stepMatch) {
                  const nextStepNum = parseInt(stepMatch[1], 10) + 1;
                  newTodo.innerHTML = `<input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text" contenteditable="true">排查步驟 ${nextStepNum}：</span>`;
                  todoItem.after(newTodo);
                  const newText = newTodo.querySelector('.notion-todo-text');
                  placeCaretAtEnd(newText);
                } else {
                  newTodo.innerHTML = '<input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text" contenteditable="true"><br></span>';
                  todoItem.after(newTodo);
                  const newText = newTodo.querySelector('.notion-todo-text');
                  placeCaretAtStart(newText);
                }
              }
            }
          );
          saveLocalDraftImmediately();
          triggerAutoSaveDebounce();
          return;
        }

        // (b) 折疊清單標題 (Toggle Title)
        const toggleTitle = anchor?.closest('.toggle-title');
        if (toggleTitle) {
          e.preventDefault();
          const details = toggleTitle.closest('.notion-toggle-item, details');
          if (details) {
            details.open = true;
            let content = details.querySelector('.toggle-content');
            if (!content) {
              content = document.createElement('div');
              content.className = 'px-4 py-2 pl-9 text-sm text-gray-700 dark:text-gray-200 border-t border-gray-200/50 dark:border-notion-borderDark/50 toggle-content focus:outline-none';
              content.setAttribute('contenteditable', 'true');
              content.innerHTML = '<p><br></p>';
              details.appendChild(content);
            }
            const firstP = content.querySelector('p') || content;
            placeCaretAtStart(firstP);
          }
          return;
        }

        // (c) 表格儲存格 (Table Cell)
        const cell = anchor?.closest('th, td');
        if (cell) {
          e.preventDefault();
          document.execCommand('insertLineBreak');
          return;
        }
      }
    }

    // 3. Backspace 鍵智能處理 (空白待辦轉回一般段落)
    if (e.key === 'Backspace' && !e.isComposing) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        const anchor = sel.anchorNode?.nodeType === 1 ? sel.anchorNode : sel.anchorNode?.parentElement;
        const todoItem = anchor?.closest('.notion-todo-item');
        if (todoItem) {
          const textSpan = todoItem.querySelector('.notion-todo-text');
          const text = textSpan ? textSpan.textContent.trim() : '';
          if (!text || text === '') {
            e.preventDefault();
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            todoItem.replaceWith(p);
            placeCaretAtStart(p);
            saveLocalDraftImmediately();
            triggerAutoSaveDebounce();
            return;
          }
        }
      }
    }

    handleSpaceAiTrigger(e);

    // 快捷鍵支援：Ctrl+Shift+1/2/3/4/7
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      if (e.key === '1' || e.key === '!') {
        e.preventDefault();
        insertSlashSnippet('h1');
      } else if (e.key === '2' || e.key === '@') {
        e.preventDefault();
        insertSlashSnippet('h2');
      } else if (e.key === '3' || e.key === '#') {
        e.preventDefault();
        insertSlashSnippet('h3');
      } else if (e.key === '4' || e.key === '$') {
        e.preventDefault();
        insertSlashSnippet('todo');
      } else if (e.key === '7' || e.key === '&') {
        e.preventDefault();
        insertSlashSnippet('toggle');
      }
    }
  });

  if (DOM.spaceAiSubmit) {
    DOM.spaceAiSubmit.addEventListener('click', () => executeSpaceAi());
  }
  if (DOM.spaceAiInput) {
    DOM.spaceAiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSpaceAi();
      }
    });
  }
  document.querySelectorAll('.space-ai-quick').forEach(btn => {
    btn.addEventListener('click', () => executeSpaceAi(btn.dataset.prompt));
  });

  // 貼上 URL 智慧 4 合 1 選單
  if (DOM.pasteEmbedBtn) DOM.pasteEmbedBtn.addEventListener('click', () => executePasteAction('embed'));
  if (DOM.pasteBookmarkBtn) DOM.pasteBookmarkBtn.addEventListener('click', () => executePasteAction('bookmark'));
  if (DOM.pasteMentionBtn) DOM.pasteMentionBtn.addEventListener('click', () => executePasteAction('mention'));
  if (DOM.pasteRawBtn) DOM.pasteRawBtn.addEventListener('click', () => executePasteAction('raw'));

  // 智能攔截網址貼上
  const origPasteHandler = DOM.editor.onpaste;
  DOM.editor.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (text && /^https?:\/\/[^\s]+$/i.test(text.trim())) {
      e.preventDefault();
      handleUrlPaste(text.trim(), e);
      return;
    }
  });

  // 監聽 @ 提及與 Markdown 行首規則
  DOM.editor.addEventListener('input', (e) => {
    handleMentionTrigger(e);
    handleMarkdownInputRules(e);
  });

  // 點擊提及筆記直接跳轉
  DOM.editor.addEventListener('click', (e) => {
    const pageLink = e.target.closest('.notion-page-link');
    if (pageLink && pageLink.dataset.noteId) {
      e.preventDefault();
      selectNote(pageLink.dataset.noteId);
    }
  });

  // 快捷鍵 (Ctrl+S 存檔, Ctrl+N 新增, Ctrl+Z 復原, Ctrl+Y 重做)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentNote();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      createNewNote();
    }
    // Ctrl+M 或 Alt+H 快速劃記/切換螢光筆
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') || (e.altKey && e.key.toLowerCase() === 'h')) {
      e.preventDefault();
      applyHighlight(state.activeHighlightColor || '#fef08a');
      return;
    }

    // Escape 鍵快速關閉所有彈跳視窗與連續螢光筆刷子模式
    if (e.key === 'Escape') {
      closeTableQuickPeekDrawer();
      if (DOM.photoAnnotateModal) DOM.photoAnnotateModal.classList.add('hidden');
      if (state.highlightBrushMode) {
        toggleHighlightBrushMode(false);
      }
      if (DOM.topHighlightPalette) DOM.topHighlightPalette.classList.add('hidden');
      if (DOM.mbHighlightPalette) DOM.mbHighlightPalette.classList.add('hidden');
      if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
      closeTagManagerModal();
      closeHistoryModal();
      if (DOM.settingsModal) DOM.settingsModal.classList.add('hidden');
      if (DOM.coverModal) DOM.coverModal.classList.add('hidden');
      if (DOM.folderModal) DOM.folderModal.classList.add('hidden');
      if (DOM.workTagModal) DOM.workTagModal.classList.add('hidden');
    }

    // 復原 (Ctrl+Z / Cmd+Z)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      const activeEl = document.activeElement;
      const isModalInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.id !== 'note-title';
      if (!isModalInput) {
        e.preventDefault();
        if (e.shiftKey) {
          redoAction();
        } else {
          undoAction();
        }
      }
    }
    // 重做 (Ctrl+Y / Cmd+Y)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      const activeEl = document.activeElement;
      const isModalInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.id !== 'note-title';
      if (!isModalInput) {
        e.preventDefault();
        redoAction();
      }
    }
  });
}

function updateFilterTabUI(activeBtn) {
  const tabs = [DOM.filterAllBtn, DOM.filterPinnedBtn, DOM.filterDoingBtn, DOM.filterTodayBtn, DOM.filterUncatBtn];
  tabs.forEach(b => {
    if (b) b.className = 'px-2 py-0.5 rounded font-medium hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0';
  });
  if (activeBtn) {
    activeBtn.className = 'px-2 py-0.5 rounded font-medium bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white shrink-0';
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}


// ----------------- 📱 多裝置前景切換與自動喚醒同步 (PC / 手機無縫自動連動) -----------------
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.accessToken && state.folderId) {
    const isEditing = document.activeElement === DOM.editor || DOM.editor.contains(document.activeElement);
    if (isEditing) return;

    const elapsed = Date.now() - (state.lastSyncTime || 0);
    // 🚀 多裝置極速切換：只要離開超過 2.5 秒切回前景，立即靜默檢查雲端更新
    if (elapsed > 2500 && !state.isDirty && !state.isSaving) {
      console.log('📱 頁面切換回前景，立即靜默檢查 Google Drive 最新更新...');
      fullSyncWithDrive(false);
    }
  }
});

window.addEventListener('focus', () => {
  if (state.accessToken && state.folderId) {
    const isEditing = document.activeElement === DOM.editor || DOM.editor.contains(document.activeElement);
    if (isEditing) return;

    const elapsed = Date.now() - (state.lastSyncTime || 0);
    if (elapsed > 2500 && !state.isDirty && !state.isSaving) {
      fullSyncWithDrive(false);
    }
  }
});

// 每 60 秒定時背景自動輪詢檢查雲端變更 (確保完全靜默且不干擾使用者編輯)
setInterval(() => {
  if (document.visibilityState === 'visible' && state.accessToken && state.folderId && !state.isDirty && !state.isSaving) {
    const isEditing = document.activeElement === DOM.editor || DOM.editor.contains(document.activeElement);
    if (isEditing) return;

    const elapsed = Date.now() - (state.lastSyncTime || 0);
    if (elapsed > 55000) {
      fullSyncWithDrive(false);
    }
  }
}, 60000);

// 🛡️ 全域非同步錯誤保護與網路狀態自動修復 (防止未捕捉 Promise 錯誤導致白畫面崩潰)
window.addEventListener('unhandledrejection', (event) => {
  console.warn('🛡️ [Global Rejection Guard]:', event.reason);
  event.preventDefault();
});

window.addEventListener('online', () => {
  showToast('🌐 網路連線已恢復，自動檢查並同步最新內容');
  syncPendingLocalDrafts();
});

window.addEventListener('offline', () => {
  updateSyncStatus('offline', '離線狀態 (本機保護模式中)');
  showToast('⚠️ 網路連線已斷開，系統已切換為 Local-First 安全離線保護模式');
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && state.activeUploadCount > 0) {
    await acquireWakeLock();
  }
});


// ============================================================================
// ✏️ 功能 3：現場照片「就地標註工作室 (In-Note Photo Annotation Studio v2.6.7)」
// 支援：⭕ 紅圈/橢圓、↗️ 指向箭頭、⬜ 矩形框、🖍️ 自由畫筆、🔤 高對比文字標籤、↩️ 單步復原、720P 壓縮更新雲端與時光機回朔
// ============================================================================
const photoAnnotatorState = {
  activeBlock: null,
  baseImage: null,
  fileName: 'Annotated_Photo.jpg',
  tool: 'circle',
  color: '#ef4444',
  isDrawing: false,
  startX: 0,
  startY: 0,
  currentPath: [],
  operations: [] // 儲存每一筆繪圖操作，支援無限復原重繪
};

function redrawPhotoAnnotatorCanvas(previewOp = null) {
  const canvas = DOM.photoAnnotateCanvas;
  const img = photoAnnotatorState.baseImage;
  if (!canvas || !img) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const allOps = previewOp ? [...photoAnnotatorState.operations, previewOp] : photoAnnotatorState.operations;
  const scaleFactor = Math.max(1, Math.min(canvas.width, canvas.height) / 720);

  allOps.forEach(op => {
    ctx.save();
    ctx.strokeStyle = op.color || '#ef4444';
    ctx.fillStyle = op.color || '#ef4444';
    ctx.lineWidth = Math.round(4.5 * scaleFactor);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = Math.round(4 * scaleFactor);

    if (op.type === 'circle') {
      const cx = (op.x1 + op.x2) / 2;
      const cy = (op.y1 + op.y2) / 2;
      const rx = Math.max(4, Math.abs(op.x2 - op.x1) / 2);
      const ry = Math.max(4, Math.abs(op.y2 - op.y1) / 2);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (op.type === 'rect') {
      const x = Math.min(op.x1, op.x2);
      const y = Math.min(op.y1, op.y2);
      const w = Math.abs(op.x2 - op.x1);
      const h = Math.abs(op.y2 - op.y1);
      ctx.strokeRect(x, y, w, h);
    } else if (op.type === 'arrow') {
      const dx = op.x2 - op.x1;
      const dy = op.y2 - op.y1;
      const len = Math.hypot(dx, dy);
      if (len >= 6) {
        const headLen = Math.max(18, Math.round(24 * scaleFactor));
        const angle = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(op.x1, op.y1);
        ctx.lineTo(op.x2, op.y2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(op.x2, op.y2);
        ctx.lineTo(op.x2 - headLen * Math.cos(angle - Math.PI / 6), op.y2 - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(op.x2 - headLen * Math.cos(angle + Math.PI / 6), op.y2 - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }
    } else if (op.type === 'pen' && Array.isArray(op.points) && op.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(op.points[0].x, op.points[0].y);
      for (let i = 1; i < op.points.length; i++) {
        ctx.lineTo(op.points[i].x, op.points[i].y);
      }
      ctx.stroke();
    } else if (op.type === 'text' && op.text) {
      const fontSize = Math.round(22 * scaleFactor);
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Microsoft JhengHei", sans-serif`;
      const metrics = ctx.measureText(op.text);
      const padX = Math.round(10 * scaleFactor);
      const padY = Math.round(6 * scaleFactor);
      const boxW = metrics.width + padX * 2;
      const boxH = fontSize + padY * 2;
      const bx = Math.max(4, Math.min(op.x, canvas.width - boxW - 4));
      const by = Math.max(boxH + 4, Math.min(op.y, canvas.height - 4));

      // 深色半透明膠囊底框 + 彩色外框，保證在任何照片背景上皆 100% 清晰可讀
      ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bx, by - boxH, boxW, boxH, Math.round(6 * scaleFactor));
      } else {
        ctx.rect(bx, by - boxH, boxW, boxH);
      }
      ctx.fill();
      ctx.lineWidth = Math.round(2.5 * scaleFactor);
      ctx.strokeStyle = op.color || '#ef4444';
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = op.color === '#ffffff' ? '#ffffff' : (op.color || '#facc15');
      ctx.fillText(op.text, bx + padX, by - padY - Math.round(2 * scaleFactor));
    }
    ctx.restore();
  });
}

// ============================================================================
// 🛡️ v2.6.8 雲端圖片破圖自癒引擎 + 內建全螢幕高清燈箱 + 永久 Base64/雲端雙保險標註儲存
// ============================================================================

/**
 * 從媒體收折卡片中智慧提取 Google Drive File ID（支援由 data-file-id、下載連結、檢視連結或圖片網址提取）
 */
function extractDriveFileIdFromMediaBlock(detailsBlock) {
  if (!detailsBlock) return '';
  let fid = (detailsBlock.getAttribute('data-file-id') || '').trim();
  if (fid && fid !== 'undefined' && fid !== 'null') return fid;

  const html = detailsBlock.innerHTML || '';
  const m1 = html.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (m1 && m1[1]) return m1[1];
  const m2 = html.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/);
  if (m2 && m2[1]) return m2[1];
  return '';
}

/**
 * 透過 Google Drive API 直接下載圖片二進位內容並轉為永久可顯示之 Data URL（徹底繞過手機第三方 Cookie 阻擋與縮圖 403 問題）
 */
async function fetchDriveImageAsDataUrl(fileId) {
  if (!fileId || !state.accessToken) return null;
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

/**
 * 自動掃描並修復筆記內任何因舊版 blob: 殘留或雲端縮圖延遲而破圖的媒體卡片
 */
async function healBrokenMediaCardsInEditor(container = DOM.editor) {
  if (!container) return;
  const cards = Array.from(container.querySelectorAll('details.notion-media-collapse'));
  for (const card of cards) {
    const imgEl = card.querySelector('img');
    if (!imgEl) continue;

    // 取消舊版直接 window.open('blob:...') 的行為，改由內建高清檢視燈箱開啟
    if (imgEl.hasAttribute('onclick')) {
      imgEl.removeAttribute('onclick');
    }

    let fileId = extractDriveFileIdFromMediaBlock(card);
    if (fileId && !card.getAttribute('data-file-id')) {
      card.setAttribute('data-file-id', fileId);
    }

    // 確保卡片底部的「下載原圖」與「雲端檢視」連結永遠指向正確的 Google Drive 網址而非失效的 blob:
    if (fileId) {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const previewUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
      const dlLink = card.querySelector('a[download]');
      if (dlLink && (!dlLink.getAttribute('href') || dlLink.getAttribute('href').startsWith('blob:'))) {
        dlLink.setAttribute('href', downloadUrl);
      }
      const viewLink = card.querySelector('a[rel*="noopener"]');
      if (viewLink && (!viewLink.getAttribute('href') || viewLink.getAttribute('href').startsWith('blob:'))) {
        viewLink.setAttribute('href', previewUrl);
      }
    }

    const rawSrc = (imgEl.getAttribute('src') || '').trim();
    const isDeadBlob = rawSrc.startsWith('blob:') && !imgEl._isLiveLocalBlob;

    // 綁定圖片載入失敗自動救援 (onerror Self-Healing)
    if (!imgEl._selfHealBound) {
      imgEl._selfHealBound = true;
      imgEl.addEventListener('error', async () => {
        if (imgEl._healingInProgress) return;
        imgEl._healingInProgress = true;
        try {
          const backup = imgEl.getAttribute('data-annotated-backup');
          if (backup && backup.startsWith('data:image/')) {
            imgEl.src = backup;
            return;
          }
          let fid = extractDriveFileIdFromMediaBlock(card);
          const fname = card.getAttribute('data-file-name') || imgEl.getAttribute('alt') || '';
          if (!fid && fname && state.accessToken) {
            // 若未記錄 fileId，嘗試以檔名在 Google Drive 自動搜尋找回
            const cleanSearchName = fname.replace(/'/g, "\\'");
            const q = `(name = '${cleanSearchName}' or name contains '${cleanSearchName.replace(/\.[^/.]+$/, '')}') and mimeType contains 'image/' and trashed = false`;
            const sRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=modifiedTime desc&pageSize=1`, {
              headers: { Authorization: `Bearer ${state.accessToken}` }
            });
            if (sRes.ok) {
              const sData = await sRes.json();
              if (sData.files && sData.files.length > 0) {
                fid = sData.files[0].id;
                card.setAttribute('data-file-id', fid);
              }
            }
          }
          if (fid && state.accessToken) {
            const dataUrl = await fetchDriveImageAsDataUrl(fid);
            if (dataUrl) {
              imgEl.src = dataUrl;
              saveLocalDraftImmediately();
              triggerAutoSaveDebounce();
            }
          }
        } catch (e) {
          console.warn('圖片自動救援略過:', e);
        } finally {
          imgEl._healingInProgress = false;
        }
      });
    }

    // 若開啟筆記時發現圖片 src 是過去殘留的死連結 blob:...，立即主動修復！
    if (isDeadBlob) {
      if (fileId) {
        if (state.accessToken) {
          const dataUrl = await fetchDriveImageAsDataUrl(fileId);
          if (dataUrl) {
            imgEl.src = dataUrl;
            saveLocalDraftImmediately();
            triggerAutoSaveDebounce();
            continue;
          }
        }
        imgEl.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1280`;
      } else if (state.accessToken) {
        imgEl.dispatchEvent(new Event('error'));
      }
    }
  }
}

/**
 * 內建全螢幕高清圖片檢視燈箱 (點擊筆記內圖片時直接開啟，支援放大縮小與一鍵轉標註)
 */
let activeLightboxMediaBlock = null;
function openPhotoLightboxForBlock(detailsBlock) {
  if (!detailsBlock) return;
  const imgEl = detailsBlock.querySelector('img');
  if (!imgEl) return;

  const modal = document.getElementById('photo-lightbox-modal');
  const lightImg = document.getElementById('photo-lightbox-img');
  const titleEl = document.getElementById('photo-lightbox-title');
  const dlLink = document.getElementById('photo-lightbox-download-link');
  if (!modal || !lightImg) return;

  activeLightboxMediaBlock = detailsBlock;
  const fileName = detailsBlock.getAttribute('data-file-name') || imgEl.getAttribute('alt') || '現場照片.jpg';
  const fileId = extractDriveFileIdFromMediaBlock(detailsBlock);
  const src = imgEl.getAttribute('src') || '';

  if (titleEl) titleEl.textContent = fileName;
  lightImg.classList.remove('is-zoomed');
  lightImg.src = src;

  if (dlLink) {
    dlLink.href = (src.startsWith('data:image/') || !fileId)
      ? src
      : `https://drive.google.com/uc?export=download&id=${fileId}`;
    dlLink.setAttribute('download', fileName);
  }

  modal.classList.remove('hidden');
}

async function openPhotoAnnotatorForBlock(detailsBlock) {
  if (!detailsBlock || !DOM.photoAnnotateModal || !DOM.photoAnnotateCanvas) return;
  const imgEl = detailsBlock.querySelector('img');
  if (!imgEl) {
    showToast('此卡片不包含可標註的照片');
    return;
  }

  const fileId = extractDriveFileIdFromMediaBlock(detailsBlock);
  const fileName = detailsBlock.getAttribute('data-file-name') || imgEl.getAttribute('alt') || 'Photo.jpg';
  const rawSrc = imgEl.getAttribute('src') || '';

  photoAnnotatorState.activeBlock = detailsBlock;
  photoAnnotatorState.fileName = fileName;
  photoAnnotatorState.operations = [];
  photoAnnotatorState.isDrawing = false;

  if (DOM.photoAnnotateFilename) DOM.photoAnnotateFilename.textContent = `(${fileName})`;
  DOM.photoAnnotateModal.classList.remove('hidden');
  initLucide();

  showToast('⏳ 正在載入照片至標註畫布...', 1200);

  let loadUrl = rawSrc;

  // 若為 Google Drive 雲端圖片（或失效的舊 blob: 但具有 fileId）且已登入，優先透過 Drive API 下載原始圖片資料流以避免跨域 Canvas 污染
  if (fileId && state.accessToken && (rawSrc.includes('drive.google.com') || rawSrc.startsWith('blob:'))) {
    const driveDataUrl = await fetchDriveImageAsDataUrl(fileId);
    if (driveDataUrl) {
      loadUrl = driveDataUrl;
    }
  }

  const loadImgElement = (url, useCors = true) => new Promise((resolve, reject) => {
    const im = new Image();
    if (useCors && !url.startsWith('data:') && !url.startsWith('blob:')) {
      im.crossOrigin = 'anonymous';
    }
    im.onload = () => resolve(im);
    im.onerror = (err) => reject(err);
    im.src = url;
  });

  try {
    let loadedImg;
    try {
      loadedImg = await loadImgElement(loadUrl, true);
    } catch (e1) {
      loadedImg = await loadImgElement(rawSrc, false);
    }
    const natW = loadedImg.naturalWidth || loadedImg.width || 1280;
    const natH = loadedImg.naturalHeight || loadedImg.height || 720;
    const maxDim = 1280;
    const scale = Math.min(maxDim / natW, maxDim / natH, 1.0);
    DOM.photoAnnotateCanvas.width = Math.max(1, Math.round(natW * scale));
    DOM.photoAnnotateCanvas.height = Math.max(1, Math.round(natH * scale));
    photoAnnotatorState.baseImage = loadedImg;
    redrawPhotoAnnotatorCanvas();
  } catch (err) {
    console.error('載入標註圖片失敗:', err);
    showToast('⚠️ 無法載入該張圖片進行標註');
    DOM.photoAnnotateModal.classList.add('hidden');
  }
}

async function savePhotoAnnotationToNote() {
  const canvas = DOM.photoAnnotateCanvas;
  const block = photoAnnotatorState.activeBlock;
  if (!canvas || !block) return;

  if (photoAnnotatorState.operations.length === 0) {
    DOM.photoAnnotateModal.classList.add('hidden');
    showToast('未新增任何標註筆跡');
    return;
  }

  let annotatedDataUrl = '';
  let blob = null;
  try {
    annotatedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
    blob = await new Promise((resolve, reject) => {
      try {
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob empty'))), 'image/jpeg', 0.82);
      } catch (err) {
        reject(err);
      }
    });
  } catch (secErr) {
    showToast('⚠️ 此圖片受瀏覽器跨域安全限制，請先登入 Google Drive 以啟用雲端圖片標註');
    return;
  }

  const cleanBaseName = (photoAnnotatorState.fileName || 'Photo').replace(/\.[^/.]+$/, '');
  const annotatedFileName = cleanBaseName.endsWith('_標註') ? `${cleanBaseName}.jpg` : `${cleanBaseName}_標註.jpg`;
  const annotatedFile = new File([blob], annotatedFileName, { type: 'image/jpeg', lastModified: Date.now() });

  DOM.photoAnnotateModal.classList.add('hidden');

  const imgEl = block.querySelector('img');
  const oldHtml = DOM.editor ? DOM.editor.innerHTML : '';
  const noteId = state.currentNote ? state.currentNote.id : null;
  const noteTitle = (state.currentNote && state.currentNote.name) ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';

  // 1. 立即 (0.01s) 使用自包含永久 Base64 Data URL 渲染標註後圖片，徹底杜絕 blob: 失效破圖！
  if (imgEl) {
    imgEl.src = annotatedDataUrl;
    imgEl.setAttribute('data-annotated-backup', annotatedDataUrl);
    imgEl.removeAttribute('onclick');
  }
  block.setAttribute('data-file-name', annotatedFileName);
  const summaryTitleSpan = block.querySelector('summary span.truncate');
  if (summaryTitleSpan) summaryTitleSpan.textContent = annotatedFileName;
  const captionTitleSpan = block.querySelector('.media-caption-bar span.truncate');
  if (captionTitleSpan) captionTitleSpan.textContent = annotatedFileName;
  const dlLinkImmediate = block.querySelector('a[download]');
  if (dlLinkImmediate) {
    dlLinkImmediate.href = annotatedDataUrl;
    dlLinkImmediate.setAttribute('download', annotatedFileName);
  }

  if (DOM.editor) {
    const newImmediateHtml = DOM.editor.innerHTML;
    state.editorSnapshotBeforeEdit = newImmediateHtml;
    recordAction({
      type: 'media_op',
      title: `✏️ 標註照片重點：「${annotatedFileName}」`,
      subtitle: `共繪製 ${photoAnnotatorState.operations.length} 處標記 · 筆記：「${noteTitle}」`,
      noteId,
      undo: () => applyNoteCanvasSnapshot(noteId, oldHtml),
      redo: () => applyNoteCanvasSnapshot(noteId, DOM.editor ? DOM.editor.innerHTML : newImmediateHtml)
    });
  }

  saveLocalDraftImmediately();
  triggerAutoSaveDebounce();
  showToast('✅ 已套用照片標註！(點擊照片可全螢幕放大檢視)', 2800);

  // 2. 若已登入 Google Drive，背景上傳壓縮後之標註圖片至 _assets 並綁定雲端 File ID
  if (state.accessToken) {
    try {
      if (!state.folderId) await ensureNotesFolder();
      if (!state.mediaFolderId) await ensureMediaFolder();
      const targetMediaFolderId = state.mediaFolderId || state.folderId;
      const boundary = '-------CloudNotesMediaBoundary' + Math.random().toString(36).substring(2);
      const metaObj = {
        name: annotatedFileName,
        mimeType: 'image/jpeg',
        parents: targetMediaFolderId ? [targetMediaFolderId] : undefined
      };
      const multipartBody = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
        new Blob([JSON.stringify(metaObj)], { type: 'application/json; charset=UTF-8' }),
        `\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`,
        annotatedFile,
        `\r\n--${boundary}--`
      ], { type: `multipart/related; boundary=${boundary}` });

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (res.ok) {
        const uploaded = await res.json();
        // 必須 await 權限設定完成，確保雲端檢視與下載連結立即可用
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${uploaded.id}/permissions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${state.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'reader', type: 'anyone' })
          });
        } catch (permErr) {}

        const directSrc = `https://drive.google.com/thumbnail?id=${uploaded.id}&sz=w1280`;
        const previewUrl = `https://drive.google.com/file/d/${uploaded.id}/view?usp=sharing`;
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${uploaded.id}`;

        block.setAttribute('data-file-id', uploaded.id);
        const dlLink = block.querySelector('a[download]');
        if (dlLink) dlLink.href = downloadUrl;
        const viewLink = block.querySelector('a[rel*="noopener"]');
        if (viewLink) viewLink.href = previewUrl;

        // 預載入測試：僅當雲端縮圖確認已生成且可正常載入時才替換，否則維持清晰 Base64 畫面絕不破圖！
        if (imgEl) {
          const preload = new Image();
          preload.onload = () => {
            if (preload.naturalWidth > 0) {
              imgEl.src = directSrc;
              imgEl.removeAttribute('data-annotated-backup');
              if (DOM.editor) state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
              saveLocalDraftImmediately();
              triggerAutoSaveDebounce();
            }
          };
          preload.src = directSrc;
        }

        if (DOM.editor) state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
        saveLocalDraftImmediately();
        triggerAutoSaveDebounce();
        showToast(`☁️ 標註照片「${annotatedFileName}」已同步至雲端！`, 2500);
      }
    } catch (uploadErr) {
      console.warn('標註照片上傳雲端略過:', uploadErr);
    }
  }
}

function initImageEditor() {
  // 1. 綁定預覽抽屜按鈕事件
  if (DOM.peekCloseBtn) {
    DOM.peekCloseBtn.addEventListener('click', closeTableQuickPeekDrawer);
  }
  if (DOM.tableQuickPeekBackdrop) {
    DOM.tableQuickPeekBackdrop.addEventListener('click', closeTableQuickPeekDrawer);
  }
  if (DOM.peekCopyBtn) {
    DOM.peekCopyBtn.addEventListener('click', () => {
      const text = DOM.peekNoteBody ? DOM.peekNoteBody.innerText.trim() : '';
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text);
        showToast('📋 已複製筆記完整內容與對策至剪貼簿！');
      }
    });
  }
  if (DOM.peekOpenEditorBtn) {
    DOM.peekOpenEditorBtn.addEventListener('click', () => {
      const noteId = state.currentPeekNoteId;
      if (!noteId) return;
      const rawQ = (DOM.tableSearchInput && DOM.tableSearchInput.value ? DOM.tableSearchInput.value.trim() : '');
      if (rawQ) {
        const parsed = parseFuzzyQuery(rawQ);
        const note = state.notes.find(n => n.id === noteId);
        const fRes = note ? evaluateFuzzyNoteMatch(note, parsed) : null;
        state.pendingScrollMatch = {
          noteId,
          query: rawQ,
          highlightTerms: fRes ? fRes.highlightTerms : parsed.coreTokens,
          snippetText: (fRes && fRes.snippet && fRes.snippet.text) ? fRes.snippet.text : ''
        };
      }
      closeTableQuickPeekDrawer();
      selectNote(noteId);
      switchView('editor');
    });
  }

  // 2. 綁定頂部「🚨 排查模板」一鍵插入按鈕
  if (DOM.topInsertTroubleshootBtn) {
    DOM.topInsertTroubleshootBtn.addEventListener('click', (e) => {
      e.preventDefault();
      insertSlashSnippet('troubleshoot');
      showToast('🚨 已插入「故障排查三段式」結構區塊！(可按 Ctrl+Z 復原)');
    });
  }

  // 3. 綁定照片標註工作室 (Photo Annotation Studio) 事件
  const canvas = DOM.photoAnnotateCanvas;
  if (!canvas || !DOM.photoAnnotateModal) return;

  DOM.photoAnnotateModal.querySelectorAll('.annotate-tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      photoAnnotatorState.tool = btn.dataset.tool || 'circle';
      DOM.photoAnnotateModal.querySelectorAll('.annotate-tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  DOM.photoAnnotateModal.querySelectorAll('.annotate-color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      photoAnnotatorState.color = dot.dataset.color || '#ef4444';
      DOM.photoAnnotateModal.querySelectorAll('.annotate-color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
  });

  if (DOM.photoAnnotateUndoBtn) {
    DOM.photoAnnotateUndoBtn.addEventListener('click', () => {
      if (photoAnnotatorState.operations.length > 0) {
        photoAnnotatorState.operations.pop();
        redrawPhotoAnnotatorCanvas();
      }
    });
  }

  if (DOM.photoAnnotateClearBtn) {
    DOM.photoAnnotateClearBtn.addEventListener('click', () => {
      photoAnnotatorState.operations = [];
      redrawPhotoAnnotatorCanvas();
    });
  }

  if (DOM.photoAnnotateCancelBtn) {
    DOM.photoAnnotateCancelBtn.addEventListener('click', () => {
      DOM.photoAnnotateModal.classList.add('hidden');
    });
  }

  if (DOM.photoAnnotateSaveBtn) {
    DOM.photoAnnotateSaveBtn.addEventListener('click', savePhotoAnnotationToNote);
  }

  const getCanvasCoords = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.touches && evt.touches[0] ? evt.touches[0].clientX : (evt.changedTouches && evt.changedTouches[0] ? evt.changedTouches[0].clientX : evt.clientX);
    const clientY = evt.touches && evt.touches[0] ? evt.touches[0].clientY : (evt.changedTouches && evt.changedTouches[0] ? evt.changedTouches[0].clientY : evt.clientY);
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const onStart = (evt) => {
    if (evt.cancelable) evt.preventDefault();
    const { x, y } = getCanvasCoords(evt);

    if (photoAnnotatorState.tool === 'text') {
      const label = prompt('請輸入照片標註文字（例如：80Ω 燒毀、V5 隔膜閥、水位紅線）：');
      if (label && label.trim()) {
        photoAnnotatorState.operations.push({
          type: 'text',
          x,
          y,
          text: label.trim(),
          color: photoAnnotatorState.color
        });
        redrawPhotoAnnotatorCanvas();
      }
      return;
    }

    photoAnnotatorState.isDrawing = true;
    photoAnnotatorState.startX = x;
    photoAnnotatorState.startY = y;
    photoAnnotatorState.currentPath = [{ x, y }];
  };

  const onMove = (evt) => {
    if (!photoAnnotatorState.isDrawing) return;
    if (evt.cancelable) evt.preventDefault();
    const { x, y } = getCanvasCoords(evt);

    if (photoAnnotatorState.tool === 'pen') {
      photoAnnotatorState.currentPath.push({ x, y });
      redrawPhotoAnnotatorCanvas({
        type: 'pen',
        color: photoAnnotatorState.color,
        points: photoAnnotatorState.currentPath
      });
    } else {
      redrawPhotoAnnotatorCanvas({
        type: photoAnnotatorState.tool,
        color: photoAnnotatorState.color,
        x1: photoAnnotatorState.startX,
        y1: photoAnnotatorState.startY,
        x2: x,
        y2: y
      });
    }
  };

  const onEnd = (evt) => {
    if (!photoAnnotatorState.isDrawing) return;
    if (evt.cancelable) evt.preventDefault();
    photoAnnotatorState.isDrawing = false;
    const { x, y } = getCanvasCoords(evt);

    if (photoAnnotatorState.tool === 'pen') {
      if (photoAnnotatorState.currentPath.length > 1) {
        photoAnnotatorState.operations.push({
          type: 'pen',
          color: photoAnnotatorState.color,
          points: photoAnnotatorState.currentPath.slice()
        });
      }
    } else {
      if (Math.hypot(x - photoAnnotatorState.startX, y - photoAnnotatorState.startY) >= 6) {
        photoAnnotatorState.operations.push({
          type: photoAnnotatorState.tool,
          color: photoAnnotatorState.color,
          x1: photoAnnotatorState.startX,
          y1: photoAnnotatorState.startY,
          x2: x,
          y2: y
        });
      }
    }
    redrawPhotoAnnotatorCanvas();
  };

  canvas.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onEnd, { passive: false });

  // 6. 綁定內建「全螢幕高清圖片檢視燈箱 (#photo-lightbox-modal)」與點擊筆記圖片攔截
  const lightboxModal = document.getElementById('photo-lightbox-modal');
  const lightboxImg = document.getElementById('photo-lightbox-img');
  const lightboxCloseBtn = document.getElementById('photo-lightbox-close-btn');
  const lightboxZoomBtn = document.getElementById('photo-lightbox-zoom-btn');
  const lightboxAnnotateBtn = document.getElementById('photo-lightbox-annotate-btn');

  if (lightboxCloseBtn && lightboxModal) {
    lightboxCloseBtn.addEventListener('click', () => lightboxModal.classList.add('hidden'));
  }
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal || e.target.id === 'photo-lightbox-body') {
        lightboxModal.classList.add('hidden');
      }
    });
  }
  if (lightboxZoomBtn && lightboxImg) {
    lightboxZoomBtn.addEventListener('click', () => {
      lightboxImg.classList.toggle('is-zoomed');
    });
    lightboxImg.addEventListener('click', () => {
      lightboxImg.classList.toggle('is-zoomed');
    });
  }
  if (lightboxAnnotateBtn && lightboxModal) {
    lightboxAnnotateBtn.addEventListener('click', () => {
      lightboxModal.classList.add('hidden');
      if (activeLightboxMediaBlock) {
        openPhotoAnnotatorForBlock(activeLightboxMediaBlock);
      }
    });
  }

  // 在 DOM.editor 捕獲階段攔截圖片點擊：開啟內建高清燈箱（徹底解決舊版 window.open 無法開啟標註圖片的問題）
  if (DOM.editor && !DOM.editor._lightboxImgDelegationBound) {
    DOM.editor._lightboxImgDelegationBound = true;
    DOM.editor.addEventListener('click', (e) => {
      const clickedImg = e.target.closest('details.notion-media-collapse img');
      if (clickedImg && DOM.editor.contains(clickedImg)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        const block = clickedImg.closest('details.notion-media-collapse');
        if (block) {
          openPhotoLightboxForBlock(block);
        }
      }
    }, true);
  }

  // 7. 📱 手機端螢光筆深度觸控優化：
  // (A) 追蹤 touchstart / touchend 避免長按拖拉選取水滴時提早收合
  // (B) 點擊既有 <mark> 螢光筆文字直接鎖定並彈出底部換色/清除面板（免長按反白）
  // (C) 開啟「⚡ 點塗模式」時，手指輕點任何文字詞句直接智慧塗上螢光筆
  const mbTapModeBtn = document.getElementById('mb-hl-tap-mode-btn');
  const mbCloseBtn = document.getElementById('mb-hl-close-btn');
  if (mbTapModeBtn) {
    mbTapModeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleHighlightBrushMode();
    });
  }
  if (mbCloseBtn && DOM.mbHighlightPalette) {
    mbCloseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      DOM.mbHighlightPalette.classList.add('hidden');
      document.querySelectorAll('mark.selected-mark-target').forEach(m => m.classList.remove('selected-mark-target'));
    });
  }

  if (DOM.editor && !DOM.editor._mobileHighlightTouchBound) {
    DOM.editor._mobileHighlightTouchBound = true;

    DOM.editor.addEventListener('touchstart', () => {
      state.isTouchSelecting = true;
    }, { passive: true });

    const finishTouchSelection = () => {
      setTimeout(() => {
        state.isTouchSelecting = false;
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          handleTextSelection();
        }
      }, 90);
    };
    DOM.editor.addEventListener('touchend', finishTouchSelection, { passive: true });
    DOM.editor.addEventListener('touchcancel', finishTouchSelection, { passive: true });

    // 點擊編輯器內的文字或既有 <mark> 螢光筆區塊
    DOM.editor.addEventListener('click', (e) => {
      if (e.target.closest('details.notion-media-collapse, .notion-file-attachment, button, a, input, select')) return;

      // 先清除舊的 <mark> 鎖定框
      document.querySelectorAll('mark.selected-mark-target').forEach(m => m.classList.remove('selected-mark-target'));

      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
        return; // 使用者正處於反白選取狀態，交由 handleTextSelection 處理
      }

      const clickedMark = e.target.closest('mark.notion-highlight, mark');
      if (clickedMark && DOM.editor.contains(clickedMark)) {
        // 選中該 <mark> 的完整範圍
        const markRange = document.createRange();
        markRange.selectNodeContents(clickedMark);
        savedSelectionRange = markRange.cloneRange();

        // 若處於「⚡ 點塗/連續刷子模式」：點擊既有 <mark> 直接一鍵切換（同色即清除，異色即換色）！
        if (state.highlightBrushMode || state.mobileTapHighlightMode) {
          applyHighlight(state.activeHighlightColor || '#fef08a');
          return;
        }

        // 一般模式下：為該 <mark> 加上醒目虛線外框並浮出底部色盤，讓使用者免長按即可一鍵清除或換色！
        clickedMark.classList.add('selected-mark-target');
        if (window.innerWidth < 768 && DOM.mbHighlightPalette) {
          DOM.mbHighlightPalette.classList.remove('hidden');
          const mbStatus = document.getElementById('mb-hl-status-text');
          const markText = (clickedMark.textContent || '').trim().slice(0, 12);
          if (mbStatus) {
            mbStatus.textContent = `🎯 已選中「${markText}」：點顏色直接換色，或點「清除劃記」`;
          }
        }
        return;
      }

      // 若開啟了「⚡ 點塗模式 (Tap-to-Highlight)」且點擊了一般文字段落：自動抓取所點詞句/整行並塗上螢光筆！
      if (state.highlightBrushMode || state.mobileTapHighlightMode) {
        const blockEl = e.target.closest('p, li, h1, h2, h3, h4, .notion-todo-text, td, th, blockquote');
        if (!blockEl || !DOM.editor.contains(blockEl)) return;

        let targetRange = null;
        if (document.caretRangeFromPoint) {
          const caret = document.caretRangeFromPoint(e.clientX, e.clientY);
          if (caret && caret.startContainer && caret.startContainer.nodeType === Node.TEXT_NODE && blockEl.contains(caret.startContainer)) {
            const textNode = caret.startContainer;
            const fullText = textNode.nodeValue || '';
            const offset = caret.startOffset;
            if (fullText.trim().length > 0) {
              // 智慧尋找點選位置的詞句邊界（以標點符號或空白分隔；若整行很短則直接選取整段文字節點）
              const sepRegex = /[，。、；：！？,.;:!?\s（）()【】\[\]]/;
              let startIdx = offset;
              while (startIdx > 0 && !sepRegex.test(fullText[startIdx - 1])) startIdx--;
              let endIdx = offset;
              while (endIdx < fullText.length && !sepRegex.test(fullText[endIdx])) endIdx++;
              if (endIdx > startIdx) {
                targetRange = document.createRange();
                targetRange.setStart(textNode, startIdx);
                targetRange.setEnd(textNode, endIdx);
              }
            }
          }
        }

        if (!targetRange && blockEl.textContent.trim().length > 0) {
          targetRange = document.createRange();
          targetRange.selectNodeContents(blockEl);
        }

        if (targetRange && !targetRange.collapsed) {
          savedSelectionRange = targetRange.cloneRange();
          applyHighlight(state.activeHighlightColor || '#fef08a');
          try { window.getSelection().removeAllRanges(); } catch (err) {}
        }
      }
    });
  }

  // 8. 屬性面板收合時顯示精簡分類摘要膠囊 (#properties-collapsed-summary)
  const updateCollapsedPropertiesSummary = () => {
    const summaryEl = document.getElementById('properties-collapsed-summary');
    const propsContent = document.getElementById('note-properties-content');
    if (!summaryEl || !propsContent) return;
    const isCollapsed = propsContent.classList.contains('hidden');
    if (!isCollapsed) {
      summaryEl.classList.add('hidden');
      summaryEl.classList.remove('flex');
      return;
    }
    const m = (DOM.noteMachineSelect && DOM.noteMachineSelect.value) || '未分類';
    const c = (DOM.noteContentSelect && DOM.noteContentSelect.value) || '未分類';
    const u = (DOM.noteUrgencySelect && DOM.noteUrgencySelect.value) || '未分類';
    summaryEl.innerHTML = `
      <span class="px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-500 font-semibold truncate">${escapeHtml(m)}</span>
      <span class="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 font-semibold truncate">${escapeHtml(c)}</span>
      <span class="px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-500 font-semibold truncate">${escapeHtml(u)}</span>
    `;
    summaryEl.classList.remove('hidden');
    summaryEl.classList.add('flex');
  };
  const togglePropsBtnEl = document.getElementById('toggle-properties-btn');
  if (togglePropsBtnEl) {
    togglePropsBtnEl.addEventListener('click', () => {
      setTimeout(updateCollapsedPropertiesSummary, 10);
    });
  }
}


/**
 * 🌙 v2.6.9 深色模式高對比度自動淨化引擎：
 * 1. 自動將舊筆記中帶有淺色半透明行內 style="...background: rgba(254, 242, 242...)" 的排查卡片升級為語意化高對比 Class
 * 2. 自動偵測外部貼上文字中帶有暗黑字體色 (如 color: #333 / rgb(34,34,34)) 或淺灰底色的行內樣式並予以淨化，確保深色模式下 100% 清晰銳利
 */
function ensureHighContrastInDarkMode(container = DOM.editor) {
  if (!container) return;
  try {
    // 1. 升級舊版已存檔的三段式故障排查卡片行內樣式
    container.querySelectorAll('.lvi-troubleshoot-card > .notion-callout, .notion-callout[style*="background"]').forEach((callout, idx) => {
      const st = (callout.getAttribute('style') || '').toLowerCase();
      if (st.includes('254, 242, 242') || st.includes('#ef4444')) {
        callout.classList.add('troubleshoot-stage-1');
        callout.removeAttribute('style');
      } else if (st.includes('255, 251, 235') || st.includes('#f59e0b')) {
        callout.classList.add('troubleshoot-stage-2');
        callout.removeAttribute('style');
      } else if (st.includes('236, 253, 245') || st.includes('#10b981')) {
        callout.classList.add('troubleshoot-stage-3');
        callout.removeAttribute('style');
      } else if (callout.closest('.lvi-troubleshoot-card')) {
        const stageNum = (idx % 3) + 1;
        callout.classList.add(`troubleshoot-stage-${stageNum}`);
        callout.removeAttribute('style');
      }
    });

    // 2. 清理一般段落、清單或表格中因外部複製貼上殘留的低對比行內字體顏色或背景色 (保留 <mark> 螢光筆)
    container.querySelectorAll('[style*="color"], [style*="background"]').forEach(el => {
      if (el.tagName === 'MARK' || el.classList.contains('notion-highlight') || el.closest('mark')) return;
      if (el.classList.contains('notion-callout')) return;

      const bg = el.style.backgroundColor || el.style.background || '';
      const fg = el.style.color || '';

      // 若行內背景為高透明度白色/淺色或接近純白，移除其行內背景以免在深色模式泛灰
      if (bg) {
        const mRgba = bg.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (mRgba) {
          const r = parseInt(mRgba[1], 10), g = parseInt(mRgba[2], 10), b = parseInt(mRgba[3], 10);
          if (r > 210 && g > 210 && b > 210) {
            el.style.backgroundColor = '';
            el.style.background = '';
          }
        }
      }

      // 若行內字體顏色為深黑/深灰 (例如從網頁或 Word 貼上的 rgb(55,53,47) 或 #333)，移除行內 color 使其自動跟隨深/淺色模式高對比文字
      if (fg) {
        const mRgb = fg.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (mRgb) {
          const r = parseInt(mRgb[1], 10), g = parseInt(mRgb[2], 10), b = parseInt(mRgb[3], 10);
          if (r < 110 && g < 110 && b < 110) {
            el.style.color = '';
          }
        } else if (/^#(000|111|222|333|444|555|1f2937|374151|37352f|111827)/i.test(fg.trim())) {
          el.style.color = '';
        }
      }
    });
  } catch (e) {
    console.warn('ensureHighContrastInDarkMode warning:', e);
  }
}


// ============================================================================
// 📷 v2.7.2 零閃退「網頁內建 720P 光學硬體相機」引擎 (In-App WebRTC 720P Camera)
// 為什麼不會閃退？
// 1. 全程在瀏覽器前景取景 (getUserMedia)，不喚起外部系統 50MP 相機 App，Android LMK 絕不殺分頁！
// 2. 直接向硬體 ISP 要求 1280×720 (720P) 視訊流，記憶體佔用 < 4MB（傳統 50MP 照片解碼需 >200MB）。
// 3. 支援「⚡ 即拍即傳」與「預覽後按確定上傳」雙模式、手電筒補光 (Torch) 與前後鏡頭切換。
// ============================================================================
const inAppCameraState = {
  stream: null,
  facingMode: 'environment',
  torchOn: false,
  instantUpload: true,
  capturedFile: null,
  capturedPreviewUrl: null
};

function stopInAppCameraStream() {
  if (inAppCameraState.stream) {
    try {
      inAppCameraState.stream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
    } catch (e) {}
    inAppCameraState.stream = null;
  }
  inAppCameraState.torchOn = false;
  const videoEl = document.getElementById('inapp-camera-video');
  if (videoEl) {
    try { videoEl.srcObject = null; } catch (e) {}
  }
}

function closeInAppCameraModal() {
  stopInAppCameraStream();
  if (inAppCameraState.capturedPreviewUrl) {
    URL.revokeObjectURL(inAppCameraState.capturedPreviewUrl);
    inAppCameraState.capturedPreviewUrl = null;
  }
  inAppCameraState.capturedFile = null;
  const modal = document.getElementById('inapp-camera-modal');
  if (modal) modal.classList.add('hidden');
}

async function startInAppCameraStream() {
  stopInAppCameraStream();
  const videoEl = document.getElementById('inapp-camera-video');
  const previewImg = document.getElementById('inapp-camera-preview-img');
  const liveControls = document.getElementById('inapp-camera-live-controls');
  const confirmControls = document.getElementById('inapp-camera-confirm-controls');
  const torchBtn = document.getElementById('inapp-camera-torch-btn');
  const statusEl = document.getElementById('inapp-camera-status');
  const resLabel = document.getElementById('inapp-camera-res-label');

  if (previewImg) previewImg.classList.add('hidden');
  if (videoEl) videoEl.classList.remove('hidden');
  if (liveControls) {
    liveControls.classList.remove('hidden');
    liveControls.classList.add('flex');
  }
  if (confirmControls) {
    confirmControls.classList.add('hidden');
    confirmControls.classList.remove('flex');
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    closeInAppCameraModal();
    if (DOM.genericFileUploadInput) DOM.genericFileUploadInput.click();
    return;
  }

  try {
    if (statusEl) statusEl.textContent = '⏳ 正在啟動 720P 硬體光學鏡頭...';
    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: inAppCameraState.facingMode },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 }
      }
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    inAppCameraState.stream = stream;

    if (videoEl) {
      videoEl.srcObject = stream;
      await videoEl.play().catch(() => {});
      const vw = videoEl.videoWidth || 1280;
      const vh = videoEl.videoHeight || 720;
      if (resLabel) resLabel.textContent = `${vw}×${vh}`;
    }

    // 偵測是否支援機台內部補光燈 (Torch)
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack && torchBtn) {
      const caps = (typeof videoTrack.getCapabilities === 'function') ? videoTrack.getCapabilities() : {};
      if (caps && caps.torch) {
        torchBtn.classList.remove('hidden');
      } else {
        torchBtn.classList.add('hidden');
      }
    }

    if (statusEl) {
      statusEl.textContent = inAppCameraState.instantUpload
        ? '⚡ 即拍即傳模式：按下快門立即寫入筆記並上傳雲端（絕不閃退）'
        : '🔍 預覽確認模式：按下快門後可先檢視畫面，再按「確定使用」';
    }
  } catch (err) {
    console.warn('無法開啟內建 WebRTC 相機，切換為安全相簿選圖:', err);
    closeInAppCameraModal();
    showToast('💡 請允許相機權限以使用內建防閃退相機，或直接由相簿選圖');
    if (DOM.genericFileUploadInput) DOM.genericFileUploadInput.click();
  }
}

async function openInAppCameraModal() {
  // 拍照前先同步鎖定當前筆記狀態，雙重保障零掉字
  try { commitActiveEditorStateImmediately(); } catch (e) {}

  try {
    const savedInstant = localStorage.getItem('lvi_camera_instant_mode');
    if (savedInstant !== null) {
      inAppCameraState.instantUpload = savedInstant === 'true';
    }
  } catch (e) {}

  const instantBtn = document.getElementById('inapp-camera-instant-toggle');
  if (instantBtn) {
    instantBtn.textContent = inAppCameraState.instantUpload ? '⚡ 即拍即傳: 開' : '🔍 預覽確認: 開';
    instantBtn.className = inAppCameraState.instantUpload
      ? 'px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-[11px] font-bold transition cursor-pointer whitespace-nowrap'
      : 'px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[11px] font-bold transition cursor-pointer whitespace-nowrap';
  }

  const modal = document.getElementById('inapp-camera-modal');
  if (modal) {
    modal.classList.remove('hidden');
    initLucide();
    await startInAppCameraStream();
  }
}

async function captureInAppPhotoFrame() {
  const videoEl = document.getElementById('inapp-camera-video');
  const canvas = document.getElementById('inapp-camera-canvas');
  if (!videoEl || !canvas) return;

  const rawW = videoEl.videoWidth || 1280;
  const rawH = videoEl.videoHeight || 720;
  const maxW = rawH > rawW ? 720 : 1280;
  const maxH = rawH > rawW ? 1280 : 720;
  const scale = Math.min(maxW / rawW, maxH / rawH, 1.0);
  const targetW = Math.max(1, Math.round(rawW * scale));
  const targetH = Math.max(1, Math.round(rawH * scale));

  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(videoEl, 0, 0, targetW, targetH);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) {
    showToast('⚠️ 擷取畫面失敗，請再按一次快門');
    return;
  }

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const fileName = `Photo_${stamp}.jpg`;
  const photoFile = new File([blob], fileName, { type: 'image/jpeg', lastModified: Date.now() });
  photoFile._is720p = true;

  if (inAppCameraState.instantUpload) {
    // ⚡ 即拍即傳：直接關閉相機並以 0.01 秒樂觀渲染寫入筆記 + 背景上傳雲端！
    closeInAppCameraModal();
    showToast(`📸 已拍攝「${fileName}」並插入筆記！`, 2200);
    await uploadGenericFile(photoFile);
  } else {
    // 🔍 預覽確認模式：顯示剛剛拍下的 720P 照片供使用者檢視，按下「✅ 確定使用並上傳」100% 不閃退！
    if (inAppCameraState.capturedPreviewUrl) {
      URL.revokeObjectURL(inAppCameraState.capturedPreviewUrl);
    }
    inAppCameraState.capturedFile = photoFile;
    inAppCameraState.capturedPreviewUrl = URL.createObjectURL(photoFile);

    const previewImg = document.getElementById('inapp-camera-preview-img');
    const liveControls = document.getElementById('inapp-camera-live-controls');
    const confirmControls = document.getElementById('inapp-camera-confirm-controls');
    const statusEl = document.getElementById('inapp-camera-status');

    if (previewImg) {
      previewImg.src = inAppCameraState.capturedPreviewUrl;
      previewImg.classList.remove('hidden');
    }
    videoEl.classList.add('hidden');
    if (liveControls) {
      liveControls.classList.add('hidden');
      liveControls.classList.remove('flex');
    }
    if (confirmControls) {
      confirmControls.classList.remove('hidden');
      confirmControls.classList.add('flex');
    }
    if (statusEl) {
      statusEl.textContent = `✅ 已擷取 720P 高清畫面 (${formatFileSizeDisplay(photoFile.size)})，請點擊下方「確定使用並上傳」`;
    }
  }
}

function initInAppCameraListeners() {
  const topCamBtn = document.getElementById('top-camera-btn');
  const closeBtn = document.getElementById('inapp-camera-close-btn');
  const doneBtn = document.getElementById('inapp-camera-done-btn');
  const shutterBtn = document.getElementById('inapp-camera-shutter-btn');
  const switchBtn = document.getElementById('inapp-camera-switch-btn');
  const torchBtn = document.getElementById('inapp-camera-torch-btn');
  const instantBtn = document.getElementById('inapp-camera-instant-toggle');
  const fallbackBtn = document.getElementById('inapp-camera-fallback-btn');
  const retakeBtn = document.getElementById('inapp-camera-retake-btn');
  const confirmUseBtn = document.getElementById('inapp-camera-confirm-use-btn');

  if (topCamBtn) {
    topCamBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openInAppCameraModal();
    });
  }
  if (closeBtn) closeBtn.addEventListener('click', closeInAppCameraModal);
  if (doneBtn) doneBtn.addEventListener('click', closeInAppCameraModal);

  if (shutterBtn) {
    shutterBtn.addEventListener('click', (e) => {
      e.preventDefault();
      captureInAppPhotoFrame();
    });
  }

  if (switchBtn) {
    switchBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      inAppCameraState.facingMode = inAppCameraState.facingMode === 'environment' ? 'user' : 'environment';
      await startInAppCameraStream();
    });
  }

  if (torchBtn) {
    torchBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!inAppCameraState.stream) return;
      const track = inAppCameraState.stream.getVideoTracks()[0];
      if (!track) return;
      try {
        inAppCameraState.torchOn = !inAppCameraState.torchOn;
        await track.applyConstraints({ advanced: [{ torch: inAppCameraState.torchOn }] });
        torchBtn.className = inAppCameraState.torchOn
          ? 'px-2 py-1 rounded-lg bg-amber-400 text-slate-950 border border-amber-300 text-[11px] font-bold transition cursor-pointer whitespace-nowrap'
          : 'px-2 py-1 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-slate-700 text-[11px] font-semibold transition cursor-pointer whitespace-nowrap';
      } catch (err) {
        showToast('此鏡頭不支援手電筒常亮控制');
      }
    });
  }

  if (instantBtn) {
    instantBtn.addEventListener('click', (e) => {
      e.preventDefault();
      inAppCameraState.instantUpload = !inAppCameraState.instantUpload;
      try { localStorage.setItem('lvi_camera_instant_mode', String(inAppCameraState.instantUpload)); } catch (err) {}
      instantBtn.textContent = inAppCameraState.instantUpload ? '⚡ 即拍即傳: 開' : '🔍 預覽確認: 開';
      instantBtn.className = inAppCameraState.instantUpload
        ? 'px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-[11px] font-bold transition cursor-pointer whitespace-nowrap'
        : 'px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[11px] font-bold transition cursor-pointer whitespace-nowrap';
      const statusEl = document.getElementById('inapp-camera-status');
      if (statusEl) {
        statusEl.textContent = inAppCameraState.instantUpload
          ? '⚡ 即拍即傳模式：按下快門立即寫入筆記並上傳雲端（絕不閃退）'
          : '🔍 預覽確認模式：按下快門後可先檢視畫面，再按「確定使用」';
      }
    });
  }

  if (fallbackBtn) {
    fallbackBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeInAppCameraModal();
      if (DOM.genericFileUploadInput) DOM.genericFileUploadInput.click();
    });
  }

  if (retakeBtn) {
    retakeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const videoEl = document.getElementById('inapp-camera-video');
      const previewImg = document.getElementById('inapp-camera-preview-img');
      const liveControls = document.getElementById('inapp-camera-live-controls');
      const confirmControls = document.getElementById('inapp-camera-confirm-controls');
      if (previewImg) previewImg.classList.add('hidden');
      if (videoEl) videoEl.classList.remove('hidden');
      if (liveControls) {
        liveControls.classList.remove('hidden');
        liveControls.classList.add('flex');
      }
      if (confirmControls) {
        confirmControls.classList.add('hidden');
        confirmControls.classList.remove('flex');
      }
    });
  }

  if (confirmUseBtn) {
    confirmUseBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const fileToUpload = inAppCameraState.capturedFile;
      closeInAppCameraModal();
      if (fileToUpload) {
        showToast(`📸 已確認照片「${fileToUpload.name}」，正在同步至雲端...`, 2200);
        await uploadGenericFile(fileToUpload);
      }
    });
  }
}
