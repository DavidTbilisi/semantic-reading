'use strict';

var state = {
  id:         null,
  title:      '',
  mode:       3,
  paragraphs: [],
  rawText:    '',
};

function applySessionToState(session) {
  state.id         = session.id;
  state.title      = session.title      || '';
  state.mode       = session.mode       || 3;
  state.paragraphs = session.paragraphs || [];
  state.rawText    = session.rawText    || '';
}

function resetState() {
  state.id         = null;
  state.title      = '';
  state.mode       = 3;
  state.paragraphs = [];
  state.rawText    = '';
}

function syncFromInputIfNeeded() {
  var ta   = $('#input-text');
  var text = ta.value;
  // Identical rawText means no re-parse needed — preserves existing tags.
  if (text === state.rawText && state.paragraphs.length) return;
  state.rawText = text;
  if (!text.trim()) {
    state.paragraphs = [];
    return;
  }
  var blocks = text.split(/\n\s*\n+/).map(function(b) { return b.trim(); }).filter(Boolean);
  state.paragraphs = blocks.map(function(b) { return [{ text: b }]; });
}
