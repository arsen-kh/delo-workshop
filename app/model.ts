export const statuses = {new:'Новая',diagnostics:'Диагностика',repair:'В работе',ready:'Готова',closed:'Закрыта',cancelled:'Отменена'};
export const priorities = {normal:'Обычный',high:'Срочный'};
export const sources = {phone:'Телефон',website:'Сайт',visit:'Визит',messenger:'Мессенджер'};
export type Ticket = {id:string;customer:string;contact:string;device:string;description:string;status:keyof typeof statuses;priority:keyof typeof priorities;assignee:string;source:keyof typeof sources;due:string;amount:number;created:string;updated:string;version:number};
export type TicketEvent = {id:string;ticket_id:string;time:string;message:string};
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function moscowDay(value:string){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function isOverdue(t:Ticket){return !!t.due && t.due<today() && !['closed','cancelled','ready'].includes(t.status);}
export function money(v:number){return new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(v);}
export function date(v:string){return v?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',timeZone:'Europe/Moscow'}).format(new Date(v.length===10?v+'T12:00:00Z':v)):'Без срока';}
export function validateTicket(v:any):string|null{
 if(!v || typeof v!=='object')return 'Некорректные данные';
 for(const [key,min,max,label] of [['customer',2,80,'Имя клиента'],['contact',5,100,'Контакт'],['device',2,100,'Устройство'],['description',5,2000,'Описание проблемы']] as const){if(typeof v[key]!=='string'||v[key].trim().length<min||v[key].trim().length>max)return `${label}: от ${min} до ${max} символов`;}
 const contact=v.contact.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)&&(!/^[+\d\s()\-]+$/.test(contact)||contact.replace(/\D/g,'').length<10||contact.replace(/\D/g,'').length>15))return 'Укажите телефон (10–15 цифр) или email';
 if(!Object.hasOwn(statuses,v.status)||!Object.hasOwn(priorities,v.priority)||!Object.hasOwn(sources,v.source))return 'Проверьте статус, приоритет и источник';
 if(typeof v.assignee!=='string'||v.assignee.length>80)return 'Ответственный: до 80 символов';
 if(typeof v.due!=='string'||(v.due && (!/^\d{4}-\d{2}-\d{2}$/.test(v.due)||!Number.isFinite(Date.parse(v.due+'T12:00:00Z'))||new Date(v.due+'T12:00:00Z').toISOString().slice(0,10)!==v.due)))return 'Некорректная дата';
 if(!Number.isInteger(v.amount)||v.amount<0||v.amount>10000000)return 'Стоимость: целое число от 0 до 10 000 000 ₽';
 return null;
}
export function fields(v:any){return {customer:v.customer.trim(),contact:v.contact.trim(),device:v.device.trim(),description:v.description.trim(),status:v.status,priority:v.priority,assignee:v.assignee.trim(),source:v.source,due:v.due,amount:v.amount};}
export function csvCell(v:unknown){let s=String(v??'');if(/^[\s]*[=+@\-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export function csv(rows:unknown[][]){return '\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n');}
