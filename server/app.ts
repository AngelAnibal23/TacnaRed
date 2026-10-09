import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {createStore,seed} from './store.ts';
import {number,text,validateState,schedule,pert,abc,eoq} from '../domain/engine.ts';
import type {AppState} from '../domain/types.ts';
export interface Options {dataDir?:string;password?:string;serveStatic?:boolean;production?:boolean;}
export async function createApp(options:Options={}){
 const production=options.production??process.env.NODE_ENV==='production';
 const password=options.password??process.env.OPERADOR_PASSWORD??'tacnared-demo';
 if(production&&(password==='tacnared-demo'||password.length<12))throw new Error('Para alojar la demo, configura OPERADOR_PASSWORD con una clave de 12 caracteres o más distinta de la clave de ejemplo.');
 const app=Fastify({logger:false,bodyLimit:2*1024*1024});
 const store=createStore(resolve(options.dataDir??process.env.DATA_DIR??'data'));
 const sessions=new Map<string,number>();const attempts=new Map<string,{count:number;until:number}>();
 await app.register(cookie);
 app.addHook('onClose',async()=>{store.close();});
 app.addHook('onRequest',async(req,reply)=>{
  reply.header('X-Content-Type-Options','nosniff').header('X-Frame-Options','DENY').header('Referrer-Policy','same-origin');
  reply.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  if(!req.url.startsWith('/api/'))return;
  reply.header('Cache-Control','no-store');
  if(!['GET','HEAD'].includes(req.method)&&req.headers.origin){
   let same=false;try{same=new URL(req.headers.origin).host===req.headers.host;}catch{}
   if(!same)return reply.code(403).send({message:'Origen de solicitud inválido.'});
  }
  for(const [key,until] of sessions)if(until<Date.now())sessions.delete(key);
  if(req.url==='/api/login'||req.url==='/api/health')return;
  const token=req.cookies.tacnared_session;
  if(!token||!sessions.has(token))return reply.code(401).send({message:'Ingresa con la clave del operador.'});
 });
 app.setErrorHandler((error,_req,reply)=>{
  const status=(error as {statusCode?:number}).statusCode;
  reply.code(status&&status>=400&&status<=599?status:400).send({message:(error as Error).message||'No se pudo procesar la solicitud.'});
 });
 app.get('/api/health',async()=>({ok:true}));
 app.post<{Body:{password:string}}>('/api/login',async(req,reply)=>{
  const previous=attempts.get(req.ip);
  if(previous&&previous.until>Date.now()&&previous.count>=10)return reply.code(429).send({message:'Demasiados intentos. Espera 5 minutos.'});
  const supplied=req.body?.password;
  const valid=typeof supplied==='string'&&Buffer.byteLength(supplied)===Buffer.byteLength(password)&&timingSafeEqual(Buffer.from(supplied),Buffer.from(password));
  if(!valid){const current=previous&&previous.until>Date.now()?previous:{count:0,until:Date.now()+300000};current.count++;attempts.set(req.ip,current);return reply.code(401).send({message:'Clave incorrecta.'});}
  attempts.delete(req.ip);const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*60*60*1000);
  reply.setCookie('tacnared_session',token,{httpOnly:true,sameSite:'strict',secure:production,path:'/',maxAge:8*60*60});
  return {ok:true};
 });
 app.post('/api/logout',async(req,reply)=>{sessions.delete(req.cookies.tacnared_session??'');reply.clearCookie('tacnared_session',{path:'/'});return {ok:true};});
 app.get('/api/state',async()=>store.read());
 app.put<{Body:AppState}>('/api/state',async(req)=>{
  const next=req.body;validateState(next);const old=store.read();
  if(old.revision!==next.revision)throw Object.assign(new Error('Los datos cambiaron en otra ventana. Recarga antes de guardar.'),{statusCode:409});
  if(JSON.stringify(old.movements)!==JSON.stringify(next.movements))throw new Error('El historial se conserva; registra las entradas y salidas en Inventario.');
  for(const p of old.products){const updated=next.products.find(x=>x.id===p.id);if(updated&&updated.stock!==p.stock)throw new Error('Para cambiar el stock registra un movimiento de inventario.');}
  return store.write(next);
 });
 app.post<{Body:{revision:number;product_id:string;kind:'entry'|'exit';quantity:number;reason:string}}>('/api/movements',async(req)=>{
  const input=req.body;number(input?.revision,'Revisión');const next=store.read();
  if(input.revision!==next.revision)throw Object.assign(new Error('Los datos cambiaron. Recarga antes de registrar el movimiento.'),{statusCode:409});
  const p=next.products.find(x=>x.id===input.product_id);if(!p)throw new Error('Producto inexistente.');
  if(!['entry','exit'].includes(input.kind))throw new Error('Tipo de movimiento inválido.');
  number(input.quantity,'Cantidad',0,true);text(input.reason,'Motivo',200);
  const stock=p.stock+(input.kind==='entry'?input.quantity:-input.quantity);
  if(stock<0)throw new Error('La salida supera el stock disponible.');
  if(p.capacity!==null&&stock>p.capacity)throw new Error('La entrada supera la capacidad del almacén.');
  p.stock=stock;next.movements.push({id:randomUUID(),product_id:p.id,kind:input.kind,quantity:input.quantity,reason:input.reason,created_at:new Date().toISOString(),stock_after:stock});
  return store.write(next);
 });
 app.post<{Body:{revision:number}}>('/api/demo/reset',async(req)=>{
  number(req.body?.revision,'Revisión');return store.write(seed(req.body.revision));
 });
 app.post<{Body:{state:AppState;project_id:string;deadline:number}}>('/api/analyze',async(req)=>{
  const {state,project_id,deadline}=req.body;validateState(state);
  const p=state.projects.find(x=>x.id===project_id);if(!p)throw new Error('Proyecto inexistente.');
  return {cpm:schedule(p.activities),pert:pert(p.activities,deadline),abc:abc(state.products),eoq:state.products.filter(x=>x.eoq_eligible).map(x=>{try{return {id:x.id,...eoq(x,state.operating_days)};}catch(error){return {id:x.id,error:(error as Error).message};}})};
 });
 const dist=fileURLToPath(new URL('../dist/',import.meta.url));
 if(options.serveStatic!==false&&existsSync(resolve(dist,'index.html'))){
  await app.register(fastifyStatic,{root:dist,prefix:'/'});
  app.setNotFoundHandler((req,reply)=>{if(req.url.startsWith('/api/'))return reply.code(404).send({message:'Recurso inexistente.'});return reply.sendFile('index.html');});
 }
 return app;
}
