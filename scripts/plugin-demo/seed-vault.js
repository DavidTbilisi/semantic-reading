'use strict';

// Creates a throwaway Obsidian vault that exercises every visible feature of
// the Semantic Reading plugin. Writes:
//   <VAULT>/.obsidian/...                — minimal config + plugin enabled
//   <VAULT>/.obsidian/plugins/semantic-reading/main.js, manifest.json, styles.css
//   <VAULT>/Notes/*.md                   — tagged prose using {{Tag|text}} syntax
//
// Idempotent: safe to call repeatedly, replaces existing content.

const fs   = require('fs');
const path = require('path');

const PLUGIN_REPO = path.resolve(__dirname, '..', '..', '..', 'obsidian-semantic-reading');
const PLUGIN_ID   = 'semantic-reading';

function rmIfExists(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function copy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function installPlugin(vault) {
  const dst = path.join(vault, '.obsidian', 'plugins', PLUGIN_ID);
  fs.mkdirSync(dst, { recursive: true });
  for (const file of ['main.js', 'manifest.json', 'styles.css']) {
    const src = path.join(PLUGIN_REPO, file);
    if (!fs.existsSync(src)) {
      throw new Error(`plugin file missing: ${src}. Run "npm run build" in ${PLUGIN_REPO} first.`);
    }
    copy(src, path.join(dst, file));
  }
}

function writeObsidianConfig(vault) {
  // Enable the plugin so it auto-loads when Obsidian opens this vault.
  write(path.join(vault, '.obsidian', 'community-plugins.json'),
    JSON.stringify([PLUGIN_ID]));

  // Skip the "Restricted mode" first-run dialog. The `enable` of community
  // plugins on first launch normally requires explicit user opt-in via the
  // UI; the `safeMode: false` flag in app.json bypasses that for the demo
  // vault only (still scoped by our isolated --user-data-dir).
  write(path.join(vault, '.obsidian', 'app.json'),
    JSON.stringify({ promptDelete: false, alwaysUpdateLinks: true }, null, 2));

  // Workspace: open one note in the centre + leave the right sidebar empty
  // so we can open plugin views one at a time during capture.
  write(path.join(vault, '.obsidian', 'workspace.json'),
    JSON.stringify({
      main: {
        id: 'mainsplit',
        type: 'split',
        children: [{
          id: 'centerleaf',
          type: 'leaf',
          state: { type: 'markdown', state: { file: 'Notes/Industrialization.md', mode: 'source', source: false } },
        }],
        direction: 'horizontal',
      },
      left:  { id: 'left',  type: 'split', children: [], direction: 'horizontal', width: 240 },
      right: { id: 'right', type: 'split', children: [], direction: 'horizontal', width: 320 },
      active: 'centerleaf',
      lastOpenFiles: ['Notes/Industrialization.md'],
    }, null, 2));

  // Disable safe mode for this isolated vault so the plugin actually loads.
  // (Obsidian writes this on first manual enable; we pre-seed it.)
  write(path.join(vault, '.obsidian', 'core-plugins.json'),
    JSON.stringify(['file-explorer', 'global-search', 'switcher', 'graph', 'backlink', 'page-preview', 'command-palette']));
}

const NOTES = {
  'Notes/Industrialization.md': `{{Def|Industrialization}} is the shift from craft and farm work to large-scale machine production in factories. Once factories scale, {{R|output per worker grows because machines amortize fixed cost across more units}}, which is what we mean by {{Def|factory output}}. But the bottleneck shifts from labor to {{B|coordination — managers, supply chains, and energy distribution become the new limits}}. ^p1-sr

{{Def|Urbanization}} is the migration of workers toward those factories. {{C|Cities grow faster than their sanitation infrastructure, housing, and transit can be built}}. {{L|Public health effects from this gap appear years after the population spike}}, because waterborne disease compounds slowly and infrastructure projects take a decade to complete. ^p2-sr

{{X|The standard explanation treats industrial growth as net progress}}, but this assumes {{Assump|the displaced costs — disease, pollution, fragmented communities — are not paid by the same people who collected the gains}}. In practice {{T|the cost is paid by the urban poor while the gain is collected by capital owners}}, which is the central tradeoff. {{Q|Who bears the cost when growth outruns infrastructure?}} ^p3-sr

{{Def|Sanitation infrastructure}} should be built before population peaks, not after, even when {{Def|factory output}} growth is still accelerating. {{A|Measure success by under-five mortality and waterborne disease incidence, not GDP per capita alone}}. ^p4-sr
`,

  'Notes/Cognition.md': `{{Def|Cognition}} is the umbrella term for {{R|the mental processes by which the brain acquires, organizes, and acts on information}}. It subsumes {{Def|attention}}, {{Def|memory}}, {{Def|reasoning}}, and {{Def|language}}, each of which can be studied in isolation but only behaves naturally in concert. ^p1-sr

{{Q|Does {{Def|attention}} cause {{Def|memory}} encoding, or is the correlation explained by a third upstream factor?}} {{R|Most evidence suggests attention is necessary but not sufficient — memories form during inattentive states too, just less reliably}}. ^p2-sr

{{Assump|The chapter assumes cognition is largely separable from emotion}}, which {{Opp|the affective-priority school disputes}}. {{C|Experimental designs that strip emotional context risk measuring an artefact rather than the natural process}}. ^p3-sr
`,

  'Notes/Memory.md': `{{Def|Memory}} is not a single system; {{R|short-term, long-term, episodic, and procedural memories use distinct brain structures and obey different forgetting curves}}. ^p1-sr

A useful frame: {{Def|attention}} gates what reaches working memory, {{Def|cognition}} restructures it, and {{Def|reasoning}} operates over the restructured representation. {{Ev|Hippocampal lesions selectively impair episodic memory while leaving procedural skill acquisition intact}}. ^p2-sr

{{Q|How does sleep contribute to long-term consolidation?}} {{M|The standard signal is post-sleep recall accuracy compared with same-day recall}}. ^p3-sr
`,

  'Notes/Reasoning.md': `{{Def|Reasoning}} is the deliberate use of {{Def|cognition}} to derive new conclusions from existing knowledge. It depends on {{Def|memory}} for premises and on {{Def|attention}} to maintain working state. ^p1-sr

{{T|System 1 reasoning is fast but error-prone; system 2 is slow but more reliable}} — {{R|under time pressure, performance degrades because system 2 is throttled}}. ^p2-sr
`,
};

function writeNotes(vault) {
  for (const [rel, body] of Object.entries(NOTES)) {
    write(path.join(vault, rel), body);
  }
}

function main() {
  const vault = process.argv[2];
  if (!vault) {
    console.error('usage: node seed-vault.js <vault-path>');
    process.exit(2);
  }
  rmIfExists(vault);
  fs.mkdirSync(vault, { recursive: true });
  installPlugin(vault);
  writeObsidianConfig(vault);
  writeNotes(vault);
  console.log('seeded vault at', vault);
}

if (require.main === module) main();

module.exports = { writeNotes, writeObsidianConfig, installPlugin };
