'use strict';

// Active structure sub-view — mutated by bindStructure in app.js.
var currentSub = 'cards';

// OCP fix: dispatch table replaces the if/if/if chain in renderStructureBody.
// Adding a new sub-view = add one entry here, no editing of renderStructureBody.
var SUB_RENDERERS = {
  cards: function() { renderCards(); },
  sheet: function() { renderSheet(); },
  map:   function() { renderMap();   },
};

// ===== Reader =====

function renderReader() {
  var reader = $('#reader');
  if (!state.paragraphs.length) {
    reader.innerHTML = '<div class="reader-empty">Paste text in <code>Input</code> first, then come back here to mark.</div>';
    return;
  }
  reader.innerHTML = '';
  state.paragraphs.forEach(function(segs, pi) {
    var p = document.createElement('div');
    p.className  = 'para';
    p.dataset.p  = pi;
    var inner = '<span class="pnum">¶' + (pi + 1) + '</span>';
    segs.forEach(function(seg, si) {
      if (seg.tag) {
        inner += '<span class="tspan tg-' + cssTag(seg.tag) + '" data-p="' + pi + '" data-s="' + si + '" title="' + TAGS[seg.tag].name + ' — click to remove">' + escapeHtml(seg.text) + '<sup class="tlabel">' + seg.tag + '</sup></span>';
      } else {
        inner += '<span class="seg" data-p="' + pi + '" data-s="' + si + '">' + escapeHtml(seg.text) + '</span>';
      }
    });
    p.innerHTML = inner;
    reader.appendChild(p);
  });
}

// ===== Legend =====

function renderLegend() {
  var wrap   = $('#legend');
  wrap.innerHTML = '';
  var counts = countTags();
  var active = {};
  modeTags().forEach(function(t) { active[t] = true; });
  FAMILIES.forEach(function(fam) {
    var fkeys = Object.keys(TAGS).filter(function(t) { return TAGS[t].family === fam; });
    if (!fkeys.length) return;
    var sec = document.createElement('div');
    sec.className = 'fam';
    var fn = document.createElement('div');
    fn.className  = 'fam-name';
    fn.textContent = fam;
    sec.appendChild(fn);
    fkeys.forEach(function(t) {
      var row = document.createElement('div');
      row.className = 'lg-row tg-' + cssTag(t) + (active[t] ? '' : ' dim');
      row.innerHTML =
        '<span class="lk">' + t + '</span>' +
        '<span class="ld">' + TAGS[t].desc + '</span>' +
        '<span class="lc' + (counts[t] ? ' has' : '') + '">' + (counts[t] || 0) + '</span>';
      sec.appendChild(row);
    });
    wrap.appendChild(sec);
  });
}

// ===== Sessions list =====

function renderSessions() {
  var list = loadSessionsList();
  var wrap = $('#sessions');
  if (!list.length) {
    wrap.innerHTML = '<div style="color:var(--mute);font-size:.75rem">No saved sessions yet.</div>';
    return;
  }
  wrap.innerHTML = '';
  list.forEach(function(s) {
    var row  = document.createElement('div');
    row.className = 'sess';
    var dt   = new Date(s.savedAt);
    var time = dt.toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    row.innerHTML =
      '<div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
        '<div>' + escapeHtml(s.title || 'Untitled') + '</div>' +
        '<div class="sess-meta">' + time + '</div>' +
      '</div>';
    row.addEventListener('click', function(e) {
      if (e.target.classList.contains('sess-x')) return;
      loadIntoState(s.id);
    });
    var x = document.createElement('button');
    x.className  = 'sess-x';
    x.textContent = '×';
    x.title = 'Delete';
    x.addEventListener('click', function(e) {
      e.stopPropagation();
      if (confirm('Delete "' + (s.title || 'Untitled') + '"?')) {
        deleteSessionData(s.id);
        renderSessions();
      }
    });
    row.appendChild(x);
    wrap.appendChild(row);
  });
}

// ===== Export =====
// SRP fix: renderExport no longer calls renderLegend as a side effect.
// The caller (selectTab) is responsible for refreshing the legend.

function renderExport() {
  $('#export-md').textContent   = buildMarkdown();
  $('#export-json').textContent = buildJson();
}

// ===== Structure =====

function renderStructure() {
  var total = state.paragraphs.reduce(function(n, segs) {
    return n + segs.filter(function(s) { return s.tag; }).length;
  }, 0);
  $('#struct-meta').textContent = state.paragraphs.length
    ? state.paragraphs.length + ' paragraphs · ' + total + ' tagged spans · Mode ' + state.mode
    : '';
  renderStructureBody();
}

function renderStructureBody() {
  var empty = !state.paragraphs.length || state.paragraphs.every(function(segs) {
    return !segs.some(function(s) { return s.tag; });
  });
  if (empty) {
    var msg = '<div class="struct-empty">Mark some text in <code>Mark</code> first.<br>Then come back here to see the structure.</div>';
    $('#sub-cards').innerHTML = msg;
    $('#sub-sheet').innerHTML = msg;
    $('#sub-map').innerHTML   = msg;
    return;
  }
  if (SUB_RENDERERS[currentSub]) SUB_RENDERERS[currentSub]();
}

// ===== Cards =====

function renderCards() {
  var wrap = $('#sub-cards');
  wrap.innerHTML = '';
  state.paragraphs.forEach(function(segs, pi) {
    var tagged = segs.filter(function(s) { return s.tag; });
    if (!tagged.length) return;

    var counts = {};
    tagged.forEach(function(s) { counts[s.tag] = (counts[s.tag] || 0) + 1; });
    var tally = Object.keys(counts).map(function(t) {
      return '<span class="pchip tg-' + cssTag(t) + '" style="color:var(--t-' + cssTag(t) + ')">' + t + '·' + counts[t] + '</span>';
    }).join('');

    var inline = segs.map(function(s) {
      return s.tag
        ? '<span class="tspan tg-' + cssTag(s.tag) + '">' + escapeHtml(s.text) + '<sup class="tlabel">' + s.tag + '</sup></span>'
        : escapeHtml(s.text);
    }).join('');

    var groupHtml = CARD_GROUPS.map(function(g) {
      var items = tagged.filter(function(s) { return g.tags.indexOf(s.tag) !== -1; });
      if (!items.length) return '';
      var lis = items.map(function(s) {
        return '<li><span class="li-tag tg-' + cssTag(s.tag) + '">' + s.tag + '</span><span class="li-text">' + escapeHtml(s.text.trim()) + '</span></li>';
      }).join('');
      return '<div class="scard-grp"><div class="scard-grp-h">' + g.label + '</div><ul>' + lis + '</ul></div>';
    }).join('');

    var card = document.createElement('div');
    card.className = 'scard';
    card.innerHTML =
      '<div class="scard-head"><span class="pid">¶' + (pi + 1) + '</span><div class="ptally">' + tally + '</div></div>' +
      '<div class="scard-text">' + inline + '</div>' +
      '<div class="scard-body">' + (groupHtml || '<div class="scard-empty">No structured tags in this paragraph.</div>') + '</div>';
    wrap.appendChild(card);
  });
  if (!wrap.children.length) {
    wrap.innerHTML = '<div class="struct-empty">Tagged paragraphs will appear here as cards.</div>';
  }
}

// ===== Sheet =====

function renderSheet() {
  var wrap  = $('#sub-sheet');
  wrap.innerHTML = '';
  var items = [];
  state.paragraphs.forEach(function(segs, pi) {
    segs.forEach(function(s) { if (s.tag) items.push({ tag: s.tag, text: s.text, pi: pi }); });
  });
  if (!items.length) {
    wrap.innerHTML = '<div class="struct-empty">No tagged spans yet.</div>';
    return;
  }
  FAMILIES.forEach(function(fam) {
    var tagsInFam = Object.keys(TAGS).filter(function(t) { return TAGS[t].family === fam; });
    var famItems  = items.filter(function(it) { return tagsInFam.indexOf(it.tag) !== -1; });
    if (!famItems.length) return;
    var grp = document.createElement('div');
    grp.className = 'sheet-grp';
    var html = '<div class="sheet-fam">' + fam + '</div>';
    tagsInFam.forEach(function(t) {
      var list = famItems.filter(function(it) { return it.tag === t; });
      if (!list.length) return;
      var rows = list.map(function(it) {
        return '<li><span class="pref">¶' + (it.pi + 1) + '</span><span class="ptxt">' + escapeHtml(it.text.trim()) + '</span></li>';
      }).join('');
      html +=
        '<div class="sheet-tag">' +
          '<div class="sheet-tag-h">' +
            '<span class="tk tg-' + cssTag(t) + '">' + t + '</span>' +
            '<span class="tn">' + TAGS[t].name + '</span>' +
            '<span class="td">' + TAGS[t].desc + '</span>' +
            '<span class="tc">' + list.length + '</span>' +
          '</div>' +
          '<ul class="sheet-list">' + rows + '</ul>' +
        '</div>';
    });
    grp.innerHTML = html;
    wrap.appendChild(grp);
  });
}

// ===== Map =====

function renderMap() {
  var wrap = $('#sub-map');
  wrap.innerHTML = '';

  var norm = function(s) {
    return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?"']+$/, '');
  };

  // Build nodes from Def-tagged spans (deduped by normalised text).
  var nodeMap = new Map();
  state.paragraphs.forEach(function(segs, pi) {
    segs.forEach(function(s) {
      if (s.tag !== 'Def') return;
      var key = norm(s.text);
      if (!key) return;
      if (!nodeMap.has(key)) nodeMap.set(key, { key: key, label: s.text.trim(), paras: new Set(), count: 0 });
      var n = nodeMap.get(key);
      n.paras.add(pi);
      n.count += 1;
    });
  });
  var nodes = Array.from(nodeMap.values());

  // Build edges: two Defs share an edge when they co-occur in the same paragraph.
  var edgeMap = new Map();
  state.paragraphs.forEach(function(segs, pi) {
    var here = Array.from(new Set(
      segs.filter(function(s) { return s.tag === 'Def'; }).map(function(s) { return norm(s.text); })
    )).filter(Boolean);
    for (var i = 0; i < here.length; i++) {
      for (var j = i + 1; j < here.length; j++) {
        var pair = [here[i], here[j]].sort();
        var k    = pair[0] + '||' + pair[1];
        if (!edgeMap.has(k)) edgeMap.set(k, { a: pair[0], b: pair[1], weight: 0, paras: new Set() });
        var e = edgeMap.get(k);
        e.weight += 1;
        e.paras.add(pi);
      }
    }
  });
  var edges = Array.from(edgeMap.values());

  // Circle layout.
  var W    = Math.max(wrap.clientWidth || 700, 520);
  var H    = Math.max(360, 80 + nodes.length * 22);
  var cx   = W / 2;
  var cy   = H / 2;
  var ringR = Math.min(W, H) / 2 - 60;
  nodes.forEach(function(n, i) {
    if (nodes.length === 1) { n.x = cx; n.y = cy; }
    else {
      var a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      n.x = cx + Math.cos(a) * ringR;
      n.y = cy + Math.sin(a) * ringR;
    }
  });
  var byKey = new Map(nodes.map(function(n) { return [n.key, n]; }));

  var mapWrap = document.createElement('div');
  mapWrap.className = 'map-wrap';
  mapWrap.style.minHeight = (H + 20) + 'px';

  if (!nodes.length) {
    mapWrap.innerHTML = '<div class="struct-empty" style="margin:80px 20px">No <code>Def</code> tags yet — the map shows definitions as nodes connected when they share a paragraph.</div>';
  } else {
    var maxW    = edges.reduce(function(m, e) { return Math.max(m, e.weight); }, 1);
    var edgeSvg = edges.map(function(e) {
      var a = byKey.get(e.a), b = byKey.get(e.b);
      if (!a || !b) return '';
      var thick = e.weight > 1 ? 'thick' : '';
      var sw    = 1 + (e.weight / maxW) * 2.5;
      return '<line class="map-edge ' + thick + '" x1="' + a.x.toFixed(1) + '" y1="' + a.y.toFixed(1) + '" x2="' + b.x.toFixed(1) + '" y2="' + b.y.toFixed(1) + '" stroke-width="' + sw.toFixed(2) + '"><title>shares ' + e.weight + ' paragraph(s): ' + Array.from(e.paras).map(function(p) { return '¶' + (p + 1); }).join(', ') + '</title></line>';
    }).join('');
    var nodeSvg = nodes.map(function(n) {
      var label = truncate(n.label, 22);
      var w     = Math.max(70, label.length * 7 + 16);
      var h     = 28;
      return '<g class="map-node" transform="translate(' + (n.x - w / 2).toFixed(1) + ',' + (n.y - h / 2).toFixed(1) + ')"><rect width="' + w + '" height="' + h + '"></rect><title>' + escapeHtml(n.label) + ' — appears in ' + n.paras.size + ' paragraph(s) (' + Array.from(n.paras).map(function(p) { return '¶' + (p + 1); }).join(', ') + ')</title><text x="' + (w / 2) + '" y="' + (h / 2) + '">' + escapeHtml(label) + '</text></g>';
    }).join('');
    mapWrap.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '"><g>' + edgeSvg + '</g><g>' + nodeSvg + '</g></svg>' +
      '<div class="map-legend"><strong>Concept map</strong><br>Nodes = <span style="color:var(--t-Def)">Def</span> tags (deduped).<br>Edges = two definitions share a paragraph. Thicker = more co-occurrences.</div>';
  }
  wrap.appendChild(mapWrap);

  // Side bins: non-Def structural/execution tags.
  var BIN_KEYS = ['R','C','B','L','T','X','Assump','Q','A','M'];
  var bins = {};
  BIN_KEYS.forEach(function(k) { bins[k] = []; });
  state.paragraphs.forEach(function(segs, pi) {
    segs.forEach(function(s) { if (s.tag && bins[s.tag]) bins[s.tag].push({ pi: pi, text: s.text.trim() }); });
  });
  var side = document.createElement('div');
  side.className = 'map-side';
  BIN_KEYS.forEach(function(k) {
    var items = bins[k];
    if (!items.length) return;
    var lis = items.map(function(it) {
      return '<li><span class="pp">¶' + (it.pi + 1) + '</span>' + escapeHtml(it.text) + '</li>';
    }).join('');
    var div = document.createElement('div');
    div.className = 'map-bin b-' + cssTag(k);
    div.innerHTML =
      '<div class="map-bin-h"><span>' + k + ' · ' + TAGS[k].name + '</span><span class="mc">' + items.length + '</span></div>' +
      '<ul>' + lis + '</ul>';
    side.appendChild(div);
  });
  if (side.children.length) wrap.appendChild(side);
}
