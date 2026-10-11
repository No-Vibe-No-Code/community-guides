export const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const rating = level => `${level<=3?'EZ':level<=6?'HD':level<=12?'IN':'AT'} ${level}`;
export const badge = level => `<span class="cg-badge ${rating(level).split(' ')[0].toLowerCase()}">${rating(level)}</span>`;
export const safeLink = value => {try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}};
// A deliberately small, inert Markdown dialect. Raw HTML and embedded images
// stay literal; all screenshots use the separate, validated upload pipeline.
function inline(text) {
 const tokens=[];
 const keep = html => {tokens.push(html);return `\u0000${tokens.length-1}\u0000`;};
 let out=String(text).replace(/\u0000/g,'');
 out=out.replace(/`([^`]+)`/g,(_,code)=>keep('<code>'+esc(code)+'</code>'));
 out=out.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,(_,label,href)=>{const url=safeLink(href);return url?keep(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`):label;});
 out=esc(out).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>');
 return out.replace(/\u0000(\d+)\u0000/g,(_,i)=>tokens[Number(i)]||'');
}
export function markdown(source) {
 const lines=String(source||'').replace(/\r/g,'').split('\n');let out='',paragraph=[],code=null,list=null;
 const flush=()=>{if(paragraph.length){out+='<p>'+paragraph.map(inline).join('<br>')+'</p>';paragraph=[];}if(list){out+=`</${list}>`;list=null;}};
 for(const line of lines){
  if(/^```/.test(line)){if(code!==null){out+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';code=null;}else{flush();code=[];}continue;}
  if(code!==null){code.push(line);continue;}
  if(!line.trim()){flush();continue;}
  const heading=line.match(/^(#{1,4})\s+(.+)$/),item=line.match(/^\s*(?:([-*])|\d+[.)])\s+(.+)$/);
  if(heading){flush();const tag='h'+Math.min(4,heading[1].length+1);out+=`<${tag}>${inline(heading[2])}</${tag}>`;}
  else if(item){if(paragraph.length)flush();const tag=item[1]?'ul':'ol';if(list!==tag){flush();list=tag;out+=`<${tag}>`;}out+='<li>'+inline(item[2])+'</li>';}
  else {if(list)flush();paragraph.push(line);}
 }
 flush();if(code!==null)out+='<pre><code>'+esc(code.join('\n'))+'</code></pre>';return out;
}
export function importMarkdown(source, uuid = () => crypto.randomUUID()) {
 const lines=source.replace(/\r/g,'').split('\n');let title='',steps=[],current=null,fenced=false;
 for(const line of lines){
  if(/^```/.test(line))fenced=!fenced;
  if(!fenced && /^# /.test(line)&&!title){title=line.slice(2).trim();continue;}
  if(!fenced && /^## /.test(line)){current={id:uuid(),title:line.slice(3).trim(),level:1,text:'',prompt:'',images:[]};steps.push(current);continue;}
  if(!current){current={id:uuid(),title:'Introduction',level:1,text:'',prompt:'',images:[]};steps.push(current);}
  current.text+=line+'\n';
 }
 steps=steps.filter(s=>s.text.trim()||s.title!=='Introduction').map(s=>({...s,text:s.text.trim()}));
 return {title:title||'Imported guide',summary:'',topic:'Getting started',cover:null,steps:steps.length?steps:[{id:uuid(),title:'First step',level:1,text:'',prompt:'',images:[]}]};
}
