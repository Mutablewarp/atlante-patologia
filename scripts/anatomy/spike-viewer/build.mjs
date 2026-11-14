import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'dist');

export async function bundle() {
  await build({
    configFile: false,
    root: here,
    logLevel: 'error',
    build: {
      lib: { entry: join(here, 'main.js'), formats: ['es'], fileName: () => 'main.js' },
      outDir,
      emptyOutDir: true,
      minify: true,
    },
  });
  mkdirSync(outDir, { recursive: true });
  copyFileSync(join(here, 'index.html'), join(outDir, 'index.html'));
  const js = readFileSync(join(outDir, 'main.js'));
  return { minified: js.length, gzip: gzipSync(js).length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { minified, gzip } = await bundle();
  console.log(`main.js minified ${minified} bytes, gzip ${gzip} bytes`);
}
