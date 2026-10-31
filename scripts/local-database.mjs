// A dedicated loopback-only development cluster; never modifies installed databases.
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
const bin=process.env.PG_BIN || (process.platform==='win32'?'C:/Program Files/PostgreSQL/18/bin':'/usr/lib/postgresql/18/bin');
const data=join(root,'data/postgres');
mkdirSync(join(root,'data'),{recursive:true});
function run(name,args,allow=false){const r=spawnSync(join(bin,name+(process.platform==='win32'?'.exe':'')),args,{encoding:'utf8'});if(r.status&&!allow)throw new Error(r.stderr||r.stdout);return r;}
if(!existsSync(join(data,'PG_VERSION'))){
 if(existsSync(join(root,'.env')))throw new Error('Existing .env found. Configure its database or move it aside before creating a fresh cluster.');
 const password=randomBytes(24).toString('hex');const pwfile=join(root,'data/.init-password');writeFileSync(pwfile,password,{mode:0o600});
 try{run('initdb',['-D',data,'-U','solar','--encoding=UTF8','--locale=C','--auth=scram-sha-256',`--pwfile=${pwfile}`]);}finally{unlinkSync(pwfile);}
 writeFileSync(join(root,'.env'),`DATABASE_URL=postgresql://solar:${password}@127.0.0.1:55432/solar\nPORT=3001\nHOST=127.0.0.1\nUPLOAD_DIR=./data/uploads\nCOOKIE_SECURE=false\nDEMO_PASSWORD=SolarDemo!2026\n`,{mode:0o600});
}
const status=run('pg_ctl',['-D',data,'status'],true);
if(status.status){const result=spawnSync(join(bin,'pg_ctl'+(process.platform==='win32'?'.exe':'')),['-D',data,'-l',join(root,'data/postgres.log'),'-o','-p 55432 -h 127.0.0.1','-w','start'],{stdio:'ignore',timeout:30000});if(result.status)throw Error('Database startup failed; see data/postgres.log.');}
const line=readFileSync(join(root,'.env'),'utf8').split('\n').find(l=>l.startsWith('DATABASE_URL='));
const url=new URL(line.slice(13));process.env.PGPASSWORD=decodeURIComponent(url.password);
const found=run('psql',['-h','127.0.0.1','-p','55432','-U','solar','-d','postgres','-tAc',"SELECT 1 FROM pg_database WHERE datname='solar'"]);
if(!found.stdout.includes('1'))run('createdb',['-h','127.0.0.1','-p','55432','-U','solar','solar']);
console.log('Dedicated PostgreSQL ready on 127.0.0.1:55432. Credentials saved in ignored .env.');
