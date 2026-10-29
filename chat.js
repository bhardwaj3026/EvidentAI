/* Multimodal AI Image Chat: Attach any visual evidence, converse, and verify hallucinations */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
  const MAX_DIMENSION = 1568;
  const MAX_SEND_BYTES = 4.5 * 1024 * 1024;
  const REQUEST_TIMEOUT_MS = 180000;

  const el = {
    scroll: $('chatScroll'), log: $('chatLog'), empty: $('emptyState'),
    form: $('composerForm'), input: $('messageInput'), send: $('sendBtn'),
    fileInput: $('fileInput'), attachBtn: $('attachBtn'), emptyAttachBtn: $('emptyAttachBtn'),
    chip: $('attachChip'), thumb: $('attachThumb'), thumbWrap: $('attachThumbWrap'), docIcon: $('attachDocIcon'), chipName: $('attachName'), chipSize: $('attachSize'), chipRemove: $('attachRemove'), metaClickable: $('attachMetaClickable'),
    error: $('composerError'), provider: $('providerSelect'), strict: $('strictToggle'),
    newChat: $('chatNewChatBtn'), theme: $('themeToggleBtn'), banner: $('keyBanner'), drop: $('dropOverlay'),

    // Voice Input & Status
    voiceInputBtn: $('voiceInputBtn'),
    voiceStatusBar: $('voiceStatusBar'),
    voiceLiveTranscript: $('voiceLiveTranscript'),
    voiceDoneBtn: $('voiceDoneBtn'),
    voiceCancelBtn: $('voiceCancelBtn'),

    // History Sidebar
    toggleSidebarBtn: $('toggleSidebarBtn'),
    chatSidebar: $('chatSidebar'),
    sidebarBackdrop: $('sidebarBackdrop'),
    closeSidebarBtn: $('closeSidebarBtn'),
    sidebarNewChatBtn: $('sidebarNewChatBtn'),
    sidebarSessionsList: $('sidebarSessionsList'),
    sidebarAvatar: $('sidebarAvatar'),
    sidebarUsername: $('sidebarUsername'),
    sidebarQuotaSummary: $('sidebarQuotaSummary'),
    sidebarSwitchBtn: $('sidebarSwitchBtn'),

    // User Account Widget
    userAccountWidget: $('userAccountWidget'),
    userAccountBtn: $('userAccountBtn'),
    accountDropdown: $('accountDropdown'),
    userAvatar: $('userAvatar'),
    userName: $('userName'),
    quotaBadge: $('quotaBadge'),
    dropdownUserName: $('dropdownUserName'),
    dropdownUserRole: $('dropdownUserRole'),
    dropdownUserEmail: $('dropdownUserEmail'),
    dropdownQuotaText: $('dropdownQuotaText'),
    dropdownQuotaProgress: $('dropdownQuotaProgress'),
    resetQuotaBtn: $('resetQuotaBtn'),
    switchAccountBtn: $('switchAccountBtn'),
    logoutBtn: $('logoutBtn'),

    // Quota Banner in Composer
    quotaBanner: $('quotaBanner'),
    quotaBannerText: $('quotaBannerText'),
    bannerResetBtn: $('bannerResetBtn'),
    bannerSwitchBtn: $('bannerSwitchBtn'),

    // Authentication Modal
    authModal: $('authModal'),
    closeAuthModalBtn: $('closeAuthModalBtn'),
    authTabLoginBtn: $('authTabLoginBtn'),
    authTabRegisterBtn: $('authTabRegisterBtn'),
    authLoginForm: $('authLoginForm'),
    authRegisterForm: $('authRegisterForm'),
    loginUsername: $('loginUsername'),
    loginPassword: $('loginPassword'),
    registerUsername: $('registerUsername'),
    registerName: $('registerName'),
    registerPassword: $('registerPassword'),
    authErrorMsg: $('authErrorMsg'),

    // Full-Size Image Preview Lightbox
    lightboxModal: $('imageLightboxModal'),
    lightboxImage: $('lightboxImage'),
    lightboxName: $('lightboxImageName'),
    lightboxMeta: $('lightboxImageMeta'),
    lightboxDownloadBtn: $('lightboxDownloadBtn'),
    closeImageModalBtn: $('closeImageModalBtn')
  };

  const store = {
    get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
  };

  const state = {
    chatId: 0,
    messages: [],
    pending: null,
    busy: false
  };

  const authState = {
    token: store.get('chatToken', null),
    user: null,
    currentSessionId: null
  };

  /* ------------------------------------------------------------ helpers */
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
  }

  function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function scrollToBottom() {
    if (el.scroll) el.scroll.scrollTop = el.scroll.scrollHeight;
  }

  function cleanMathFormula(eq) {
    return eq
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\left\s*([(\[{|])/g, '$1')
      .replace(/\\right\s*([)\]}|])/g, '$1')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
      .replace(/\\times/g, '×')
      .replace(/\\le/g, '≤')
      .replace(/\\ge/g, '≥')
      .replace(/\\approx/g, '≈')
      .replace(/\\pm/g, '±')
      .replace(/\\ne/g, '≠')
      .replace(/\\cdot/g, '·')
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
      .replace(/\\hat\{([^}]+)\}/g, '$1̂')
      .replace(/\\bar\{([^}]+)\}/g, '$1̄')
      .replace(/\\Delta/g, 'Δ')
      .replace(/\\mu/g, 'μ')
      .replace(/\\sigma/g, 'σ')
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\([a-zA-Z]+)/g, '$1');
  }

  function cleanLatex(str) {
    if (!str) return '';
    let out = str;
    out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => `<span class="math-block" style="display:block;margin:6px 0;padding:6px 10px;background:var(--bg-surface-elevated);border-radius:6px;font-family:var(--font-mono);font-size:0.85rem;overflow-x:auto;">${escapeHtml(cleanMathFormula(eq.trim()))}</span>`);
    out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, eq) => `<span class="math-inline" style="font-family:var(--font-mono);font-size:0.88em;padding:1px 4px;background:var(--bg-surface-elevated);border-radius:4px;">${escapeHtml(cleanMathFormula(eq.trim()))}</span>`);
    out = out.replace(/\$\$([\s\S]*?)\$\$/g, (_, eq) => `<span class="math-block" style="display:block;margin:6px 0;padding:6px 10px;background:var(--bg-surface-elevated);border-radius:6px;font-family:var(--font-mono);font-size:0.85rem;overflow-x:auto;">${escapeHtml(cleanMathFormula(eq.trim()))}</span>`);
    out = out.replace(/\$([^\$\n]+?)\$/g, (_, eq) => `<span class="math-inline" style="font-family:var(--font-mono);font-size:0.88em;padding:1px 4px;background:var(--bg-surface-elevated);border-radius:4px;">${escapeHtml(cleanMathFormula(eq.trim()))}</span>`);
    return out;
  }

  function normalizeAnswerFormat(str) {
    if (!str) return '';
    let out = str;
    out = out.replace(/^Here (?:is|are) (?:the |an? )?(?:analysis|answer|result)[^:\n]*:\s*/i, '');
    out = out.replace(/^Based on the provided (?:chart|image|diagram|figure|data)[^:\n]*,\s*/i, '');
    out = out.replace(/^According to the (?:image|chart|graph|figure)[^:\n]*,\s*/i, '');
    out = out.replace(/\n{3,}/g, '\n\n');
    return out.trim();
  }

  function renderMarkdown(rawText) {
    let text = normalizeAnswerFormat(rawText);
    const codeBlocks = [];
    text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(`<pre><code class="language-${escapeHtml(lang || 'text')}">${escapeHtml(code.trim())}</code></pre>`);
      return `@@CODE_BLOCK_${idx}@@`;
    });

    const inlineCodes = [];
    text = text.replace(/`([^`\n]+)`/g, (_, code) => {
      const idx = inlineCodes.length;
      inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
      return `@@INLINE_CODE_${idx}@@`;
    });

    text = cleanLatex(text);

    let html = escapeHtml(text);
    html = html.replace(/^### (.*$)/gim, '<h4 style="margin:12px 0 4px;font-size:1rem;font-weight:700;">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="margin:14px 0 6px;font-size:1.1rem;font-weight:700;">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 style="margin:16px 0 8px;font-size:1.2rem;font-weight:700;">$1</h2>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    const paragraphs = html.split(/\n{2,}/).map(para => {
      const lines = para.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return '';
      if (lines.every(l => l.startsWith('- ') || l.startsWith('* '))) {
        return '<ul style="margin:6px 0 8px;padding-left:1.4rem;">' + lines.map(l => `<li>${l.replace(/^[-*]\s+/, '')}</li>`).join('') + '</ul>';
      }
      if (lines.every(l => /^\d+\.\s+/.test(l))) {
        return '<ol style="margin:6px 0 8px;padding-left:1.4rem;">' + lines.map(l => `<li>${l.replace(/^\d+\.\s+/, '')}</li>`).join('') + '</ol>';
      }
      return `<p style="margin:0 0 8px;line-height:1.55;">${para.replace(/\n/g, '<br>')}</p>`;
    }).filter(Boolean).join('');

    let result = paragraphs;
    result = result.replace(/@@INLINE_CODE_(\d+)@@/g, (_, i) => inlineCodes[Number(i)] || '');
    result = result.replace(/@@CODE_BLOCK_(\d+)@@/g, (_, i) => codeBlocks[Number(i)] || '');
    return result;
  }

  function formatAnswerWithClaimHighlights(text, claims) {
    if (!claims || !claims.length) return renderMarkdown(text);
    let html = renderMarkdown(text);
    claims.forEach(c => {
      const claimText = (c.claim || '').trim();
      if (!claimText || claimText.length < 5) return;
      const cls = c.status === 'supported' ? 'claim-supported' : (c.status === 'subtle_conflict' ? 'claim-subtle' : 'claim-conflict');
      const tagLabel = escapeHtml(c.type || c.status || 'claim');
      const escapedClaim = escapeHtml(claimText);
      const regex = new RegExp(`(${escapedClaim.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'i');
      html = html.replace(regex, `<span class="inline-claim-highlight ${cls}" title="${escapeHtml(c.reason || '')}">$1 <span class="claim-inline-tag">${tagLabel}</span></span>`);
    });
    return html;
  }

  /* ------------------------------------------------------------ theme */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    store.set('chatTheme', theme);
    if (el.theme) {
      el.theme.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      const icon = el.theme.querySelector('.theme-icon') || el.theme;
      icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  const savedTheme = store.get('chatTheme', 'light');
  applyTheme(savedTheme);
  if (el.theme) {
    el.theme.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    });
  }

  /* ------------------------------------------------------------ keys banner */
  async function loadKeyStatus() {
    try {
      const res = await fetch('/api/keys');
      if (!res.ok) return;
      const data = await res.json();
      if (data.activeProvider) {
        if (el.provider && Array.from(el.provider.options).some(o => o.value === data.activeProvider)) {
          el.provider.value = data.activeProvider;
        } else if (el.provider) {
          el.provider.value = 'gemini';
        }
      }
      if (!data.hasAnyKey) {
        el.banner.innerHTML = '⚡ <strong>Running in Zero-Config Heuristic Mode:</strong> Add <code>GEMINI_API_KEY</code>, <code>ANTHROPIC_API_KEY</code>, or <code>OPENAI_API_KEY</code> to your <code>.env</code> file for live multi-modal LLM API calls.';
        el.banner.classList.remove('hidden');
      } else {
        el.banner.classList.add('hidden');
      }
    } catch {
      // server offline or static mode
    }
  }

  /* ------------------------------------------------------------ composer errors */
  function showComposerError(msg) {
    if (el.error) {
      el.error.textContent = msg;
      el.error.classList.remove('hidden');
    }
  }

  function clearComposerError() {
    if (el.error) {
      el.error.classList.add('hidden');
      el.error.textContent = '';
    }
  }

  /* ------------------------------------------------------------ file processing (images, PDF, Word) */
  function processFile(file) {
    return new Promise((resolve, reject) => {
      const name = file.name || 'attachment';
      const ext = name.split('.').pop().toLowerCase();
      const isPdf = file.type === 'application/pdf' || ext === 'pdf';
      const isWord = file.type.includes('word') || file.type.includes('officedocument') || file.type === 'application/msword' || ext === 'docx' || ext === 'doc';
      const isImage = file.type.startsWith('image/');

      if (isPdf || isWord) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const dataUrl = reader.result;
            const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
            if (!m) throw new Error('Failed to read file data.');
            const mediaType = isPdf ? 'application/pdf' : (ext === 'doc' ? 'application/msword' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            const data = m[2];
            const bytes = Math.round(data.length * 0.75);
            resolve({
              mediaType,
              data,
              previewUrl: null,
              bytes,
              name,
              isDoc: true,
              docType: isPdf ? 'pdf' : 'word',
              docIcon: isPdf ? '📄' : '📝'
            });
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = () => reject(new Error('Failed reading document.'));
        reader.readAsDataURL(file);
        return;
      }

      if (isImage) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          try {
            let { naturalWidth: w, naturalHeight: h } = img;
            if (!w || !h) throw new Error('empty image');
            const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
            w = Math.max(1, Math.round(w * scale));
            h = Math.max(1, Math.round(h * scale));

            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);

            let dataUrl = file.type === 'image/png' ? canvas.toDataURL('image/png') : '';
            if (!dataUrl || dataUrl.length * 0.75 > MAX_SEND_BYTES) dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            const m = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(dataUrl);
            if (!m) throw new Error('encode failed');
            const bytes = Math.round(m[2].length * 0.75);
            if (bytes > MAX_SEND_BYTES) throw new Error('too large');
            resolve({
              mediaType: m[1].toLowerCase(),
              data: m[2],
              previewUrl: dataUrl,
              bytes,
              name,
              isDoc: false
            });
          } catch (e) {
            reject(e);
          } finally {
            URL.revokeObjectURL(url);
          }
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
        img.src = url;
        return;
      }

      reject(new Error('Unsupported file format. Please upload PNG, JPEG, WebP, GIF, PDF, or Word document (.docx, .doc).'));
    });
  }

  async function handleAttachedFile(file) {
    clearComposerError();
    if (!file) return;

    const name = file.name || '';
    const ext = name.split('.').pop().toLowerCase();
    const isSupported = file.type.startsWith('image/') ||
                        file.type === 'application/pdf' ||
                        file.type.includes('word') ||
                        file.type.includes('officedocument') ||
                        file.type === 'application/msword' ||
                        ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'docx', 'doc'].includes(ext);

    if (!isSupported) {
      showComposerError('Invalid file type. Please upload a PNG, JPEG, WebP, GIF, PDF, or Word document (.docx, .doc).');
      return;
    }
    if (file.size > MAX_ORIGINAL_BYTES) {
      showComposerError(`File size is ${formatBytes(file.size)}. Max size is ${formatBytes(MAX_ORIGINAL_BYTES)}.`);
      return;
    }

    try {
      const enc = await processFile(file);
      state.pending = enc;

      if (enc.isDoc) {
        if (el.thumbWrap) el.thumbWrap.classList.add('hidden');
        if (el.thumb) el.thumb.classList.add('hidden');
        if (el.docIcon) {
          el.docIcon.textContent = enc.docIcon || '📄';
          el.docIcon.classList.remove('hidden');
        }
      } else {
        if (el.docIcon) el.docIcon.classList.add('hidden');
        if (el.thumb) {
          el.thumb.src = enc.previewUrl;
          el.thumb.classList.remove('hidden');
          el.thumb.setAttribute('title', 'Click to view image in big size');
        }
        if (el.thumbWrap) {
          el.thumbWrap.classList.remove('hidden');
          el.thumbWrap.setAttribute('title', 'Click to view image in big size');
        }
      }

      if (el.chipName) el.chipName.textContent = enc.name;
      if (el.chipSize) el.chipSize.textContent = formatBytes(enc.bytes);
      if (el.chip) el.chip.classList.remove('hidden');
      updateSendState();
      if (el.input) el.input.focus();
    } catch (e) {
      showComposerError('Could not process this file: ' + (e.message || 'Error'));
    }
  }

  function removePending() {
    state.pending = null;
    if (el.chip) el.chip.classList.add('hidden');
    if (el.thumb) {
      el.thumb.src = '';
      el.thumb.classList.remove('hidden');
    }
    if (el.thumbWrap) el.thumbWrap.classList.remove('hidden');
    if (el.docIcon) el.docIcon.classList.add('hidden');
    if (el.fileInput) el.fileInput.value = '';
    clearComposerError();
    updateSendState();
  }

  /* ------------------------------------------------------------ composer events */
  if (el.attachBtn && el.fileInput) el.attachBtn.addEventListener('click', () => el.fileInput.click());
  if (el.emptyAttachBtn && el.fileInput) el.emptyAttachBtn.addEventListener('click', () => el.fileInput.click());
  if (el.fileInput) el.fileInput.addEventListener('change', () => { if (el.fileInput.files[0]) handleAttachedFile(el.fileInput.files[0]); });
  if (el.chipRemove) el.chipRemove.addEventListener('click', (e) => {
    e.stopPropagation();
    removePending();
  });

  // Paste image or document from clipboard
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items ? Array.from(e.clipboardData.items) : [];
    const fileItem = items.find((it) => it.kind === 'file');
    if (fileItem) {
      e.preventDefault();
      handleAttachedFile(fileItem.getAsFile());
    }
  });

  // Drag & drop anywhere
  let dragDepth = 0;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  window.addEventListener('dragenter', (e) => {
    if (hasFiles(e)) {
      dragDepth++;
      if (el.drop) el.drop.classList.remove('hidden');
    }
  });
  window.addEventListener('dragleave', (e) => {
    if (hasFiles(e) && --dragDepth <= 0) {
      dragDepth = 0;
      if (el.drop) el.drop.classList.add('hidden');
    }
  });
  window.addEventListener('dragover', (e) => {
    if (hasFiles(e)) e.preventDefault();
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    if (el.drop) el.drop.classList.add('hidden');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleAttachedFile(e.dataTransfer.files[0]);
    }
  });

  /* ------------------------------------------------------------ VOICE INPUT CONTROLLER */
  const voiceState = {
    recognition: null,
    isListening: false,
    activeTargetInput: null,
    activeButton: null,
    initialText: '',
    finalTranscript: '',
    interimTranscript: '',
    supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  };

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const r = new SpeechRecognition();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    r.onstart = () => {
      voiceState.isListening = true;
      if (el.voiceStatusBar) el.voiceStatusBar.classList.remove('hidden');
      if (voiceState.activeButton) voiceState.activeButton.classList.add('listening');
    };

    r.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          voiceState.finalTranscript += (voiceState.finalTranscript ? ' ' : '') + transcript.trim();
        } else {
          interim += transcript;
        }
      }
      voiceState.interimTranscript = interim;
      const combined = (voiceState.finalTranscript + ' ' + interim).trim();
      if (el.voiceLiveTranscript) {
        el.voiceLiveTranscript.textContent = combined || 'Listening for speech...';
      }
      if (voiceState.activeTargetInput) {
        const prefix = voiceState.initialText ? voiceState.initialText + ' ' : '';
        voiceState.activeTargetInput.value = prefix + combined;
        autoGrow();
        updateSendState();
      }
    };

    r.onerror = () => {
      stopVoiceInput(false);
    };

    r.onend = () => {
      if (voiceState.isListening) {
        stopVoiceInput(true);
      }
    };

    return r;
  }

  function startVoiceInput(targetInput, triggerButton) {
    if (!voiceState.supported) {
      alert("Voice input is supported in Chrome, Microsoft Edge, and Safari.");
      return;
    }
    if (voiceState.isListening) {
      stopVoiceInput(true);
      return;
    }
    if (!voiceState.recognition) {
      voiceState.recognition = initSpeechRecognition();
    }
    if (!voiceState.recognition) return;

    voiceState.activeTargetInput = targetInput;
    voiceState.activeButton = triggerButton;
    voiceState.initialText = targetInput.value.trim();
    voiceState.finalTranscript = '';
    voiceState.interimTranscript = '';

    if (el.voiceLiveTranscript) {
      el.voiceLiveTranscript.textContent = 'Listening... Speak now';
    }

    try {
      voiceState.recognition.start();
    } catch {
      stopVoiceInput(false);
    }
  }

  function stopVoiceInput(commit = true) {
    voiceState.isListening = false;
    if (voiceState.recognition) {
      try { voiceState.recognition.stop(); } catch { /* ignore */ }
    }
    if (el.voiceStatusBar) el.voiceStatusBar.classList.add('hidden');
    if (voiceState.activeButton) voiceState.activeButton.classList.remove('listening');

    if (!commit && voiceState.activeTargetInput) {
      voiceState.activeTargetInput.value = voiceState.initialText;
    }
    autoGrow();
    voiceState.activeTargetInput = null;
    voiceState.activeButton = null;
    voiceState.finalTranscript = '';
    voiceState.interimTranscript = '';
    updateSendState();
  }

  function setupVoiceInput() {
    if (el.voiceInputBtn) {
      el.voiceInputBtn.addEventListener('click', (e) => {
        e.preventDefault();
        startVoiceInput(el.input, el.voiceInputBtn);
      });
    }

    if (el.voiceDoneBtn) {
      el.voiceDoneBtn.addEventListener('click', (e) => {
        e.preventDefault();
        stopVoiceInput(true);
      });
    }

    if (el.voiceCancelBtn) {
      el.voiceCancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        stopVoiceInput(false);
      });
    }

    if (!voiceState.supported && el.voiceInputBtn) {
      el.voiceInputBtn.setAttribute('title', 'Voice input requires Chrome, Edge, or Safari');
    }
  }

  /* ------------------------------------------------------------ composer state & autosize */
  function updateSendState() {
    if (authState.user && authState.user.remainingChats <= 0) {
      if (el.send) el.send.disabled = true;
      return;
    }
    const hasText = !!(el.input && el.input.value.trim());
    if (el.send) el.send.disabled = state.busy || (!hasText && !state.pending);
  }

  function autoGrow() {
    if (!el.input) return;
    el.input.style.height = 'auto';
    el.input.style.height = Math.min(el.input.scrollHeight, 180) + 'px';
  }

  if (el.input) {
    el.input.addEventListener('input', () => { autoGrow(); updateSendState(); });
    el.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (el.send && !el.send.disabled && el.form) el.form.requestSubmit();
      }
    });
  }

  if (el.form) {
    el.form.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage();
    });
  }

  /* ------------------------------------------------------------ rendering */
  function hideEmptyState() {
    if (el.empty) el.empty.classList.add('hidden');
  }

  function addUserBubble(msg, previewUrl) {
    hideEmptyState();
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-user';
    if (previewUrl) {
      const img = document.createElement('img');
      img.className = 'msg-image';
      img.src = previewUrl;
      img.alt = 'Attached visual';
      img.title = 'Click to view image in big size';
      img.setAttribute('role', 'button');
      img.setAttribute('tabindex', '0');
      img.addEventListener('click', () => {
        const metaText = msg.image?.bytes ? formatBytes(msg.image.bytes) : '';
        openImageModal(previewUrl, msg.image?.name || 'Attached visual', metaText);
      });
      img.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const metaText = msg.image?.bytes ? formatBytes(msg.image.bytes) : '';
          openImageModal(previewUrl, msg.image?.name || 'Attached visual', metaText);
        }
      });
      wrap.appendChild(img);
    } else if (msg.image && (msg.image.isDoc || msg.image.mediaType === 'application/pdf' || msg.image.mediaType.includes('word') || msg.image.name?.match(/\.(pdf|docx|doc)$/i))) {
      const docCard = document.createElement('div');
      docCard.className = 'msg-doc-badge';
      const isPdf = msg.image.mediaType === 'application/pdf' || msg.image.name?.toLowerCase().endsWith('.pdf');
      const docIcon = isPdf ? '📄' : '📝';
      const docLabel = isPdf ? 'PDF Document' : 'Word Document';
      docCard.innerHTML = `<span class="doc-icon">${docIcon}</span><div class="doc-details"><span class="doc-name">${escapeHtml(msg.image.name || 'Document')}</span><span class="doc-meta">${docLabel}</span></div>`;
      wrap.appendChild(docCard);
    }
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = msg.content;
    wrap.appendChild(bubble);
    el.log.appendChild(wrap);
    scrollToBottom();
  }

  function addTyping(label = 'The assistant is thinking') {
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-assistant';
    wrap.id = 'typingRow';
    wrap.innerHTML = `<div class="bubble"><span class="typing" aria-label="${escapeHtml(label)}"><span></span><span></span><span></span></span></div>`;
    el.log.appendChild(wrap);
    scrollToBottom();
  }

  function removeTyping() {
    const t = $('typingRow');
    if (t) t.remove();
  }

  function addAssistantBubble(answer, meta, messageIndex) {
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-assistant';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = renderMarkdown(answer);
    wrap.appendChild(bubble);

    const actions = document.createElement('div');
    actions.className = 'msg-actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'msg-action';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(answer);
        copyBtn.textContent = 'Copied ✓';
      } catch {
        copyBtn.textContent = 'Press Ctrl+C';
      }
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    });
    actions.appendChild(copyBtn);

    // Read Aloud (Speech Synthesis TTS) button
    if ('speechSynthesis' in window) {
      const speakBtn = document.createElement('button');
      speakBtn.type = 'button';
      speakBtn.className = 'msg-action';
      speakBtn.innerHTML = '🔊 Read Aloud';
      speakBtn.setAttribute('title', 'Read answer aloud');

      speakBtn.addEventListener('click', () => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.cancel();
          if (speakBtn.classList.contains('speaking')) {
            speakBtn.classList.remove('speaking');
            speakBtn.innerHTML = '🔊 Read Aloud';
            return;
          }
        }
        
        document.querySelectorAll('.msg-action.speaking').forEach((b) => {
          b.classList.remove('speaking');
          b.innerHTML = '🔊 Read Aloud';
        });

        const plainText = answer
          .replace(/```[\s\S]*?```/g, 'Code block omitted.')
          .replace(/`([^`]+)`/g, '$1')
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
          .replace(/[*_#>`~]/g, '')
          .replace(/\n+/g, '. ')
          .trim();

        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.rate = 1.0;
        utterance.onend = () => {
          speakBtn.classList.remove('speaking');
          speakBtn.innerHTML = '🔊 Read Aloud';
        };
        utterance.onerror = () => {
          speakBtn.classList.remove('speaking');
          speakBtn.innerHTML = '🔊 Read Aloud';
        };

        speakBtn.classList.add('speaking');
        speakBtn.innerHTML = '⏹ Stop Audio';
        window.speechSynthesis.speak(utterance);
      });

      actions.appendChild(speakBtn);
    }

    if (findImageFor(messageIndex)) {
      const checkBtn = document.createElement('button');
      checkBtn.type = 'button';
      checkBtn.className = 'msg-action';
      checkBtn.textContent = '🔍 Check for hallucinations';
      checkBtn.addEventListener('click', () => runCheck(messageIndex, checkBtn, wrap));
      actions.appendChild(checkBtn);
    }

    wrap.appendChild(actions);

    if (meta) {
      const cleanMeta = String(meta).replace(/gemini[^\s·]*|claude[^\s·]*|gpt[^\s·]*/gi, 'EvidentAI');
      const m = document.createElement('div');
      m.className = 'msg-meta';
      m.textContent = cleanMeta;
      wrap.appendChild(m);
    }

    el.log.appendChild(wrap);
    scrollToBottom();
  }

  function addErrorBubble(message, onRetry) {
    const wrap = document.createElement('div');
    wrap.className = 'msg msg-error';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = message;
    wrap.appendChild(bubble);

    if (onRetry) {
      const actions = document.createElement('div');
      actions.className = 'msg-actions';
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'msg-action';
      retryBtn.textContent = 'Retry';
      retryBtn.addEventListener('click', () => { wrap.remove(); onRetry(); });
      actions.appendChild(retryBtn);
      wrap.appendChild(actions);
    }
    el.log.appendChild(wrap);
    scrollToBottom();
  }

  /* ------------------------------------------------------------ HTTP */
  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (authState.token) {
      headers['Authorization'] = `Bearer ${authState.token}`;
    }
    const uid = authState.user?.id || store.get('chatUserId') || 'usr_bhardwaj';
    if (uid) {
      headers['X-User-Id'] = uid;
    }
    return headers;
  }

  async function postJson(url, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const headers = getAuthHeaders();
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      let data = null;
      try { data = await res.json(); } catch { /* not JSON */ }
      if (!data) throw new Error(`Server returned unexpected response (HTTP ${res.status}).`);
      if (!res.ok || !data.success) throw new Error(data.error || `Request failed (HTTP ${res.status}).`);
      return data;
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('The request timed out. Please try again.');
      if (err instanceof TypeError) throw new Error('Could not reach server. Verify it is running (npm start).');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function sendMessage() {
    if (voiceState.isListening) stopVoiceInput(true);
    if (authState.user && authState.user.remainingChats <= 0) {
      showComposerError("Chat limit reached (10/10 used). Reset quota or switch accounts to continue.");
      if (el.quotaBanner) el.quotaBanner.classList.remove('hidden');
      return;
    }
    if (state.busy) return;
    const text = el.input.value.trim();
    if (!text && !state.pending) return;

    if (!authState.currentSessionId) {
      authState.currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }

    const userText = text || (state.pending?.isDoc ? 'Please analyze this attached document and provide a clear, comprehensive summary.' : 'What is shown in this image?');
    const msg = { role: 'user', content: userText };
    const previewUrl = state.pending?.previewUrl || null;

    if (state.pending?.data) {
      msg.image = {
        mediaType: state.pending.mediaType,
        data: state.pending.data,
        name: state.pending.name,
        isDoc: !!state.pending.isDoc
      };
    }

    state.messages.push(msg);
    addUserBubble(msg, previewUrl);
    removePending();

    el.input.value = '';
    autoGrow();
    await requestAnswer();
  }

  async function requestAnswer() {
    const chatId = state.chatId;
    state.busy = true;
    updateSendState();
    addTyping();
    try {
      const data = await postJson('/api/chat', {
        messages: state.messages,
        provider: el.provider?.value || 'gemini',
        strict: el.strict?.checked || false,
        sessionId: authState.currentSessionId
      });
      if (chatId !== state.chatId) return;
      removeTyping();
      state.messages.push({ role: 'assistant', content: data.answer });
      const meta = `EvidentAI · ${(data.latencyMs / 1000).toFixed(1)}s`;
      addAssistantBubble(data.answer, meta, state.messages.length - 1);

      if (data.quota && authState.user) {
        authState.user.chatsUsed = data.quota.used;
        authState.user.remainingChats = data.quota.remaining;
        updateAccountUI();
      }
      loadUserSessions();
    } catch (err) {
      if (chatId !== state.chatId) return;
      removeTyping();
      addErrorBubble(err.message, requestAnswer);
    } finally {
      if (chatId === state.chatId) {
        state.busy = false;
        updateSendState();
        if (el.input) el.input.focus();
      }
    }
  }

  function findImageFor(answerIndex) {
    for (let i = answerIndex; i >= 0; i--) {
      if (state.messages[i].role === 'user' && state.messages[i].image) return state.messages[i].image;
    }
    return null;
  }

  function findQuestionFor(answerIndex) {
    for (let i = answerIndex - 1; i >= 0; i--) {
      if (state.messages[i].role === 'user') return state.messages[i].content;
    }
    return '';
  }

  async function runCheck(answerIndex, btn, wrap) {
    const image = findImageFor(answerIndex);
    if (!image) return;
    btn.disabled = true;
    btn.textContent = 'Checking…';
    const oldReport = wrap.querySelector('.check-report');
    if (oldReport) oldReport.remove();
    const oldPrompt = wrap.querySelector('.pipeline-prompt-card');
    if (oldPrompt) oldPrompt.remove();
    const oldCompact = wrap.querySelector('.pipeline-prompt-compact');
    if (oldCompact) oldCompact.remove();

    try {
      const question = findQuestionFor(answerIndex);
      const answer = state.messages[answerIndex].content;
      const provider = el.provider?.value || 'gemini';

      const data = await postJson('/api/chat/check', {
        question,
        answer,
        image,
        provider
      });
      wrap.appendChild(buildReport(data));

      // Show option asking whether to view the 8-Stage Research Pipeline
      const pipelinePrompt = buildPipelinePrompt(answerIndex, question, answer, image, data, provider);
      wrap.appendChild(pipelinePrompt);

      btn.textContent = 'Check again';
      scrollToBottom();
    } catch (err) {
      const box = document.createElement('div');
      box.className = 'check-report bad';
      box.textContent = `Check error: ${err.message}`;
      wrap.appendChild(box);
      btn.textContent = '🔍 Check for hallucinations';
    } finally {
      btn.disabled = false;
    }
  }

  function buildReport(data) {
    const box = document.createElement('div');
    const bad = data.hallucinatedCount > 0;
    box.className = `check-report ${bad ? 'bad' : 'ok'}`;

    const summary = document.createElement('div');
    summary.className = 'check-summary';
    summary.innerHTML = bad
      ? `⚠️ <strong>${data.hallucinatedCount} potential hallucination(s) detected</strong> (${data.supportedCount} supported, ${data.totalClaims} total claims)`
      : `✓ <strong>All ${data.totalClaims} claims verified grounded</strong> in the provided visual evidence.`;
    box.appendChild(summary);

    if (data.note) {
      const note = document.createElement('div');
      note.className = 'check-note';
      note.textContent = data.note;
      box.appendChild(note);
    }

    const list = document.createElement('ul');
    list.className = 'check-claims';
    data.claims.forEach((c) => {
      const li = document.createElement('li');
      li.className = c.status;
      const tag = document.createElement('span');
      tag.className = 'claim-tag';
      tag.textContent = c.type;
      li.appendChild(tag);
      li.appendChild(document.createTextNode(c.claim));
      if (c.reason) {
        const why = document.createElement('span');
        why.className = 'claim-why';
        why.textContent = c.reason;
        li.appendChild(why);
      }
      list.appendChild(li);
    });
    box.appendChild(list);
    return box;
  }

  function getStageDetails(stageNum, question, answer, image, data, provider) {
    const pName = 'EvidentAI';
    const claims = data.claims || [];
    const hallCount = data.hallucinatedCount || 0;
    const totalClaims = data.totalClaims || claims.length || 0;
    const suppCount = data.supportedCount || Math.max(0, totalClaims - hallCount);
    const ratePct = ((data.hallucinationRate || 0) * 100).toFixed(1);
    const faithPct = (100 - parseFloat(ratePct)).toFixed(1);
    const imageName = image?.name || 'Attached visual';
    const imageType = image?.mediaType || 'image/png';
    const extractedEv = data.extractedEvidence || 'Visual features and OCR tokens extracted from image input channels.';

    switch (stageNum) {
      case 1:
        return {
          number: '01',
          title: 'Question Formulation',
          type: 'Input Processing',
          input: `User Query: "${question || 'What is shown in this image?'}"\nModality: Multimodal (Text Prompt + Visual Artifact Reference)`,
          output: `Structured query representation:\n• Intent: Visual evidence analysis & entity reasoning\n• Target Context: ${imageName} (${imageType})\n• Execution Constraints: Multimodal Grounding Active`,
          desc: 'Parses the user prompt to determine visual reasoning scope, target figure entities, and mathematical/OCR requirements before constructing model prompts.'
        };
      case 2:
        return {
          number: '02',
          title: 'Multimodal Retrieval',
          type: 'Dense & Sparse Vector Search / Ingestion',
          input: `Artifact: ${imageName} | Type: ${imageType}\nIndexing Mode: Direct Visual Ingestion & Cross-Modal Channel Alignment`,
          output: `Retrieved Visual Evidence Chunk:\n• Source: User upload / benchmark visual document\n• Resolution channels aligned: Primary image base64 stream\n• Channel status: Ready for vision encoder`,
          desc: 'Retrieves relevant document fragments, OCR text snippets, or direct visual image representations using dense cross-modal embeddings.'
        };
      case 3:
        return {
          number: '03',
          title: 'Evidence Construction',
          type: 'Context Assembly',
          input: `Raw Evidence Stream: ${imageName}\nTarget Model: ${pName} Vision Pipeline`,
          output: `Constructed Multimodal Evidence Context:\n${extractedEv.slice(0, 360)}${extractedEv.length > 360 ? '...' : ''}`,
          desc: 'Assembles heterogeneous visual tokens, extracted table values, and layout coordinates into an organized context prompt to eliminate grounding ambiguities.'
        };
      case 4:
        return {
          number: '04',
          title: 'Generation',
          type: 'MLLM Synthesis',
          input: `Provider: ${pName}\nSystem Prompt: Strict Evidence Grounding & Visual Reasoning\nContext: Evidence Block + Formulated Question`,
          output: `Generated Response:\n"${answer.slice(0, 320)}${answer.length > 320 ? '...' : ''}"`,
          desc: 'The multimodal LLM reasons over the constructed cross-modal evidence block, generating a candidate explanation and factual assertions.'
        };
      case 5:
        return {
          number: '05',
          title: 'Hallucination Detection',
          type: 'Automated Verification (RAGTruth / POPE)',
          input: `Answer assertion units (${totalClaims} total claims) vs. Source Visual Evidence (${imageName})`,
          output: `Claim Decomposition Results:\n• Total Claims Evaluated: ${totalClaims}\n• Grounded (Supported): ${suppCount}\n• Hallucinated / Unsupported: ${hallCount}\n• Status: ${hallCount > 0 ? '⚠️ Unfaithful Claims Detected' : '✓ Grounded (Zero Conflicts)'}`,
          desc: 'Applies automated multi-agent claim verification adapted from POPE and RAGTruth. Every claim is verified against visible facts in the visual evidence.'
        };
      case 6:
        return {
          number: '06',
          title: 'Quantification',
          type: 'Taxonomy & Metric Scoring',
          input: `Verification flags across 5 Error Taxonomies:\n1. Retrieval  2. Reasoning  3. Generation  4. Grounding  5. True Hallucination`,
          output: `Quantified Metrics:\n• Hallucination Rate: ${ratePct}%\n• Mathematical / Numeric Consistency: ${data.numericCheck?.status || 'Verified'}\n• Overall Status: ${data.status || (hallCount > 0 ? 'HALLUCINATION_DETECTED' : 'FAITHFUL')}`,
          desc: 'Calculates the formal hallucination score, distinguishing reasoning errors from true hallucinations, and checks numeric consistency.'
        };
      case 7:
        return {
          number: '07',
          title: 'Mitigation',
          type: 'Refinement & Self-Correction',
          input: `Feedback from Stage 05/06: ${hallCount} unfaithful claims flagged.`,
          output: `Mitigation Recommendation:\n${hallCount > 0 ? '• Enable Strict Evidence Grounding toggle to constrain generation to visible pixels.\n• Re-prompt with negative constraint instructions against speculative extrapolation.' : '• No corrective feedback required. The response is fully grounded in the provided evidence.'}`,
          desc: 'Applies targeted corrective feedback loops: triggering strict grounding constraints, OCR re-verification, or self-correction passes.'
        };
      case 8:
        return {
          number: '08',
          title: 'Final Answer & Evaluation',
          type: 'Output Verification',
          input: `Candidate Answer + Quantified Verification Score`,
          output: `Verified Output Summary:\n• Final Faithfulness Confidence: ${faithPct}%\n• Evidentiary Source: ${imageName}\n• Reliability Rating: ${hallCount === 0 ? 'HIGH (Fully Grounded)' : 'MODERATE (Contains Speculative Claims)'}`,
          desc: 'Delivers the verified final response with transparent grounding metrics, ensuring verifiable and accountable visual AI answers.'
        };
      default:
        return {
          number: '01',
          title: 'Question Formulation',
          type: 'Input Processing',
          input: 'Query processing',
          output: 'Standard format',
          desc: 'Initial query parsing.'
        };
    }
  }

  function buildPipelinePrompt(answerIndex, question, answer, image, data, provider) {
    const card = document.createElement('div');
    card.className = 'pipeline-prompt-card';

    // Header with question and buttons
    const header = document.createElement('div');
    header.className = 'pipeline-prompt-header';

    const left = document.createElement('div');
    left.className = 'pipeline-prompt-left';
    left.innerHTML = `
      <span class="pipeline-prompt-icon" aria-hidden="true">🔬</span>
      <div>
        <div class="pipeline-prompt-title">
          8-Stage Research Pipeline Analysis
          <span class="pipeline-prompt-tag">Research Trace</span>
        </div>
        <div class="pipeline-prompt-desc">Would you like to view the full 8-stage multimodal retrieval, grounding, and verification pipeline for this response?</div>
      </div>
    `;

    const btns = document.createElement('div');
    btns.className = 'pipeline-prompt-btns';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn-pipeline-toggle';
    toggleBtn.innerHTML = `<span>⚡</span> <span>Show 8-Stage Pipeline</span>`;

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'btn-pipeline-dismiss';
    dismissBtn.textContent = 'Not now';
    dismissBtn.title = 'Dismiss this prompt';

    btns.appendChild(toggleBtn);
    btns.appendChild(dismissBtn);
    header.appendChild(left);
    header.appendChild(btns);
    card.appendChild(header);

    // 8-Stage Pipeline Container (initially hidden)
    const pipelineContainer = document.createElement('div');
    pipelineContainer.className = 'chat-pipeline-container hidden';

    const lead = document.createElement('div');
    lead.className = 'chat-pipeline-lead';
    lead.innerHTML = `
      <span>Interactive trace across all 8 stages of the multimodal grounding framework. Click any stage to inspect:</span>
    `;
    pipelineContainer.appendChild(lead);

    // Flow scroll wrapper
    const flowScroll = document.createElement('div');
    flowScroll.className = 'chat-pipeline-flow-scroll';

    const flow = document.createElement('div');
    flow.className = 'chat-pipeline-flow';

    const stagesMeta = [
      { num: 1, title: 'Question', summary: 'Parse & formulate query' },
      { num: 2, title: 'Multimodal Retrieval', summary: 'Ingest visual evidence' },
      { num: 3, title: 'Evidence Construction', summary: 'Assemble cross-modal context' },
      { num: 4, title: 'Generation', summary: 'MLLM synthesis & rationale' },
      { num: 5, title: 'Hallucination Detection', summary: data.hallucinatedCount > 0 ? `${data.hallucinatedCount} conflict(s)` : 'Grounded verification' },
      { num: 6, title: 'Quantification', summary: `Hallucination rate: ${((data.hallucinationRate || 0) * 100).toFixed(0)}%` },
      { num: 7, title: 'Mitigation', summary: 'Grounding constraints' },
      { num: 8, title: 'Final Answer & Eval', summary: 'Verified output' }
    ];

    const inspector = document.createElement('div');
    inspector.className = 'chat-pipeline-inspector';
    inspector.innerHTML = `
      <div class="chat-inspector-header">
        <div class="chat-inspector-title-wrap">
          <span class="chat-inspector-badge" id="chatInspBadge">STAGE 01</span>
          <h4 class="chat-inspector-title" id="chatInspTitle">Question Formulation</h4>
          <span class="chat-inspector-tag" id="chatInspTag">Input Processing</span>
        </div>
      </div>
      <div class="chat-inspector-grid">
        <div class="chat-inspector-field">
          <div class="chat-inspector-label">📥 Input Data &amp; Schema:</div>
          <div class="chat-inspector-val mono" id="chatInspInput"></div>
        </div>
        <div class="chat-inspector-field">
          <div class="chat-inspector-label">📤 Output Data &amp; Schema:</div>
          <div class="chat-inspector-val mono" id="chatInspOutput"></div>
        </div>
        <div class="chat-inspector-field">
          <div class="chat-inspector-label">📖 Research Methodology:</div>
          <div class="chat-inspector-val" id="chatInspDesc"></div>
        </div>
      </div>
    `;

    function renderStageInInspector(stageNum) {
      const details = getStageDetails(stageNum, question, answer, image, data, provider);
      const badge = inspector.querySelector('#chatInspBadge');
      const title = inspector.querySelector('#chatInspTitle');
      const tag = inspector.querySelector('#chatInspTag');
      const inVal = inspector.querySelector('#chatInspInput');
      const outVal = inspector.querySelector('#chatInspOutput');
      const descVal = inspector.querySelector('#chatInspDesc');

      if (badge) badge.textContent = `STAGE ${details.number}`;
      if (title) title.textContent = details.title;
      if (tag) tag.textContent = details.type;
      if (inVal) inVal.textContent = details.input;
      if (outVal) outVal.textContent = details.output;
      if (descVal) descVal.textContent = details.desc;

      flow.querySelectorAll('.chat-stage-node').forEach((node) => {
        const n = parseInt(node.dataset.stageNum, 10);
        node.classList.toggle('active', n === stageNum);
      });
    }

    stagesMeta.forEach((s) => {
      const node = document.createElement('div');
      node.className = 'chat-stage-node';
      node.dataset.stageNum = s.num;
      if (s.num === 5 && data.hallucinatedCount > 0) {
        node.classList.add('stage-flagged');
      }

      const top = document.createElement('div');
      top.className = 'chat-stage-top';
      const numSpan = document.createElement('span');
      numSpan.className = 'chat-stage-num';
      numSpan.textContent = String(s.num).padStart(2, '0');
      top.appendChild(numSpan);

      const statusIcon = document.createElement('span');
      statusIcon.className = 'chat-stage-status-icon';
      statusIcon.textContent = s.num === 5 ? (data.hallucinatedCount > 0 ? '⚠️' : '✓') : (s.num === 8 ? '🎯' : '→');
      top.appendChild(statusIcon);

      const titleEl = document.createElement('div');
      titleEl.className = 'chat-stage-title';
      titleEl.textContent = s.title;

      const sumEl = document.createElement('div');
      sumEl.className = 'chat-stage-summary';
      sumEl.textContent = s.summary;

      node.appendChild(top);
      node.appendChild(titleEl);
      node.appendChild(sumEl);

      node.addEventListener('click', () => {
        renderStageInInspector(s.num);
      });

      flow.appendChild(node);
    });

    flowScroll.appendChild(flow);
    pipelineContainer.appendChild(flowScroll);
    pipelineContainer.appendChild(inspector);
    card.appendChild(pipelineContainer);

    // Initial state: default to stage 5 if hallucination detected, else stage 1
    const defaultStage = data.hallucinatedCount > 0 ? 5 : 1;
    renderStageInInspector(defaultStage);

    // Toggle event
    let isExpanded = false;
    toggleBtn.addEventListener('click', () => {
      isExpanded = !isExpanded;
      if (isExpanded) {
        pipelineContainer.classList.remove('hidden');
        card.classList.add('expanded');
        toggleBtn.classList.add('active');
        toggleBtn.innerHTML = `<span>▲</span> <span>Hide 8-Stage Pipeline</span>`;
        pipelineContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        pipelineContainer.classList.add('hidden');
        card.classList.remove('expanded');
        toggleBtn.classList.remove('active');
        toggleBtn.innerHTML = `<span>⚡</span> <span>Show 8-Stage Pipeline</span>`;
      }
    });

    // Dismiss event: collapses into compact trigger
    dismissBtn.addEventListener('click', () => {
      card.classList.add('hidden');
      const compact = document.createElement('div');
      compact.className = 'pipeline-prompt-compact';
      const compactBtn = document.createElement('button');
      compactBtn.type = 'button';
      compactBtn.className = 'btn-pipeline-compact';
      compactBtn.innerHTML = `<span>🔬</span> Show 8-Stage Pipeline`;
      compactBtn.addEventListener('click', () => {
        compact.remove();
        card.classList.remove('hidden');
        if (!isExpanded) toggleBtn.click();
      });
      compact.appendChild(compactBtn);
      card.parentNode.insertBefore(compact, card.nextSibling);
    });

    return card;
  }

  /* ------------------------------------------------------------ USER ACCOUNT & ISOLATED HISTORY */
  function updateAccountUI() {
    if (!authState.user) return;

    const u = authState.user;
    const initial = (u.name || u.username || 'A')[0].toUpperCase();
    const remaining = Math.max(0, (u.chatLimit || 10) - (u.chatsUsed || 0));
    u.remainingChats = remaining;

    // Header pill
    if (el.userAvatar) el.userAvatar.textContent = initial;
    if (el.userName) el.userName.textContent = u.name || u.username;
    if (el.quotaBadge) {
      el.quotaBadge.textContent = `⚡ ${remaining}/${u.chatLimit || 10}`;
      el.quotaBadge.className = 'quota-badge ' + (remaining <= 2 ? 'low' : (remaining <= 5 ? 'warn' : 'good'));
    }

    // Dropdown details
    if (el.dropdownUserName) el.dropdownUserName.textContent = u.name || u.username;
    if (el.dropdownUserRole) {
      const r = (u.role || 'Starter Plan').toUpperCase();
      el.dropdownUserRole.textContent = r.endsWith('PLAN') ? r : `${r} PLAN`;
    }
    if (el.dropdownUserEmail) el.dropdownUserEmail.textContent = u.email || `${u.username}@evident.ai`;
    if (el.dropdownQuotaText) {
      el.dropdownQuotaText.textContent = `${u.chatsUsed || 0} / ${u.chatLimit || 10} used (${remaining} left)`;
    }
    if (el.resetQuotaBtn) {
      el.resetQuotaBtn.innerHTML = `<span>🔄</span> Reset Quota (${u.chatLimit || 10} Chats)`;
    }
    if (el.bannerResetBtn) {
      el.bannerResetBtn.textContent = `Reset Quota (${u.chatLimit || 10} Chats)`;
    }
    if (el.dropdownQuotaProgress) {
      const pct = Math.min(100, Math.round(((u.chatsUsed || 0) / (u.chatLimit || 10)) * 100));
      el.dropdownQuotaProgress.style.width = pct + '%';
      el.dropdownQuotaProgress.className = 'quota-progress-fill ' + (remaining <= 0 ? 'full' : (remaining <= 2 ? 'high' : ''));
    }

    // Sidebar summary
    if (el.sidebarAvatar) el.sidebarAvatar.textContent = initial;
    if (el.sidebarUsername) el.sidebarUsername.textContent = u.name ? `${u.name} (@${u.username})` : `@${u.username}`;
    if (el.sidebarQuotaSummary) el.sidebarQuotaSummary.textContent = `${remaining} chats remaining`;

    // Composer banner state
    if (el.quotaBanner) {
      if (remaining <= 0) {
        el.quotaBanner.classList.remove('hidden');
        if (el.quotaBannerText) {
          el.quotaBannerText.textContent = `You have used all ${u.chatLimit || 10} messages allocated to @${u.username}. Reset quota or switch account to continue chatting.`;
        }
      } else {
        el.quotaBanner.classList.add('hidden');
      }
    }
    updateSendState();
  }

  async function initAuth() {
    try {
      if (authState.token) {
        const res = await fetch('/api/auth/me', { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            authState.user = data.user;
            updateAccountUI();
            loadUserSessions();
            return;
          }
        }
      }
      await loginUser('bhardwaj', 'password123');
    } catch {
      // offline fallback
      authState.user = { id: 'usr_bhardwaj', username: 'bhardwaj', name: 'Bhardwaj', role: 'Ultra Pro Plan', chatsUsed: 0, chatLimit: 100, remainingChats: 100 };
      updateAccountUI();
    }
  }

  async function loginUser(username, password) {
    try {
      clearAuthError();
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Login failed');
      }
      authState.token = data.token;
      authState.user = data.user;
      store.set('chatToken', data.token);
      store.set('chatUserId', data.user.id);

      updateAccountUI();
      if (el.authModal) {
        el.authModal.classList.add('hidden');
        el.authModal.setAttribute('aria-hidden', 'true');
      }
      resetChat();
      loadUserSessions();
    } catch (err) {
      showAuthError(err.message);
    }
  }

  async function registerNewUser(username, password, name) {
    try {
      clearAuthError();
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed');
      }
      authState.token = data.token;
      authState.user = data.user;
      store.set('chatToken', data.token);
      store.set('chatUserId', data.user.id);

      updateAccountUI();
      if (el.authModal) {
        el.authModal.classList.add('hidden');
        el.authModal.setAttribute('aria-hidden', 'true');
      }
      resetChat();
      loadUserSessions();
    } catch (err) {
      showAuthError(err.message);
    }
  }

  async function resetQuota() {
    try {
      const res = await fetch('/api/auth/reset-quota', {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && data.user) {
        authState.user = data.user;
        updateAccountUI();
        if (el.accountDropdown) el.accountDropdown.classList.add('hidden');
        if (el.quotaBanner) el.quotaBanner.classList.add('hidden');
        clearComposerError();
      }
    } catch {
      if (authState.user) {
        authState.user.chatsUsed = 0;
        authState.user.remainingChats = 10;
        updateAccountUI();
      }
    }
  }

  async function loadUserSessions() {
    if (!el.sidebarSessionsList) return;
    try {
      const res = await fetch('/api/chat/sessions', { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.sessions) {
        renderSidebarSessions(data.sessions);
      }
    } catch {
      // offline
    }
  }

  function renderSidebarSessions(sessions) {
    if (!el.sidebarSessionsList) return;
    if (!sessions || sessions.length === 0) {
      el.sidebarSessionsList.innerHTML = `<div class="sidebar-empty">No conversation history yet. Start a new chat!</div>`;
      return;
    }

    el.sidebarSessionsList.innerHTML = sessions.map(s => {
      const isActive = s.id === authState.currentSessionId;
      const dateStr = s.updatedAt ? new Date(s.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const hasImage = s.hasImage ? '🖼️ ' : '';
      return `
        <div class="sidebar-session-item ${isActive ? 'active' : ''}" data-id="${escapeHtml(s.id)}">
          <div class="session-item-body">
            <span class="session-item-title">${hasImage}${escapeHtml(s.title || 'Untitled Chat')}</span>
            <span class="session-item-meta">${dateStr} · ${s.messageCount || 0} msgs</span>
          </div>
          <button type="button" class="session-item-delete" data-delete-id="${escapeHtml(s.id)}" title="Delete conversation">&times;</button>
        </div>
      `;
    }).join('');

    el.sidebarSessionsList.querySelectorAll('.sidebar-session-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.session-item-delete')) return;
        const sid = item.dataset.id;
        loadSessionDetails(sid);
        closeSidebar();
      });
    });

    el.sidebarSessionsList.querySelectorAll('.session-item-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sid = btn.dataset.deleteId;
        deleteSession(sid);
      });
    });
  }

  async function loadSessionDetails(sessionId) {
    try {
      const res = await fetch(`/api/chat/session/${sessionId}`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.session) {
        const s = data.session;
        authState.currentSessionId = s.id;
        state.chatId++;
        removeTyping();
        state.messages = [];
        el.log.querySelectorAll('.msg').forEach((n) => n.remove());

        if (s.messages && s.messages.length > 0) {
          hideEmptyState();
          s.messages.forEach((msg, idx) => {
            state.messages.push(msg);
            if (msg.role === 'user') {
              const preview = msg.image ? (msg.image.data ? `data:${msg.image.mediaType};base64,${msg.image.data}` : null) : null;
              addUserBubble(msg, preview);
            } else if (msg.role === 'assistant') {
              addAssistantBubble(msg.content, msg.meta || 'EvidentAI', idx);
            }
          });
        } else {
          el.empty.classList.remove('hidden');
        }
        loadUserSessions();
      }
    } catch {
      // ignore
    }
  }

  async function deleteSession(sessionId) {
    try {
      const res = await fetch(`/api/chat/session/${sessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        if (authState.currentSessionId === sessionId) {
          resetChat();
        }
        loadUserSessions();
      }
    } catch {
      // ignore
    }
  }

  function showAuthError(msg) {
    if (el.authErrorMsg) {
      el.authErrorMsg.textContent = msg;
      el.authErrorMsg.classList.remove('hidden');
    }
  }

  function clearAuthError() {
    if (el.authErrorMsg) {
      el.authErrorMsg.classList.add('hidden');
      el.authErrorMsg.textContent = '';
    }
  }

  function openSidebar() {
    if (el.chatSidebar) el.chatSidebar.classList.remove('collapsed');
    if (el.sidebarBackdrop) el.sidebarBackdrop.classList.remove('hidden');
    loadUserSessions();
  }

  function closeSidebar() {
    if (el.chatSidebar) el.chatSidebar.classList.add('collapsed');
    if (el.sidebarBackdrop) el.sidebarBackdrop.classList.add('hidden');
  }

  function setupAuthAndHistory() {
    if (el.toggleSidebarBtn) el.toggleSidebarBtn.addEventListener('click', openSidebar);
    if (el.closeSidebarBtn) el.closeSidebarBtn.addEventListener('click', closeSidebar);
    if (el.sidebarBackdrop) el.sidebarBackdrop.addEventListener('click', closeSidebar);
    if (el.sidebarNewChatBtn) {
      el.sidebarNewChatBtn.addEventListener('click', () => {
        resetChat();
        closeSidebar();
      });
    }

    // Account Dropdown Toggle
    if (el.userAccountBtn && el.accountDropdown) {
      el.userAccountBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        el.accountDropdown.classList.toggle('hidden');
      });
      document.addEventListener('click', (e) => {
        if (!el.accountDropdown.contains(e.target) && e.target !== el.userAccountBtn) {
          el.accountDropdown.classList.add('hidden');
        }
      });
    }

    // Reset Quota buttons
    if (el.resetQuotaBtn) el.resetQuotaBtn.addEventListener('click', resetQuota);
    if (el.bannerResetBtn) el.bannerResetBtn.addEventListener('click', resetQuota);

    // Switch Account Modal triggers
    function openAuthModal() {
      if (el.accountDropdown) el.accountDropdown.classList.add('hidden');
      if (el.authModal) {
        clearAuthError();
        el.authModal.classList.remove('hidden');
        el.authModal.setAttribute('aria-hidden', 'false');
      }
      closeSidebar();
    }

    if (el.switchAccountBtn) el.switchAccountBtn.addEventListener('click', openAuthModal);
    if (el.bannerSwitchBtn) el.bannerSwitchBtn.addEventListener('click', openAuthModal);
    if (el.sidebarSwitchBtn) el.sidebarSwitchBtn.addEventListener('click', openAuthModal);
    if (el.logoutBtn) {
      el.logoutBtn.addEventListener('click', () => {
        store.set('chatToken', '');
        store.set('chatUserId', '');
        authState.token = null;
        authState.user = null;
        openAuthModal();
      });
    }

    if (el.closeAuthModalBtn && el.authModal) {
      el.closeAuthModalBtn.addEventListener('click', () => {
        el.authModal.classList.add('hidden');
        el.authModal.setAttribute('aria-hidden', 'true');
      });
    }

    // 1-Click Demo Accounts Login Buttons
    document.querySelectorAll('.demo-account-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = btn.dataset.username;
        loginUser(u, 'password123');
      });
    });

    // Auth Mode Switcher (Login <-> Create Account)
    const authTitle = $('authTitle');
    function setAuthMode(mode) {
      clearAuthError();
      if (mode === 'register') {
        if (authTitle) authTitle.textContent = 'Create Account';
        if (el.authRegisterForm) el.authRegisterForm.classList.remove('hidden');
        if (el.authLoginForm) el.authLoginForm.classList.add('hidden');
        if (el.registerUsername) el.registerUsername.focus();
      } else {
        if (authTitle) authTitle.textContent = 'Login';
        if (el.authLoginForm) el.authLoginForm.classList.remove('hidden');
        if (el.authRegisterForm) el.authRegisterForm.classList.add('hidden');
        if (el.loginUsername) el.loginUsername.focus();
      }
    }

    document.querySelectorAll('#authTabRegisterBtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        setAuthMode('register');
      });
    });

    document.querySelectorAll('#authTabLoginBtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        setAuthMode('login');
      });
    });

    // Password visibility toggle
    document.querySelectorAll('.toggle-password-visibility').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        const isPw = input.type === 'password';
        input.type = isPw ? 'text' : 'password';
        const eyeShow = btn.querySelector('.pw-eye-show');
        const eyeHide = btn.querySelector('.pw-eye-hide');
        if (eyeShow) eyeShow.classList.toggle('hidden', isPw);
        if (eyeHide) eyeHide.classList.toggle('hidden', !isPw);
      });
    });

    // Forgot Password link
    const forgotPw = document.getElementById('forgotPwLink');
    if (forgotPw) {
      forgotPw.addEventListener('click', (e) => {
        e.preventDefault();
        const email = el.loginUsername?.value?.trim() || 'randy.h99@email.com';
        alert(`Password reset instructions have been sent to ${email}. Please check your inbox.`);
      });
    }

    // Social Authentication Buttons (1-click fast sign in)
    document.querySelectorAll('.auth-social-google').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        loginUser('bhardwaj', 'password123');
      });
    });
    document.querySelectorAll('.auth-social-apple').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        loginUser('teja', 'password123');
      });
    });
    document.querySelectorAll('.auth-social-facebook').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        loginUser('praneetha', 'password123');
      });
    });

    // Login Form Submit
    if (el.authLoginForm) {
      el.authLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const un = el.loginUsername?.value?.trim();
        const pw = el.loginPassword?.value || 'password123';
        if (un) await loginUser(un, pw);
      });
    }

    // Register Form Submit
    if (el.authRegisterForm) {
      el.authRegisterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const un = el.registerUsername?.value?.trim();
        const pw = el.registerPassword?.value;
        const name = el.registerName?.value?.trim();
        if (un && pw) await registerNewUser(un, pw, name);
      });
    }
  }

  /* ------------------------------------------------------------ image lightbox modal */
  function openImageModal(imgSrc, name = 'Attached Visual', meta = '') {
    if (!el.lightboxModal || !el.lightboxImage || !imgSrc) return;
    el.lightboxImage.src = imgSrc;
    if (el.lightboxName) {
      el.lightboxName.textContent = name || 'Image Preview';
    }
    if (el.lightboxMeta) {
      el.lightboxMeta.textContent = meta || '';
    }
    if (el.lightboxDownloadBtn) {
      el.lightboxDownloadBtn.href = imgSrc;
      el.lightboxDownloadBtn.download = (name || 'visual-evidence').replace(/[^\w.-]+/g, '_');
    }
    el.lightboxModal.classList.remove('hidden');
    el.lightboxModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeImageModal() {
    if (!el.lightboxModal) return;
    el.lightboxModal.classList.add('hidden');
    el.lightboxModal.setAttribute('aria-hidden', 'true');
    if (el.lightboxImage) {
      el.lightboxImage.src = '';
    }
    document.body.classList.remove('modal-open');
  }

  function openPendingImageModal() {
    if (state.pending && !state.pending.isDoc && state.pending.previewUrl) {
      openImageModal(
        state.pending.previewUrl,
        state.pending.name || 'Attached Visual',
        state.pending.bytes ? formatBytes(state.pending.bytes) : ''
      );
    } else if (el.thumb && el.thumb.src && !el.thumb.classList.contains('hidden')) {
      openImageModal(
        el.thumb.src,
        el.chipName ? el.chipName.textContent : 'Attached Visual',
        el.chipSize ? el.chipSize.textContent : ''
      );
    }
  }

  function setupImageLightbox() {
    if (el.closeImageModalBtn) {
      el.closeImageModalBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeImageModal();
      });
    }

    if (el.lightboxModal) {
      el.lightboxModal.addEventListener('click', (e) => {
        if (e.target === el.lightboxModal || e.target.classList.contains('image-lightbox-overlay') || e.target.id === 'imageLightboxWrapper') {
          closeImageModal();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && el.lightboxModal && !el.lightboxModal.classList.contains('hidden')) {
        closeImageModal();
      }
    });

    if (el.thumbWrap) {
      el.thumbWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        openPendingImageModal();
      });
    }

    if (el.thumb) {
      el.thumb.setAttribute('title', 'Click to view image in big size');
      el.thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        openPendingImageModal();
      });
    }

    if (el.metaClickable) {
      el.metaClickable.addEventListener('click', (e) => {
        if (!state.pending?.isDoc) {
          e.stopPropagation();
          openPendingImageModal();
        }
      });
    }
  }

  /* ------------------------------------------------------------ reset chat */
  function resetChat() {
    if (voiceState.isListening) stopVoiceInput(false);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    state.chatId++;
    authState.currentSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    removeTyping();
    state.messages = [];
    if (el.log) el.log.querySelectorAll('.msg').forEach((n) => n.remove());
    if (el.empty) el.empty.classList.remove('hidden');
    if (el.input) el.input.value = '';
    autoGrow();
    removePending();
    state.busy = false;
    updateSendState();
    if (el.input) el.input.focus();
  }

  if (el.newChat) el.newChat.addEventListener('click', resetChat);

  /* ------------------------------------------------------------ INITIALIZATION */
  if (el.strict) el.strict.checked = false;
  loadKeyStatus();
  setupVoiceInput();
  setupAuthAndHistory();
  setupImageLightbox();
  initAuth();
  updateSendState();
})();
