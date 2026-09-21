const fs = require('node:fs');
const path = require('node:path');
const Papa = require('papaparse');
const allowedModules = ['新品', '联名', '活动'];
const list = value => [...new Set(String(value || '').split(/[|｜]/).map(s => s.trim()).filter(Boolean))];
function metrics(notes) {
  const likes = notes.reduce((sum, note) => sum + note.metrics.likes, 0);
  return { noteCount: notes.length, likes, averageLikes: notes.length ? likes / notes.length : 0,
    viralNoteCount: notes.filter(note => note.metrics.likes >= 1000).length };
}
function convert(csv, source = 'CSV') {
  const parsed = Papa.parse(csv.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: h => h.trim() });
  if (parsed.errors.length) throw new Error(`CSV解析失败: ${JSON.stringify(parsed.errors)}`);
  const required = ['note_id', 'action_id', 'brand', 'action_name', 'title', 'published_date', 'likes', 'likes_captured_at', 'modules'];
  if (required.some(key => !parsed.meta.fields?.includes(key))) throw new Error(`缺少表头，必需字段: ${required.join(', ')}`);
  const seen = new Set();
  const notes = parsed.data.map((row, i) => {
    required.forEach(key => { if (!String(row[key] || '').trim()) throw new Error(`第${i + 2}行缺少${key}`); });
    const id = row.note_id.trim();
    if (seen.has(id)) throw new Error(`重复笔记ID: ${id}，请先确定保留哪个指标截点`);
    seen.add(id);
    if (!/^\d+$/.test(row.likes.trim()) || !Number.isSafeInteger(Number(row.likes))) throw new Error(`非法点赞: ${id}`);
    const modules = list(row.modules);
    if (modules.some(m => !allowedModules.includes(m))) throw new Error(`非法模块: ${id}`);
    const date = row.published_date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error(`非法发布日期: ${id}`);
    if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(row.likes_captured_at) || !Number.isFinite(Date.parse(row.likes_captured_at))) throw new Error(`指标截点需包含时区: ${id}`);
    const url = row.url?.trim() || '';
    if (url && !['https:', 'http:'].includes(new URL(url).protocol)) throw new Error(`非法链接: ${id}`);
    return { id, actionId: row.action_id.trim(), brand: row.brand.trim(), actionName: row.action_name.trim(),
      modules, publishedDate: date, weekId: row.week_id || '', weekLabel: row.week_label || '', content: { title: row.title }, source: { accountName: row.source_account || '', type: row.source_type || '' },
      metrics: { likes: Number(row.likes), likesCapturedAt: row.likes_captured_at },
      collaboration: { peripherals: list(row.peripherals) }, link: url };
  });
  const groups = new Map();
  for (const note of notes) {
    const group = groups.get(note.actionId) || [];
    if (group.length && (group[0].brand !== note.brand || group[0].actionName !== note.actionName)) throw new Error(`同一动作ID的品牌或名称冲突: ${note.actionId}`);
    group.push(note); groups.set(note.actionId, group);
  }
  const brandActions = [...groups].map(([id, group]) => ({ id, name: group[0].actionName, primaryBrand: group[0].brand,
    modules: [...new Set(group.flatMap(n => n.modules))],
    primaryModule: ['联名', '新品', '活动'].find(m => group.some(n => n.modules.includes(m))),
    noteIds: group.map(n => n.id), metrics: metrics(group),
    moduleMetrics: Object.fromEntries(allowedModules.map(m => [m, metrics(group.filter(n => n.modules.includes(m)))])),
    collaboration: { peripherals: [...new Set(group.flatMap(n => n.collaboration.peripherals))] }
  })).sort((a,b) => b.metrics.likes - a.metrics.likes);
  return { meta: { schemaVersion: 'radar-kit-0.1', generatedAt: new Date().toISOString(), source,
    constraints: ['数据来自导入表，非实时采集；模块可重叠；示例文件为虚构数据。'] },
    summary: { ...metrics(notes), brandActionCount: brandActions.length,
      moduleSummary: Object.fromEntries(allowedModules.map(m => [m, metrics(notes.filter(n => n.modules.includes(m)))])) }, brandActions, notes };
}
if (require.main === module) {
  try {
    const [input, output = 'output/report.json'] = process.argv.slice(2);
    if (!input) throw new Error('用法: npm run import -- 输入.csv 输出.json（Excel先另存为CSV UTF-8）');
    const result = convert(fs.readFileSync(input, 'utf8'), path.basename(input));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const temp = output + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(result, null, 2)); fs.renameSync(temp, output);
    console.log(`已生成${output}：${result.notes.length}篇笔记，${result.brandActions.length}个动作，${result.summary.likes}赞`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { convert };
