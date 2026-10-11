import {TOPICS, uuid, assetIds, normalizeContent, blankGuide, readBounded, imageType, failure} from './content.js';

const PREFIX = '/api/community', GUIDES = 'https://guides.novibenocode.ccwu.cc';
const staff = user => ['maintainer','club-leader','teacher'].includes(user?.role);
const now = () => new Date().toISOString();
const parse = value => value ? JSON.parse(value) : null;
const live = `EXISTS(SELECT 1 FROM users actor JOIN sessions session ON session.user_id=actor.id WHERE actor.id=? AND actor.status='active' AND actor.auth_version=? AND session.id=? AND session.expires_at>?)`;
const readyAssets = `(SELECT COUNT(*) FROM community_assets WHERE guide_id=? AND state='ready' AND id IN (SELECT value FROM json_each(?)))=?`;
const visible = "g.status='published' AND g.hidden=0 AND u.status='active'";

// The host owns authentication; the module owns community rules and persistence.
export function createCommunityApi(auth) {
  return async function communityApi(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== PREFIX && !url.pathname.startsWith(PREFIX + '/')) return null;
    const origin = request.headers.get('origin');
    const headers = {'cache-control':'private, no-store', vary:'Origin', 'x-content-type-options':'nosniff'};
    if (origin === GUIDES) Object.assign(headers, {'access-control-allow-origin':GUIDES,'access-control-allow-credentials':'true'});
    const reply = (data, status = 200, extra = {}) => Response.json(data, {status, headers:{...headers,...extra}});
    if (origin && origin !== GUIDES && origin !== url.origin) return reply({error:'Cross-site request rejected.'},403);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{...headers,'access-control-allow-methods':'GET, POST, PUT, DELETE, OPTIONS','access-control-allow-headers':'Content-Type, X-CSRF-Token, X-Account-ID, X-Revision'}});
    try {
      const user = await auth.currentUser(request,env), method = request.method, path = url.pathname.slice(PREFIX.length);
      const credentials = () => [user.id,user.auth_version,auth.readCookie(request,'nvnc_session'),now()];
      const requireUser = () => { if (!user) throw failure('Sign in to contribute.',401); };
      const body = async () => {
        requireUser();
        const data = JSON.parse(new TextDecoder().decode(await readBounded(request,180000)));
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw failure('Use a JSON object.');
        if (data.accountId !== user.id) throw failure('Your account changed. Reload before saving.',409);
        return data;
      };
      const session = () => {
        const csrf = auth.readCookie(request,'nvnc_csrf') || uuid();
        return reply({user:user?{id:user.id,name:user.display_name,role:user.role}:null,csrfToken:csrf,topics:TOPICS},200,
          auth.readCookie(request,'nvnc_csrf')?{}:{'set-cookie':auth.cookie('nvnc_csrf',csrf,86400,false)});
      };
      if (path === '/session' && method === 'GET') return session();
      if (!['GET','HEAD'].includes(method)) {
        requireUser();
        if (!auth.csrfValid(request)) throw failure('Security check failed. Refresh and try again.',403);
        if (!await auth.withinRateLimit(env,request,'community-write',120,60000,'identity',user.id)) throw failure('Please wait a moment before trying again.',429);
      }
      const card = row => {
        const doc = parse(row.published_json), draft = parse(row.draft_json);
        const content = row.private_view ? draft : doc;
        return {id:row.id,slug:row.slug,title:content?.title || row.title,summary:content?.summary || row.summary,topic:content?.topic || row.topic,
          cover:content?.cover || null,level:Math.max(1,...(content?.steps || []).map(s=>s.level)),steps:content?.steps.length || 0,
          author:row.display_name || row.author_name,authorSlug:row.public_slug || null,updatedAt:row.private_view?row.updated_at:row.published_at,
          ...(row.private_view?{status:row.status,hidden:!!row.hidden,revision:row.revision,hasDraft:row.revision!==row.published_revision}:{}),canEdit:user?.id===row.owner_id};
      };
      if (path === '/guides' && method === 'GET') {
        const scope = url.searchParams.get('scope') || 'public';
        if (!['public','mine','moderation'].includes(scope)) throw failure('Unknown library.');
        if (scope !== 'public') requireUser();
        if (scope === 'moderation' && !staff(user)) throw failure('Staff access required.',403);
        const values = [], where = [scope === 'public' ? visible : scope === 'mine' ? 'g.owner_id=?' : '1=1'];
        if (scope === 'mine') values.push(user.id);
        const titleColumn=scope==='public'?'g.title':"json_extract(g.draft_json,'$.title')", summaryColumn=scope==='public'?'g.summary':"json_extract(g.draft_json,'$.summary')", topicColumn=scope==='public'?'g.topic':"json_extract(g.draft_json,'$.topic')", levelColumn=scope==='public'?'g.level':"(SELECT MAX(CAST(json_extract(value,'$.level') AS INTEGER)) FROM json_each(g.draft_json,'$.steps'))";
        const query = (url.searchParams.get('q') || '').trim().slice(0,100), topic = url.searchParams.get('topic');
        if (query) {where.push(`(instr(lower(${titleColumn}),lower(?))>0 OR instr(lower(${summaryColumn}),lower(?))>0 OR instr(lower(COALESCE(u.display_name,g.author_name)),lower(?))>0)`);values.push(query,query,query);}
        if (topic) { if (!TOPICS.includes(topic)) throw failure('Unknown topic.'); where.push(topicColumn+'=?');values.push(topic); }
        const difficulty = url.searchParams.get('difficulty');
        const ranges = {EZ:[1,3],HD:[4,6],IN:[7,12],AT:[13,17]};
        if (difficulty) {if (!ranges[difficulty]) throw failure('Unknown difficulty.');where.push(levelColumn+' BETWEEN ? AND ?');values.push(...ranges[difficulty]);}
        const page = Math.max(1,Math.min(1000,Math.floor(Number(url.searchParams.get('page'))||1))), limit = 12;
        const from = ' FROM community_guides g LEFT JOIN users u ON u.id=g.owner_id WHERE '+where.join(' AND ');
        const count = await env.DB.prepare('SELECT COUNT(*) n'+from).bind(...values).first();
        const rows = await env.DB.prepare('SELECT g.*,u.display_name,u.public_slug'+from+' ORDER BY '+(scope==='public'?'g.published_at':'g.updated_at')+' DESC,g.id DESC LIMIT ? OFFSET ?').bind(...values,limit,(page-1)*limit).all();
        return reply({guides:rows.results.map(row=>card({...row,private_view:scope!=='public'})),total:count.n,page,pages:Math.max(1,Math.ceil(count.n/limit))});
      }
      if (path === '/guides' && method === 'POST') {
        const input = await body(), content = normalizeContent(input.content || blankGuide()), id = uuid(), time = now();
        if (assetIds(content).length) throw failure('Save the draft before uploading images.');
        if (!await auth.withinRateLimit(env,request,'community-create',10,3600000,'identity',user.id)) throw failure('You can create ten guides per hour.',429);
        const slug = (content.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,36)||'guide')+'-'+id.slice(0,8);
        const result = await env.DB.prepare(`INSERT INTO community_guides(id,slug,owner_id,author_name,draft_json,title,summary,topic,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${live}`)
          .bind(id,slug,user.id,user.display_name,JSON.stringify(content),content.title,content.summary,content.topic,time,time,...credentials()).run();
        if (!result.meta.changes) throw failure('Your session changed. Sign in again.',401);
        return reply({id,slug,revision:1,content,status:'draft',hidden:false},201);
      }
      const media = path.match(/^\/media\/([a-f0-9-]{36})$/);
      if (media && ['GET','HEAD'].includes(method)) {
        const row = await env.DB.prepare('SELECT a.*,g.owner_id guide_owner,g.status,g.hidden,g.published_json,u.status owner_status FROM community_assets a JOIN community_guides g ON g.id=a.guide_id LEFT JOIN users u ON u.id=g.owner_id WHERE a.id=? AND a.state=\'ready\'').bind(media[1]).first();
        const publicImage = row && row.status==='published' && !row.hidden && row.owner_status==='active' && assetIds(parse(row.published_json)).includes(row.id);
        if (!row || (!publicImage && user?.id!==row.guide_owner && !staff(user))) throw failure('Image not found.',404);
        const object = await env.COMMUNITY_FILES.get(row.object_key);
        if (!object) throw failure('Image not found.',404);
        return new Response(method==='HEAD'?null:object.body,{headers:{...headers,'content-type':row.mime,'content-length':String(row.bytes),'content-disposition':'inline','cross-origin-resource-policy':'same-site'}});
      }
      const match = path.match(/^\/guides\/([a-z0-9-]{6,80})(?:\/(assets|progress|publish|unpublish|archive|restore|moderate|history))?$/);
      if (!match) throw failure('Community route not found.',404);
      const key = match[1], action = match[2];
      const guide = await env.DB.prepare('SELECT g.*,u.display_name,u.public_slug,u.status owner_status FROM community_guides g LEFT JOIN users u ON u.id=g.owner_id WHERE g.id=? OR g.slug=?').bind(key,key).first();
      if (!guide) throw failure('Guide not found.',404);
      const owner = user?.id === guide.owner_id, published = guide.status==='published' && !guide.hidden && guide.owner_status==='active';
      const draft = url.searchParams.get('draft') === '1';
      if ((!published || draft) && !owner && !staff(user)) throw failure('Guide not found.',404);
      const doc = parse(draft ? guide.draft_json : guide.published_json);
      const owned = () => {requireUser();if(!owner)throw failure('Only the author can change this guide.',403);};
      const revision = input => {if(!Number.isInteger(input.revision)||input.revision!==guide.revision)throw failure('This guide changed in another tab. Export your draft text, then reopen the saved guide.',409);};
      const changed = result => {if(!result.meta.changes)throw failure('Your session or this guide changed. Export your draft text, then reopen the saved guide.',409);};
      const checkImages = async content => {
        for (const id of assetIds(content)) {
          if (!await env.DB.prepare("SELECT id FROM community_assets WHERE id=? AND guide_id=? AND state='ready'").bind(id,guide.id).first()) throw failure('An image is unavailable. Upload it again.');
        }
      };
      if (!action && method === 'GET') {
        if (!doc || (draft && !owner && !staff(user))) throw failure('Published guide not found.',404);
        return reply({guide:{...card({...guide,private_view:draft}),content:doc,revision:guide.revision,publishedRevision:guide.published_revision,
          ...(owner||staff(user)?{status:guide.status,hidden:!!guide.hidden,moderationReason:guide.moderation_reason}:{}),canModerate:staff(user)}});
      }
      if (!action && method === 'PUT') {
        owned();const input=await body();revision(input);
        const content=normalizeContent(input.content);await checkImages(content);
        const time=now(), images=assetIds(content);
        const result=await env.DB.prepare(`UPDATE community_guides SET draft_json=?,revision=revision+1,updated_at=?,title=CASE WHEN published_json IS NULL THEN ? ELSE title END,summary=CASE WHEN published_json IS NULL THEN ? ELSE summary END,topic=CASE WHEN published_json IS NULL THEN ? ELSE topic END,level=CASE WHEN published_json IS NULL THEN ? ELSE level END WHERE id=? AND owner_id=? AND revision=? AND ${live} AND ${readyAssets}`)
          .bind(JSON.stringify(content),time,content.title,content.summary,content.topic,Math.max(...content.steps.map(s=>s.level)),guide.id,user.id,input.revision,...credentials(),guide.id,JSON.stringify(images),images.length).run();
        changed(result);return reply({ok:true,revision:input.revision+1});
      }
      if (action==='assets' && method==='GET') {
        owned();const rows=await env.DB.prepare("SELECT id,bytes,mime,created_at FROM community_assets WHERE guide_id=? AND state='ready' ORDER BY created_at DESC").bind(guide.id).all();
        return reply({assets:rows.results});
      }
      if (action==='assets' && method==='POST') {
        owned();
        if (request.headers.get('x-account-id')!==user.id) throw failure('Your account changed.',409);
        if (!env.COMMUNITY_FILES) throw failure('Image storage is temporarily unavailable.',503);
        const bytes=await readBounded(request,5000000), mime=imageType(bytes), id=uuid(), objectKey='community/'+guide.id+'/'+id, time=now();
        const reserved=await env.DB.prepare(`INSERT INTO community_assets(id,guide_id,owner_id,object_key,bytes,mime,state,created_at) SELECT ?,?,?,?,?,?,'pending',? WHERE ${live}`)
          .bind(id,guide.id,user.id,objectKey,bytes.byteLength,mime,time,...credentials()).run();changed(reserved);
        try {
          await env.COMMUNITY_FILES.put(objectKey,bytes,{httpMetadata:{contentType:mime}});
          const result=await env.DB.prepare(`UPDATE community_assets SET state='ready' WHERE id=? AND state='pending' AND EXISTS(SELECT 1 FROM community_guides WHERE id=? AND owner_id=?) AND ${live}`).bind(id,guide.id,user.id,...credentials()).run();changed(result);
          return reply({asset:{id,mime,bytes:bytes.byteLength}},201);
        } catch(error) {await env.DB.prepare("UPDATE community_assets SET state='delete' WHERE id=?").bind(id).run();throw error;}
      }
      if (action==='progress') {
        requireUser();if(!published)throw failure('Published guide not found.',404);
        const steps=parse(guide.published_json).steps.map(s=>s.id);
        if(method==='GET') {
          const rows=await env.DB.prepare('SELECT step_id,completed FROM community_progress WHERE guide_id=? AND user_id=?').bind(guide.id,user.id).all();
          return reply({completed:rows.results.filter(r=>r.completed&&steps.includes(r.step_id)).map(r=>r.step_id)});
        }
        if(method==='PUT') {
          const input=await body();if(!steps.includes(input.stepId)||typeof input.completed!=='boolean')throw failure('Choose a current published step.');
          const result=await env.DB.prepare(`INSERT INTO community_progress(user_id,guide_id,step_id,completed,updated_at) SELECT ?,?,?,?,? WHERE ${live} AND EXISTS(SELECT 1 FROM community_guides g JOIN users u ON u.id=g.owner_id WHERE g.id=? AND ${visible} AND g.published_revision=?) ON CONFLICT(user_id,guide_id,step_id) DO UPDATE SET completed=excluded.completed,updated_at=excluded.updated_at`)
            .bind(user.id,guide.id,input.stepId,input.completed?1:0,now(),...credentials(),guide.id,guide.published_revision).run();changed(result);return reply({ok:true});
        }
      }
      if(action==='history'&&method==='GET') {
        owned();const rows=await env.DB.prepare('SELECT revision,content_json,created_at FROM community_history WHERE guide_id=? ORDER BY revision DESC LIMIT 5').bind(guide.id).all();
        return reply({history:rows.results.map(row=>({revision:row.revision,content:parse(row.content_json),createdAt:row.created_at}))});
      }
      if (method==='POST' && ['publish','unpublish','archive','restore','moderate'].includes(action)) {
        const input=await body();revision(input);const time=now();
        if(action==='moderate') {
          if(!staff(user))throw failure('Staff access required.',403);
          if(typeof input.hidden!=='boolean'||typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.length>500)throw failure('Give a short moderation reason.');
          const [result]=await env.DB.batch([
            env.DB.prepare(`UPDATE community_guides SET hidden=?,moderation_reason=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND ${live} AND EXISTS(SELECT 1 FROM users WHERE id=? AND role IN ('maintainer','club-leader','teacher'))`).bind(input.hidden?1:0,input.reason.trim(),time,guide.id,input.revision,...credentials(),user.id),
            env.DB.prepare("INSERT INTO community_audit(id,guide_id,actor_id,actor_name,action,reason,created_at) SELECT ?,?,?,?,?,?,? WHERE changes()=1").bind(uuid(),guide.id,user.id,user.display_name,input.hidden?'hide':'show',input.reason.trim(),time),
          ]);changed(result);return reply({ok:true,revision:input.revision+1});
        }
        owned();
        if(action==='publish') {
          if(guide.hidden)throw failure('Staff have hidden this guide. Contact staff before republishing.',403);
          if(guide.status==='archived')throw failure('Restore this guide before publishing.',409);
          const content=normalizeContent(parse(guide.draft_json),true);await checkImages(content);
          const level=Math.max(...content.steps.map(s=>s.level)), images=assetIds(content);
          const [result]=await env.DB.batch([
            env.DB.prepare(`UPDATE community_guides SET status='published',published_json=draft_json,published_revision=revision,title=?,summary=?,topic=?,level=?,published_at=?,updated_at=? WHERE id=? AND owner_id=? AND revision=? AND hidden=0 AND status!='archived' AND ${live} AND ${readyAssets}`).bind(content.title,content.summary,content.topic,level,time,time,guide.id,user.id,input.revision,...credentials(),guide.id,JSON.stringify(images),images.length),
            env.DB.prepare('INSERT OR IGNORE INTO community_history(id,guide_id,revision,content_json,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(guide.id+'-'+input.revision,guide.id,input.revision,JSON.stringify(content),time),
          ]);changed(result);
          await env.DB.prepare('DELETE FROM community_history WHERE guide_id=? AND id NOT IN (SELECT id FROM community_history WHERE guide_id=? ORDER BY revision DESC LIMIT 5)').bind(guide.id,guide.id).run();
          await env.DB.prepare("DELETE FROM community_progress WHERE guide_id=? AND step_id NOT IN (SELECT json_extract(value,'$.id') FROM community_guides,json_each(community_guides.published_json,'$.steps') WHERE community_guides.id=?)").bind(guide.id,guide.id).run();
          return reply({ok:true,revision:input.revision,slug:guide.slug});
        }
        const status=action==='archive'?'archived':'draft';
        if(action==='restore'&&guide.status!=='archived')throw failure('This guide is not archived.',409);
        const result=await env.DB.prepare(`UPDATE community_guides SET status=?,revision=revision+1,updated_at=? WHERE id=? AND owner_id=? AND revision=? AND ${live}`).bind(status,time,guide.id,user.id,input.revision,...credentials()).run();changed(result);
        return reply({ok:true,revision:input.revision+1});
      }
      throw failure('Method not allowed.',405);
    } catch(error) {
      if(error instanceof SyntaxError)return reply({error:'Invalid JSON.'},400);
      if(/quota reached/.test(String(error)))return reply({error:'Community storage limit reached. Remove unused images or contact staff.'},413);
      if(!error.status)console.error('Community API error',error);
      return reply({error:error.status?error.message:'Community is temporarily unavailable. Please try again.'},error.status||503);
    }
  };
}

export async function cleanupCommunity(env) {
  if(!env.COMMUNITY_FILES)return;
  const old=new Date(Date.now()-86400000).toISOString();
  const cursor=await env.DB.prepare('SELECT cursor_date,cursor_id FROM community_gc WHERE id=1').first();
  const rows=await env.DB.prepare("SELECT a.*,g.draft_json,g.published_json,g.owner_id FROM community_assets a JOIN community_guides g ON g.id=a.guide_id WHERE a.created_at<? AND (a.created_at,a.id)>(?,?) ORDER BY a.created_at,a.id LIMIT 100").bind(old,cursor.cursor_date,cursor.cursor_id).all();
  const retries=await env.DB.prepare("SELECT a.*,g.draft_json,g.published_json,g.owner_id FROM community_assets a JOIN community_guides g ON g.id=a.guide_id WHERE a.state='delete' ORDER BY a.created_at LIMIT 100").all();
  const candidates=[...new Map([...rows.results,...retries.results].map(row=>[row.id,row])).values()];
  for(const row of candidates) {
    if(row.state!=='delete'&&row.owner_id&&[...assetIds(parse(row.draft_json)),...assetIds(parse(row.published_json))].includes(row.id))continue;
    const reserved=await env.DB.prepare("UPDATE community_assets SET state='delete' WHERE id=? AND (state='delete' OR NOT EXISTS(SELECT 1 FROM community_guides g WHERE g.id=community_assets.guide_id AND g.owner_id IS NOT NULL AND (instr(g.draft_json,community_assets.id)>0 OR instr(COALESCE(g.published_json,''),community_assets.id)>0)))").bind(row.id).run();
    if(!reserved.meta.changes)continue;
    try {await env.COMMUNITY_FILES.delete(row.object_key);await env.DB.prepare("DELETE FROM community_assets WHERE id=? AND state='delete'").bind(row.id).run();}catch{/* Retain the charged reservation for retry. */}
  }
  const last=rows.results.length===100?rows.results.at(-1):null;
  await env.DB.prepare('UPDATE community_gc SET cursor_date=?,cursor_id=? WHERE id=1').bind(last?.created_at||'',last?.id||'').run();
}
