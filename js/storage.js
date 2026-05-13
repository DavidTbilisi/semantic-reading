'use strict';

var SESSIONS_KEY   = 'sr_marker_sessions';
var SESSION_PREFIX = 'sr_marker_session_';

// --- Pure read/write (no UI side effects) ---

function loadSessionsList() {
  try { return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]'); }
  catch (_) { return []; }
}

function saveSessionsList(list) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(list));
}

function loadSession(id) {
  try { return JSON.parse(localStorage.getItem(SESSION_PREFIX + id)); }
  catch (_) { return null; }
}

// Assigns a new id to state if it has none, then returns the serialisable snapshot.
function buildSessionData() {
  if (!state.id) {
    state.id = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  return {
    id:         state.id,
    title:      state.title,
    mode:       state.mode,
    paragraphs: state.paragraphs,
    rawText:    state.rawText,
    savedAt:    new Date().toISOString(),
  };
}

// Writes one session to storage and updates the index. No UI calls.
function writeSession(data) {
  localStorage.setItem(SESSION_PREFIX + data.id, JSON.stringify(data));
  var list = loadSessionsList().filter(function(s) { return s.id !== data.id; });
  list.unshift({ id: data.id, title: data.title || 'Untitled', savedAt: data.savedAt });
  saveSessionsList(list.slice(0, 50));
}

// Removes a session from storage and updates the index. No UI calls.
function deleteSessionData(id) {
  localStorage.removeItem(SESSION_PREFIX + id);
  saveSessionsList(loadSessionsList().filter(function(s) { return s.id !== id; }));
}
