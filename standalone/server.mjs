import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHmac,scryptSync,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync,readdirSync,existsSync,statSync,createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateTicket,fields} from './model.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
const password=process.env.ADMIN_PASSWORD||'',secret=process.env.SESSION_SECRET||'',username=process.env.ADMIN_USER||'arsen';
if(password.length<12||secret.length<32){console.error('Set ADMIN_PASSWORD (12+ characters) and SESSION_SECRET (32+ characters) before starting.');process.exit(1);}
const databasePath=path.resolve(process.env.DB_PATH||'data/workshop.sqlite');mkdirSync(path.dirname(databasePath),{recursive:true});
const db=new DatabaseSync(databasePath);db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied TEXT NOT NULL)');
for(const name of readdirSync(path.join(root,'migrations')).filter(n=>n.endsWith('.sql')).sort())if(!db.prepare('SELECT name FROM schema_migrations WHERE name=?').get(name)){db.exec('BEGIN');try{db.exec(readFileSync(path.join(root,'migrations',name),'utf8'));db.prepare('INSERT INTO schema_migrations VALUES (?,?)').run(name,new Date().toISOString());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
const passwordHash=scryptSync(password,secret,64),attempts=new Map();
const keys=['customer','contact','device','description','status','priority','assignee','source','due','amount'];
const labels={customer:'клиент',contact:'контакт',device:'устройство',description:'описание',status:'статус',priority:'приоритет',assignee:'ответственный',source:'источник',due:'срок',amount:'стоимость'};
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function sign(value){return createHmac('sha256',secret).update(value).digest('base64url');}
function authenticated(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('workshop_session='))?.slice(17);if(!token)return false;const [nonce,expires,signature]=token.split('.');if(!nonce||!expires||!signature||Number(expires)<Date.now())return false;const expected=Buffer.from(sign(nonce+'.'+expires));const actual=Buffer.from(signature);return expected.length===actual.length&&timingSafeEqual(expected,actual);}
function secure(req){return req.headers['x-forwarded-proto']==='https';}
function originOK(req){const origin=req.headers.origin;return !!origin&&origin===`${secure(req)?'https':'http'}://${req.headers.host}`;}
async function readBody(req){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>20000){const e=new Error('Слишком большой запрос');e.code=413;throw e;}chunks.push(chunk);}return Buffer.concat(chunks).toString('utf8');}
function page(error=''){return `<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход — Дело</title><style>body{margin:0;background:#f2f6f3;color:#24443b;font:14px "Segoe UI",Arial;min-height:100vh;display:grid;place-items:center}main{max-width:340px;padding:35px;width:calc(100% - 80px);background:#fff;border:1px solid #e0e8e2;border-radius:18px;box-shadow:0 15px 60px #24443b0a}.logo{font-size:35px;font-weight:bold}h1{font-size:26px}p{color:#7b8d83;line-height:1.7}label{display:block;font-size:12px;margin-top:20px}input{display:block;box-sizing:border-box;width:100%;border:1px solid #dbe4de;border-radius:7px;padding:12px;margin-top:7px;font:inherit}button{width:100%;border:0;border-radius:7px;background:#21695e;color:white;padding:13px;margin-top:25px;cursor:pointer;font:inherit}.error{color:#a55749;font-size:12px}small{display:block;margin-top:24px;font-size:10px;color:#8d9c93}</style><main><div class="logo">дело.</div><h1>Мастерская под контролем</h1><p>Войдите, чтобы открыть заявки и отчёты.</p>${error?'<p class="error" role="alert">'+error+'</p>':''}<form action="/login" method="post"><label>Логин<input name="username" autocomplete="username" required autofocus maxlength="80"></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required maxlength="200"></label><button>Открыть мастерскую →</button></form><small>Личный учебный проект · Арсен Хутов</small></main></html>`;}
const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
 try{const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/health'){json(res,200,{ok:true});return;}
 if(url.pathname==='/login'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'});res.end(page());return;}
 if(url.pathname==='/login'&&req.method==='POST'){
  if(!originOK(req)){json(res,403,{error:'Недопустимый источник запроса'});return;}
  const ip=req.socket.remoteAddress||'unknown',now=Date.now();let entry=attempts.get(ip);if(!entry||now-entry.since>600000){entry={count:0,since:now};attempts.set(ip,entry);}if(entry.count>=10){res.writeHead(429,{'Content-Type':'text/html;charset=utf-8','Retry-After':'600'});res.end(page('Слишком много попыток. Повторите через 10 минут.'));return;}
  const values=new URLSearchParams(await readBody(req));const candidate=scryptSync(values.get('password')||'',secret,64);
  if(values.get('username')!==username||!timingSafeEqual(passwordHash,candidate)){entry.count++;res.writeHead(401,{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'});res.end(page('Неверный логин или пароль'));return;}
  attempts.delete(ip);const value=randomUUID()+'.'+(Date.now()+7*86400000);res.writeHead(303,{'Location':'/','Set-Cookie':`workshop_session=${value}.${sign(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${secure(req)?'; Secure':''}`,'Cache-Control':'no-store'});res.end();return;
 }
 if(!authenticated(req)){if(url.pathname.startsWith('/api/'))json(res,401,{error:'Войдите в мастерскую: сессия завершена'});else{res.writeHead(303,{'Location':'/login','Cache-Control':'no-store'});res.end();}return;}
 if(url.pathname==='/logout'&&req.method==='POST'){if(!originOK(req)){json(res,403,{error:'Недопустимый источник запроса'});return;}res.writeHead(303,{'Location':'/login','Set-Cookie':'workshop_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});res.end();return;}
 if(url.pathname==='/api/tickets'){
  if(req.method==='GET'){json(res,200,{tickets:db.prepare('SELECT * FROM tickets WHERE owner=? ORDER BY created DESC').all('owner'),events:db.prepare('SELECT * FROM events WHERE owner=? ORDER BY time DESC').all('owner')});return;}
  if(!['POST','PATCH'].includes(req.method)){json(res,405,{error:'Метод не поддерживается'});return;}
  if(!originOK(req)){json(res,403,{error:'Недопустимый источник запроса'});return;}
  let body;try{body=JSON.parse(await readBody(req));}catch(e){json(res,e.code||400,{error:e.code===413?e.message:'Некорректный JSON'});return;}
  const error=validateTicket(body);if(error){json(res,400,{error});return;}
  if(typeof body.id!=='string'||!/^[-a-zA-Z0-9]{10,80}$/.test(body.id)){json(res,400,{error:'Некорректный идентификатор'});return;}
  const data=fields(body),now=new Date().toISOString(),old=db.prepare('SELECT * FROM tickets WHERE id=? AND owner=?').get(body.id,'owner');
  if(req.method==='POST'){
   if(old){json(res,200,{ok:true,id:body.id});return;}
   db.exec('BEGIN');try{db.prepare(`INSERT INTO tickets (id,owner,${keys.join(',')},created,updated,version) VALUES (${Array(15).fill('?').join(',')})`).run(body.id,'owner',...keys.map(k=>data[k]),now,now,1);db.prepare('INSERT INTO events (id,ticket_id,owner,time,message) VALUES (?,?,?,?,?)').run(randomUUID(),body.id,'owner',now,'Заявка создана');db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
   json(res,201,{ok:true,id:body.id});return;
  }
  if(!old){json(res,404,{error:'Заявка не найдена'});return;}
  if(!Number.isInteger(body.version)||body.version!==old.version){json(res,409,{error:'Заявка уже изменена. Обновите список и откройте её заново.'});return;}
  const changed=keys.filter(k=>String(old[k])!==String(data[k]));
  if(changed.length){db.exec('BEGIN');try{db.prepare(`UPDATE tickets SET ${keys.map(k=>k+'=?').join(',')},updated=?,version=version+1 WHERE id=? AND owner=?`).run(...keys.map(k=>data[k]),now,body.id,'owner');db.prepare('INSERT INTO events (id,ticket_id,owner,time,message) VALUES (?,?,?,?,?)').run(randomUUID(),body.id,'owner',now,'Изменено: '+changed.map(k=>labels[k]).join(', '));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}
  json(res,200,{ok:true});return;
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){json(res,405,{error:'Метод не поддерживается'});return;}
 const publicPath=path.join(root,'public');let filename=path.resolve(publicPath,'.'+decodeURIComponent(url.pathname));if(!filename.startsWith(publicPath+path.sep)&&filename!==publicPath){json(res,404,{error:'Не найдено'});return;}
 if(!existsSync(filename)||statSync(filename).isDirectory())filename=path.join(publicPath,'index.html');
 const type={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}[path.extname(filename)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':type,'Cache-Control':path.extname(filename)==='.html'?'no-store':'private,max-age=86400'});if(req.method==='HEAD')res.end();else createReadStream(filename).pipe(res);
 }catch(e){console.error('Request failed:',e.message);if(!res.headersSent)json(res,e.code===413?413:500,{error:e.code===413?e.message:'Не удалось выполнить действие. Попробуйте ещё раз.'});else res.end();}
});
server.listen(port,host,()=>console.log(`Workshop ready: http://${host}:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
