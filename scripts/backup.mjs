import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import path from 'node:path';
const source=path.resolve(process.env.DB_PATH||'data/workshop.sqlite');
const target=path.resolve(process.argv[2]||('backups/workshop-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite'));
if(source===target)throw new Error('Backup destination must differ from the live database');
mkdirSync(path.dirname(target),{recursive:true});
const db=new DatabaseSync(source,{readOnly:true});
try{db.prepare('VACUUM INTO ?').run(target);chmodSync(target,0o600);console.log('Backup created: '+target);}finally{db.close();}
