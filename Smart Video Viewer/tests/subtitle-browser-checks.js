async (page) => {
  const results = [];
  const check = (name, value) => { if (!value) throw Error(name); results.push(name); };
  await page.goto(new URL('/Smart%20Video%20Viewer/tests/subtitle-fixture.html', page.url()).href);
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
  check('video and iframe discovery crosses open shadow roots', await page.evaluate(() => smartVideoViewer.inventory().length === 2 && smartVideoViewer.deepQuery('iframe').length === 1));
  await page.evaluate(() => {
    smartVideoViewer.prepare('shadow-frame');
    document.getElementById('shadow-player').shadowRoot.querySelector('iframe').contentWindow.eval("parent.postMessage({type:'smart-viewer-frame',token:'shadow-frame',active:true},'*')");
  });
  await page.waitForFunction(() => document.getElementById('shadow-player').shadowRoot.querySelector('iframe').style.position === 'fixed');
  await page.evaluate(() => smartVideoViewer.close());
  check('shadow iframe promotion restores original frame styles', await page.evaluate(() => document.getElementById('shadow-player').shadowRoot.querySelector('iframe').style.position === ''));
  await page.evaluate(() => smartVideoViewer.open(smartVideoViewer.inventory()[0].id, 'fixture'));
  const modes = () => page.evaluate(() => [...document.querySelector('video').textTracks].map(t => t.mode));
  check('original subtitles stay enabled on entry', (await modes()).join(',') === 'showing,disabled');
  await page.getByLabel('字幕轨道').selectOption('1');
  check('language selection changes active native track', (await modes()).join(',') === 'disabled,showing');
  await page.getByLabel('字幕轨道').selectOption('off');
  check('off disables both subtitle tracks', (await modes()).every(m => m === 'disabled'));
  await page.getByLabel('字幕轨道').selectOption('site');
  check('follow site restores original selection', (await modes()).join(',') === 'showing,disabled');
  await page.locator('#subtitle-file').setInputFiles({ name: 'sample.srt', mimeType: 'application/x-subrip', buffer: Buffer.from('1\n00:00:00,000 --> 02:00:00,000\nLocal subtitle test\n') });
  await page.waitForFunction(() => document.querySelector('video track')?.readyState === 2);
  check('SRT import loads and selects native cues', await page.evaluate(() => {
    const t = document.querySelector('video track').track;
    return t.mode === 'showing' && t.cues[0].text === 'Local subtitle test' && [...document.querySelector('video').textTracks].filter(track => track.mode === 'showing').length === 1;
  }));
  await page.mouse.move(10, 10);
  await page.waitForFunction(() => document.querySelector('[data-smart-video-viewer]').shadowRoot.querySelector('.dock').hasAttribute('data-hidden'));
  await page.keyboard.press('ArrowRight');
  check('seek shortcut does not reveal controls', await page.evaluate(() => document.querySelector('[data-smart-video-viewer]').shadowRoot.querySelector('.panel').inert));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-smart-video-viewer]').shadowRoot.querySelector('.panel')).opacity === '0');
  await page.screenshot({ path: 'output/playwright/subtitles-hidden.png' });
  await page.locator('.dock').hover();
  check('pointer restores controls', await page.evaluate(() => !document.querySelector('[data-smart-video-viewer]').shadowRoot.querySelector('.panel').inert));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => {
    const rect = document.querySelector('video').getBoundingClientRect();
    return Math.abs(rect.width - innerWidth) < 1 && Math.abs(rect.height - innerWidth * 9 / 16) < 1 &&
      Math.abs(rect.top - (innerHeight - rect.height) / 2) < 1;
  });
  await page.locator('.dock').hover();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-smart-video-viewer]').shadowRoot.querySelector('.panel')).opacity === '1');
  check('subtitle controls fit narrow viewport', await page.evaluate(() => {
    const p = document.querySelector('[data-smart-video-viewer]').shadowRoot.querySelector('.panel');
    return p.scrollWidth <= p.clientWidth && p.getBoundingClientRect().left >= 0;
  }));
  await page.screenshot({ path: 'output/playwright/subtitles-narrow.png' });
  // Click letterboxing, not the picture: it must exit without pausing.
  await page.mouse.click(5, 5);
  check('outside click exits, removes imported tracks and restores original modes', await page.evaluate(() => !smartVideoViewer.active() && !document.querySelector('video track') && [...document.querySelector('video').textTracks].map(t => t.mode).join(',') === 'showing,disabled' && !document.querySelector('video').paused));
  await page.setViewportSize({ width: 1280, height: 720 });
  return { passed: results.length, results };
}
