(() => {
  const root=document.querySelector('.note-detail-mask .note-container')||document.querySelector('.note-container');
  if(!root) throw Error('请先打开一篇小红书笔记');
  const read=s=>root.querySelector(s)?.textContent?.trim()||'';
  const id=location.href.match(/\/(?:explore|discovery\/item|search_result)\/([a-zA-Z0-9]+)/)?.[1];
  const title=read('#detail-title'),body=read('#detail-desc');
  if(!id||(!title&&!body)) throw Error('没有识别到完整的笔记内容');
  const parseMetric=raw=>{const clean=String(raw||'').replace(/,/g,'').trim(),m=clean.match(/^(\d+(?:\.\d+)?)\s*(万|w|k|千)?\+?$/i);return{raw:clean,value:m?Math.round(Number(m[1])*({万:10000,w:10000,k:1000,千:1000}[m[2]?.toLowerCase()]||1)):null,approximate:!!m&&(!!m[2]||clean.endsWith('+'))};};
  const metric=(selectors,prefer='max')=>{for(const selector of selectors){const values=[...new Set([...root.querySelectorAll(selector)].map(e=>e.textContent.trim()).filter(Boolean))].map(parseMetric).filter(x=>x.value!==null);if(values.length)return values.sort((a,b)=>prefer==='max'?b.value-a.value:a.value-b.value)[0];}return{raw:'',value:null,approximate:false};};
  const published=read('.date')||root.innerText.match(/(?:发布|编辑于)[^\n]{0,30}/)?.[0]||'';
  const absolute=published.match(/(20\d{2})[-年/](\d{1,2})[-月/](\d{1,2})/);
  const relative=published.match(/(今天|昨天|前天|刚刚|(\d+)天前)/);
  const base=new Date();let publishedDate='';
  if(absolute)publishedDate=`${absolute[1]}-${absolute[2].padStart(2,'0')}-${absolute[3].padStart(2,'0')}`;
  else if(relative){const days=relative[1]==='今天'||relative[1]==='刚刚'?0:relative[1]==='昨天'?1:relative[1]==='前天'?2:Number(relative[2]||0);base.setDate(base.getDate()-days);publishedDate=base.toISOString().slice(0,10);}
  const text=`${title} ${body} ${[...root.querySelectorAll('#detail-desc a')].map(a=>a.textContent).join(' ')}`;
  const brands=['霸王茶姬','喜茶','奈雪','瑞幸','星巴克','古茗','沪上阿姨','蜜雪冰城','茶百道','茶颜悦色','书亦烧仙草','一点点','CoCo都可'];
  const brand=brands.find(name=>text.includes(name))||'';
  const author=root.querySelector('.author-wrapper a[href*="/user/profile/"]');
  const note={note_id:id,url:location.href,title,body,brand,source_account:read('.author-wrapper .username')||read('.author-wrapper .name'),author_url:author?.href||'',source_type:'小红书',published_raw:published,published_date:publishedDate,metrics:{likes:metric(['.interact-container .like-wrapper .count','.note-scroller .like-wrapper .count','.like-wrapper .count']),collects:metric(['.interact-container .collect-wrapper .count','.collect-wrapper .count']),comments:metric(['.interact-container .chat-wrapper .count','.chat-wrapper .count'])},likes_captured_at:new Date().toISOString(),tags:[...root.querySelectorAll('#detail-desc a')].map(a=>a.textContent.trim()).filter(t=>t.startsWith('#')),content_type:root.querySelector('video')?'视频':'图文'};
  window.__signalNote=note;
  return note;
})();
