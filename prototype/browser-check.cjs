const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173');
    assert.match(await page.title(),/Signal 饮品行业情报工作台/);
    assert.equal(await page.locator('a[href="/app"]').count()>0,true);
    await page.route('http://127.0.0.1:4173/api/capture/pending**',route=>route.fulfill({json:{captures:[],sequence:0}}));
    await page.route('http://127.0.0.1:4173/api/ai/analyze',route=>route.fulfill({json:{analysis:'核心判断\n1. 当前样本已完成复核。\n下一步动作\n1. 补充下一周样本。',model:'deepseek-flash'}}));
    await page.goto('http://127.0.0.1:4173/app');
    await page.locator('[data-page="collection"]').click();
    await page.getByText('先收集，再复核。',{exact:true}).waitFor();
    assert.equal(await page.locator('.inbox-item').count(),0);
    await page.locator('[data-capture="sample"]').click();
    assert.equal(await page.locator('.inbox-item').count(),1);
    await page.locator('[data-remove-capture="demo-capture-001"]').click();
    assert.equal(await page.locator('.inbox-item').count(),0);
    await page.locator('[data-capture="sample"]').click();
    await page.locator('[data-capture="create-folder"]').first().click();
    await page.locator('[data-capture="move-to-review"]').click();
    await page.locator('[data-page="review"]').waitFor();
    assert((await page.locator('.page-heading').innerText()).includes('当前集合'));
    await page.locator('[data-run]').click();
    await page.locator('#review-form').waitFor();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('signal-review-v1')));
    const captured=saved.notes.find(n=>n.note_id==='demo-capture-001');
    assert(captured);assert.match(captured.week_label,/^20\d{2}\./);
    await page.locator('[data-page="overview"]').click();
    await page.locator('#folder-name').fill('联名观察周');
    await page.locator('[data-folder-action="create"]').click();
    await page.locator('#folder-rename').fill('联名观察周（已改名）');
    await page.locator('[data-folder-action="rename"]').click();
    assert((await page.locator('.folder-manager').innerText()).includes('联名观察周（已改名）'));
    await page.locator('[data-page="collection"]').click();
    for(let i=0;i<6;i++){
      await page.locator('#capture-folder-name').fill(`测试集合${i+1}`);
      await page.locator('[data-capture="create-folder"]').last().click();
      await page.waitForTimeout(5);
    }
    assert((await page.locator('.folder-directory').innerText()).includes('1 / 2'));
    await page.locator('[data-folder-page="next"]').click();
    assert((await page.locator('.folder-pagination').innerText()).includes('2 / 2'));
    await page.locator('#capture-folder-rename').fill('测试集合6（已改名）');
    await page.locator('[data-capture="rename-folder"]').click();
    assert((await page.locator('.folder-directory').innerText()).includes('测试集合6（已改名）'));
    await page.locator('[data-page="overview"]').click();
    await page.locator('#folder-dashboard-select').selectOption('sample-data');
    await page.locator('[data-page="review"]').click();
    assert.equal(await page.locator('#folder-review-select').count(),1);
    assert((await page.locator('#folder-review-select option').allTextContents()).some(text=>text.includes('模拟数据')));
    const queue=page.locator('.queue');
    const scrollBefore=await queue.evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop;});
    if(scrollBefore>0){await queue.locator('.queue-item').last().click();assert((await queue.evaluate(el=>el.scrollTop))>0);}
    await page.evaluate(()=>localStorage.clear());
    await page.reload();
    await page.locator('[data-page="review"]').click();
    await page.locator('[data-run]').click();
    for(let i=0;i<60;i++){
      const reason=page.locator('#review-form input[name="reason"]');
      if(await reason.isDisabled())break;
      if(await reason.getAttribute('required')!==null)await reason.fill('已核对原文与分类。');
      if(await page.locator('#review-form input[name="modules"]:checked').count())await page.locator('#review-form button[type="submit"]').click();
      else{await reason.fill('无明确市场动作，排除。');await page.locator('[data-exclude]').click();}
    }
    await page.locator('[data-publish]').click();
    await page.locator('.report-intro').waitFor();
    assert.equal(await page.locator('.report-chapter').count(),3);
    const overflow=await page.locator('.report-chapter h2').evaluateAll(nodes=>nodes.filter(n=>n.scrollWidth>n.clientWidth+1).map(n=>({text:n.textContent,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth})));
    assert.deepEqual(overflow,[],'报告章节标题不能超出容器');
    const chapterHeaders=await page.locator('.report-chapter > .chapter-heading').evaluateAll(nodes=>nodes.map(n=>({height:n.getBoundingClientRect().height,heading:n.querySelector('h2')?.getBoundingClientRect().height||0})));
    assert(chapterHeaders.every(box=>box.height>box.heading+20),'报告章节标题容器不能被全局 header 样式压扁');
    assert.equal(await page.locator('.report-decisions').count(),1);
    assert.equal(await page.locator('#deepseek-key').getAttribute('type'),'password');
    await page.locator('#deepseek-key').fill('sk-test-only');
    await page.locator('[data-ai-analyze]').click();
    await page.locator('.ai-result').waitFor();
    assert((await page.locator('.ai-result').innerText()).includes('当前样本已完成复核'));
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('signal-deepseek-key')),'sk-test-only');
    assert.equal(await page.evaluate(()=>localStorage.getItem('signal-review-v1').includes('sk-test-only')),false);
    await page.locator('[data-detail]').first().click();
    assert.equal(await page.locator('#detail').getAttribute('open'),'');
    assert.deepEqual(errors,[]);
    console.log('PASS: capture queue, collections, review handoff and narrative report.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
