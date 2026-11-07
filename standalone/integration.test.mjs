import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
await mkdir('.sites-runtime/tests',{recursive:true});const folder=await mkdtemp(path.resolve('.sites-runtime/tests/run-'));
const port=34219,base=`http://127.0.0.1:${port}`,env={...process.env,PORT:String(port),HOST:'127.0.0.1',DB_PATH:path.join(folder,'test.sqlite'),ADMIN_USER:'test',ADMIN_PASSWORD:'test-only-password-2026',SESSION_SECRET:'test-only-session-secret-1234567890'};
let processHandle;
async function start(){processHandle=spawn(process.execPath,['server-dist/server.mjs'],{env,stdio:['ignore','pipe','pipe']});let log='';processHandle.stdout.on('data',b=>log+=b);processHandle.stderr.on('data',b=>log+=b);for(let i=0;i<100;i++){try{const r=await fetch(base+'/health');if(r.ok)return;}catch{}if(processHandle.exitCode!==null)throw new Error(log);await new Promise(r=>setTimeout(r,100));}throw new Error('Server did not start: '+log);}
async function stop(){if(processHandle&&processHandle.exitCode===null){processHandle.kill();await new Promise(r=>processHandle.once('exit',r));}}
let cookie='';async function call(method,body,origin=base){const r=await fetch(base+'/api/tickets',{method,headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json()};}
try{
 await start();assert.equal((await call('GET')).status,401);
 const wrong=await fetch(base+'/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:'username=test&password=wrong',redirect:'manual'});assert.equal(wrong.status,401);
 const login=await fetch(base+'/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:'username=test&password='+env.ADMIN_PASSWORD,redirect:'manual'});assert.equal(login.status,303);cookie=login.headers.get('set-cookie').split(';')[0];assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));
 const original={id:'test-ticket-0001',customer:'Тестовый клиент',contact:'test@example.com',device:'Ноутбук',description:'Проверка сохранения данных',status:'new',priority:'normal',assignee:'Арсен',source:'phone',due:'2026-11-20',amount:1500};
 assert.equal((await call('POST',original,'https://other.example')).status,403);
 for(const changes of [{contact:'bad'},{due:'2026-02-30'},{amount:-1},{customer:' '},{status:'constructor'}])assert.equal((await call('POST',{...original,...changes})).status,400);
 assert.equal((await call('POST',original)).status,201);assert.equal((await call('POST',original)).status,200);
 let data=(await call('GET')).body;assert.equal(data.tickets.length,1);assert.equal(data.events.length,1);assert.equal(data.tickets[0].amount,1500);
 const updates=await Promise.all([call('PATCH',{...original,version:1,status:'repair'}),call('PATCH',{...original,version:1,status:'ready'})]);assert.deepEqual(updates.map(r=>r.status).sort(),[200,409]);
 data=(await call('GET')).body;assert.equal(data.tickets[0].version,2);assert.equal(data.events.length,2);
 await stop();await start();data=(await call('GET')).body;assert.equal(data.tickets.length,1);assert.equal(data.tickets[0].version,2);assert.equal(data.events.length,2);
 assert.equal((await call('PATCH',{...data.tickets[0],status:'closed'})).status,200);
 const assets=await fetch(base+'/',{headers:{Cookie:cookie}});assert.equal(assets.status,200);assert.ok((await assets.text()).includes('<div id="root">'));
 const logout=await fetch(base+'/logout',{method:'POST',headers:{Cookie:cookie,Origin:base},redirect:'manual'});assert.equal(logout.status,303);assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));
 console.log('PASS: authentication, origin checks, five validation cases, idempotency, concurrent edits, history, restart persistence, completion, page and logout.');
}finally{await stop();await rm(folder,{recursive:true,force:true});}
