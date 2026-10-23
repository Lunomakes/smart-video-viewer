async (page) => {
  await page.goto(new URL('/Smart%20Video%20Viewer/tests/subtitle-fixture.html', page.url()).href);
  await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
  const results = [];
  const check = (name, value) => { if (!value) throw Error(name); results.push(name); };
  await page.evaluate(() => document.getElementById('shadow-player').remove());
  check('missing metadata stays empty', await page.evaluate(() => {
    const m = smartVideoViewer.metadata(document.querySelector('video'));
    return !m.title && m.actors.length === 0;
  }));
  await page.evaluate(() => {
    const script = document.createElement('script'); script.type = 'application/ld+json'; script.id = 'metadata-test';
    script.textContent = JSON.stringify({'@type':'VideoObject', name:'测试标题 <img src=x onerror=alert(1)>', actor:[{name:'演员甲'}, {name:'演员乙'}, {name:'演员甲'}]});
    document.head.append(script);
  });
  await page.evaluate(() => smartVideoViewer.open(smartVideoViewer.inventory()[0].id,'metadata'));
  check('explicit title is text, cast is deduplicated', await page.evaluate(() => {
    const root = document.querySelector('[data-smart-video-viewer]').shadowRoot;
    return !root.querySelector('.video-info').hidden && root.querySelector('.video-title').textContent.includes('<img') && !root.querySelector('.video-info img') && root.querySelector('.video-actors').textContent === '演员：演员甲 · 演员乙';
  }));
  await page.mouse.move(1, 1);
  await page.waitForFunction(() => document.querySelector('[data-smart-video-viewer]').shadowRoot.querySelector('.video-info').hasAttribute('data-hidden'));
  await page.keyboard.press('ArrowRight');
  check('seek keeps title and controls hidden', await page.evaluate(() => {
    const root = document.querySelector('[data-smart-video-viewer]').shadowRoot;
    return root.querySelector('.dock').hasAttribute('data-hidden') && root.querySelector('.video-info').hasAttribute('data-hidden');
  }));
  await page.locator('.dock').hover();
  check('hover restores title and controls together', await page.evaluate(() => !document.querySelector('[data-smart-video-viewer]').shadowRoot.querySelector('.video-info').hasAttribute('data-hidden')));
  await page.waitForTimeout(250);
  await page.screenshot({path:'output/playwright/video-metadata.png'});
  await page.evaluate(() => { smartVideoViewer.close(); document.getElementById('metadata-test').remove(); });
  await page.evaluate(() => smartVideoViewer.open(smartVideoViewer.inventory()[0].id,'empty'));
  check('no empty information strip', await page.locator('.video-info').isHidden());
  await page.evaluate(() => {
    smartVideoViewer.close();
    const script = document.createElement('script'); script.type='application/ld+json';
    script.textContent=JSON.stringify([{'@type':'VideoObject',name:'甲'},{'@type':'VideoObject',name:'乙'}]);document.head.append(script);
  });
  check('ambiguous metadata is omitted', await page.evaluate(() => !smartVideoViewer.metadata(document.querySelector('video')).title));
  return {passed:results.length,results};
}
