import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { schedule, pert, eoq, abc, progress } from '../domain/engine.ts';
import { activitiesFromCsv, parseCsv, productsFromCsv } from '../domain/csv.ts';
import { projectAlerts } from '../domain/alerts.ts';
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

test('La lectura de CSV reconoce separadores, comillas y encabezados con acentos',()=>{
 const semicolon=parseCsv('\uFEFFID;Nombre;Duración\r\nA;"Inicio, revisión";2\r\n');
 assert.deepEqual(semicolon.header,['id','nombre','duracion']);
 assert.deepEqual(semicolon.rows,[['A','Inicio, revisión','2']]);
 const comma=parseCsv('ID,Nombre,Duración\n"A","Con ""comillas""",3\n');
 assert.deepEqual(comma.header,['id','nombre','duracion']);
 assert.deepEqual(comma.rows,[['A','Con "comillas"','3']]);
 assert.deepEqual(parseCsv('').header,[]);
});

test('La importación de actividades valida duraciones, estimaciones y predecesoras',()=>{
 const ok=activitiesFromCsv(parseCsv('ID;Nombre;Predecesoras;Duracion;a;m;b\r\nA;Inicio;;2;1;2;3\r\nB;Segunda;A;3;2;3;4\r\n'));
 assert.equal(ok.issues.length,0);
 assert.deepEqual(ok.items[0],{id:'A',name:'Inicio',predecessors:[],duration_cpm:2,a:1,m:2,b:3,actual_duration:2});
 assert.deepEqual(ok.items[1].predecessors,['A']);
 const bad=activitiesFromCsv(parseCsv('ID;Nombre;Duracion;a;m;b;Predecesoras\r\nB;Inversa;3;4;3;5;Z\r\n'));
 assert.ok(bad.issues.some(x=>/a ≤ m ≤ b/.test(x.message)),'debe rechazar a > m');
 assert.ok(bad.issues.some(x=>/inexistente/.test(x.message)),'debe rechazar predecesoras inexistentes');
 const incomplete=activitiesFromCsv(parseCsv('ID;Nombre\r\nA;Inicio\r\n'));
 assert.ok(incomplete.issues.some(x=>/Falta la columna/.test(x.message)),'debe exigir la duración');
});

test('La importación de productos calcula H y exige proveedores existentes',()=>{
 const suppliers=[{id:'PROV01',name:'Proveedor Uno',simulated:true}];
 const table=parseCsv('ID;Nombre;Unidad;Proveedor;Demanda anual;Costo unitario;Costo pedido;Tasa mantenimiento;Plazo entrega;Multiplo;Politica\r\nMAT01;Cable;metros;PROV01;36000;2,4;75;0,2;5;305;EOQ\r\nMAT02;Switch;unidad;PROV99;40;850;50;0,2;4;1;Proyecto\r\n');
 const r=productsFromCsv(table,{suppliers,firstSupplierId:'PROV01'});
 close(r.items[0].holding_cost,0.48);
 assert.equal(r.items[0].eoq_eligible,true);
 assert.equal(r.items[1].eoq_eligible,false);
 assert.equal(r.items[1].supplier_id,'PROV01');
 assert.ok(r.issues.some(x=>/Proveedor inexistente/.test(x.message)));
 assert.equal(r.items[0].supply_policy,'Revisión continua con EOQ');
});

test('La importación admite el CSV que exporta la propia aplicación',()=>{
 const r=activitiesFromCsv(parseCsv('ID;Actividad;Duración;ES;EF;LS;LF;Holgura;Crítica\r\nA;Levantamiento;2;0;2;0;2;0;Sí\r\n'));
 assert.equal(r.issues.length,0);
 assert.equal(r.items[0].name,'Levantamiento');
 assert.equal(r.items[0].duration_cpm,2);
 assert.deepEqual(r.items[0].predecessors,[]);
});

test('Las alertas traducen retrasos, proyección y faltantes en avisos accionables',()=>{
 const build=(delayed:boolean)=>{
  const plan=schedule(c.activities);
  const activities=c.activities.map((a:any)=>{
   const row=plan.rows.find((x:any)=>x.id===a.id)!;
   if(delayed&&a.id==='C')return {...a,actual_start:4,actual_finish:6,progress:100,actual_duration:2};
   if(delayed&&a.id==='F')return {...a,actual_start:7,progress:66.6666666667,actual_duration:6,actual_finish:undefined};
   return {...a,progress:Math.min(100,Math.max(0,(11-row.es)/row.duration*100)),actual_duration:a.duration_cpm,...(row.ef<=11?{actual_start:row.es,actual_finish:row.ef}:row.es<11?{actual_start:row.es}:{})};
  });
  return {revision:0,company:c.company,operating_days:c.inventory_operating_days,projects:[{id:c.case_id,name:c.project,control_day:11,activities,requirements:c.material_requirements}],products:c.products,suppliers:c.suppliers,movements:[]} as any;
 };
 const clean=build(false);
 const cleanSummary=projectAlerts(clean,clean.projects[0],schedule(clean.projects[0].activities));
 assert.ok(!cleanSummary.alerts.some(a=>a.level==='danger'),'el caso base no debe tener alertas críticas');
 assert.ok(cleanSummary.alerts.some(a=>a.id==='probability'),'debe avisar del plazo optimista de CPM');
 const delayed=build(true);
 const summary=projectAlerts(delayed,delayed.projects[0],schedule(delayed.projects[0].activities));
 assert.deepEqual(summary.alerts.map(a=>a.id),['late','finished-late','breach','slip','probability']);
 assert.equal(summary.critical,2);
 const short=structuredClone(delayed);short.products[0].stock=1200;
 const shortage=projectAlerts(short,short.projects[0],schedule(short.projects[0].activities));
 assert.ok(shortage.alerts.some(a=>a.id==='shortage'),'debe detectar el faltante concentrado');
 assert.ok(!shortage.alerts.some(a=>a.id==='rop'),'el ROP por sí solo no detecta la necesidad del proyecto');
});
