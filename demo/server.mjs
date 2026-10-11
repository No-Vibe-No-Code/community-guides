// Local-only, ephemeral development host. Never deploy these mock accounts.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,extname,resolve} from 'node:path';
import {fixture,document} from '../tests/fixture.mjs';
const f=fixture();for(const [id,role] of [['author','member'],['reader','member'],['staff','teacher']])f.add(id,role);
for(const [title,topic,level] of [['Your first personal website','Websites',3],['Make a study companion','AI & agents',5],['Design a memorable portfolio','Design',2]]){
 const content={...document(),title,topic};content.steps[1].level=level;const guide=await(await f.call('/guides',{method:'POST',body:{accountId:'author',content}})).json();await f.call('/guides/'+guide.id+'/publish',{method:'POST',body:{accountId:'author',revision:1}});
}
const base=fileURLToPath(new URL('..',import.meta.url)),hostAssets=process.env.COMMUNITY_HOST_ASSETS,port=Number(process.env.PORT||8798);
const contentType=path=>({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream');
createServer(async(req,res)=>{
 try{
  const origin='http://127.0.0.1:'+port,url=new URL(req.url,origin);
  if(url.pathname==='/__demo/account'){const who=url.searchParams.get('who')||'';if(!['author','reader','staff',''].includes(who))throw Error('Unknown demo account');res.writeHead(200,{'set-cookie':`nvnc_session=${who?'s-'+who:''}; Path=/; SameSite=Lax`,'content-type':'text/plain'});res.end('Demo account selected');return;}
  if(url.pathname.startsWith('/api/community')){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);const request=new Request(origin+req.url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});const response=await f.api(request,f.env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  if(hostAssets){
   let path=decodeURIComponent(url.pathname);if(path.includes('..'))throw Error('Bad path');if(path==='/community'||path.startsWith('/community/'))path='/community/index.html';else if(path.endsWith('/'))path+='index.html';
   const root=resolve(hostAssets),file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))throw Error('Bad path');const data=await readFile(file);res.writeHead(200,{'content-type':contentType(file)});res.end(data);return;
  }
  if(url.pathname.startsWith('/web/')||url.pathname.startsWith('/server/')){const path=resolve(base,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(base+'/'))throw Error('Bad path');res.writeHead(200,{'content-type':contentType(path)});res.end(await readFile(path));return;}
  res.writeHead(200,{'content-type':'text/html'});res.end(await readFile(join(base,'demo/index.html')));
 }catch(error){res.writeHead(404,{'content-type':'text/plain'});res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Community preview: http://127.0.0.1:${port}/community/ (ephemeral demo data)`));
