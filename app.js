/**
 * CloudNotes Pro - 對標 Notion 的靜態筆記工作區核心邏輯
 * 包含：內嵌 Google Gemini AI 智能解惑助理、Google Drive 影音圖片就地即時播放、
 *      手機端深度適配、全自動靜默登入與續期、Frontmatter 屬性系統、Slash 指令選單、大綱目錄
 */

// 全域狀態
const state = {
  clientId: localStorage.getItem('cloudnotes_client_id') || '',
  folderName: localStorage.getItem('cloudnotes_folder_name') || 'DriveNotes',
  geminiApiKey: localStorage.getItem('cloudnotes_gemini_key') || '',
  folderId: null,
  accessToken: null,
  tokenClient: null,
  user: null,
  notes: [],
  currentNote: null,
  isDirty: false,
  viewMode: window.innerWidth < 768 ? 'edit' : 'split',
  layoutMode: localStorage.getItem('cloudnotes_layout') || 'list',
  filterMode: 'all',
  theme: localStorage.getItem('cloudnotes_theme') || 'light',
  autoSaveTimer: null,
  tokenRefreshTimer: null,
  aiChatHistory: []
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
  mobileToggleViewBtn: document.getElementById('mobile-toggle-view-btn'),
  mobileViewIcon: document.getElementById('mobile-view-icon'),
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

  // AI 解惑助理
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
  sidebarFolderLabel: document.getElementById('sidebar-folder-label'),
  refreshBtn: document.getElementById('refresh-btn'),

  // 頁首屬性
  noteEmojiBtn: document.getElementById('note-emoji-btn'),
  emojiPicker: document.getElementById('emoji-picker'),
  noteTitle: document.getElementById('note-title'),
  notePinBtn: document.getElementById('note-pin-btn'),
  deleteNoteBtn: document.getElementById('delete-note-btn'),
  noteStatusSelect: document.getElementById('note-status-select'),
  noteTagsInput: document.getElementById('note-tags-input'),

  // 編輯與預覽區
  uploadProgressBar: document.getElementById('upload-progress-bar'),
  editorWrapper: document.getElementById('editor-wrapper'),
  previewWrapper: document.getElementById('preview-wrapper'),
  markdownInput: document.getElementById('markdown-input'),
  previewContent: document.getElementById('preview-content'),
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
  mbToolPreview: document.getElementById('mb-tool-preview'),
  mbToolSave: document.getElementById('mb-tool-save'),

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
  settingGeminiKey: document.getElementById('setting-gemini-key'),
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
  checkAiKeyStatus();
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

// ----------------- 設定與 Google 自動授權 -----------------
function initSettingsUI() {
  DOM.settingClientId.value = state.clientId;
  DOM.settingFolderName.value = state.folderName;
  DOM.settingGeminiKey.value = state.geminiApiKey;
  DOM.headerFolder.textContent = state.folderName;
  DOM.sidebarFolderLabel.textContent = state.folderName;
}

function openSettings() {
  DOM.settingClientId.value = state.clientId;
  DOM.settingFolderName.value = state.folderName;
  DOM.settingGeminiKey.value = state.geminiApiKey;
  DOM.settingsModal.classList.remove('hidden');
}

function closeSettings() {
  DOM.settingsModal.classList.add('hidden');
}

function saveSettings() {
  state.clientId = DOM.settingClientId.value.trim();
  state.folderName = DOM.settingFolderName.value.trim() || 'DriveNotes';
  state.geminiApiKey = DOM.settingGeminiKey.value.trim();

  localStorage.setItem('cloudnotes_client_id', state.clientId);
  localStorage.setItem('cloudnotes_folder_name', state.folderName);
  localStorage.setItem('cloudnotes_gemini_key', state.geminiApiKey);

  DOM.headerFolder.textContent = state.folderName;
  DOM.sidebarFolderLabel.textContent = state.folderName;
  closeSettings();
  checkAiKeyStatus();
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
              console.warn('OAuth 授權回應:', resp);
              if (resp.error === 'popup_closed_by_user') return;
              if (resp.error === 'access_denied') {
                showToast('登入取消或存取遭拒');
                localStorage.removeItem('cloudnotes_authorized');
              }
              return;
            }
            state.accessToken = resp.access_token;
            localStorage.setItem('cloudnotes_authorized', 'true');
            
            const expiresIn = resp.expires_in ? parseInt(resp.expires_in, 10) : 3600;
            scheduleTokenRefresh(expiresIn);
            await onLoginSuccess();
          },
        });

        // 靜默自動登入
        if (localStorage.getItem('cloudnotes_authorized') === 'true') {
          updateSyncStatus('syncing', '自動登入中...');
          state.tokenClient.requestAccessToken({ prompt: '' });
        } else {
          updateSyncStatus('ready', '就緒 (請登入)');
        }
      } catch (e) {
        console.error('初始化 Google Token Client 失敗:', e);
      }
    }
  }, 200);
}

function scheduleTokenRefresh(expiresIn) {
  if (state.tokenRefreshTimer) clearTimeout(state.tokenRefreshTimer);
  const refreshDelay = Math.max((expiresIn - 300) * 1000, 60000);
  state.tokenRefreshTimer = setTimeout(() => {
    if (state.tokenClient && localStorage.getItem('cloudnotes_authorized') === 'true') {
      console.log('背景自動更新 Google Drive 存取憑證...');
      state.tokenClient.requestAccessToken({ prompt: '' });
    }
  }, refreshDelay);
}

function handleLogin() {
  if (!state.clientId) {
    openSettings();
    showToast('請先填寫您的 Google OAuth Client ID');
    return;
  }
  if (state.tokenClient) {
    state.tokenClient.requestAccessToken({ prompt: '' });
  } else {
    showToast('Google 認證元件載入中，請稍候...');
  }
}

function handleLogout() {
  if (state.tokenRefreshTimer) clearTimeout(state.tokenRefreshTimer);
  if (state.accessToken) {
    google.accounts.oauth2.revoke(state.accessToken, () => {});
  }
  state.accessToken = null;
  state.user = null;
  state.notes = [];
  state.currentNote = null;
  localStorage.removeItem('cloudnotes_authorized');
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
    if (DOM.statAutosave) DOM.statAutosave.innerHTML = `<i data-lucide="check" class="w-3 h-3 text-green-500"></i> 已同步至雲端`;
  } else if (status === 'syncing') {
    DOM.syncIndicator.classList.add('bg-amber-400', 'animate-pulse');
    if (DOM.statAutosave) DOM.statAutosave.innerHTML = `<i data-lucide="loader" class="w-3 h-3 text-amber-500 animate-spin"></i> 同步中...`;
  } else if (status === 'dirty') {
    DOM.syncIndicator.classList.add('bg-amber-500');
    if (DOM.statAutosave) DOM.statAutosave.innerHTML = `<i data-lucide="clock" class="w-3 h-3 text-amber-500"></i> 等待自動存檔...`;
  } else {
    DOM.syncIndicator.classList.add('bg-gray-400');
    if (DOM.statAutosave) DOM.statAutosave.innerHTML = `<i data-lucide="cloud-off" class="w-3 h-3 text-gray-400"></i> 離線`;
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

// ----------------- 多媒體直接上傳與當場播放模組 -----------------
async function uploadMediaFile(file) {
  if (!state.accessToken) {
    showToast('請先登入 Google 帳號以進行圖影上傳');
    return;
  }
  if (!state.folderId) await ensureNotesFolder();

  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');
  const isImage = file.type.startsWith('image/');

  if (!isImage && !isVideo && !isAudio) {
    showToast('僅支援圖片、影片或音訊檔案');
    return;
  }

  let typeText = '圖片';
  if (isVideo) typeText = '影片';
  if (isAudio) typeText = '音訊';

  if (DOM.uploadProgressBar) {
    DOM.uploadProgressBar.classList.remove('hidden');
    DOM.uploadProgressBar.style.width = '30%';
  }
  showToast(`正在上傳 ${typeText} 至 Google Drive...`);

  try {
    // 1. 發起 Resumable Upload
    const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${state.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': file.type,
        'X-Upload-Content-Length': file.size.toString()
      },
      body: JSON.stringify({
        name: `media_${Date.now()}_${file.name}`,
        parents: state.folderId ? [state.folderId] : []
      })
    });

    if (!initRes.ok) throw new Error('初始化上傳失敗');
    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) throw new Error('無法取得上傳位址');

    if (DOM.uploadProgressBar) DOM.uploadProgressBar.style.width = '70%';

    // 2. 上傳二進位資料
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file
    });

    if (!uploadRes.ok) throw new Error('檔案上傳失敗');
    const uploadedFile = await uploadRes.json();
    const fileId = uploadedFile.id;

    if (DOM.uploadProgressBar) DOM.uploadProgressBar.style.width = '90%';

    // 3. 設定公開唯讀權限以便直接串流播放
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' })
      });
    } catch (permErr) {
      console.warn('權限設定警告:', permErr);
    }

    if (DOM.uploadProgressBar) {
      DOM.uploadProgressBar.style.width = '100%';
      setTimeout(() => {
        DOM.uploadProgressBar.classList.add('hidden');
        DOM.uploadProgressBar.style.width = '0%';
      }, 500);
    }

    // 4. 插入就地即時播放組件
    let snippet = '';
    if (isImage) {
      const imgUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      snippet = `\n![${file.name}](${imgUrl})\n`;
    } else if (isVideo) {
      // 內嵌 Google Drive 播放器，支援跨手機與電腦原地串流與全螢幕
      snippet = `\n<iframe src="https://drive.google.com/file/d/${fileId}/preview" width="100%" height="320" allow="autoplay; fullscreen" class="rounded-lg my-2 border-0 shadow"></iframe>\n`;
    } else if (isAudio) {
      // 內建 HTML5 音訊播放器
      const audioUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      snippet = `\n<audio controls class="w-full my-2" src="${audioUrl}" preload="metadata"></audio>\n`;
    }

    insertTextAtCursor(snippet);
    showToast(`${typeText} 上傳成功，已就地放入播放器！`);
  } catch (err) {
    console.error('上傳失敗:', err);
    if (DOM.uploadProgressBar) DOM.uploadProgressBar.classList.add('hidden');
    showToast('上傳失敗，請確認檔案大小與網路');
  }
}

function insertTextAtCursor(snippet) {
  const textarea = DOM.markdownInput;
  const cursorPos = textarea.selectionStart || 0;
  const text = textarea.value;
  const newText = text.substring(0, cursorPos) + snippet + text.substring(cursorPos);
  textarea.value = newText;
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = cursorPos + snippet.length;

  renderMarkdown(newText);
  updateStats(newText);
  renderOutline(newText);
  triggerAutoSaveDebounce();
}

// ----------------- ✨ 進駐 AI 智能解惑助理 (Gemini API) -----------------
function toggleAiPanel() {
  DOM.aiPanel.classList.toggle('translate-x-full');
  if (DOM.aiBackdrop) DOM.aiBackdrop.classList.toggle('hidden');
  checkAiKeyStatus();
}

function closeAiPanel() {
  DOM.aiPanel.classList.add('translate-x-full');
  if (DOM.aiBackdrop) DOM.aiBackdrop.classList.add('hidden');
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
    DOM.aiKeyBanner.classList.remove('hidden');
    showToast('請先填入免費的 Gemini API Key');
    return;
  }

  // 加入使用者氣泡
  appendAiBubble('user', userPrompt);
  DOM.aiUserInput.value = '';
  DOM.aiSendBtn.disabled = true;

  // 加入機器人思考中氣泡
  const botBubble = appendAiBubble('bot', '<span class="flex items-center gap-1.5 text-purple-500 animate-pulse"><i data-lucide="loader" class="w-3.5 h-3.5 animate-spin"></i> AI 正在思考中...</span>');
  initLucide();

  // 整理當前筆記上下文
  const currentTitle = DOM.noteTitle.value || '無標題筆記';
  const currentContent = DOM.markdownInput.value || '（筆記內容為空）';

  let systemPrompt = `你是一位進駐在個人雲端筆記網站中的專業 AI 智能助手。
請以繁體中文回答，語氣親切、專業、客觀清晰，善用條理分明的 Markdown 排版。
目前使用者正在檢視/編輯的筆記如下：
【標題】：${currentTitle}
【內容】：
${currentContent.substring(0, 4000)}

請根據使用者的需求進行解答、分析、摘要或創作。`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${state.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt + '\n\n【使用者指示】：' + userPrompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || '抱歉，暫時無法取得回覆。';

    // 渲染 Markdown 回覆，並附上「插入至筆記」功能
    const renderedHtml = window.marked ? window.marked.parse(replyText) : replyText;
    botBubble.innerHTML = `
      <div class="prose dark:prose-invert text-xs">${renderedHtml}</div>
      <div class="mt-2 pt-2 border-t border-purple-100 dark:border-purple-900/40 flex justify-end">
        <button class="insert-to-note-btn text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-800 flex items-center gap-1 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
          <i data-lucide="plus" class="w-3 h-3"></i> 插入至當前筆記
        </button>
      </div>
    `;

    // 綁定「插入至筆記」按鈕事件
    botBubble.querySelector('.insert-to-note-btn').addEventListener('click', () => {
      insertTextAtCursor(`\n\n> 🤖 **AI 解惑建議：**\n${replyText}\n`);
      showToast('已將 AI 內容插入至筆記！');
    });

    initLucide();
  } catch (err) {
    botBubble.innerHTML = `<span class="text-red-500">AI 解答出錯：${escapeHtml(err.message)}</span>`;
  } finally {
    DOM.aiSendBtn.disabled = false;
  }
}

function appendAiBubble(role, contentHtml) {
  const bubble = document.createElement('div');
  bubble.className = role === 'user' ? 'ai-user-bubble' : 'ai-bot-bubble';
  bubble.innerHTML = contentHtml;
  DOM.aiMessages.appendChild(bubble);
  DOM.aiMessages.scrollTop = DOM.aiMessages.scrollHeight;
  return bubble;
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

  if (!match) return { meta, body: rawContent };

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

// ----------------- 側邊欄渲染 -----------------
function renderNotesList() {
  const query = DOM.searchInput.value.toLowerCase().trim();
  
  let filtered = state.notes.filter(note => {
    if (state.filterMode === 'pinned' && !note.meta.pinned) return false;
    if (state.filterMode === 'doing' && !note.meta.status.includes('進行中')) return false;

    if (!query) return true;
    const nameMatch = note.name.toLowerCase().includes(query);
    const tagMatch = (note.meta.tags || []).some(t => t.toLowerCase().includes(query));
    return nameMatch || tagMatch;
  });

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
      if (state.currentNote && state.currentNote.id === note.id) {
        closeSidebar();
        return;
      }
      selectNote(note.id);
      closeSidebar();
    });

    DOM.notesList.appendChild(item);
  });
}

function toggleSidebar() {
  DOM.sidebar.classList.toggle('-translate-x-full');
  DOM.sidebarBackdrop.classList.toggle('hidden');
}

function closeSidebar() {
  DOM.sidebar.classList.add('-translate-x-full');
  DOM.sidebarBackdrop.classList.add('hidden');
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

    DOM.noteEmojiBtn.textContent = state.currentNote.meta.icon || '📝';
    DOM.noteStatusSelect.value = state.currentNote.meta.status || '💡 構思中';
    DOM.noteTagsInput.value = (state.currentNote.meta.tags || []).join(', ');
    updatePinButtonUI(state.currentNote.meta.pinned);

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
    bodyContent: '# 新建筆記\n\n在此處輸入內容，或點擊「圖影音」放入播放器！\n'
  };

  DOM.noteTitle.value = state.currentNote.name;
  DOM.headerTitle.textContent = state.currentNote.name;
  DOM.noteEmojiBtn.textContent = state.currentNote.meta.icon;
  DOM.noteStatusSelect.value = state.currentNote.meta.status;
  DOM.noteTagsInput.value = state.currentNote.meta.tags.join(', ');
  updatePinButtonUI(false);

  DOM.markdownInput.value = state.currentNote.bodyContent;
  renderMarkdown(state.currentNote.bodyContent);
  updateStats(state.currentNote.bodyContent);
  renderOutline(state.currentNote.bodyContent);
  renderNotesList();

  closeSidebar();
  state.isDirty = true;
  triggerAutoSaveDebounce();
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
  }, 1800);
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

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const errMsg = errJson.error?.message || `HTTP ${res.status}`;
      throw new Error(errMsg);
    }

    const saved = await res.json();
    state.currentNote = {
      id: saved.id,
      name: saved.name,
      meta: meta,
      bodyContent: body
    };
    state.isDirty = false;
    updateSyncStatus('synced', '已同步');

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

// ----------------- 即時渲染 (支援影音就地播放) -----------------
function renderMarkdown(content) {
  if (!window.marked || !window.DOMPurify) {
    DOM.previewContent.textContent = content;
    return;
  }
  const rawHtml = window.marked.parse(content || '');
  const cleanHtml = window.DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ['iframe', 'video', 'audio', 'source'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'controls', 'width', 'height', 'class', 'preload', 'type']
  });
  DOM.previewContent.innerHTML = cleanHtml;
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
    if (DOM.outlineList) DOM.outlineList.innerHTML = `<span class="text-gray-400 italic text-[11px]">暫無大綱標題</span>`;
    return;
  }

  if (DOM.outlineList) {
    DOM.outlineList.innerHTML = '';
    headings.forEach(h => {
      const btn = document.createElement('button');
      btn.className = `w-full text-left truncate py-1 hover:text-blue-500 transition text-[11px] block ${h.level === 1 ? 'toc-h1' : h.level === 2 ? 'toc-h2' : 'toc-h3'}`;
      btn.textContent = h.text;
      btn.addEventListener('click', () => {
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
}

function updateStats(content) {
  const text = content.replace(/```[\s\S]*?```/g, '').replace(/[#*`_~[\]]/g, '');
  const chars = text.replace(/\s/g, '').length;
  const words = (text.match(/[\u4e00-\u9fa5]|[a-zA-Z0-9]+/g) || []).length;
  const readMin = Math.ceil(words / 350) || 1;

  if (DOM.statChars) DOM.statChars.textContent = chars;
  if (DOM.statWords) DOM.statWords.textContent = words;
  if (DOM.statTime) DOM.statTime.textContent = readMin;
}

// ----------------- Slash 指令 (`/`) 選單 -----------------
function handleSlashMenu(e) {
  const textarea = DOM.markdownInput;
  const cursorPos = textarea.selectionStart;
  const textBefore = textarea.value.substring(0, cursorPos);
  const currentLine = textBefore.split('\n').pop();

  if (currentLine.trim() === '/') {
    DOM.slashMenu.classList.remove('hidden');
    DOM.slashMenu.style.top = '80px';
    DOM.slashMenu.style.left = '20px';
  } else {
    DOM.slashMenu.classList.add('hidden');
  }
}

function insertSlashSnippet(type) {
  if (type === 'ai') {
    DOM.slashMenu.classList.add('hidden');
    toggleAiPanel();
    return;
  }
  if (type === 'media') {
    DOM.slashMenu.classList.add('hidden');
    DOM.mediaUploadInput.click();
    return;
  }

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
    case 'callout': snippet = '> 💡 **醒目提示：** '; break;
    case 'table': snippet = '| 標題 1 | 標題 2 |\n| --- | --- |\n| 項目 1 | 項目 2 |\n'; break;
    case 'code': snippet = "```javascript\n// 請輸入代碼\n```\n"; break;
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
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 30px auto; padding: 0 15px; line-height: 1.6; color: #333; }
    img, video, audio { max-width: 100%; border-radius: 6px; }
    blockquote { border-left: 4px solid #2383e2; background: #f7f6f3; padding: 10px 16px; margin: 16px 0; }
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
  setViewMode(state.viewMode);
}

function setViewMode(mode) {
  state.viewMode = mode;

  [DOM.viewSplitBtn, DOM.viewEditBtn, DOM.viewPreviewBtn].forEach(btn => {
    if (btn) btn.classList.remove('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
  });

  if (mode === 'split') {
    if (DOM.viewSplitBtn) DOM.viewSplitBtn.classList.add('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
    DOM.editorWrapper.classList.remove('hidden');
    DOM.previewWrapper.classList.remove('hidden');
  } else if (mode === 'edit') {
    if (DOM.viewEditBtn) DOM.viewEditBtn.classList.add('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
    DOM.editorWrapper.classList.remove('hidden');
    DOM.previewWrapper.classList.add('hidden');
    if (DOM.mobileViewIcon) DOM.mobileViewIcon.setAttribute('data-lucide', 'eye');
  } else if (mode === 'preview') {
    if (DOM.viewPreviewBtn) DOM.viewPreviewBtn.classList.add('bg-white', 'dark:bg-gray-700', 'shadow-sm', 'text-blue-600', 'dark:text-blue-400');
    DOM.editorWrapper.classList.add('hidden');
    DOM.previewWrapper.classList.remove('hidden');
    if (DOM.mobileViewIcon) DOM.mobileViewIcon.setAttribute('data-lucide', 'edit-3');
  }
  initLucide();
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

  // ✨ AI 助理開關
  DOM.toggleAiBtn.addEventListener('click', toggleAiPanel);
  DOM.closeAiBtn.addEventListener('click', closeAiPanel);
  if (DOM.aiBackdrop) DOM.aiBackdrop.addEventListener('click', closeAiPanel);
  if (DOM.mbToolAi) DOM.mbToolAi.addEventListener('click', toggleAiPanel);

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

  // AI 快捷按鈕 (摘要、潤飾、延伸思考)
  DOM.aiBtnSummarize.addEventListener('click', () => {
    sendAiMessage('請為我摘要這篇筆記的核心要點，條列總結。', 'summarize');
  });
  DOM.aiBtnPolish.addEventListener('click', () => {
    sendAiMessage('請幫我潤飾這篇筆記的文筆與句子結構，改善閱讀流暢度並修正錯字。', 'polish');
  });
  DOM.aiBtnIdeas.addEventListener('click', () => {
    sendAiMessage('根據這篇筆記的主題，請為我提出 3 個深入思考的延伸問題或創意觀點。', 'ideas');
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

  // 支援直接剪貼簿貼上圖片
  DOM.markdownInput.addEventListener('paste', async (e) => {
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

  // 支援拖曳圖影音
  DOM.markdownInput.addEventListener('dragover', (e) => e.preventDefault());
  DOM.markdownInput.addEventListener('drop', async (e) => {
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

  // 手機視圖切換
  if (DOM.mobileToggleViewBtn) {
    DOM.mobileToggleViewBtn.addEventListener('click', () => {
      setViewMode(state.viewMode === 'edit' ? 'preview' : 'edit');
    });
  }

  // 手機底部工具列按鈕
  if (DOM.mbToolBold) {
    DOM.mbToolBold.addEventListener('click', () => insertTextAtCursor('**粗體文字**'));
  }
  if (DOM.mbToolTodo) {
    DOM.mbToolTodo.addEventListener('click', () => insertTextAtCursor('\n- [ ] 待辦事項\n'));
  }
  if (DOM.mbToolList) {
    DOM.mbToolList.addEventListener('click', () => insertTextAtCursor('\n- 清單項目\n'));
  }
  if (DOM.mbToolCallout) {
    DOM.mbToolCallout.addEventListener('click', () => insertTextAtCursor('\n> 💡 **提醒：** 內容\n'));
  }
  if (DOM.mbToolPreview) {
    DOM.mbToolPreview.addEventListener('click', () => {
      setViewMode(state.viewMode === 'edit' ? 'preview' : 'edit');
    });
  }
  if (DOM.mbToolSave) {
    DOM.mbToolSave.addEventListener('click', saveCurrentNote);
  }

  // 電腦版檢視模式切換
  if (DOM.viewSplitBtn) DOM.viewSplitBtn.addEventListener('click', () => setViewMode('split'));
  if (DOM.viewEditBtn) DOM.viewEditBtn.addEventListener('click', () => setViewMode('edit'));
  if (DOM.viewPreviewBtn) DOM.viewPreviewBtn.addEventListener('click', () => setViewMode('preview'));

  if (DOM.layoutListBtn) DOM.layoutListBtn.addEventListener('click', () => setLayout('list'));
  if (DOM.layoutGridBtn) DOM.layoutGridBtn.addEventListener('click', () => setLayout('grid'));

  if (DOM.toggleOutlineBtn) {
    DOM.toggleOutlineBtn.addEventListener('click', () => {
      DOM.outlinePanel.classList.toggle('hidden');
    });
  }

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

  // 快捷鍵
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

  // 視窗尺寸改變時自動調整視圖
  window.addEventListener('resize', () => {
    if (window.innerWidth < 768 && state.viewMode === 'split') {
      setViewMode('edit');
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
