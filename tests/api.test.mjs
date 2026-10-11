import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,document,png} from './fixture.mjs';
import {cleanupCommunity} from '../server/api.js';
const setup=async()=>{const f=fixture();f.add('author');f.add('reader');f.add('staff','teacher');const doc=document();const response=await f.call('/guides',{method:'POST',body:{accountId:'author',content:doc}});assert.equal(response.status,201);const guide=await response.json();return {...f,doc,guide,path:'/guides/'+guide.id};};
const publish=async f=>{const r=await f.call(f.path+'/publish',{method:'POST',body:{accountId:'author',revision:f.guide.revision}});assert.equal(r.status,200,await r.text());};
test('private drafts, publication, isolated edits, CAS, history and archive',async()=>{
 const f=await setup();assert.equal((await f.call(f.path,{who:'reader'})).status,404);assert.equal((await (await f.call('/guides',{who:null})).json()).total,0);
 await publish(f);assert.equal((await (await f.call('/guides',{who:null})).json()).total,1);
 f.doc.title='A private new title';const save=()=>f.call(f.path,{method:'PUT',body:{accountId:'author',revision:1,content:f.doc}});
 assert.equal((await save()).status,200);assert.equal((await save()).status,409);
 assert.equal((await (await f.call(f.path,{who:null})).json()).guide.content.title,'Build your first website');
 assert.equal((await (await f.call(f.path+'?draft=1')).json()).guide.content.title,'A private new title');
 assert.equal((await f.call(f.path+'?draft=1',{who:'reader'})).status,404);
 f.guide.revision=2;await publish(f);assert.equal((await (await f.call(f.path+'/history')).json()).history.length,2);
 assert.equal((await f.call(f.path+'/archive',{method:'POST',body:{accountId:'author',revision:2}})).status,200);
 assert.equal((await f.call(f.path,{who:null})).status,404);
 assert.equal((await f.call(f.path+'/publish',{method:'POST',body:{accountId:'author',revision:3}})).status,409);
});
test('progress is bound to the account and current published step IDs',async()=>{
 const f=await setup();await publish(f);const put=body=>f.call(f.path+'/progress',{who:'reader',method:'PUT',body:{accountId:'reader',...body}});
 assert.equal((await put({stepId:f.doc.steps[0].id,completed:true})).status,200);
 assert.deepEqual((await (await f.call(f.path+'/progress',{who:'reader'})).json()).completed,[f.doc.steps[0].id]);
 assert.deepEqual((await (await f.call(f.path+'/progress')).json()).completed,[]);
 assert.equal((await put({stepId:crypto.randomUUID(),completed:true})).status,400);assert.equal((await put({accountId:'author',stepId:f.doc.steps[0].id,completed:true})).status,409);
 assert.equal((await f.call(f.path+'/progress',{who:null})).status,401);
});
test('images remain private until referenced by a published revision',async()=>{
 const f=await setup();const upload=await f.call(f.path+'/assets',{method:'POST',body:png,headers:{'x-account-id':'author'}});assert.equal(upload.status,201);const {asset}=await upload.json();
 assert.equal((await f.call('/media/'+asset.id,{who:null})).status,404);assert.equal((await f.call('/media/'+asset.id)).status,200);
 await publish(f);assert.equal((await f.call('/media/'+asset.id,{who:'reader'})).status,404);
 f.doc.cover=asset.id;assert.equal((await f.call(f.path,{method:'PUT',body:{accountId:'author',revision:1,content:f.doc}})).status,200);f.guide.revision=2;await publish(f);
 const image=await f.call('/media/'+asset.id,{who:null});assert.equal(image.status,200);assert.match(image.headers.get('cache-control'),/no-store/);assert.equal(image.headers.get('content-type'),'image/png');
 const b=await f.call('/guides',{who:'reader',method:'POST',body:{accountId:'reader',content:document()}});const other=await b.json();assert.equal((await f.call('/guides/'+other.id,{who:'reader',method:'PUT',body:{accountId:'reader',revision:1,content:f.doc}})).status,400);
 assert.equal((await f.call(f.path+'/assets',{method:'POST',body:new TextEncoder().encode('<svg onload="alert(1)"></svg>'),headers:{'x-account-id':'author'}})).status,400);
});
test('CORS, CSRF, ownership, staff moderation and author bypass prevention',async()=>{
 const f=await setup();await publish(f);
 assert.equal((await f.call('/guides',{headers:{origin:'https://evil.example'}})).status,403);
 assert.equal((await f.call(f.path,{method:'PUT',headers:{'x-csrf-token':'wrong'},body:{}})).status,403);
 assert.equal((await f.call(f.path,{who:'reader',method:'PUT',body:{accountId:'reader',revision:1,content:f.doc}})).status,403);
 const hide=(who)=>f.call(f.path+'/moderate',{who,method:'POST',body:{accountId:who,revision:1,hidden:true,reason:'Needs a correction'}});
 assert.equal((await hide('reader')).status,403);assert.equal((await hide('staff')).status,200);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM community_audit').get().n,1);
 assert.equal((await f.call(f.path,{who:null})).status,404);assert.equal((await f.call(f.path+'/publish',{method:'POST',body:{accountId:'author',revision:2}})).status,403);
 const r=await f.call('/session');assert.equal(r.headers.get('access-control-allow-origin'),'https://guides.novibenocode.ccwu.cc');
});
test('session revocation during a save cannot write',async()=>{
 const f=await setup();f.DB.hook=async q=>{if(q.text?.startsWith('UPDATE community_guides SET draft_json')){f.DB.hook=null;f.sql.exec("DELETE FROM sessions WHERE user_id='author'");}};
 assert.equal((await f.call(f.path,{method:'PUT',body:{accountId:'author',revision:1,content:{...f.doc,title:'Invalid write'}}})).status,409);
 assert.equal(f.sql.prepare('SELECT revision FROM community_guides').get().revision,1);
});
test('cleanup reservations prevent stale image resurrection and retry deletion',async()=>{
 const f=await setup();const {asset}=await(await f.call(f.path+'/assets',{method:'POST',body:png,headers:{'x-account-id':'author'}})).json();f.sql.exec("UPDATE community_assets SET created_at='2000-01-01'");f.doc.cover=asset.id;
 f.DB.hook=async q=>{if(q.text?.startsWith('UPDATE community_guides SET draft_json')){f.DB.hook=null;await cleanupCommunity(f.env);}};
 assert.equal((await f.call(f.path,{method:'PUT',body:{accountId:'author',revision:1,content:f.doc}})).status,409);assert.equal(f.objects.size,0);
 const data=await(await f.call(f.path+'/assets',{method:'POST',body:png,headers:{'x-account-id':'author'}})).json();f.sql.exec("UPDATE community_assets SET created_at='2000-01-01'");f.bucket.failDelete=true;await cleanupCommunity(f.env);assert.equal(f.sql.prepare('SELECT state FROM community_assets WHERE id=?').get(data.asset.id).state,'delete');f.bucket.failDelete=false;await cleanupCommunity(f.env);assert.equal(f.objects.size,0);
});
test('upload revocation and quota enforcement preserve charged reservations',async()=>{
 const f=await setup();f.bucket.hook=async()=>f.sql.exec("DELETE FROM sessions WHERE user_id='author'");
 assert.equal((await f.call(f.path+'/assets',{method:'POST',body:png,headers:{'x-account-id':'author'}})).status,409);assert.equal(f.sql.prepare('SELECT state FROM community_assets').get().state,'delete');
 await cleanupCommunity(f.env);assert.equal(f.objects.size,0);
 const g=await setup();for(let i=0;i<5;i++)g.sql.prepare("INSERT INTO community_assets VALUES(?,?,?,?,?,?,'ready',?)").run(crypto.randomUUID(),g.guide.id,'author','image'+i,5000000,'image/png',new Date().toISOString());
 assert.equal((await g.call(g.path+'/assets',{method:'POST',body:png,headers:{'x-account-id':'author'}})).status,413);
});
test('private library filters use the current draft, public filters use the published version',async()=>{
 const f=await setup();await publish(f);f.doc.title='Build a desktop app';f.doc.topic='Apps';f.doc.steps[1].level=5;
 assert.equal((await f.call(f.path,{method:'PUT',body:{accountId:'author',revision:1,content:f.doc}})).status,200);
 assert.equal((await(await f.call('/guides?scope=mine&q=desktop&topic=Apps&difficulty=HD')).json()).total,1);
 assert.equal((await(await f.call('/guides?q=desktop&topic=Apps&difficulty=HD')).json()).total,0);
 assert.equal((await(await f.call('/guides?q=website&topic=Websites&difficulty=EZ')).json()).total,1);
});
test('bounded cleanup advances past referenced images to reach later orphans',async()=>{
 const f=await setup(),guides=[f.guide];for(let i=0;i<2;i++)guides.push(await(await f.call('/guides',{method:'POST',body:{accountId:'author',content:document()}})).json());
 const docs=guides.map(()=>({...document(),steps:[]}));
 for(let i=0;i<102;i++){
  const index=Math.floor(i/34),g=guides[index],id=crypto.randomUUID(),key='sweep-'+i;f.objects.set(key,new Uint8Array([1]));
  f.sql.prepare("INSERT INTO community_assets VALUES(?,?,?,?,?,?,'ready',?)").run(id,g.id,'author',key,1,'image/png',new Date(Date.UTC(2000,0,1,0,0,i)).toISOString());
  if(i<100){const steps=docs[index].steps;if(!steps.length||steps.at(-1).images.length===8)steps.push({...document().steps[0],images:[]});steps.at(-1).images.push({id,alt:'Referenced image'});}
 }
 guides.forEach((g,i)=>f.sql.prepare('UPDATE community_guides SET draft_json=? WHERE id=?').run(JSON.stringify(docs[i]),g.id));
 await cleanupCommunity(f.env);assert.equal(f.objects.size,102);await cleanupCommunity(f.env);assert.equal(f.objects.size,100);assert.equal(f.sql.prepare('SELECT cursor_date FROM community_gc').get().cursor_date,'');
});
