async (page) => {
  await page.goto('http://127.0.0.1:8766/Smart%20Video%20Viewer/tests/x-video-fixture.html');
  const results = [];
  for (const ratio of ['56.25%', '177.7778%']) {
    const measurements = await page.evaluate(async ratio => {
      const video = document.querySelector('video');
      const player = video.closest('[data-testid="videoPlayer"]');
      player.replaceChildren();
      player.style.cssText = 'position:relative;width:100%';
      const spacer = document.createElement('div');
      spacer.style.paddingBottom = ratio;
      const layer = document.createElement('div');
      layer.style.cssText = 'position:absolute;inset:0';
      player.append(spacer, layer); layer.append(video);
      video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain';
      const measure = () => [player, layer, video.closest('article')].map(el => el.getBoundingClientRect().height);
      const originalStyle = video.style.cssText;
      const before = measure();
      const during = [], after = [];
      for (let i = 0; i < 3; i++) {
        await smartVideoViewer.openVideo(video);
        await new Promise(requestAnimationFrame);
        during.push(measure());
        if (document.elementFromPoint(innerWidth / 2, innerHeight / 2) !== video) {
          throw Error('Promoted video is covered by the page or backdrop');
        }
        window.dispatchEvent(new Event('resize'));
        smartVideoViewer.close();
        after.push(measure());
      }
      return { before, during, after, restored: video.style.cssText === originalStyle };
    }, ratio);
    for (const phase of ['during', 'after']) {
      if (!measurements[phase].every(rects => rects.every((height, i) => Math.abs(height - measurements.before[i]) < 1))) {
        throw Error(`${ratio} ${phase}: ${JSON.stringify(measurements)}`);
      }
      results.push(`${ratio} ${phase}: player and post heights preserved over three sessions`);
    }
    if (!measurements.restored) throw Error(`${ratio}: video inline styles not restored`);
    results.push(`${ratio}: video remains clickable; original styles restored after resize`);
  }
  return { passed: results.length, results };
}
