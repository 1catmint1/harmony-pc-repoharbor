// SVN Client - 渲染进程
const { ipcRenderer } = require('electron');
const path = require('path');
const {RequestSession}=require('./request-session.cjs');
const requests=new RequestSession();
let currentFile=null;

// 拦截 window.open 防止触发子窗口创建（鸿蒙适配层崩溃问题）
window.open = function() {
  console.log('[SVN] window.open blocked');
  return null;
};

// 拦截 target="_blank" 链接点击
document.addEventListener('click', (e) => {
  const anchor = e.target.closest ? e.target.closest('a') : null;
  if (anchor && anchor.target === '_blank') {
    e.preventDefault();
    console.log('[SVN] target=_blank link blocked:', anchor.href);
  }
}, true);

// ========== 状态 ==========
let connections = [];
let currentConn = null;
let currentPath = '/';
let pathHistory = ['/'];
let fileViewer = null;

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化工具栏
  initToolbar();
  // 初始化侧边栏拖动
  initSidebarResizer();
  // 初始化连接管理弹窗
  initConnModal();
  // 加载连接配置
  await loadConnections();
  // 初始化文件查看器
  initFileViewer();
  // 初始化日志条数下拉框
  initCustomDropdown('log-limit', null);
});

// 自定义下拉框初始化（替代原生 select，防止鸿蒙 SubWindow 崩溃）
function initCustomDropdown(id, onChange) {
  const dropdown = document.getElementById(id);
  if (!dropdown) return;
  const selected = dropdown.querySelector('.dropdown-selected');
  const options = dropdown.querySelector('.dropdown-options');

  // 点击显示/隐藏选项
  selected.addEventListener('click', (e) => {
    e.stopPropagation();
    // 关闭其他下拉框
    document.querySelectorAll('.custom-dropdown.open').forEach(d => {
      if (d !== dropdown) d.classList.remove('open');
    });
    dropdown.classList.toggle('open');
  });

  // 点击选项
  options.querySelectorAll('.dropdown-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      const value = opt.dataset.value;
      const text = opt.textContent;
      // 更新显示
      selected.textContent = text;
      selected.dataset.value = value;
      // 更新 active 状态
      options.querySelectorAll('.dropdown-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      // 关闭下拉框
      dropdown.classList.remove('open');
      // 触发回调
      if (onChange) onChange(value);
    });
  });

  // 监听动态更新选项
  dropdown.addEventListener('dropdown-change', (e) => {
    const value = e.detail.value;
    const opt = options.querySelector(`[data-value="${value}"]`);
    if (opt) {
      selected.textContent = opt.textContent;
      selected.dataset.value = value;
      options.querySelectorAll('.dropdown-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    }
    dropdown.classList.remove('open');
    if (onChange) onChange(value);
  });
}

// 点击其他区域关闭下拉框
document.addEventListener('click', () => {
  document.querySelectorAll('.custom-dropdown.open').forEach(d => d.classList.remove('open'));
});

// ========== 工具栏 ==========
function initToolbar() {
  document.getElementById('btn-manage-conn').addEventListener('click', () => {
    updateConnList();
    document.getElementById('conn-modal').style.display = 'flex';
  });

  document.getElementById('btn-add-conn').addEventListener('click', () => {
    updateConnList();
    document.getElementById('conn-modal').style.display = 'flex';
  });

  document.getElementById('btn-refresh').addEventListener('click', () => {
    if (currentConn) browseTo(currentPath);
  });

  document.getElementById('btn-back').addEventListener('click', () => {
    if (pathHistory.length > 1) {
      pathHistory.pop();
      const prevPath = pathHistory[pathHistory.length - 1];
      browseTo(prevPath, true);
    }
  });

  // 连接选择（自定义下拉框）
  initCustomDropdown('conn-select', async (value) => {
    if (value) {
      requests.reset();currentFile=null;pathHistory=['/'];
      currentConn = connections.find(c => c.id === value);
      if (currentConn) {
        document.getElementById('status-conn').textContent = currentConn.name;
        await browseTo('/');
      }
    } else {
      requests.reset();currentFile=null;
      currentConn = null;
      document.getElementById('status-conn').textContent = '未连接';
      document.getElementById('repo-tree').innerHTML = `
        <div class="sidebar-empty">
          <p>请先配置 SVN 连接</p>
          <button id="btn-add-conn">添加连接</button>
        </div>
      `;
    }
  });

  // 视图切换
  document.getElementById('btn-view-tree').addEventListener('click', () => switchView('tree'));
  document.getElementById('btn-view-log').addEventListener('click', () => switchView('log'));
  document.getElementById('btn-view-diff').addEventListener('click', () => switchView('diff'));

  // 日志加载
  document.getElementById('btn-load-log').addEventListener('click', loadLog);

  // Diff 对比
  document.getElementById('btn-compare').addEventListener('click', compareVersions);
}

function switchView(view) {
  // 更新按钮状态
  document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`btn-view-${view}`).classList.add('active');

  // 切换视图
  document.getElementById('view-file').style.display = view === 'tree' ? 'flex' : 'none';
  document.getElementById('view-log').style.display = view === 'log' ? 'flex' : 'none';
  document.getElementById('view-diff').style.display = view === 'diff' ? 'flex' : 'none';
}

// ========== 连接管理 ==========
async function loadConnections() {
  const result = await ipcRenderer.invoke('config:get-connections');
  if (result.success) {
    connections = result.connections;
    updateConnSelect();
  } else {document.getElementById('status-info').textContent=result.message||'读取连接失败';}
}

function updateConnSelect() {
  const dropdown = document.getElementById('conn-select');
  const options = dropdown.querySelector('.dropdown-options');
  const selected = dropdown.querySelector('.dropdown-selected');
  options.innerHTML = '<div class="dropdown-option" data-value="">-- 选择连接 --</div>';
  connections.forEach(conn => {
    const opt = document.createElement('div');
    opt.className = 'dropdown-option';
    opt.dataset.value = conn.id;
    opt.textContent = conn.name;
    options.appendChild(opt);
  });
  selected.textContent = '-- 选择连接 --';
  selected.dataset.value = '';
  // 重新绑定选项点击
  options.querySelectorAll('.dropdown-option').forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.dispatchEvent(new CustomEvent('dropdown-change', { detail: { value: opt.dataset.value } }));
    });
  });
}

function initConnModal() {
  const modal = document.getElementById('conn-modal');

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal.querySelector('.modal-backdrop').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // 测试连接
  document.getElementById('btn-test-conn').addEventListener('click', async () => {
    const conn = getFormConnection();
    if (!conn.serverUrl) {
      showTestResult(false, '请输入服务器地址');
      return;
    }
    const result = await ipcRenderer.invoke('svn:test-connection', conn);
    if (result.success) {
      showTestResult(true, result.message);
    } else {
      showTestResult(false, result.message);
    }
  });

  // 保存连接
  document.getElementById('btn-save-conn').addEventListener('click', async () => {
    const conn = getFormConnection();
    if (!conn.name || !conn.serverUrl) {
      alert('请填写连接名称和服务器地址');
      return;
    }
    const result = await ipcRenderer.invoke('config:save-connection', conn);
    if (result.success) {
      connections = result.connections;
      updateConnSelect();
      updateConnList();
      clearForm();
    }
  });
}

function getFormConnection() {
  return {
    id: document.getElementById('conn-name').dataset.editId || null,
    name: document.getElementById('conn-name').value.trim(),
    serverUrl: document.getElementById('conn-url').value.trim(),
    username: document.getElementById('conn-user').value.trim(),
    password: document.getElementById('conn-pass').value
  };
}

function clearForm() {
  document.getElementById('conn-name').value = '';
  document.getElementById('conn-url').value = '';
  document.getElementById('conn-user').value = '';
  document.getElementById('conn-pass').value = '';
  delete document.getElementById('conn-name').dataset.editId;
  document.getElementById('conn-form-title').textContent = '添加新连接';
}

function showTestResult(success, message) {
  const el = document.getElementById('conn-test-result');
  el.className = 'test-result ' + (success ? 'success' : 'error');
  el.textContent = message;
}

function updateConnList() {
  const list = document.getElementById('conn-list');
  if (connections.length === 0) {
    list.innerHTML = '<p style="color:#888;font-size:12px;">暂无连接</p>';
    return;
  }
  list.innerHTML = connections.map(conn => `
    <div class="conn-item" data-id="${escapeHtml(conn.id)}">
      <div class="conn-item-info">
        <span class="conn-item-name">${escapeHtml(conn.name)}</span>
        <span class="conn-item-url">${escapeHtml(conn.serverUrl)}</span>
      </div>
      <div class="conn-item-actions">
        <button data-edit-id="${conn.id}">编辑</button>
        <button class="delete" data-delete-id="${conn.id}">删除</button>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('[data-edit-id]').forEach(el=>el.addEventListener('click',()=>window.editConnection(el.dataset.editId)));
  list.querySelectorAll('[data-delete-id]').forEach(el=>el.addEventListener('click',()=>window.deleteConnection(el.dataset.deleteId)));
}

window.editConnection = function(id) {
  const conn = connections.find(c => c.id === id);
  if (!conn) return;
  document.getElementById('conn-name').value = conn.name;
  document.getElementById('conn-url').value = conn.serverUrl;
  document.getElementById('conn-user').value = conn.username || '';
  document.getElementById('conn-pass').value = conn.password || '';
  document.getElementById('conn-name').dataset.editId = id;
  document.getElementById('conn-form-title').textContent = '编辑连接';
};

window.deleteConnection = async function(id) {
  // 使用自定义确认对话框（避免原生 confirm 触发 SubWindow 崩溃）
  if (!await showConfirm('确定删除此连接？')) return;
  const result = await ipcRenderer.invoke('config:delete-connection', id);
  if (result.success) {
    connections = result.connections;
    updateConnSelect();
    updateConnList();
    if (currentConn && currentConn.id === id) {
      requests.reset();currentFile=null;
      currentConn = null;
      // 更新自定义下拉框显示
      const dropdown = document.getElementById('conn-select');
      dropdown.querySelector('.dropdown-selected').textContent = '-- 选择连接 --';
      dropdown.querySelector('.dropdown-selected').dataset.value = '';
      document.getElementById('status-conn').textContent = '未连接';
    }
  }
};

// 自定义确认对话框（替代原生 confirm）
function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <p class="confirm-message">${message}</p>
        <div class="confirm-actions">
          <button class="confirm-cancel">取消</button>
          <button class="confirm-ok">确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('.confirm-ok').addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(true);
    });
    overlay.querySelector('.confirm-cancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(false);
    });
  });
}

// ========== 仓库浏览 ==========
async function browseTo(repoPath, skipHistory) {
  if (!currentConn) return;

  currentFile=null;requests.capture('file',null,'');requests.capture('diff',null,'');
  fileViewer?.setValue('');document.getElementById('file-title').textContent='未选择文件';document.getElementById('log-list').textContent='尚未加载当前路径日志';document.getElementById('diff-container').textContent='请先选择文件';
  currentPath = repoPath;
  if (!skipHistory && pathHistory[pathHistory.length - 1] !== repoPath) {
    pathHistory.push(repoPath);
  }

  // 更新 UI
  document.getElementById('current-path').textContent = repoPath;
  document.getElementById('status-path').textContent = repoPath;
  document.getElementById('btn-back').disabled = pathHistory.length <= 1;

  const tree = document.getElementById('repo-tree');
  tree.innerHTML = '<div class="sidebar-empty"><p>加载中...</p></div>';

  const owner=currentConn,ticket=requests.capture('directory',owner,repoPath);
  const result = await ipcRenderer.invoke('svn:list-dir', owner, repoPath);
  if(!requests.valid('directory',ticket,currentConn,currentPath))return;
  if (!result.success) {
    tree.innerHTML = `<div class="sidebar-empty"><p>加载失败: ${escapeHtml(result.message||'未知错误')}</p></div>`;
    return;
  }

  tree.innerHTML = '';
  if (result.items.length === 0) {
    tree.innerHTML = '<div class="sidebar-empty"><p>空目录</p></div>';
    return;
  }

  result.items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'tree-item';
    el.innerHTML = `
      <span class="arrow" style="visibility:${item.isDirectory ? 'visible' : 'hidden'}">▶</span>
      <span class="icon">${item.isDirectory ? '📁' : getFileIcon(item.name)}</span>
      <span class="name">${escapeHtml(item.name)}</span>
    `;
    el.addEventListener('click', () => {
      // 取消之前的选中
      tree.querySelectorAll('.tree-item.selected').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');

      // 构建完整路径（currentPath 是仓库根目录起的完整路径）
      const basePath = currentPath.endsWith('/') ? currentPath : currentPath + '/';
      const fullPath = basePath + item.href;

      if (item.isDirectory) {
        // 导航到子目录（传入完整路径）
        browseTo(fullPath);
      } else {
        // 查看文件（传入完整路径）
        viewFile(fullPath, item.name);
      }
    });
    tree.appendChild(el);
  });

  document.getElementById('status-info').textContent = `${result.items.length} 项`;
}

function getFileIcon(name) {
  const ext = path.extname(name).toLowerCase();
  const iconMap = {
    '.html': '🌐', '.htm': '🌐',
    '.js': '📜', '.jsx': '📜',
    '.ts': '🔷', '.tsx': '🔷',
    '.css': '🎨', '.scss': '🎨',
    '.json': '📋', '.xml': '📋',
    '.py': '🐍',
    '.md': '📝',
    '.java': '☕',
    '.c': '⚙️', '.cpp': '⚙️', '.h': '⚙️',
    '.png': '🖼️', '.jpg': '🖼️', '.gif': '🖼️', '.svg': '🖼️',
    '.txt': '📄', '.log': '📄',
  };
  return iconMap[ext] || '📄';
}

// ========== 文件查看 ==========
function initFileViewer() {
  fileViewer = CodeMirror.fromTextArea(document.getElementById('file-viewer'), {
    mode: 'text/plain',
    theme: 'material-darker',
    lineNumbers: true,
    readOnly: true,
    styleActiveLine: true,
    foldGutter: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    indentUnit: 2,
    tabSize: 2
  });
}

async function viewFile(filePath, fileName) {
  if (!currentConn) return;

  currentFile={path:filePath,name:fileName};
  const owner=currentConn,ticket=requests.capture('file',owner,filePath);
  // 自动切换到文件查看视图
  switchView('tree');

  document.getElementById('file-title').textContent = fileName;
  document.getElementById('file-empty').style.display = 'none';

  // CodeMirror 的 wrapper 是 textarea 的兄弟元素，需要确保它可见
  const cmWrapper = document.querySelector('.content-wrapper .CodeMirror');
  if (cmWrapper) {
    cmWrapper.style.display = '';
    cmWrapper.style.visibility = 'visible';
  }

  fileViewer.setValue('加载中...');
  const result = await ipcRenderer.invoke('svn:get-file', owner, filePath);
  if(!requests.valid('file',ticket,currentConn,currentFile?.path))return;
  if (result.success) {
    fileViewer.setValue(result.content);
    // 根据扩展名设置语言模式
    const ext = path.extname(fileName).slice(1).toLowerCase();
    setLanguageMode(ext);
    document.getElementById('status-info').textContent = `${result.content.split('\n').length} 行`;
  } else {
    fileViewer.setValue(`// 加载失败: ${escapeHtml(result.message||'未知错误')}`);
  }

  // 多次延迟刷新确保 CodeMirror 正确计算尺寸和渲染
  setTimeout(() => {
    fileViewer.refresh();
    setTimeout(() => fileViewer.refresh(), 100);
  }, 50);
}

function setLanguageMode(ext) {
  const modeMap = {
    'html': 'htmlmixed', 'htm': 'htmlmixed',
    'js': 'javascript', 'jsx': 'javascript',
    'ts': 'text/typescript', 'tsx': 'text/typescript',
    'css': 'css', 'scss': 'text/x-scss',
    'json': 'application/json', 'xml': 'application/xml',
    'py': 'python', 'md': 'markdown',
    'c': 'text/x-csrc', 'cpp': 'text/x-c++src',
    'java': 'text/x-java'
  };
  fileViewer.setOption('mode', modeMap[ext] || 'text/plain');
}

// ========== 日志查看 ==========
async function loadLog() {
  if (!currentConn) return;

  const limit = document.querySelector('#log-limit .dropdown-selected').dataset.value || '50';
  const logList = document.getElementById('log-list');
  logList.innerHTML = '<div class="sidebar-empty"><p>加载中...</p></div>';

  const owner=currentConn,ownerPath=currentPath,ticket=requests.capture('log',owner,ownerPath);
  const result = await ipcRenderer.invoke('svn:get-log', owner, ownerPath, limit);
  if(!requests.valid('log',ticket,currentConn,currentPath))return;
  if (!result.success) {
    logList.innerHTML = `<div class="sidebar-empty"><p>加载失败: ${escapeHtml(result.message||'未知错误')}</p></div>`;
    return;
  }

  if (result.logs.length === 0) {
    logList.innerHTML = '<div class="sidebar-empty"><p>暂无提交记录</p></div>';
    return;
  }

  logList.innerHTML = result.logs.map(log => `
    <div class="log-item" data-rev="${escapeHtml(log.revision)}">
      <span class="log-rev">r${escapeHtml(log.revision)}</span>
      <span class="log-author">${escapeHtml(log.author)}</span>
      <span class="log-date">${formatDate(log.date)}</span>
      <span class="log-message">${escapeHtml(log.message)}</span>
    </div>
  `).join('');

  // 点击日志项
  logList.querySelectorAll('.log-item').forEach(el => {
    el.addEventListener('click', () => {
      logList.querySelectorAll('.log-item.selected').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
    });
  });

  document.getElementById('status-info').textContent = `${result.logs.length} 条记录`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN');
  } catch {
    return dateStr;
  }
}

// ========== Diff 对比 ==========
async function compareVersions() {
  if (!currentConn) return;
  if(!currentFile){document.getElementById('diff-container').textContent='请先从目录选择一个文件';return;}
  const owner=currentConn,file=currentFile.path,ticket=requests.capture('diff',owner,file);

  const revA = document.getElementById('diff-rev-a').value.trim();
  const revB = document.getElementById('diff-rev-b').value.trim();

  if (!/^(0|[1-9]\d{0,14})$/.test(revA) || !/^(0|[1-9]\d{0,14})$/.test(revB)) {
    document.getElementById('diff-container').textContent='请输入两个非负整数版本号';
    return;
  }

  const container = document.getElementById('diff-container');
  container.innerHTML = '<div class="sidebar-empty"><p>对比中...</p></div>';

  // 获取两个版本的文件内容
  const [resultA, resultB] = await Promise.all([
    ipcRenderer.invoke('svn:get-file', owner, file, revA),
    ipcRenderer.invoke('svn:get-file', owner, file, revB)
  ]);

  if(!requests.valid('diff',ticket,currentConn,currentFile?.path))return;
  if (!resultA.success || !resultB.success) {
    container.innerHTML = `<div class="sidebar-empty"><p>获取文件内容失败</p></div>`;
    return;
  }

  const linesA = resultA.content.split('\n');
  const linesB = resultB.content.split('\n');

  // 简易 diff（逐行对比）
  if(linesA.length>10000||linesB.length>10000){container.textContent='逐行对照最多10000行，请缩小文件';return;}
  const diffHtml = simpleDiff(linesA, linesB, revA, revB);
  container.innerHTML = diffHtml;
}

function simpleDiff(linesA, linesB, revA, revB) {
  let html = `<div style="padding:8px;color:#888;font-size:12px;">逐行对照 ${escapeHtml(revA)} → ${escapeHtml(revB)}（非合并补丁）</div>`;

  const maxLen = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < maxLen; i++) {
    const lineA = linesA[i] || '';
    const lineB = linesB[i] || '';

    if (lineA === lineB) {
      html += `<div class="diff-line">
        <span class="line-num">${i + 1}</span>
        <span class="line-content">${escapeHtml(lineA)}</span>
      </div>`;
    } else {
      if (lineA) {
        html += `<div class="diff-line removed">
          <span class="line-num">${i + 1}</span>
          <span class="line-content">- ${escapeHtml(lineA)}</span>
        </div>`;
      }
      if (lineB) {
        html += `<div class="diff-line added">
          <span class="line-num">${i + 1}</span>
          <span class="line-content">+ ${escapeHtml(lineB)}</span>
        </div>`;
      }
    }
  }

  return html;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== 侧边栏拖动 ==========
function initSidebarResizer() {
  const resizer = document.getElementById('sidebarResizer');
  const sidebar = document.getElementById('sidebar');
  let isDragging = false;
  let startX = 0, startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startWidth = sidebar.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const newWidth = startWidth + dx;
    if (newWidth >= 180 && newWidth <= 500) {
      sidebar.style.width = newWidth + 'px';
      if (fileViewer) fileViewer.refresh();
    }
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (fileViewer) fileViewer.refresh();
    }
  });
}
