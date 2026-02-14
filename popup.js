/**
 * 飞书导出助手 - 弹窗脚本
 * 
 * 简洁现代的弹窗界面，提供一键导出功能
 */

'use strict';

// ==================== DOM 元素引用 ====================
let rootElement = null;
let exportButton = null;

// ==================== 状态 ====================
let currentExportMode = 'browser'; // 'browser' | 'folder'
let isSettingsView = false; // 是否显示设置视图

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  rootElement = document.getElementById('root');
  if (rootElement) {
    loadSettings(() => {
      renderMainView();
    });
  }
});

// ==================== 渲染主界面 ====================
function renderMainView() {
  isSettingsView = false;
  rootElement.innerHTML = `
    <div class="popup-container">
      <!-- 品牌标识区 -->
      <div class="brand-header">
        <div class="brand-icon">
          <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path d="M224 421.12v6.912l0.512 180.224-0.256 35.84 0.256 15.36 0.256 5.376 0.512 3.584v0.512c0 0.256 0 0.512 0.256 0.768 1.024 4.352 3.584 7.936 7.424 11.52 3.328 3.072 7.424 5.632 13.824 9.216 30.464 16.64 59.648 28.928 89.6 37.376 30.72 8.704 62.72 13.312 97.024 14.08 35.584 0.768 68.608-2.816 100.864-11.264 30.976-7.936 61.696-19.968 94.208-36.864 24.064-12.544 50.432-32.256 74.496-55.552l8.448-8.448 8.192-8.704 3.328-3.84-1.792 1.024-6.912 3.584-2.56 1.28c-27.136 12.544-55.296 16.128-86.784 12.288l-9.472-1.28-9.472-1.792-2.304-0.512-2.304-0.512-9.984-2.304-2.56-0.768-2.816-0.768-11.52-3.328-2.048-0.512c-1.28-0.512-2.816-0.768-4.096-1.28l-20.992-6.656-10.24-3.328-29.952-10.752-14.848-5.632-13.568-4.608-6.656-2.816-7.168-3.328-0.768-0.256c-0.768-0.256-1.28-0.768-2.048-1.28l-9.728-4.864-25.344-12.032-15.872-7.936-5.632-3.072c-28.416-14.848-56.32-32.768-84.224-52.992-26.88-19.712-53.504-41.728-80.128-66.048l-13.312-12.544-3.84-3.072z" fill="currentColor"/>
            <path d="M760.32 413.952l-9.984 0.256-3.84 0.256c-15.104 0.768-30.208 3.328-44.8 7.168-13.312 3.584-26.368 8.448-38.912 14.848-12.8 6.4-24.832 13.824-36.096 22.528l-6.4 4.864-1.536 1.28-1.536 1.28-6.144 5.376-6.4 5.888-7.168 6.656-33.792 32.768-2.304 2.048c-16.384 15.36-28.416 25.6-42.496 35.328l-5.632 3.84-14.592 9.472-2.048 1.28c-2.816 1.792-5.376 3.328-7.936 4.864l-7.424 4.096 10.752 4.352 31.488 11.776 19.456 6.912 22.016 7.168 12.544 3.84 11.008 3.072 2.56 0.768c2.56 0.768 5.12 1.28 7.424 1.792l9.472 2.048 2.304 0.512 2.304 0.512 8.96 1.536 2.304 0.256 2.304 0.256c29.696 3.584 56.064 0 81.408-12.288 32.512-15.616 47.872-31.744 69.12-70.912l6.912-13.056 11.008-21.504 4.864-9.216 1.536-2.816c14.848-28.16 26.112-45.312 41.472-61.184l1.536-1.536-3.584-1.28-4.352-1.536-9.216-3.072-7.936-2.304-3.584-1.024c-14.592-3.584-29.696-5.888-44.8-6.4l-10.24-0.768zM328.96 276.992l8.704 6.4 12.544 9.216 5.12 3.84c14.08 10.752 27.904 21.76 41.472 33.28 18.944 16.384 36.864 33.792 54.016 52.224 15.872 16.896 29.696 32.768 42.24 48.384 9.984 12.288 19.456 24.832 28.672 37.888l10.752 15.872 17.408 27.904 11.008-10.24 16.64-15.872 9.472-8.96 12.544-11.52 2.816-2.56c7.936-7.168 16.384-13.824 24.832-20.224 6.912-5.12 15.104-10.24 24.32-15.104 6.4-3.328 12.8-6.4 19.456-9.216l11.008-4.352 5.888-2.048-0.256-0.768-0.256-1.28c-1.28-5.376-3.584-12.288-6.912-20.224l-4.352-10.752-1.024-2.304c-6.912-15.872-15.104-32.256-21.248-42.496l-12.544-19.2-6.912-9.984-1.28-1.536c-9.216-12.8-16.64-20.736-22.784-23.552-4.096-2.048-7.936-2.56-14.336-2.816H328.96z" fill="currentColor"/>
          </svg>
        </div>
        <div class="brand-info">
          <h1 class="brand-title">飞书导出助手</h1>
          <span class="brand-subtitle">Markdown 一键导出</span>
        </div>
        <button id="settings-btn" class="settings-btn" title="设置">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>

      <!-- 主操作区 -->
      <div class="action-area">
        <button id="export-btn" class="export-btn">
          <span class="btn-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="btn-text">导出当前文档</span>
        </button>
        <p class="action-hint">支持导出为 Markdown，图片自动保存</p>
      </div>

      <!-- 快捷链接区 -->
      <div class="quick-links">
        <a href="#" class="link-item" id="guide-link">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
            <path d="M9.09 9C9.3251 8.33167 9.78915 7.76811 10.4 7.40913C11.0108 7.05016 11.7289 6.91894 12.4272 7.03871C13.1255 7.15849 13.7588 7.52154 14.2151 8.06353C14.6713 8.60553 14.9211 9.29152 14.92 10C14.92 12 11.92 13 11.92 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 17H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>使用指南</span>
        </a>
        <a href="#" class="link-item" id="feedback-link">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>问题反馈</span>
        </a>
        <a href="#" class="link-item" id="github-link">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 19C4 20.5 4 16.5 2 16M16 22V18.13C16.0375 17.6532 15.9731 17.1738 15.811 16.7238C15.6489 16.2738 15.3929 15.8634 15.06 15.52C18.2 15.17 21.5 13.98 21.5 8.52C21.4997 7.12383 20.9627 5.7812 20 4.77C20.4559 3.54851 20.4236 2.19835 19.91 0.999999C19.91 0.999999 18.73 0.649999 16 2.48C13.708 1.85882 11.292 1.85882 9 2.48C6.27 0.649999 5.09 0.999999 5.09 0.999999C4.57638 2.19835 4.54414 3.54851 5 4.77C4.03013 5.7887 3.49252 7.14346 3.5 8.55C3.5 13.97 6.8 15.17 9.94 15.54C9.611 15.8794 9.35726 16.2858 9.19531 16.7322C9.03335 17.1786 8.96718 17.6551 9 18.13V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>GitHub</span>
        </a>
      </div>
    </div>
  `;
  
  setupEventListeners();
}

// ==================== 渲染设置界面 ====================
// 记录进入设置前的模式，用于取消时恢复
let previousExportMode = null;

function renderSettingsView() {
  isSettingsView = true;
  previousExportMode = currentExportMode;
  rootElement.innerHTML = `
    <div class="popup-container">
      <!-- 品牌标识区 -->
      <div class="brand-header">
        <button id="back-btn" class="back-btn" title="返回">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 12H5M12 19L5 12L12 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="brand-info" style="flex: 1;">
          <h1 class="brand-title">导出设置</h1>
        </div>
      </div>

      <!-- 设置内容 -->
      <div class="settings-content">
        <div class="settings-section">
          <div class="settings-section-title">导出模式</div>
          <div class="export-mode-options">
            <div class="mode-option ${currentExportMode === 'browser' ? 'active' : ''}" data-mode="browser">
              <div class="mode-radio"></div>
              <div class="mode-info">
                <div class="mode-label">浏览器默认下载</div>
                <div class="mode-desc">自动保存到浏览器下载目录，快速便捷</div>
              </div>
            </div>
            <div class="mode-option ${currentExportMode === 'folder' ? 'active' : ''}" data-mode="folder">
              <div class="mode-radio"></div>
              <div class="mode-info">
                <div class="mode-label">选择文件夹保存</div>
                <div class="mode-desc">每次导出时选择保存位置，更灵活</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="settings-footer">
        <button id="cancel-btn" class="cancel-btn">取消</button>
        <button id="save-btn" class="save-btn">保存</button>
      </div>
    </div>
  `;
  
  setupSettingsEventListeners();
}

// ==================== 事件监听 ====================
function setupEventListeners() {
  exportButton = document.getElementById('export-btn');
  if (exportButton) {
    exportButton.addEventListener('click', handleExportClick);
  }

  // 设置按钮
  document.getElementById('settings-btn')?.addEventListener('click', renderSettingsView);

  document.getElementById('guide-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/wintopic/Feishu_Downloader#readme' });
  });

  document.getElementById('feedback-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/wintopic/Feishu_Downloader/issues' });
  });

  document.getElementById('github-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com/wintopic/Feishu_Downloader' });
  });
}

/**
 * 设置界面事件监听
 */
function setupSettingsEventListeners() {
  // 返回按钮 - 恢复原设置
  document.getElementById('back-btn')?.addEventListener('click', () => {
    if (previousExportMode !== null) currentExportMode = previousExportMode;
    renderMainView();
  });

  // 取消按钮 - 恢复原设置
  document.getElementById('cancel-btn')?.addEventListener('click', () => {
    if (previousExportMode !== null) currentExportMode = previousExportMode;
    renderMainView();
  });
  
  // 保存按钮
  document.getElementById('save-btn')?.addEventListener('click', saveSettings);
  
  // 模式选择
  const modeOptions = document.querySelectorAll('.mode-option');
  modeOptions.forEach(option => {
    option.addEventListener('click', () => {
      // 更新 UI
      modeOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      // 更新临时状态
      currentExportMode = option.dataset.mode;
    });
  });
}

/**
 * 保存设置
 */
function saveSettings() {
  const modeToSave = currentExportMode;
  chrome.storage.local.set({ exportMode: modeToSave }, () => {
    if (chrome.runtime.lastError) {
      console.error('保存设置失败:', chrome.runtime.lastError);
      showToast('保存失败，请重试', 'error');
      return;
    }
    showToast('设置已保存', 'success');
    setTimeout(() => renderMainView(), 300);
  });
}

/**
 * 加载保存的设置
 * @param {Function} callback - 加载完成回调
 */
function loadSettings(callback) {
  try {
    chrome.storage.local.get(['exportMode'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('加载设置失败:', chrome.runtime.lastError);
      } else if (result.exportMode) {
        currentExportMode = result.exportMode;
      }
      if (callback) callback();
    });
  } catch (e) {
    console.error('storage API 不可用:', e);
    if (callback) callback();
  }
}

// ==================== 核心功能 ====================
async function handleExportClick() {
  if (exportButton) {
    exportButton.disabled = true;
    exportButton.innerHTML = `
      <span class="btn-icon spinning">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 18V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4.93 4.93L7.76 7.76" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16.24 16.24L19.07 19.07" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18 12H22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4.93 19.07L7.76 16.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16.24 7.76L19.07 4.93" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="btn-text">正在检测...</span>
    `;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 检查是否在飞书文档页面
    if (!tab.url || (!tab.url.includes('feishu.cn/docx') && !tab.url.includes('feishu.cn/wiki'))) {
      showToast('请在飞书文档页面使用此功能', 'error');
      resetButton();
      return;
    }

    // 尝试检查页面加载状态
    let pageStatus = null;
    let retryCount = 0;
    const maxRetry = 10; // 最多重试 10 次
    
    // 显示检测中状态
    updateButtonText('正在检测页面...');
    
    while (retryCount < maxRetry) {
      try {
        pageStatus = await chrome.tabs.sendMessage(tab.id, { action: 'check_ready' });
        break; // 成功获取响应，退出循环
      } catch (msgErr) {
        // content script 可能还未注入，等待后重试
        retryCount++;
        
        if (retryCount >= maxRetry) {
          // 最后一次尝试：手动注入 content script
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            // 等待脚本初始化
            await new Promise(resolve => setTimeout(resolve, 500));
            // 再次尝试获取状态
            pageStatus = await chrome.tabs.sendMessage(tab.id, { action: 'check_ready' });
          } catch (injectErr) {
            showToast('无法连接到页面，请刷新后重试', 'error');
            resetButton();
            return;
          }
        } else {
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }

    // 检查页面状态
    if (!pageStatus) {
      showToast('页面检测失败，请刷新后重试', 'error');
      resetButton();
      return;
    }
    
    if (!pageStatus.ready) {
      // 页面未加载完成，显示等待提示
      showWaitingUI(pageStatus.reason);
      
      // 开始轮询检查页面状态
      let waitRetryCount = 0;
      const maxWaitRetry = 30; // 最多等待 30 次 (约 15 秒)
      
      const checkInterval = setInterval(async () => {
        waitRetryCount++;
        
        try {
          const status = await chrome.tabs.sendMessage(tab.id, { action: 'check_ready' });
          
          if (status.ready) {
            clearInterval(checkInterval);
            updateWaitingProgress(status.blockCount);
            // 页面已加载完成，开始导出
            setTimeout(() => startExport(tab), 500);
          } else if (waitRetryCount >= maxWaitRetry) {
            clearInterval(checkInterval);
            showToast('页面加载超时，请刷新页面后重试', 'error');
            resetButton();
          } else {
            updateWaitingProgress(status.blockCount || 0);
          }
        } catch (err) {
          // 消息发送失败，可能页面正在跳转
          clearInterval(checkInterval);
          showToast('检测失败，请刷新页面后重试', 'error');
          resetButton();
        }
      }, 500);
      
      return;
    }
    
    // 页面已加载完成，直接开始导出
    startExport(tab);

  } catch (error) {
    console.error('导出失败:', error);
    showToast('导出启动失败，请刷新页面后重试', 'error');
    resetButton();
  }
}

/**
 * 开始导出流程
 * @param {Object} tab - 当前标签页
 */
async function startExport(tab) {
  updateButtonText('正在导出...');
  
  try {
    // 传递导出模式给 content script
    await chrome.tabs.sendMessage(tab.id, { 
      action: 'start_scrape',
      exportMode: currentExportMode
    });
    window.close();
  } catch (error) {
    console.error('导出失败:', error);
    showToast('导出启动失败，请刷新页面后重试', 'error');
    resetButton();
  }
}

/**
 * 显示等待 UI
 * @param {string} reason - 等待原因
 */
function showWaitingUI(reason) {
  if (exportButton) {
    exportButton.disabled = true;
    exportButton.innerHTML = `
      <span class="btn-icon spinning">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 18V22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4.93 4.93L7.76 7.76" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16.24 16.24L19.07 19.07" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18 12H22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M4.93 19.07L7.76 16.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16.24 7.76L19.07 4.93" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="btn-text">等待页面加载...</span>
    `;
  }
  
  // 显示等待提示
  showWaitingTip(reason);
}

/**
 * 显示等待提示
 * @param {string} reason - 等待原因
 */
function showWaitingTip(reason) {
  let tipEl = document.getElementById('waiting-tip');
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'waiting-tip';
    tipEl.className = 'waiting-tip';
    const container = document.querySelector('.action-area');
    if (container) {
      container.appendChild(tipEl);
    }
  }
  
  tipEl.innerHTML = `
    <div class="waiting-icon">⏳</div>
    <div class="waiting-text"></div>
    <div class="waiting-progress" id="waiting-progress">检测中...</div>
  `;
  tipEl.querySelector('.waiting-text').textContent = reason;
}

/**
 * 更新等待进度
 * @param {number} blockCount - 已加载的区块数量
 */
function updateWaitingProgress(blockCount) {
  const progressEl = document.getElementById('waiting-progress');
  if (progressEl) {
    if (blockCount > 0) {
      progressEl.textContent = `已检测到 ${blockCount} 个内容块`;
    } else {
      progressEl.textContent = '正在检测页面内容...';
    }
  }
}

/**
 * 更新按钮文字
 * @param {string} text - 按钮文字
 */
function updateButtonText(text) {
  if (exportButton) {
    const textEl = exportButton.querySelector('.btn-text');
    if (textEl) {
      textEl.textContent = text;
    }
  }
}

function resetButton() {
  if (exportButton) {
    exportButton.disabled = false;
    exportButton.innerHTML = `
      <span class="btn-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span class="btn-text">导出当前文档</span>
    `;
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
