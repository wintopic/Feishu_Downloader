/**
 * 飞书导出助手 - 后台脚本 (Background Script / Service Worker)
 * 
 * 功能说明:
 * 1. 处理来自 content script 的文件下载请求
 * 2. 使用 chrome.downloads API 下载文件
 * 3. 提供持久的消息监听服务
 * 
 * 技术实现:
 * - Manifest V3 使用 Service Worker 作为后台脚本
 * - 通过 chrome.runtime.onMessage 监听消息
 * - 使用 chrome.downloads.download 执行下载
 */

'use strict';

// ==================== 消息监听 ====================

/**
 * 监听来自 content script 的消息
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 处理文件下载请求
  if (message.action === 'download_file') {
    handleDownload(message, sender, sendResponse);
    return true; // 保持消息通道开放，等待异步响应
  }
  
  // 处理批量下载请求
  if (message.action === 'download_files') {
    handleBatchDownload(message, sender, sendResponse);
    return true;
  }
  
  // 打开浏览器下载页面
  if (message.action === 'open_downloads') {
    chrome.tabs.create({ url: 'chrome://downloads' });
    return false;
  }
});

// ==================== 下载处理 ====================

/**
 * 处理单个文件下载
 * @param {Object} message - 消息对象，包含 url 和 filename
 * @param {Object} sender - 发送者信息
 * @param {Function} sendResponse - 回调函数
 */
async function handleDownload(message, sender, sendResponse) {
  try {
    const { url, filename } = message;
    
    if (!url || !filename) {
      sendResponse({ success: false, error: '缺少必要参数' });
      return;
    }
    
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false, // 不弹出保存对话框，直接下载到默认位置
      conflictAction: 'uniquify' // 文件名冲突时自动重命名
    });
    
    console.log(`下载已开始: ${filename} (ID: ${downloadId})`);
    sendResponse({ success: true, downloadId });
    
  } catch (error) {
    console.error('下载失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 处理批量下载
 * @param {Object} message - 消息对象，包含 files 数组
 * @param {Object} sender - 发送者信息
 * @param {Function} sendResponse - 回调函数
 */
async function handleBatchDownload(message, sender, sendResponse) {
  try {
    const { files } = message;
    const results = [];
    
    for (const file of files) {
      try {
        const downloadId = await chrome.downloads.download({
          url: file.url,
          filename: file.filename,
          saveAs: false,
          conflictAction: 'uniquify'
        });
        
        results.push({ filename: file.filename, success: true, downloadId });
        
        // 稍微延迟避免下载太快
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`下载失败: ${file.filename}`, error);
        results.push({ filename: file.filename, success: false, error: error.message });
      }
    }
    
    sendResponse({ success: true, results });
    
  } catch (error) {
    console.error('批量下载失败:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ==================== 下载状态监听 ====================

/**
 * 监听下载状态变化
 */
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state) {
    if (delta.state.current === 'complete') {
      console.log(`下载完成: ID ${delta.id}`);
    } else if (delta.state.current === 'interrupted') {
      console.log(`下载中断: ID ${delta.id}`);
    }
  }
});

console.log('飞书导出助手 - 后台脚本已加载');
