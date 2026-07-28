#!/usr/bin/env node
//
// Uploads the bivot-js browser bundle to the Bandicoot publish site. This is the build customers'
// embed snippets load from.
//
// Runs automatically as the `postpublish` step of `np` (see package.json). Can also be run
// manually to re-upload the current dist for the current version, e.g. after fixing a build
// without bumping the version.
//
// Usage:
//   node scripts/publish-dist.js [--stage prod|dev]

const { parseArgs } = require('util');
const { execFileSync } = require('child_process');
const path = require('path');
const { version } = require('../package.json');

const PUBLISH_BUCKETS = {
  prod: 'shop-storage-prod-publish-p9l1iwd9hwvn',
  dev: 'shop-storage-dev-publish-qky7rq3y5ipl',
};

const PUBLISH_URLS = {
  prod: 'https://publish.bandicootimaging.com.au',
  dev: 'https://publish-dev.bandicootimaging.com.au',
};

const { values: { stage } } = parseArgs({
  options: {
    stage: { type: 'string', default: 'dev' },
  },
});

if (!PUBLISH_BUCKETS[stage]) {
  console.error(`Unknown stage "${stage}". Expected one of: ${Object.keys(PUBLISH_BUCKETS).join(', ')}`);
  process.exit(1);
}

const bucket = PUBLISH_BUCKETS[stage];
const tag = `v${version}`;
const prefix = `bivot-js/${tag}`;
const distDir = path.join(__dirname, '..', 'src', 'bivot-js', 'dist');

const uploads = [
  { file: 'index.js', contentType: 'application/javascript' },
  { file: 'index.js.map', contentType: 'application/json' },
];

for (const { file, contentType } of uploads) {
  const localPath = path.join(distDir, file);
  const s3Path = `s3://${bucket}/${prefix}/${file}`;
  console.log(`Uploading ${localPath} -> ${s3Path}`);
  execFileSync('aws', [
    's3', 'cp', localPath, s3Path,
    '--content-type', contentType,
    // The path is versioned and never overwritten, so it's safe to cache indefinitely.
    '--cache-control', 'public, max-age=31536000, immutable',
    // The bucket has no bucket policy; objects must be marked public-read individually
    // (matches how materialOps.js publishes customer material files).
    '--acl', 'public-read',
  ], { stdio: 'inherit' });
}

console.log(`\nEmbed build available at: ${PUBLISH_URLS[stage]}/${prefix}/index.js`);
