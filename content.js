(function () {
  window.__floraAbort__?.();
  document.getElementById('of-smart-uploader')?.remove();

  const PANEL_ID = 'of-smart-uploader';
  const RETRY_ATTEMPTS = 10;
  const RETRY_DELAY_MS = 200;
  const SUCCESS_RESET_MS = 3000;

  const SITE = location.hostname.includes('fansly.com') ? {
    fileInput: 'app-post-creation input[type="file"]',
    attachBtn: 'app-post-creation .fa-image',
    uploadNewItem: 'app-post-creation .dropdown-item',
    canUpload: () => !!document.querySelector('app-post-creation'),
    notReadyMsg: 'Post creation form not found.',
  } : {
    fileInput: 'input[type="file"]',
    attachBtn: '#attach_file_photo, .attach_file',
    uploadNewItem: null,
    canUpload: () => location.href.includes('/posts/create'),
    notReadyMsg: 'Open "New Post" on OnlyFans first.',
  };

  let panel = null;
  let filesQueue = [];
  let selectedItem = null;
  let eventsController = null;

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'toggle_uploader') togglePanel();
  });

  function togglePanel() {
    panel = document.getElementById(PANEL_ID);
    if (panel) {
      closePanel();
    } else {
      createPanel();
    }
  }

  function closePanel() {
    filesQueue.forEach(({ preview }) => { if (preview) URL.revokeObjectURL(preview); });
    filesQueue = [];
    selectedItem = null;
    eventsController.abort();
    eventsController = null;
    panel.remove();
    panel = null;
  }

  function createPanel() {
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="of-header">
        <span class="of-title">Flora Uploader</span>
        <span class="of-close-btn" id="of-close">✕</span>
      </div>
      <div class="of-drop-zone" id="of-drop-zone">Drop photos/videos here</div>
      <div id="of-file-list"></div>
      <div class="btn-group">
        <button class="action-btn reverse-btn" id="of-reverse">Reverse</button>
        <button class="action-btn clear-btn" id="of-clear">Clear</button>
      </div>
      <div class="btn-group">
        <button class="action-btn upload-btn" id="of-upload">Upload in Order</button>
      </div>
      <div id="of-status"></div>
      <div class="of-resize-handle"></div>
    `;
    document.body.appendChild(panel);
    eventsController = new AbortController();
    window.__floraAbort__ = () => eventsController.abort();
    bindEvents();

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!panel) return;
      const size = Math.round(Math.min(Math.max(entry.contentRect.width * 0.13, 50), 120));
      panel.style.setProperty('--preview-size', `${size}px`);
    });
    resizeObserver.observe(panel);
    eventsController.signal.addEventListener('abort', () => resizeObserver.disconnect());

    panel.querySelector('.of-resize-handle').addEventListener('mousedown', (e) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = panel.offsetHeight;
      const rightEdge = panel.getBoundingClientRect().right;

      function onMouseMove(e) {
        const newWidth = Math.min(Math.max(rightEdge - e.clientX, 280), window.innerWidth - 40);
        const newHeight = Math.min(Math.max(startHeight + (e.clientY - startY), 220), window.innerHeight - 40);
        panel.style.width = `${newWidth}px`;
        panel.style.height = `${newHeight}px`;
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  }

  function bindEvents() {
    document.getElementById('of-close').onclick = closePanel;
    document.getElementById('of-clear').onclick = clearQueue;
    document.getElementById('of-reverse').onclick = reverseOrder;
    document.getElementById('of-upload').onclick = handleUpload;

    const dropZone = document.getElementById('of-drop-zone');
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      addFiles(Array.from(e.dataTransfer.files));
    };

    const fileList = document.getElementById('of-file-list');

    fileList.onchange = (e) => {
      if (!e.target.classList.contains('order-input')) return;
      const idx = parseInt(e.target.dataset.id, 10);
      const value = parseInt(e.target.value, 10);
      if (isNaN(idx) || isNaN(value)) return;
      const item = filesQueue[idx];
      if (!item) return;
      const sorted = getSorted();
      const clamped = Math.min(Math.max(value, 1), filesQueue.length);
      sorted.splice(sorted.indexOf(item), 1);
      sorted.splice(clamped - 1, 0, item);
      sorted.forEach((f, i) => { f.order = i + 1; });
      renderFiles();
    };

    fileList.onclick = (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const i = parseInt(btn.dataset.sortedIdx, 10);
        if (btn.dataset.action === 'remove') { removeFile(i); return; }
        moveItem(i, btn.dataset.action === 'move-up' ? -1 : 1);
        return;
      }
      const info = e.target.closest('.file-info');
      if (info) {
        const idx = parseInt(info.closest('.file-item').dataset.sortedIdx, 10);
        const sorted = getSorted();
        selectedItem = selectedItem === sorted[idx] ? null : sorted[idx];
        renderFiles();
      }
    };

    document.addEventListener('keydown', (e) => {
      if (!selectedItem || !panel) return;
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const sorted = getSorted();
      const i = sorted.indexOf(selectedItem);
      if (i !== -1) moveItem(i, e.key === 'ArrowUp' ? -1 : 1);
    }, { signal: eventsController.signal });
  }

  function getSorted() {
    return filesQueue.slice().sort((a, b) => a.order - b.order);
  }

  function removeFile(sortedIdx) {
    const sorted = getSorted();
    const item = sorted[sortedIdx];
    if (!item) return;
    if (item.preview) URL.revokeObjectURL(item.preview);
    if (selectedItem === item) selectedItem = null;
    filesQueue.splice(filesQueue.indexOf(item), 1);
    filesQueue.sort((a, b) => a.order - b.order).forEach((f, i) => { f.order = i + 1; });
    renderFiles();
  }

  function moveItem(sortedIdx, direction) {
    const sorted = getSorted();
    const target = sortedIdx + direction;
    if (target < 0 || target >= sorted.length) return;
    [sorted[sortedIdx].order, sorted[target].order] = [sorted[target].order, sorted[sortedIdx].order];
    renderFiles();
  }

  function addFiles(files) {
    files.forEach((file) => {
      const isHeic = /\.(heic|heif)$/i.test(file.name);
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const preview = isImage && !isHeic ? URL.createObjectURL(file) : null;
      filesQueue.push({ file, order: filesQueue.length + 1, preview, isHeic, isVideo });
    });
    renderFiles();
  }

  function clearQueue() {
    filesQueue.forEach(({ preview }) => { if (preview) URL.revokeObjectURL(preview); });
    filesQueue = [];
    selectedItem = null;
    renderFiles();
  }

  function reverseOrder() {
    if (filesQueue.length < 2) return;
    filesQueue.sort((a, b) => a.order - b.order).reverse().forEach((item, i) => { item.order = i + 1; });
    renderFiles();
  }

  function renderFiles() {
    const list = document.getElementById('of-file-list');
    if (!list) return;
    list.innerHTML = '';

    const sorted = getSorted();
    sorted.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'file-item' + (item === selectedItem ? ' file-item--selected' : '');
      row.dataset.sortedIdx = index;

      const preview = document.createElement('div');
      preview.className = 'file-preview';
      if (item.preview) {
        const img = document.createElement('img');
        img.src = item.preview;
        img.alt = item.file.name;
        preview.appendChild(img);
      } else {
        preview.classList.add('file-preview--placeholder');
        preview.textContent = item.isHeic ? 'HEIC' : item.isVideo ? 'VIDEO' : 'FILE';
      }

      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '🗑';
      removeBtn.title = 'Remove from queue';
      removeBtn.dataset.action = 'remove';
      removeBtn.dataset.sortedIdx = index;

      const info = document.createElement('div');
      info.className = 'file-info';
      info.textContent = item.file.name;

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'order-input';
      input.value = item.order;
      input.min = 1;
      input.dataset.id = filesQueue.indexOf(item);

      const upBtn = document.createElement('button');
      upBtn.className = 'move-btn';
      upBtn.textContent = '↑';
      upBtn.dataset.action = 'move-up';
      upBtn.dataset.sortedIdx = index;
      upBtn.disabled = index === 0;

      const downBtn = document.createElement('button');
      downBtn.className = 'move-btn';
      downBtn.textContent = '↓';
      downBtn.dataset.action = 'move-down';
      downBtn.dataset.sortedIdx = index;
      downBtn.disabled = index === sorted.length - 1;

      const arrows = document.createElement('div');
      arrows.className = 'move-btns';
      arrows.append(upBtn, downBtn);

      row.append(preview, removeBtn, info, input, arrows);
      list.appendChild(row);
    });
  }

  async function handleUpload() {
    const btn = document.getElementById('of-upload');

    if (filesQueue.length === 0) { setStatus('Queue is empty.', 'error'); return; }
    if (!SITE.canUpload()) { setStatus(SITE.notReadyMsg, 'error'); return; }

    btn.disabled = true;
    setStatus('Looking for upload field…');

    let fileInput = document.querySelector(SITE.fileInput);

    if (!fileInput && SITE.attachBtn) {
      const attachBtn = document.querySelector(SITE.attachBtn);
      if (attachBtn) {
        attachBtn.click();
        for (let i = 0; i < RETRY_ATTEMPTS && !fileInput; i++) {
          await delay(RETRY_DELAY_MS);
          fileInput = document.querySelector(SITE.fileInput);
        }
      }
    }

    if (!fileInput && SITE.uploadNewItem) {
      for (const item of document.querySelectorAll(SITE.uploadNewItem)) {
        if (item.textContent.trim().toLowerCase().includes('upload')) { item.click(); break; }
      }
      for (let i = 0; i < RETRY_ATTEMPTS && !fileInput; i++) {
        await delay(RETRY_DELAY_MS);
        fileInput = document.querySelector(SITE.fileInput);
      }
    }

    if (!fileInput) {
      setStatus('Upload field not found. Click the camera icon first.', 'error');
      btn.disabled = false;
      return;
    }

    const dt = new DataTransfer();
    getSorted().forEach(({ file }) => dt.items.add(file));
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    setStatus('Done! ✅', 'success');
    setTimeout(() => { setStatus(''); btn.disabled = false; }, SUCCESS_RESET_MS);
  }

  function setStatus(text, type = '') {
    const el = document.getElementById('of-status');
    if (!el) return;
    el.textContent = text;
    el.className = type ? `status-${type}` : '';
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();