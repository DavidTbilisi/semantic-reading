'use strict';

var TAB_ORDER  = ['input', 'mark', 'structure', 'export'];
var THEME_KEY  = 'sr_marker_theme';

// Module-level selection context.
// Replaces the previous bar._paraEl DOM-attribute hack (DI / hidden-state fix).
var activePara = null;

// ===== Theme =====

function loadTheme() {
  var t = localStorage.getItem(THEME_KEY);
  if (t !== 'dark' && t !== 'light') {
    t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  applyTheme(t);
}

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  if (document.body) document.body.setAttribute('data-theme', t);
  localStorage.setItem(THEME_KEY, t);
  var btn = $('#btn-theme');
  if (btn) btn.textContent = (t === 'dark') ? 'Light' : 'Dark';
}

function bindTheme() {
  $('#btn-theme').addEventListener('click', function() {
    var cur = document.body.dataset.theme === 'dark' ? 'dark' : 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
}

// ===== Mode =====

function modeTags() { return MODES[state.mode].tags; }

function setMode(m) {
  state.mode = m;
  $$('.mode-btn').forEach(function(b) { b.classList.toggle('active', Number(b.dataset.mode) === m); });
  $('#mode-desc').textContent        = MODES[m].desc;
  $('#active-mode-name').textContent = MODES[m].name;
  renderLegend();
}

function bindModeBar() {
  $$('.mode-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { setMode(Number(btn.dataset.mode)); });
  });
}

// ===== Tabs =====

function currentTab() {
  return TAB_ORDER.find(function(t) {
    return $('#pane-' + t) && !$('#pane-' + t).classList.contains('hidden');
  }) || 'input';
}

function stepTab(dir) {
  var i = TAB_ORDER.indexOf(currentTab());
  var j = Math.max(0, Math.min(TAB_ORDER.length - 1, i + dir));
  if (j !== i) selectTab(TAB_ORDER[j]);
}

function selectTab(name) {
  $$('.tab').forEach(function(t) { t.classList.toggle('active', t.dataset.tab === name); });
  $$('.pane').forEach(function(p) { p.classList.add('hidden'); });
  $('#pane-' + name).classList.remove('hidden');
  if (name === 'mark') {
    syncFromInputIfNeeded();
    renderReader();
  }
  if (name === 'structure') {
    syncFromInputIfNeeded();
    renderStructure();
  }
  if (name === 'export') {
    // SRP fix: legend refresh is the caller's job, not renderExport's.
    renderLegend();
    renderExport();
  }
}

function bindTabs() {
  $$('.tab').forEach(function(t) {
    t.addEventListener('click', function() { selectTab(t.dataset.tab); });
  });
}

// ===== Session operations =====

// Syncs the two DOM inputs from state (title field + textarea).
function syncDOMFromState() {
  $('#title').value      = state.title;
  $('#input-text').value = state.rawText;
}

// Resets state and DOM to a blank session.
// The user-confirmation guard lives in the button handler, not here.
function newSession(switchToInput) {
  resetState();
  syncDOMFromState();
  setMode(3);
  renderReader();
  renderExport();
  if (switchToInput) selectTab('input');
}

// Loads a saved session by id into state + DOM, then switches to Mark.
function loadIntoState(id) {
  var session = loadSession(id);
  if (!session) return;
  applySessionToState(session);
  syncDOMFromState();
  setMode(state.mode);
  renderReader();
  renderExport();
  selectTab('mark');
}

// Loads the built-in demo into state + DOM.
function loadDemo(switchToStructure) {
  resetState();
  state.title      = DEMO.title;
  state.mode       = DEMO.mode;
  state.paragraphs = DEMO.paragraphs.map(function(p) { return buildSegments(p.text, p.marks); });
  state.rawText    = DEMO.paragraphs.map(function(p) { return p.text; }).join('\n\n');
  syncDOMFromState();
  setMode(state.mode);
  renderReader();
  renderExport();
  if (switchToStructure !== false) selectTab('structure');
}

// Persists the current session: build data → write storage → refresh UI.
// SRP fix: each step is now a named, single-purpose call.
function persistSession() {
  var data = buildSessionData();
  writeSession(data);
  renderSessions();
  toast('Saved');
}

// ===== Topbar =====

function bindTopbar() {
  $('#title').addEventListener('input', function(e) { state.title = e.target.value; });
  $('#btn-new').addEventListener('click', function() {
    if (state.paragraphs.length && !confirm('Start a new session? Unsaved changes will be lost.')) return;
    newSession(true);
  });
  $('#btn-demo').addEventListener('click', function() {
    if (state.paragraphs.length && !confirm('Replace current text with the demo example?')) return;
    loadDemo(true);
  });
  $('#btn-save').addEventListener('click', persistSession);
}

// ===== Input area =====

function bindInputArea() {
  var ta = $('#input-text');
  ta.addEventListener('blur',  function()  { syncFromInputIfNeeded(); });
  ta.addEventListener('input', function()  { state.rawText = ta.value; });
}

// ===== Reader (click to remove tags) =====

function bindReader() {
  var reader = $('#reader');
  reader.addEventListener('mouseup', handleSelection);
  reader.addEventListener('keyup',   handleSelection);
  reader.addEventListener('click', function(e) {
    var span = e.target.closest('.tspan');
    if (span && !window.getSelection().toString()) {
      removeTagAt(Number(span.dataset.p), Number(span.dataset.s));
      renderReader();
      hideTagbar();
    }
  });
}

// ===== Tagbar =====

function handleSelection() {
  var sel = window.getSelection();
  if (!sel || sel.isCollapsed) { hideTagbar(); return; }
  var range = sel.getRangeAt(0);
  if (range.collapsed)         { hideTagbar(); return; }
  var para = nodeAncestorMatching(range.commonAncestorContainer, function(n) {
    return n.classList && n.classList.contains('para');
  });
  if (!para) { hideTagbar(); return; }
  activePara = para;
  var rect = range.getBoundingClientRect();
  showTagbar(rect.left + window.scrollX, rect.bottom + window.scrollY + 6);
}

function showTagbar(x, y) {
  var bar  = $('#tagbar');
  bar.innerHTML = '';
  var tags    = modeTags();
  var ordered = [];
  FAMILIES.forEach(function(fam) {
    Object.keys(TAGS).forEach(function(t) {
      if (TAGS[t].family === fam && tags.indexOf(t) !== -1) ordered.push(t);
    });
  });
  ordered.forEach(function(t, idx) {
    if (idx > 0 && TAGS[t].family !== TAGS[ordered[idx - 1]].family) {
      var sep = document.createElement('div');
      sep.className = 'tagbar-sep';
      bar.appendChild(sep);
    }
    var btn = document.createElement('button');
    btn.className  = 'tagbar-btn tg-' + cssTag(t);
    btn.textContent = t;
    btn.title = TAGS[t].name + ' — ' + TAGS[t].desc;
    btn.addEventListener('mousedown', function(e) { e.preventDefault(); });
    btn.addEventListener('click',     function(e) { e.preventDefault(); applyTagToSelection(t); });
    bar.appendChild(btn);
  });
  bar.classList.remove('hidden');
  bar.style.left = '0px';
  bar.style.top  = '0px';
  var w  = bar.offsetWidth;
  var vw = window.innerWidth;
  var lx = Math.min(x, vw - w - 12);
  if (lx < 8) lx = 8;
  bar.style.left = lx + 'px';
  bar.style.top  = y  + 'px';
}

function hideTagbar() {
  activePara = null;
  $('#tagbar').classList.add('hidden');
}

function applyTagToSelection(tag) {
  var sel = window.getSelection();
  if (!sel || sel.isCollapsed) { hideTagbar(); return; }
  var range = sel.getRangeAt(0);
  var para  = nodeAncestorMatching(range.commonAncestorContainer, function(n) {
    return n.classList && n.classList.contains('para');
  });
  if (!para) { hideTagbar(); return; }
  var pi     = Number(para.dataset.p);
  var range2 = document.createRange();
  range2.selectNodeContents(para);
  range2.setEnd(range.startContainer, range.startOffset);
  var pnumLen   = paraNumberPrefixLength(para);
  var startChar = textLengthInRange(range2) - pnumLen;
  range2.setEnd(range.endContainer, range.endOffset);
  var endChar = textLengthInRange(range2) - pnumLen;
  if (startChar > endChar) { var tmp = startChar; startChar = endChar; endChar = tmp; }
  if (startChar < 0) startChar = 0;
  if (endChar <= startChar) { hideTagbar(); return; }
  applyTagRange(pi, startChar, endChar, tag);
  sel.removeAllRanges();
  hideTagbar();
  renderReader();
}

function paraNumberPrefixLength(paraEl) {
  var pn = paraEl.querySelector('.pnum');
  return pn ? pn.textContent.length : 0;
}

function textLengthInRange(range) {
  var frag = range.cloneContents();
  frag.querySelectorAll('.tlabel').forEach(function(el) { el.remove(); });
  return frag.textContent.length;
}

function nodeAncestorMatching(node, pred) {
  while (node) {
    if (node.nodeType === 1 && pred(node)) return node;
    node = node.parentNode;
  }
  return null;
}

// ===== Structure sub-view tabs =====

function bindStructure() {
  $$('.sub-tab').forEach(function(b) {
    b.addEventListener('click', function() {
      currentSub = b.dataset.sub;
      $$('.sub-tab').forEach(function(x) { x.classList.toggle('active', x.dataset.sub === currentSub); });
      $$('.sub-view').forEach(function(v) { v.classList.add('hidden'); });
      $('#sub-' + currentSub).classList.remove('hidden');
      renderStructureBody();
    });
  });
}

// ===== Export buttons =====

function bindExportButtons() {
  $('#btn-copy-md').addEventListener('click',      function() { copy($('#export-md').textContent, 'Markdown copied'); });
  $('#btn-copy-json').addEventListener('click',    function() { copy($('#export-json').textContent, 'JSON copied'); });
  $('#btn-download-md').addEventListener('click',  function() { download(safeName(state.title) + '.md',   $('#export-md').textContent); });
  $('#btn-download-json').addEventListener('click',function() { download(safeName(state.title) + '.json', $('#export-json').textContent); });
}

// ===== Keyboard =====

function bindKeyboard() {
  document.addEventListener('keydown', function(e) {
    var inField = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

    // Ctrl/Cmd+S works everywhere.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      persistSession();
      return;
    }

    if (inField) return;

    var sel    = window.getSelection();
    var hasSel = sel && !sel.isCollapsed;

    if (hasSel) {
      var tag = tagForKey(e.key);
      if (tag && modeTags().indexOf(tag) !== -1) {
        e.preventDefault();
        applyTagToSelection(tag);
        return;
      }
    }

    if (e.key === 'Escape') {
      if (sel) sel.removeAllRanges();
      hideTagbar();
      return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey && !hasSel) {
      if (/^[1-4]$/.test(e.key)) {
        e.preventDefault();
        selectTab(TAB_ORDER[Number(e.key) - 1]);
        return;
      }
      if (e.key === 'ArrowRight') { e.preventDefault(); stepTab(1);  return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); stepTab(-1); return; }
    }
  });
}

// ===== Boot =====

function init() {
  loadTheme();
  bindTopbar();
  bindModeBar();
  bindTabs();
  bindInputArea();
  bindReader();
  bindKeyboard();
  bindStructure();
  bindExportButtons();
  bindTheme();

  setMode(state.mode);
  renderLegend();
  renderSessions();

  if (loadSessionsList().length === 0) {
    loadDemo(true);
  } else {
    newSession(false);
  }
}
