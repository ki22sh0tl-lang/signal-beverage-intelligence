const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType } = require('docx');
const { convert } = require('../tools/import-beverage-data.cjs');
const PORT = Number(process.env.PORT) || 4173;
const CAPTURE_TOKEN = String(process.env.CAPTURE_TOKEN || '');
const IMPORT_LIMIT = 10 * 1024 * 1024;
const DEEPSEEK_PROMPT = `你是一名饮品行业的营销策略、社媒洞察与广告创意复盘顾问。你的任务不是复述报表，而是把已复核的社媒样本转成可以帮助品牌做内容、产品和联名决策的营销诊断。

【证据边界】
1. 只使用用户提供的 report 和 notes。可用字段包括标题、品牌、动作名称、观察模块、周边标签、点赞、发布日期、账号和复核说明。
2. 数字事实必须能在输入中找到；每个重要判断后标注“证据：……”。不要编造评论原文、受众年龄、城市、购买、销量、市场份额、投放成本或转化率。
3. 点赞是内容互动信号，不等于销量、品牌偏好或真实消费规模。样本不是全平台随机抽样，必须说明样本量、时间范围和偏差。
4. 严格区分四种表达：“事实”是输入直接提供的内容；“推断”是基于事实的合理解释；“建议”是下一步可执行动作；“待验证”是当前证据无法回答的问题。

【分析方法】
按“目标与口径 → 证据观察 → 营销解释 → 决策建议”展开。至少检查：
- 品牌与品牌动作的集中度、头部与长尾差异；
- 新品、联名、活动等观察模块的表现差异；
- 产品、包装、周边、互动等传播主题；
- 标题和动作中呈现的内容钩子、参与机制与传播路径；
- 哪些结论稳健，哪些只是小样本假设。
不要把相关关系写成因果关系，不要因为某个品牌或动作点赞高就直接断言“更有效”。

【输出要求】
使用简体中文，控制在 1,200 字以内。不要输出 Markdown 表格，不要展示思维过程，严格按以下纯文本结构：
一句话结论
用一句话回答本期最值得业务关注的信号，并标注它是事实还是推断。

一、样本与口径
- 已确认内容、品牌数、动作数、累计点赞、时间范围。
- 本次分析可以回答什么，不能回答什么。

二、营销信号
1. 信号名称
   事实：...
   推断：...
   证据：...
   置信度：高/中/低
2. ...
最多输出 3 个信号，优先选择能影响内容、产品或联名决策的信号。

三、受众与创意机制
- 可能被内容吸引的需求或参与动机：只写能从标题、模块、周边和互动指标支持的内容；无法判断时写“待验证”。
- 内容钩子/传播机制：...
- 当前样本缺失的关键受众信息：...

四、品牌机会与优先级
按 P0/P1/P2 输出最多 3 条。每条必须包含：目标、具体动作、建议测试的内容例子、成功指标、验证周期、依据。

五、风险与下一步
- 统计和归因风险：...
- 下一轮应补采或人工核验的数据：...
- 给业务负责人的下一步：...

写作风格：像一页给品牌市场负责人的周报，先给判断，再给证据和动作；少用“加强、提升、优化”这类空话，动作要能在下周执行。`;
let captureSequence = 0;
const captureQueue = [];
const files = { '/app': ['index.html','text/html'], '/app/': ['index.html','text/html'], '/privacy': ['privacy.html','text/html'], '/landing.css':['landing.css','text/css'], '/landing-nebula.js':['landing-nebula.js','text/javascript'], '/motion.css':['motion.css','text/css'], '/app.js':['app.js','text/javascript'], '/style.css':['style.css','text/css'], '/sample.csv':['sample.csv','text/csv'], '/signal-collector-extension.zip':['signal-collector-extension.zip','application/zip'], '/papa.js':['../node_modules/papaparse/papaparse.min.js','text/javascript'] };
files['/collector.js']=['collector.js','text/javascript'];
files['/collector.css']=['collector.css','text/css'];
http.createServer(async (req,res) => {
  const send = (status, type, body, headers = {}) => { res.writeHead(status, {'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store',...headers}); res.end(body); };
  const siteOrigin = () => `${String(req.headers['x-forwarded-proto'] || 'http').split(',')[0]}://${req.headers.host}`;
  const readBody = async limit => { let body = ''; for await(const chunk of req) { body += chunk; if(Buffer.byteLength(body)>limit) throw Object.assign(new Error('文件上限为 2 MB'),{status:413}); } return body; };
  const textCell = (text, bold = false, shade = '') => new TableCell({shading: shade ? {fill: shade, type: ShadingType.CLEAR} : undefined, children:[new Paragraph({children:[new TextRun({text:String(text ?? ''), bold, color:shade === '172761' ? 'FFFFFF' : '171713', font:{name:'Microsoft YaHei', eastAsia:'Microsoft YaHei'}, size:20})]})]});
  const reportDoc = payload => {
    const report = payload.report;
    if(!report?.summary || !Array.isArray(report.brandActions)) throw new Error('缺少可导出的报告数据');
    const notes = Array.isArray(payload.notes) ? payload.notes : [];
    const summary = report.summary;
    const aiInsight = String(payload.aiInsight || '').trim();
    const folderLabel = (report.notes || []).find(note => note.weekLabel)?.weekLabel || '';
    const top = report.brandActions[0];
    const body = [
      new Paragraph({text:'饮品行业观察报告',heading:HeadingLevel.TITLE,alignment:AlignmentType.LEFT,style:'Title'}),
      new Paragraph({children:[new TextRun({text:`已复核快照 · ${folderLabel ? '文件夹：'+folderLabel+' · ' : ''}生成时间 ${new Date().toLocaleString('zh-CN')}`,color:'666666',font:{name:'Microsoft YaHei',eastAsia:'Microsoft YaHei'},size:20})],spacing:{after:260}}),
      new Paragraph({text:'核心结论',heading:HeadingLevel.HEADING_1}),
      new Paragraph({children:[new TextRun({text:top?`${top.primaryBrand}「${top.name}」在当前已确认样本中表现最高，共 ${top.metrics.noteCount} 篇内容，累计 ${top.metrics.likes.toLocaleString('zh-CN')} 赞。`:'当前没有可用动作数据。',font:{name:'Microsoft YaHei',eastAsia:'Microsoft YaHei'},size:22})],spacing:{after:180}}),
      new Paragraph({children:[new TextRun({text:'该结论仅描述本次导入样本，不代表全平台份额或销售表现。',italics:true,color:'666666',font:{name:'Microsoft YaHei',eastAsia:'Microsoft YaHei'},size:19})],spacing:{after:260}}),
      ...(aiInsight ? [new Paragraph({text:'DeepSeek 辅助分析',heading:HeadingLevel.HEADING_1}),...aiInsight.split(/\r?\n/).filter(Boolean).map(text=>new Paragraph({text,style:'Normal'}))] : []),
      new Paragraph({text:'关键指标',heading:HeadingLevel.HEADING_1}),
      new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[
        new TableRow({children:[textCell('指标',true,'E8EEF5'),textCell('结果',true,'E8EEF5'),textCell('口径',true,'E8EEF5')]}),
        ...[['已确认内容',summary.noteCount,'通过人工复核并纳入统计'],['品牌动作',report.brandActions.length,'按品牌与动作名称归并'],['累计点赞',summary.likes.toLocaleString('zh-CN'),'按已确认内容求和'],['千赞内容',summary.viralNoteCount,'点赞数不低于 1,000']].map(row=>new TableRow({children:row.map(v=>textCell(v))}))
      ]}),
      new Paragraph({text:'品牌动作表现',heading:HeadingLevel.HEADING_1,spacing:{before:300}}),
      new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[
        new TableRow({children:['排名','品牌动作','模块','内容数','累计点赞'].map(v=>textCell(v,true,'172761'))}),
        ...report.brandActions.slice(0,10).map((a,i)=>new TableRow({children:[textCell(String(i+1)),textCell(`${a.primaryBrand} · ${a.name}`),textCell(a.modules.join('、')),textCell(a.metrics.noteCount),textCell(a.metrics.likes.toLocaleString('zh-CN'))]}))
      ]}),
      new Paragraph({text:'证据明细',heading:HeadingLevel.HEADING_1,spacing:{before:300}}),
      ...notes.map((n,i)=>new Paragraph({children:[new TextRun({text:`${i+1}. ${n.title || n.content?.title || ''}`,bold:true,font:{name:'Microsoft YaHei',eastAsia:'Microsoft YaHei'},size:21}),new TextRun({text:`\n${n.brand || ''} · ${n.source_account || n.source?.accountName || ''} · ${n.published_date || n.publishedDate || ''} · ${(Number(n.likes || n.metrics?.likes)||0).toLocaleString('zh-CN')} 赞\n模块：${Array.isArray(n.modules)?n.modules.join('、'):(n.modules||'未标注')} · 复核说明：${n.reason || '已确认'}`,font:{name:'Microsoft YaHei',eastAsia:'Microsoft YaHei'},size:19})],spacing:{after:150}})),
      new Paragraph({text:'数据说明',heading:HeadingLevel.HEADING_1,spacing:{before:300}}),
      ...['统计只基于已确认内容，已排除内容不计入报告。','同一帖子可以属于多个观察模块，因此模块数字不应直接相加。','点赞指标保留采集截点，当前报告没有历史周期，不展示趋势判断。'].map(text=>new Paragraph({text,bullet:{level:0},style:'Normal'}))
    ];
    return new Document({styles:{default:{document:{run:{font:'Microsoft YaHei',eastAsia:'Microsoft YaHei',size:21},paragraph:{spacing:{line:276}}}}},sections:[{properties:{page:{margin:{top:900,right:1000,bottom:900,left:1000}}},children:body}]});
  };
  try {
    const url = new URL(req.url, 'http://localhost');
    if(req.method === 'GET' && url.pathname === '/healthz') return send(200,'text/plain; charset=utf-8','ok');
    if(req.method === 'GET' && url.pathname === '/') {
      const html = fs.readFileSync(path.join(__dirname,'landing.html'),'utf8').replaceAll('{{ORIGIN}}',siteOrigin());
      return send(200,'text/html; charset=utf-8',html,{'Cache-Control':'public, max-age=300'});
    }
    if(req.method === 'GET' && url.pathname === '/robots.txt') return send(200,'text/plain; charset=utf-8',`User-agent: *\nAllow: /\nDisallow: /app\nSitemap: ${siteOrigin()}/sitemap.xml\n`,{'Cache-Control':'public, max-age=3600'});
    if(req.method === 'GET' && url.pathname === '/sitemap.xml') return send(200,'application/xml; charset=utf-8',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteOrigin()}/</loc></url><url><loc>${siteOrigin()}/privacy</loc></url></urlset>`,{'Cache-Control':'public, max-age=3600'});
    if(url.pathname.startsWith('/api/capture/')) {
      const requestOrigin=req.headers.origin||'', localOrigin=requestOrigin===siteOrigin(), extensionOrigin=requestOrigin.startsWith('chrome-extension://')||requestOrigin.startsWith('moz-extension://');
      const cors=extensionOrigin?{'Access-Control-Allow-Origin':requestOrigin,'Access-Control-Allow-Headers':'Content-Type, X-Signal-Collector, X-Signal-Token','Access-Control-Allow-Methods':'POST, OPTIONS'}:{};
      if(req.method==='OPTIONS'&&extensionOrigin)return send(204,'text/plain','',cors);
      if(req.method==='GET'&&url.pathname==='/api/capture/latest')return send(200,'application/json; charset=utf-8',JSON.stringify({capture:captureQueue.at(-1)?.capture||null,sequence:captureSequence}));
      if(req.method==='GET'&&url.pathname==='/api/capture/pending'){
        const after=Number(url.searchParams.get('after')||0);
        return send(200,'application/json; charset=utf-8',JSON.stringify({captures:captureQueue.filter(item=>item.sequence>after).map(item=>item.capture),sequence:captureSequence}));
      }
      if(req.method==='POST'&&url.pathname==='/api/capture/note'){
        if((!extensionOrigin&&!localOrigin)||req.headers['x-signal-collector']!=='1'||(CAPTURE_TOKEN&&req.headers['x-signal-token']!==CAPTURE_TOKEN))return send(403,'application/json; charset=utf-8',JSON.stringify({error:'采集助手未获授权'}),cors);
        const capture=JSON.parse(await readBody(128*1024));
        if(!capture||typeof capture!=='object'||!String(capture.note_id||'').trim()||!String(capture.title||'').trim())return send(400,'application/json; charset=utf-8',JSON.stringify({error:'缺少 note_id 或 title'}),cors);
        captureQueue.push({sequence:++captureSequence,capture});if(captureQueue.length>200)captureQueue.shift();
        return send(200,'application/json; charset=utf-8',JSON.stringify({ok:true,sequence:captureSequence}),cors);
      }
      if(req.method==='POST'&&url.pathname==='/api/capture/batch'){
        if((!extensionOrigin&&!localOrigin)||req.headers['x-signal-collector']!=='1'||(CAPTURE_TOKEN&&req.headers['x-signal-token']!==CAPTURE_TOKEN))return send(403,'application/json; charset=utf-8',JSON.stringify({error:'采集助手未获授权'}),cors);
        const captures=JSON.parse(await readBody(2*1024*1024));
        if(!Array.isArray(captures)||captures.length>200)return send(400,'application/json; charset=utf-8',JSON.stringify({error:'批量数据格式错误'}),cors);
        for(const capture of captures){if(!capture||!String(capture.note_id||'').trim()||!String(capture.title||'').trim())continue;captureQueue.push({sequence:++captureSequence,capture});}
        while(captureQueue.length>200)captureQueue.shift();
        return send(200,'application/json; charset=utf-8',JSON.stringify({ok:true,count:captures.length,sequence:captureSequence}),cors);
      }
      return send(404,'application/json; charset=utf-8',JSON.stringify({error:'未知采集接口'}),cors);
    }
    if(req.method === 'POST' && url.pathname === '/api/ai/analyze') {
      const origin = req.headers.origin || '';
      if(origin && origin !== siteOrigin()) return send(403,'application/json; charset=utf-8',JSON.stringify({error:'仅接受当前工作台请求'}));
      const apiKey = String(req.headers['x-deepseek-key'] || '').trim();
      if(!apiKey) return send(400,'application/json; charset=utf-8',JSON.stringify({error:'请先填写 DeepSeek API Key'}));
      const payload = JSON.parse(await readBody(512*1024));
      if(!payload.report?.summary || !Array.isArray(payload.report?.brandActions) || !Array.isArray(payload.notes)) return send(400,'application/json; charset=utf-8',JSON.stringify({error:'缺少可分析的已确认报告数据'}));
      let upstream;
      try {
        upstream = await fetch('https://api.deepseek.com/chat/completions',{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:'deepseek-flash',messages:[{role:'system',content:DEEPSEEK_PROMPT},{role:'user',content:`请分析以下已复核报告与证据：\n${JSON.stringify(payload)}`}],thinking:{type:'disabled'},temperature:0.2,max_tokens:1800,stream:false}),signal:AbortSignal.timeout(45000)});
      } catch {
        throw Object.assign(new Error('DeepSeek 请求超时或网络不可用，请稍后重试'),{status:504});
      }
      const data = await upstream.json().catch(()=>({}));
      if(!upstream.ok) throw Object.assign(new Error(data.error?.message || `DeepSeek 请求失败（${upstream.status}）`),{status:502});
      const analysis = String(data.choices?.[0]?.message?.content || '').trim();
      if(!analysis){const reason=data.choices?.[0]?.finish_reason;throw Object.assign(new Error(reason==='length'?'DeepSeek 输出被截断，请重新生成':'DeepSeek 未返回正文，请重新生成'),{status:502});}
      return send(200,'application/json; charset=utf-8',JSON.stringify({analysis,model:'deepseek-flash'}));
    }
    if(req.method === 'POST' && url.pathname === '/api/report') {
      let body = ''; for await(const chunk of req) { body += chunk; if(Buffer.byteLength(body)>IMPORT_LIMIT) return send(413,'application/json; charset=utf-8',JSON.stringify({error:'文件上限为 10 MB'})); }
      return send(200,'application/json; charset=utf-8',JSON.stringify(convert(body,'demo 已复核数据')));
    }
    if(req.method === 'POST' && url.pathname === '/api/report.docx') {
      const payload = JSON.parse(await readBody(2*1024*1024));
      const buffer = await Packer.toBuffer(reportDoc(payload));
      return send(200,'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer,{'Content-Disposition':'attachment; filename="signal-report.docx"','Content-Length':buffer.length});
    }
    if(req.method !== 'GET' || !files[url.pathname]) return send(404,'text/plain; charset=utf-8','Not found');
    const [file,type] = files[url.pathname]; send(200,type,fs.readFileSync(path.join(__dirname,file)));
  } catch(error) { send(error.status || 400,'application/json; charset=utf-8',JSON.stringify({error:error.message})); }
}).listen(PORT,'0.0.0.0',()=>console.log(`Signal: http://127.0.0.1:${PORT}`));
