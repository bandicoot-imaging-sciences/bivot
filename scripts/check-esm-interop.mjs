#!/usr/bin/env node
//
// Systematic check for the ESM/CJS interop bug class (react-color's ChromePicker,
// @material-ui/icons default exports) that broke silently when bivot's build moved
// from CJS to ESM output. Node's native ESM loader doesn't apply the "smart"
// default-unwrapping that bundlers/Babel do for CJS packages, so a default import can
// resolve to the raw `{ __esModule, default }` wrapper instead of the real value, and
// named imports depend on cjs-module-lexer successfully detecting the export
// statically — neither is guaranteed for CJS packages microbundle leaves external.
//
// This parses the real import statements out of the built dist/index.js (not source,
// so it reflects exactly what a consumer's Node runtime has to resolve), dynamically
// imports each specifier, and flags any binding that's missing, or that looks like an
// unwrapped CJS default-export wrapper rather than the real value.
//
// Usage:
//   node scripts/check-esm-interop.mjs   (run after `pnpm run build`)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '../dist/index.js');
const src = readFileSync(distPath, 'utf8');

// Matches: import Def, { A, B } from 'specifier';  /  import * as NS from 'specifier';
const importRe = /^import\s+(?:(\*\s+as\s+\w+)|([\w$]+)?,?\s*(?:\{([^}]*)\})?)\s+from\s+'([^']+)';/gm;

const bySpecifier = new Map();
let match;
while ((match = importRe.exec(src))) {
  const [, namespaceClause, defaultName, namedClause, specifier] = match;
  const entry = bySpecifier.get(specifier) || { namespace: false, defaultName: null, named: new Set() };
  if (namespaceClause) entry.namespace = true;
  if (defaultName) entry.defaultName = defaultName;
  if (namedClause) {
    for (const part of namedClause.split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) entry.named.add(name);
    }
  }
  bySpecifier.set(specifier, entry);
}

let problems = 0;
let checked = 0;

for (const [specifier, { namespace, defaultName, named }] of bySpecifier) {
  let mod;
  try {
    mod = await import(specifier);
  } catch (e) {
    console.log(`FAIL   ${specifier} — could not import: ${e.message.split('\n')[0]}`);
    problems++;
    continue;
  }

  if (defaultName) {
    checked++;
    const value = mod.default;
    const looksLikeUnwrappedCjs =
      value && typeof value === 'object' && value.__esModule === true && 'default' in value && !('$$typeof' in value);
    if (value === undefined) {
      console.log(`FAIL   ${specifier}: default import is undefined`);
      problems++;
    } else if (looksLikeUnwrappedCjs) {
      // Ambiguous, not a hard failure: this shape is also what you get when a
      // module intentionally exports a bag of named things (e.g. react-color)
      // and the source is deliberately grabbing the whole object to destructure
      // from — can't tell apart from here without seeing the downstream usage.
      // Real bugs of this shape look like `<SomeDefaultImport />` used directly
      // as a component. Grep the source for how `defaultName` is used before
      // treating this as broken.
      console.log(`WARN   ${specifier}: default import has the { __esModule, default } CJS-wrapper shape — verify downstream usage isn't relying on it being the real export directly`);
    }
  }

  for (const name of named) {
    checked++;
    if (!(name in mod) || mod[name] === undefined) {
      console.log(`FAIL   ${specifier}: named import '${name}' is missing/undefined (cjs-module-lexer likely failed to detect it)`);
      problems++;
    }
  }
}

console.log(`\nChecked ${checked} bindings across ${bySpecifier.size} external modules imported by dist/index.js.`);
if (problems > 0) {
  console.log(`${problems} problem(s) found.`);
  process.exit(1);
} else {
  console.log('No interop problems detected.');
}
