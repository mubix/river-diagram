const {chromium,base,artifact,axePath,webAsset}=require('./config.cjs');
const fs=require('fs');const assert=require('assert/strict');
const source={title:'Email threat reduction',subtitle:'How layered controls reduce daily exposure',sourceValue:4000000,sourceLabel:'emails received / day',sourceColor:'#215e91',background:'#ffffff',scale:'exact',style:'gate',showPercent:true,palette:{river:'#215e91',control:'#4d9eaa',accent:'#16384f'},note:'Illustrative values. Replace with your measurements and assumptions.',controls:[2000000,12000,240,4,0].map((remaining,i)=>({id:String(i),name:['Spam filtering','Email authentication','Attachment & URL analysis','User reporting & response','Endpoint protection'][i],remaining,label:['emails remaining','suspicious emails','phishing attempts','phishing emails delivered','incidents'][i],riverColor:'#215e91',controlColor:'#4d9eaa'}))};
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1600,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(process.env.PREVIEW==='1')await p.route('**/*',route=>{const path=new URL(route.request().url()).pathname;const files={'/':'index.html','/app.js':'app.js','/diagram.js':'diagram.js','/style.css':'style.css'};return files[path]?route.fulfill({path:webAsset(files[path])}):route.continue()});
 await p.goto(base);await p.waitForSelector('#canvas svg');
 const fixtures=[['exact',source],['presentation',{...source,scale:'presentation'}],['dark',{...source,scale:'presentation',background:'#132c40',sourceColor:'#69bed2',controls:source.controls.map(c=>({...c,riverColor:'#69bed2',controlColor:'#debb72'}))}],['custom',{...source,sourceColor:'#8b4464',controls:source.controls.map((c,i)=>({...c,remaining:[2800000,1600000,800000,280000,0][i],riverColor:'#8b4464',controlColor:'#b4814f'}))}],['white',{...source,background:'#152c42',sourceColor:'#ffffff',controls:source.controls.map(c=>({...c,riverColor:'#ffffff',controlColor:'#ffffff'}))}],['zero',{...source,controls:[{...source.controls[0],remaining:0},{...source.controls[1],remaining:0}]}]];
 const cases=[];
 for(const [name,r] of fixtures){
  const svg=await p.evaluate(async r=>(await import('/diagram.js')).diagram(r),r);
  const q=await b.newPage({viewport:{width:1600,height:900}});await q.setContent('<style>body{margin:0}</style>'+svg);
  const measurement=await q.evaluate(()=>{
   const flows=[...document.querySelectorAll('[data-flow],[data-final-flow]')];const gates=[...document.querySelectorAll('[data-gate]')];
   function crossSection(el,x){const box=el.getBBox(),center=+el.dataset.center;let lo=box.y-1,hi=center;
    for(let i=0;i<45;i++){const m=(lo+hi)/2;if(el.isPointInFill(new DOMPoint(x,m)))hi=m;else lo=m}const top=(lo+hi)/2;lo=center;hi=box.y+box.height+1;
    for(let i=0;i<45;i++){const m=(lo+hi)/2;if(el.isPointInFill(new DOMPoint(x,m)))lo=m;else hi=m}return {top,bottom:(lo+hi)/2,width:(lo+hi)/2-top};}
   const sections=flows.map(el=>{const a=+el.dataset.start,z=+el.dataset.end;return {expected:+el.dataset.width,samples:[.00001,.15,.33,.5,.67,.85,.99999].map(t=>crossSection(el,a+(z-a)*t))}});
   const attached=gates.filter(g=>+g.dataset.incoming>0).map(g=>{const flow=document.querySelector(`[data-flow="${g.dataset.gate}"]`),upper=g.querySelector('[data-gate-leaf=upper]').getBBox(),lower=g.querySelector('[data-gate-leaf=lower]').getBBox(),section=crossSection(flow,+flow.dataset.end-.00001);return {top:section.top-upper.y,bottom:section.bottom-lower.y-lower.height}});
   const ids=[...document.querySelectorAll('[id]')].map(n=>n.id),urls=[...document.querySelectorAll('[fill^="url"]')].map(n=>n.getAttribute('fill').slice(5,-1));
   return {sections,attached,banks:document.querySelectorAll('[data-river-bank]').length,currents:document.querySelectorAll('[data-water-current]').length,allGradientsResolve:urls.every(id=>ids.includes(id)),uniqueIds:new Set(ids).size===ids.length};
  });
  // Chromium's SVG hit-testing uses floats; tolerance scales with width for subpixel paths.
  for(const row of measurement.sections)for(const v of row.samples)assert(Math.abs(v.width-row.expected)<.002,`${name}: cross section ${v.width} != ${row.expected}`);
  for(const v of measurement.attached){assert(Math.abs(v.top)<.002);assert(Math.abs(v.bottom)<.002)}
  assert(measurement.allGradientsResolve&&measurement.uniqueIds);assert(measurement.banks>=2);assert(measurement.currents>0);
  await q.screenshot({path:artifact(`river-${name}.jpg`),quality:90});cases.push({name,...measurement});await q.close();
 }
 // Transparent SVG has no canvas rectangle, external assets or filters; check actual pixel alpha.
 const transparent=await p.evaluate(async r=>(await import('/diagram.js')).diagram(r,{transparent:true}),source);
 const alpha=await p.evaluate(async svg=>{const blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob);const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=1600;c.height=900;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const sample=(x,y)=>[...ctx.getImageData(x,y,1,1).data];const result={corner:sample(10,10),water:sample(125,450),bank:sample(90,310)};URL.revokeObjectURL(url);return result},transparent);
 assert.equal(alpha.corner[3],0);assert.equal(alpha.water[3],255);assert.equal(alpha.bank[3],255);assert(!/<image|<filter|https?:/.test(transparent.replace('http://www.w3.org/2000/svg','')));
 // Two river drawings can coexist without their gradients colliding.
 const pair=await p.evaluate(async r=>{const m=await import('/diagram.js');return m.diagram(r)+m.diagram(r)},source);const q=await b.newPage();await q.setContent(pair);assert(await q.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return new Set(ids).size===ids.length}));await q.close();
 assert.deepEqual(errors,[]);fs.writeFileSync(artifact('river-detail-results.json'),JSON.stringify({preview:process.env.PREVIEW==='1',cases,alpha,errors},null,2));console.log('PASS six palette/scale cases, sampled water widths, attached symmetric gates, standalone gradients and transparent SVG pixels');await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
