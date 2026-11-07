import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { fields, validateTicket } from '../../model';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const keys=['customer','contact','device','description','status','priority','assignee','source','due','amount'];
async function identity(req:Request,write=false){const u=await getChatGPTUser();if(!u)return null;if(write && req.headers.get('origin')!==new URL(req.url).origin)throw new Error('origin');return u.userId;}
export async function GET(req:Request){
 try{const owner=await identity(req);if(!owner)return json({error:'Войдите, чтобы открыть заявки'},401);
 const [t,e]=await Promise.all([env.DB!.prepare('SELECT * FROM tickets WHERE owner = ? ORDER BY created DESC').bind(owner).all(),env.DB!.prepare('SELECT id,ticket_id,time,message FROM events WHERE owner = ? ORDER BY time DESC').bind(owner).all()]);return json({tickets:t.results,events:e.results});
 }catch(err){console.error('Read tickets',err);return json({error:'Не удалось загрузить заявки. Попробуйте обновить страницу.'},500);}
}
export async function POST(req:Request){
 try{const owner=await identity(req,true);if(!owner)return json({error:'Необходимо войти'},401);
 if(Number(req.headers.get('content-length')||0)>20000)return json({error:'Слишком большой запрос'},413);
 let body:any;try{body=await req.json();}catch{return json({error:'Некорректный JSON'},400);}
 const error=validateTicket(body);if(error)return json({error},400);
 if(typeof body.id!=='string'||!/^[-a-zA-Z0-9]{10,80}$/.test(body.id))return json({error:'Некорректный идентификатор'},400);
 if(/^demo-workshop-[1-6]$/.test(body.id))body.id=`demo-${owner}-${body.id.slice(-1)}`;
 const data=fields(body),now=new Date().toISOString();
 const existing=await env.DB!.prepare('SELECT owner FROM tickets WHERE id=?').bind(body.id).first<{owner:string}>();
 if(existing)return existing.owner===owner?json({ok:true,id:body.id}):json({error:'Идентификатор уже используется'},409);
 await env.DB!.batch([
 env.DB!.prepare(`INSERT INTO tickets (id,owner,${keys.join(',')},created,updated,version) VALUES (${Array(15).fill('?').join(',')})`).bind(body.id,owner,...keys.map(k=>(data as any)[k]),now,now,1),
 env.DB!.prepare('INSERT INTO events (id,ticket_id,owner,time,message) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),body.id,owner,now,'Заявка создана')]);
 return json({ok:true,id:body.id},201);
 }catch(err){if((err as Error).message==='origin')return json({error:'Недопустимый источник запроса'},403);console.error('Create ticket',err);return json({error:'Не удалось сохранить заявку. Повторите попытку.'},500);}
}
export async function PATCH(req:Request){
 try{const owner=await identity(req,true);if(!owner)return json({error:'Необходимо войти'},401);
 let body:any;try{body=await req.json();}catch{return json({error:'Некорректный JSON'},400);}
 const error=validateTicket(body);if(error)return json({error},400);
 if(!Number.isInteger(body.version)||body.version<1||typeof body.id!=='string')return json({error:'Некорректная версия заявки'},400);
 const old=await env.DB!.prepare('SELECT * FROM tickets WHERE id=? AND owner=?').bind(body.id,owner).first<any>();
 if(!old)return json({error:'Заявка не найдена'},404);
 if(old.version!==body.version)return json({error:'Заявка уже изменена. Обновите список и откройте её заново.'},409);
 const data=fields(body),now=new Date().toISOString(),eventId=crypto.randomUUID();
 const changed=keys.filter(k=>String(old[k])!==String((data as any)[k]));
 if(!changed.length)return json({ok:true});
 const labels:Record<string,string>={customer:'клиент',contact:'контакт',device:'устройство',description:'описание',status:'статус',priority:'приоритет',assignee:'ответственный',source:'источник',due:'срок',amount:'стоимость'};
 const result=await env.DB!.batch([
 env.DB!.prepare('INSERT INTO events (id,ticket_id,owner,time,message) SELECT ?,id,owner,?,? FROM tickets WHERE id=? AND owner=? AND version=?').bind(eventId,now,'Изменено: '+changed.map(k=>labels[k]).join(', '),body.id,owner,body.version),
 env.DB!.prepare(`UPDATE tickets SET ${keys.map(k=>k+'=?').join(',')},updated=?,version=version+1 WHERE id=? AND owner=? AND version=?`).bind(...keys.map(k=>(data as any)[k]),now,body.id,owner,body.version)]);
 if(!result[1].meta.changes)return json({error:'Заявка уже изменена. Обновите список.'},409);
 return json({ok:true});
 }catch(err){if((err as Error).message==='origin')return json({error:'Недопустимый источник запроса'},403);console.error('Update ticket',err);return json({error:'Не удалось сохранить изменения'},500);}
}
