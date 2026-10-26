async (page) => {
  const results=[];
  const check=(name,value)=>{if(!value)throw Error(name);results.push(name);};
  await page.goto('http://127.0.0.1:8766/output/playwright/fixture.html');
  await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
  await page.evaluate(async()=>{
    document.body.style.paddingTop='700px'; window.scrollTo(0,450);
    window.startScroll=window.scrollY;
    const id=smartVideoViewer.inventory()[0].id;
    await smartVideoViewer.open(id,'scroll-test');
    document.querySelector('#container').style.color='red';
  });
  await page.keyboard.press('Escape');
  check('scroll position restored',await page.evaluate(()=>Math.abs(scrollY-startScroll)<2));
  check('unrelated live site style preserved',await page.evaluate(()=>document.querySelector('#container').style.color==='red'));
  await page.evaluate(async()=>{
    const id=smartVideoViewer.inventory()[0].id;
    const originalGet=browser.storage.local.get;
    let resolve;browser.storage.local.get=()=>new Promise(r=>resolve=r);
    const opening=smartVideoViewer.open(id,'cancel-test');
    smartVideoViewer.close();resolve({});
    window.cancelResult=await opening;
    browser.storage.local.get=originalGet;
  });
  check('cancel prevents late viewer from reopening',await page.evaluate(()=>!cancelResult.ok&&!smartVideoViewer.active()&&!document.querySelector('[data-smart-video-viewer]')));
  await page.goto('http://127.0.0.1:8766/output/playwright/fixture.html');
  await page.evaluate(async()=>{
    const host=document.createElement('div');host.id='shadow-player';document.body.append(host);
    const root=host.attachShadow({mode:'open'});const v=document.createElement('video');v.src='sample.mp4';v.style.cssText='width:400px;height:240px';v.controls=true;root.append(v);window.shadowVideo=v;
    await new Promise(r=>v.addEventListener('loadeddata',r,{once:true}));
    const list=smartVideoViewer.inventory();const target=list.at(-1);
    await smartVideoViewer.open(target.id,'shadow-test');
  });
  check('open Shadow DOM video detected and elevated',await page.evaluate(()=>shadowVideo.style.position==='fixed'&&smartVideoViewer.active()));
  await page.keyboard.press('Escape');
  check('Shadow DOM video restores controls and layout',await page.evaluate(()=>shadowVideo.style.position===''&&shadowVideo.controls&&shadowVideo.getRootNode().host.id==='shadow-player'));
  await page.evaluate(async()=>{
    const v=document.querySelector('video');v.currentTime=10;
    const field=document.createElement('input');field.id='page-field';document.body.prepend(field);
    await smartVideoViewer.open(smartVideoViewer.inventory()[0].id,'focus-test');field.focus();
  });
  await page.keyboard.press('ArrowRight');
  check('arrows seek while a hidden page field holds focus',await page.evaluate(()=>document.querySelector('video').currentTime>=14.9&&document.querySelector('#page-field').value===''));
  await page.keyboard.press('Escape');
  // Safari popover entry: the page has no keyboard focus until the first click.
  await page.evaluate(async()=>{document.hasFocus=()=>false;await smartVideoViewer.open(smartVideoViewer.inventory()[0].id,'popover-test');});
  const hint=()=>page.evaluate(()=>!document.querySelector('[data-smart-video-viewer]').shadowRoot.querySelector('.focus-hint').hidden);
  check('focus hint shown when page lacks keyboard focus',await hint());
  await page.screenshot({path:`output/playwright/focus-hint-${page.context().browser().browserType().name()}.png`});
  const box=await page.evaluate(()=>{const r=document.querySelector('video').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  check('first click only restores focus',await page.evaluate(()=>smartVideoViewer.active()&&document.querySelector('video').paused)&&!await hint());
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  check('second click toggles playback',await page.evaluate(()=>!document.querySelector('video').paused));
  await page.keyboard.press('Escape');
  return {passed:results.length,results};
}
