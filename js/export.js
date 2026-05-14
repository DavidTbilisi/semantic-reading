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

// Emits {tag, text, paragraph} for every tagged span, optionally filtered.
function flatExtracts(filterFn) {
  var out = [];
  state.paragraphs.forEach(function(segs, pi) {
    segs.forEach(function(s) {
      if (!s.tag) return;
      if (filterFn && !filterFn(s)) return;
      out.push({ tag: s.tag, name: TAGS[s.tag].name, text: s.text.trim(), paragraph: pi + 1 });
    });
  });
  return out;
}

// Buckets all tagged spans into the Neural OS encoding frameworks, by tag.route.
// Cross-cutting tags (route === '*') are duplicated into every framework that has at least one span.
function routeToFrameworks() {
  var buckets = {};
  FRAMEWORK_ORDER.forEach(function(f) { buckets[f] = []; });
  var crossCutting = [];

  state.paragraphs.forEach(function(segs, pi) {
    segs.forEach(function(s) {
      if (!s.tag) return;
      var route = TAGS[s.tag].route;
      var item  = { tag: s.tag, name: TAGS[s.tag].name, text: s.text.trim(), paragraph: pi + 1 };
      if (route === '*') crossCutting.push(item);
      else if (buckets[route]) buckets[route].push(item);
    });
  });

  if (crossCutting.length) {
    FRAMEWORK_ORDER.forEach(function(f) {
      if (buckets[f].length) buckets[f] = buckets[f].concat(crossCutting.map(function(x) {
        return Object.assign({}, x, { crossCutting: true });
      }));
    });
  }

  var out = {};
  FRAMEWORK_ORDER.forEach(function(f) {
    if (buckets[f].length) {
      out[f] = { name: FRAMEWORKS[f].name, desc: FRAMEWORKS[f].desc, items: buckets[f] };
    }
  });
  return out;
}

// RFC-4180 CSV field: wrap in quotes if it contains comma/quote/newline; double internal quotes.
function csvField(s) {
  s = String(s == null ? '' : s);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// Builds one CSV per framework. Returns { NEDF: 'csv text', CAST: '...', ... }.
// Header: Front, Back, Tags  (Anki's default "Basic" note type, plus tag column).
// Front = tagged span. Back = tag name + paragraph context.
// Tags = space-separated: framework, tag, paragraph.
function buildAnkiCsvs() {
  var paragraphTexts = state.paragraphs.map(function(segs) {
    return segs.map(function(s) { return s.text; }).join('');
  });
  var by = routeToFrameworks();
  var out = {};
  Object.keys(by).forEach(function(framework) {
    var rows = ['Front,Back,Tags'];
    by[framework].items.forEach(function(it) {
      var ctx   = (paragraphTexts[it.paragraph - 1] || '').trim();
      var front = it.text;
      var back  = it.name + ' — ¶' + it.paragraph + ': ' + ctx;
      var tags  = framework + ' ' + it.tag + ' p' + it.paragraph + (it.crossCutting ? ' cross-cutting' : '');
      rows.push([csvField(front), csvField(back), csvField(tags)].join(','));
    });
    out[framework] = rows.join('\r\n');
  });
  return out;
}

function buildJson() {
  return JSON.stringify({
    title:      state.title,
    mode:       state.mode,
    paragraphs: state.paragraphs,
    counts:     countTags(),
    encoding:   routeToFrameworks(),
  }, null, 2);
}
