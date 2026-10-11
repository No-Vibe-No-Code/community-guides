import {esc, badge, rating, markdown, importMarkdown, externalArrow} from './format.js';
import {TOPICS, blankGuide} from '../server/content.js';
const API=typeof __COMMUNITY_API__==='string'?__COMMUNITY_API__:'https://novibenocode.ccwu.cc/api/community';
const contexts=new WeakMap();
const imageURL=id=>API+'/media/'+encodeURIComponent(id);
const link=guide=>'/community/guide/'+guide.slug+'/';
const edit=guide=>'/community/edit/'+guide.id+'/';
const isStaff=user=>['maintainer','club-leader','teacher'].includes(user?.role);
const signIn=path=>'https://novibenocode.ccwu.cc/?account=login&fromGuides=1&returnTo='+encodeURIComponent('/guides/return?path='+encodeURIComponent(path));
const request=async(path,options={})=>{
 const response=await fetch(API+path,{credentials:'include',cache:'no-store',...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(12000)]):AbortSignal.timeout(12000)});
 const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'Please try again.'),{status:response.status});return data;
};
const date=value=>value?new Intl.DateTimeFormat('en',{month:'short',day:'numeric',year:'numeric',timeZone:'Asia/Shanghai'}).format(new Date(value)):'';
const img=(id,alt,cls='')=>id?`<img class="${cls}" src="${imageURL(id)}" crossorigin="use-credentials" alt="${esc(alt)}" decoding="async">`:'';
const button=(label,action,cls='')=>`<button type="button" class="cg-button ${cls}" data-action="${action}">${label}</button>`;
const banner=(title,text,actions='')=>`<div class="cg-empty"><span class="cg-emblem" aria-hidden="true">${externalArrow}</span><h2>${esc(title)}</h2><p>${esc(text)}</p><div class="cg-actions">${actions}</div></div>`;
function header(title,sub,actions=''){
 return `<div class="cg-heading"><div><span class="cg-eyebrow">PEOPLE / IDEAS / SHARED KNOWLEDGE</span><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="cg-actions">${actions}</div></div>`;
}
function navigation(session,active='library'){
 return `<nav class="cg-tabs" aria-label="Community navigation"><a href="/community/" ${active==='library'?'aria-current="page"':''}>Library</a><a href="/community/mine/" ${active==='mine'?'aria-current="page"':''}>My guides</a>${isStaff(session.user)?`<a href="/community/moderation/" ${active==='moderation'?'aria-current="page"':''}>Moderation</a>`:''}<a class="cg-source" href="${__COMMUNITY_REPO__}" target="_blank" rel="noopener">Contribute code ${externalArrow}</a></nav>`;
}
function card(g,scope){
 const href=scope==='mine'?edit(g):scope==='moderation'?edit(g)+'?review=1':link(g), privateView=scope!=='public';
 return `<article class="cg-card"><a class="cg-card-link" href="${href}"><div class="cg-card-art">${g.cover?img(g.cover,''): '<span class="cg-card-glyph" aria-hidden="true">⌘</span>'}<span class="cg-topic">${esc(g.topic)}</span></div><div class="cg-card-body"><div class="cg-card-top">${badge(g.level)}<span>${g.steps} ${g.steps===1?'step':'steps'}</span></div><h2>${esc(g.title||'Untitled guide')}</h2><p>${esc(g.summary||'A work in progress. Keep shaping your guide.')}</p><div class="cg-byline"><span class="cg-avatar">${esc([...(g.author||'?')][0].toUpperCase())}</span><span>${esc(g.author)}</span><time>${date(g.updatedAt)}</time></div>${privateView?`<span class="cg-state ${g.hidden?'is-hidden':''}">${g.hidden?'Hidden by staff':esc(g.status)}${g.hasDraft&&g.status==='published'?' · draft changes':''}</span>`:''}</div></a>${scope==='moderation'?`<a class="cg-review-link" href="${edit(g)}?review=1">Review guide →</a>`:''}</article>`;
}
function library(ctx){
 const {session,data,url}=ctx,scope=ctx.mode==='mine'?'mine':ctx.mode==='moderation'?'moderation':'public';
 if(scope!=='public'&&!session.user)return header('Your next guide starts here.','Sign in to write, save and publish your own guides.')+banner('Keep your knowledge together','Use your existing club account. Your drafts stay private.',`<a class="cg-button primary" href="${signIn(url.pathname)}">Sign in</a><a class="cg-button" href="/community/">Explore guides</a>`);
 const heading=scope==='mine'?'Your guide archive':scope==='moderation'?'Community moderation':'Learn something. Pass it on.';
 const sub=scope==='mine'?'Private drafts, published work and everything you are still figuring out.':scope==='moderation'?'Review contributions and keep the shared library useful.':'Practical guides written by the people in our club. One shared archive, many perspectives.';
 return navigation(session,ctx.mode)+header(heading,sub,`<a class="cg-button primary" href="/community/new/">＋ Write a guide</a>`)+
 `<form class="cg-search" role="search"><label><span class="sr-only">Search guides</span><input name="q" type="search" placeholder="Find a guide, topic or author…" maxlength="100" value="${esc(url.searchParams.get('q')||'')}"></label><label><span class="sr-only">Topic</span><select name="topic"><option value="">All topics</option>${TOPICS.map(t=>`<option ${url.searchParams.get('topic')===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label><label><span class="sr-only">Difficulty</span><select name="difficulty"><option value="">All levels</option>${['EZ','HD','IN','AT'].map(v=>`<option ${url.searchParams.get('difficulty')===v?'selected':''}>${v}</option>`).join('')}</select></label><button class="cg-button" type="submit">Search</button></form>`+
 `<div class="cg-results-heading"><span>${data.total} ${data.total===1?'guide':'guides'}${scope==='public'?' · LATEST PUBLISHED':''}</span>${url.search?`<a href="${url.pathname}">Clear filters</a>`:''}</div>`+
 (data.guides.length?`<div class="cg-grid">${data.guides.map(g=>card(g,scope)).join('')}</div>`:banner(data.total?'No guides on this page':url.search?'Nothing here yet':'The first guide starts with you.',url.search?'Try another search or clear the filters.':'Share a small thing you know. It might be exactly what someone else needs.',`<a class="cg-button primary" href="/community/new/">Write a guide</a>`))+
 `<nav class="cg-pagination" aria-label="Library pages">${data.page>1?`<a class="cg-button" href="${pageURL(url,data.page-1)}">← Previous</a>`:''}<span>Page ${data.page} of ${data.pages}</span>${data.page<data.pages?`<a class="cg-button" href="${pageURL(url,data.page+1)}">Next →</a>`:''}</nav>`;
}
const pageURL=(url,page)=>{const q=new URLSearchParams(url.search);q.set('page',page);return esc(url.pathname+'?'+q);};
function stepHTML(step){
 return `<div class="cg-prose">${markdown(step.text)}</div>${step.prompt?`<section class="cg-prompt"><div><span>ASK YOUR AGENT</span>${button('Copy prompt','copy')}</div><pre class="cg-prompt-text">${esc(step.prompt)}</pre></section>`:''}${step.images.map(image=>`<figure class="cg-figure"><button type="button" class="image-open" aria-label="Enlarge screenshot">${img(image.id,image.alt||'Guide screenshot')}<span>Enlarge ${externalArrow}</span></button>${image.alt?`<figcaption>${esc(image.alt)}</figcaption>`:''}</figure>`).join('')}`;
}
function reader(ctx){
 const {guide:g,session,url}=ctx,doc=g.content;
 const selected=doc.steps.findIndex(s=>s.id===url.searchParams.get('step')),index=selected<0?0:selected,step=doc.steps[index];ctx.step=step;
 const completed=ctx.completed||[],percent=Math.round(completed.length/doc.steps.length*100);
 return `<div class="cg-reader-top"><a href="/community/">← Community library</a><span class="cg-eyebrow">COMMUNITY / ${esc(doc.topic)}</span>${g.canEdit?`<a class="cg-button" href="${edit(g)}">Edit guide</a>`:''}</div><div class="cg-reader-layout"><aside class="cg-reader-rail">${doc.cover?img(doc.cover,doc.title,'cg-reader-cover'):''}<h1>${esc(doc.title)}</h1><p>${esc(doc.summary)}</p><div class="cg-author">By ${g.authorSlug?`<a href="https://novibenocode.ccwu.cc/user/${encodeURIComponent(g.authorSlug)}" target="_blank" rel="noopener">${esc(g.author)} ${externalArrow}</a>`:esc(g.author)}<small>Updated ${date(g.updatedAt)}</small></div><div class="cg-progress"><div><span>Your progress</span><strong data-community-percent>${percent}%</strong></div><progress max="100" value="${percent}"></progress></div><nav class="cg-steps" aria-label="Guide steps">${doc.steps.map((s,i)=>`<a href="${link(g)}?step=${s.id}" ${i===index?'aria-current="step"':''}><span class="cg-step-number">${String(i+1).padStart(2,'0')}</span><span>${esc(s.title)}</span><small>${completed.includes(s.id)?'✓':rating(s.level)}</small></a>`).join('')}</nav></aside><article class="cg-reader-content"><div class="cg-step-kicker"><span>STEP ${String(index+1).padStart(2,'0')} / ${String(doc.steps.length).padStart(2,'0')}</span>${badge(step.level)}</div><h2>${esc(step.title)}</h2>${stepHTML(step)}<footer class="cg-step-footer">${session.user?`<button type="button" class="cg-button cg-complete ${completed.includes(step.id)?'is-complete':''}" aria-pressed="${completed.includes(step.id)}">${completed.includes(step.id)?'✓ Completed':'Mark complete'}</button>`:`<a class="cg-button" href="${signIn(url.pathname)}">Sign in to save progress</a>`}<nav>${index?`<a href="${link(g)}?step=${doc.steps[index-1].id}">← Back</a>`:''}${index<doc.steps.length-1?`<a href="${link(g)}?step=${doc.steps[index+1].id}">Next step →</a>`:'<a href="/community/">Back to library →</a>'}</nav></footer></article></div>`;
}
function stepEditor(s,i,total){
 return `<fieldset class="cg-edit-step" data-step-id="${s.id}"><legend><span>STEP ${String(i+1).padStart(2,'0')}</span><span class="cg-step-actions">${button('↑','up')} ${button('↓','down')} ${button('Remove','remove-step')}</span></legend><div class="cg-form-row"><label>Step title<input name="step-title" maxlength="100" value="${esc(s.title)}" placeholder="What will the reader do?"></label><label class="cg-level">Difficulty<select name="level">${Array.from({length:17},(_,i)=>`<option value="${i+1}" ${s.level===i+1?'selected':''}>${rating(i+1)}</option>`).join('')}</select></label></div><label>Instructions <span>Markdown supported</span><textarea name="step-text" rows="5" maxlength="12000" placeholder="Keep it clear. Tell the reader what to do and what to expect.">${esc(s.text)}</textarea></label><label>Copyable AI prompt <span>Optional</span><textarea name="step-prompt" rows="3" maxlength="12000" placeholder="A prompt readers can copy into their agent…">${esc(s.prompt)}</textarea></label><div class="cg-image-list">${s.images.map(image=>`<div data-image-id="${image.id}">${img(image.id,image.alt)}<label>Image description<input name="image-alt" maxlength="240" value="${esc(image.alt)}" placeholder="Describe what the screenshot shows"></label>${button('×','remove-image')}</div>`).join('')}</div><label class="cg-upload">＋ Add screenshot<input type="file" data-upload="step" accept="image/png,image/jpeg,image/webp"></label></fieldset>`;
}
function editor(ctx){
 const {session,url}=ctx;
 if(!session.user)return header('Make something worth sharing.','Sign in to start a guide and keep your drafts safe.')+banner('Your account, your guides','Your existing club sign-in works here too.',`<a class="cg-button primary" href="${signIn(url.pathname)}">Sign in to write</a>`);
 const g=ctx.guide,content=g?.content||blankGuide();ctx.content=content;
 if(g&&(!g.canEdit||url.searchParams.get('review')==='1')){return header('Review contribution',`By ${g.author} · ${ctx.reviewPublished?'published revision':'private draft'}`,`<a class="cg-button" href="/community/moderation/">← Moderation</a>`)+`<div class="cg-notice">${g.hidden?'This guide is hidden: '+esc(g.moderationReason):'This guide is visible when published.'}</div>`+header(content.title,content.summary,isStaff(session.user)?button(g.hidden?'Restore visibility':'Hide guide','moderate'): '')+content.steps.map(s=>`<section class="cg-review-step"><h2>${esc(s.title)}</h2>${stepHTML(s)}</section>`).join('');}
 return `<div class="cg-editor-bar"><a href="/community/mine/">← My guides</a><span class="cg-save-state" role="status">${g?'All changes saved':'A new private draft'}</span><div class="cg-actions">${button('Export','export')}${button('Preview','preview')}${button('Save draft','save')}${button(g?.status==='published'?'Publish changes':'Publish guide','publish','primary')}</div></div>${g?.hidden?`<div class="cg-notice">Hidden by staff: ${esc(g.moderationReason)}. You can edit your draft, but staff must restore visibility before publication.</div>`:''}${g?.status==='archived'?'<div class="cg-notice">This guide is archived. Restore it before publishing.</div>':''}<form class="cg-editor" autocomplete="off"><div class="cg-editor-intro"><div><span class="cg-eyebrow">YOUR KNOWLEDGE / SOMEONE ELSE’S NEXT STEP</span><h1>${g?'Shape your guide.':'Start with what you know.'}</h1><p>Small, useful, and written in your own voice.</p></div><label class="cg-import">Import Markdown<input type="file" data-import accept=".md,.markdown,text/markdown,text/plain"></label></div><div class="cg-form-row"><label>Guide title<input name="title" maxlength="100" value="${esc(content.title==='Untitled guide'?'':content.title)}" placeholder="How to…" required></label><label class="cg-topic-field">Topic<select name="topic">${TOPICS.map(t=>`<option ${content.topic===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label></div><label>Short introduction<textarea name="summary" rows="2" maxlength="300" placeholder="What will someone learn, and who is this for?">${esc(content.summary)}</textarea></label><div class="cg-cover-row"><div class="cg-cover-preview" data-cover-id="${content.cover||''}">${content.cover?img(content.cover,'Guide cover'):'<span>YOUR COVER</span>'}</div><div><label class="cg-upload">${content.cover?'Replace':'Upload'} cover<input type="file" data-upload="cover" accept="image/png,image/jpeg,image/webp"></label><p>PNG, JPEG or WebP · up to 5 MB</p>${content.cover?button('Remove cover','remove-cover'):''}</div></div><div class="cg-editor-steps">${content.steps.map(stepEditor).join('')}</div>${button('＋ Add a step','add-step','cg-add-step')}<div class="cg-editor-bottom"><p>Drafts are private. Published guides appear in the community library.</p>${g?`<div class="cg-actions">${g.status==='published'?button('Unpublish','unpublish'):''}${g.status==='archived'?button('Restore draft','restore'):button('Archive guide','archive')}${button('Revision history','history')}</div>`:''}</div></form>`;
}
function frame(root,ctx){
 root.innerHTML=`<div class="cg-content">${ctx.error?banner('Could not open the archive',ctx.error,`<a class="cg-button" href="${esc(ctx.url.pathname+ctx.url.search)}">Try again</a><a class="cg-button" href="/community/">Community library</a>`):ctx.mode==='reader'?reader(ctx):ctx.mode==='editor'?editor(ctx):library(ctx)}</div><p class="cg-feedback" role="status" hidden></p>`;
}
async function prepare(scene,href,signal){
 const root=scene.querySelector('[data-community-root]');if(!root)return;
 const url=new URL(href,location.href),parts=url.pathname.split('/').filter(Boolean),mode=parts[1]==='guide'?'reader':['new','edit'].includes(parts[1])?'editor':parts[1]==='mine'?'mine':parts[1]==='moderation'?'moderation':'library';
 const ctx={root,url,mode};
 try{
  ctx.session=await request('/session',{signal});
  if(mode==='reader'){
   ctx.guide=(await request('/guides/'+encodeURIComponent(parts[2]),{signal})).guide;
   ctx.completed=ctx.session.user?(await request('/guides/'+ctx.guide.id+'/progress',{signal})).completed:[];
  } else if(mode==='editor'){
   if(parts[1]==='edit'&&ctx.session.user){ctx.guide=(await request('/guides/'+encodeURIComponent(parts[2])+'?draft=1',{signal})).guide;if(url.searchParams.get('review')==='1'&&ctx.guide.publishedRevision){ctx.guide.content=(await request('/guides/'+encodeURIComponent(parts[2]),{signal})).guide.content;ctx.reviewPublished=true;}}
  } else if(mode==='library'||ctx.session.user){
   const q=new URLSearchParams(url.search);q.set('scope',mode==='mine'?'mine':mode==='moderation'?'moderation':'public');
   ctx.data=await request('/guides?'+q,{signal});
  }
 }catch(error){if(signal?.aborted)throw error;ctx.error=error.message;}
 if(signal?.aborted)return;
 frame(root,ctx);scene.dataset.communityTitle=(ctx.guide?.content?.title|| (mode==='editor'?'Write a guide':mode==='mine'?'My guides':mode==='moderation'?'Moderation':'Community'))+' / No Vibe No Code Guides';contexts.set(scene,ctx);scene.dataset.communityReady='true';
}
let activeEditor=null;
function mount(scene){
 const ctx=contexts.get(scene);if(!ctx)return()=>{};
 const {root,session}=ctx,events=new AbortController(),signal=events.signal;
 let timer,disposed=false,dirty=false,version=0,savedVersion=0,saving=null,record=ctx.guide,uploading=0;
 const on=(target,type,fn,options={})=>target?.addEventListener(type,fn,{...options,signal});
 const feedback=(message,error=false)=>{const box=root.querySelector('.cg-feedback');box.textContent=message;box.hidden=false;box.classList.toggle('is-error',error);};
 const status=text=>{const el=root.querySelector('.cg-save-state');if(el)el.textContent=text;};
 const mutate=(path,body,method='POST')=>request(path,{method,headers:{'content-type':'application/json','x-csrf-token':session.csrfToken},body:JSON.stringify({...body,accountId:session.user.id}),signal});
 const collect=()=>{
  const form=root.querySelector('.cg-editor');
  return {title:form.elements.title.value.trim()||'Untitled guide',summary:form.elements.summary.value,topic:form.elements.topic.value,cover:root.querySelector('[data-cover-id]').dataset.coverId||null,
   steps:[...root.querySelectorAll('.cg-edit-step')].map(el=>({id:el.dataset.stepId,title:el.querySelector('[name=step-title]').value,level:Number(el.querySelector('[name=level]').value),text:el.querySelector('[name=step-text]').value,prompt:el.querySelector('[name=step-prompt]').value,images:[...el.querySelectorAll('[data-image-id]')].map(image=>({id:image.dataset.imageId,alt:image.querySelector('[name=image-alt]').value}))}))};
 };
 const mark=()=>{dirty=true;version++;status('Unsaved changes');clearTimeout(timer);timer=setTimeout(()=>save().catch(error=>{if(!disposed)feedback(error.message,true);}),1000);};
 async function save(){
  clearTimeout(timer);if(saving)return saving;if(disposed)throw Error('This editor is closed.');
  saving=(async()=>{do{
    const snapshot=version,content=collect();status('Saving draft…');
    if(!record){const data=await mutate('/guides',{content});record={...data,canEdit:true,author:session.user.name};ctx.guide=record;window.GuideScene.replaceURL(edit(record));ctx.url=new URL(edit(record),location.href);}
    else if(dirty){const data=await mutate('/guides/'+record.id,{revision:record.revision,content},'PUT');record.revision=data.revision;}
    savedVersion=snapshot;dirty=version!==snapshot;status(dirty?'Saving newer changes…':'All changes saved');
   }while(dirty&&!disposed);
   return record;
  })().catch(error=>{dirty=true;status(error.status===409?'Conflict — reload saved draft':'Could not save');throw error;}).finally(()=>saving=null);
  return saving;
 }
 if(root.querySelector('.cg-editor')){
  activeEditor={save:async()=>{if(uploading){feedback('Please wait for your image upload to finish.');throw Error('Upload in progress');}try{return await save();}catch(error){feedback(error.message,true);throw error;}},needsSave:()=>dirty||!!saving||uploading>0};
  on(root.querySelector('.cg-editor'),'submit',event=>event.preventDefault());
  on(root,'input',event=>{if(event.target.matches('input:not([type=file]),textarea,select'))mark();});
  on(root,'change',event=>{if(event.target.matches('select'))mark();});
  on(window,'beforeunload',event=>{if(dirty||saving||uploading){event.preventDefault();event.returnValue='';}});
 }
 on(root.querySelector('.cg-search'),'submit',event=>{event.preventDefault();const params=new URLSearchParams(new FormData(event.currentTarget));for(const [k,v] of [...params])if(!v)params.delete(k);window.GuideScene.navigate(ctx.url.pathname+(params.size?'?'+params:''));});
 function dialog(title,content){
  const box=document.createElement('dialog');box.className='cg-dialog';box.innerHTML=`<header><h2>${esc(title)}</h2><button type="button" class="cg-button" data-close>Close ×</button></header><div class="cg-dialog-body">${content}</div>`;document.body.append(box);
  const close=()=>{if(matchMedia('(prefers-reduced-motion: reduce)').matches){box.close();return;}box.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(12px)'}],{duration:160,easing:'ease-in',fill:'forwards'}).finished.then(()=>box.close());};
  box.addEventListener('click',async event=>{const copy=event.target.closest('[data-action=copy]'),picture=event.target.closest('.image-open');if(copy){try{await navigator.clipboard.writeText(copy.closest('.cg-prompt').querySelector('pre').textContent);copy.textContent='Copied';}catch{copy.textContent='Select and copy the prompt below';}}if(picture){const source=picture.querySelector('img'),viewer=document.querySelector('.image-dialog');if(viewer){const target=viewer.querySelector('img');target.crossOrigin='use-credentials';target.src=source.src;target.alt=source.alt;viewer.querySelector('p').textContent=source.alt;window.GuideMotion?.cancelExit(viewer);viewer.showModal();}else dialog('Screenshot',img(picture.querySelector('img').src.split('/').pop(),source.alt));}});
  box.querySelector('[data-close]').onclick=close;box.addEventListener('cancel',event=>{event.preventDefault();close();});box.addEventListener('close',()=>box.remove(),{once:true});signal.addEventListener('abort',()=>box.remove(),{once:true});box.showModal();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)box.animate([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'cubic-bezier(.16,.8,.25,1)'});return box;
 }
 on(root,'click',async event=>{
  const accountLink=event.target.closest('a[href]');
  if(accountLink && !event.defaultPrevented && event.button===0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && window.GuideScene.leaveForAccount){const url=new URL(accountLink.href);if(!accountLink.target&&url.origin==='https://novibenocode.ccwu.cc'&&url.pathname==='/'&&url.searchParams.get('account')==='login'){event.preventDefault();await window.GuideScene.leaveForAccount(url.href);return;}}
  const control=event.target.closest('[data-action],.cg-complete');if(!control)return;
  const action=control.dataset.action;event.preventDefault();
  try{
   if(control.matches('.cg-complete')){
    control.disabled=true;const completed=!ctx.completed.includes(ctx.step.id);
    await mutate('/guides/'+ctx.guide.id+'/progress',{stepId:ctx.step.id,completed},'PUT');
    ctx.completed=completed?[...ctx.completed,ctx.step.id]:ctx.completed.filter(id=>id!==ctx.step.id);
    control.setAttribute('aria-pressed',completed);control.textContent=completed?'✓ Completed':'Mark complete';control.classList.toggle('is-complete',completed);
    const percent=Math.round(ctx.completed.length/ctx.guide.content.steps.length*100);root.querySelector('[data-community-percent]').textContent=percent+'%';root.querySelector('progress').value=percent;root.querySelector('.cg-steps [aria-current=step] small').textContent=completed?'✓':rating(ctx.step.level);feedback('Progress saved to your account.');return;
   }
   if(action==='copy'){await navigator.clipboard.writeText(control.closest('.cg-prompt').querySelector('pre').textContent);feedback('Prompt copied.');return;}
   if(action==='export'){
    const doc=collect(),text='# '+doc.title+'\n\n'+doc.summary+'\n\n'+doc.steps.map(s=>'## '+s.title+'\n\n'+s.text+(s.prompt?'\n\n### AI prompt\n\n'+s.prompt:'')).join('\n\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=(doc.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,70)||'guide')+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback('Draft text exported. Screenshots remain in your online guide.');return;
   }
   if(action==='preview'){
    const doc=collect();dialog('Preview · private draft',`<div class="cg-preview"><h1>${esc(doc.title)}</h1><p>${esc(doc.summary)}</p>${doc.steps.map(s=>`<section><div>${badge(s.level)}</div><h2>${esc(s.title||'Untitled step')}</h2>${stepHTML(s)}</section>`).join('')}</div>`);return;
   }
   if(action==='add-step'){
    if(root.querySelectorAll('.cg-edit-step').length>=32)throw Error('A guide can have up to 32 steps.');
    const step=blankGuide().steps[0],holder=document.createElement('div');holder.innerHTML=stepEditor(step,root.querySelectorAll('.cg-edit-step').length);root.querySelector('.cg-editor-steps').append(holder.firstElementChild);mark();return;
   }
   if(['up','down','remove-step'].includes(action)){
    const el=control.closest('.cg-edit-step');
    if(action==='remove-step'){if(root.querySelectorAll('.cg-edit-step').length===1)throw Error('Keep at least one step.');el.remove();}
    else if(action==='up'&&el.previousElementSibling)el.parentElement.insertBefore(el,el.previousElementSibling);
    else if(action==='down'&&el.nextElementSibling)el.parentElement.insertBefore(el.nextElementSibling,el);
    root.querySelectorAll('.cg-edit-step').forEach((step,i)=>step.querySelector('legend>span').textContent='STEP '+String(i+1).padStart(2,'0'));mark();return;
   }
   if(action==='remove-image'){control.closest('[data-image-id]').remove();mark();return;}
   if(action==='remove-cover'){const cover=root.querySelector('[data-cover-id]');cover.dataset.coverId='';cover.innerHTML='<span>YOUR COVER</span>';control.remove();mark();return;}
   control.disabled=true;
   if(action==='save'){await save();feedback('Private draft saved.');return;}
   if(action==='publish'){
    if(uploading)throw Error('Wait for your image upload to finish.');
    const g=await save();await mutate('/guides/'+g.id+'/publish',{revision:g.revision});await window.GuideScene.navigate(link(g));return;
   }
   if(['unpublish','archive','restore'].includes(action)){
    const g=await save(),result=await mutate('/guides/'+g.id+'/'+action,{revision:g.revision});record.revision=Math.max(record.revision,result.revision);await window.GuideScene.navigate('/community/mine/');return;
   }
   if(action==='moderate'){
    const box=dialog(record.hidden?'Restore visibility':'Hide contribution',`<p>Author: ${esc(record.author)}</p><label>Reason<textarea required minlength="3" maxlength="500" rows="3" placeholder="Explain the decision to the author"></textarea></label><button class="cg-button primary" data-confirm>Apply decision</button>`);
    box.querySelector('[data-confirm]').onclick=async()=>{if(!box.querySelector('textarea').reportValidity())return;box.querySelector('[data-confirm]').disabled=true;try{await mutate('/guides/'+record.id+'/moderate',{revision:record.revision,hidden:!record.hidden,reason:box.querySelector('textarea').value});box.close();window.GuideScene.navigate('/community/moderation/');}catch(error){box.querySelector('.cg-modal-error')?.remove();box.querySelector('.cg-dialog-body').insertAdjacentHTML('beforeend',`<p class="cg-modal-error" role="alert">${esc(error.message)}</p>`);box.querySelector('[data-confirm]').disabled=false;}};return;
   }
   if(action==='history'){
    const g=await save(),data=await request('/guides/'+g.id+'/history',{signal});dialog('Published revisions',data.history.length?data.history.map(row=>`<details><summary>Revision ${row.revision} · ${date(row.createdAt)}</summary><h3>${esc(row.content.title)}</h3>${row.content.steps.map(s=>`<h4>${esc(s.title)}</h4><div class="cg-prose">${markdown(s.text)}</div>`).join('')}</details>`).join(''):'<p>No published revisions yet.</p>');
   }
  }catch(error){if(!disposed)feedback(error.message,true);}finally{if(control.isConnected)control.disabled=false;}
 });
 on(root,'change',async event=>{
  const input=event.target;if(!input.matches('input[type=file]'))return;const file=input.files?.[0];if(!file)return;let didUpload=false;
  try{
   if(input.hasAttribute('data-import')){
    if(file.size>150000)throw Error('Import a Markdown file under 150 KB.');
    const content=importMarkdown(await file.text());if(content.steps.length>32)throw Error('Use no more than 32 headings/steps.');
    const box=dialog('Import Markdown',`<p>Replace this draft’s text with <strong>${esc(content.title)}</strong> (${content.steps.length} steps)?</p><p>Your published guide stays unchanged until you publish again.</p><button class="cg-button primary" data-confirm>Import into draft</button>`);
    box.querySelector('[data-confirm]').onclick=()=>{const form=root.querySelector('.cg-editor');form.elements.title.value=content.title;root.querySelector('.cg-editor-steps').innerHTML=content.steps.map(stepEditor).join('');mark();box.close();};return;
   }
   if(file.size>5000000||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP image under 5 MB.');
   const step=input.closest('.cg-edit-step');if(step&&step.querySelectorAll('[data-image-id]').length>=8)throw Error('Use up to eight screenshots per step.');
   uploading++;didUpload=true;input.disabled=true;feedback('Uploading image…');
   const g=await save();
   const data=await request('/guides/'+g.id+'/assets',{method:'POST',headers:{'content-type':file.type,'x-csrf-token':session.csrfToken,'x-account-id':session.user.id},body:file,signal});
   if(disposed)return;
   if(input.dataset.upload==='cover'){const cover=root.querySelector('[data-cover-id]');cover.dataset.coverId=data.asset.id;cover.innerHTML=img(data.asset.id,'Guide cover');if(!root.querySelector('[data-action=remove-cover]'))cover.nextElementSibling.insertAdjacentHTML('beforeend',button('Remove cover','remove-cover'));}
   else {const el=document.createElement('div');el.dataset.imageId=data.asset.id;el.innerHTML=`${img(data.asset.id,file.name)}<label>Image description<input name="image-alt" maxlength="240" value="${esc(file.name)}"></label>${button('×','remove-image')}`;step.querySelector('.cg-image-list').append(el);}
   mark();await save();feedback('Image uploaded and draft saved.');
  }catch(error){if(!disposed)feedback(error.message,true);}finally{if(didUpload)uploading=Math.max(0,uploading-1);input.disabled=false;input.value='';}
 });
 let checking=false;
 const identity=async()=>{
  if(checking||disposed||document.hidden||!session?.user)return;
  checking=true;try{const fresh=await request('/session',{signal});if(fresh.user?.id!==session.user.id){disposed=true;events.abort();clearTimeout(timer);activeEditor=null;root.innerHTML=banner('Your account changed','Reopen the community page to continue with the current account.','<a class="cg-button" href="/community/">Open library</a>');}else session.csrfToken=fresh.csrfToken;}catch{/* Mutations still require a fresh server session. */}finally{checking=false;}
 };
 on(window,'focus',identity);on(document,'visibilitychange',identity);
 return()=>{disposed=true;events.abort();clearTimeout(timer);if(ctx.mode==='editor')activeEditor=null;};
}
window.GuideCommunity={prepare,mount,async beforeLeave(){if(!activeEditor?.needsSave())return true;try{await activeEditor.save();return true;}catch{return false;}}};
