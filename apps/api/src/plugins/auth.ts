import { randomBytes, createHash } from 'node:crypto';
import argon2 from 'argon2';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { pool, one, ensure, AppError } from '../db.js';
import { Login, type User, type Role } from '../../../../packages/contracts/src/index.js';
declare module 'fastify' {interface FastifyRequest {user:User;csrfToken:string;}}
export const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
const secure=process.env.COOKIE_SECURE==='true';
export function allow(req:FastifyRequest,roles:Role[]){ensure(req.user&&roles.includes(req.user.role),'Your role cannot perform this action.',403);}
export async function auth(app:FastifyInstance){
 app.decorateRequest('user');app.decorateRequest('csrfToken','');
 const dummy=await argon2.hash(randomBytes(32));
 app.addHook('onRequest',async(req,reply)=>{
  reply.header('Cache-Control','no-store');
  if(!req.url.startsWith('/api/'))return;
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){const origins=(process.env.APP_ORIGINS||'http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3001,http://localhost:3001').split(',');ensure(origins.includes(req.headers.origin),'Request origin is not allowed.',403);}
  if(['/api/login','/api/health','/api/enquiries/public'].includes(req.url.split('?')[0]))return;
  const token=req.cookies.solar_session;ensure(token,'Sign in to continue.',401);
  const session=await one(pool,'SELECT u.id,u.name,u.email,u.role,s.csrf_token FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active',[digest(token)]);ensure(session,'Your session has expired. Sign in again.',401);
  req.user={id:session.id,name:session.name,email:session.email,role:session.role};req.csrfToken=session.csrf_token;
  if(!['GET','HEAD','OPTIONS'].includes(req.method))ensure(req.headers['x-csrf-token']===session.csrf_token,'Refresh the page before submitting this change.',403);
  if(req.url.startsWith('/api/docs'))allow(req,['admin']);
 });
 app.post('/api/login',{schema:{body:Login,tags:['Access']},config:{rateLimit:{max:10,timeWindow:'1 minute'}}},async(req,reply)=>{
  const body=req.body as {email:string,password:string};const user=await one(pool,'SELECT * FROM users WHERE lower(email)=lower($1) AND active',[body.email]);
  const valid=await argon2.verify(user?.password_hash||dummy,body.password);if(!user||!valid)throw new AppError(401,'Email or password is incorrect.','INVALID_CREDENTIALS');
  const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');await pool.query('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at) VALUES($1,$2,$3,now()+interval \'12 hours\')',[digest(token),user.id,csrf]);
  reply.setCookie('solar_session',token,{httpOnly:true,secure,sameSite:'strict',path:'/',maxAge:43200});return {user:{id:user.id,name:user.name,email:user.email,role:user.role},csrfToken:csrf};
 });
 app.get('/api/me',async req=>({user:req.user,csrfToken:req.csrfToken}));
 app.post('/api/logout',async(req,reply)=>{await pool.query('DELETE FROM sessions WHERE token_hash=$1',[digest(req.cookies.solar_session||'')]);reply.clearCookie('solar_session',{path:'/'});return {ok:true};});
}
