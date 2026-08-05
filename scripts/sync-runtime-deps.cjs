#!/usr/bin/env node
//
// Copies bivot's runtime dependencies (three, camera-controls, etc.) into a locally-linked
// consumer's copy of @bandicoot/bivot. debug:example/debug:shopfront copy dist/ and
// package.json straight into an already-`pnpm install`ed consumer instead of doing a real
// install, so the consumer never re-resolves bivot's dependency list — it won't have any of
// these packages unless it happens to depend on them itself. Without this step, adding (or
// bumping) a dependency here silently breaks local dev in every consumer until they do a real
// pnpm install against a freshly published version.
//
// Usage:
//   node scripts/sync-runtime-deps.js <path-to-consumer-repo>

const fs = require('fs');
const path = require('path');
const { name, dependencies } = require('../package.json');

const [, , consumerRepo] = process.argv;
if (!consumerRepo) {
  console.error('Usage: node scripts/sync-runtime-deps.js <path-to-consumer-repo>');
  process.exit(1);
}

const bivotLink = path.join(consumerRepo, 'node_modules', name);
const consumerBivotDir = fs.realpathSync(bivotLink);
// name is scoped (e.g. "@bandicoot/bivot"), so the sibling node_modules is one
// ".." per path segment above consumerBivotDir, not just one level up.
const siblingNodeModules = path.join(consumerBivotDir, ...name.split('/').map(() => '..'));

for (const dep of Object.keys(dependencies)) {
  const dest = path.join(siblingNodeModules, dep);
  if (fs.existsSync(dest)) {
    continue;
  }
  const src = fs.realpathSync(path.join(__dirname, '..', 'node_modules', dep));
  fs.cpSync(src, dest, { recursive: true, dereference: true });
  console.log(`sync-runtime-deps: copied ${dep} into ${path.relative(consumerRepo, dest)}`);
}
