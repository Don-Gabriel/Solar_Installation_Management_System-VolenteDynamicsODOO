import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import staticPlugin from '@fastify/static';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { auth } from './plugins/auth.js';
import { fileRoutes } from './plugins/files.js';
import { routes } from './routes.js';
import { pool, AppError } from './db.js';
export async function buildApp(options:{logger?:boolean;staticRoot?:string}={}){
 const app=Fastify({logger:options.logger??false,bodyLimit:1024*1024,ajv:{customOptions:{removeAdditional:false}}});
 await app.register(cookie);await app.register(helmet,{contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'",'data:','blob:'],connectSrc:["'self'"],fontSrc:["'self'"],objectSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:null}}});
 await app.register(rateLimit,{max:300,timeWindow:'1 minute'});await app.register(multipart,{limits:{fileSize:8*1024*1024,files:1,fields:2}});
 await app.register(swagger,{openapi:{info:{title:'SunPower Operations API',version:'0.1.0'},components:{securitySchemes:{session:{type:'apiKey',in:'cookie',name:'solar_session'}}}}});
 await auth(app);await app.register(swaggerUi,{routePrefix:'/api/docs'});
 app.get('/api/health',async()=>{await pool.query('SELECT 1');return {status:'ok',database:'connected'};});
 await routes(app);await fileRoutes(app);
 app.setErrorHandler((error,req,reply)=>{const e=error as any;if(e instanceof AppError)return reply.status(e.statusCode).send({error:{code:e.code,message:e.message}});if(e.validation)return reply.status(400).send({error:{code:'VALIDATION',message:'Check the submitted fields.',fields:e.validation.map((v:any)=>({path:v.instancePath||v.params?.missingProperty||'',message:v.message}))}});if(e.code==='23505')return reply.status(409).send({error:{code:'DUPLICATE',message:'That serial, reference or record already exists.'}});if(e.code==='23503')return reply.status(400).send({error:{code:'REFERENCE',message:'A referenced record no longer exists.'}});if(e.statusCode&&e.statusCode<500)return reply.status(e.statusCode).send({error:{code:'REQUEST',message:e.message}});req.log.error(e);return reply.status(500).send({error:{code:'INTERNAL',message:'The change could not be saved. Please retry.'}});});
 const root=options.staticRoot||resolve('apps/web/dist');if(existsSync(root)){await app.register(staticPlugin,{root,index:false});app.setNotFoundHandler((req,reply)=>req.url.startsWith('/api/')?reply.status(404).send({error:{code:'NOT_FOUND',message:'API route not found'}}):reply.type('text/html').sendFile('index.html'));}
 return app;
}
