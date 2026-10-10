import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {inflateRawSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.ts';
test('API: autentica, persiste, valida, registra stock y evita sobrescrituras',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tacnared-'));
 let app:any;
 try {
  app=await createApp({dataDir:dir,password:'clave-prueba',serveStatic:false});
  assert.equal((await app.inject({method:'GET',url:'/api/state'})).statusCode,401);
  assert.equal((await app.inject({method:'POST',url:'/api/login',payload:{password:'errada'}})).statusCode,401);
  const login=await app.inject({method:'POST',url:'/api/login',payload:{password:'clave-prueba'}});
  assert.equal(login.statusCode,200);
  const cookie=login.headers['set-cookie'].split(';')[0];const headers={cookie};
  const original=(await app.inject({method:'GET',url:'/api/state',headers})).json();
  const changed=structuredClone(original);changed.projects[0].name='Proyecto guardado';changed.projects[0].control_day=12;changed.projects[0].activities.find((a:any)=>a.id==='C').actual_finish=6;
  const saved=await app.inject({method:'PUT',url:'/api/state',headers,payload:changed});
  assert.equal(saved.statusCode,200);assert.equal(saved.json().revision,original.revision+1);
  assert.equal((await app.inject({method:'PUT',url:'/api/state',headers,payload:changed})).statusCode,409);
  const bad=structuredClone(saved.json());bad.projects[0].activities[0].predecessors=['L'];
  assert.equal((await app.inject({method:'PUT',url:'/api/state',headers,payload:bad})).statusCode,400);
  const movement=await app.inject({method:'POST',url:'/api/movements',headers,payload:{revision:saved.json().revision,product_id:'MAT01',kind:'exit',quantity:100,reason:'Prueba de salida'}});
  assert.equal(movement.statusCode,200);assert.equal(movement.json().products[0].stock,2100);
  assert.equal(movement.json().movements.length,1);
  const negative=await app.inject({method:'POST',url:'/api/movements',headers,payload:{revision:movement.json().revision,product_id:'MAT01',kind:'exit',quantity:9999,reason:'Salida inválida'}});
  assert.equal(negative.statusCode,400);
  await app.close();
  app=await createApp({dataDir:dir,password:'clave-prueba',serveStatic:false});
  const login2=await app.inject({method:'POST',url:'/api/login',payload:{password:'clave-prueba'}});
  const headers2={cookie:login2.headers['set-cookie'].split(';')[0]};
  const recovered=(await app.inject({method:'GET',url:'/api/state',headers:headers2})).json();
  assert.equal(recovered.projects[0].name,'Proyecto guardado');assert.equal(recovered.products[0].stock,2100);assert.equal(recovered.projects[0].control_day,12);assert.equal(recovered.projects[0].activities.find((a:any)=>a.id==='C').actual_finish,6);
  assert.equal((await app.inject({method:'POST',url:'/api/demo/reset',headers:headers2,payload:{revision:original.revision}})).statusCode,409);
  const reset=await app.inject({method:'POST',url:'/api/demo/reset',headers:headers2,payload:{revision:recovered.revision}});
  assert.equal(reset.statusCode,200);assert.equal(reset.json().products[0].stock,2200);
  assert.equal((await app.inject({method:'POST',url:'/api/logout',headers:headers2})).statusCode,200);
  assert.equal((await app.inject({method:'GET',url:'/api/state',headers:headers2})).statusCode,401);
 }finally{if(app)await app.close();rmSync(dir,{recursive:true,force:true});}
});
// Lee una entrada del ZIP de OOXML sin dependencias: localiza el directorio central
// (PK\x01\x02), toma el método y el tamaño comprimido, y descomprime con zlib.
const zipEntry=(buffer:Buffer,target:string):string=>{
 for(let i=0;i<=buffer.length-46;i++){
  if(buffer[i]!==0x50||buffer[i+1]!==0x4b||buffer[i+2]!==0x01||buffer[i+3]!==0x02)continue;
  const nameLength=buffer.readUInt16LE(i+28);
  const name=buffer.subarray(i+46,i+46+nameLength).toString('utf8');
  if(name!==target)continue;
  const method=buffer.readUInt16LE(i+10),compressedSize=buffer.readUInt32LE(i+20),offset=buffer.readUInt32LE(i+42);
  const start=offset+30+buffer.readUInt16LE(offset+26)+buffer.readUInt16LE(offset+28);
  const data=buffer.subarray(start,start+compressedSize);
  return method===8?inflateRawSync(data).toString('utf8'):data.toString('utf8');
 }
 throw new Error('No se encontró la entrada '+target+' en el libro exportado.');
};
test('API: exporta el libro Excel del caso y exige sesión',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tacnared-xlsx-'));
 let app:any;
 try {
  app=await createApp({dataDir:dir,password:'clave-prueba',serveStatic:false});
  assert.equal((await app.inject({method:'POST',url:'/api/export/xlsx',payload:{state:{},project_id:'TACNARED-01'}})).statusCode,401);
  const login=await app.inject({method:'POST',url:'/api/login',payload:{password:'clave-prueba'}});
  const headers={cookie:login.headers['set-cookie'].split(';')[0]};
  const state=(await app.inject({method:'GET',url:'/api/state',headers})).json();
  assert.equal((await app.inject({method:'POST',url:'/api/export/xlsx',headers,payload:{state:{revision:0},project_id:'TACNARED-01'}})).statusCode,400);
  const response=await app.inject({method:'POST',url:'/api/export/xlsx',headers,payload:{state,project_id:'TACNARED-01'}});
  assert.equal(response.statusCode,200);
  assert.match(String(response.headers['content-type']),/spreadsheetml\.sheet/);
  assert.match(String(response.headers['content-disposition']),/tacnared-TACNARED-01\.xlsx/);
  const buffer=response.rawPayload;
  assert.equal(buffer.subarray(0,2).toString('latin1'),'PK','el archivo debe ser un ZIP de OOXML');
  const workbook=zipEntry(buffer,'xl/workbook.xml');
  for(const sheet of ['Programación CPM','PERT','Seguimiento','EOQ','ABC','Inventario','Movimientos'])assert.ok(workbook.includes(sheet),'falta la hoja '+sheet);
  const eoq=zipEntry(buffer,'xl/worksheets/sheet4.xml');
  assert.ok(eoq.includes('3355'),'la hoja EOQ debe conservar el lote de 11 cajas');
  const cpm=zipEntry(buffer,'xl/worksheets/sheet1.xml');
  assert.ok(cpm.includes('20'),'la hoja CPM debe conservar la duración total');
 }finally{if(app)await app.close();rmSync(dir,{recursive:true,force:true});}
});
