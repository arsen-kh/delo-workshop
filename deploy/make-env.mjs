import {randomBytes} from 'node:crypto';
import {writeFileSync,openSync,writeSync,closeSync} from 'node:fs';
const target=process.argv[2]||'.env';
const password=randomBytes(18).toString('base64url');
const content=['HOST=127.0.0.1','PORT=3000','DB_PATH=/var/lib/workshop/workshop.sqlite','ADMIN_USER=arsen','ADMIN_PASSWORD='+password,'SESSION_SECRET='+randomBytes(32).toString('hex'),''].join('\n');
const fd=openSync(target,'wx',0o600);try{writeSync(fd,content);}finally{closeSync(fd);}
// Password is displayed once to the person explicitly running setup on their own server.
console.log('Created '+target+' (mode 600). Login: arsen. Password: '+password);
