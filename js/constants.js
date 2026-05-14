'use strict';

// All top-level declarations use var so they are accessible across script files
// (let/const at script level do not become window properties in non-module scripts).

// `parent`: the tag this one specialises. Children inherit family from parent
// and are rendered indented beneath the parent in legend / tagbar / cards.
// `route`: downstream encoding framework (Neural OS Encoding Spine).
//   NEDF   — concept identity / definitions
//   CAST   — claim graphs / relations / time / place
//   SPEAR  — procedures / mechanisms / constraints
//   HEART  — people
//   ORACLE — measurement / prediction
//   GRACE  — social-pragmatic (currently unused; reserved)
//   '*'    — cross-cutting (routes to all relevant frameworks)
var TAGS = {
  N:      { name: 'Name',          family: 'Anchor',    desc: 'people / things / titles',                    route: 'HEART' },
  D:      { name: 'Date',          family: 'Anchor',    desc: 'when something happened',                     route: 'CAST'  },
  P:      { name: 'Place',         family: 'Anchor',    desc: 'where something happened',                    route: 'CAST'  },
  Def:    { name: 'Definition',    family: 'Meaning',   desc: 'concept identity',                            route: 'NEDF'  },
  Mn:     { name: 'Meaning',       family: 'Meaning',   desc: 'what the concept means here',                 route: 'NEDF', parent: 'Def' },
  Ex:     { name: 'Example',       family: 'Meaning',   desc: 'concrete instance of a concept',              route: 'NEDF', parent: 'Def' },
  An:     { name: 'Analogy',       family: 'Meaning',   desc: 'comparison that clarifies',                   route: 'NEDF', parent: 'Def' },
  Q:      { name: 'Question',      family: 'Meaning',   desc: 'what is unclear',                             route: '*'     },
  R:      { name: 'Relation',      family: 'Structure', desc: 'X causes / supports / depends on Y',          route: 'CAST'  },
  Ev:     { name: 'Evidence',      family: 'Structure', desc: 'data / case that supports a relation',        route: 'CAST', parent: 'R' },
  C:      { name: 'Constraint',    family: 'Structure', desc: 'limit on the system',                         route: 'SPEAR' },
  B:      { name: 'Bottleneck',    family: 'Structure', desc: 'choke point',                                 route: 'SPEAR' },
  L:      { name: 'Delay',         family: 'Structure', desc: 'effect appears later',                        route: 'CAST'  },
  T:      { name: 'Tradeoff',      family: 'Structure', desc: 'gain X vs lose Y',                            route: 'CAST'  },
  X:      { name: 'Tension',       family: 'Structure', desc: 'contradiction or conflict',                   route: 'CAST'  },
  Opp:    { name: 'Opposite view', family: 'Structure', desc: 'alternative / opposing stance',               route: 'CAST', parent: 'X' },
  Assump: { name: 'Assumption',    family: 'Structure', desc: 'unstated requirement',                        route: 'CAST'  },
  A:      { name: 'Action',        family: 'Execution', desc: 'what to do (method / procedure step)',        route: 'SPEAR' },
  M:      { name: 'Measure',       family: 'Execution', desc: 'how to know it worked (signal / prediction)', route: 'ORACLE'},
};

var FRAMEWORKS = {
  NEDF:   { name: 'NEDF',   desc: 'concepts'           },
  CAST:   { name: 'CAST',   desc: 'graphs / relations' },
  SPEAR:  { name: 'SPEAR',  desc: 'procedures'         },
  HEART:  { name: 'HEART',  desc: 'people'             },
  ORACLE: { name: 'ORACLE', desc: 'prediction'         },
  GRACE:  { name: 'GRACE',  desc: 'social-pragmatic'   },
};
var FRAMEWORK_ORDER = ['NEDF', 'CAST', 'SPEAR', 'HEART', 'ORACLE', 'GRACE'];

var MODES = {
  1: { name: 'Easy',         desc: 'stop reading passively, surface obvious anchors',  tags: ['Def','Ex','A','Q','N','D','P'] },
  2: { name: 'Functional',   desc: 'separate information by role, not just content',   tags: ['Def','Ex','R','Ev','A','Q','M'] },
  3: { name: 'Structural',   desc: 'make local structure visible',                     tags: ['Def','Mn','Ex','An','R','Ev','A','Q','M','C','B','L'] },
  4: { name: 'Systems',      desc: 'perceive the structure the author does not state', tags: ['Def','Mn','Ex','An','R','Ev','A','Q','M','C','B','L','Assump','X','Opp','T'] },
  5: { name: 'Regenerative', desc: 'reconstruct the chapter from structure',           tags: ['Def','Mn','Ex','An','R','Ev','A','Q','M','C','B','L','Assump','X','Opp','T','N','D','P'] },
};

var FAMILIES = ['Anchor', 'Meaning', 'Structure', 'Execution'];

// Returns tag keys ordered so each parent is followed by its children.
// Used by legend, tagbar, and any view that wants hierarchy-respecting order.
function tagOrder(filterFn) {
  var keys = Object.keys(TAGS).filter(filterFn || function() { return true; });
  var present = {};
  keys.forEach(function(k) { present[k] = true; });
  var out = [];
  keys.forEach(function(k) {
    var t = TAGS[k];
    if (t.parent && present[t.parent]) return;
    out.push(k);
    keys.forEach(function(c) {
      if (TAGS[c].parent === k) out.push(c);
    });
  });
  return out;
}

var CARD_GROUPS = [
  { label: 'Concepts',               tags: ['Def','Mn','Ex','An'] },
  { label: 'Relations & evidence',   tags: ['R','Ev'] },
  { label: 'Limits & delays',        tags: ['C','B','L'] },
  { label: 'Tensions & assumptions', tags: ['T','X','Opp','Assump'] },
  { label: 'Questions',              tags: ['Q'] },
  { label: 'Actions',                tags: ['A'] },
  { label: 'Measures',               tags: ['M'] },
  { label: 'Anchors',                tags: ['N','D','P'] },
];

var DEMO = {
  title: 'Industrialization & urban health (Mode 3 demo)',
  mode: 3,
  paragraphs: [
    {
      text: 'Industrialization is the shift from craft and farm work to large-scale machine production in factories. Once factories scale, output per worker grows because machines amortize fixed cost across more units, which is what we mean by factory output. But the bottleneck shifts from labor to coordination — managers, supply chains, and energy distribution become the new limits.',
      marks: [
        { tag: 'Def', text: 'Industrialization' },
        { tag: 'R',   text: 'output per worker grows because machines amortize fixed cost across more units' },
        { tag: 'Def', text: 'factory output' },
        { tag: 'B',   text: 'coordination — managers, supply chains, and energy distribution become the new limits' },
      ],
    },
    {
      text: 'Urbanization is the migration of workers toward those factories. Cities grow faster than their sanitation infrastructure, housing, and transit can be built. Public health effects from this gap appear years after the population spike, because waterborne disease compounds slowly and infrastructure projects take a decade to complete.',
      marks: [
        { tag: 'Def', text: 'Urbanization' },
        { tag: 'C',   text: 'Cities grow faster than their sanitation infrastructure, housing, and transit can be built' },
        { tag: 'Def', text: 'sanitation infrastructure' },
        { tag: 'L',   text: 'Public health effects from this gap appear years after the population spike' },
      ],
    },
    {
      text: 'The standard explanation treats industrial growth as net progress, but this assumes the displaced costs — disease, pollution, fragmented communities — are not paid by the same people who collected the gains. In practice the cost is paid by the urban poor while the gain is collected by capital owners, which is the central tradeoff. Who bears the cost when growth outruns infrastructure?',
      marks: [
        { tag: 'X',      text: 'The standard explanation treats industrial growth as net progress' },
        { tag: 'Assump', text: 'the displaced costs — disease, pollution, fragmented communities — are not paid by the same people who collected the gains' },
        { tag: 'T',      text: 'the cost is paid by the urban poor while the gain is collected by capital owners' },
        { tag: 'Q',      text: 'Who bears the cost when growth outruns infrastructure?' },
      ],
    },
    {
      text: 'Sanitation infrastructure should be built before population peaks, not after, even when factory output growth is still accelerating. Measure success by under-five mortality and waterborne disease incidence, not GDP per capita alone.',
      marks: [
        { tag: 'Def', text: 'Sanitation infrastructure' },
        { tag: 'A',   text: 'should be built before population peaks, not after' },
        { tag: 'Def', text: 'factory output' },
        { tag: 'M',   text: 'under-five mortality and waterborne disease incidence' },
      ],
    },
  ],
};
