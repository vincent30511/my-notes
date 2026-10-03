/**
 * CloudNotes Pro - Notion 級別旗艦純淨所見即所得工作區核心邏輯
 * 包含：
 * 1. 無限層級資料夾樹狀目錄 (Nested Infinite Folders System)
 * 2. Notion 9 款經典膠囊配色標籤庫、下拉式快選標籤面板與全功能標籤管理員
 * 3. 頁面封面橫幅 (Page Cover Banner) 與 8 款 Notion 漸層預設
 * 4. 頂部即時麵包屑導航 (Breadcrumbs Navigation)
 * 5. 頁面圖示 (Page Icon) 與隨機 Emoji 產生器
 * 6. 斜線指令 (`/`) 浮動選單與 Notion 區塊 (Callout, Toggle, Todo, Table, Code, Divider)
 * 7. 純淨無網址所見即所得 (WYSIWYG) 編輯畫布
 * 8. 圖片/影音直接就地嵌入播放
 * 9. CloudNotes AI 智能助手 (Gemini 3.8)
 * 10. Google Drive 背景自動雙向同步與資料持久化
 */

// 經典 8 款 Notion 藝術漸層封面
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

// 預設 Notion 標籤調色盤
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

// 全域狀態
const state = {
  clientId: localStorage.getItem('cloudnotes_client_id') || DEFAULT_CLIENT_ID,
  userEmail: localStorage.getItem('cloudnotes_user_email') || DEFAULT_USER_EMAIL,
  folderName: localStorage.getItem('cloudnotes_folder_name') || 'DriveNotes',
  geminiApiKey: localStorage.getItem('cloudnotes_gemini_key') || '',
  folderId: null,
  accessToken: null,
  tokenClient: null,
  user: null,
  notes: [],
  currentNote: null,
  folders: [],
  tags: [],
  currentFolderId: null, // null 表示全部筆記
  currentTagFilter: null, // null 表示不篩選標籤
  folderModalMode: 'create', // create, create_sub, rename
  folderModalTargetId: null,
  isDirty: false,
  layoutMode: localStorage.getItem('cloudnotes_layout') || 'list',
  filterMode: 'all', // all, pinned, doing
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

  // AI 助手 (CloudNotes AI)
  toggleAiBtn: document.getElementById('toggle-ai-btn'),
  aiPanel: document.getElementById('ai-panel'),
  aiBackdrop: document.getElementById('ai-backdrop'),
  closeAiBtn: document.getElementById('close-ai-btn'),
  aiKeyBanner: document.getElementById('ai-key-banner'),
  aiKeyQuickInput: document.getElementById('ai-key-quick-input'),
  aiKeyQuickSave: document.getElementById('ai-key-quick-save'),
  aiBtnSummarize: document.getElementById('ai-btn-summarize'),
  aiBtnPolish: document.getElementById('ai-btn-polish'),
  aiBtnIdeas: document.getElementById('ai-btn-ideas'),
  aiBtnTranslate: document.getElementById('ai-btn-translate'),
  aiMessages: document.getElementById('ai-messages'),
  aiUserInput: document.getElementById('ai-user-input'),
  aiSendBtn: document.getElementById('ai-send-btn'),

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

  // 資料夾與標籤導航
  folderTree: document.getElementById('folder-tree'),
  addFolderBtn: document.getElementById('add-folder-btn'),
  sidebarTagsList: document.getElementById('sidebar-tags-list'),
  sidebarManageTagsBtn: document.getElementById('sidebar-manage-tags-btn'),

  // 頂部麵包屑與封面
  pageBreadcrumbs: document.getElementById('page-breadcrumbs'),
  pageCover: document.getElementById('page-cover'),
  addCoverBtn: document.getElementById('add-cover-btn'),
  changeCoverBtn: document.getElementById('change-cover-btn'),
  removeCoverBtn: document.getElementById('remove-cover-btn'),
  randomEmojiBtn: document.getElementById('random-emoji-btn'),

  // 頁首屬性
  noteEmojiBtn: document.getElementById('note-emoji-btn'),
  emojiPicker: document.getElementById('emoji-picker'),
  noteTitle: document.getElementById('note-title'),
  notePinBtn: document.getElementById('note-pin-btn'),
  deleteNoteBtn: document.getElementById('delete-note-btn'),
  noteFolderSelect: document.getElementById('note-folder-select'),
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
  toastMessage: document.getElementById('toast-message')
};

// 初始化入口
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLucide();
  initSettingsUI();
  initFolders();
  initTags();
  initLayout();
  initCoverPresetsUI();
  bindEvents();
  setupGoogleAuth();
  checkAiKeyStatus();
  renderNotesList();
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
  state.folderName = DOM.settingFolderName.value.trim() || 'DriveNotes';
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

  const targetEmail = state.userEmail || DEFAULT_USER_EMAIL;

  const checkGsi = setInterval(() => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      clearInterval(checkGsi);

      try {
        state.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: state.clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
          hint: targetEmail,
          callback: async (resp) => {
            if (resp.error) {
              if (resp.error === 'immediate_failed') {
                console.log('靜默授權未通過，等待使用者手動點擊登入');
                updateSyncStatus('offline', '未登入 Google');
                return;
              }
              if (resp.error === 'popup_closed_by_user') {
                showToast('登入視窗已關閉');
                updateSyncStatus('offline', '未登入');
                return;
              }
              if (resp.error === 'popup_failed_to_open') {
                showToast('⚠️ 瀏覽器攔截了登入彈跳視窗，請點擊網址列右側允許彈跳視窗後重試！', 5000);
                updateSyncStatus('error', '彈窗被攔截');
                return;
              }
              if (resp.error === 'access_denied') {
                showToast('存取授權遭取消');
                localStorage.removeItem('cloudnotes_authorized');
                updateSyncStatus('offline', '未登入');
                return;
              }
              console.error('Google 授權失敗:', resp);
              updateSyncStatus('error', '授權出錯');
              showToast('Google 授權失敗: ' + (resp.error || '未知錯誤') + '（請檢查網址來源是否已加入 Google Cloud 憑證）', 5000);
              return;
            }

            state.accessToken = resp.access_token;
            localStorage.setItem('cloudnotes_access_token', resp.access_token);
            localStorage.setItem('cloudnotes_authorized', 'true');
            const expiresIn = resp.expires_in ? parseInt(resp.expires_in, 10) : 3600;
            scheduleTokenRefresh(expiresIn);
            await onLoginSuccess();
          }
        });

        // 自動嘗試靜默登入指定的使用者帳號
        const cachedToken = localStorage.getItem('cloudnotes_access_token');
        if (cachedToken) {
          state.accessToken = cachedToken;
          onLoginSuccess().catch(() => {
            state.accessToken = null;
            localStorage.removeItem('cloudnotes_access_token');
            if (state.tokenClient) {
              state.tokenClient.requestAccessToken({ prompt: '', hint: targetEmail });
            }
          });
        } else if (localStorage.getItem('cloudnotes_authorized') === 'true') {
          updateSyncStatus('syncing', '正在自動連線...');
          state.tokenClient.requestAccessToken({ prompt: '', hint: targetEmail });
        } else {
          updateSyncStatus('offline', '未登入 Google');
        }
      } catch (err) {
        console.error('初始化 Google Token Client 錯誤:', err);
        updateSyncStatus('error', 'Google SDK 載入異常');
      }
    }
  }, 100);
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
  if (!state.clientId) {
    state.clientId = DEFAULT_CLIENT_ID;
    localStorage.setItem('cloudnotes_client_id', DEFAULT_CLIENT_ID);
  }

  const targetEmail = state.userEmail || DEFAULT_USER_EMAIL;

  if (state.tokenClient) {
    updateSyncStatus('syncing', '正在呼叫 Google 授權...');
    // 傳入 hint 指定 vincent30511@gmail.com，Google 將自動跳過「選擇使用者」畫面！
    state.tokenClient.requestAccessToken({
      hint: targetEmail
    });
  } else {
    showToast('Google 認證元件載入中，請稍候重試...');
    setupGoogleAuth();
  }
}

function handleLogout() {
  if (state.tokenRefreshTimer) clearTimeout(state.tokenRefreshTimer);
  if (state.accessToken && window.google && window.google.accounts && window.google.accounts.oauth2) {
    google.accounts.oauth2.revoke(state.accessToken, () => {});
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
  renderNotesList();
  clearEditor();
  showToast('已登出 Google 帳號');
}

async function onLoginSuccess() {
  DOM.loginBtn.classList.add('hidden');
  DOM.userProfile.classList.remove('hidden');
  updateSyncStatus('syncing', '連線中...');

  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    state.user = await res.json();
    if (state.user.picture) {
      DOM.userAvatar.src = state.user.picture;
    }
  } catch (e) {
    console.warn('獲取個人資料失敗:', e);
  }

  await ensureNotesFolder();
  await syncWorkspaceConfigWithDrive();
  await fetchNotesList();
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
async function ensureNotesFolder() {
  if (!state.accessToken) return;
  try {
    const query = `name = '${state.folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    const data = await res.json();
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
  } catch (e) {
    console.error('確認資料夾失敗:', e);
  }
}

async function syncWorkspaceConfigWithDrive() {
  if (!state.accessToken || !state.folderId) return;
  try {
    const q = `'${state.folderId}' in parents and name = 'cloudnotes_workspace_config.json' and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      const fileId = data.files[0].id;
      const getRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${state.accessToken}` }
      });
      const config = await getRes.json();
      if (Array.isArray(config.folders) && config.folders.length) {
        state.folders = config.folders;
        localStorage.setItem('cloudnotes_folders', JSON.stringify(state.folders));
      }
      if (Array.isArray(config.tags) && config.tags.length) {
        state.tags = config.tags;
        localStorage.setItem('cloudnotes_tags', JSON.stringify(state.tags));
      }
      renderFolderTree();
      renderFolderSelect();
      renderSidebarTags();
    } else {
      saveWorkspaceConfigToDrive();
    }
  } catch(e) {
    console.warn('同步工作區設定失敗:', e);
  }
}

async function saveWorkspaceConfigToDrive() {
  if (!state.accessToken || !state.folderId) return;
  try {
    const configData = JSON.stringify({
      folders: state.folders,
      tags: state.tags,
      updatedAt: new Date().toISOString()
    }, null, 2);

    const q = `'${state.folderId}' in parents and name = 'cloudnotes_workspace_config.json' and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    const data = await res.json();

    const boundary = '-------CloudNotesConfigBoundary7788';
    const delimiter = "
--" + boundary + "
";
    const closeDelimiter = "
--" + boundary + "--";

    let url, method;
    if (data.files && data.files.length > 0) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${data.files[0].id}?uploadType=multipart`;
      method = 'PATCH';
    } else {
      url = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;
      method = 'POST';
    }

    const metadata = {
      name: 'cloudnotes_workspace_config.json',
      mimeType: 'application/json',
      parents: [state.folderId]
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8

' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json

' +
      configData +
      closeDelimiter;

    await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });
  } catch(e) {
    console.warn('雲端儲存工作區設定失敗:', e);
  }
}

async function fetchNotesList() {
  if (!state.folderId || !state.accessToken) return;
  updateSyncStatus('syncing', '更新筆記清單...');

  try {
    const query = `'${state.folderId}' in parents and name != 'cloudnotes_workspace_config.json' and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,size,description)&orderBy=modifiedTime desc`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    const data = await res.json();
    
    state.notes = (data.files || []).map(file => {
      let meta = {
        icon: '📝',
        cover: null,
        status: '💡 構思中',
        folderId: null,
        tags: [],
        pinned: false
      };
      if (file.description) {
        try { Object.assign(meta, JSON.parse(file.description)); } catch(e) {}
      }
      return {
        ...file,
        meta
      };
    });

    renderFolderTree();
    renderSidebarTags();
    renderNotesList();
    updateSyncStatus('synced', '已同步');

    if (state.notes.length > 0 && !state.currentNote) {
      selectNote(state.notes[0].id);
    } else if (state.notes.length === 0) {
      createNewNote();
    }
  } catch (e) {
    console.error('載入筆記清單失敗:', e);
    updateSyncStatus('error', '同步出錯');
  }
}

// ----------------- 無限層級資料夾樹狀目錄核心 -----------------
function initFolders() {
  const saved = localStorage.getItem('cloudnotes_folders');
  if (saved) {
    try { state.folders = JSON.parse(saved); } catch(e) { state.folders = DEFAULT_FOLDERS; }
  } else {
    state.folders = DEFAULT_FOLDERS;
    saveFolders();
  }
  renderFolderTree();
  renderFolderSelect();
}

function saveFolders() {
  localStorage.setItem('cloudnotes_folders', JSON.stringify(state.folders));
  saveWorkspaceConfigToDrive();
}

function renderFolderTree() {
  if (!DOM.folderTree) return;
  DOM.folderTree.innerHTML = '';

  // 全部筆記根項目
  const allRow = document.createElement('div');
  allRow.className = `folder-item-row ${state.currentFolderId === null ? 'active' : ''}`;
  allRow.innerHTML = `
    <span class="w-4 h-4 flex items-center justify-center text-gray-400"><i data-lucide="layers" class="w-3.5 h-3.5"></i></span>
    <span class="font-medium truncate flex-1">全部筆記</span>
    <span class="text-[10px] text-gray-400">${state.notes.length}</span>
  `;
  allRow.onclick = () => {
    state.currentFolderId = null;
    state.currentTagFilter = null;
    if (DOM.notesListHeading) DOM.notesListHeading.textContent = '全部筆記';
    renderFolderTree();
    renderSidebarTags();
    renderNotesList();
    renderBreadcrumbs();
  };
  DOM.folderTree.appendChild(allRow);

  // 遞迴渲染無限樹狀節點
  function renderSubTree(parentId, level = 0) {
    const childFolders = state.folders.filter(f => f.parentId === parentId);
    if (!childFolders.length) return null;

    const container = document.createElement('div');
    if (level > 0) {
      container.className = 'folder-sub-tree';
    }

    childFolders.forEach(folder => {
      const node = document.createElement('div');
      node.className = 'folder-tree-node';

      const hasChildren = state.folders.some(f => f.parentId === folder.id);
      const notesInFolder = state.notes.filter(n => n.meta && n.meta.folderId === folder.id).length;
      const isActive = state.currentFolderId === folder.id;

      const row = document.createElement('div');
      row.className = `folder-item-row ${isActive ? 'active' : ''}`;
      row.style.paddingLeft = `${Math.min(level * 10, 40) + 4}px`;

      row.innerHTML = `
        <button class="folder-toggle-btn ${folder.isOpen ? 'open' : ''}" style="${hasChildren ? '' : 'visibility:hidden;'}" title="${folder.isOpen ? '收合' : '展開'}">
          <i data-lucide="chevron-right" class="w-3 h-3"></i>
        </button>
        <span class="text-amber-500">${folder.isOpen ? '📂' : '📁'}</span>
        <span class="truncate flex-1 font-medium">${escapeHtml(folder.name)}</span>
        <span class="text-[10px] text-gray-400 mr-1">${notesInFolder}</span>
        <div class="folder-quick-actions">
          <button class="folder-action-icon add-sub-btn" title="在內新增子資料夾"><i data-lucide="plus" class="w-3 h-3"></i></button>
          <button class="folder-action-icon rename-folder-btn" title="重命名"><i data-lucide="edit-2" class="w-3 h-3"></i></button>
          <button class="folder-action-icon delete-folder-btn text-red-500" title="刪除"><i data-lucide="trash" class="w-3 h-3"></i></button>
        </div>
      `;

      const toggleBtn = row.querySelector('.folder-toggle-btn');
      if (toggleBtn && hasChildren) {
        toggleBtn.onclick = (e) => {
          e.stopPropagation();
          folder.isOpen = !folder.isOpen;
          saveFolders();
          renderFolderTree();
        };
      }

      const addSubBtn = row.querySelector('.add-sub-btn');
      if (addSubBtn) {
        addSubBtn.onclick = (e) => {
          e.stopPropagation();
          openFolderModal('create_sub', folder.id);
        };
      }

      const renameBtn = row.querySelector('.rename-folder-btn');
      if (renameBtn) {
        renameBtn.onclick = (e) => {
          e.stopPropagation();
          openFolderModal('rename', folder.id);
        };
      }

      const deleteBtn = row.querySelector('.delete-folder-btn');
      if (deleteBtn) {
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          deleteFolder(folder.id);
        };
      }

      row.onclick = () => {
        state.currentFolderId = folder.id;
        state.currentTagFilter = null;
        if (DOM.notesListHeading) DOM.notesListHeading.textContent = folder.name;
        renderFolderTree();
        renderSidebarTags();
        renderNotesList();
        renderBreadcrumbs();
      };

      node.appendChild(row);

      if (folder.isOpen && hasChildren) {
        const sub = renderSubTree(folder.id, level + 1);
        if (sub) node.appendChild(sub);
      }

      container.appendChild(node);
    });

    return container;
  }

  const rootTree = renderSubTree(null, 0);
  if (rootTree) DOM.folderTree.appendChild(rootTree);
  initLucide();
}

function renderFolderSelect() {
  if (!DOM.noteFolderSelect) return;
  const currentVal = state.currentNote && state.currentNote.meta ? (state.currentNote.meta.folderId || '') : '';
  
  let html = '<option value="">📁 根目錄 (未分類)</option>';

  function buildOptions(parentId = null, prefix = '') {
    const list = state.folders.filter(f => f.parentId === parentId);
    list.forEach(f => {
      const isSelected = f.id === currentVal ? 'selected' : '';
      html += `<option value="${f.id}" ${isSelected}>${prefix}📁 ${escapeHtml(f.name)}</option>`;
      buildOptions(f.id, prefix + '　└─ ');
    });
  }

  buildOptions(null, '');
  DOM.noteFolderSelect.innerHTML = html;

  if (DOM.folderParentSelect) {
    let parentHtml = '<option value="">📁 根目錄 (最外層)</option>';
    function buildParentOptions(parentId = null, prefix = '') {
      const list = state.folders.filter(f => f.parentId === parentId);
      list.forEach(f => {
        parentHtml += `<option value="${f.id}">${prefix}📁 ${escapeHtml(f.name)}</option>`;
        buildParentOptions(f.id, prefix + '　└─ ');
      });
    }
    buildParentOptions(null, '');
    DOM.folderParentSelect.innerHTML = parentHtml;
  }
}

function openFolderModal(mode = 'create', targetId = null) {
  state.folderModalMode = mode;
  state.folderModalTargetId = targetId;

  if (mode === 'rename') {
    const folder = state.folders.find(f => f.id === targetId);
    if (!folder) return;
    DOM.folderModalTitle.innerHTML = '<i data-lucide="edit-2" class="w-4 h-4 text-amber-500"></i> 重命名資料夾';
    DOM.folderNameInput.value = folder.name;
    DOM.folderParentGroup.classList.add('hidden');
  } else if (mode === 'create_sub') {
    const parentFolder = state.folders.find(f => f.id === targetId);
    DOM.folderModalTitle.innerHTML = '<i data-lucide="folder-plus" class="w-4 h-4 text-amber-500"></i> 新增子資料夾';
    DOM.folderNameInput.value = '';
    DOM.folderParentGroup.classList.remove('hidden');
    renderFolderSelect();
    if (DOM.folderParentSelect) DOM.folderParentSelect.value = targetId || '';
  } else {
    DOM.folderModalTitle.innerHTML = '<i data-lucide="folder-plus" class="w-4 h-4 text-amber-500"></i> 新增資料夾';
    DOM.folderNameInput.value = '';
    DOM.folderParentGroup.classList.remove('hidden');
    renderFolderSelect();
    if (DOM.folderParentSelect) DOM.folderParentSelect.value = '';
  }

  DOM.folderModal.classList.remove('hidden');
  initLucide();
  DOM.folderNameInput.focus();
}

function closeFolderModal() {
  DOM.folderModal.classList.add('hidden');
}

function submitFolderModal() {
  const name = DOM.folderNameInput.value.trim();
  if (!name) {
    showToast('請輸入資料夾名稱');
    return;
  }

  if (state.folderModalMode === 'rename') {
    const folder = state.folders.find(f => f.id === state.folderModalTargetId);
    if (folder) {
      folder.name = name;
      showToast(`已重命名為「${name}」`);
    }
  } else {
    const parentId = DOM.folderParentSelect ? (DOM.folderParentSelect.value || null) : null;
    const newFolder = {
      id: 'f_' + Date.now(),
      name,
      parentId,
      isOpen: true,
      color: 'blue'
    };
    state.folders.push(newFolder);
    // 開啟上層資料夾
    if (parentId) {
      const parent = state.folders.find(f => f.id === parentId);
      if (parent) parent.isOpen = true;
    }
    showToast(`已建立資料夾「${name}」`);
  }

  saveFolders();
  renderFolderTree();
  renderFolderSelect();
  renderBreadcrumbs();
  closeFolderModal();
}

function deleteFolder(folderId) {
  const folder = state.folders.find(f => f.id === folderId);
  if (!folder) return;
  if (!confirm(`確定要刪除「${folder.name}」及其所有子資料夾嗎？（其內部的筆記將移至根目錄）`)) {
    return;
  }

  // 搜集所有子節點
  const toDelete = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    state.folders.forEach(f => {
      if (f.parentId && toDelete.has(f.parentId) && !toDelete.has(f.id)) {
        toDelete.add(f.id);
        changed = true;
      }
    });
  }

  // 移出筆記歸屬
  state.notes.forEach(note => {
    if (note.meta && toDelete.has(note.meta.folderId)) {
      note.meta.folderId = null;
    }
  });

  state.folders = state.folders.filter(f => !toDelete.has(f.id));
  if (toDelete.has(state.currentFolderId)) {
    state.currentFolderId = null;
  }

  saveFolders();
  renderFolderTree();
  renderFolderSelect();
  renderNotesList();
  renderBreadcrumbs();
  showToast(`已刪除「${folder.name}」`);
}

// ----------------- Notion 標籤管理與下拉面板 -----------------
function initTags() {
  const saved = localStorage.getItem('cloudnotes_tags');
  if (saved) {
    try { state.tags = JSON.parse(saved); } catch(e) { state.tags = DEFAULT_TAGS; }
  } else {
    state.tags = DEFAULT_TAGS;
    saveTags();
  }
  renderSidebarTags();
}

function saveTags() {
  localStorage.setItem('cloudnotes_tags', JSON.stringify(state.tags));
  saveWorkspaceConfigToDrive();
}

function getTagColor(tagName) {
  const found = state.tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
  return found ? found.color : 'blue';
}

function renderSidebarTags() {
  if (!DOM.sidebarTagsList) return;
  DOM.sidebarTagsList.innerHTML = '';

  if (!state.tags || !state.tags.length) {
    DOM.sidebarTagsList.innerHTML = '<span class="text-[11px] text-gray-400 italic">尚未建立標籤</span>';
    return;
  }

  state.tags.forEach(tag => {
    const count = state.notes.filter(n => n.meta && Array.isArray(n.meta.tags) && n.meta.tags.includes(tag.name)).length;
    const isFiltered = state.currentTagFilter === tag.name;
    const pill = document.createElement('button');
    pill.className = `notion-tag notion-tag-${tag.color} ${isFiltered ? 'ring-2 ring-blue-500 scale-105' : ''}`;
    pill.innerHTML = `<span>#${escapeHtml(tag.name)}</span><span class="text-[10px] opacity-75">(${count})</span>`;
    pill.onclick = () => {
      if (state.currentTagFilter === tag.name) {
        state.currentTagFilter = null;
        if (DOM.notesListHeading) DOM.notesListHeading.textContent = '筆記列表';
      } else {
        state.currentTagFilter = tag.name;
        if (DOM.notesListHeading) DOM.notesListHeading.textContent = `標籤: #${tag.name}`;
      }
      renderSidebarTags();
      renderNotesList();
    };
    DOM.sidebarTagsList.appendChild(pill);
  });
}

function renderNoteActiveTags() {
  if (!DOM.noteActiveTags) return;
  DOM.noteActiveTags.innerHTML = '';

  if (!state.currentNote || !state.currentNote.meta || !Array.isArray(state.currentNote.meta.tags) || !state.currentNote.meta.tags.length) {
    return;
  }

  state.currentNote.meta.tags.forEach(tagName => {
    const color = getTagColor(tagName);
    const badge = document.createElement('span');
    badge.className = `notion-tag notion-tag-${color}`;
    badge.innerHTML = `
      <span>#${escapeHtml(tagName)}</span>
      <span class="tag-remove-btn" title="移除標籤">&times;</span>
    `;
    badge.querySelector('.tag-remove-btn').onclick = (e) => {
      e.stopPropagation();
      state.currentNote.meta.tags = state.currentNote.meta.tags.filter(t => t !== tagName);
      renderNoteActiveTags();
      renderSidebarTags();
      triggerAutoSaveDebounce();
    };
    DOM.noteActiveTags.appendChild(badge);
  });
}

function renderTagDropdownPopover(searchQuery = '') {
  if (!DOM.tagOptionsList) return;
  DOM.tagOptionsList.innerHTML = '';

  const currentTags = (state.currentNote && state.currentNote.meta && state.currentNote.meta.tags) || [];
  const q = searchQuery.trim().toLowerCase();

  const filtered = state.tags.filter(t => !q || t.name.toLowerCase().includes(q));

  if (!filtered.length && !q) {
    DOM.tagOptionsList.innerHTML = '<div class="text-[11px] text-gray-400 py-1 text-center">暫無標籤，可立即新增</div>';
  } else {
    filtered.forEach(tag => {
      const isChecked = currentTags.includes(tag.name);
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-xs transition';
      item.innerHTML = `
        <span class="notion-tag notion-tag-${tag.color}">#${escapeHtml(tag.name)}</span>
        <span class="text-blue-600 font-bold ${isChecked ? '' : 'invisible'}">✓</span>
      `;
      item.onclick = (e) => {
        e.stopPropagation();
        if (isChecked) {
          state.currentNote.meta.tags = state.currentNote.meta.tags.filter(t => t !== tag.name);
        } else {
          if (!state.currentNote.meta.tags) state.currentNote.meta.tags = [];
          state.currentNote.meta.tags.push(tag.name);
        }
        renderNoteActiveTags();
        renderSidebarTags();
        renderTagDropdownPopover(DOM.tagSearchInput ? DOM.tagSearchInput.value : '');
        triggerAutoSaveDebounce();
      };
      DOM.tagOptionsList.appendChild(item);
    });
  }

  // 若搜尋詞不存在於現有標籤中，提供「+ 建立並套用」列
  const exactMatch = state.tags.some(t => t.name.toLowerCase() === q);
  if (q && !exactMatch && DOM.tagCreateRow) {
    DOM.tagCreateRow.classList.remove('hidden');
    if (DOM.tagNewNamePreview) DOM.tagNewNamePreview.textContent = q;
  } else if (DOM.tagCreateRow) {
    DOM.tagCreateRow.classList.add('hidden');
  }
}

function openTagManagerModal() {
  if (DOM.tagDropdownPopover) DOM.tagDropdownPopover.classList.add('hidden');
  renderTagManagerList();
  DOM.tagManagerModal.classList.remove('hidden');
  initLucide();
}

function closeTagManagerModal() {
  DOM.tagManagerModal.classList.add('hidden');
  renderSidebarTags();
  renderNoteActiveTags();
}

function renderTagManagerList() {
  if (!DOM.tmTagsList) return;
  DOM.tmTagsList.innerHTML = '';

  if (!state.tags || !state.tags.length) {
    DOM.tmTagsList.innerHTML = '<div class="text-center py-6 text-gray-400 text-xs">目前沒有任何標籤</div>';
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
      // 批次同步所有筆記內的舊標籤名
      state.notes.forEach(note => {
        if (note.meta && Array.isArray(note.meta.tags)) {
          note.meta.tags = note.meta.tags.map(t => t === oldName ? newName : t);
        }
      });
      saveTags();
      renderTagManagerList();
      showToast(`標籤已更名為「#${newName}」`);
    });

    const colorSelect = row.querySelector('.tag-color-select');
    colorSelect.addEventListener('change', () => {
      tag.color = colorSelect.value;
      saveTags();
      renderTagManagerList();
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
      renderTagManagerList();
      showToast(`已刪除標籤「#${tag.name}」`);
    });

    DOM.tmTagsList.appendChild(row);
  });

  initLucide();
}

// ----------------- Notion 頁面封面橫幅 -----------------
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

// ----------------- Notion 頂部麵包屑導航 -----------------
function renderBreadcrumbs() {
  if (!DOM.pageBreadcrumbs) return;
  DOM.pageBreadcrumbs.innerHTML = '';

  const rootItem = document.createElement('span');
  rootItem.className = 'notion-breadcrumb-item';
  rootItem.innerHTML = '<i data-lucide="home" class="w-3 h-3"></i> 全部筆記';
  rootItem.onclick = () => {
    state.currentFolderId = null;
    state.currentTagFilter = null;
    if (DOM.notesListHeading) DOM.notesListHeading.textContent = '全部筆記';
    renderFolderTree();
    renderSidebarTags();
    renderNotesList();
    renderBreadcrumbs();
  };
  DOM.pageBreadcrumbs.appendChild(rootItem);

  if (state.currentNote) {
    const folderId = state.currentNote.meta ? state.currentNote.meta.folderId : null;
    if (folderId) {
      const chain = [];
      let cur = state.folders.find(f => f.id === folderId);
      while (cur) {
        chain.unshift(cur);
        cur = state.folders.find(f => f.id === cur.parentId);
      }

      chain.forEach(folder => {
        const sep = document.createElement('span');
        sep.className = 'text-gray-300 dark:text-gray-600';
        sep.textContent = '/';
        DOM.pageBreadcrumbs.appendChild(sep);

        const folderItem = document.createElement('span');
        folderItem.className = 'notion-breadcrumb-item';
        folderItem.innerHTML = `<i data-lucide="folder" class="w-3 h-3 text-amber-500"></i> ${escapeHtml(folder.name)}`;
        folderItem.onclick = () => {
          state.currentFolderId = folder.id;
          state.currentTagFilter = null;
          if (DOM.notesListHeading) DOM.notesListHeading.textContent = folder.name;
          renderFolderTree();
          renderSidebarTags();
          renderNotesList();
          renderBreadcrumbs();
        };
        DOM.pageBreadcrumbs.appendChild(folderItem);
      });
    }

    const sepNote = document.createElement('span');
    sepNote.className = 'text-gray-300 dark:text-gray-600';
    sepNote.textContent = '/';
    DOM.pageBreadcrumbs.appendChild(sepNote);

    const noteItem = document.createElement('span');
    noteItem.className = 'notion-breadcrumb-item font-semibold text-gray-800 dark:text-gray-200';
    const noteIcon = (state.currentNote.meta && state.currentNote.meta.icon) || '📝';
    const noteTitle = (state.currentNote.name || '未命名').replace(/\.md$/i, '');
    noteItem.innerHTML = `<span>${noteIcon}</span> <span class="truncate max-w-[200px]">${escapeHtml(noteTitle)}</span>`;
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

  DOM.uploadProgressBar.classList.remove('hidden');
  DOM.uploadProgressBar.style.width = '25%';
  updateSyncStatus('syncing', '正在上傳媒體至 Google Drive...');

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');

  // 在光標處先插入暫存預覽骨架
  const placeholderId = 'media_loading_' + Date.now();
  let loadingHtml = `<div id="${placeholderId}" class="p-3 my-2 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-400 flex items-center gap-2 animate-pulse"><i data-lucide="loader" class="w-4 h-4 animate-spin"></i> 上傳中：${escapeHtml(file.name)}...</div>`;
  insertHtmlAtCursor(loadingHtml);
  initLucide();

  try {
    const boundary = '-------CloudNotesMediaBoundary8899';
    const delimiter = "
--" + boundary + "
";
    const closeDelimiter = "
--" + boundary + "--";

    const metadata = {
      name: file.name,
      parents: [state.folderId]
    };

    DOM.uploadProgressBar.style.width = '50%';

    const reader = new FileReader();
    const fileData = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

    const metadataPart = delimiter +
      'Content-Type: application/json; charset=UTF-8

' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${file.type || 'application/octet-stream'}
` +
      'Content-Transfer-Encoding: base64

' +
      btoa(new Uint8Array(fileData).reduce((data, byte) => data + String.fromCharCode(byte), '')) +
      closeDelimiter;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: metadataPart
    });

    DOM.uploadProgressBar.style.width = '80%';
    const uploadedFile = await res.json();

    // 設為任何人可讀
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

    updateSyncStatus('synced', '媒體已就地渲染');
    showToast(`✅ ${file.name} 已就地嵌入`);
    triggerAutoSaveDebounce();
  } catch (err) {
    console.error('上傳媒體失敗:', err);
    DOM.uploadProgressBar.classList.add('hidden');
    updateSyncStatus('error', '媒體上傳失敗');
    const placeholder = document.getElementById(placeholderId);
    if (placeholder) {
      placeholder.outerHTML = `<div class="text-red-500 text-xs p-2">⚠️ ${escapeHtml(file.name)} 上傳失敗</div>`;
    }
  }
}

function insertHtmlAtCursor(html) {
  DOM.editor.focus();
  const sel = window.getSelection();
  if (sel.getRangeAt && sel.rangeCount) {
    let range = sel.getRangeAt(0);
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
    DOM.editor.innerHTML += html;
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
  if (!state.geminiApiKey) {
    DOM.aiKeyBanner.classList.remove('hidden');
  } else {
    DOM.aiKeyBanner.classList.add('hidden');
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

// ----------------- Notion 模板庫 -----------------
function applyTemplate(type) {
  const templates = {
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
        <p>建立對標 Notion 的高品質個人雲端筆記工作區。</p>
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
  const match = rawContent.match(/^---
?
([\s\S]*?)
?
---
?
([\s\S]*)$/);
  if (!match) return { meta: {}, body: rawContent };

  const frontmatterStr = match[1];
  const body = match[2];
  const meta = {};

  frontmatterStr.split('
').forEach(line => {
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
  if (meta.status) lines.push(`status: ${meta.status}`);
  if (meta.folderId) lines.push(`folderId: ${meta.folderId}`);
  if (meta.pinned) lines.push(`pinned: ${meta.pinned}`);
  if (meta.tags && meta.tags.length) lines.push(`tags: ${JSON.stringify(meta.tags)}`);
  lines.push('---');
  lines.push('');
  return lines.join('
');
}

// ----------------- 筆記清單渲染 -----------------
function renderNotesList() {
  if (!DOM.notesList) return;
  DOM.notesList.innerHTML = '';

  let filtered = state.notes.slice();

  // 1. 資料夾過濾
  if (state.currentFolderId) {
    filtered = filtered.filter(n => n.meta && n.meta.folderId === state.currentFolderId);
  }

  // 2. 標籤過濾
  if (state.currentTagFilter) {
    filtered = filtered.filter(n => n.meta && Array.isArray(n.meta.tags) && n.meta.tags.includes(state.currentTagFilter));
  }

  // 3. 分類標籤篩選
  if (state.filterMode === 'pinned') {
    filtered = filtered.filter(n => n.meta && n.meta.pinned);
  } else if (state.filterMode === 'doing') {
    filtered = filtered.filter(n => n.meta && n.meta.status && n.meta.status.includes('進行中'));
  }

  // 4. 關鍵字搜尋
  const query = DOM.searchInput ? DOM.searchInput.value.trim().toLowerCase() : '';
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
    const icon = (note.meta && note.meta.icon) || '📝';
    const isPinned = note.meta && note.meta.pinned;

    const tagBadges = (note.meta.tags || []).slice(0, 2).map(tag => {
      const color = getTagColor(tag);
      return `<span class="notion-tag notion-tag-${color}" style="font-size:9px; padding: 0 4px;">#${escapeHtml(tag)}</span>`;
    }).join(' ');

    const dateStr = note.modifiedTime ? new Date(note.modifiedTime).toLocaleDateString([], { month: 'numeric', day: 'numeric' }) : '';

    item.innerHTML = `
      <div class="flex items-start justify-between gap-1 mb-1">
        <div class="flex items-center space-x-1.5 truncate">
          <span class="text-sm shrink-0">${icon}</span>
          <span class="font-medium text-xs text-gray-800 dark:text-gray-100 truncate">${escapeHtml(cleanTitle)}</span>
        </div>
        ${isPinned ? '<span class="text-amber-500 text-[10px] shrink-0">📌</span>' : ''}
      </div>
      <div class="flex items-center justify-between text-[10px] text-gray-400 mt-1">
        <div class="truncate max-w-[120px]">${tagBadges}</div>
        <span class="shrink-0">${dateStr}</span>
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

  DOM.editor.innerHTML = '<p class="text-gray-400">載入中...</p>';
  DOM.noteTitle.value = noteMeta.name.replace(/\.md$/i, '');
  DOM.headerTitle.textContent = DOM.noteTitle.value;

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${noteId}?alt=media`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    const rawText = await res.text();
    const { meta, body } = parseFrontmatter(rawText);

    state.currentNote = {
      id: noteMeta.id,
      name: noteMeta.name,
      meta: { ...noteMeta.meta, ...meta }
    };

    DOM.noteEmojiBtn.textContent = state.currentNote.meta.icon || '📝';
    DOM.noteStatusSelect.value = state.currentNote.meta.status || '💡 構思中';
    if (DOM.noteFolderSelect) DOM.noteFolderSelect.value = state.currentNote.meta.folderId || '';

    updatePinButtonUI(state.currentNote.meta.pinned);
    renderPageCover();
    renderNoteActiveTags();
    renderBreadcrumbs();

    // 將 Markdown 轉化為 HTML 裝載於畫布中，使圖片/影片就地呈現，隱藏底層網址
    const renderedHtml = window.marked ? window.marked.parse(body) : body;
    DOM.editor.innerHTML = DOMPurify.sanitize(renderedHtml, {
      ADD_TAGS: ['iframe', 'video', 'audio', 'source', 'details', 'summary', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'input', 'hr', 'div', 'span'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'controls', 'width', 'height', 'class', 'preload', 'type', 'open', 'checked', 'style', 'contenteditable']
    });

    attachCodeCopyButtons();
    updateStats();
    renderOutline();
    renderNotesList();
    state.isDirty = false;
  } catch (e) {
    console.error('讀取筆記失敗:', e);
    DOM.editor.innerHTML = '<p class="text-red-500">載入失敗，請重試。</p>';
  }
}

function createNewNote() {
  const newNote = {
    id: null,
    name: '未命名筆記.md',
    meta: {
      icon: '📝',
      cover: null,
      status: '💡 構思中',
      folderId: state.currentFolderId || null,
      tags: state.currentTagFilter ? [state.currentTagFilter] : ['靈感'],
      pinned: false
    }
  };

  state.currentNote = newNote;
  DOM.noteTitle.value = '未命名筆記';
  DOM.headerTitle.textContent = '未命名筆記';
  DOM.noteEmojiBtn.textContent = '📝';
  DOM.noteStatusSelect.value = '💡 構思中';
  if (DOM.noteFolderSelect) DOM.noteFolderSelect.value = state.currentFolderId || '';

  renderPageCover();
  renderNoteActiveTags();
  renderBreadcrumbs();
  updatePinButtonUI(false);

  DOM.editor.innerHTML = '<p><br></p>';
  DOM.editor.focus();

  updateStats();
  renderOutline();
  showToast('已建立新筆記！輸入內容自動同步至 Google Drive');
  triggerAutoSaveDebounce();
}

function triggerAutoSaveDebounce() {
  state.isDirty = true;
  DOM.statAutosave.innerHTML = '<i data-lucide="loader" class="w-3 h-3 text-blue-500 animate-spin"></i> 準備自動儲存...';
  initLucide();

  if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = setTimeout(() => {
    saveCurrentNote();
  }, 1200);
}

function convertHtmlToMarkdown(html) {
  if (window.TurndownService) {
    const td = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced'
    });
    td.keep(['iframe', 'video', 'audio', 'source', 'details', 'summary', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span']);
    return td.turndown(html);
  }
  return html.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1

')
             .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1

')
             .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1

')
             .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1

')
             .replace(/<br\s*\/?>/gi, '
');
}

async function saveCurrentNote() {
  if (!state.accessToken) return;
  if (!state.folderId) await ensureNotesFolder();

  updateSyncStatus('syncing', '儲存至 Google Drive...');

  let title = DOM.noteTitle.value.trim() || '未命名筆記';
  DOM.headerTitle.textContent = title;
  if (!title.toLowerCase().endsWith('.md')) title += '.md';

  const meta = {
    icon: DOM.noteEmojiBtn.textContent,
    cover: state.currentNote && state.currentNote.meta ? state.currentNote.meta.cover : null,
    status: DOM.noteStatusSelect.value,
    folderId: DOM.noteFolderSelect ? (DOM.noteFolderSelect.value || null) : null,
    tags: (state.currentNote && state.currentNote.meta && state.currentNote.meta.tags) || [],
    pinned: state.currentNote ? state.currentNote.meta.pinned : false
  };

  const markdownBody = convertHtmlToMarkdown(DOM.editor.innerHTML);
  const fullContent = buildFrontmatterString(meta) + markdownBody;

  try {
    const boundary = '-------CloudNotesBoundary7788';
    const delimiter = "
--" + boundary + "
";
    const closeDelimiter = "
--" + boundary + "--";

    let url;
    let method;
    let metadata = {
      name: title,
      description: JSON.stringify(meta)
    };

    if (state.currentNote && state.currentNote.id) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${state.currentNote.id}?uploadType=multipart`;
      method = 'PATCH';
    } else {
      url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      method = 'POST';
      if (state.folderId) {
        metadata.parents = [state.folderId];
      }
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8

' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/markdown; charset=UTF-8

' +
      fullContent +
      closeDelimiter;

    const res = await fetch(url, {
      method: method,
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    const savedFile = await res.json();

    if (!state.currentNote || !state.currentNote.id) {
      state.currentNote = {
        id: savedFile.id,
        name: title,
        meta: meta
      };
      state.notes.unshift(state.currentNote);
    } else {
      state.currentNote.name = title;
      state.currentNote.meta = meta;
      const idx = state.notes.findIndex(n => n.id === state.currentNote.id);
      if (idx !== -1) {
        state.notes[idx] = { ...state.notes[idx], name: title, meta: meta, modifiedTime: new Date().toISOString() };
      }
    }

    updateSyncStatus('synced', '已儲存');
    DOM.statAutosave.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-emerald-500"></i> 已自動同步至 Google Drive';
    initLucide();
    renderFolderTree();
    renderSidebarTags();
    renderNotesList();
    renderBreadcrumbs();
    state.isDirty = false;
  } catch (e) {
    console.error('儲存筆記失敗:', e);
    updateSyncStatus('error', '儲存失敗');
    DOM.statAutosave.innerHTML = '<i data-lucide="alert-circle" class="w-3 h-3 text-red-500"></i> 同步失敗';
    initLucide();
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

    state.notes = state.notes.filter(n => n.id !== state.currentNote.id);
    state.currentNote = null;
    clearEditor();
    renderFolderTree();
    renderSidebarTags();
    renderNotesList();
    renderBreadcrumbs();
    updateSyncStatus('synced', '已刪除');
    showToast('筆記已移至垃圾桶');

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
    case 'ai':
      toggleAiPanel();
      return;
    case 'media':
      DOM.mediaUploadInput.click();
      return;
    case 'toggle':
      html = '<details><summary>點擊展開 / 收合內容</summary><div style="padding: 6px 0 0 16px;">在此輸入詳細內容...</div></details><p><br></p>';
      break;
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
      html = '<pre><code>// 在此輸入代碼
console.log("Hello Notion");</code></pre><p><br></p>';
      break;
  }

  if (html) {
    insertHtmlAtCursor(html);
    attachCodeCopyButtons();
    triggerAutoSaveDebounce();
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
function bindEvents() {
  DOM.themeToggleBtn.addEventListener('click', toggleTheme);
  DOM.settingsBtn.addEventListener('click', openSettings);
  DOM.closeSettingsBtn.addEventListener('click', closeSettings);
  DOM.saveSettingsBtn.addEventListener('click', saveSettings);
  DOM.loginBtn.addEventListener('click', handleLogin);
  DOM.logoutBtn.addEventListener('click', handleLogout);
  DOM.newNoteBtn.addEventListener('click', createNewNote);
  DOM.deleteNoteBtn.addEventListener('click', deleteCurrentNote);
  DOM.notePinBtn.addEventListener('click', togglePin);
  DOM.refreshBtn.addEventListener('click', fetchNotesList);

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
        renderFolderTree();
        renderBreadcrumbs();
        triggerAutoSaveDebounce();
      }
    });
  }

  // ✨ AI 助手開關
  DOM.toggleAiBtn.addEventListener('click', toggleAiPanel);
  DOM.closeAiBtn.addEventListener('click', closeAiPanel);
  if (DOM.aiBackdrop) DOM.aiBackdrop.addEventListener('click', closeAiPanel);
  if (DOM.mbToolAi) DOM.mbToolAi.addEventListener('click', toggleAiPanel);

  // 模板選單
  DOM.templateDropdownBtn.addEventListener('click', () => {
    DOM.templateMenu.classList.toggle('hidden');
  });
  document.querySelectorAll('#template-menu button').forEach(btn => {
    btn.addEventListener('click', () => {
      applyTemplate(btn.dataset.tpl);
    });
  });

  // AI Key 快速儲存
  DOM.aiKeyQuickSave.addEventListener('click', () => {
    const key = DOM.aiKeyQuickInput.value.trim();
    if (key) {
      state.geminiApiKey = key;
      localStorage.setItem('cloudnotes_gemini_key', key);
      DOM.settingGeminiKey.value = key;
      DOM.aiKeyBanner.classList.add('hidden');
      showToast('Gemini API Key 已儲存！');
    }
  });

  // AI 快捷按鈕
  DOM.aiBtnSummarize.addEventListener('click', () => {
    sendAiMessage('請為我摘要這篇筆記的核心要點，以條列式清晰呈現。', 'summarize');
  });
  DOM.aiBtnPolish.addEventListener('click', () => {
    sendAiMessage('請幫我潤飾文字表達，修訂語病並改善閱讀流暢度。', 'polish');
  });
  DOM.aiBtnIdeas.addEventListener('click', () => {
    sendAiMessage('根據這篇內容，提出 3 個深入思考的延伸問題或創意切入點。', 'ideas');
  });
  DOM.aiBtnTranslate.addEventListener('click', () => {
    sendAiMessage('請將內容精確翻譯（繁體中文 ⇋ 英文流暢對譯）。', 'translate');
  });

  // AI 自訂發送
  DOM.aiSendBtn.addEventListener('click', () => {
    const text = DOM.aiUserInput.value.trim();
    if (text) sendAiMessage(text);
  });
  DOM.aiUserInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const text = DOM.aiUserInput.value.trim();
      if (text) sendAiMessage(text);
    }
  });

  // 媒體上傳按鈕
  DOM.insertMediaBtn.addEventListener('click', () => DOM.mediaUploadInput.click());
  if (DOM.mbToolMedia) DOM.mbToolMedia.addEventListener('click', () => DOM.mediaUploadInput.click());

  DOM.mediaUploadInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    for (const f of files) {
      await uploadMediaFile(f);
    }
    DOM.mediaUploadInput.value = '';
  });

  // 剪貼簿貼上圖片
  DOM.editor.addEventListener('paste', async (e) => {
    const items = (e.clipboardData || window.clipboardData).items;
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/'))) {
          e.preventDefault();
          await uploadMediaFile(file);
        }
      }
    }
  });

  // 拖曳圖影音
  DOM.editor.addEventListener('dragover', (e) => e.preventDefault());
  DOM.editor.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files) {
      for (const file of e.dataTransfer.files) {
        if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
          await uploadMediaFile(file);
        }
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

  // 篩選 Tabs
  DOM.filterAllBtn.addEventListener('click', () => {
    state.filterMode = 'all';
    state.currentTagFilter = null;
    updateFilterTabUI(DOM.filterAllBtn);
    renderNotesList();
  });
  DOM.filterPinnedBtn.addEventListener('click', () => {
    state.filterMode = 'pinned';
    updateFilterTabUI(DOM.filterPinnedBtn);
    renderNotesList();
  });
  DOM.filterDoingBtn.addEventListener('click', () => {
    state.filterMode = 'doing';
    updateFilterTabUI(DOM.filterDoingBtn);
    renderNotesList();
  });

  DOM.layoutListBtn.addEventListener('click', () => setLayout('list'));
  DOM.layoutGridBtn.addEventListener('click', () => setLayout('grid'));

  DOM.searchInput.addEventListener('input', renderNotesList);

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
  DOM.noteTitle.addEventListener('input', () => {
    DOM.headerTitle.textContent = DOM.noteTitle.value || '未命名筆記';
    renderBreadcrumbs();
    triggerAutoSaveDebounce();
  });
  DOM.noteStatusSelect.addEventListener('change', () => {
    if (state.currentNote) state.currentNote.meta.status = DOM.noteStatusSelect.value;
    renderNotesList();
    triggerAutoSaveDebounce();
  });

  // 畫布輸入事件
  DOM.editor.addEventListener('input', (e) => {
    updateStats();
    renderOutline();
    handleSlashMenu(e);
    triggerAutoSaveDebounce();
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

  // 快捷鍵 (Ctrl+S, Ctrl+N)
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentNote();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      createNewNote();
    }
  });
}

function updateFilterTabUI(activeBtn) {
  [DOM.filterAllBtn, DOM.filterPinnedBtn, DOM.filterDoingBtn].forEach(b => {
    b.className = 'px-2 py-0.5 rounded font-medium hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0';
  });
  activeBtn.className = 'px-2 py-0.5 rounded font-medium bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white shrink-0';
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}
