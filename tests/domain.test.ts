import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { schedule, pert, eoq, abc, progress } from '../domain/engine.ts';
const c = JSON.parse(readFileSync(new URL('../data/caso.json', import.meta.url),'utf8'));
const close=(a:number,b:number,t=1e-6)=>assert.ok(Math.abs(a-b)<t, a+' ≠ '+b);
test('CPM resuelve el caso y conserva las holguras',()=>{ const r=schedule(c.activities); close(r.duration,20); assert.deepEqual(r.paths[0],['A','B','D','F','G','H','I','J','L']); close(r.rows.find((x:any)=>x.id==='E')!.slack,5); });
test('PERT coincide con el cálculo independiente',()=>{const r=pert(c.activities,22);close(r.duration,64/3);close(r.variance,13/6);close(r.probability,.6746935180336234);});
test('EOQ respeta cajas completas y costos',()=>{const r=eoq(c.products[0],300);close(r.ideal,3354.1019662496847);assert.equal(r.quantity,3355);assert.equal(r.rop,900);close(r.relevant,1753.9690014903128);close(r.saving!,2962.6605067064083);});
test('ABC conserva el producto que cruza el umbral',()=>{const r=abc(c.products);assert.equal(r.total,200240);assert.deepEqual(r.rows.map((x:any)=>x.category),['A','A','A','A','B','B','B','C','C','C']);});

test('La red no depende del orden de entrada y detecta ciclos y referencias inválidas',()=>{
 close(schedule([...c.activities].reverse()).duration,20);
 const bad=structuredClone(c.activities);bad[0].predecessors=['L'];assert.throws(()=>schedule(bad),/ciclo/);
 bad[0].predecessors=['ZZ'];assert.throws(()=>schedule(bad),/inexistente/);
});
test('Dos ramas críticas y una ruta sin varianza se interpretan correctamente',()=>{
 const item=(id:string,predecessors:string[],d:number)=>({id,name:id,predecessors,duration_cpm:d,a:d,m:d,b:d});
 const acts=[item('A',[],1),item('B',['A'],2),item('C',['A'],2),item('D',['B','C'],1)];
 assert.equal(schedule(acts).paths.length,2);
 assert.equal(pert(acts,4).probability,1);assert.equal(pert(acts,3).probability,0);
});
test('Escenarios críticos, con holgura y con disponibilidad de cable',()=>{
 const change=(id:string)=>c.activities.map((a:any)=>({...a,duration_cpm:a.duration_cpm+(a.id===id?2:0)}));
 close(schedule(change('F')).duration,22);close(schedule(change('E')).duration,20);
 close(schedule(c.activities,'cpm',{F:9}).duration,22);
 const plan=schedule(c.activities);const real=c.activities.map((a:any)=>{const r=plan.rows.find(x=>x.id===a.id)!;return {...a,progress:a.id==='F'?66.6666666667:Math.min(100,Math.max(0,(11-r.es)/r.duration*100)),actual_duration:a.id==='F'?6:a.duration_cpm};});
 const control=progress(real,11);close(control.planned,56);close(control.actual,50.6666666667);close(control.forecast.duration,22);

});
test('EOQ limita la capacidad, rechaza capacidad insuficiente y no aplica a equipos',()=>{
 const limited={...c.products[0],stock:0,capacity:1000};const r=eoq(limited,300);assert.equal(r.quantity,610);
 assert.throws(()=>eoq({...limited,capacity:500},300),/capacidad/);
 assert.throws(()=>eoq(c.products[1],300),/política/);
 assert.throws(()=>eoq({...c.products[0],annual_demand:0},300),/inválido/);
});
test('ABC vacío evita una división por cero',()=>{const r=abc([]);assert.equal(r.total,0);assert.deepEqual(r.rows,[]);});
