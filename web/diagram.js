export const PAGE_SIZE = 5;
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const countLabel = r => typeof r.countLabel==='string' && r.countLabel.trim() ? r.countLabel.trim().replace(/\s+/g,' ') : 'blocked';
export const number = n => new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n);
export function compact(n) { if(n>=1e12)return `${+(n/1e12).toFixed(2)}T`;if(n>=1e9)return `${+(n/1e9).toFixed(2)}B`;if(n>=1e6)return `${+(n/1e6).toFixed(2)}M`;if(n>=1e3)return `${+(n/1e3).toFixed(2)}K`;return number(n); }
export function percent(removed, incoming) { if(!incoming)return '0%';if(removed===incoming)return '100%';const p=100*removed/incoming;if(p>99.99)return '>99.99%';if(p>0&&p<.01)return '<0.01%';return `${+p.toFixed(2)}%`; }
export function thickness(value,source,scale) { if(value===0)return 0;const ratio=value/source;if(scale==='exact'||ratio>=.1)return 260*ratio;return Math.max(4,26*(Math.log10(value)+1)/(Math.log10(source*.1)+1)); }
export function textColor(hex) { const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4); return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.36?'#152c42':'#f6f9fc'; }
function wrap(text,max) { const words=String(text).split(/\s+/);const lines=[];let line=''; for(let word of words){while(word.length>max){if(line){lines.push(line);line=''}lines.push(word.slice(0,max));word=word.slice(max)}if(!word)continue;if((line+' '+word).trim().length>max){lines.push(line);line=word}else line=(line+' '+word).trim()}if(line)lines.push(line);return lines; }
let measureContext;
function measuredLines(text,width,size,weight){
 if(!measureContext&&typeof document!=='undefined')measureContext=document.createElement('canvas').getContext('2d');
 if(measureContext)measureContext.font=weight+' '+size+'px Aptos, "Segoe UI", Arial, sans-serif';
 const measure=value=>measureContext?measureContext.measureText(value).width:[...value].length*size*.56;
 const lines=[];let line='';
 for(let word of String(text).split(/\s+/)){
  if(!word)continue;
  if(measure(word)>width){if(line){lines.push(line);line=''}let piece='';for(const ch of word){if(piece&&measure(piece+ch)>width){lines.push(piece);piece=ch}else piece+=ch}word=piece}
  if(line&&measure(line+' '+word)>width){lines.push(line);line=word}else line=(line+' '+word).trim();
 }
 if(line)lines.push(line);return lines;
}
function label(text,x,y,{size=24,color='#152c42',weight=400,max=22,anchor='start',line=1.22,width,height,minSize=10}={}) {
 width=width||max*size*.55;height=height||size*line*3;
 let lines=measuredLines(text,width,size,weight);
 while(size>minSize&&lines.length*size*line>height){size-=.5;lines=measuredLines(text,width,size,weight)}
 return '<text x="'+x+'" y="'+y+'" font-size="'+size+'" font-weight="'+weight+'" fill="'+color+'" text-anchor="'+anchor+'">'+lines.map((t,i)=>'<tspan x="'+x+'" dy="'+(i?size*line:0)+'">'+esc(t)+'</tspan>').join('')+'</text>';
}
function canvasStart(title,width=1600,height=900) {return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}" font-family="Aptos, Segoe UI, Arial, sans-serif"><title>${esc(title)}</title>`}
// All decoration is vector geometry. The water cross-section remains exact;
// banks and hardware are outside it and never widen a later-stage gate leaf.
let drawingSequence=0;
function mix(a,b,t){return '#'+[0,2,4].map(i=>Math.round(parseInt(a.slice(i+1,i+3),16)*(1-t)+parseInt(b.slice(i+1,i+3),16)*t).toString(16).padStart(2,'0')).join('')}
function waterReach(start,end,center,width,color,background,key,attribute,{bend=true}={}){
 if(width<=0)return '';
 const length=end-start,amplitude=bend?Math.min(10,width*.075,length*.055):0;
 const curve=(edge,reverse=false)=>{
  const y=center+edge,a=amplitude;
  return reverse?`C${start+length*.83} ${y} ${start+length*.83} ${y-a} ${start+length*.67} ${y-a}C${start+length*.5} ${y-a} ${start+length*.5} ${y+a} ${start+length*.33} ${y+a}C${start+length*.17} ${y+a} ${start+length*.17} ${y} ${start} ${y}`:`C${start+length*.17} ${y} ${start+length*.17} ${y+a} ${start+length*.33} ${y+a}C${start+length*.5} ${y+a} ${start+length*.5} ${y-a} ${start+length*.67} ${y-a}C${start+length*.83} ${y-a} ${start+length*.83} ${y} ${end} ${y}`;
 };
 const ribbon=(top,bottom)=>`M${start} ${center+top}${curve(top)}L${end} ${center+bottom}${curve(bottom,true)}Z`;
 const water=ribbon(-width/2,width/2),bank=Math.min(15,width*.14),edge=Math.min(2,width*.025);
 const bankColor=mix(color,background,.79),shoreColor=mix(color,background,.48),deep=mix(color,'#000000',.18),light=mix(color,'#ffffff',.17);
 let out=`<g data-river-reach="${key}" aria-hidden="true"><defs><linearGradient id="${key}-water" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${deep}"/><stop offset=".22" stop-color="${color}"/><stop offset=".56" stop-color="${light}"/><stop offset=".84" stop-color="${color}"/><stop offset="1" stop-color="${deep}"/></linearGradient></defs>`;
 // Narrow, tinted shore shelves follow both banks. They do not cross the flow.
 for(const side of [-1,1]){
  const inner=side*width/2,outer=inner+side*bank;
  out+=`<path data-river-bank="${side}" d="${ribbon(Math.min(inner,outer),Math.max(inner,outer))}" fill="${bankColor}"/>`;
  out+=`<path d="M${start} ${center+inner}${curve(inner)}" fill="none" stroke="${shoreColor}" stroke-width="${edge*2}"/>`;
  if(width>=24)out+=`<path d="M${start} ${center+outer}${curve(outer)}" fill="none" stroke="${bankColor}" stroke-width="1" stroke-opacity=".6"/>`;
 }
 out+=`<path ${attribute} data-width="${width}" data-start="${start}" data-end="${end}" data-center="${center}" d="${water}" fill="url(#${key}-water)"/>`;
 // Sparse current highlights read as water at slide size, without a raster texture.
 if(width>=8&&length>22){
  const weight=Math.min(1.5,width*.018);
  for(const [i,fraction] of [-.32,-.12,.13,.34].entries()){
   const inset=10+(i%2)*13,finish=end-12-(i%3)*9;
   if(finish<=start+inset+12)continue;
   const y=center+width*fraction,mid=(start+inset+finish)/2,wave=Math.min(4,width*.025);
   out+=`<path data-water-current="true" d="M${start+inset} ${y}C${mid-15} ${y+wave} ${mid+6} ${y-wave} ${finish} ${y}" fill="none" stroke="${mix(color,'#ffffff',.8)}" stroke-opacity=".33" stroke-width="${weight}" stroke-linecap="round"/>`;
  }
  // Short, offset ripples avoid a repeated stripe pattern.
  for(let i=0;i<3;i++){
   const x=start+length*(.24+i*.25),y=center+width*([.25,-.25,.05][i]),span=Math.min(18,length*.12);
   out+=`<path d="M${x} ${y}q${span*.5} ${-Math.min(2,width*.02)} ${span} 0" fill="none" stroke="#ffffff" stroke-opacity=".23" stroke-width="${weight*.8}" stroke-linecap="round"/>`;
  }
 }
 return out+'</g>';
}
function gateHardware(position,center,incoming,opening,half,color,background,{vertical=false}={}){
 const span=(incoming-opening)/2,outer=center-incoming/2,inner=center+opening/2;
 const dark=mix(color,'#000000',.4),light=mix(color,'#ffffff',.4),support=mix(color,background,.68);
 // In vertical diagrams the local normal maps left-to-right (the upper leaf is left).
 const panel=(at,side)=>{
  const name=vertical?(side==='upper'?'left':'right'):side;
  let markup=vertical?`<rect data-gate-leaf="${name}" x="${at}" y="${position-half}" width="${span}" height="${half*2}" fill="${color}"/>`:`<rect data-gate-leaf="${name}" x="${position-half}" y="${at}" width="${half*2}" height="${span}" fill="${color}"/>`;
  // Thin inset bevels, braces and a rounded nose give the leaf a material surface.
  if(span>=3){
   const inset=Math.min(1.4,span*.18),radius=Math.min(1.8,span*.15);
   const shape=(u,v,w,h,attrs)=>vertical?`<rect x="${v}" y="${u}" width="${h}" height="${w}" ${attrs}/>`:`<rect x="${u}" y="${v}" width="${w}" height="${h}" ${attrs}/>`;
   markup+=shape(position-half+inset,at+inset,half*2-inset*2,span-inset*2,`rx="${radius}" fill="none" stroke="${dark}" stroke-width="${Math.min(1,span*.08)}"`);
   markup+=shape(position-half+2.5,at+inset+1,2,Math.max(0,span-inset*2-2),`rx="1" fill="${light}" opacity=".65"`);
   const ribs=Math.floor(span/15);
   for(let j=1;j<=ribs;j++)markup+=shape(position-half+4,at+span*j/(ribs+1),half*2-8,1.3,`fill="${dark}" opacity=".5"`);
  }
  return markup;
 };
 let out='<g data-gate-hardware="true" aria-hidden="true">';
 if(incoming>=10){
  const depth=Math.min(10,incoming*.09),pad=half+4;
  const shape=(u,v,w,h,attrs)=>vertical?`<rect x="${v}" y="${u}" width="${h}" height="${w}" ${attrs}/>`:`<rect x="${u}" y="${v}" width="${w}" height="${h}" ${attrs}/>`;
  for(const side of [-1,1]){
   const edge=center+side*incoming/2,at=side<0?edge-depth:edge;
   out+=shape(position-pad,at,pad*2,depth,`rx="${Math.min(2,depth*.3)}" fill="${support}"`);
   out+=shape(position-half+3,at+depth*.22,half*2-6,depth*.56,`rx="1" fill="${dark}" opacity=".55"`);
  }
 }
 out+=panel(outer,'upper')+panel(inner,'lower');
 return out+'</g>';
}

function reductionText(incoming,remaining){return incoming>0?`${percent(incoming-remaining,incoming)} reduction`:'No incoming flow'}
export function diagram(r,{page=0,transparent=false,interactive=false}={}) {
 const pages=Math.max(1,Math.ceil(r.controls.length/PAGE_SIZE));page=Math.max(0,Math.min(page,pages-1));const offset=page*PAGE_SIZE,controls=r.controls.slice(offset,offset+PAGE_SIZE);
 const startValue=offset?r.controls[offset-1].remaining:r.sourceValue,startLabel=offset?(r.controls[offset-1].label||'remaining'):r.sourceLabel,startColor=offset?r.controls[offset-1].riverColor:r.sourceColor;
 const fg=textColor(r.background),muted=fg==='#152c42'?'#526778':'#b6c7d6',lineColor=fg==='#152c42'?'#d9e2e8':'#40566a';
 const count=controls.length,step=1370/Math.max(count+.5,1.5),x0=90,centerY=450,gateHalf=9,showPercent=r.showPercent!==false;
 const nodes=[{value:startValue,label:startLabel,color:startColor,x:x0},...controls.map((c,i)=>({value:c.remaining,label:c.label||'remaining',color:c.riverColor,x:x0+step*(i+1),control:c,index:offset+i}))];
 let out=canvasStart(r.title);if(interactive)out=out.replace('role="img"','role="group"');
 out+=`<desc>${esc(`${r.sourceLabel}: ${number(r.sourceValue)}. ${r.controls.map((c,i)=>`${c.name}: ${number(c.remaining)} ${c.label||'remaining'}${showPercent?', '+reductionText(i?r.controls[i-1].remaining:r.sourceValue,c.remaining):''}`).join('. ')}. Each pair of gate leaves spans only the incoming river and represents the reduction in quantity; the remaining river passes through the centered opening. ${r.scale==='exact'?'Widths proportional to quantities.':'Widths adjusted for readability; labels show exact quantities.'}`)}</desc>`;
 if(!transparent)out+=`<rect width="1600" height="900" fill="${r.background}"/>`;
 out+=`<path d="M90 67h44" stroke="${r.palette.accent}" stroke-width="6"/>`;
 out+=label(r.title,90,r.title.length>73?104:124,{size:r.title.length>65?34:42,weight:650,color:fg,max:73,width:1420,height:82});
 if(r.subtitle)out+=label(r.subtitle,90,r.title.length>73?182:169,{size:22,color:muted,max:122,width:1420,height:52});
 const paths=[],gates=[],drawingKey=`river-${++drawingSequence}`;let cursor=x0;
 for(let i=1;i<nodes.length;i++) {
  const a=nodes[i-1],b=nodes[i],incoming=thickness(a.value,r.sourceValue,r.scale),opening=thickness(b.value,r.sourceValue,r.scale),gx=b.x-step*.45,upperBank=centerY-incoming/2,lowerBank=centerY+incoming/2,leafSpan=(incoming-opening)/2;
  if(incoming>0)paths.push(waterReach(cursor,gx+gateHalf,centerY,incoming,a.color,r.background,`${drawingKey}-${i}`,`data-flow="${b.index}"`));
  const attributes=interactive?`data-stage="${b.index}" tabindex="0" role="button" aria-label="Edit ${esc(b.control.name)}"`:'';
  let gate=`<g data-gate="${b.index}" data-opening="${opening}" data-incoming="${incoming}" ${attributes}>`;
  if(interactive)gate+=`<rect class="stage-hit" x="${gx-27}" y="${centerY-Math.max(44,incoming+24)/2}" width="54" height="${Math.max(44,incoming+24)}" rx="4" fill="transparent"/><rect class="stage-hit" x="${gx-step*.43}" y="640" width="${step*.86}" height="151" rx="6" fill="transparent"/>`;
  gate+=gateHardware(gx,centerY,incoming,opening,gateHalf,b.control.controlColor,r.background);
  gate+=`<path d="M${gx} ${lowerBank+16}V640" stroke="${lineColor}" stroke-width="1.5"/>`;
  gate+=label(b.control.name,gx,665,{size:23,weight:600,color:fg,anchor:'middle',width:Math.min(step*.84,400),height:58});
  gate+=`<g data-count-label="${b.index}">${label(`${number(a.value-b.value)} ${countLabel(r)}`,gx,742,{size:18,color:muted,anchor:'middle',width:Math.min(step*.84,360),height:32,minSize:9})}</g>`;
  if(showPercent)gate+=`<g data-reduction="${b.index}">${label(reductionText(a.value,b.value),gx,777,{size:17,color:muted,anchor:'middle',width:Math.min(step*.84,360),height:22})}</g>`;
  gates.push(gate+'</g>');cursor=gx+gateHalf-1;
 }
 const last=nodes.at(-1),lastH=thickness(last.value,r.sourceValue,r.scale),end=Math.min(last.x+step*.38,1508);
 if(lastH>0)paths.push(waterReach(cursor,end,centerY,lastH,last.color,r.background,`${drawingKey}-final`,'data-final-flow="true"'));
 out+=paths.join('')+gates.join('');
 nodes.forEach((n,i)=>{
  const h=thickness(n.value,r.sourceValue,r.scale),x=i?n.x:n.x+45;
  out+=`<g ${interactive&&i?`data-stage="${n.index}" tabindex="0" role="button" aria-label="Edit ${esc(n.control.name)}"`:''}>`;
  if(interactive&&i)out+=`<rect class="stage-hit" x="${x-step*.4}" y="215" width="${step*.8}" height="112" rx="8" fill="transparent"/>`;
  out+=label(number(n.value),x,248,{size:Math.min(36,(i?step*.8:180)/(number(n.value).length*.57)),weight:650,color:fg,anchor:'middle',max:22});
  out+=label(n.label,x,274,{size:20,color:muted,anchor:'middle',width:i?step*.8:180,height:48});
  if(i)out+=`<path d="M${x} 335V${Math.max(335,centerY-h/2-12)}" stroke="${lineColor}" stroke-width="1.5"/>`;
  out+='</g>';
 });
 if(!controls.length)out+=label('Add a control to show what changes the flow.',540,655,{size:27,color:muted,max:65});
 out+=`<path d="M90 805H1510" stroke="${lineColor}"/>`;
 out+=label(r.scale==='exact'?'Exact scale · water widths and gate spans proportional to quantity':'Presentation scale · water and gate spans adjusted for readability',90,839,{size:17,color:muted,max:95});
 out+=label(pages>1?`Slide ${page+1} of ${pages}${page?' · continued flow':''}`:'',1510,839,{size:17,color:muted,anchor:'end',max:50});
 if(r.note)out+=label(r.note,90,868,{size:15,color:muted,max:175,width:1420,height:30});
 return out+'</svg>';
}
export function comparison(a,b,{page=0,transparent=false}={}) {
 let out=canvasStart(a.title+' and '+b.title);
 if(!transparent)out+='<rect width="1600" height="900" fill="#ffffff"/>';
 out+=label('Threat reduction comparison',60,65,{size:36,weight:650,max:70});
 out+=label('Each river uses its own starting quantity. Follow the flow from top to bottom.',60,105,{size:20,color:'#526778',max:100});
 out+='<path d="M800 142V805" stroke="#d9e2e8"/>';
 [a,b].forEach((r,index)=>{
  const left=index*800,centerX=left+340.2,offset=page*PAGE_SIZE,controls=r.controls.slice(offset,offset+PAGE_SIZE),pageTotal=Math.max(1,Math.ceil(r.controls.length/PAGE_SIZE));
  out+=label(r.title,left+60,168,{size:27,weight:600,max:43,width:680,height:64});
  if(page>=pageTotal){out+=label('No more controls on this slide.',left+60,300,{size:24,color:'#526778',max:42});return}
  const start=offset?r.controls[offset-1].remaining:r.sourceValue,sl=offset?r.controls[offset-1].label:r.sourceLabel;
  let prev=start,py=282,cursor=282,color=offset?r.controls[offset-1].riverColor:r.sourceColor;
  const width=v=>thickness(v,r.sourceValue,r.scale)*.54,paths=[],gates=[],labels=[],drawingKey=`comparison-${++drawingSequence}`;
  out+=label(number(start),left+60,269,{size:27,weight:600,max:22,width:190,height:29});
  out+=label(sl,left+60,296,{size:17,color:'#526778',max:24,width:190,height:40});
  controls.forEach((c,i)=>{
   const y=360+i*90,incoming=width(prev),opening=width(c.remaining),gy=(py+y)/2,bankLeft=centerX-incoming/2,bankRight=centerX+incoming/2,leafSpan=(incoming-opening)/2;
   if(prev>0)paths.push(`<g transform="translate(${centerX} 0) rotate(90)">${waterReach(cursor,gy+6,0,incoming,color,'#ffffff',`${drawingKey}-${i}`,`data-comparison-flow="${index}-${i}"`)}</g>`);
   gates.push(`<g data-gate="${index}-${i}" data-opening="${opening}" data-incoming="${incoming}">${gateHardware(gy,centerX,incoming,opening,6,c.controlColor,'#ffffff',{vertical:true})}<path d="M${bankRight+16} ${gy}H${left+459}" stroke="#d9e2e8" stroke-width="1.5"/></g>`);
   labels.push(label(number(c.remaining),left+60,y+4,{size:26,weight:600,max:24,width:190,height:29}));
   labels.push(label(c.label||'remaining',left+60,y+24,{size:16,color:'#526778',max:26,width:190,height:34}));
   const nameLabel=label(c.name,left+475,y-27,{size:20,weight:600,max:25,width:255,height:38});
   const nameLines=(nameLabel.match(/<tspan/g)||[]).length,nameSize=Number(nameLabel.match(/font-size="([^"]+)/)[1]);
   const countMarkup=label(number(prev-c.remaining)+' '+countLabel(r),left+475,0,{size:15,color:'#526778',width:255,height:28,minSize:9});
   const countLines=(countMarkup.match(/<tspan/g)||[]).length,countSize=Number(countMarkup.match(/font-size="([^"]+)/)[1]);
   const countY=y-27+(nameLines-1)*nameSize*1.22+countSize+7,percentY=countY+(countLines-1)*countSize*1.22+18;
   labels.push(nameLabel);
   labels.push(`<g data-count-label="${index}-${i}">${countMarkup.replace(' y="0"',' y="'+countY+'"')}</g>`);
   if(r.showPercent!==false)labels.push(`<g data-reduction="${index}-${i}">${label(reductionText(prev,c.remaining),left+475,percentY,{size:14,color:'#526778',width:255,height:18})}</g>`);
   prev=c.remaining;py=y;cursor=gy+5;color=c.riverColor;
  });
  if(prev>0)paths.push(`<g transform="translate(${centerX} 0) rotate(90)">${waterReach(cursor,py+24,0,width(prev),color,'#ffffff',`${drawingKey}-final`,`data-comparison-final-flow="${index}"`)}</g>`);
  out+=paths.join('')+gates.join('')+labels.join('');
  const final=r.controls.at(-1)?.remaining??r.sourceValue;
  out+=label(percent(r.sourceValue-final,r.sourceValue)+' total reduction',left+60,804,{size:23,weight:600,max:40});
  out+=label(r.scale==='exact'?'Exact scale · proportional water and gates':'Presentation scale · adjusted water and gates',left+60,838,{size:17,color:'#526778',max:65});
  if(r.note)out+=label(r.note,left+60,866,{size:13,color:'#526778',max:115,width:680,height:30});
 });
 return out+'</svg>';
}
