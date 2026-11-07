import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export function parseCSV(content){
 const s=content.replace(/^\uFEFF/,'');const first=s.split(/\r?\n/)[0]||'';const delimiter=first.includes(';')?';':',';
 const rows=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<s.length;i++){const ch=s[i];if(quoted){if(ch==='"'){if(s[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
  if(ch==='"'){if(cell||closed)throw new Error('Кавычка внутри неэкранированного поля');quoted=true;continue;}
  if(ch===delimiter){row.push(cell);cell='';closed=false;continue;}
  if(ch==='\n'||ch==='\r'){if(ch==='\r'&&s[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';closed=false;continue;}
  if(closed)throw new Error('Лишние символы после закрывающей кавычки');cell+=ch;
 }
 if(quoted)throw new Error('Незакрытая кавычка в CSV');if(cell||row.length){row.push(cell);if(row.some(v=>v!==''))rows.push(row);}return rows;
}
export function csv(rows){return '\uFEFF'+rows.map(row=>row.map(v=>{let s=String(v??'');if(/^\s*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(';')).join('\r\n');}
const statuses=['Новая','Диагностика','В работе','Готова','Закрыта','Отменена'];
const day=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
function validDay(v){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;}
export function summarize(files,{from='',to='',asOf=day(new Date())}={}){
 if((from&&!validDay(from))||(to&&!validDay(to))||!validDay(asOf)||from&&to&&from>to)throw new Error('Проверьте даты периода (YYYY-MM-DD)');
 const records=new Map(),errors=[];let duplicates=0;
 for(const file of files){const rows=parseCSV(file.content);if(!rows.length)throw new Error(`${file.name}: файл пуст`);const headers=rows.shift();const required=['Номер','Статус','Ответственный','Срок','Стоимость, ₽','Создана'];for(const h of required)if(!headers.includes(h))throw new Error(`${file.name}: нет столбца «${h}»`);if(new Set(headers).size!==headers.length)throw new Error(`${file.name}: повторяющиеся заголовки`);
 rows.forEach((row,i)=>{
  const record=Object.fromEntries(headers.map((h,j)=>[h,row[j]??'']));const fail=reason=>errors.push([file.name,i+2,record['Номер'],reason]);
  if(row.length!==headers.length){fail('Число столбцов не совпадает с заголовком');return;}
  if(!record['Номер'].trim()){fail('Пустой номер заявки');return;}
  if(!statuses.includes(record['Статус'])){fail('Неизвестный статус');return;}
  if(!/^\d+$/.test(record['Стоимость, ₽'])||Number(record['Стоимость, ₽'])>10000000){fail('Некорректная стоимость');return;}
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(record['Создана'])||!Number.isFinite(Date.parse(record['Создана']))){fail('Некорректная дата создания');return;}
  if(record['Срок']&&!validDay(record['Срок'])){fail('Некорректный срок');return;}
  const key=record['Номер'],old=records.get(key);
  if(old){if(required.every(h=>old[h]===record[h])){duplicates++;return;}throw new Error(`Противоречивые версии заявки ${key}: используйте актуальную выгрузку`);}
  records.set(key,record);
 });}
 const selected=[...records.values()].filter(r=>(!from||day(r['Создана'])>=from)&&(!to||day(r['Создана'])<=to));
 const closed=selected.filter(r=>r['Статус']==='Закрыта');const overdue=selected.filter(r=>r['Срок']&&r['Срок']<asOf&&!['Закрыта','Отменена','Готова'].includes(r['Статус']));
 return {from,to,asOf,total:selected.length,closed:closed.length,amount:closed.reduce((s,r)=>s+Number(r['Стоимость, ₽']),0),overdue:overdue.length,duplicates,errors,records:selected,statusCounts:statuses.map(s=>[s,selected.filter(r=>r['Статус']===s).length])};
}
const escape=v=>String(v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export async function main(args){
 let out='report-output',from='',to='';const filenames=[];
 for(let i=0;i<args.length;i++){if(['--out','--from','--to'].includes(args[i])){const key=args[i],value=args[++i];if(!value)throw new Error(`Нет значения ${key}`);if(key==='--out')out=value;if(key==='--from')from=value;if(key==='--to')to=value;}else if(args[i].startsWith('--'))throw new Error('Неизвестный параметр '+args[i]);else filenames.push(args[i]);}
 if(!filenames.length)throw new Error('Использование: node automation/report.mjs заявки.csv [ещё.csv] --out отчёт --from YYYY-MM-DD --to YYYY-MM-DD');
 const files=await Promise.all(filenames.map(async name=>({name,content:await readFile(name,'utf8')})));const r=summarize(files,{from,to});
 await mkdir(out,{recursive:true});
 await writeFile(path.join(out,'summary.csv'),csv([['Показатель','Значение'],['Созданы с',from||'Все даты'],['Созданы по',to||'Все даты'],['Состояние на',r.asOf],['Заявок',r.total],['Закрыто',r.closed],['Просрочено',r.overdue],['Стоимость закрытых работ, ₽ (не факт оплаты)',r.amount],['Пропущено идентичных дублей',r.duplicates],['Отклонено строк',r.errors.length],...r.statusCounts]));
 await writeFile(path.join(out,'errors.csv'),csv([['Файл','Номер записи (с заголовком)','Номер заявки','Причина'],...r.errors]));
 const headings=['Номер','Клиент','Устройство','Статус','Ответственный','Срок','Стоимость, ₽','Создана'];await writeFile(path.join(out,'details.csv'),csv([headings,...r.records.map(row=>headings.map(h=>row[h]||''))]));
 const html=`<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Дело — отчёт по заявкам</title><style>body{font:14px "Segoe UI",Arial;background:#f5f7f5;color:#23453b;margin:0;padding:45px 20px}main{max-width:1000px;margin:auto}h1{font-size:34px;letter-spacing:-1px}.muted,p{color:#7b8c83;line-height:1.7}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px;margin:30px 0}.card,section{padding:22px;background:white;border:1px solid #e2e8e2;border-radius:12px}.card strong{font-size:32px;display:block;margin-top:13px}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:12px;border-bottom:1px solid #e2e8e2;font-size:12px}.scroll{overflow:auto}h2{font-size:18px}.bar{background:#eaf2ec;height:8px;border-radius:5px}.fill{height:8px;background:#79a58b;border-radius:5px}small{color:#829189}</style><main><small>ДЕЛО / АВТОМАТИЗАЦИЯ ОТЧЁТА</small><h1>Мастерская в цифрах</h1><p>Создание заявок: ${escape(from||'за всё время')} — ${escape(to||'по текущую дату')}. Состояние на ${r.asOf}, Москва.</p><div class="grid">${[['Заявок',r.total],['Закрыто',r.closed],['Просрочено',r.overdue],['Стоимость закрытых работ',r.amount.toLocaleString('ru-RU')+' ₽']].map(([l,v])=>'<div class="card">'+l+'<strong>'+v+'</strong></div>').join('')}</div><section><h2>Распределение по статусам</h2>${r.statusCounts.map(([s,n])=>'<p>'+s+' · '+n+'</p><div class="bar"><div class="fill" style="width:'+(r.total?n/r.total*100:0)+'%"></div></div>').join('')}</section><p>Стоимость не означает факт оплаты. Пропущено идентичных дублей: ${r.duplicates}. Отклонено строк: ${r.errors.length}; причины — в errors.csv. Противоречивые версии одной заявки останавливают расчёт.</p><section><h2>Детализация</h2><div class="scroll"><table><thead><tr>${headings.slice(0,7).map(h=>'<th>'+escape(h)+'</th>').join('')}</tr></thead><tbody>${r.records.map(row=>'<tr>'+headings.slice(0,7).map(h=>'<td>'+escape(row[h]||'—')+'</td>').join('')+'</tr>').join('')}</tbody></table></div></section></main></html>`;
 await writeFile(path.join(out,'report.html'),html);console.log(JSON.stringify({output:path.resolve(out),tickets:r.total,rejected:r.errors.length,duplicates:r.duplicates}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
