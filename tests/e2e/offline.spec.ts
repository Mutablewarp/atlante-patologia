import { expect, test, type Page } from '@playwright/test';

/** Wait until the service worker is active (shell precached) and controls the page. */
async function swReady(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
  });
}

test('a first visit shows no update notice and does not reload when the worker takes control', async ({ page }) => {
  let documents = 0;
  page.on('request', (r) => r.resourceType() === 'document' && r.frame() === page.mainFrame() && documents++);
  await page.goto('it/');
  await swReady(page);
  // Give late 'statechange' / 'controllerchange' handlers time to run.
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-update-notice]')).toBeHidden();
  expect(documents).toBe(1);
});

test('after the first visit, the home pages and the offline fallback load offline', async ({ page, context }) => {
  await page.goto('it/');
  await swReady(page);
  await context.setOffline(true);

  await page.goto('it/');
  await expect(page).toHaveTitle('Atlante di Patologia');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');

  await page.goto('en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.goto('it/offline/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sei offline');

  // A page that was never saved falls back to the offline page in its language.
  await page.goto('en/atlas/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You are offline');
  await page.goto('it/about/method/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sei offline');
});

test('an installed offline pack makes its pages load offline', async ({ page, context }) => {
  await page.goto('it/me/offline/');
  await swReady(page);
  const pack = page.locator('[data-pack="g01"]');
  await expect(pack.locator('[data-state]')).toHaveText('Non scaricato');
  await pack.getByRole('button', { name: /^Scarica / }).click();
  await expect(pack.locator('[data-state]')).toHaveText('Disponibile offline');
  await expect(pack.getByRole('button', { name: /^Rimuovi / })).toBeVisible();

  await context.setOffline(true);
  await page.goto('it/e/fixture-demo/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Voce di prova');
  // The module's pathway page is in the pack too (entity cards link to it).
  await page.goto('it/pathways/intrinsic-apoptosis/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Apoptosi intrinseca');
  // Packs are per language: the English pack was not installed.
  await page.goto('en/e/fixture-demo/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('You are offline');

  // Removing the pack (back online) takes its pages away again.
  await context.setOffline(false);
  await page.goto('it/me/offline/');
  await page.locator('[data-pack="g01"]').getByRole('button', { name: /^Rimuovi / }).click();
  await expect(page.locator('[data-pack="g01"] [data-state]')).toHaveText('Non scaricato');
  await context.setOffline(true);
  await page.goto('it/e/fixture-demo/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sei offline');
});

test('an installed offline pack keeps the images of its cards: the AVIF, the WebP fallback and the file the viewer zooms to', async ({ page, context }) => {
  await page.goto('it/me/offline/');
  await swReady(page);
  const pack = page.locator('[data-pack="g01"]');
  await pack.getByRole('button', { name: /^Scarica / }).click();
  await expect(pack.locator('[data-state]')).toHaveText('Disponibile offline');

  await context.setOffline(true);
  await page.goto('it/e/coagulative-necrosis/'); // a 1600 px original: its picture has a zoom source
  const files = await page.locator('#fig-coagulative-necrosis-micro-1 picture').evaluate((p) =>
    [p.querySelector('source')!.srcset, p.querySelector('source')!.dataset.zoom!, p.querySelector('img')!.src].map((u) => new URL(u.split(' ')[0]!, location.href).href),
  );
  expect(files).toHaveLength(3);
  // A fresh image request for each, as the browser makes one for the page and for a zoom. The page's scripts cannot be
  // tested offline here: `astro preview` answers `Vary: Origin`, which a module script's request (it carries Origin) misses.
  for (const url of files) {
    const loads = await page.evaluate(
      (u) =>
        new Promise<boolean>((done) => {
          const image = new Image();
          image.onload = () => done(true);
          image.onerror = () => done(false);
          image.src = u;
        }),
      url,
    );
    expect(loads, url).toBe(true);
  }
});

test('study data from an installed pack is served only offline: online, the deployed file wins', async ({ page, context }) => {
  await page.goto('it/me/offline/');
  await swReady(page);
  const pack = page.locator('[data-pack="g01"]');
  await pack.getByRole('button', { name: /^Scarica / }).click();
  await expect(pack.locator('[data-state]')).toHaveText('Disponibile offline');
  // The pack holds the file as it was on the day of the download; a later deploy changes it under the same name.
  const url = new URL('../../data/index.json', page.url()).href; // it/me/offline/ → it/data/index.json
  const packed = '{"packed":true}';
  await page.evaluate(
    async ([u, body]) => {
      const name = (await caches.keys()).find((k) => k.startsWith('pack-it-g01-'))!;
      await (await caches.open(name)).put(u, new Response(body, { headers: { 'content-type': 'application/json' } }));
    },
    [url, packed] as const,
  );
  const read = () => page.evaluate(async (u) => (await fetch(u)).text(), url);
  const deployed = await read();
  expect(deployed).not.toBe(packed);
  expect(JSON.parse(deployed)).toHaveProperty('entities');
  await context.setOffline(true);
  expect(await read()).toBe(packed);
  await context.setOffline(false);
});
