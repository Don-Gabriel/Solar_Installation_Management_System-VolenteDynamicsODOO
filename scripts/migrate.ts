import { Pool } from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const pool=new Pool({connectionString:process.env.DATABASE_URL});const db=await pool.connect();
try{
 await db.query('SELECT pg_advisory_lock(902631)');
 await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
 for(const file of (await readdir(resolve('db/migrations'))).filter(f=>f.endsWith('.sql')).sort()){
  const sql=await readFile(resolve('db/migrations',file),'utf8');const hash=createHash('sha256').update(sql).digest('hex');
  const existing=await db.query('SELECT checksum FROM schema_migrations WHERE name=$1',[file]);
  if(existing.rowCount){if(existing.rows[0].checksum!==hash)throw Error(`Previously applied migration changed: ${file}`);continue;}
  await db.query('BEGIN');try{await db.query(sql);await db.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',[file,hash]);await db.query('COMMIT');console.log(`Applied ${file}`);}catch(e){await db.query('ROLLBACK');throw e;}
 }
}finally{await db.query('SELECT pg_advisory_unlock(902631)');db.release();await pool.end();}
