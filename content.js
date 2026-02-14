/**
 * 飞书导出助手 - 内容脚本 (Content Script)
 * 
 * 功能说明:
 * 该脚本注入到飞书文档页面中，负责:
 * 1. 自动滚动页面抓取所有文档区块
 * 2. 将飞书文档内容转换为 Markdown 格式（支持标题、表格、代码块、列表等）
 * 3. 提取文档中的图片链接
 * 4. 批量下载图片并保存到本地
 * 5. 生成完整的 Markdown 文件
 * 
 * 技术实现:
 * - 使用 Chrome Extension Content Script API 注入页面
 * - 使用 File System Access API 保存文件到本地
 * - 通过消息传递与 Popup 通信
 */

'use strict';

// ==================== 状态变量 ====================

/** 存储文档区块数据的 Map */
let blockDataMap = new Map();

/** 存储已发现的图片URL的 Set */
let imageUrlSet = new Set();

/** 抓取状态标志 */
let isScraping = false;

/** 用户请求停止标志 */
let shouldStop = false;

/** 控制面板 DOM 元素引用 */
let controlPanel = null;

/** 文件系统目录句柄 */
let directoryHandle = null;

/** 当前是否在保存阶段 */
let isSaving = false;

/** 导出模式: 'browser' | 'folder' */
let exportMode = 'browser';

// ==================== Markdown 转换器 ====================

/**
 * Markdown 转换器
 * 将飞书文档的 HTML 转换为标准 Markdown 格式
 */
const MarkdownConverter = {
  /**
   * 主转换函数
   * @param {HTMLElement} element - 要转换的 DOM 元素
   * @returns {string} Markdown 文本
   */
  convert(element) {
    if (!element) return '';
    return this.convertNode(element).trim();
  },

  /**
   * 根据节点类型选择对应的转换方法
   * @param {Node} node - DOM 节点
   * @returns {string} Markdown 文本
   */
  convertNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return this.escapeText(node.textContent);
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const tag = node.tagName.toLowerCase();
    
    // 根据标签选择转换方法
    const converters = {
      // 标题
      'h1': () => this.convertHeading(node, 1),
      'h2': () => this.convertHeading(node, 2),
      'h3': () => this.convertHeading(node, 3),
      'h4': () => this.convertHeading(node, 4),
      'h5': () => this.convertHeading(node, 5),
      'h6': () => this.convertHeading(node, 6),
      'h7': () => this.convertHeading(node, 7),
      'h8': () => this.convertHeading(node, 8),
      'h9': () => this.convertHeading(node, 9),
      
      // 段落和文本格式
      'p': () => this.convertParagraph(node),
      'br': () => '  \n',
      'strong': () => this.wrapInline(node, '**'),
      'b': () => this.wrapInline(node, '**'),
      'em': () => this.wrapInline(node, '*'),
      'i': () => this.wrapInline(node, '*'),
      'del': () => this.wrapInline(node, '~~'),
      's': () => this.wrapInline(node, '~~'),
      'code': () => this.convertInlineCode(node),
      'mark': () => this.wrapInline(node, '=='),
      'sub': () => this.wrapInline(node, '~'),
      'sup': () => this.wrapInline(node, '^'),
      
      // 链接和图片
      'a': () => this.convertLink(node),
      'img': () => this.convertImage(node),
      
      // 列表
      'ul': () => this.convertList(node, false),
      'ol': () => this.convertList(node, true),
      'li': () => this.convertListItem(node),
      
      // 表格
      'table': () => this.convertTable(node),
      'thead': () => this.convertTableSection(node, 'thead'),
      'tbody': () => this.convertTableSection(node, 'tbody'),
      'tr': () => this.convertTableRow(node),
      'th': () => this.convertTableCell(node, true),
      'td': () => this.convertTableCell(node, false),
      
      // 代码块
      'pre': () => this.convertCodeBlock(node),
      
      // 引用
      'blockquote': () => this.convertBlockquote(node),
      
      // 分割线
      'hr': () => '\n---\n',
      
      // 其他块级元素
      'div': () => this.convertChildren(node),
      'span': () => this.convertChildren(node),
      'section': () => this.convertChildren(node),
      'article': () => this.convertChildren(node),
    };

    // 检查是否是飞书特定的元素类型
    const blockType = node.getAttribute?.('data-block-type');
    if (blockType) {
      return this.convertFeishuBlock(node, blockType);
    }

    const converter = converters[tag];
    if (converter) {
      return converter();
    }

    // 默认处理：转换子节点
    return this.convertChildren(node);
  },

  /**
   * 转换飞书特定的区块类型
   */
  convertFeishuBlock(node, type) {
    const feishuConverters = {
      'heading1': () => this.convertHeading(node, 1),
      'heading2': () => this.convertHeading(node, 2),
      'heading3': () => this.convertHeading(node, 3),
      'heading4': () => this.convertHeading(node, 4),
      'heading5': () => this.convertHeading(node, 5),
      'heading6': () => this.convertHeading(node, 6),
      'heading7': () => this.convertHeading(node, 7),
      'heading8': () => this.convertHeading(node, 8),
      'heading9': () => this.convertHeading(node, 9),
      'text': () => this.convertChildren(node),
      'paragraph': () => this.convertParagraph(node),
      'bullet': () => this.convertBulletBlock(node),
      'ordered': () => this.convertOrderedBlock(node),
      'code': () => this.convertCodeBlock(node),
      'quote': () => this.convertBlockquote(node),
      'table': () => this.convertTable(node),
      'todo': () => this.convertTodoBlock(node),
      'callout': () => this.convertCallout(node),
      'divider': () => '\n---\n',
      'image': () => this.convertImageBlock(node),
    };

    const converter = feishuConverters[type];
    return converter ? converter() : this.convertChildren(node);
  },

  /**
   * 转换标题
   */
  convertHeading(node, level) {
    const text = this.convertChildren(node).trim();
    if (!text) return '';
    // 标准 Markdown 仅支持 h1-h6，超出的级别限制为 h6
    return '\n' + '#'.repeat(Math.min(level, 6)) + ' ' + text + '\n';
  },

  /**
   * 转换段落
   */
  convertParagraph(node) {
    const text = this.convertChildren(node).trim();
    if (!text) return '';
    return '\n' + text + '\n';
  },

  /**
   * 转换行内代码
   */
  convertInlineCode(node) {
    const code = this.convertChildren(node).trim();
    if (!code) return '';
    return '`' + code + '`';
  },

  /**
   * 转换链接
   */
  convertLink(node) {
    const text = this.convertChildren(node).trim();
    const href = node.getAttribute('href') || '';
    if (!text && !href) return '';
    return `[${text || href}](${href})`;
  },

  /**
   * 转换图片
   */
  convertImage(node) {
    // 获取图片真实 URL
    let imgUrl = node.getAttribute('data-src') ||
                 node.getAttribute('data-origin-src') ||
                 node.getAttribute('src');

    // 排除 blob URL 和 data URI
    if (imgUrl && (imgUrl.startsWith('blob:') || imgUrl.startsWith('data:'))) {
      imgUrl = null;
    }

    // 获取有意义的 alt 文本
    const alt = node.getAttribute('alt')?.trim() || 'image';

    // 处理协议相对 URL（//example.com/img.png）
    if (imgUrl && imgUrl.startsWith('//')) {
      imgUrl = 'https:' + imgUrl;
    }

    if (imgUrl && imgUrl.startsWith('http')) {
      // 收集图片 URL 用于后续下载（去重）
      imageUrlSet.add(imgUrl);
      // Markdown 中每次出现都输出（不跳过重复）
      return `\n![${alt}](${imgUrl})\n`;
    }
    return '';
  },

  /**
   * 转换列表
   */
  convertList(node, isOrdered) {
    const items = Array.from(node.children)
      .filter(child => child.tagName.toLowerCase() === 'li')
      .map((item, index) => {
        const content = this.convertChildren(item).trim();
        if (!content) return '';
        const prefix = isOrdered ? `${index + 1}.` : '-';
        // 处理嵌套列表的缩进
        const lines = content.split('\n');
        return lines.map((line, i) => {
          if (i === 0) return `${prefix} ${line}`;
          if (line.startsWith('-') || /^\d+\./.test(line)) {
            return '  ' + line;
          }
          return line;
        }).join('\n');
      })
      .filter(item => item);
    
    if (items.length === 0) return '';
    return '\n' + items.join('\n') + '\n';
  },

  /**
   * 转换列表项
   */
  convertListItem(node) {
    return this.convertChildren(node);
  },

  /**
   * 转换待办事项（保留用于 HTML <todo> 标签）
   */
  convertTodo(node) {
    const checkbox = node.querySelector('input[type="checkbox"]');
    const isChecked = checkbox ? checkbox.checked : false;
    const text = this.convertChildren(node).replace(/\[.*?\]/, '').trim();
    if (!text) return '';
    return `- [${isChecked ? 'x' : ' '}] ${text}`;
  },

  /**
   * 转换飞书 bullet 区块（每个区块是一个列表项）
   * 飞书中每个列表项是独立的 data-block-type="bullet" 块
   */
  convertBulletBlock(node) {
    // 先尝试找到传统的 ul 结构
    const ul = node.querySelector('ul');
    if (ul) {
      return this.convertList(ul, false);
    }
    // 检查是否有独立的 li 元素（无 ul 包裹）
    const li = node.querySelector('li');
    if (li) {
      const text = this.convertChildren(li).trim();
      if (!text) return '';
      return '- ' + text;
    }
    // 飞书独立列表项：直接提取文本作为单个 bullet
    const text = this.convertChildren(node).trim();
    if (!text) return '';
    return '- ' + text;
  },

  /**
   * 转换飞书 ordered 区块（每个区块是一个有序列表项）
   */
  convertOrderedBlock(node) {
    // 先尝试找到传统的 ol 结构
    const ol = node.querySelector('ol');
    if (ol) {
      return this.convertList(ol, true);
    }
    // 检查是否有独立的 li 元素（无 ol 包裹）
    const li = node.querySelector('li');
    if (li) {
      const text = this.convertChildren(li).trim();
      if (!text) return '';
      return '1. ' + text;
    }
    const text = this.convertChildren(node).trim();
    if (!text) return '';
    return '1. ' + text;
  },

  /**
   * 转换飞书 todo 区块
   */
  convertTodoBlock(node) {
    const checkbox = node.querySelector('input[type="checkbox"]');
    const isChecked = checkbox ? checkbox.checked : false;
    // 移除 checkbox 文本残留
    let text = this.convertChildren(node).trim();
    text = text.replace(/^\[.*?\]\s*/, '').replace(/^[\u2610\u2611\u2612]\s*/, '');
    if (!text) return '';
    return `- [${isChecked ? 'x' : ' '}] ${text}`;
  },

  /**
   * 转换飞书 image 区块
   */
  convertImageBlock(node) {
    const img = node.querySelector('img');
    if (img) return this.convertImage(img);
    return this.convertChildren(node);
  },

  /**
   * 转换高亮块
   */
  convertCallout(node) {
    const emoji = node.querySelector('.callout-emoji')?.textContent || '💡';
    const content = this.convertChildren(node).trim();
    if (!content) return '';
    return '\n> ' + emoji + ' ' + content.replace(/\n/g, '\n> ') + '\n';
  },

  /**
   * 转换表格
   */
  convertTable(node) {
    const rows = [];
    const alignments = [];
    
    // 处理表头
    const thead = node.querySelector('thead');
    if (thead) {
      const headerRow = thead.querySelector('tr');
      if (headerRow) {
        const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => {
          const text = this.convertChildren(cell).trim();
          // 检测对齐方式
          const style = cell.getAttribute('style') || '';
          const align = cell.style.textAlign || 
                       (style.includes('text-align: center') ? 'center' :
                        style.includes('text-align: right') ? 'right' : 'left');
          alignments.push(align);
          return text;
        });
        rows.push(headers);
      }
    }
    
    // 处理表体
    const tbody = node.querySelector('tbody');
    const bodyContainer = tbody || node;
    const bodyRows = bodyContainer.querySelectorAll('tr');
    bodyRows.forEach(row => {
      // 跳过已在 thead 中处理过的行
      if (!tbody && row.parentElement?.tagName.toLowerCase() === 'thead') return;
      const cells = Array.from(row.querySelectorAll('td, th')).map(cell => {
        return this.convertChildren(cell).trim();
      });
      rows.push(cells);
    });
    
    if (rows.length === 0) return '';
    
    // 如果没有表头但有数据，使用第一行作为表头
    if (rows.length > 0 && alignments.length === 0) {
      alignments.push(...new Array(rows[0].length).fill('left'));
    }
    
    // 生成 Markdown 表格
    const columnCount = Math.max(...rows.map(r => r.length));
    const paddedRows = rows.map(row => {
      while (row.length < columnCount) row.push('');
      return row;
    });
    
    let markdown = '\n';
    
    // 表头行
    markdown += '| ' + paddedRows[0].join(' | ') + ' |\n';
    
    // 分隔行
    const separator = alignments.map(align => {
      if (align === 'center') return ':---:';
      if (align === 'right') return '---:';
      return '---';
    });
    markdown += '| ' + separator.join(' | ') + ' |\n';
    
    // 数据行
    for (let i = 1; i < paddedRows.length; i++) {
      markdown += '| ' + paddedRows[i].join(' | ') + ' |\n';
    }
    
    return markdown + '\n';
  },

  /**
   * 转换表格区域
   */
  convertTableSection(node, type) {
    return this.convertChildren(node);
  },

  /**
   * 转换表格行
   */
  convertTableRow(node) {
    return this.convertChildren(node);
  },

  /**
   * 转换表格单元格
   */
  convertTableCell(node, isHeader) {
    return this.convertChildren(node).trim();
  },

  /**
   * 转换代码块
   */
  convertCodeBlock(node) {
    // 查找代码元素
    const codeEl = node.querySelector('code');
    const preEl = node.tagName.toLowerCase() === 'pre' ? node : node.querySelector('pre');

    // 获取语言 - 从多个来源检测
    let language = '';
    // 1. 从 code 元素 className 获取
    if (codeEl) {
      const className = codeEl.className || '';
      const match = className.match(/language-(\w+)|lang-(\w+)|code-(\w+)/);
      language = match ? (match[1] || match[2] || match[3]) : '';
    }
    // 2. 从 pre 元素 className 获取
    if (!language && preEl) {
      const preClass = preEl.className || '';
      const match = preClass.match(/language-(\w+)|lang-(\w+)/);
      language = match ? (match[1] || match[2]) : '';
    }
    // 3. 从 data-language 或 data-lang 属性获取
    if (!language) {
      language = node.getAttribute('data-language') ||
                 node.getAttribute('data-lang') ||
                 codeEl?.getAttribute('data-language') ||
                 codeEl?.getAttribute('data-lang') || '';
    }

    // 获取代码内容 - 优先使用 code 元素
    const codeContent = codeEl ? codeEl.textContent : (preEl ? preEl.textContent : node.textContent);

    if (!codeContent.trim()) return '';

    // 清理代码内容
    let cleanedCode = codeContent
      .replace(/\u200B/g, '')  // 移除零宽空格
      .replace(/^\n+|\n+$/g, '');  // 移除首尾空行

    return '\n```' + language + '\n' + cleanedCode + '\n```\n';
  },

  /**
   * 转换引用块
   */
  convertBlockquote(node) {
    const content = this.convertChildren(node).trim();
    if (!content) return '';
    
    // 在每行前添加引用符号
    const lines = content.split('\n');
    const quoted = lines.map(line => {
      if (line.trim() === '') return '>';
      return '> ' + line;
    }).join('\n');
    
    return '\n' + quoted + '\n';
  },

  /**
   * 包装行内元素
   */
  wrapInline(node, wrapper) {
    const content = this.convertChildren(node).trim();
    if (!content) return '';
    return wrapper + content + wrapper;
  },

  /**
   * 转换子节点
   */
  convertChildren(node) {
    if (!node.childNodes || node.childNodes.length === 0) return '';

    const blockTags = new Set(['div', 'p', 'section', 'article', 'figure', 'figcaption']);
    const children = Array.from(node.childNodes);

    return children.map((child, index) => {
      let result = this.convertNode(child);

      // 相邻块级元素之间添加换行（飞书用 <div> 嵌套表示多行文本）
      if (child.nodeType === Node.ELEMENT_NODE &&
          blockTags.has(child.tagName.toLowerCase()) &&
          result.trim() &&
          !result.endsWith('\n')) {
        const next = children[index + 1];
        if (next && next.nodeType === Node.ELEMENT_NODE &&
            blockTags.has(next.tagName.toLowerCase())) {
          result += '  \n';
        }
      }

      return result;
    }).join('');
  },

  /**
   * 转义 Markdown 特殊字符
   */
  escapeText(text) {
    if (!text) return '';
    return text
      .replace(/\u200B/g, '')       // 移除零宽空格
      .replace(/[\u200C\u200D\uFEFF]/g, '') // 移除其他零宽字符
      .replace(/附件不支持打印/g, '')  // 移除飞书特定提示
      .replace(/\u00A0/g, ' ');      // 不间断空格转为普通空格
  }
};

// ==================== UI 控制面板 ====================

/**
 * 创建并返回控制面板元素
 */
function createControlPanel() {
  if (controlPanel) return controlPanel;

  controlPanel = document.createElement('div');
  controlPanel.id = 'feishu-backup-panel';
  
  // 注入样式（只注入一次）
  if (!document.getElementById('feishu-backup-panel-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'feishu-backup-panel-styles';
    styleEl.textContent = `
      #feishu-backup-panel * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      @keyframes backup-panel-in {
        from {
          opacity: 0;
          transform: translateY(-10px) scale(0.98);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      
      @keyframes backup-breathe {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      
      .backup-btn-hover:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      
      .backup-btn-hover:active {
        transform: translateY(0);
      }
    `;
    document.head.appendChild(styleEl);
  }
  
  controlPanel.innerHTML = `
    <div style="
      position: fixed;
      top: 24px;
      right: 24px;
      width: 300px;
      background: linear-gradient(
        135deg,
        rgba(253, 253, 251, 0.98) 0%,
        rgba(250, 250, 248, 0.99) 25%,
        rgba(245, 245, 243, 0.98) 50%,
        rgba(250, 250, 248, 0.99) 75%,
        rgba(253, 253, 251, 0.98) 100%
      );
      border-radius: 20px;
      box-shadow: 
        0 2px 8px rgba(0, 0, 0, 0.04),
        0 8px 32px rgba(0, 0, 0, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.9),
        inset 0 -1px 0 rgba(0, 0, 0, 0.02);
      padding: 24px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
      animation: backup-panel-in 0.4s ease;
      border: 1px solid rgba(234, 234, 232, 0.5);
    ">
      <!-- 头部 -->
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid rgba(234, 234, 232, 0.8);">
        <div style="
          width: 40px;
          height: 40px;
          background: #1A1A1A;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #FDFDFB;
          font-size: 18px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        "><svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" style="width:22px;height:22px;"><path d="M224 421.12v6.912l0.512 180.224-0.256 35.84 0.256 15.36 0.256 5.376 0.512 3.584v0.512c0 0.256 0 0.512 0.256 0.768 1.024 4.352 3.584 7.936 7.424 11.52 3.328 3.072 7.424 5.632 13.824 9.216 30.464 16.64 59.648 28.928 89.6 37.376 30.72 8.704 62.72 13.312 97.024 14.08 35.584 0.768 68.608-2.816 100.864-11.264 30.976-7.936 61.696-19.968 94.208-36.864 24.064-12.544 50.432-32.256 74.496-55.552l8.448-8.448 8.192-8.704 3.328-3.84-1.792 1.024-6.912 3.584-2.56 1.28c-27.136 12.544-55.296 16.128-86.784 12.288l-9.472-1.28-9.472-1.792-2.304-0.512-2.304-0.512-9.984-2.304-2.56-0.768-2.816-0.768-11.52-3.328-2.048-0.512c-1.28-0.512-2.816-0.768-4.096-1.28l-20.992-6.656-10.24-3.328-29.952-10.752-14.848-5.632-13.568-4.608-6.656-2.816-7.168-3.328-0.768-0.256c-0.768-0.256-1.28-0.768-2.048-1.28l-9.728-4.864-25.344-12.032-15.872-7.936-5.632-3.072c-28.416-14.848-56.32-32.768-84.224-52.992-26.88-19.712-53.504-41.728-80.128-66.048l-13.312-12.544-3.84-3.072z" fill="#FDFDFB"/><path d="M760.32 413.952l-9.984 0.256-3.84 0.256c-15.104 0.768-30.208 3.328-44.8 7.168-13.312 3.584-26.368 8.448-38.912 14.848-12.8 6.4-24.832 13.824-36.096 22.528l-6.4 4.864-1.536 1.28-1.536 1.28-6.144 5.376-6.4 5.888-7.168 6.656-33.792 32.768-2.304 2.048c-16.384 15.36-28.416 25.6-42.496 35.328l-5.632 3.84-14.592 9.472-2.048 1.28c-2.816 1.792-5.376 3.328-7.936 4.864l-7.424 4.096 10.752 4.352 31.488 11.776 19.456 6.912 22.016 7.168 12.544 3.84 11.008 3.072 2.56 0.768c2.56 0.768 5.12 1.28 7.424 1.792l9.472 2.048 2.304 0.512 2.304 0.512 8.96 1.536 2.304 0.256 2.304 0.256c29.696 3.584 56.064 0 81.408-12.288 32.512-15.616 47.872-31.744 69.12-70.912l6.912-13.056 11.008-21.504 4.864-9.216 1.536-2.816c14.848-28.16 26.112-45.312 41.472-61.184l1.536-1.536-3.584-1.28-4.352-1.536-9.216-3.072-7.936-2.304-3.584-1.024c-14.592-3.584-29.696-5.888-44.8-6.4l-10.24-0.768zM328.96 276.992l8.704 6.4 12.544 9.216 5.12 3.84c14.08 10.752 27.904 21.76 41.472 33.28 18.944 16.384 36.864 33.792 54.016 52.224 15.872 16.896 29.696 32.768 42.24 48.384 9.984 12.288 19.456 24.832 28.672 37.888l10.752 15.872 17.408 27.904 11.008-10.24 16.64-15.872 9.472-8.96 12.544-11.52 2.816-2.56c7.936-7.168 16.384-13.824 24.832-20.224 6.912-5.12 15.104-10.24 24.32-15.104 6.4-3.328 12.8-6.4 19.456-9.216l11.008-4.352 5.888-2.048-0.256-0.768-0.256-1.28c-1.28-5.376-3.584-12.288-6.912-20.224l-4.352-10.752-1.024-2.304c-6.912-15.872-15.104-32.256-21.248-42.496l-12.544-19.2-6.912-9.984-1.28-1.536c-9.216-12.8-16.64-20.736-22.784-23.552-4.096-2.048-7.936-2.56-14.336-2.816H328.96z" fill="#FDFDFB"/></svg></div>
        <div>
          <div style="font-weight: 600; font-size: 16px; color: #1A1A1A; letter-spacing: -0.01em;">飞书导出助手</div>
          <div id="backup-subtitle" style="font-size: 12px; color: #8A8A8A; letter-spacing: 0.02em;">正在导出...</div>
        </div>
      </div>
      
      <!-- 状态 -->
      <div id="backup-status" style="
        font-size: 13px;
        color: #4A4A4A;
        margin-bottom: 12px;
        line-height: 1.5;
      ">准备中...</div>
      
      <!-- 进度条 -->
      <div style="
        background: #EAEAE8;
        border-radius: 4px;
        height: 4px;
        margin-bottom: 20px;
        overflow: hidden;
      ">
        <div id="backup-progress-bar" style="
          width: 0%;
          height: 100%;
          background: #1A1A1A;
          border-radius: 4px;
          transition: width 0.3s ease;
        "></div>
      </div>
      
      <!-- 按钮 -->
      <div style="display: flex; gap: 8px;">
        <button id="backup-stop-btn" class="backup-btn-hover" style="
          flex: 1;
          padding: 12px 16px;
          background: #1A1A1A;
          color: #FDFDFB;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.02em;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        ">完成导出</button>
        <button id="backup-close-btn" class="backup-btn-hover" style="
          padding: 12px 14px;
          background: #F5F5F3;
          color: #4A4A4A;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s ease;
        ">✕</button>
      </div>
      
      <!-- 统计 -->
      <div id="backup-stats" style="
        font-size: 11px;
        color: #8A8A8A;
        margin-top: 16px;
        text-align: center;
        letter-spacing: 0.02em;
      ">区块: 0 | 图片: 0</div>
    </div>
  `;

  document.body.appendChild(controlPanel);

  // 绑定事件 - 主按钮（完成导出/另存为）
  document.getElementById('backup-stop-btn').onclick = async () => {
    const btn = document.getElementById('backup-stop-btn');
    const action = btn?.dataset.action || 'complete';

    if (isSaving) {
      // 正在保存阶段，按钮无效
      return;
    }

    switch (action) {
      case 'complete':
        // 完成导出 - 停止滚动并保存
        if (isScraping) {
          // 用户手动点击结束，立即停止并保存（当前处于用户手势上下文，folder picker 可用）
          shouldStop = true;
          isScraping = false;
          updateStatus(`✅ 抓取完成，共 ${blockDataMap.size} 个区块`);
          if (blockDataMap.size > 0) {
            saveContent();
          } else {
            updateStatus('❌ 没有可保存的内容');
          }
        } else if (blockDataMap.size > 0) {
          saveContent();
        } else {
          updateStatus('❌ 没有可保存的内容');
        }
        break;

      case 'saveAs':
        // 另存为 - 选择其他位置保存
        saveAs();
        break;

      case 'retry':
        // 重试 - 重新保存
        if (blockDataMap.size > 0) {
          saveContent();
        } else {
          updateStatus('❌ 没有可保存的内容');
        }
        break;
    }
  };

  document.getElementById('backup-close-btn').onclick = () => {
    shouldStop = true;
    hideControlPanel();
  };

  return controlPanel;
}

function showControlPanel() {
  createControlPanel();
  controlPanel.style.display = 'block';
}

function hideControlPanel() {
  if (controlPanel) {
    controlPanel.style.display = 'none';
  }
}

function updateStatus(text) {
  const statusEl = document.getElementById('backup-status');
  if (statusEl) statusEl.textContent = text;
}

function updateProgress(percent) {
  const progressEl = document.getElementById('backup-progress-bar');
  if (progressEl) progressEl.style.width = percent + '%';
}

function updateStats() {
  const statsEl = document.getElementById('backup-stats');
  if (statsEl) {
    statsEl.textContent = `区块: ${blockDataMap.size} | 图片: ${imageUrlSet.size}`;
  }
}

/**
 * 更新按钮状态
 * @param {string} state - 状态: 'scraping' | 'saving' | 'done' | 'error'
 */
function updateButtonState(state) {
  const btn = document.getElementById('backup-stop-btn');
  if (!btn) return;
  
  const states = {
    scraping: { text: '完成导出', disabled: false, bg: '#1A1A1A', action: 'complete' },
    selectFolder: { text: '选择文件夹保存', disabled: false, bg: '#1A1A1A', action: 'complete' },
    scraped: { text: '正在保存...', disabled: false, bg: '#1A1A1A', action: 'saveAs' },
    saving: { text: '正在保存...', disabled: true, bg: '#8A8A8A', action: 'none' },
    done: { text: '另存为', disabled: false, bg: '#1A1A1A', action: 'saveAs' },
    error: { text: '重试', disabled: false, bg: '#E53935', action: 'retry' }
  };
  
  const config = states[state] || states.scraping;
  btn.textContent = config.text;
  btn.disabled = config.disabled;
  btn.style.background = config.bg;
  btn.style.cursor = config.disabled ? 'not-allowed' : 'pointer';
  btn.dataset.action = config.action;
}

// ==================== 内容提取 ====================

/**
 * 从区块 HTML 中提取文本内容（使用增强的 Markdown 转换器）
 * @param {HTMLElement} blockElement - 区块 DOM 元素
 * @returns {string} Markdown 文本
 */
function extractBlockText(blockElement) {
  // 克隆元素以避免修改原始 DOM
  const clone = blockElement.cloneNode(true);
  
  // 移除打印隐藏的元素
  clone.querySelectorAll('[data-print-hidden], .image-placeholder-text, .print-hidden').forEach(el => {
    el.remove();
  });

  // 使用 Markdown 转换器转换
  return MarkdownConverter.convert(clone);
}

/**
 * 抓取当前页面可见的所有文档区块
 */
function scrapeBlocks() {
  const blocks = document.querySelectorAll('div[data-block-id]');
  
  blocks.forEach(block => {
    const blockId = block.getAttribute('data-block-id');
    
    if (!blockDataMap.has(blockId)) {
      const markdown = extractBlockText(block);
      if (markdown) {
        blockDataMap.set(blockId, markdown);
      }
    }
  });

  updateStats();
}

// ==================== 文件保存 ====================

/**
 * 获取文档标题
 * @returns {string} 文档标题，如果获取失败则返回默认名称
 */
function getDocumentTitle() {
  let title = '';
  
  // ===== 优先级1：从飞书文档特定的标题元素获取 =====
  // 飞书文档的标题通常在这些元素中
  const titleSelectors = [
    // 飞书新版本标题选择器
    '[data-lark-record-format="true"] [class*="title"]',
    '[data-block-type="title"]',
    // 编辑器标题区域
    '.doc-title-wrapper [contenteditable="true"]',
    '.doc-title-wrapper',
    // Wiki 知识库标题
    '.wiki-title',
    '.lark-record-title',
    // 通用标题类
    '.doc-title',
    '.document-title',
    '[class*="doc-title"]',
    // 标题区块
    '[data-block-type="heading1"]:first-of-type',
    'h1.title',
    'h1'
  ];
  
  for (const selector of titleSelectors) {
    const titleEl = document.querySelector(selector);
    if (titleEl && titleEl.textContent.trim()) {
      title = titleEl.textContent.trim();
      // 确保不是 "无标题" 这类占位文字
      if (title && title !== '无标题' && title !== 'Untitled' && title.length > 0) {
        console.log('[标题识别] 从选择器获取:', selector, '→', title);
        break;
      }
      title = '';
    }
  }
  
  // ===== 优先级2：从页面标题提取（排除飞书后缀） =====
  if (!title) {
    const pageTitle = document.title;
    if (pageTitle) {
      // 飞书文档标题格式通常是："文档标题 - 飞书文档" 或 "文档标题 - Feishu"
      title = pageTitle
        .replace(/\s*[-–—|]\s*飞书文档$/i, '')
        .replace(/\s*[-–—|]\s*飞书$/i, '')
        .replace(/\s*[-–—|]\s*Feishu Docs?$/i, '')
        .replace(/\s*[-–—|]\s*Feishu$/i, '')
        .replace(/\s*[-–—|]\s*Lark$/i, '')
        .replace(/\s*[-–—|]\s*知识库$/i, '')
        .replace(/\s*[-–—|]\s*Wiki$/i, '')
        .trim();
      
      // 如果提取后为空或与原标题相同，说明可能是首页等其他页面
      if (title && title !== pageTitle) {
        console.log('[标题识别] 从页面标题提取:', title);
      } else {
        title = '';
      }
    }
  }
  
  // ===== 优先级3：从第一个内容区块提取 =====
  if (!title && blockDataMap.size > 0) {
    // 遍历区块找到第一个有效标题
    for (const [blockId, markdown] of blockDataMap) {
      const lines = markdown.split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        // 提取第一个非空行
        let firstLine = lines[0]
          .replace(/^#+\s*/, '') // 移除 Markdown 标题符号
          .replace(/[#*`~\[\]!]/g, '') // 移除其他 Markdown 符号
          .trim();
        
        // 跳过过短或像是列表/代码的内容
        if (firstLine.length >= 2 && !/^[-*+]\s/.test(firstLine) && !/^\d+\.\s/.test(firstLine)) {
          title = firstLine.substring(0, 50);
          console.log('[标题识别] 从内容区块提取:', title);
          break;
        }
      }
    }
  }
  
  // ===== 清理标题 =====
  if (title) {
    title = title
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // 替换非法字符（包括控制字符）
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // 移除零宽字符
      .replace(/\s+/g, '_') // 空格替换为下划线
      .replace(/_{2,}/g, '_') // 合并多个下划线
      .replace(/^_|_$/g, '') // 移除首尾下划线
      .substring(0, 100); // 限制长度
  }
  
  // ===== 返回结果 =====
  const finalTitle = title || ('飞书文档_' + formatDate(new Date()));
  console.log('[标题识别] 最终标题:', finalTitle);
  return finalTitle;
}

/**
 * 格式化日期
 * @param {Date} date - 日期对象
 * @returns {string} 格式化的日期字符串 (YYYYMMDD_HHMMSS)
 */
function formatDate(date) {
  const pad = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * 准备导出数据 - 合并区块内容并提取图片URL
 * @returns {{ fullContent: string, imageUrls: Set<string>, docTitle: string } | null}
 */
function prepareExportData() {
  if (blockDataMap.size === 0) {
    return null;
  }

  const docTitle = getDocumentTitle();
  console.log('文档标题:', docTitle);

  const rawContent = Array.from(blockDataMap.values()).join('\n\n');
  const fullContent = cleanupMarkdown(rawContent);

  const imgRegex = /!\[[^\]]*\]\((https?:\/\/[^\)]+)\)/g;
  let match;
  const imageUrls = new Set();
  while ((match = imgRegex.exec(fullContent)) !== null) {
    imageUrls.add(match[1]);
  }

  return { fullContent, imageUrls, docTitle };
}

/**
 * 清理 Markdown 格式 - 后处理
 * @param {string} content - 原始 Markdown 内容
 * @returns {string} 清理后的内容
 */
function cleanupMarkdown(content) {
  let result = content
    // 移除每行末尾空白，但保留 Markdown 软换行（恰好两个尾部空格）
    .replace(/[ \t]+$/gm, (match) => match === '  ' ? '  ' : '')
    // 合并 3 个及以上连续空行为 1 个空行
    .replace(/\n{3,}/g, '\n\n');

  // 反复合并连续的列表项之间的空行，直到稳定
  let prev;
  do {
    prev = result;
    result = result
      // 合并连续无序列表项
      .replace(/(^[-*+] .+$)\n\n(?=[-*+] )/gm, '$1\n')
      // 合并连续有序列表项
      .replace(/(^\d+\. .+$)\n\n(?=\d+\. )/gm, '$1\n')
      // 合并连续待办事项
      .replace(/(^- \[[ x]\] .+$)\n\n(?=- \[[ x]\] )/gm, '$1\n')
      // 合并连续引用行
      .replace(/(^> .+$)\n\n(?=> )/gm, '$1\n');
  } while (result !== prev);

  return result.trim() + '\n';
}

async function saveContent() {
  const data = prepareExportData();
  if (!data) {
    updateStatus('❌ 未抓取到内容');
    return;
  }

  updateStatus('正在处理...');
  updateProgress(100);

  const { fullContent, imageUrls, docTitle } = data;

  // 根据导出模式选择保存方式
  if (exportMode === 'folder') {
    await saveWithFolderPicker(fullContent, imageUrls, docTitle);
  } else {
    await fallbackDownload(fullContent, imageUrls, docTitle);
  }
}

/**
 * 选择文件夹保存模式
 */
async function saveWithFolderPicker(markdownContent, imageUrls, docTitle) {
  // 检查是否支持 File System Access API
  const hasFileSystemAccess = 'showDirectoryPicker' in window;
  
  if (!hasFileSystemAccess) {
    // 不支持，使用备用方式
    console.log('浏览器不支持 File System Access API，使用备用下载方式');
    await fallbackDownload(markdownContent, imageUrls, docTitle);
    return;
  }

  // 重置目录句柄
  directoryHandle = null;

  // 请求用户选择保存目录
  updateStatus('请选择保存文件夹...');
  
  try {
    directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (err) {
    if (err.name === 'AbortError') {
      updateStatus('❌ 未选择文件夹，已取消');
      isSaving = false;
      updateButtonState('done');
      return;
    }
    console.warn('目录选择失败:', err.name, err.message);
    // 选择失败，使用备用方式
    await fallbackDownload(markdownContent, imageUrls, docTitle);
    return;
  }

  try {
    await saveToFiles(markdownContent, imageUrls, docTitle);
  } catch (err) {
    console.error('保存失败:', err.name, err.message);
    directoryHandle = null;
    
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      updateStatus('⚠️ 文件夹权限不足');
    } else if (err.name === 'NotWritableError') {
      updateStatus('⚠️ 文件夹无法写入');
    } else {
      updateStatus('⚠️ 保存失败');
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    // 使用备用方式
    await fallbackDownload(markdownContent, imageUrls, docTitle);
  }
}

/**
 * 另存为 - 让用户选择保存位置
 */
async function saveAs() {
  const data = prepareExportData();
  if (!data) {
    updateStatus('❌ 没有可保存的内容');
    return;
  }

  updateStatus('正在处理...');

  const { fullContent, imageUrls, docTitle } = data;

  // 检查是否支持 File System Access API
  const hasFileSystemAccess = 'showDirectoryPicker' in window;
  
  if (!hasFileSystemAccess) {
    // 不支持，提示用户
    showNotification('当前浏览器不支持选择文件夹，请使用浏览器默认下载', 'warning');
    return;
  }

  // 重置目录句柄
  directoryHandle = null;

  // 请求用户选择保存目录
  updateStatus('请选择保存文件夹...');
  
  try {
    directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (err) {
    if (err.name === 'AbortError') {
      updateStatus('❌ 未选择文件夹，已取消');
      return;
    }
    console.warn('目录选择失败:', err.name, err.message);
    showNotification('文件夹选择失败，请重试', 'error');
    return;
  }

  try {
    await saveToFiles(fullContent, imageUrls, docTitle);
  } catch (err) {
    console.error('保存失败:', err.name, err.message);
    directoryHandle = null;
    
    if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
      updateStatus('❌ 文件夹权限不足');
    } else if (err.name === 'NotWritableError') {
      updateStatus('❌ 文件夹无法写入');
    } else {
      updateStatus('❌ 保存失败: ' + err.message);
    }
    updateButtonState('done'); // 恢复按钮状态
  }
}

/**
 * 备用下载方式 - 使用传统的 Blob 下载
 * 当 File System Access API 不可用时使用此方法
 * 文件将保存到浏览器默认下载目录
 * @param {string} markdownContent - Markdown 内容
 * @param {Set} imageUrls - 图片 URL 集合
 * @param {string} docTitle - 文档标题
 */
async function fallbackDownload(markdownContent, imageUrls, docTitle) {
  isSaving = true;
  updateButtonState('saving');
  updateStatus('正在准备下载...');

  // 存储图片 URL 到本地文件名的映射
  const imageMap = new Map();
  // 记录失败的图片
  const failedImages = [];

  // 文件夹名称（使用标题）
  const folderName = docTitle;

  try {
    // 第一步：下载所有图片并建立映射关系（并发下载，限制为3个同时进行）
    if (imageUrls.size > 0) {
      const imageArray = Array.from(imageUrls);
      const concurrency = 3;
      let completed = 0;
      updateStatus(`下载图片 (0/${imageArray.length})...`);

      // 并发下载函数
      async function downloadImage(imgUrl, index) {
        try {
          const response = await fetch(imgUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const blob = await response.blob();
          const mimeType = blob.type.split('/')[1] || 'png';
          const imgFilename = `${folderName}/assets/images/image_${String(index + 1).padStart(3, '0')}.${mimeType}`;

          imageMap.set(imgUrl, `assets/images/image_${String(index + 1).padStart(3, '0')}.${mimeType}`);

          const imgUrlObj = URL.createObjectURL(blob);

          chrome.runtime.sendMessage({
            action: 'download_file',
            url: imgUrlObj,
            filename: imgFilename
          }, () => {
            // 延迟释放 Blob URL，确保 Chrome 完成读取
            setTimeout(() => URL.revokeObjectURL(imgUrlObj), 3000);
          });
        } catch (err) {
          console.error('图片下载失败:', imgUrl, err);
          failedImages.push(imgUrl);
        } finally {
          completed++;
          updateStatus(`下载图片 (${completed}/${imageArray.length})...`);
        }
      }

      // 使用并发池控制同时下载数
      for (let i = 0; i < imageArray.length; i += concurrency) {
        const batch = imageArray.slice(i, i + concurrency).map((url, j) => downloadImage(url, i + j));
        await Promise.all(batch);
      }
    }

    // 第二步：更新 Markdown 内容中的图片链接为本地路径
    updateStatus('正在处理文档...');
    let finalContent = markdownContent;
    
    // 替换所有图片链接为本地路径（全局替换，支持任意 alt 文本）
    for (const [originalUrl, localPath] of imageMap) {
      finalContent = finalContent.replace(
        new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(originalUrl)}\\)`, 'g'),
        `![image](${localPath})`
      );
    }

    // 第三步：下载 Markdown 文件
    updateStatus('正在保存文档...');
    const mdBlob = new Blob([finalContent], { type: 'text/markdown;charset=utf-8' });
    const mdUrl = URL.createObjectURL(mdBlob);
    // 统一命名格式：{标题}/{标题}.md
    const mdFilename = `${folderName}/${folderName}.md`;
    
    // 通过 background script 下载
    chrome.runtime.sendMessage({
      action: 'download_file',
      url: mdUrl,
      filename: mdFilename
    }, (response) => {
      // 清理 Blob URL
      setTimeout(() => URL.revokeObjectURL(mdUrl), 1000);
      
      if (chrome.runtime.lastError) {
        // 如果 Chrome API 失败，使用传统下载方式（单文件，无文件夹结构）
        const a = document.createElement('a');
        a.href = mdUrl;
        a.download = `${folderName}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // 显示保存位置提示（单文件模式）
        isSaving = false;
        updateStatus(`✅ 已保存到浏览器下载目录`);
        updateButtonState('done');
        addDownloadTip(imageMap.size, folderName, true);
        if (failedImages.length > 0) {
          showNotification(`${failedImages.length} 张图片下载失败`, 'warning');
        }
        return;
      }

      // 显示保存位置提示（文件夹模式）
      isSaving = false;
      updateStatus(`✅ 已保存到浏览器下载目录`);
      updateButtonState('done');
      addDownloadTip(imageMap.size, folderName, false);
      if (failedImages.length > 0) {
        showNotification(`${failedImages.length} 张图片下载失败`, 'warning');
      }
    });

  } catch (error) {
    console.error('备用下载失败:', error);
    isSaving = false;
    updateButtonState('error');
    updateStatus('❌ 下载失败: ' + error.message);
  }
}

/**
 * 转义正则表达式特殊字符
 * @param {string} string - 要转义的字符串
 * @returns {string} 转义后的字符串
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 转义 HTML 特殊字符，防止 XSS 注入
 * @param {string} str - 需要转义的字符串
 * @returns {string} 转义后的安全字符串
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 添加下载提示
 * @param {number} imageCount - 下载的图片数量
 * @param {string} folderName - 文件夹名称
 * @param {boolean} isSingleFile - 是否为单文件模式（无文件夹结构）
 */
function addDownloadTip(imageCount = 0, folderName = '飞书文档', isSingleFile = false) {
  if (document.getElementById('backup-download-tip')) return;

  const statsEl = document.getElementById('backup-stats');
  if (statsEl) {
    const tip = document.createElement('div');
    tip.id = 'backup-download-tip';
    tip.style.cssText = `
      margin-top: 16px;
      padding: 14px;
      background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%);
      border-radius: 12px;
      font-size: 12px;
      color: #FDFDFB;
      text-align: left;
      border: 1px solid #3A3A3A;
    `;
    
    if (isSingleFile) {
      // 单文件模式提示
      tip.innerHTML = `
        <div style="font-weight: 500; margin-bottom: 6px;">📁 保存位置</div>
        <div style="font-size: 11px; color: #B0B0B0; line-height: 1.6;">
          浏览器默认下载目录<br>
          <span style="color: #FDFDFB;">${escapeHtml(folderName)}.md</span>
        </div>
      `;
    } else {
      // 文件夹模式提示
      const safeName = escapeHtml(folderName);
      const imageInfo = imageCount > 0 ? `<br><span style="color: #B0B0B0;">├─ assets/</span><br><span style="color: #B0B0B0;">│  └─ images/ (${imageCount} 张图片)</span>` : '';
      tip.innerHTML = `
        <div style="font-weight: 500; margin-bottom: 6px;">📁 保存位置</div>
        <div style="font-size: 11px; color: #B0B0B0; line-height: 1.6;">
          浏览器默认下载目录<br>
          <span style="color: #FDFDFB;">${safeName}/</span>
          <br><span style="color: #FDFDFB;">├─ ${safeName}.md</span>${imageInfo}
        </div>
      `;
    }
    
    statsEl.parentNode.insertBefore(tip, statsEl.nextSibling);
    
    // 添加打开下载目录按钮
    addOpenDownloadsButton();
  }
}

/**
 * 添加打开浏览器下载页面的按钮
 */
function addOpenDownloadsButton() {
  if (document.getElementById('backup-open-folder-btn')) return;

  const tipEl = document.getElementById('backup-download-tip');
  if (!tipEl) return;

  const openBtn = document.createElement('button');
  openBtn.id = 'backup-open-folder-btn';
  openBtn.innerHTML = `📂 打开下载目录`;
  openBtn.style.cssText = `
    width: 100%;
    margin-top: 12px;
    padding: 12px;
    background: #FDFDFB;
    color: #1A1A1A;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  `;

  openBtn.onmouseenter = () => {
    openBtn.style.transform = 'translateY(-1px)';
    openBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  };
  
  openBtn.onmouseleave = () => {
    openBtn.style.transform = 'translateY(0)';
    openBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
  };

  openBtn.onclick = () => {
    // 打开 Chrome 下载页面
    chrome.runtime.sendMessage({ action: 'open_downloads' });
  };

  tipEl.appendChild(openBtn);
}

/**
 * 保存文件到选择的目录（使用 File System Access API）
 * @param {string} markdownContent - Markdown 内容
 * @param {Set} imageUrls - 图片 URL 集合
 * @param {string} docTitle - 文档标题
 */
async function saveToFiles(markdownContent, imageUrls, docTitle) {
  isSaving = true;
  updateButtonState('saving');

  // 记录失败的图片
  const failedImages = [];

  try {
    // 创建以标题命名的文件夹
    const docFolder = await directoryHandle.getDirectoryHandle(docTitle, { create: true });
    // 创建 assets/images 子文件夹
    const assetsDir = await docFolder.getDirectoryHandle('assets', { create: true });
    const imagesDir = await assetsDir.getDirectoryHandle('images', { create: true });

    let finalContent = markdownContent;
    const imageArray = Array.from(imageUrls);

    // 存储图片 URL 到本地路径的映射
    const imageMap = new Map();

    // 并发下载图片（限制为3个同时进行）
    const concurrency = 3;
    let completed = 0;

    async function downloadImage(imgUrl, index) {
      try {
        const response = await fetch(imgUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const blob = await response.blob();
        const mimeType = blob.type.split('/')[1] || 'png';
        const filename = `image_${String(index + 1).padStart(3, '0')}.${mimeType}`;

        const fileHandle = await imagesDir.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        imageMap.set(imgUrl, 'assets/images/' + filename);
      } catch (err) {
        console.error('图片下载失败:', imgUrl, err);
        failedImages.push(imgUrl);
      } finally {
        completed++;
        updateStatus(`下载图片 ${completed}/${imageArray.length}...`);
      }
    }

    for (let i = 0; i < imageArray.length; i += concurrency) {
      const batch = imageArray.slice(i, i + concurrency).map((url, j) => downloadImage(url, i + j));
      await Promise.all(batch);
    }

    // 全局替换所有图片链接为本地路径
    for (const [imgUrl, localPath] of imageMap) {
      finalContent = finalContent.replace(
        new RegExp(escapeRegExp(imgUrl), 'g'),
        localPath
      );
    }

    // 保存 Markdown 文件
    updateStatus('保存文档...');
    const mdFilename = `${docTitle}.md`;
    const docHandle = await docFolder.getFileHandle(mdFilename, { create: true });
    const docWritable = await docHandle.createWritable();
    await docWritable.write(finalContent);
    await docWritable.close();

    updateStatus(`✅ 已保存到选定文件夹`);
    addSuccessTip(docTitle, imageArray.length, directoryHandle);
    isSaving = false;
    updateButtonState('done');
    if (failedImages.length > 0) {
      showNotification(`${failedImages.length} 张图片下载失败`, 'warning');
    }

  } catch (error) {
    console.error('保存失败:', error);
    isSaving = false;
    updateButtonState('error');
    throw error;
  }
}

/**
 * 添加保存成功提示（File System Access API 模式）
 * @param {string} folderName - 文件夹名称
 * @param {number} imageCount - 图片数量
 * @param {FileSystemDirectoryHandle} dirHandle - 目录句柄
 */
function addSuccessTip(folderName = '飞书文档', imageCount = 0, dirHandle = null) {
  if (document.getElementById('backup-download-tip')) return;

  const statsEl = document.getElementById('backup-stats');
  if (statsEl) {
    const tip = document.createElement('div');
    tip.id = 'backup-download-tip';
    tip.style.cssText = `
      margin-top: 16px;
      padding: 14px;
      background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%);
      border-radius: 12px;
      font-size: 12px;
      color: #FDFDFB;
      text-align: left;
      border: 1px solid #3A3A3A;
    `;
    
    const safeName = escapeHtml(folderName);
    const imageInfo = imageCount > 0 ? `<br><span style="color: #B0B0B0;">├─ assets/</span><br><span style="color: #B0B0B0;">│  └─ images/ (${imageCount} 张图片)</span>` : '';
    tip.innerHTML = `
      <div style="font-weight: 500; margin-bottom: 6px;">📁 保存位置</div>
      <div style="font-size: 11px; color: #B0B0B0; line-height: 1.6;">
        您选择的文件夹<br>
        <span style="color: #FDFDFB;">${safeName}/</span>
        <br><span style="color: #FDFDFB;">├─ ${safeName}.md</span>${imageInfo}
      </div>
    `;
    
    statsEl.parentNode.insertBefore(tip, statsEl.nextSibling);
    
    // 添加打开文件夹按钮
    addOpenFolderButton(dirHandle);
  }
}

/**
 * 添加打开文件夹按钮
 * @param {FileSystemDirectoryHandle} dirHandle - 目录句柄
 */
function addOpenFolderButton(dirHandle) {
  if (document.getElementById('backup-open-folder-btn')) return;

  const tipEl = document.getElementById('backup-download-tip');
  if (!tipEl) return;

  const openBtn = document.createElement('button');
  openBtn.id = 'backup-open-folder-btn';
  openBtn.innerHTML = `📂 打开文件夹`;
  openBtn.style.cssText = `
    width: 100%;
    margin-top: 12px;
    padding: 12px;
    background: #FDFDFB;
    color: #1A1A1A;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.02em;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  `;

  openBtn.onmouseenter = () => {
    openBtn.style.transform = 'translateY(-1px)';
    openBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  };
  
  openBtn.onmouseleave = () => {
    openBtn.style.transform = 'translateY(0)';
    openBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
  };

  openBtn.onclick = async () => {
    if (dirHandle && typeof dirHandle.requestPermission === 'function') {
      try {
        // 请求读取权限
        const permission = await dirHandle.requestPermission({ mode: 'read' });
        if (permission === 'granted') {
          // 尝试获取文件并打开（某些浏览器支持）
          showNotification('请在文件管理器中查看文件夹', 'success');
        }
      } catch (err) {
        console.log('打开文件夹失败:', err);
        showNotification('请手动打开下载目录查看文件', 'info');
      }
    } else {
      showNotification('请手动打开下载目录查看文件', 'info');
    }
  };

  tipEl.appendChild(openBtn);
}

// ==================== 自动滚动抓取 ====================

function startScraping() {
  if (isScraping) return;

  // 重置状态
  blockDataMap.clear();
  imageUrlSet.clear();
  isScraping = true;
  shouldStop = false;
  isSaving = false;

  showControlPanel();
  updateStatus('正在滚动抓取...');
  updateProgress(0);
  updateButtonState('scraping');

  const container = document.querySelector('.bear-render-container') || 
                    document.querySelector('.docx-editor-container') || 
                    document.querySelector('#docx > div');

  if (!container) {
    updateStatus('❌ 找不到文档容器');
    isScraping = false;
    updateButtonState('error');
    return;
  }

  let noNewBlocksCount = 0; // 连续没有新区块的次数

  function scrollAndScrape() {
    if (shouldStop) {
      // 保存已在按钮点击事件中直接触发，这里只做清理
      isScraping = false;
      return;
    }

    const previousBlockCount = blockDataMap.size;
    
    let currentScroll = container.scrollTop;
    let nextScroll = currentScroll + 300;

    container.scrollTo({ top: nextScroll, behavior: 'smooth' });
    scrapeBlocks();

    const progress = Math.min(100, Math.round((currentScroll + container.clientHeight) / container.scrollHeight * 100));
    updateProgress(progress);
    updateStatus(`正在抓取... ${progress}% (已获取 ${blockDataMap.size} 个区块)`);

    // 检查是否有新内容
    if (blockDataMap.size === previousBlockCount) {
      noNewBlocksCount++;
    } else {
      noNewBlocksCount = 0;
    }

    // 判断是否到达底部：滚动位置接近底部，或连续多次没有新内容
    const reachedBottom = currentScroll + container.clientHeight >= container.scrollHeight - 50;
    const noMoreContent = noNewBlocksCount >= 5;
    
    if (reachedBottom || noMoreContent) {
      isScraping = false;
      updateStatus(`✅ 抓取完成，共 ${blockDataMap.size} 个区块`);

      if (exportMode === 'folder') {
        // 文件夹模式：需要用户点击触发 showDirectoryPicker（浏览器安全限制）
        updateButtonState('selectFolder');
        const subtitleEl = document.getElementById('backup-subtitle');
        if (subtitleEl) subtitleEl.textContent = '请点击下方按钮保存';
      } else {
        // 浏览器默认下载模式：自动保存
        updateButtonState('scraped');
        setTimeout(() => {
          saveContent();
        }, 500);
      }
    } else {
      setTimeout(scrollAndScrape, 600);
    }
  }

  scrollAndScrape();
}

// ==================== 页面加载检测 ====================

/**
 * 检测页面是否完全加载
 * @returns {Object} 包含加载状态和提示信息
 */
function checkPageReady() {
  // 检查文档容器是否存在（多种可能的选择器）
  const container = document.querySelector('.bear-render-container') || 
                    document.querySelector('.docx-editor-container') || 
                    document.querySelector('#docx > div') ||
                    document.querySelector('[class*="editor"]') ||
                    document.querySelector('[class*="render"]');
  
  // 容器不存在，页面未加载
  if (!container) {
    return {
      ready: false,
      reason: '文档容器未找到',
      blockCount: 0
    };
  }

  // 检查是否有内容区块
  const blocks = document.querySelectorAll('div[data-block-id]');
  
  // 如果没有区块，检查是否有其他内容
  const hasOtherContent = container.textContent.trim().length > 50;
  
  if (blocks.length === 0 && !hasOtherContent) {
    return {
      ready: false,
      reason: '文档内容为空或正在加载中',
      blockCount: 0
    };
  }

  // 页面已准备就绪
  return {
    ready: true,
    blockCount: blocks.length,
    contentHeight: container.scrollHeight
  };
}

// ==================== 消息监听 ====================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 检查页面加载状态
  if (message.action === 'check_ready') {
    const status = checkPageReady();
    sendResponse(status);
    return true;
  }
  
  // 开始抓取
  if (message.action === 'start_scrape') {
    // 优先使用消息传递的模式，否则从存储加载
    if (message.exportMode) {
      exportMode = message.exportMode;
      console.log('[导出模式] 从消息获取:', exportMode);
      startScraping();
    } else {
      chrome.storage.local.get(['exportMode'], (result) => {
        if (result.exportMode) {
          exportMode = result.exportMode;
        }
        console.log('[导出模式] 从存储获取:', exportMode);
        startScraping();
      });
    }
    sendResponse({ success: true });
    return true;
  }
  
  return false;
});

/**
 * 显示页面通知
 * @param {string} message - 通知消息
 * @param {string} type - 通知类型 (info, warning, error, success)
 */
function showNotification(message, type = 'info') {
  // 移除已有通知
  const existing = document.getElementById('feishu-backup-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'feishu-backup-notification';
  
  // 黑白玉石风格配色
  const styles = {
    info: { 
      bg: 'linear-gradient(135deg, #FDFDFB 0%, #F5F5F3 100%)', 
      border: '#EAEAE8', 
      color: '#1A1A1A' 
    },
    warning: { 
      bg: 'linear-gradient(135deg, #FAFAF8 0%, #F0F0EE 100%)', 
      border: '#D5D5D3', 
      color: '#1A1A1A' 
    },
    error: { 
      bg: 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)', 
      border: '#3A3A3A', 
      color: '#FDFDFB' 
    },
    success: { 
      bg: 'linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%)', 
      border: '#3A3A3A', 
      color: '#FDFDFB' 
    }
  };
  
  const style = styles[type] || styles.info;
  
  notification.style.cssText = `
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    padding: 14px 28px;
    background: ${style.bg};
    border: 1px solid ${style.border};
    border-radius: 16px;
    color: ${style.color};
    font-size: 14px;
    font-weight: 500;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
    z-index: 9999999;
    box-shadow: 
      0 2px 8px rgba(0, 0, 0, 0.04),
      0 8px 24px rgba(0, 0, 0, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
    animation: jadeSlideDown 0.4s ease;
    letter-spacing: 0.02em;
  `;
  notification.textContent = message;
  
  // 添加动画样式
  if (!document.getElementById('feishu-backup-notification-style')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'feishu-backup-notification-style';
    styleEl.textContent = `
      @keyframes jadeSlideDown {
        from { 
          top: -20px; 
          opacity: 0; 
          transform: translateX(-50%) scale(0.95);
        }
        to { 
          top: 24px; 
          opacity: 1; 
          transform: translateX(-50%) scale(1);
        }
      }
    `;
    document.head.appendChild(styleEl);
  }
  
  document.body.appendChild(notification);
  
  // 3秒后自动消失
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
