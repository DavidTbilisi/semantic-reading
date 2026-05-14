'use strict';

// Pure segment-manipulation functions. All operate on state.paragraphs
// or return new arrays — no DOM access.

// Builds a segment array from plain text by splitting on each mark's literal text.
function buildSegments(text, marks) {
  var segs = [{ text: text }];
  for (var mi = 0; mi < marks.length; mi++) {
    var m = marks[mi];
    for (var i = 0; i < segs.length; i++) {
      var s   = segs[i];
      if (s.tag) continue;
      var idx = s.text.indexOf(m.text);
      if (idx === -1) continue;
      var before = s.text.slice(0, idx);
      var middle = s.text.slice(idx, idx + m.text.length);
      var after  = s.text.slice(idx + m.text.length);
      var repl   = [];
      if (before) repl.push({ text: before });
      repl.push({ text: middle, tag: m.tag });
      if (after)  repl.push({ text: after });
      segs.splice(i, 1, repl[0], repl[1], repl[2] !== undefined ? repl[2] : null);
      segs = segs.filter(Boolean);
      break;
    }
  }
  return segs;
}

// Applies a tag to character range [startChar, endChar) within paragraph pi.
function applyTagRange(pi, startChar, endChar, tag) {
  var segs = state.paragraphs[pi];
  var out  = [];
  var pos  = 0;
  for (var i = 0; i < segs.length; i++) {
    var seg     = segs[i];
    var segStart = pos;
    var segEnd   = pos + seg.text.length;
    pos = segEnd;
    if (segEnd <= startChar || segStart >= endChar) {
      out.push(seg);
      continue;
    }
    var a      = Math.max(startChar, segStart);
    var b      = Math.min(endChar, segEnd);
    var before = seg.text.slice(0, a - segStart);
    var middle = seg.text.slice(a - segStart, b - segStart);
    var after  = seg.text.slice(b - segStart);
    if (before) { var bs = { text: before }; if (seg.tag) bs.tag = seg.tag; out.push(bs); }
    if (middle) { out.push({ text: middle, tag: tag }); }
    if (after)  { var as_ = { text: after };  if (seg.tag) as_.tag = seg.tag; out.push(as_); }
  }
  state.paragraphs[pi] = mergeAdjacent(out);
}

// Removes the tag (and any note) from segment si in paragraph pi.
function removeTagAt(pi, si) {
  var segs = state.paragraphs[pi];
  if (!segs[si]) return;
  delete segs[si].tag;
  delete segs[si].note;
  state.paragraphs[pi] = mergeAdjacent(segs);
}

// Merges adjacent segments that share the same tag (or both untagged).
// Invariant: this is called after every mutation so the array stays normalised.
function mergeAdjacent(segs) {
  var out = [];
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    if (!s.text) continue;
    var prev = out[out.length - 1];
    if (prev && (prev.tag || null) === (s.tag || null) && (prev.note || '') === (s.note || '')) {
      prev.text += s.text;
    } else {
      out.push(Object.assign({}, s));
    }
  }
  return out;
}
