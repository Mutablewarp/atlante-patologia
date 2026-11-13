#!/usr/bin/env node
/**
 * Run the build checks and the e2e suites the way CI does, inside a Linux container: the official Playwright image,
 * pinned to the installed @playwright/test version. Failures that only show on Linux (font metrics, scrollbars,
 * slow runners) then appear before a push, not after it.
 *
 *   npm run test:e2e:linux                                  unit tests, dist checks, chromium, study and offline suites
 *   npm run test:e2e:linux -- --engines chromium,webkit     several engines (Firefox and WebKit run the @smoke subset, as in CI)
 *   npm run test:e2e:linux -- --suites unit                 only some suites: unit, dist, main, study, offline, lighthouse
 *   npm run test:e2e:linux -- --suites lighthouse --lh-paths /it/,/it/e/coagulative-necrosis/     Lighthouse mobile (CI runs three pages)
 *   npm run test:e2e:linux -- --suites study -- -g quiz --repeat-each=10     everything after the second -- goes to Playwright
 *
 * The working tree (tracked and untracked files that are not ignored, so uncommitted changes are tested) is copied into
 * the container, which runs npm ci and the build itself: the host's node_modules and dist are never used. The npm cache
 * lives in a Docker volume. HTML reports and traces of failures are copied to .e2e-linux-out/.
 * Needs Docker running. The first run pulls the image (about 3.5 GB on disk).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, '.e2e-linux-out');
const ENGINES = ['chromium', 'firefox', 'webkit'];
const SUITES = ['unit', 'dist', 'main', 'study', 'offline', 'lighthouse'];
// What CI runs: the unit tests (here without the private .work/ and private/ folders, as in CI), the dist checks and the e2e suites; Lighthouse is a CI job of its own.
const DEFAULT_SUITES = ['unit', 'dist', 'main', 'study', 'offline'];

function fail(message) {
  console.error(`e2e-linux: ${message}`);
  process.exit(2);
}

const argv = process.argv.slice(2);
const cut = argv.indexOf('--');
const own = cut < 0 ? argv : argv.slice(0, cut);
const playwrightArgs = cut < 0 ? [] : argv.slice(cut + 1);
const option = (name, fallback) => {
  const i = own.indexOf(name);
  return i < 0 ? fallback : (own[i + 1] ?? fallback);
};
const engines = option('--engines', 'chromium').split(',');
const suites = option('--suites', DEFAULT_SUITES.join(',')).split(',');
const lighthousePaths = option('--lh-paths', '').split(',').filter(Boolean);
for (const [list, allowed, name] of [
  [engines, ENGINES, 'engine'],
  [suites, SUITES, 'suite'],
])
  for (const x of list) if (!allowed.includes(x)) fail(`unknown ${name} "${x}" (allowed: ${allowed.join(', ')})`);

if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) fail('Docker is not running (open Docker Desktop and retry)');

// One run at a time on this machine: two of these containers at once have hung the Docker VM. A second run waits for the first;
// a lock left by a run that died (its pid is gone) is taken over.
const LOCK = join(tmpdir(), 'atlante-e2e-linux.lock');
const holder = () => {
  try {
    return Number(readFileSync(LOCK, 'utf8')) || null;
  } catch {
    return null;
  }
};
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
for (let waited = 0; ; waited += 20) {
  try {
    writeFileSync(LOCK, String(process.pid), { flag: 'wx' });
    break;
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const pid = holder();
    if (pid && !alive(pid)) {
      rmSync(LOCK, { force: true });
      continue;
    }
    if (waited === 0) console.error(`e2e-linux: another run holds the lock (pid ${pid ?? 'starting'}); waiting for it to end`);
    if (waited >= 5400) fail('another run held the lock for 90 minutes');
    spawnSync('sleep', ['20']);
  }
}
process.on('exit', () => {
  if (holder() === process.pid) rmSync(LOCK, { force: true });
});

const version = createRequire(join(ROOT, 'package.json'))('@playwright/test/package.json').version;
const image = `mcr.microsoft.com/playwright:v${version}-noble`;

// The files to test: tracked plus untracked-but-not-ignored, skipping tracked files deleted in the working tree.
const listed = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
if (listed.status !== 0) fail('git ls-files failed');
const files = [...new Set(listed.stdout.split('\0').filter(Boolean))].filter((f) => existsSync(join(ROOT, f)));
const listFile = join(tmpdir(), `e2e-linux-${process.pid}.list`);
writeFileSync(listFile, files.join('\0'));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// Runs inside the container; "$@" are the Playwright arguments. Every step runs, and the exit code says if any failed.
const script = String.raw`
set -u
mkdir -p /work && tar -xf - -C /work && cd /work
export CI=1 SKIP_INSTALL_SIMPLE_GIT_HOOKS=1
rc=0
step() { echo "::: $*"; "$@" || { echo "::: FAILED: $*"; rc=1; }; }
echo "::: image ${image}, node $(node -v), $(uname -m), ${files.length} files"
npm ci --no-audit --no-fund > /tmp/npm-ci.log 2>&1 || { tail -25 /tmp/npm-ci.log; exit 1; }
npm run build > /tmp/build.log 2>&1 || { tail -40 /tmp/build.log; exit 1; }
case ",$SUITES," in *,unit,*) step npm test ;; esac
case ",$SUITES," in *,dist,*) step npm run test:dist ;; esac
for e in $(echo "$ENGINES" | tr , ' '); do
  case ",$SUITES," in *,main,*) step env E2E_ENGINES=$e npx playwright test "$@" ;; esac
  case ",$SUITES," in *,offline,*) if [ "$e" != firefox ]; then step npm run test:e2e:offline -- --project $e "$@"; fi ;; esac
done
case ",$SUITES," in *,study,*) step npm run test:e2e:study -- "$@" ;; esac
case ",$SUITES," in *,lighthouse,*) step npm run lighthouse -- $(echo "$LH_PATHS" | tr , ' ') ;; esac
rm -rf /out/* ; cp -r playwright-report test-results /out/ 2>/dev/null
echo "::: done, exit code $rc (reports in .e2e-linux-out/)"
exit $rc
`;

const tar = spawn('tar', ['-cf', '-', '--no-xattrs', '--null', '-T', listFile], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'inherit'],
  env: { ...process.env, COPYFILE_DISABLE: '1' },
});
const docker = spawn(
  'docker',
  [
    'run', '--rm', '-i', '--init', '--ipc=host',
    '-v', 'atlante-e2e-npm-cache:/root/.npm',
    '-v', `${OUT}:/out`,
    '-e', `ENGINES=${engines.join(',')}`,
    '-e', `SUITES=${suites.join(',')}`,
    '-e', `LH_PATHS=${lighthousePaths.join(',')}`,
    image,
    'bash', '-c', script, 'e2e-linux', ...playwrightArgs,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);
tar.stdout.pipe(docker.stdin);
docker.on('exit', (code) => {
  rmSync(listFile, { force: true });
  process.exit(code ?? 1);
});
