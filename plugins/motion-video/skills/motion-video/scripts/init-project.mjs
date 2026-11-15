import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const destination = process.argv[2];
if (!destination || process.argv.length !== 3) {
  console.error('Usage: node init-project.mjs <new-project-directory>');
  process.exit(1);
}
const target = resolve(destination);
if (existsSync(target) && readdirSync(target).length) {
  throw new Error(`Refusing to overwrite a nonempty directory: ${target}`);
}
const skill = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(target, { recursive: true });
cpSync(join(skill, 'assets', 'starter'), target, { recursive: true });
cpSync(join(skill, 'scripts', 'render.mjs'), join(target, 'render.mjs'));
writeFileSync(join(target, '.gitignore'), 'node_modules/\nout/\n', 'utf8');
console.log(`Created ${target}\nIn that directory run: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --prefer-offline --no-audit --no-fund && node render.mjs review\n(System Chromium is used; without it, also run npx playwright install chromium.)`);
