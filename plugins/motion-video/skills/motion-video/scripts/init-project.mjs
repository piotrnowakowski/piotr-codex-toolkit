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
console.log(`Created ${target}\nRun npm install, npx playwright install chromium, then node render.mjs review in that directory.`);
