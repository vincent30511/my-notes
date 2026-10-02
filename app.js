/**
 * CloudNotes Pro - 對標 Notion 的靜態筆記工作區核心邏輯
 * 包含：Frontmatter 屬性系統 (Emoji/狀態/標籤/置頂)、Slash 指令選單、大綱目錄 (TOC)、
 *      自動儲存、字數統計、清單/畫廊雙檢視、多格式匯出 (MD/HTML/PDF)、Google Drive API v3 同步
 */

// 全域狀態
const state = {
  clientId: localStorage.getItem('cloudnotes_client_id') || '',
  folderName: localStorage.getItem('cloudnotes_folder_name') || 'DriveNotes',
  folderId: null,
  accessToken: null,
  tokenClient: null,
  user: null,
  notes: [], // 包含 parsed metadata
  currentNote: null,
  isDirty: false,
  viewMode: 'split', // 'split' | 'edit' | 'preview'
  layoutMode: localStorage.getItem('cloudnotes_layout') || 'list', // 'list' | 'grid'
  filterMode: 'all', // 'all' | 'pinned' | 'doing'
  theme: localStorage.getItem('cloudnotes_theme') || 'light',
  autoSaveTimer: null
};

// DOM 元素引用
const DOM = {
  // 導覽列
  headerFolder: document.getElementById('header-folder-name'),
  headerTitle: document.getElementById('header-note-title'),
  syncStatus: document.getElementById('sync-status'),
  syncIndicator: document.getElementById('sync-indicator'),
  syncText: document.getElementById('sync-text'),
  viewSplitBtn: document.getElementById('view-split-btn'),
  viewEditBtn: document.getElementById('view-edit-btn'),
  viewPreviewBtn: document.getElementById('view-preview-btn'),
  exportDropdownBtn: document.getElementById('export-dropdown-btn'),
  exportMenu: document.getElementById('export-menu'),
  exportMdBtn: document.getElementById('export-md-btn'),
  exportHtmlBtn: document.getElementById('export-html-btn'),
  exportPdfBtn: document.getElementById('export-pdf-btn'),
  toggleOutlineBtn: document.getElementById('toggle-outline-btn'),
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  settingsBtn: document.getElementById('settings-btn'),
  loginBtn: document.getElementById('login-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  userProfile: document.getElementById('user-profile'),
  userAvatar: document.getElementById('user-avatar'),

  // 側邊欄
  sidebar: document.getElementById('sidebar'),
  toggleSidebarBtn: document.getElementById('toggle-sidebar-btn'),
  newNoteBtn: document.getElementById('new-note-btn'),
  searchInput: document.getElementById('search-input'),
  filterAllBtn: document.getElementById('filter-all-btn'),
  filterPinnedBtn: document.getElementById('filter-pinned-btn'),
  filterDoingBtn: document.getElementById('filter-doing-btn'),
  layoutListBtn: document.getElementById('layout-list-btn'),
  layoutGridBtn: document.getElementById('layout-grid-btn'),
  notesList: document.getElementById('notes-list'),
  notesLoading: document.getElementById('notes-loading'),
  sidebarFolderLabel: document.getElementById('sidebar-folder-label'),
  refreshBtn: document.getElementById('refresh-btn'),

  // 頁首屬性 (Page Header & Properties)
  noteEmojiBtn: document.getElementById('note-emoji-btn'),
  emojiPicker: document.getElementById('emoji-picker'),
  noteTitle: document.getElementById('note-title'),
  notePinBtn: document.getElementById('note-pin-btn'),
  deleteNoteBtn: document.getElementById('delete-note-btn'),
  noteStatusSelect: document.getElementById('note-status-select'),
  noteTagsInput: document.getElementById('note-tags-input'),
  noteLastEdited: document.getElementById('note-last-edited'),

  // 編輯與預覽區
  editorWrapper: document.getElementById('editor-wrapper'),
  previewWrapper: document.getElementById('preview-wrapper'),
  markdownInput: document.getElementById('markdown-input'),
  previewContent: document.getElementById('preview-content'),
  slashMenu: document.getElementById('slash-menu'),
  outlinePanel: document.getElementById('outline-panel'),
  outlineList: document.getElementById('outline-list'),

  // 統計頁尾
  statWords: document.getElementById('stat-words'),
  statChars: document.getElementById('stat-chars'),
  statTime: document.getElementById('stat-time'),
  statAutosave: document.getElementById('stat-autosave'),

  // 設定 Modal & Toast
  settingsModal: document.getElementById('settings-modal'),
  closeSettingsBtn: document.getElementById('close-settings-btn'),
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  settingClientId: document.getElementById('setting-client-id'),
  settingFolderName: document.getElementById('setting-folder-name'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initLucide();
  initSettingsUI();
  initLayout();
  initViewModes();
  bindEvents();
  setupGoogleAuth();
});

function initLucide() {
  if (window.lucide) window.lucide.createIcons();
}

function initTheme() {
  if (state.theme === 'dark' || (!('cloudnotes_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    state.theme = 'dark';
  } else {
    document.documentElement.classList.remove('dark');
    state.theme = 'light';
  }
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('cloudnotes_theme', state.theme);
  initTheme();
}

function showToast(message, duration = 3000) {
  DOM.toastMessage.textContent = message;
  DOM.toast.classList.remove('opacity-0', 'pointer-events-none');
  DOM.toast.classList.add('opacity-100');
  setTimeout(() => {
    DOM.toast.classList.remove('opacity-100');
    DOM.toast.classList.add('opacity-0', 'pointer-events-none');
  }, duration);
}

// ----------------- 設定與 Google 授權 -----------------
function initSettingsUI() {
  DOM.settingClientId.value = state.clientId;
  DOM.settingFolderName.value = state.folderName;
  DOM.headerFolder.textContent = state.folderName;
  DOM.sidebarFolderLabel.textContent = state.folderName;
}

function openSettings() {
  DOM.settingClientId.value = state.clientId;
  DOM.settingFolderName.value = state.folderName;
  DOM.settingsModal.classList.remove('hidden');
}

function closeSettings() {
  DOM.settingsModal.classList.add('hidden');
}

function saveSettings() {
  const newClient = DOM.settingClientId.value.trim();
  const newFolder = DOM.settingFolderName.value.trim() || 'DriveNotes';
  state.clientId = newClient;
  state.folderName = newFolder;
  localStorage.setItem('cloudnotes_client_id', state.clientId);
  localStorage.setItem('cloudnotes_folder_name', state.folderName);
  DOM.headerFolder.textContent = state.folderName;
  DOM.sidebarFolderLabel.textContent = state.folderName;
  closeSettings();
  showToast('設定已儲存');
  setupGoogleAuth();
}

function setupGoogleAuth() {
  if (!state.clientId) {
    updateSyncStatus('disconnected', '未設定 Client ID');
    DOM.notesLoading.innerHTML = `尚未設定 Google Client ID<br><button onclick="openSettings()" class="mt-2 text-blue-500 underline text-xs">點此填入 Client ID</button>`;
    return;
  }

  const checkGSI = setInterval(() => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      clearInterval(checkGSI);
      try {
        state.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: state.clientId,
          scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile',
          callback: async (resp) => {
            if (resp.error) {
              console.error('OAuth 授權錯誤:', resp);
              showToast('授權失敗：' + (resp.error_description || resp.error));
              return;
            }
            state.accessToken = resp.access_token;
            await onLoginSuccess();
          },
        });
        updateSyncStatus('ready', '就緒 (請登入)');
      } catch (e) {
        console.error('初始化 Google Token Client 失敗:', e);
      }
    }
  }, 200);
}

function handleLogin() {
  if (!state.clientId) {
    openSettings();
    showToast('請先填寫您的 Google OAuth Client ID');
    return;
  }
  if (state.tokenClient) {
    state.tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    showToast('Google 認證元件載入中，請稍候...');
  }
}

function handleLogout() {
  if (state.accessToken) {
    google.accounts.oauth2.revoke(state.accessToken, () => {});
  }
  state.accessToken = null;
  state.user = null;
  state.notes = [];
  state.currentNote = null;
  DOM.loginBtn.classList.remove('hidden');
  DOM.userProfile.classList.add('hidden');
  DOM.notesList.innerHTML = `<div class="text-center py-8 text-gray-400 text-xs">請登入 Google 帳號以載入筆記</div>`;
  clearEditor();
  updateSyncStatus('disconnected', '已登出');
  showToast('已登出');
}

async function onLoginSuccess() {
  DOM.loginBtn.classList.add('hidden');
  DOM.userProfile.classList.remove('hidden');
  DOM.userProfile.classList.add('flex');
  updateSyncStatus('syncing', '同步雲端筆記中...');

  try {
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    if (userRes.ok) {
      state.user = await userRes.json();
      DOM.userAvatar.src = state.user.picture || 'https://via.placeholder.com/32';
    }
  } catch (err) {}

  await ensureNotesFolder();
  await fetchNotesList();
}

function updateSyncStatus(status, text) {
  DOM.syncText.textContent = text;
  DOM.syncIndicator.className = 'w-1.5 h-1.5 rounded-full';
  if (status === 'synced') {
    DOM.syncIndicator.classList.add('bg-green-500');
    DOM.statAutosave.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-green-500"></i> 已同步至雲端`;
  } else if (status === 'syncing') {
    DOM.syncIndicator.classList.add('bg-amber-400', 'animate-pulse');
    DOM.statAutosave.innerHTML = `<i data-lucide="loader" class="w-3 h-3 text-amber-500 animate-spin"></i> 儲存中...`;
  } else if (status === 'dirty') {
    DOM.syncIndicator.classList.add('bg-amber-500');
    DOM.statAutosave.innerHTML = `<i data-lucide="clock" class="w-3 h-3 text-amber-500"></i> 等待自動存檔...`;
  } else {
    DOM.syncIndicator.classList.add('bg-gray-400');
    DOM.statAutosave.innerHTML = `<i data-lucide="cloud-off" class="w-3 h-3 text-gray-400"></i> 離線模式`;
  }
  initLucide();
}

// ----------------- Google Drive 資料夾與筆記 -----------------
async function ensureNotesFolder() {
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
    console.error('確保資料夾失敗:', e);
  }
}

async function fetchNotesList() {
  if (!state.folderId || !state.accessToken) return;
  updateSyncStatus('syncing', '更新筆記清單...');

  try {
    const query = `'${state.folderId}' in parents and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime,size,description)&orderBy=modifiedTime desc`, {
      headers: { Authorization: `Bearer ${state.accessToken}` }
    });
    const data = await res.json();
    
    // 解析筆記標題與 metadata (從檔案描述或名稱)
    state.notes = (data.files || []).map(file => {
      let meta = {
        icon: '📝',
        status: '💡 構思中',
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

// ----------------- Frontmatter 解析與序列化 -----------------
function parseFrontmatter(rawContent) {
  const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
  const match = rawContent.match(fmRegex);

  let meta = {
    icon: '📝',
    status: '💡 構思中',
    tags: [],
    pinned: false
  };

  if (!match) {
    return { meta, body: rawContent };
  }

  const rawYaml = match[1];
  const body = rawContent.slice(match[0].length);

  rawYaml.split('\n').forEach(line => {
    const [key, ...valParts] = line.split(':');
    if (!key || valParts.length === 0) return;
    const k = key.trim();
    const v = valParts.join(':').trim().replace(/^['"](.*)['"]$/, '$1');

    if (k === 'icon') meta.icon = v;
    if (k === 'status') meta.status = v;
    if (k === 'pinned') meta.pinned = (v === 'true');
    if (k === 'tags') {
      try {
        meta.tags = JSON.parse(v);
      } catch (e) {
        meta.tags = v.split(',').map(t => t.trim()).filter(Boolean);
      }
    }
  });

  return { meta, body };
}

function buildFrontmatterString(meta) {
  return `---\nicon: "${meta.icon || '📝'}"\nstatus: "${meta.status || '💡 構思中'}"\ntags: ${JSON.stringify(meta.tags || [])}\npinned: ${meta.pinned ? 'true' : 'false'}\nupdated: "${new Date().toISOString()}"\n---\n\n`;
}

// ----------------- 側邊欄渲染 (清單 vs 畫廊卡片) -----------------
function renderNotesList() {
  const query = DOM.searchInput.value.toLowerCase().trim();
  
  let filtered = state.notes.filter(note => {
    // 篩選器條件 (全部 / 置頂 / 進行中)
    if (state.filterMode === 'pinned' && !note.meta.pinned) return false;
    if (state.filterMode === 'doing' && !note.meta.status.includes('進行中')) return false;

    if (!query) return true;
    const nameMatch = note.name.toLowerCase().includes(query);
    const tagMatch = (note.meta.tags || []).some(t => t.toLowerCase().includes(query));
    return nameMatch || tagMatch;
  });

  // 置頂筆記置前
  filtered.sort((a, b) => (b.meta.pinned ? 1 : 0) - (a.meta.pinned ? 1 : 0));

  if (filtered.length === 0) {
    DOM.notesList.innerHTML = `<div class="text-center py-10 text-gray-400 text-xs">無符合條件的筆記</div>`;
    return;
  }

  DOM.notesList.innerHTML = '';
  filtered.forEach(note => {
    const isActive = state.currentNote && state.currentNote.id === note.id;
    const item = document.createElement('div');
    item.className = `note-item p-2 rounded-md cursor-pointer text-xs ${isActive ? 'active' : ''}`;
    
    const displayName = note.name.replace(/\.md$/i, '') || '無標題筆記';
    const tagBadges = (note.meta.tags || []).slice(0, 2).map(tag => 
      `<span class="tag-badge tag-blue">#${escapeHtml(tag)}</span>`
    ).join('');

    const pinIndicator = note.meta.pinned ? `<span title="已置頂" class="text-amber-500">📌</span>` : '';

    if (state.layoutMode === 'grid') {
      // 畫廊卡片視圖
      item.innerHTML = `
        <div class="flex items-center justify-between text-base mb-1">
          <span>${note.meta.icon || '📝'}</span>
          ${pinIndicator}
        </div>
        <div class="font-semibold text-gray-800 dark:text-gray-100 truncate">${escapeHtml(displayName)}</div>
        <div class="mt-2 flex items-center justify-between text-[10px] text-gray-400">
          <span>${escapeHtml(note.meta.status || '')}</span>
        </div>
      `;
    } else {
      // 清單視圖
      item.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-1.5 truncate">
            <span class="text-sm">${note.meta.icon || '📝'}</span>
            <span class="font-medium text-gray-800 dark:text-gray-200 truncate">${escapeHtml(displayName)}</span>
          </div>
          ${pinIndicator}
        </div>
        <div class="flex items-center justify-between mt-1 text-[10px] text-gray-400">
          <span class="truncate max-w-[80px]">${escapeHtml(note.meta.status || '💡 構思中')}</span>
          <div class="truncate">${tagBadges}</div>
        </div>
      `;
    }

    item.addEventListener('click', () => {
      if (state.currentNote && state.currentNote.id === note.id) return;
      selectNote(note.id);
    });

    DOM.notesList.appendChild(item);
  });
}

// ----------------- 選擇與載入單篇筆記 -----------------
async function selectNote(noteId) {
  const noteMeta = state.notes.find(n => n.id === noteId);
  if (!noteMeta) return;

  DOM.markdownInput.value = '載入中...';
  DOM.previewContent.innerHTML = '<p class="text-gray-400">載入中...</p>';
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
      meta: { ...noteMeta.meta, ...meta },
      bodyContent: body
    };

    // 更新 UI 屬性
    DOM.noteEmojiBtn.textContent = state.currentNote.meta.icon || '📝';
    DOM.noteStatusSelect.value = state.currentNote.meta.status || '💡 構思中';
    DOM.noteTagsInput.value = (state.currentNote.meta.tags || []).join(', ');
    updatePinButtonUI(state.currentNote.meta.pinned);
    DOM.noteLastEdited.textContent = noteMeta.modifiedTime ? new Date(noteMeta.modifiedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '剛剛';

    DOM.markdownInput.value = body;
    renderMarkdown(body);
    updateStats(body);
    renderOutline(body);
    renderNotesList();
    state.isDirty = false;
    updateSyncStatus('synced', '已同步');
  } catch (err) {
    console.error('載入筆記失敗:', err);
    showToast('載入筆記失敗');
  }
}

// ----------------- 新建筆記 -----------------
function createNewNote() {
  state.currentNote = {
    id: null,
    name: '新建筆記',
    meta: {
      icon: '📝',
      status: '💡 構思中',
      tags: ['靈感'],
      pinned: false
    },
    bodyContent: '# 新建筆記\n\n在此處輸入內容，或在空白行輸入 `/` 叫出積木選單！\n'
  };

  DOM.noteTitle.value = state.currentNote.name;
  DOM.headerTitle.textContent = state.currentNote.name;
  DOM.noteEmojiBtn.textContent = state.currentNote.meta.icon;
  DOM.noteStatusSelect.value = state.currentNote.meta.status;
  DOM.noteTagsInput.value = state.currentNote.meta.tags.join(', ');
  updatePinButtonUI(false);
  DOM.noteLastEdited.textContent = '剛剛';

  DOM.markdownInput.value = state.currentNote.bodyContent;
  renderMarkdown(state.currentNote.bodyContent);
  updateStats(state.currentNote.bodyContent);
  renderOutline(state.currentNote.bodyContent);
  renderNotesList();

  state.isDirty = true;
  triggerAutoSaveDebounce();

  if (window.innerWidth < 768) {
    DOM.sidebar.classList.add('-translate-x-full');
  }
}

// ----------------- 自動儲存與手動儲存 -----------------
function triggerAutoSaveDebounce() {
  state.isDirty = true;
  updateSyncStatus('dirty', '等待自動存檔...');
  if (state.autoSaveTimer) clearTimeout(state.autoSaveTimer);
  state.autoSaveTimer = setTimeout(() => {
    if (state.isDirty && state.accessToken) {
      saveCurrentNote();
    }
  }, 1800); // 停止輸入 1.8 秒後自動上傳至 Google Drive
}

async function saveCurrentNote() {
  if (!state.accessToken) return;
  if (!state.folderId) await ensureNotesFolder();

  updateSyncStatus('syncing', '儲存至 Google Drive...');

  let title = DOM.noteTitle.value.trim() || '未命名筆記';
  DOM.headerTitle.textContent = title;
  if (!title.toLowerCase().endsWith('.md')) title += '.md';

  const tags = DOM.noteTagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
  const meta = {
    icon: DOM.noteEmojiBtn.textContent,
    status: DOM.noteStatusSelect.value,
    tags: tags,
    pinned: state.currentNote ? state.currentNote.meta.pinned : false
  };

  const body = DOM.markdownInput.value;
  const fullContent = buildFrontmatterString(meta) + body;

  try {
    const boundary = '-------CloudNotesBoundary7788';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const closeDelimiter = "\r\n--" + boundary + "--";

    let url;
    let method;
    let metadata = {
      name: title,
      description: JSON.stringify(meta) // 將 meta 快取於 Google Drive 檔案描述中加速列表載入
    };

    if (state.currentNote && state.currentNote.id) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${state.currentNote.id}?uploadType=multipart`;
      method = 'PATCH';
    } else {
      url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      method = 'POST';
      metadata.parents = [state.folderId];
      metadata.mimeType = 'text/markdown';
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/markdown; charset=UTF-8\r\n\r\n' +
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

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const saved = await res.json();
    state.currentNote = {
      id: saved.id,
      name: saved.name,
      meta: meta,
      bodyContent: body
    };
    state.isDirty = false;
    updateSyncStatus('synced', '已同步');
    DOM.noteLastEdited.textContent = '剛剛';

    // 更新本地快取清單以提升流暢度
    const existingIndex = state.notes.findIndex(n => n.id === saved.id);
    if (existingIndex >= 0) {
      state.notes[existingIndex] = { ...state.notes[existingIndex], name: saved.name, meta: meta, modifiedTime: new Date().toISOString() };
    } else {
      state.notes.unshift({ id: saved.id, name: saved.name, meta: meta, modifiedTime: new Date().toISOString() });
    }
    renderNotesList();
  } catch (err) {
    console.error('存檔失敗:', err);
    updateSyncStatus('error', '存檔失敗');
  }
}

// ----------------- 刪除筆記 -----------------
async function deleteCurrentNote() {
  if (!state.currentNote || !state.currentNote.id) {
    createNewNote();
    return;
  }

  const confirmDelete = confirm(`確定要將筆記「${state.currentNote.name}」移至 Google Drive 垃圾桶嗎？`);
  if (!confirmDelete) return;

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${state.currentNote.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ trashed: true })
    });

    if (res.ok) {
      showToast('筆記已移至垃圾桶');
      state.notes = state.notes.filter(n => n.id !== state.currentNote.id);
      state.currentNote = null;
      clearEditor();
      renderNotesList();
      if (state.notes.length > 0) selectNote(state.notes[0].id);
      else createNewNote();
    }
  } catch (err) {
    showToast('刪除失敗');
  }
}

function clearEditor() {
  DOM.noteTitle.value = '';
  DOM.headerTitle.textContent = '未命名筆記';
  DOM.markdownInput.value = '';
  DOM.previewContent.innerHTML = '';
}

// ----------------- 即時渲染與大綱目錄 (TOC) -----------------
function renderMarkdown(content) {
  if (!window.marked || !window.DOMPurify) {
    DOM.previewContent.textContent = content;
    return;
  }
  const rawHtml = window.marked.parse(content || '');
  DOM.previewContent.innerHTML = window.DOMPurify.sanitize(rawHtml);
}

function renderOutline(content) {
  const lines = (content || '').split('\n');
  const headings = [];

  lines.forEach((line, idx) => {
    const hMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (hMatch) {
      headings.push({
        level: hMatch[1].length,
        text: hMatch[2].trim(),
        line: idx
      });
    }
  });

  if (headings.length === 0) {
    DOM.outlineList.innerHTML = `<span class="text-gray-400 italic text-[11px]">本筆記暫無大綱標題</span>`;
    return;
  }

  DOM.outlineList.innerHTML = '';
  headings.forEach(h => {
    const btn = document.createElement('button');
    btn.className = `w-full text-left truncate py-1 hover:text-blue-500 transition text-[11px] block ${h.level === 1 ? 'toc-h1' : h.level === 2 ? 'toc-h2' : 'toc-h3'}`;
    btn.textContent = h.text;
    btn.addEventListener('click', () => {
      // 尋找對應的預覽標題並平滑捲動
      const previewHeadings = DOM.previewContent.querySelectorAll(`h${h.level}`);
      for (const el of previewHeadings) {
        if (el.textContent.trim() === h.text) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        }
      }
    });
    DOM.outlineList.appendChild(btn);
  });
}

// ----------------- 字數統計與閱讀時間 -----------------
function updateStats(content) {
  const text = content.replace(/```[\s\S]*?```/g, '').replace(/[#*`_~[\]]/g, '');
  const chars = text.replace(/\s/g, '').length;
  const words = (text.match(/[\u4e00-\u9fa5]|[a-zA-Z0-9]+/g) || []).length;
  const readMin = Math.ceil(words / 350) || 1;

  DOM.statChars.textContent = chars;
  DOM.statWords.textContent = words;
  DOM.statTime.textContent = readMin;
}

// ----------------- Notion Slash 指令 (`/`) 選單 -----------------
function handleSlashMenu(e) {
  const textarea = DOM.markdownInput;
  const cursorPos = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, cursorPos);
  const currentLine = textBefore.split('\n').pop();

  if (currentLine.trim() === '/') {
    // 顯示 Slash 選單
    DOM.slashMenu.classList.remove('hidden');
    DOM.slashMenu.style.top = '100px';
    DOM.slashMenu.style.left = '30px';
  } else {
    DOM.slashMenu.classList.add('hidden');
  }
}

function insertSlashSnippet(type) {
  const textarea = DOM.markdownInput;
  const cursorPos = textarea.selectionStart;
  const text = textarea.value;

  const lastSlashIndex = text.lastIndexOf('/', cursorPos);
  if (lastSlashIndex === -1) return;

  let snippet = '';
  switch (type) {
    case 'h1': snippet = '# '; break;
    case 'h2': snippet = '## '; break;
    case 'h3': snippet = '### '; break;
    case 'todo': snippet = '- [ ] '; break;
    case 'bullet': snippet = '- '; break;
    case 'numbered': snippet = '1. '; break;
    case 'callout': snippet = '> 💡 **醒目提示：** '; break;
    case 'table': snippet = '| 標題 1 | 標題 2 |\n| --- | --- |\n| 項目 1 | 項目 2 |\n'; break;
    case 'code': snippet = "```javascript\n// 請輸入程式碼\n```\n"; break;
    case 'divider': snippet = "\n---\n"; break;
  }

  const newText = text.substring(0, lastSlashIndex) + snippet + text.substring(cursorPos);
  textarea.value = newText;
  DOM.slashMenu.classList.add('hidden');
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = lastSlashIndex + snippet.length;

  renderMarkdown(newText);
  updateStats(newText);
  renderOutline(newText);
  triggerAutoSaveDebounce();
}

// ----------------- 匯出功能 (MD, HTML, PDF) -----------------
function exportMarkdown() {
  const title = (DOM.noteTitle.value.trim() || '未命名筆記') + '.md';
  const blob = new Blob([DOM.markdownInput.value], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, title);
  DOM.exportMenu.classList.add('hidden');
}

function exportHTML() {
  const title = (DOM.noteTitle.value.trim() || '未命名筆記') + '.html';
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(DOM.noteTitle.value)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
    h1 { border-bottom: 1px solid #eee; padding-bottom: 8px; }
    blockquote { border-left: 4px solid #2383e2; background: #f7f6f3; padding: 10px 16px; margin: 16px 0; }
    code { background: #eee; padding: 2px 5px; border-radius: 4px; }
    pre { background: #1e1e1e; color: #fff; padding: 12px; border-radius: 6px; overflow: auto; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; }
    th { background: #f9f9f9; }
  </style>
</head>
<body>
  <h1>${DOM.noteEmojiBtn.textContent} ${escapeHtml(DOM.noteTitle.value)}</h1>
  ${DOM.previewContent.innerHTML}
</body>
</html>`;
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, title);
  DOM.exportMenu.classList.add('hidden');
}

function exportPDF() {
  DOM.exportMenu.classList.add('hidden');
  window.print();
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`已匯出 ${filename}`);
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
    DOM.notePinBtn.title = '取消置頂';
  } else {
    DOM.notePinBtn.classList.remove('text-amber-500');
    DOM.notePinBtn.title = '置頂此筆記';
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
  renderNotesList();
}

function initViewModes() {
  setViewMode('split');
}

function setViewMode(mode) {
  state.viewMode = mode;
  [DOM.viewSplitBtn, DOM.viewEditBtn, DOM.viewPreviewBtn].forEach(btn => {
    btn.classList.remove('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
  });

  if (mode === 'split') {
    DOM.viewSplitBtn.classList.add('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
    DOM.editorWrapper.classList.remove('hidden');
    DOM.previewWrapper.classList.remove('hidden');
  } else if (mode === 'edit') {
    DOM.viewEditBtn.classList.add('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
    DOM.editorWrapper.classList.remove('hidden');
    DOM.previewWrapper.classList.add('hidden');
  } else if (mode === 'preview') {
    DOM.viewPreviewBtn.classList.add('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
    DOM.editorWrapper.classList.add('hidden');
    DOM.previewWrapper.classList.remove('hidden');
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

  DOM.viewSplitBtn.addEventListener('click', () => setViewMode('split'));
  DOM.viewEditBtn.addEventListener('click', () => setViewMode('edit'));
  DOM.viewPreviewBtn.addEventListener('click', () => setViewMode('preview'));

  DOM.layoutListBtn.addEventListener('click', () => setLayout('list'));
  DOM.layoutGridBtn.addEventListener('click', () => setLayout('grid'));

  DOM.toggleSidebarBtn.addEventListener('click', () => {
    DOM.sidebar.classList.toggle('-translate-x-full');
  });

  DOM.toggleOutlineBtn.addEventListener('click', () => {
    DOM.outlinePanel.classList.toggle('hidden');
  });

  // 篩選 Tabs
  DOM.filterAllBtn.addEventListener('click', () => {
    state.filterMode = 'all';
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

  DOM.searchInput.addEventListener('input', renderNotesList);

  // 匯出下拉選單
  DOM.exportDropdownBtn.addEventListener('click', () => {
    DOM.exportMenu.classList.toggle('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!DOM.exportDropdownBtn.contains(e.target) && !DOM.exportMenu.contains(e.target)) {
      DOM.exportMenu.classList.add('hidden');
    }
  });

  DOM.exportMdBtn.addEventListener('click', exportMarkdown);
  DOM.exportHtmlBtn.addEventListener('click', exportHTML);
  DOM.exportPdfBtn.addEventListener('click', exportPDF);

  // Emoji Picker
  DOM.noteEmojiBtn.addEventListener('click', () => {
    DOM.emojiPicker.classList.toggle('hidden');
  });
  document.querySelectorAll('.emoji-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      DOM.noteEmojiBtn.textContent = btn.textContent;
      DOM.emojiPicker.classList.add('hidden');
      if (state.currentNote) state.currentNote.meta.icon = btn.textContent;
      renderNotesList();
      triggerAutoSaveDebounce();
    });
  });

  // 屬性修改事件
  DOM.noteTitle.addEventListener('input', () => {
    DOM.headerTitle.textContent = DOM.noteTitle.value || '未命名筆記';
    triggerAutoSaveDebounce();
  });
  DOM.noteStatusSelect.addEventListener('change', () => {
    if (state.currentNote) state.currentNote.meta.status = DOM.noteStatusSelect.value;
    renderNotesList();
    triggerAutoSaveDebounce();
  });
  DOM.noteTagsInput.addEventListener('input', () => {
    triggerAutoSaveDebounce();
  });

  // 編輯器輸入與 Slash 選單觸發
  DOM.markdownInput.addEventListener('input', (e) => {
    const val = e.target.value;
    renderMarkdown(val);
    renderOutline(val);
    updateStats(val);
    handleSlashMenu(e);
    triggerAutoSaveDebounce();
  });

  // Slash 選單點擊
  document.querySelectorAll('#slash-menu button').forEach(btn => {
    btn.addEventListener('click', () => {
      insertSlashSnippet(btn.dataset.slash);
    });
  });

  // 快捷鍵 (Ctrl+S 儲存, Ctrl+N 新增)
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
