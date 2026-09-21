const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage();
    await page.route('https://www.xiaohongshu.com/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<div class="note-container"><div id="detail-title">霸王茶姬新品</div><div id="detail-desc">正文</div><div class="author-wrapper"><span class="username">作者</span></div><span class="date">编辑于 2天前 云南</span><div class="like-wrapper"><span class="count">10+</span></div><div class="interact-container"><div class="like-wrapper"><span class="count">454</span></div><div class="chat-wrapper"><span class="count">99</span></div></div></div>'}));
    await page.goto('https://www.xiaohongshu.com/explore/test');
    await page.addScriptTag({path:'extension/extractor-page.js'});
    const note=await page.evaluate(()=>window.__signalNote);
    assert.equal(note.metrics.likes.value,454);
    assert.equal(note.metrics.comments.value,99);
    assert.equal(note.title,'霸王茶姬新品');
    assert.equal(note.brand,'霸王茶姬');
    assert.match(note.published_date,/^20\d{2}-\d{2}-\d{2}$/);
    console.log('PASS: extractor uses interaction metrics, relative date and brand inference.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
