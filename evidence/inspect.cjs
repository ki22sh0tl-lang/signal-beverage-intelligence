const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('evidence/report-data.js', 'utf8'), sandbox);
const d = sandbox.window.DRINK_RADAR_DATA;
const sums = d.notes.reduce((s,n)=>s+n.metrics.likes,0);
const out = {
  keys: Object.keys(d), meta: d.meta, summary: d.summary,
  counts: {notes:d.notes.length, actions:d.brandActions.length, likesRecalculated:sums},
  noteKeys:Object.keys(d.notes[0]), actionKeys:Object.keys(d.brandActions[0]),
  dictionaries:d.dictionaries,
  files: ['index.html','app.js','styles.css','report-data.js','xlsx-export.js'].map(f=>({file:f,bytes:fs.statSync('evidence/'+f).size})),
  toyActions:d.brandActions.filter(a=>a.collaboration.peripherals.includes('玩偶')).map(a=>({id:a.id,name:a.name,modules:a.modules,notes:a.noteIds.length})),
};
fs.writeFileSync('evidence/inspection.json',JSON.stringify(out,null,2));
console.log(JSON.stringify({keys:out.keys,counts:out.counts,files:out.files,toyActions:out.toyActions},null,2));
