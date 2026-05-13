'use strict';

// Pure data builders — no DOM access, no state mutation.

function countTags() {
  var c = {};
  state.paragraphs.forEach(function(segs) {
    segs.forEach(function(s) {
      if (s.tag) c[s.tag] = (c[s.tag] || 0) + 1;
    });
  });
  return c;
}

function buildMarkdown() {
  var lines  = [];
  var counts = countTags();
  var used   = Object.keys(counts);
  lines.push('# ' + (state.title || 'Untitled'));
  lines.push('');
  lines.push('**Mode**: ' + state.mode + ' · ' + MODES[state.mode].name + ' — ' + MODES[state.mode].desc);
  if (used.length) {
    lines.push('');
    lines.push('**Tag counts**: ' + used.map(function(t) { return t + '=' + counts[t]; }).join(', '));
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  state.paragraphs.forEach(function(segs, pi) {
    var parts = segs.map(function(s) { return s.tag ? '[' + s.tag + ': ' + s.text + ']' : s.text; });
    lines.push('**¶' + (pi + 1) + '.** ' + parts.join(''));
    lines.push('');
    var extracts = segs.filter(function(s) { return s.tag; });
    if (extracts.length) {
      extracts.forEach(function(s) {
        lines.push('- **' + s.tag + '** (' + TAGS[s.tag].name + ') — ' + s.text.trim());
      });
      lines.push('');
    }
  });
  return lines.join('\n');
}

function buildJson() {
  return JSON.stringify({
    title:      state.title,
    mode:       state.mode,
    paragraphs: state.paragraphs,
    counts:     countTags(),
  }, null, 2);
}
