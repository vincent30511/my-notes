const APP_VERSION = 'v2.4.2'; // 2026.10.08
console.log('🚀 LVI_Note ' + APP_VERSION + ' Initialized.');
// 啟動時自動遷移歷史資料夾名稱至 LVI_Note
if (localStorage.getItem('cloudnotes_folder_name') === 'DriveNotes') {
  localStorage.setItem('cloudnotes_folder_name', 'LVI_Note');
}
// ----------------- ☁️ 純雲端唯一真實源 (Cloud-First Exclusive Architecture) -----------------
// 清除本機歷史快取分類資料，確保所有內容與分類 100% 來自 Google Drive 雲端
['cloudnotes_machine_models', 'cloudnotes_work_contents', 'cloudnotes_urgencies', 'cloudnotes_tags', 'cloudnotes_folders', 'cloudnotes_config_updated_at'].forEach(k => {
  try { localStorage.removeItem(k); } catch(e) {}
});

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
  currentMachineFilter: null,
  currentContentFilter: null,
  currentUrgencyFilter: null,
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
  mediaUploadInput: document.getElementById('media-upload-input'),
  insertFileBtn: document.getElementById('insert-file-btn'),
  mbToolFile: document.getElementById('mb-tool-file'),
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
  tmTabCustom: document.getElementById('tm-tab-custom'),
  tmPaneMachine: document.getElementById('tm-pane-machine'),
  tmPaneContent: document.getElementById('tm-pane-content'),
  tmPaneUrgency: document.getElementById('tm-pane-urgency'),
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
  tableFilterMachine: document.getElementById('table-filter-machine'),
  tableFilterContent: document.getElementById('table-filter-content'),
  tableFilterUrgency: document.getElementById('table-filter-urgency'),
  tableFilterTag: document.getElementById('table-filter-tag'),
  toggleAllMediaBtn: document.getElementById('toggle-all-media-btn'),
  toggleAllMediaLabel: document.getElementById('toggle-all-media-label'),
  selHighlightBtn: document.getElementById('sel-highlight-btn'),
  selHighlightPalette: document.getElementById('sel-highlight-palette'),
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
  try { setupGoogleAuth(); } catch (e) { console.error('setupGoogleAuth error:', e); }
  try { checkAiKeyStatus(); } catch (e) { console.error('checkAiKeyStatus error:', e); }
  try { renderNotesList(); } catch (e) { console.error('renderNotesList error:', e); }
  try { initImageEditor(); } catch (e) { console.error('initImageEditor error:', e); }
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
    updateSyncStatus('syncing', '驗證登入憑證...');
    try {
      const testRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${cachedToken}` }
      });
      if (testRes.ok) {
        state.accessToken = cachedToken;
        scheduleTokenRefresh(3600);
        await onLoginSuccess();
        return;
      } else {
        console.log('快取 Token 已過期 (HTTP ' + testRes.status + ')，立即嘗試背景無感更新...');
        localStorage.removeItem('cloudnotes_access_token');
        state.accessToken = null;
      }
    } catch (netErr) {
      console.warn('網路檢查 Token 失敗:', netErr);
    }
  }

  // 若快取無效但使用者先前已授權，嘗試背景靜默無感登入
  if (wasAuthorized && state.tokenClient) {
    updateSyncStatus('syncing', '正在自動連線...');
    state.tokenClient.requestAccessToken({
      prompt: '',
      hint: targetEmail
    });
  } else {
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

async function onLoginSuccess() {
  DOM.loginBtn.classList.add('hidden');
  DOM.userProfile.classList.remove('hidden');
  updateSyncStatus('syncing', '連線中...');

  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${state.accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`Token 驗證無效 (HTTP ${res.status})`);
  }
  state.user = await res.json();
  if (state.user && state.user.picture) {
    DOM.userAvatar.src = state.user.picture;
  }
  if (state.user && state.user.email) {
    state.userEmail = state.user.email;
    localStorage.setItem('cloudnotes_user_email', state.user.email);
  }

  await ensureNotesFolder();
  await syncWorkspaceConfigWithDrive();
  await fetchNotesList();
  syncGoogleTasks().catch(e => console.warn('Tasks 同步:', e));
  syncGoogleCalendar().catch(e => console.warn('日曆同步:', e));
  updateSyncStatus('synced', '已連線');
  showToast(`✅ 歡迎回來，${state.user.name || state.user.email || '使用者'}！筆記已自 Google Drive 同步`);
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
  } catch(e) {
    console.warn('建立或確認媒體素材資料夾失敗:', e);
  }
}

// ----------------- 🔄 100% 純雲端工作區唯一真實源 (Google Drive Cloud Truth Engine) -----------------
let isSavingConfig = false;
let pendingSaveConfig = false;

// 1. 自 Google Drive 雲端嚴格讀取最新工作區設定與分類 (完全無本地殘留)
async function syncWorkspaceConfigWithDrive() {
  if (!state.accessToken || !state.folderId) return;
  updateSyncStatus('syncing', '正在讀取 Google Drive 雲端設定...');

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
      return {
        ...file,
        parentId: (file.parents && file.parents[0]) || file.parentFolderId || state.folderId,
        meta
      };
    });

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

    // 🎯 全域排序：所有筆記依據「最後一次編輯時間 (modifiedTime)」由新到舊排序
    state.notes.sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0));

    if (state.notes.length > 0 && !state.currentNote) {
      // 🎯 每次打開軟體時，首先出現最後一次編輯過的筆記 (優先讀取記憶體或排序第一位)
      const lastEditedId = localStorage.getItem('lvi_last_active_note_id');
      const targetNote = (lastEditedId && state.notes.find(n => n.id === lastEditedId)) || state.notes[0];
      selectNote(targetNote.id);
    } else if (state.notes.length === 0) {
      createNewNote();
    }
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

// ----------------- 🕒 動作歷史與 20+ 步時光回朔核心引擎 (Action History & Rollback Engine) -----------------
const MAX_HISTORY_STEPS = 100; // 支援高達 100 步歷史操作回朔 (遠超 20 步要求)

state.actionHistory = [];      // 儲存 ActionRecord 陣列
state.historyIndex = -1;       // 當前歷史節點指標
state.isUndoingOrRedoing = false;
state.editorSnapshotBeforeEdit = null;
state.titleBeforeEdit = null;
let editorInputTimer = null;
let savedSelectionRange = null;


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
    type: action.type,
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
  const badge = DOM.historyCounterBadge;

  const undoCount = state.historyIndex + 1;
  const redoCount = state.actionHistory.length - 1 - state.historyIndex;

  if (undoBtn) {
    undoBtn.disabled = undoCount <= 0;
    undoBtn.title = undoCount > 0 ? `復原動作 (Ctrl+Z) - 還可復原 ${undoCount} 步` : '沒有可復原的動作';
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
  if (state.historyIndex < 0) {
    showToast('已無更早的歷史動作可復原！');
    return false;
  }

  state.isUndoingOrRedoing = true;
  const act = state.actionHistory[state.historyIndex];
  try {
    act.undo();
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
  if (state.historyIndex >= state.actionHistory.length - 1) {
    showToast('已到最新狀態，沒有可重做的動作！');
    return false;
  }

  state.isUndoingOrRedoing = true;
  state.historyIndex++;
  const act = state.actionHistory[state.historyIndex];
  try {
    act.redo();
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
    state.isUndoingOrRedoing = false;
    showToast(`⏩ 已前進重做 ${steps} 個動作！已切換至指定狀態。`);
  }

  updateHistoryUI();
  if (isHistoryModalOpen()) renderHistoryTimeline();
  triggerAutoSaveDebounce();
}

// 專為使用者指令打造：「一次回朔 20 步動作」
function quickRollback20Steps() {
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
        <p class="text-[11px] mt-1 text-gray-400">當您編輯筆記、更換機型、調整急迫性或變更屬性時，系統將在此完整記錄並支援一鍵回朔！</p>
      </div>
    `;
    initLucide();
    return;
  }

  // 倒序顯示：最新的動作在最上方
  for (let i = state.actionHistory.length - 1; i >= 0; i--) {
    const act = state.actionHistory[i];
    const isCurrent = i === state.historyIndex;
    const isPast = i <= state.historyIndex;
    const stepDiff = state.historyIndex - i;

    const item = document.createElement('div');
    item.className = `p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs transition history-item ${isCurrent ? 'is-current ring-1 ring-blue-500/40' : ''}`;

    let statusBadge = '';
    let rollbackBtn = '';

    if (isCurrent) {
      statusBadge = `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white shrink-0">📍 目前所在</span>`;
      rollbackBtn = `<span class="text-[11px] text-blue-500 font-semibold shrink-0">當前位置</span>`;
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

    DOM.historyTimelineList.appendChild(item);
  }

  initLucide();
}


// ----------------- 工作專用 3 級多類型標籤核心系統 (機型、內容、急迫性) -----------------

// 預設機型 (符合使用者實際環境)
// 🌲 側邊欄樹狀選單收合/展開控制器 (Tree Menu Collapse Controller)
function initWorkTreeCollapse() {
  const branches = ['machine', 'content', 'urgency'];
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

  const hasFilter = !!(state.currentMachineFilter || state.currentContentFilter || state.currentUrgencyFilter || state.currentTagFilter);

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
  state.currentNote.meta.cover = coverStyle;
  renderPageCover();
  triggerAutoSaveDebounce();
  showToast('已更新頁面封面');
}

function removeNoteCover() {
  if (!state.currentNote) return;
  if (!state.currentNote.meta) state.currentNote.meta = {};
  state.currentNote.meta.cover = null;
  renderPageCover();
  triggerAutoSaveDebounce();
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

// ----------------- 媒體上傳與就地實體嵌入 -----------------
async function uploadMediaFile(file) {
  if (!state.accessToken) {
    showToast('請先登入 Google 帳號以啟用媒體雲端同步');
    return;
  }
  if (!state.folderId) await ensureNotesFolder();
  if (!state.mediaFolderId) await ensureMediaFolder();

  DOM.uploadProgressBar.classList.remove('hidden');
  DOM.uploadProgressBar.style.width = '15%';
  showGlobalLoading(`正在上傳媒體 (${file.name})...`);
  updateSyncStatus('syncing', `上傳中：${file.name}...`);

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1);

  // 在光標處先插入暫存預覽骨架
  const placeholderId = 'media_loading_' + Date.now();
  let loadingHtml = `<div id="${placeholderId}" class="p-3 my-2 border border-dashed border-blue-400 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-950/20 rounded-lg text-xs text-blue-600 dark:text-blue-300 flex items-center gap-2 animate-pulse"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-500 shrink-0"></i> <span>正在上傳：${escapeHtml(file.name)} (${sizeMb} MB)...</span></div>`;
  insertHtmlAtCursor(loadingHtml);
  initLucide();

  try {
    const boundary = '-------LVINoteMediaBoundary' + Math.random().toString(36).substring(2);
    const targetParentId = state.mediaFolderId || state.folderId;

    const metadata = {
      name: file.name,
      parents: [targetParentId]
    };

    DOM.uploadProgressBar.style.width = '45%';

    // 🚀 零拷貝原生 Blob Multipart 串流傳輸：徹底根除 V8 記憶體堆疊不足 (OOM) 崩潰
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });
    const multipartBody = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      metadataBlob,
      `\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`
    ], { type: `multipart/related; boundary=${boundary}` });

    DOM.uploadProgressBar.style.width = '70%';

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Drive API 錯誤 (${res.status}): ${errText}`);
    }

    DOM.uploadProgressBar.style.width = '90%';
    const uploadedFile = await res.json();

    // 設為任何人可讀 (便於直連縮圖與影片預覽播放)
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploadedFile.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });
    } catch (permErr) {
      console.warn('設定附件公開預覽失敗:', permErr);
    }

    DOM.uploadProgressBar.style.width = '100%';
    setTimeout(() => {
      DOM.uploadProgressBar.classList.add('hidden');
      DOM.uploadProgressBar.style.width = '0%';
    }, 400);

    const directSrc = `https://drive.google.com/thumbnail?id=${uploadedFile.id}&sz=w1600`;
    const previewUrl = `https://drive.google.com/file/d/${uploadedFile.id}/preview`;

    let finalEmbedHtml = '';
    if (isImage) {
      finalEmbedHtml = `<p><img src="${directSrc}" alt="${escapeHtml(file.name)}" loading="lazy" /></p><p><br></p>`;
    } else if (isVideo) {
      finalEmbedHtml = `<div class="my-3"><iframe src="${previewUrl}" allow="autoplay" allowfullscreen></iframe></div><p><br></p>`;
    } else if (isAudio) {
      finalEmbedHtml = `<div class="my-2"><iframe src="${previewUrl}" height="80"></iframe></div><p><br></p>`;
    } else {
      finalEmbedHtml = `<p><a href="${previewUrl}" target="_blank" class="text-blue-500 underline">📎 ${escapeHtml(file.name)}</a></p><p><br></p>`;
    }

    const placeholder = document.getElementById(placeholderId);
    if (placeholder) {
      placeholder.outerHTML = finalEmbedHtml;
    } else {
      insertHtmlAtCursor(finalEmbedHtml);
    }

    try { enhanceMediaCollapsiblesAndDraggables(DOM.editor); } catch (e) { console.warn(e); }
    updateSyncStatus('synced', '媒體已就地渲染');
    showToast(`✅ ${file.name} 已就地嵌入至筆記`);
    triggerAutoSaveDebounce();
    ensureTrailingEditableParagraphAndFocus();
  } catch (err) {
    console.error('上傳媒體失敗:', err);
    DOM.uploadProgressBar.classList.add('hidden');
    updateSyncStatus('error', '媒體上傳失敗');
    showToast(`⚠️ 上傳失敗：${err.message || '請再試一次'}`);
    const placeholder = document.getElementById(placeholderId);
    if (placeholder) {
      placeholder.outerHTML = `<div class="text-red-500 text-xs p-2.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">⚠️ ${escapeHtml(file.name)} 上傳失敗，點擊重新上傳</div>`;
    }
  } finally {
    hideGlobalLoading();
  }
}


// ----------------- 📎 通用檔案上傳與就地檔案卡片嵌入 (支援下載) -----------------
async function uploadGenericFile(file) {
  if (!state.accessToken) {
    showToast('請先登入 Google 帳號以啟用檔案上傳');
    return;
  }
  if (!state.folderId) await ensureNotesFolder();
  if (!state.mediaFolderId) await ensureMediaFolder();

  DOM.uploadProgressBar.classList.remove('hidden');
  DOM.uploadProgressBar.style.width = '15%';
  showGlobalLoading(`正在上傳檔案 (${file.name})...`);
  updateSyncStatus('syncing', `上傳檔案中：${file.name}...`);

  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  const sizeKb = (file.size / 1024).toFixed(1);
  const sizeDisplay = file.size > 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`;

  // 根據副檔名判定適當圖示與色彩
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  let iconName = 'paperclip';
  let badgeColor = 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400';
  if (['pdf'].includes(ext)) { iconName = 'file-text'; badgeColor = 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'; }
  else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) { iconName = 'archive'; badgeColor = 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'; }
  else if (['xls', 'xlsx', 'csv'].includes(ext)) { iconName = 'table'; badgeColor = 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'; }
  else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) { iconName = 'file-type'; badgeColor = 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'; }
  else if (['ppt', 'pptx'].includes(ext)) { iconName = 'presentation'; badgeColor = 'bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400'; }
  else if (['js', 'ts', 'py', 'json', 'html', 'css', 'c', 'cpp'].includes(ext)) { iconName = 'code'; badgeColor = 'bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400'; }

  // 在光標處先插入暫存預覽骨架
  const placeholderId = 'file_loading_' + Date.now();
  let loadingHtml = `<div id="${placeholderId}" class="p-3 my-2 border border-dashed border-emerald-400 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-pulse"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-emerald-500 shrink-0"></i> <span>正在上傳檔案：${escapeHtml(file.name)} (${sizeDisplay})...</span></div><p><br></p>`;
  insertHtmlAtCursor(loadingHtml);
  initLucide();

  try {
    const boundary = '-------LVINoteFileBoundary' + Math.random().toString(36).substring(2);
    const targetParentId = state.mediaFolderId || state.folderId;

    const metadata = {
      name: file.name,
      parents: [targetParentId]
    };

    DOM.uploadProgressBar.style.width = '45%';

    // 🚀 零拷貝串流 Blob Multipart 上傳
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });
    const multipartBody = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      metadataBlob,
      `\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`
    ], { type: `multipart/related; boundary=${boundary}` });

    DOM.uploadProgressBar.style.width = '70%';

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartBody
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Drive API 錯誤 (${res.status}): ${errText}`);
    }

    DOM.uploadProgressBar.style.width = '90%';
    const uploadedFile = await res.json();

    // 設為任何人可讀 (可直接下載與預覽)
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${uploadedFile.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });
    } catch (permErr) {
      console.warn('設定公開權限失敗:', permErr);
    }

    DOM.uploadProgressBar.style.width = '100%';
    setTimeout(() => {
      DOM.uploadProgressBar.classList.add('hidden');
      DOM.uploadProgressBar.style.width = '0%';
    }, 400);

    const downloadUrl = `https://drive.google.com/uc?export=download&id=${uploadedFile.id}`;
    const previewUrl = `https://drive.google.com/file/d/${uploadedFile.id}/view?usp=sharing`;
    const directSrc = `https://drive.google.com/thumbnail?id=${uploadedFile.id}&sz=w1600`;
    const previewEmbedUrl = `https://drive.google.com/file/d/${uploadedFile.id}/preview`;

    const isImage = (file.type && file.type.startsWith('image/')) || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
    const isVideo = (file.type && file.type.startsWith('video/')) || ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext);
    const isAudio = (file.type && file.type.startsWith('audio/')) || ['mp3', 'wav', 'aac', 'm4a', 'flac'].includes(ext);

    let cardHtml = '';
    if (isImage) {
      cardHtml = `
        <details class="notion-media-collapse notion-draggable-block my-3 rounded-xl border border-gray-200 dark:border-notion-borderDark bg-gray-50/70 dark:bg-notion-darker/70 overflow-hidden shadow-xs transition" open contenteditable="false" draggable="true" data-file-id="${uploadedFile.id}">
          <summary class="cursor-pointer select-none px-3 py-2 flex items-center justify-between gap-2 bg-gray-100/80 dark:bg-notion-card hover:bg-gray-200/60 dark:hover:bg-gray-800 transition font-medium text-xs">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0" title="拖動改變位置"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></span>
              <i data-lucide="image" class="w-3.5 h-3.5 text-blue-500 shrink-0"></i>
              <span class="truncate font-semibold text-gray-800 dark:text-gray-100">${escapeHtml(file.name)}</span>
              <span class="text-[11px] text-gray-400 shrink-0">(${sizeDisplay})</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[10px] text-gray-400 collapse-hint">點擊收折/展開</span>
              <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 collapse-arrow transition-transform duration-200"></i>
            </div>
          </summary>
          <div class="p-3 text-center border-t border-gray-200/50 dark:border-notion-borderDark/60">
            <img src="${directSrc}" alt="${escapeHtml(file.name)}" loading="lazy" class="rounded-xl shadow-xs border border-gray-200 dark:border-notion-borderDark max-h-[520px] mx-auto object-contain cursor-pointer hover:opacity-95 transition" onclick="window.open('${previewUrl}', '_blank')" />
            <div class="text-[11px] text-gray-400 mt-1.5 flex items-center justify-center gap-2">
              <span class="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">${escapeHtml(file.name)}</span>
              <span>•</span>
              <span>${sizeDisplay}</span>
              <span>•</span>
              <a href="${downloadUrl}" target="_blank" download="${escapeHtml(file.name)}" class="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold" title="直接下載原圖">
                <i data-lucide="download" class="w-3 h-3"></i>
                <span>下載原圖</span>
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
    } else if (isVideo) {
      cardHtml = `
        <details class="notion-media-collapse notion-draggable-block my-3 rounded-xl border border-gray-200 dark:border-notion-borderDark bg-gray-50/70 dark:bg-notion-darker/70 overflow-hidden shadow-xs transition" open contenteditable="false" draggable="true" data-file-id="${uploadedFile.id}">
          <summary class="cursor-pointer select-none px-3 py-2 flex items-center justify-between gap-2 bg-gray-100/80 dark:bg-notion-card hover:bg-gray-200/60 dark:hover:bg-gray-800 transition font-medium text-xs">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0" title="拖動改變位置"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></span>
              <i data-lucide="video" class="w-3.5 h-3.5 text-blue-500 shrink-0"></i>
              <span class="truncate font-semibold text-gray-800 dark:text-gray-100">${escapeHtml(file.name)}</span>
              <span class="text-[11px] text-gray-400 shrink-0">(${sizeDisplay})</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[10px] text-gray-400 collapse-hint">點擊收折/展開</span>
              <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 collapse-arrow transition-transform duration-200"></i>
            </div>
          </summary>
          <div class="p-3 border-t border-gray-200/50 dark:border-notion-borderDark/60">
            <iframe src="${previewEmbedUrl}" class="w-full aspect-video rounded-xl border border-gray-200 dark:border-notion-borderDark shadow-xs" allow="autoplay" allowfullscreen></iframe>
            <div class="text-[11px] text-gray-400 mt-1.5 flex items-center gap-2">
              <span class="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">${escapeHtml(file.name)}</span>
              <span>•</span>
              <span>${sizeDisplay}</span>
              <span>•</span>
              <a href="${downloadUrl}" target="_blank" download="${escapeHtml(file.name)}" class="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold" title="直接下載影片">
                <i data-lucide="download" class="w-3 h-3"></i>
                <span>下載影片</span>
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
    } else if (isAudio) {
      cardHtml = `
        <details class="notion-media-collapse notion-draggable-block my-3 rounded-xl border border-gray-200 dark:border-notion-borderDark bg-gray-50/70 dark:bg-notion-darker/70 overflow-hidden shadow-xs transition" open contenteditable="false" draggable="true" data-file-id="${uploadedFile.id}">
          <summary class="cursor-pointer select-none px-3 py-2 flex items-center justify-between gap-2 bg-gray-100/80 dark:bg-notion-card hover:bg-gray-200/60 dark:hover:bg-gray-800 transition font-medium text-xs">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0" title="拖動改變位置"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></span>
              <i data-lucide="music" class="w-3.5 h-3.5 text-blue-500 shrink-0"></i>
              <span class="truncate font-semibold text-gray-800 dark:text-gray-100">${escapeHtml(file.name)}</span>
              <span class="text-[11px] text-gray-400 shrink-0">(${sizeDisplay})</span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[10px] text-gray-400 collapse-hint">點擊收折/展開</span>
              <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 collapse-arrow transition-transform duration-200"></i>
            </div>
          </summary>
          <div class="p-3 border-t border-gray-200/50 dark:border-notion-borderDark/60">
            <iframe src="${previewEmbedUrl}" height="80" class="w-full rounded-xl border border-gray-200 dark:border-notion-borderDark"></iframe>
            <div class="text-[11px] text-gray-400 mt-1.5 flex items-center gap-2">
              <span class="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">${escapeHtml(file.name)}</span>
              <span>•</span>
              <span>${sizeDisplay}</span>
              <span>•</span>
              <a href="${downloadUrl}" target="_blank" download="${escapeHtml(file.name)}" class="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold" title="直接下載音訊">
                <i data-lucide="download" class="w-3 h-3"></i>
                <span>下載音訊</span>
              </a>
            </div>
          </div>
        </details>
        <p><br></p>
      `;
    } else {
      cardHtml = `
        <div class="notion-file-attachment notion-draggable-block my-2.5 p-3 rounded-xl border border-gray-200 dark:border-notion-borderDark bg-gray-50/70 dark:bg-notion-darker/70 flex items-center justify-between gap-3 group hover:border-emerald-400 dark:hover:border-emerald-600 transition" contenteditable="false" draggable="true" data-file-id="${uploadedFile.id}" data-file-name="${escapeHtml(file.name)}" data-file-size="${sizeDisplay}">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0" title="拖動改變位置"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></span>
            <div class="w-9 h-9 rounded-lg ${badgeColor} flex items-center justify-center shrink-0">
              <i data-lucide="${iconName}" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">${escapeHtml(file.name)}</div>
              <div class="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                <span>${sizeDisplay}</span>
                <span>•</span>
                <span class="text-emerald-600 dark:text-emerald-400 font-medium">已同步至雲端</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <a href="${downloadUrl}" target="_blank" download="${escapeHtml(file.name)}" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer" title="直接下載檔案">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>下載</span>
            </a>
            <a href="${previewUrl}" target="_blank" rel="noopener noreferrer" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition text-xs" title="在 Google Drive 開啟">
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </a>
          </div>
        </div>
        <p><br></p>
      `;
    }

    const placeholder = document.getElementById(placeholderId);
    if (placeholder) {
      placeholder.outerHTML = cardHtml;
    } else {
      insertHtmlAtCursor(cardHtml);
      ensureEditableSpacesAroundMediaBlocks(DOM.editor);
    }

    try { enhanceMediaCollapsiblesAndDraggables(DOM.editor); } catch (e) { console.warn(e); }
    initLucide();
    updateSyncStatus('synced', '檔案已就地嵌入');
    showToast(`✅ 檔案「${file.name}」已加入筆記，可隨時下載`);
    triggerAutoSaveDebounce();
    ensureTrailingEditableParagraphAndFocus();
  } catch (err) {
    console.error('上傳檔案失敗:', err);
    DOM.uploadProgressBar.classList.add('hidden');
    updateSyncStatus('error', '檔案上傳失敗');
    showToast(`⚠️ 檔案上傳失敗：${err.message || '請再試一次'}`);
    const placeholder = document.getElementById(placeholderId);
    if (placeholder) {
      placeholder.outerHTML = `<div class="text-red-500 text-xs p-2.5 rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">⚠️ ${escapeHtml(file.name)} 上傳失敗，點擊重新上傳</div>`;
    }
  } finally {
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
function insertHtmlAtCursor(html) {
  DOM.editor.focus();
  const sel = window.getSelection();
  let range = null;
  if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (DOM.editor.contains(r.commonAncestorContainer)) {
      range = r;
    }
  }

  if (range) {
    range.deleteContents();

    const el = document.createElement('div');
    el.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node, lastNode;
    while ((node = el.firstChild)) {
      lastNode = frag.appendChild(node);
    }
    range.insertNode(frag);

    if (lastNode) {
      range = range.cloneRange();
      range.setStartAfter(lastNode);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } else {
    const el = document.createElement('div');
    el.innerHTML = html;
    while (el.firstChild) {
      DOM.editor.appendChild(el.firstChild);
    }
  }
  ensureTrailingEditableParagraphAndFocus();
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
function applyTemplate(type) {
  const templates = {
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

  // 4. 關鍵字搜尋
  const query = DOM.searchInput && DOM.searchInput.value ? DOM.searchInput.value.trim().toLowerCase() : '';
  if (query) {
    filtered = filtered.filter(n => {
      const titleMatch = (n.name || '').toLowerCase().includes(query);
      const tagsMatch = (n.meta.tags || []).some(t => t.toLowerCase().includes(query));
      return titleMatch || tagsMatch;
    });
  }

  // 置頂筆記排在最前
  filtered.sort((a, b) => {
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

// ----------------- 選取與載入筆記 -----------------
async function selectNote(noteId) {
  const noteMeta = state.notes.find(n => n.id === noteId);
  if (!noteMeta) return;

  // 手機介面優化：點擊筆記後自動收合側欄抽屜，呈現全螢幕編輯區
  if (window.innerWidth < 768) {
    closeSidebar();
  }

  localStorage.setItem('lvi_last_active_note_id', noteId);
  DOM.noteTitle.value = noteMeta.name.replace(/\.md$/i, '');
  DOM.headerTitle.textContent = DOM.noteTitle.value;

  // 🚀 動態快取渲染：若記憶體中已有快取內容，立即 0ms 呈現，徹底消除等待感！
  const hasCache = noteMeta._cachedBody !== undefined;
  if (hasCache) {
    const finalMeta = {
      ...(noteMeta._cachedMeta || {}),
      ...(noteMeta.meta || {})
    };
    state.currentNote = {
      id: noteMeta.id,
      name: noteMeta.name,
      parentId: noteMeta.parentId,
      meta: finalMeta
    };
    try { renderCurrentNote(); } catch (e) { console.warn('renderCurrentNote cache error:', e); }
    DOM.editor.innerHTML = noteMeta._cachedHtml || (window.marked ? window.marked.parse(noteMeta._cachedBody) : noteMeta._cachedBody);
    try { enhanceMediaCollapsiblesAndDraggables(DOM.editor); } catch (e) { console.warn(e); }
    try { updateToggleAllMediaBtnUI(true); } catch (e) { console.warn(e); }
    try { attachCodeCopyButtons(); } catch (e) { console.warn(e); }
    try { updateStats(); } catch (e) { console.warn(e); }
    try { renderOutline(); } catch (e) { console.warn(e); }
    try { renderNotesList(); } catch (e) { console.warn(e); }

    // 觸發流暢滑入開启动效
    DOM.editor.classList.remove('note-open-animate');
    void DOM.editor.offsetWidth;
    DOM.editor.classList.add('note-open-animate');
  } else {
    // 首次載入或切換呈現自然大氣的 Notion 風骨架屏流光動畫 (長動畫)
    DOM.editor.innerHTML = `
      <div class="note-skeleton-wrapper max-w-3xl mx-auto py-8 px-2 space-y-6">
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

        <div class="p-4 rounded-xl border border-gray-200 dark:border-notion-borderDark bg-gray-50/50 dark:bg-notion-darker/50 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 rounded skeleton-shimmer"></div>
              <div class="h-4 w-32 rounded skeleton-shimmer"></div>
            </div>
            <div class="w-4 h-4 rounded skeleton-shimmer"></div>
          </div>
          <div class="h-40 rounded-lg skeleton-shimmer w-full"></div>
        </div>

        <div class="space-y-2.5 pt-2">
          <div class="h-4 rounded skeleton-shimmer w-full"></div>
          <div class="h-4 rounded skeleton-shimmer w-5/6"></div>
          <div class="h-4 rounded skeleton-shimmer w-3/4"></div>
        </div>
      </div>
    `;
    initLucide();
  }

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${noteId}?alt=media`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });

    if (res.status === 401) {
      console.warn('Google Drive token 過期 (401)');
      if (DOM.loginModal) DOM.loginModal.classList.remove('hidden');
      throw new Error('Google 登入憑證已過期，請重新授權登入。');
    }
    if (!res.ok) {
      throw new Error(`Google Drive API 回應錯誤 (HTTP ${res.status})`);
    }

    const rawText = await res.text();
    const { meta: bodyMeta, body } = parseFrontmatter(rawText);

    // 🛡️ 核心修復：優先採納 state.notes / file.description 中由使用者最新設定的分類屬性！
    const finalMeta = {
      ...bodyMeta,
      ...(noteMeta.meta || {})
    };

    state.currentNote = {
      id: noteMeta.id,
      name: noteMeta.name,
      parentId: noteMeta.parentId,
      meta: finalMeta
    };
    noteMeta.meta = finalMeta;

    try { renderCurrentNote(); } catch (e) { console.warn('renderCurrentNote error:', e); }

    state.titleBeforeEdit = DOM.noteTitle.value;
    state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;

    const renderedHtml = DOMPurify.sanitize(window.marked ? window.marked.parse(body) : body, {
      ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'details', 'summary', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input', 'hr', 'div', 'span', 'a', 'mark', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'controls', 'width', 'height', 'class', 'preload', 'type', 'open', 'checked', 'style', 'contenteditable', 'download', 'target', 'rel', 'href', 'data-file-id', 'data-file-name', 'data-file-size', 'draggable', 'xmlns', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'data-lucide', 'aria-hidden', 'cx', 'cy', 'r', 'x', 'y', 'rx', 'ry', 'd']
    });

    // 存入快取供後續瞬間切換
    noteMeta._cachedRawText = rawText;
    noteMeta._cachedBody = body;
    noteMeta._cachedMeta = bodyMeta;
    noteMeta._cachedHtml = renderedHtml;

    // 若先前沒有快取，或者內容與先前不一致時更新畫布
    if (!hasCache || DOM.editor.innerHTML !== renderedHtml) {
      DOM.editor.innerHTML = renderedHtml;
      try { enhanceMediaCollapsiblesAndDraggables(DOM.editor); } catch (e) { console.warn('enhanceMediaCollapsibles error:', e); }
      try { updateToggleAllMediaBtnUI(true); } catch (e) { console.warn('updateToggleAllMediaBtnUI error:', e); }
      try { attachCodeCopyButtons(); } catch (e) { console.warn('attachCodeCopyButtons error:', e); }
      try { updateStats(); } catch (e) { console.warn('updateStats error:', e); }
      try { renderOutline(); } catch (e) { console.warn('renderOutline error:', e); }

      // 開启动態平滑過渡
      DOM.editor.classList.remove('note-open-animate');
      void DOM.editor.offsetWidth;
      DOM.editor.classList.add('note-open-animate');
    }

    try { renderNotesList(); } catch (e) { console.warn('renderNotesList error:', e); }
    state.isDirty = false;
  } catch (e) {
    console.error('讀取筆記失敗:', e);
    if (!hasCache) {
      DOM.editor.innerHTML = `<div class="p-8 text-center max-w-md mx-auto my-12 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl shadow-xs">
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

function triggerAutoSaveDebounce() {
  state.isDirty = true;
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
  if (window.TurndownService) {
    const td = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    td.keep(['iframe', 'video', 'audio', 'source', 'details', 'summary', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span', 'a', 'img', 'mark', 'button', 'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g']);
    return td.turndown(html);
  }
  return html.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
             .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
             .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
             .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
             .replace(/<br\s*\/?>/gi, '\n');
}

async function saveCurrentNote() {
  if (!state.accessToken) {
    console.warn('saveCurrentNote: 未登入或無 accessToken');
    updateSyncStatus('offline', '尚未登入 Google');
    DOM.statAutosave.innerHTML = '<span class="text-amber-500 font-medium cursor-pointer hover:underline">⚠️ 尚未登入 Google (點此登入儲存)</span>';
    DOM.statAutosave.onclick = () => handleLogin();
    return;
  }

  // 🛡️ 平行儲存互斥鎖：若已有請求在傳輸中，排入佇列待完成後立即發動最新儲存
  if (state.isSaving) {
    state.savePending = true;
    return;
  }
  state.isSaving = true;

  if (state.autoSaveTimer) {
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = null;
  }
  if (autoSaveMaxTimer) {
    clearTimeout(autoSaveMaxTimer);
    autoSaveMaxTimer = null;
  }

  if (!state.folderId) await ensureNotesFolder();

  updateSyncStatus('syncing', '儲存至 Google Drive...');
  DOM.statAutosave.innerHTML = '<svg class="w-3 h-3 text-blue-500 animate-spin inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> 正在同步至雲端...';

  let title = DOM.noteTitle.value.trim() || '未命名筆記';
  DOM.headerTitle.textContent = title;
  if (!title.toLowerCase().endsWith('.md')) title += '.md';

  const meta = {
    icon: DOM.noteEmojiBtn.textContent,
    cover: state.currentNote && state.currentNote.meta ? state.currentNote.meta.cover : null,
    machineModel: DOM.noteMachineSelect ? DOM.noteMachineSelect.value : '未分類',
    workContent: DOM.noteContentSelect ? DOM.noteContentSelect.value : '未分類',
    urgency: DOM.noteUrgencySelect ? DOM.noteUrgencySelect.value : '未分類',
    dueDate: DOM.noteDueDate ? DOM.noteDueDate.value : '',
    tags: (state.currentNote && state.currentNote.meta && state.currentNote.meta.tags) || [],
    pinned: state.currentNote ? state.currentNote.meta.pinned : false
  };

  const markdownBody = convertHtmlToMarkdown(DOM.editor.innerHTML);
  const fullContent = buildFrontmatterString(meta) + markdownBody;

  try {
    const boundary = '-------CloudNotesBoundary' + Math.random().toString(36).substring(2);

    let url;
    let method;
    let metadata = {
      name: title,
      description: JSON.stringify(meta)
    };

    // 🛡️ 三種大分類缺一不可：若機型、工作內容或急迫性任一未選擇，一律留在未分類資料夾
    const isFullyClassified = !isNoteUncategorized({ meta });
    const targetCategory = isFullyClassified ? (meta.machineModel || '').trim() : '未分類';
    const targetFolderId = await ensureCategoryFolder(targetCategory);

    if (state.currentNote && state.currentNote.id) {
      let parentParam = '';
      const currentParent = state.currentNote.parentId;
      if (currentParent && currentParent !== targetFolderId) {
        parentParam = `&addParents=${targetFolderId}&removeParents=${currentParent}`;
      } else if (!currentParent) {
        parentParam = `&addParents=${targetFolderId}`;
      }
      url = `https://www.googleapis.com/upload/drive/v3/files/${state.currentNote.id}?uploadType=multipart${parentParam}`;
      method = 'PATCH';
    } else {
      url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      method = 'POST';
      metadata.parents = [targetFolderId];
    }

    // 🚀 原生 Blob Multipart 串流傳輸：徹底解決多位元組中文字元 Content-Length 錯誤與截斷問題
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json; charset=UTF-8' });
    const contentBlob = new Blob([fullContent], { type: 'text/markdown; charset=UTF-8' });
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
      body: multipartBody
    });

    // 🛡️ 400 Bad Request 容錯降級：若因 parentParam 目錄不一致報錯，立即移除 parentParam 重試純內容儲存
    if (!res.ok && res.status === 400 && parentParam) {
      console.warn('帶 parentParam 儲存失敗 (400)，降級為純內容與屬性更新...');
      url = `https://www.googleapis.com/upload/drive/v3/files/${state.currentNote.id}?uploadType=multipart`;
      res = await fetch(url, {
        method: method,
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });
    }

    // 🛡️ 401 Token 過期自我修復：背景靜默無感重新取得 Token 並自動重試儲存
    if (res.status === 401) {
      console.warn('Google 登入 Token 已過期 (401)，嘗試無感更新並自動重試儲存...');
      try {
        await refreshGoogleToken();
        res = await fetch(url, {
          method: method,
          headers: {
            Authorization: `Bearer ${state.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        });
      } catch (refErr) {
        console.warn('無感更新 Token 失敗:', refErr);
        localStorage.removeItem('cloudnotes_access_token');
        updateSyncStatus('offline', '憑證過期 (請點擊登入)');
        DOM.loginBtn.classList.remove('hidden');
        DOM.userProfile.classList.add('hidden');
        throw new Error('Google 登入憑證已過期，請點擊右上角登入按鈕重新授權 (內容已妥善保留於畫布)');
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Drive API 回應錯誤 (HTTP ${res.status}): ${errText}`);
    }

    const savedFile = await res.json();

    if (!state.currentNote || !state.currentNote.id) {
      state.currentNote = {
        id: savedFile.id,
        name: title,
        parentId: targetFolderId,
        meta: meta
      };
      state.notes.unshift({
        ...state.currentNote,
        _cachedBody: markdownBody,
        _cachedHtml: DOM.editor.innerHTML,
        _cachedMeta: meta
      });
    } else {
      state.currentNote.name = title;
      state.currentNote.parentId = targetFolderId;
      state.currentNote.meta = meta;
      const nowIso = new Date().toISOString();
      state.currentNote.modifiedTime = nowIso;
      localStorage.setItem('lvi_last_active_note_id', state.currentNote.id);
      const idx = state.notes.findIndex(n => n.id === state.currentNote.id);
      if (idx !== -1) {
        state.notes[idx] = {
          ...state.notes[idx],
          name: title,
          parentId: targetFolderId,
          meta: meta,
          modifiedTime: nowIso,
          _cachedBody: markdownBody,
          _cachedHtml: DOM.editor.innerHTML,
          _cachedMeta: meta
        };
      }
    }

    updateSyncStatus('synced', '已儲存');
    DOM.statAutosave.innerHTML = '<span class="text-emerald-500 font-medium">✓ 已自動同步至 Google Drive</span>';
    renderWorkTagLists();
    renderSidebarTags();
    renderNotesList();
    renderBreadcrumbs();
    state.isDirty = false;
  } catch (e) {
    console.error('儲存筆記失敗:', e);
    // 🛡️ 本地緊急備份草稿，確保文字 100% 絕不丟失
    try {
      const draftKey = 'lvi_emergency_draft_' + (state.currentNote ? state.currentNote.id : 'current');
      localStorage.setItem(draftKey, fullContent);
    } catch(err) {}

    updateSyncStatus('error', '儲存失敗');
    DOM.statAutosave.innerHTML = `<span class="text-red-500 font-medium cursor-pointer hover:underline" title="${escapeHtml(e.message || '')}">⚠️ 同步失敗 (點此重試)</span>`;
    DOM.statAutosave.onclick = () => saveCurrentNote();
    showToast(`⚠️ 儲存失敗：${e.message || '請檢查網路連線或授權狀態'}`);
  } finally {
    state.isSaving = false;
    if (state.savePending) {
      state.savePending = false;
      setTimeout(() => saveCurrentNote(), 100);
    }
  }
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

function applyHighlight(color) {
  let sel = window.getSelection();
  if ((!sel || sel.isCollapsed || !DOM.editor.contains(sel.anchorNode)) && savedSelectionRange) {
    sel.removeAllRanges();
    sel.addRange(savedSelectionRange);
  }
  sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;

  const range = sel.getRangeAt(0);

  if (color === 'transparent') {
    // 🛡️ 取消螢光筆：徹底還原文字原生顏色與字體，不破壞字體與大小，也不留任何死黑樣式！
    clearHighlightFromSelection(range);
    triggerAutoSaveDebounce();
    showToast('已清除螢光筆，還原預設顏色與字體 🧹');
  } else {
    // 🎨 塗上螢光筆
    let existingMark = null;
    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    if (node && node.closest('mark.notion-highlight, mark')) {
      existingMark = node.closest('mark.notion-highlight, mark');
    }

    if (existingMark) {
      existingMark.dataset.color = color;
      existingMark.style.backgroundColor = color;
      existingMark.style.color = '#111827';
    } else {
      try {
        const selectedFragment = range.extractContents();
        const mark = document.createElement('mark');
        mark.className = 'notion-highlight';
        mark.dataset.color = color;
        mark.style.backgroundColor = color;
        mark.style.color = '#111827';
        mark.style.borderRadius = '3px';
        mark.style.padding = '1px 3px';
        mark.appendChild(selectedFragment);
        range.insertNode(mark);

        const newRange = document.createRange();
        newRange.selectNodeContents(mark);
        sel.removeAllRanges();
        sel.addRange(newRange);
        savedSelectionRange = newRange.cloneRange();
      } catch (err) {
        if (!document.execCommand('hiliteColor', false, color)) {
          document.execCommand('backColor', false, color);
        }
        document.execCommand('foreColor', false, '#111827');
      }
    }
    triggerAutoSaveDebounce();
    showToast('已劃記重點 🖍️');
  }
}

function clearHighlightFromSelection(range) {
  if (!range) return;

  let root = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) {
    root = root.parentElement;
  }

  // 1. 如果選取點是在某個 mark、span 或 font 內部
  let current = root;
  while (current && current !== DOM.editor) {
    if (current.tagName === 'MARK' || current.classList.contains('notion-highlight')) {
      unwrapNode(current);
      break;
    }
    if (current.tagName === 'FONT') {
      unwrapNode(current);
      break;
    }
    if (current.tagName === 'SPAN' && (current.style.backgroundColor || current.style.color)) {
      current.style.backgroundColor = '';
      if (current.style.color === 'rgb(17, 24, 39)' || current.style.color === '#111827' || current.style.color === 'inherit' || current.style.color === 'rgb(0, 0, 0)' || current.style.color === '#000000') {
        current.style.color = '';
      }
      if (!current.getAttribute('style') || current.getAttribute('style').trim() === '') {
        unwrapNode(current);
      }
      break;
    }
    current = current.parentElement;
  }

  // 2. 搜尋 Range 內部所有被包含的元素節點
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: function(node) {
        if (range.intersectsNode(node)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  const toUnwrap = [];
  const toCleanSpan = [];

  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (el.tagName === 'MARK' || el.classList.contains('notion-highlight')) {
      toUnwrap.push(el);
    } else if (el.tagName === 'FONT') {
      toUnwrap.push(el);
    } else if (el.tagName === 'SPAN') {
      if (el.style.backgroundColor || el.style.color) {
        toCleanSpan.push(el);
      }
    }
  }

  toUnwrap.forEach(unwrapNode);

  toCleanSpan.forEach(span => {
    if (!span.parentNode) return;
    span.style.backgroundColor = '';
    const c = span.style.color;
    if (c === 'rgb(17, 24, 39)' || c === '#111827' || c === 'inherit' || c === 'rgb(0, 0, 0)' || c === '#000000') {
      span.style.color = '';
    }
    if (!span.getAttribute('style') || span.getAttribute('style').trim() === '') {
      unwrapNode(span);
    }
  });

  try {
    document.execCommand('backColor', false, 'transparent');
    document.execCommand('hiliteColor', false, 'transparent');
  } catch (e) {}
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

  // 1. 檢查現有的 details.notion-media-collapse
  container.querySelectorAll('details.notion-media-collapse').forEach(details => {
    const contentDiv = details.querySelector('.media-collapse-content') || details.querySelector('.p-3');
    if (!contentDiv) return;
    contentDiv.classList.add('media-collapse-content');

    if (!contentDiv.querySelector('.media-caption-bar')) {
      const nextEl = details.nextElementSibling;
      if (nextEl && (nextEl.tagName === 'P' || nextEl.tagName === 'DIV')) {
        const text = nextEl.textContent || '';
        const hasDownload = text.includes('下載原圖') || text.includes('下載影片') || text.includes('下載') || nextEl.querySelector('a[download]');
        const hasCloud = text.includes('雲端檢視') || text.includes('Google 雲端') || text.includes('drive.google.com');
        const hasBullet = text.includes('•') && (text.includes('KB') || text.includes('MB') || nextEl.querySelector('a'));
        if (hasDownload || hasCloud || hasBullet) {
          const captionDiv = document.createElement('div');
          captionDiv.className = 'text-[11px] text-gray-400 mt-2 flex items-center justify-center gap-2 flex-wrap media-caption-bar';
          captionDiv.innerHTML = nextEl.innerHTML;
          contentDiv.appendChild(captionDiv);
          nextEl.remove();
        }
      }
    }
  });

  // 2. 自動包裝所有獨立的 img 為收折 details 卡片，並將下方的文字與下載/雲端檢視連結「100% 綁定在同一卡片內」
  const imgs = container.querySelectorAll('img:not(.emoji-opt img):not([data-no-collapse])');
  imgs.forEach(img => {
    if (img.closest('details.notion-media-collapse')) return;
    if (img.closest('button, nav, header, select, .notion-popover')) return;

    const alt = img.getAttribute('alt') || '照片';
    const src = img.getAttribute('src') || '';
    const parentP = img.closest('p, div');

    let captionHtml = '';
    let captionEl = null;

    // 檢查下一個相鄰段落是否為附件下載或圖片文字說明
    const nextEl = parentP ? parentP.nextElementSibling : img.nextElementSibling;
    if (nextEl && (nextEl.tagName === 'P' || nextEl.tagName === 'DIV')) {
      const text = nextEl.textContent || '';
      const hasDownload = text.includes('下載原圖') || text.includes('下載影片') || text.includes('下載') || nextEl.querySelector('a[download]');
      const hasCloud = text.includes('雲端檢視') || text.includes('Google 雲端') || text.includes('drive.google.com');
      const hasBullet = text.includes('•') && (text.includes('KB') || text.includes('MB') || nextEl.querySelector('a'));
      if (hasDownload || hasCloud || hasBullet) {
        captionEl = nextEl;
        captionHtml = nextEl.innerHTML;
      }
    }

    // 若父段落本身包含非圖片文字與連結
    if (!captionHtml && parentP && parentP.children.length > 1) {
      const clone = parentP.cloneNode(true);
      clone.querySelectorAll('img').forEach(i => i.remove());
      if (clone.textContent.trim().length > 0 || clone.querySelector('a')) {
        captionHtml = clone.innerHTML;
      }
    }

    const details = document.createElement('details');
    details.className = 'notion-media-collapse notion-draggable-block my-3 rounded-xl border border-gray-200 dark:border-notion-borderDark bg-gray-50/70 dark:bg-notion-darker/70 overflow-hidden shadow-xs transition';
    details.setAttribute('open', '');
    details.setAttribute('contenteditable', 'false');
    details.setAttribute('draggable', 'true');
    details.innerHTML = `
      <summary class="cursor-pointer select-none px-3 py-2 flex items-center justify-between gap-2 bg-gray-100/80 dark:bg-notion-card hover:bg-gray-200/60 dark:hover:bg-gray-800 transition font-medium text-xs">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0" title="拖動改變位置"><i data-lucide="grip-vertical" class="w-3.5 h-3.5"></i></span>
          <i data-lucide="image" class="w-3.5 h-3.5 text-blue-500 shrink-0"></i>
          <span class="truncate font-semibold text-gray-800 dark:text-gray-100">${escapeHtml(alt)}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-[10px] text-gray-400 collapse-hint">點擊收折/展開</span>
          <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 collapse-arrow transition-transform duration-200"></i>
        </div>
      </summary>
      <div class="p-3 text-center border-t border-gray-200/50 dark:border-notion-borderDark/60 media-collapse-content">
        <img src="${src}" alt="${escapeHtml(alt)}" loading="lazy" class="rounded-xl shadow-xs border border-gray-200 dark:border-notion-borderDark max-h-[520px] mx-auto object-contain cursor-pointer hover:opacity-95 transition" onclick="window.open('${src}', '_blank')" />
        <div class="text-[11px] text-gray-400 mt-2 flex items-center justify-center gap-2 flex-wrap media-caption-bar">
          ${captionHtml || `<span class="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">${escapeHtml(alt)}</span><span>•</span><a href="${src}" target="_blank" download="${escapeHtml(alt)}" class="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-semibold" title="直接下載原圖"><i data-lucide="download" class="w-3 h-3"></i><span>下載原圖</span></a><span>•</span><a href="${src}" target="_blank" rel="noopener noreferrer" class="hover:text-blue-500 flex items-center gap-1" title="在 Google 雲端開啟"><i data-lucide="external-link" class="w-3 h-3"></i><span>雲端檢視</span></a>`}
        </div>
      </div>
    `;

    if (captionEl && captionEl.parentNode) {
      captionEl.remove();
    }

    if (parentP && (parentP.children.length <= 1 || parentP.tagName === 'P')) {
      parentP.replaceWith(details);
    } else {
      img.replaceWith(details);
    }
  });

  // 3. 確保所有附件卡片與收折卡片皆具備 draggable 與拖曳手把
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
  // 4. 清理歷史編輯按鈕殘留，並為卡片綁定平滑收折/展開動畫 (Smooth Collapsible Animation)
  container.querySelectorAll('.summary-edit-img-btn, .caption-edit-img-btn, .image-hover-edit-btn').forEach(el => el.remove());
  container.querySelectorAll('.image-preview-wrapper').forEach(wrapper => {
    const img = wrapper.querySelector('img');
    if (img && wrapper.parentNode) {
      wrapper.parentNode.insertBefore(img, wrapper);
    }
    wrapper.remove();
  });

  container.querySelectorAll('details.notion-media-collapse').forEach(details => {
    try {
      const content = details.querySelector('.media-collapse-content') || details.querySelector('.p-3');
      if (content) content.classList.add('media-collapse-content');

      // 🌟 極致平滑收折/展開動畫綁定 (Smooth Collapsible Animation)
      const summary = details.querySelector('summary');
      if (summary && !summary.dataset.animatedCollapseBound && content) {
        summary.dataset.animatedCollapseBound = 'true';
        summary.addEventListener('click', (e) => {
          if (e.target.closest('.drag-handle') || e.target.closest('button') || e.target.closest('a')) {
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

  initLucide();
  try {
    ensureEditableSpacesAroundMediaBlocks(container);
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
  collapsibles.forEach(el => {
    if (hasOpen) el.removeAttribute('open');
    else el.setAttribute('open', '');
  });
  updateToggleAllMediaBtnUI(!hasOpen);
  showToast(hasOpen ? '📁 已全部收折照片與影片' : '📂 已全部展開照片與影片');
}

function updateToggleAllMediaBtnUI(allOpen) {
  if (!DOM.toggleAllMediaLabel) return;
  DOM.toggleAllMediaLabel.textContent = allOpen ? '全部收折' : '全部展開';
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
      if (isAfter) {
        target.insertAdjacentElement('afterend', draggedEditorBlock);
      } else {
        target.insertAdjacentElement('beforebegin', draggedEditorBlock);
      }
      triggerAutoSaveDebounce();
      showToast('✅ 已移動元件位置');
    }
    draggedEditorBlock = null;
  });
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

  // 移除觸發的 '/'
  const sel = window.getSelection();
  if (sel.rangeCount) {
    const range = sel.getRangeAt(0);
    if (range.startOffset > 0) {
      range.setStart(range.startContainer, range.startOffset - 1);
      range.deleteContents();
    }
  }

  let html = '';
  switch(type) {
    case 'h1':
      html = '<h1>大標題 1</h1><p><br></p>';
      break;
    case 'h2':
      html = '<h2>中標題 2</h2><p><br></p>';
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
    case 'media':
      if (DOM.mediaUploadInput) DOM.mediaUploadInput.click();
      break;
    case 'file':
      if (DOM.genericFileUploadInput) DOM.genericFileUploadInput.click();
      break;
  }

  if (html) {
    insertHtmlAtCursor(html);
    attachCodeCopyButtons();
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

// 3. 反白文字浮動選單 (Floating Selection Toolbar)
function handleTextSelection() {
  if (!DOM.selectionToolbar) return;
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

  // 確保是在編輯器內部選取
  if (!DOM.editor.contains(commonAncestor)) {
    DOM.selectionToolbar.classList.add('hidden');
    if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
    return;
  }

  const text = sel.toString().trim();
  if (!text) {
    DOM.selectionToolbar.classList.add('hidden');
    if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
    return;
  }
  savedSelectionRange = range.cloneRange();

  const rect = range.getBoundingClientRect();
  const isMobile = window.innerWidth < 768;
  const toolbarWidth = isMobile ? Math.min(window.innerWidth - 16, 360) : 340;

  let left = Math.max(8, Math.min(rect.left + rect.width / 2 - toolbarWidth / 2, window.innerWidth - toolbarWidth - 8));
  let top = rect.top + window.scrollY - 52;
  // 若太靠近視窗頂部，則翻轉置於選取文字下方，避開頂部導覽列遮擋
  if (rect.top < 65) {
    top = rect.bottom + window.scrollY + 10;
  }

  DOM.selectionToolbar.style.left = `${left}px`;
  DOM.selectionToolbar.style.top = `${top}px`;
  DOM.selectionToolbar.classList.remove('hidden');
}

function turnSelectionInto(type) {
  let sel = window.getSelection();
  // 🛡️ 關鍵修復：手機端點擊按鈕時若焦點模糊，優先自動還原先前儲存的選取範圍
  if ((!sel || sel.isCollapsed || !DOM.editor.contains(sel.anchorNode)) && savedSelectionRange) {
    sel.removeAllRanges();
    sel.addRange(savedSelectionRange);
  }
  sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const text = sel.toString().trim() || '內容';

  let html = '';
  switch(type) {
    case 'h1':
      html = `<h1>${escapeHtml(text)}</h1>`;
      break;
    case 'h2':
      html = `<h2>${escapeHtml(text)}</h2>`;
      break;
    case 'todo':
      html = `<div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">${escapeHtml(text)}</span></div>`;
      break;
    case 'callout':
      html = `<div class="notion-callout"><span class="notion-callout-icon">💡</span><div class="notion-callout-body">${escapeHtml(text)}</div></div>`;
      break;
  }

  if (html) {
    try {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node;
      while ((node = tempDiv.firstChild)) {
        frag.appendChild(node);
      }
      range.insertNode(frag);
    } catch (err) {
      document.execCommand('insertHTML', false, html);
    }
    if (DOM.selectionToolbar) DOM.selectionToolbar.classList.add('hidden');
    if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
    triggerAutoSaveDebounce();
    showToast(type === 'callout' ? '已轉為醒目提示 💡' : (type === 'todo' ? '已轉為待辦清單 ☑️' : '已轉換格式'));
  }
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
    insertHtmlAtCursor(html);
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
    } else if (textBefore === '[] ' || textBefore === '[ ] ') {
      replaceHtml = '<div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">待辦事項</span></div>';
      matchLen = textBefore.length;
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
  state.currentNote.meta.pinned = !state.currentNote.meta.pinned;
  updatePinButtonUI(state.currentNote.meta.pinned);
  renderNotesList();
  triggerAutoSaveDebounce();
  showToast(state.currentNote.meta.pinned ? '已置頂此筆記' : '已取消置頂');
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
  
  const kw = (DOM.uncatSearchInput ? DOM.uncatSearchInput.value.trim().toLowerCase() : '');
  const filteredNotes = uncatNotes.filter(n => {
    if (!kw) return true;
    const title = (n.name || '').toLowerCase();
    const desc = (n.description || '').toLowerCase();
    return title.includes(kw) || desc.includes(kw);
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

// ----------------- 1. 表格資料庫檢視 (Table Database View) -----------------
function renderTableView() {
  if (!DOM.tableViewTbody) return;

  const searchKeyword = (DOM.tableSearchInput && DOM.tableSearchInput.value ? DOM.tableSearchInput.value.trim().toLowerCase() : '');
  const filterMachine = DOM.tableFilterMachine ? DOM.tableFilterMachine.value : '';
  const filterContent = DOM.tableFilterContent ? DOM.tableFilterContent.value : '';
  const filterUrgency = DOM.tableFilterUrgency ? DOM.tableFilterUrgency.value : '';
  const filterTag = DOM.tableFilterTag ? DOM.tableFilterTag.value : '';

  let filteredNotes = state.notes.filter(note => {
    const meta = note.meta || {};
    const title = (note.name || '').replace(/\.md$/i, '').toLowerCase();

    if (searchKeyword && !title.includes(searchKeyword)) return false;
    if (filterMachine && meta.machineModel !== filterMachine) return false;
    if (filterContent && meta.workContent !== filterContent) return false;
    if (filterUrgency && meta.urgency !== filterUrgency) return false;
    if (filterTag && (!Array.isArray(meta.tags) || !meta.tags.includes(filterTag))) return false;
    return true;
  });

  // 🎯 表格資料庫排序：完全以最後編輯的時間 (modifiedTime) 為主，越近的編輯時間擺在越上面！
  filteredNotes.sort((a, b) => {
    const aPin = (a.meta && a.meta.pinned) ? 1 : 0;
    const bPin = (b.meta && b.meta.pinned) ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin; // 置頂筆記置頂
    const timeA = new Date(a.modifiedTime || 0).getTime();
    const timeB = new Date(b.modifiedTime || 0).getTime();
    return timeB - timeA; // 越近的編輯時間排在越上面
  });

  if (filteredNotes.length === 0) {
    DOM.tableViewTbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-gray-400">
          無符合條件的工作筆記。點擊上方「新增資料列」開始建立！
        </td>
      </tr>
    `;
    if (DOM.tableTotalCount) DOM.tableTotalCount.textContent = '總筆數: 0';
    return;
  }

  DOM.tableViewTbody.innerHTML = filteredNotes.map(note => {
    const meta = note.meta || {};
    const title = (note.name || '').replace(/\.md$/i, '');
    const icon = meta.icon || '🛠️';
    const status = meta.status || '🚀 處理中';
    const machine = meta.machineModel || '未指定';
    const content = meta.workContent || '未指定';
    const urgency = meta.urgency || '🟢 常規';
    const dueDate = meta.dueDate || '';
    const tags = Array.isArray(meta.tags) ? meta.tags : [];

    const urgencyClass = urgency.includes('特急') ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' :
                         urgency.includes('高') ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' :
                         urgency.includes('常規') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' :
                         'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';

    return `
      <tr class="hover:bg-gray-50/80 dark:hover:bg-notion-darker transition-colors cursor-pointer group" data-note-id="${note.id}">
        <td class="p-2.5 text-center text-amber-500">${meta.pinned ? '📌' : ''}</td>
        <td class="p-2.5 font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5 open-note-trigger">
          <span class="text-base">${icon}</span>
          <span class="hover:underline truncate max-w-xs">${escapeHtml(title)}</span>
          ${note.modifiedTime ? `<span class="text-[10px] text-gray-400 font-normal shrink-0" title="最後編輯時間">🕒 ${new Date(note.modifiedTime).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
        </td>
        <td class="p-2.5 font-medium text-blue-600 dark:text-blue-400">🚜 ${escapeHtml(machine)}</td>
        <td class="p-2.5 font-medium text-amber-600 dark:text-amber-400">📋 ${escapeHtml(content)}</td>
        <td class="p-2.5">
          <span class="px-2 py-0.5 rounded text-[11px] font-bold ${urgencyClass}">${escapeHtml(urgency)}</span>
        </td>
        <td class="p-2.5 text-gray-500 font-mono text-[11px]">${dueDate || '<span class="text-gray-300 dark:text-gray-600">未排定</span>'}</td>
        <td class="p-2.5">
          <div class="flex flex-wrap gap-1">
            ${tags.map(t => `<span class="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300">${escapeHtml(t)}</span>`).join('')}
          </div>
        </td>
        <td class="p-2.5 text-center">
          <button class="table-open-btn p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 text-xs font-medium" title="開啟編輯">
            開啟
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (DOM.tableTotalCount) DOM.tableTotalCount.textContent = `總筆數: ${filteredNotes.length}`;

  DOM.tableViewTbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', (e) => {
      const noteId = tr.dataset.noteId;
      if (noteId) {
        selectNote(noteId);
        switchView('editor');
      }
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

  // 🖍️ 螢光筆功能 (Highlighter in Selection Toolbar)
  if (DOM.selHighlightBtn) {
    DOM.selHighlightBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (DOM.selHighlightPalette) {
        DOM.selHighlightPalette.classList.toggle('hidden');
      }
    });
  }

  document.querySelectorAll('.highlight-color-btn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // 阻止按鈕奪取焦點，確保選取文字範圍不被清除
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const color = btn.dataset.color;
      applyHighlight(color);
      if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
      if (DOM.selectionToolbar) DOM.selectionToolbar.classList.add('hidden');
    });
  });

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
  if (DOM.tableSearchInput) DOM.tableSearchInput.addEventListener('input', renderTableView);
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

  // 隨機 Emoji
  if (DOM.randomEmojiBtn) {
    DOM.randomEmojiBtn.addEventListener('click', () => {
      const rand = CURATED_EMOJIS[Math.floor(Math.random() * CURATED_EMOJIS.length)];
      DOM.noteEmojiBtn.textContent = rand;
      if (state.currentNote) state.currentNote.meta.icon = rand;
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



  // 媒體上傳按鈕 (圖片&影片)
  if (DOM.insertMediaBtn) {
    DOM.insertMediaBtn.addEventListener('click', () => {
      if (DOM.mediaUploadInput) DOM.mediaUploadInput.click();
    });
  }
  if (DOM.mbToolMedia) DOM.mbToolMedia.addEventListener('click', () => DOM.mediaUploadInput.click());

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
      if (DOM.genericFileUploadInput) DOM.genericFileUploadInput.click();
    });
  }
  if (DOM.mbToolFile) {
    DOM.mbToolFile.addEventListener('click', () => {
      if (DOM.genericFileUploadInput) DOM.genericFileUploadInput.click();
    });
  }

  if (DOM.genericFileUploadInput) {
    DOM.genericFileUploadInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      for (const f of files) {
        await uploadGenericFile(f);
      }
      DOM.genericFileUploadInput.value = '';
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

  // 手機底部工具列按鈕
  if (DOM.mbToolBold) {
    DOM.mbToolBold.addEventListener('click', () => {
      document.execCommand('bold');
    });
  }
  if (DOM.mbToolTodo) {
    DOM.mbToolTodo.addEventListener('click', () => {
      insertHtmlAtCursor('<div class="notion-todo-item"><input type="checkbox" class="notion-todo-checkbox"><span class="notion-todo-text">待辦事項內容</span></div><p><br></p>');
    });
  }
  if (DOM.mbToolList) {
    DOM.mbToolList.addEventListener('click', () => {
      document.execCommand('insertUnorderedList');
    });
  }
  if (DOM.mbToolCallout) {
    DOM.mbToolCallout.addEventListener('click', () => {
      insertHtmlAtCursor('<div class="notion-callout"><span class="notion-callout-icon">💡</span><div class="notion-callout-body">提醒重點...</div></div><p><br></p>');
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
  });

  DOM.exportDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.exportMenu.classList.toggle('hidden');
  });

  DOM.exportMdBtn.addEventListener('click', exportMarkdown);
  DOM.exportHtmlBtn.addEventListener('click', exportHTML);
  DOM.exportPdfBtn.addEventListener('click', exportPDF);

  // Emoji Picker
  DOM.noteEmojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.emojiPicker.classList.toggle('hidden');
  });
  document.querySelectorAll('.emoji-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.noteEmojiBtn.textContent = btn.textContent;
      DOM.emojiPicker.classList.add('hidden');
      if (state.currentNote) state.currentNote.meta.icon = btn.textContent;
      renderNotesList();
      renderBreadcrumbs();
      triggerAutoSaveDebounce();
    });
  });

  // 屬性修改事件
  DOM.noteTitle.addEventListener('focus', () => {
    state.titleBeforeEdit = DOM.noteTitle.value;
  });
  DOM.noteTitle.addEventListener('input', () => {
    DOM.headerTitle.textContent = DOM.noteTitle.value || '未命名筆記';
    renderBreadcrumbs();
    triggerAutoSaveDebounce();
  });
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
            if (state.currentNote && state.currentNote.id === noteId) DOM.noteStatusSelect.value = oldStatus;
            renderNotesList();
            renderCurrentView();
            triggerAutoSaveDebounce();
          }
        },
        redo: () => {
          const n = state.notes.find(note => note.id === noteId);
          if (n && n.meta) {
            n.meta.status = newStatus;
            if (state.currentNote && state.currentNote.id === noteId) DOM.noteStatusSelect.value = newStatus;
            renderNotesList();
            renderCurrentView();
            triggerAutoSaveDebounce();
          }
        }
      });
    }
  });

  // 畫布輸入事件與內容編輯回朔快照記錄
  DOM.editor.addEventListener('focus', () => {
    if (state.editorSnapshotBeforeEdit === null) {
      state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
    }
  });
  DOM.editor.addEventListener('input', (e) => {
    updateStats();
    renderOutline();
    handleSlashMenu(e);
    triggerAutoSaveDebounce();

    if (state.editorSnapshotBeforeEdit === null) {
      state.editorSnapshotBeforeEdit = DOM.editor.innerHTML;
    }
    if (editorInputTimer) clearTimeout(editorInputTimer);
    editorInputTimer = setTimeout(() => {
      const currentHtml = DOM.editor.innerHTML;
      if (state.editorSnapshotBeforeEdit !== null && currentHtml !== state.editorSnapshotBeforeEdit) {
        const oldHtml = state.editorSnapshotBeforeEdit;
        const newHtml = currentHtml;
        const noteId = state.currentNote ? state.currentNote.id : null;
        const noteTitle = state.currentNote && state.currentNote.name ? state.currentNote.name.replace(/\.md$/i, '') : '未命名筆記';

        recordAction({
          type: 'edit_content',
          title: '✍️ 編輯筆記內文',
          subtitle: `筆記：「${noteTitle}」`,
          noteId: noteId,
          undo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n) {
              n.content = oldHtml;
              if (state.currentNote && state.currentNote.id === noteId) {
                DOM.editor.innerHTML = oldHtml;
                try { enhanceMediaCollapsiblesAndDraggables(DOM.editor); } catch (e) { console.warn(e); }
                updateStats();
                renderOutline();
              }
              triggerAutoSaveDebounce();
            }
          },
          redo: () => {
            const n = state.notes.find(note => note.id === noteId);
            if (n) {
              n.content = newHtml;
              if (state.currentNote && state.currentNote.id === noteId) {
                DOM.editor.innerHTML = newHtml;
                try { enhanceMediaCollapsiblesAndDraggables(DOM.editor); } catch (e) { console.warn(e); }
                updateStats();
                renderOutline();
              }
              triggerAutoSaveDebounce();
            }
          }
        });
        state.editorSnapshotBeforeEdit = newHtml;
      }
    }, 800);
  });


  // 畫布與標題失焦時若有未存修改，立即觸發即時儲存 (Instant Blur Save)
  DOM.editor.addEventListener('blur', () => {
    if (state.isDirty && !state.isSaving) {
      saveCurrentNote();
    }
  });
  DOM.noteTitle.addEventListener('blur', () => {
    if (state.isDirty && !state.isSaving) {
      saveCurrentNote();
    }
  });

  // 關閉或重載視窗時安全提示
  window.addEventListener('beforeunload', (e) => {
    if (state.isDirty) {
      e.preventDefault();
      e.returnValue = '您有尚未同步至 Google Drive 的內容，確定要離開嗎？';
    }
  });

  // 畫布點擊事件（Todo 待辦打勾切換）
  DOM.editor.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('notion-todo-checkbox')) {
      const parent = e.target.closest('.notion-todo-item');
      if (parent) {
        const textSpan = parent.querySelector('.notion-todo-text');
        if (textSpan) {
          if (e.target.checked) {
            textSpan.classList.add('checked');
          } else {
            textSpan.classList.remove('checked');
          }
          triggerAutoSaveDebounce();
        }
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

  if (DOM.selectionToolbar) {
    DOM.selectionToolbar.querySelectorAll('button[data-cmd]').forEach(btn => {
      bindToolbarButton(btn, () => {
        let sel = window.getSelection();
        if ((!sel || sel.isCollapsed || !DOM.editor.contains(sel.anchorNode)) && savedSelectionRange) {
          sel.removeAllRanges();
          sel.addRange(savedSelectionRange);
        }
        sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;

        const cmd = btn.dataset.cmd;
        if (cmd === 'code') {
          document.execCommand('insertHTML', false, `<code>${escapeHtml(sel.toString())}</code>`);
        } else {
          document.execCommand(cmd, false, null);
        }
        triggerAutoSaveDebounce();
      });
    });

    bindToolbarButton(DOM.selTurnH1, () => turnSelectionInto('h1'));
    bindToolbarButton(DOM.selTurnH2, () => turnSelectionInto('h2'));
    bindToolbarButton(DOM.selTurnTodo, () => turnSelectionInto('todo'));
    bindToolbarButton(DOM.selTurnCallout, () => turnSelectionInto('callout'));

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
        applyHighlight(color);
        if (DOM.selHighlightPalette) DOM.selHighlightPalette.classList.add('hidden');
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

  // Space 鍵觸發 AI 提示框
  DOM.editor.addEventListener('keydown', (e) => {
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
    // Escape 鍵快速關閉所有彈跳視窗
    if (e.key === 'Escape') {
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
    if (isEditing) return; // 正在編輯輸入中，絕不干擾

    const elapsed = Date.now() - (state.lastSyncTime || 0);
    // 超過 60 秒未同步且沒有進行中修改，前景切換時靜默拉取最新資料
    if (elapsed > 60000 && !state.isDirty && !state.isSaving) {
      console.log('📱 頁面切換回前景，靜默同步最新筆記與分類...');
      fullSyncWithDrive(false);
    }
  }
});

window.addEventListener('focus', () => {
  if (state.accessToken && state.folderId) {
    const isEditing = document.activeElement === DOM.editor || DOM.editor.contains(document.activeElement);
    if (isEditing) return;

    const elapsed = Date.now() - (state.lastSyncTime || 0);
    if (elapsed > 60000 && !state.isDirty && !state.isSaving) {
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
