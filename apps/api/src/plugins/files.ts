import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { pool, one, ensure, transaction, audit } from '../db.js';
import { accessibleJob } from '../modules/field.js';
import { allow } from './auth.js';
import { Params } from '../../../../packages/contracts/src/index.js';
export const uploadDir=resolve(process.env.UPLOAD_DIR||'data/uploads');
export async function fileRoutes(app:FastifyInstance){
 await mkdir(uploadDir,{recursive:true});
 app.post('/api/jobs/:id/evidence',{schema:{params:Params}},async req=>{
  allow(req,['admin','technician']);const {id}=req.params as {id:string};
  await transaction(db=>accessibleJob(db,req.user,id));
  const file=await req.file();ensure(file,'Choose a photo or signature file.',400);
  const kind=(file.fields.kind as {value?:string})?.value;ensure(kind==='photo'||kind==='signature','Evidence kind must be photo or signature.',400);
  const bytes=await file.toBuffer();ensure(!file.file.truncated&&bytes.length<=8*1024*1024,'File exceeds the 8 MB limit.',413);
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  ensure(png||jpeg||webp,'Use a PNG, JPEG or WebP image.',415);ensure(kind!=='signature'||png,'Signatures must be PNG images.',415);
  const mime=png?'image/png':jpeg?'image/jpeg':'image/webp',filename=`${randomUUID()}.${png?'png':jpeg?'jpg':'webp'}`,path=resolve(uploadDir,filename);
  await writeFile(path,bytes,{flag:'wx'});
  try{return await transaction(async db=>{const job=await accessibleJob(db,req.user,id);ensure(job.status==='in_progress','Start this job before saving evidence.');const row=await one(db,'INSERT INTO evidence(job_id,kind,filename,mime,size_bytes,uploaded_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,kind,size_bytes',[id,kind,filename,mime,bytes.length,req.user.id]);await audit(db,req.user.id,'project',job.project_id,'evidence.saved',{kind,evidence_id:row.id});return row;});}catch(e){await unlink(path).catch(()=>{});throw e;}
 });
 app.get('/api/evidence/:id',{schema:{params:Params}},async(req,reply)=>{const {id}=req.params as {id:string};const file=await one(pool,'SELECT e.*,j.technician_id FROM evidence e JOIN jobs j ON j.id=e.job_id WHERE e.id=$1',[id]);ensure(file,'Evidence not found',404);allow(req,['admin','technician','sales','support','surveyor']);ensure(req.user.role!=='technician'||file.technician_id===req.user.id,'This evidence belongs to another technician’s job.',403);reply.type(file.mime).header('Content-Disposition','inline').header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff');return reply.send(createReadStream(resolve(uploadDir,file.filename)));});
}
