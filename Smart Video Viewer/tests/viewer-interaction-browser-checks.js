async (page) => {
  const results = [];
  const check = (name, ok) => { if (!ok) throw Error(name); results.push(name); };
  await page.goto('http://127.0.0.1:8766/Smart%20Video%20Viewer/tests/x-video-fixture.html');
  await page.waitForFunction(() => document.querySelector('video').videoWidth > 0);
  await page.evaluate(async () => {
    window.targetVideo = document.querySelector('video');
    document.body.style.cursor = 'pointer';
    targetVideo.style.cursor = 'pointer';
    await targetVideo.play();
    await smartVideoViewer.openVideo(targetVideo);
    targetVideo.pause(); // Simulate the site's visibility callback during entry.
  });
  await page.waitForFunction(() => !targetVideo.paused);
  check('entry resumes an interrupted playing video', true);
  await page.evaluate(() => targetVideo.pause());
  await page.waitForTimeout(100);
  check('entry recovery does not repeatedly override site pauses', await page.evaluate(() => targetVideo.paused));
  await page.evaluate(async () => { smartVideoViewer.close(); await targetVideo.play(); await smartVideoViewer.openVideo(targetVideo); });
  // A site capture listener would otherwise toggle playback before the viewer's handler.
  await page.evaluate(() => {
    window.playerSiteClicks = 0;
    document.addEventListener('click', event => {
      if (event.target === targetVideo) { playerSiteClicks++; targetVideo.pause(); }
    }, true);
  });
  await page.mouse.click(640, 450);
  await page.waitForTimeout(100);
  check('picture click pauses once without site click-through or auto-resume', await page.evaluate(() => targetVideo.paused && playerSiteClicks === 0 && smartVideoViewer.active()));
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !targetVideo.paused);
  check('keyboard playback remains available', true);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  check('control button pauses without exiting', await page.evaluate(() => targetVideo.paused && smartVideoViewer.active()));
  await page.evaluate(() => {
    window.cover = document.createElement('div');
    cover.style.cssText = 'position:fixed;left:0;top:0;width:80px;height:80px;z-index:2147483647;pointer-events:auto';
    cover.onclick = () => { window.coverClicked = true; };
    document.documentElement.append(cover);
  });
  await page.mouse.click(10, 10);
  check('outside picture exits even with a site overlay; no click-through', await page.evaluate(() => !smartVideoViewer.active() && !window.coverClicked));
  await page.evaluate(async () => { cover.remove(); targetVideo.pause(); await smartVideoViewer.openVideo(targetVideo); });
  await page.waitForTimeout(100);
  check('originally paused video stays paused', await page.evaluate(() => targetVideo.paused));
  await page.mouse.click(10, 10);
  check('plain backdrop click exits', await page.evaluate(() => !smartVideoViewer.active()));
  await page.evaluate(() => { targetVideo.click(); });
  check('site handlers work again after exit', await page.evaluate(() => playerSiteClicks === 1));
  await page.evaluate(async () => {
    await targetVideo.play(); await smartVideoViewer.openVideo(targetVideo);
    // Simulate a site resizing the video box to include black bars after entry.
    for (const [key, value] of Object.entries({ left: '0px', top: '0px', width: '100vw', height: '100vh' })) {
      targetVideo.style.setProperty(key, value, 'important');
    }
  });
  await page.waitForFunction(() => document.elementFromPoint(640, 20) !== targetVideo);
  check('letterbox uses arrow even when the page and video request a hand', await page.evaluate(() => {
    const host = document.elementFromPoint(640, 20);
    const target = host.shadowRoot?.elementFromPoint(640, 20) || host;
    return getComputedStyle(target).cursor === 'default';
  }));
  check('actual picture keeps its hand cursor', await page.evaluate(() => document.elementFromPoint(640, 450) === targetVideo && getComputedStyle(targetVideo).cursor === 'pointer'));
  await page.mouse.click(640, 20);
  check('letterbox inside the video element exits instead of pausing', await page.evaluate(() => !smartVideoViewer.active() && !targetVideo.paused));
  check('viewer leaves video clipping and site cursor unchanged', await page.evaluate(() => targetVideo.style.clipPath === '' && getComputedStyle(targetVideo).cursor === 'pointer'));
  return { passed: results.length, results };
}
