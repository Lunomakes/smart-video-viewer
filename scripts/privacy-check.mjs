import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rules = [
  ['personal home path', /\/(?:Users|home)\/[A-Za-z0-9._-]+\//],
  ['Windows home path', /[A-Z]:\\Users\\[^\\\s]+\\/i],
  ['private key', /-----BEGIN (?:[A-Z ]+)?PRIVATE KEY-----/],
  ['access token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]+)/],
  ['embedded credentials in URL', /https?:\/\/[^/\s:]+:[^/\s@]+@/],
  ['fixed developer team', /DEVELOPMENT_TEAM\s*=\s*(?:"[A-Za-z0-9]+"|[A-Za-z0-9]+)\s*;/],
  ['personal author header', /^\/\/\s*Created by .+/m],
  ['signed URL value', /[?&](?:token|auth|signature|sig|x-amz-credential|x-amz-signature)=[A-Za-z0-9%+/_=-]{12,}/i],
];
let findings = 0;
let inspected = 0;
function inspect(label, bytes) {
  inspected++;
  const text = bytes.toString('utf8');
  const categories = rules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const emails = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  if (emails.some(email => !email.endsWith('@users.noreply.github.com') && !email.endsWith('@example.com'))) {
    categories.push('non-placeholder email');
  }
  if (categories.length) {
    findings++;
    // Never print matching bytes: CI logs are public.
    console.error(`${label}: ${[...new Set(categories)].join(', ')}`);
  }
}
function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name), stat = lstatSync(full);
    if (stat.isSymbolicLink()) return [];
    return stat.isDirectory() ? files(full) : [full];
  });
}
const args = process.argv.slice(2);
if (args[0] === '--artifact') {
  if (!args[1]) throw new Error('Usage: privacy-check.mjs --artifact <unpacked directory>');
  const dir = path.resolve(args[1]);
  for (const file of files(dir)) {
    const label = path.relative(dir, file);
    if (/\.(?:p12|pfx|provisionprofile|mobileprovision)$/i.test(file)) {
      findings++; console.error(`${label}: signing credential/profile file`);
    }
    inspect(label, readFileSync(file));
  }
} else if (args[0] === '--history') {
  const revisions = args.slice(1);
  if (!revisions.length) throw new Error('Pass explicit branch/tag revisions to audit.');
  const entries = execFileSync('git', ['rev-list', '--objects', ...revisions], { cwd: root, encoding: 'utf8' }).trim().split('\n');
  for (const entry of entries) {
    const [oid] = entry.split(' ');
    if (execFileSync('git', ['cat-file', '-t', oid], { cwd: root, encoding: 'utf8' }).trim() === 'blob') {
      inspect(`history blob ${oid.slice(0, 12)}`, execFileSync('git', ['cat-file', 'blob', oid], { cwd: root, maxBuffer: Infinity }));
    }
  }
} else {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
  for (const file of tracked) inspect(file, readFileSync(path.join(root, file)));
}
if (findings) { console.error(`${findings} file(s) require privacy review.`); process.exitCode = 1; }
else console.log(`Privacy pattern checks passed for ${inspected} files. This is not a guarantee of absence of all sensitive data.`);
