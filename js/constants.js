'use strict';

// All top-level declarations use var so they are accessible across script files
// (let/const at script level do not become window properties in non-module scripts).

var TAGS = {
  N:      { name: 'Name',       family: 'Anchor',    desc: 'people / things / titles' },
  D:      { name: 'Date',       family: 'Anchor',    desc: 'when something happened' },
  P:      { name: 'Place',      family: 'Anchor',    desc: 'where something happened' },
  Def:    { name: 'Definition', family: 'Meaning',   desc: 'concept identity' },
  Q:      { name: 'Question',   family: 'Meaning',   desc: 'what is unclear' },
  R:      { name: 'Relation',   family: 'Structure', desc: 'X causes / supports / depends on Y' },
  C:      { name: 'Constraint', family: 'Structure', desc: 'limit on the system' },
  B:      { name: 'Bottleneck', family: 'Structure', desc: 'choke point' },
  L:      { name: 'Delay',      family: 'Structure', desc: 'effect appears later' },
  T:      { name: 'Tradeoff',   family: 'Structure', desc: 'gain X vs lose Y' },
  X:      { name: 'Tension',    family: 'Structure', desc: 'contradiction or conflict' },
  Assump: { name: 'Assumption', family: 'Structure', desc: 'unstated requirement' },
  A:      { name: 'Action',     family: 'Execution', desc: 'what to do' },
  M:      { name: 'Measure',    family: 'Execution', desc: 'how to know it worked' },
};

var MODES = {
  1: { name: 'Easy',         desc: 'stop reading passively, surface obvious anchors',  tags: ['Def','A','Q','N','D','P'] },
  2: { name: 'Functional',   desc: 'separate information by role, not just content',   tags: ['Def','R','A','Q','M'] },
  3: { name: 'Structural',   desc: 'make local structure visible',                     tags: ['Def','R','A','Q','M','C','B','L'] },
  4: { name: 'Systems',      desc: 'perceive the structure the author does not state', tags: ['Def','R','A','Q','M','C','B','L','Assump','X','T'] },
  5: { name: 'Regenerative', desc: 'reconstruct the chapter from structure',           tags: ['Def','R','A','Q','M','C','B','L','Assump','X','T','N','D','P'] },
};

var FAMILIES = ['Anchor', 'Meaning', 'Structure', 'Execution'];

var CARD_GROUPS = [
  { label: 'Concepts',               tags: ['Def'] },
  { label: 'Relations',              tags: ['R'] },
  { label: 'Limits & delays',        tags: ['C','B','L'] },
  { label: 'Tensions & assumptions', tags: ['T','X','Assump'] },
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
