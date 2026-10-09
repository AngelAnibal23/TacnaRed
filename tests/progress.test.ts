import {test} from 'node:test';
import assert from 'node:assert/strict';
import {progress,schedule,validateState} from '../domain/engine.ts';
import {seed} from '../server/store.ts';
const item=(id:string,pred:string[],duration:number,extra:Record<string,unknown>={})=>({id,name:id,predecessors:pred,duration_cpm:duration,a:duration,m:duration,b:duration,...extra});
test('Los tiempos reales se calculan desde registros y distinguen duración y fin del proyecto',()=>{
 const r=progress([item('A',[],2,{progress:100,actual_start:1,actual_finish:4}),item('B',['A'],3,{progress:100,actual_start:4,actual_finish:8})],8);
 assert.equal(r.observed[0].realDuration,3);assert.equal(r.observed[0].durationDifference,1);
 assert.equal(r.observed[1].finishDifference,3);
 assert.equal(r.realDuration,7);assert.equal(r.realFinish,8);assert.equal(r.completed,2);assert.equal(r.finishedLate.length,2);
 assert.equal(r.forecast.duration,8);
});
test('Una actividad pendiente no tiene una duración real inventada',()=>{
 const r=progress([item('A',[],2,{progress:100}),item('B',['A'],3,{progress:40,actual_duration:5})],3);
 assert.equal(r.observed[0].realDuration,null);assert.equal(r.observed[1].realDuration,null);
 assert.equal(r.realDuration,null);assert.equal(r.realFinish,null);assert.equal(r.recorded,0);
 assert.equal(r.forecast.duration,7);
});
test('La validación rechaza fin sin inicio, duración negativa y fin con avance incompleto',()=>{
 const bad=[
  {progress:100,actual_finish:2},
  {progress:100,actual_start:3,actual_finish:2},
  {progress:50,actual_start:0,actual_finish:2},
  {progress:100,actual_start:-1,actual_finish:2}
 ];
 for(const fields of bad)assert.throws(()=>schedule([item('A',[],2,fields)]),/real|inicio|fin|100/i);
 assert.throws(()=>schedule([item('A',[],2,{progress:100,actual_start:0,actual_finish:3}),item('B',['A'],1,{progress:20,actual_start:2})]),/predecesora/i);
});
test('El día de control persistido no admite observaciones posteriores al corte',()=>{
 const s=seed();s.projects[0].control_day=1;
 assert.throws(()=>validateState(s),/control/i);
 assert.throws(()=>progress([item('A',[],2,{progress:100,actual_start:0,actual_finish:3})],2),/control/i);
});
test('El caso restaurado identifica tiempos observados simulados y mantiene los resultados originales',()=>{
 const s=seed(),p=s.projects[0];assert.equal(p.control_day,11);
 const f=p.activities.find(a=>a.id==='F')!;assert.equal(f.actual_start,7);assert.equal(f.actual_finish,11);
 const r=progress(p.activities,11);assert.ok(Math.abs(r.planned-56)<1e-7);assert.ok(Math.abs(r.actual-56)<1e-7);assert.equal(r.forecast.duration,20);
 assert.equal(r.observed.find(a=>a.id==='F')!.realDuration,4);assert.equal(r.realDuration,null);
 f.actual_finish=undefined;f.progress=66.6666666667;f.actual_duration=6;
 assert.ok(Math.abs(progress(p.activities,11).forecast.duration-22)<1e-7);
});

test('El pronóstico conserva finales observados cuando falta la fecha de una predecesora',()=>{
 const r=progress([item('A',[],5,{progress:100}),item('B',['A'],1,{progress:100,actual_start:2,actual_finish:3}),item('C',['B'],1,{progress:0})],3);
 assert.equal(r.observed[1].realDuration,1);assert.equal(r.forecast.duration,4);
});
test('Omitir el día de control no permite guardar registros posteriores al corte por defecto',()=>{
 const s=seed();delete s.projects[0].control_day;
 const l=s.projects[0].activities.find(a=>a.id==='L')!;l.progress=100;l.actual_start=19;l.actual_finish=20;
 assert.throws(()=>validateState(s),/control/i);
});
