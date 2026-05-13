'use strict';

function $(sel)  { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }

function cssTag(t) {
  return t.replace(/[^A-Za-z0-9]/g, '');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}

function truncate(s, n) {
  s = s.replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function safeName(s) {
  return (s || 'session').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'session';
}

function tagForKey(key) {
  var map = { d:'Def', q:'Q', r:'R', m:'M', a:'A', c:'C', b:'B', l:'L', t:'T', x:'X', n:'N', p:'P', w:'D', s:'Assump' };
  return map[key.toLowerCase()] || null;
}

function toast(msg) {
  var t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function() { t.remove(); }, 1800);
}

function copy(text, msg) {
  navigator.clipboard.writeText(text).then(function() { toast(msg || 'Copied'); });
}

function download(name, text) {
  var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
}
