import type {Activity, Product, Schedule, ScheduleRow, AppState} from './types.ts';
const EPS=1e-8;
export function number(value:unknown,label:string,min=0,strict=false):number {
 if(typeof value!=='number'||!Number.isFinite(value)||value>1e10||value<min||(strict&&value===min))throw new Error(label+': valor numérico inválido.');
 return value;
}
export function text(value:unknown,label:string,max=160):string {
 if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(label+': texto obligatorio (máximo '+max+' caracteres).');
 return value;
}
function id(value:unknown):string {const s=text(value,'Identificador',40);if(!/^[A-Za-z0-9_-]+$/.test(s))throw new Error('Identificador: usa letras, números, guion o guion bajo.');return s;}
function unique(items:{id:string}[],label:string){const seen=new Set<string>();for(const item of items){id(item.id);if(seen.has(item.id))throw new Error(label+': identificador repetido '+item.id+'.');seen.add(item.id);}}
export function schedule(activities:Activity[],mode:'cpm'|'pert'='cpm',releases:Record<string,number>={}):Schedule {
 if(!Array.isArray(activities)||!activities.length||activities.length>100)throw new Error('El proyecto debe tener entre 1 y 100 actividades.');
 unique(activities,'Actividades');
 const nodes=new Map(activities.map(a=>[a.id,a]));
 for(const a of activities){
  text(a.name,'Nombre de actividad');number(a.duration_cpm,'Duración de '+a.id,0,true);
  number(a.a,'Optimista de '+a.id,0,true);number(a.m,'Probable de '+a.id,0,true);number(a.b,'Pesimista de '+a.id,0,true);
  if(a.a>a.m||a.m>a.b)throw new Error(a.id+': las estimaciones deben cumplir a ≤ m ≤ b.');
  if(!Array.isArray(a.predecessors)||a.predecessors.length>100||new Set(a.predecessors).size!==a.predecessors.length)throw new Error(a.id+': predecesoras inválidas o repetidas.');
  for(const p of a.predecessors)if(!nodes.has(p)||p===a.id)throw new Error(a.id+': predecesora inexistente o igual a sí misma.');
  if(a.progress!==undefined&&number(a.progress,'Avance de '+a.id)>100)throw new Error('El avance debe estar entre 0 y 100.');
  if(a.actual_duration!==undefined)number(a.actual_duration,'Duración estimada de '+a.id,0,true);
  if(a.actual_start!==undefined)number(a.actual_start,'Inicio real de '+a.id);
  if(a.actual_finish!==undefined){
   number(a.actual_finish,'Fin real de '+a.id);
   if(a.actual_start===undefined||a.actual_finish<=a.actual_start)throw new Error(a.id+': el fin real requiere un inicio real anterior.');
   if(a.progress!==100)throw new Error(a.id+': el fin real requiere avance de 100 %.');
  }
  if(a.actual_start!==undefined)for(const p of a.predecessors){
   const finish=nodes.get(p)!.actual_finish;
   if(finish!==undefined&&a.actual_start+EPS<finish)throw new Error(a.id+': el inicio real es anterior al fin de su predecesora '+p+'.');
  }
 }
 for(const key of Object.keys(releases)){if(!nodes.has(key))throw new Error('Actividad de disponibilidad inexistente.');number(releases[key],'Día disponible');}
 const order:Activity[]=[];const marks=new Map<string,number>();
 const visit=(a:Activity)=>{if(marks.get(a.id)===1)throw new Error('Las precedencias contienen un ciclo.');if(marks.get(a.id)===2)return;marks.set(a.id,1);for(const p of a.predecessors)visit(nodes.get(p)!);marks.set(a.id,2);order.push(a);};
 activities.forEach(visit);
 const rows:ScheduleRow[]=[];const lookup=new Map<string,ScheduleRow>();
 for(const a of order){
  const duration=mode==='pert'?(a.a+4*a.m+a.b)/6:a.duration_cpm;
  const es=Math.max(releases[a.id]??0,0,...a.predecessors.map(p=>lookup.get(p)!.ef));
  const row={...a,duration,es,ef:es+duration,ls:0,lf:0,slack:0,critical:false,variance:mode==='pert'?((a.b-a.a)/6)**2:0,level:a.predecessors.length?1+Math.max(...a.predecessors.map(p=>lookup.get(p)!.level)):0};
  rows.push(row);lookup.set(a.id,row);
 }
 const duration=Math.max(...rows.map(r=>r.ef));
 for(const r of [...rows].reverse()){
  const children=rows.filter(c=>c.predecessors.includes(r.id));
  r.lf=children.length?Math.min(...children.map(c=>c.ls)):duration;
  r.ls=r.lf-r.duration;r.slack=Math.abs(r.ls-r.es)<EPS?0:r.ls-r.es;r.critical=Math.abs(r.slack)<EPS;
 }
 const paths:string[][]=[];let pathsTruncated=false;
 const walk=(r:ScheduleRow,path:string[])=>{
  if(paths.length>=20){pathsTruncated=true;return;}
  const chain=[...path,r.id];
  const children=rows.filter(c=>c.critical&&c.predecessors.includes(r.id)&&Math.abs(c.es-r.ef)<EPS);
  if(!children.length){if(Math.abs(r.ef-duration)<EPS)paths.push(chain);return;}
  children.forEach(c=>walk(c,chain));
 };
 rows.filter(r=>r.critical&&!r.predecessors.some(p=>lookup.get(p)!.critical&&Math.abs(lookup.get(p)!.ef-r.es)<EPS)).forEach(r=>walk(r,[]));
 return {duration,rows,paths,pathsTruncated};
}
export function normalCDF(z:number):number {
 const sign=z<0?-1:1;const x=Math.abs(z)/Math.sqrt(2);const t=1/(1+.3275911*x);
 const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);
 return Math.min(1,Math.max(0,.5*(1+sign*erf)));
}
export function pert(activities:Activity[],deadline:number,pathIndex=0) {
 number(deadline,'Plazo');const result=schedule(activities,'pert');const path=result.paths[pathIndex]??result.paths[0];
 const variance=path.reduce((sum,id)=>sum+result.rows.find(r=>r.id===id)!.variance,0);
 const sigma=Math.sqrt(variance);const z=sigma?(deadline-result.duration)/sigma:null;
 const probability=sigma?normalCDF(z!):(deadline+EPS>=result.duration?1:0);
 return {...result,path,variance,sigma,z,probability,deadline};
}
export function inventoryCost(p:Product,q:number){
 number(q,'Cantidad de pedido',0,true);
 const ordering=p.annual_demand/q*p.order_cost;
 const holding=(q/2+p.safety_stock)*p.holding_cost;
 return {ordering,holding,relevant:ordering+holding,purchase:p.annual_demand*p.unit_cost,total:ordering+holding+p.annual_demand*p.unit_cost};
}
export function eoq(p:Product,days=300) {
 validateProduct(p);number(days,'Días operativos',0,true);
 if(!p.eoq_eligible)throw new Error('Este producto se abastece según proyecto; EOQ no corresponde a su política.');
 const ideal=Math.sqrt(2*p.annual_demand*p.order_cost/p.holding_cost);
 const max=p.capacity===null?Infinity:Math.floor((p.capacity-p.safety_stock)/p.order_multiple);
 if(max<1)throw new Error('La capacidad no permite un lote completo más el stock de seguridad.');
 const candidates=[Math.floor(ideal/p.order_multiple),Math.ceil(ideal/p.order_multiple)].map(q=>Math.min(max,Math.max(1,q)));
 const quantities=[...new Set(candidates)].map(q=>q*p.order_multiple);
 const quantity=quantities.sort((a,b)=>inventoryCost(p,a).relevant-inventoryCost(p,b).relevant)[0];
 const costs=inventoryCost(p,quantity);const daily=p.annual_demand/days;const rop=Math.ceil(daily*p.lead_time_days+p.safety_stock-1e-9);
 const baseline=p.baseline_order_quantity?inventoryCost(p,p.baseline_order_quantity):null;
 return {ideal,quantity,packages:quantity/p.order_multiple,rop,daily,...costs,baseline,saving:baseline?baseline.relevant-costs.relevant:null,cycle:quantity/daily,orders:p.annual_demand/quantity,capacityLimited:quantity<ideal&&max<Math.ceil(ideal/p.order_multiple)};
}
export function abc(products:Product[]) {
 if(!Array.isArray(products)||products.length>200)throw new Error('Máximo 200 productos.');
 products.forEach(p=>{number(p.annual_demand,'Demanda anual');number(p.unit_cost,'Costo unitario');});
 const sorted=[...products].sort((a,b)=>b.annual_demand*b.unit_cost-a.annual_demand*a.unit_cost||a.id.localeCompare(b.id));
 const total=sorted.reduce((sum,p)=>sum+p.annual_demand*p.unit_cost,0);let cumulative=0;
 const rows=sorted.map(p=>{const before=total?cumulative/total:1;const value=p.annual_demand*p.unit_cost;cumulative+=value;return {...p,value,share:total?value/total:0,cumulative:total?cumulative/total:0,category:(before<.8-EPS?'A':before<.95-EPS?'B':'C') as 'A'|'B'|'C'};});
 return {total,rows};
}
export function validateProduct(p:Product){
 id(p.id);text(p.name,'Producto');text(p.unit,'Unidad',30);text(p.supplier_id,'Proveedor',40);text(p.supply_policy,'Política',100);
 for(const key of ['annual_demand','unit_cost','order_cost','holding_cost','order_multiple'] as const)number(p[key],key,0,true);
 for(const key of ['holding_rate','lead_time_days','safety_stock','stock'] as const)number(p[key],key);
 if(p.holding_rate<=0||p.holding_rate>1)throw new Error('Tasa de mantenimiento: valor entre 0 y 1.');
 if(Math.abs(p.holding_cost-p.unit_cost*p.holding_rate)>1e-6)throw new Error('H debe ser costo unitario × tasa de mantenimiento.');
 if(typeof p.eoq_eligible!=='boolean')throw new Error('Política EOQ inválida.');
 if(p.capacity!==null){number(p.capacity,'Capacidad',0,true);if(p.stock>p.capacity)throw new Error(p.name+': stock mayor que la capacidad.');}
 if(p.baseline_order_quantity!==null)number(p.baseline_order_quantity,'Lote anterior',0,true);
}
export function validateState(s:AppState){
 if(!s||typeof s!=='object')throw new Error('Datos inválidos.');
 number(s.revision,'Revisión');if(!Number.isSafeInteger(s.revision))throw new Error('Revisión inválida.');
 text(s.company,'Empresa');number(s.operating_days,'Días operativos',0,true);if(s.operating_days>366)throw new Error('Máximo 366 días operativos por año.');
 if(!Array.isArray(s.projects)||!s.projects.length||s.projects.length>10||!Array.isArray(s.products)||!s.products.length||s.products.length>200||!Array.isArray(s.suppliers)||!s.suppliers.length||s.suppliers.length>50||!Array.isArray(s.movements)||s.movements.length>5000)throw new Error('Cantidad de registros inválida.');
 unique(s.projects,'Proyectos');unique(s.products,'Productos');unique(s.suppliers,'Proveedores');unique(s.movements,'Movimientos');
 s.suppliers.forEach(p=>{text(p.name,'Proveedor');if(p.simulated!==true)throw new Error('Los proveedores del caso son simulados.');});
 s.products.forEach(p=>{validateProduct(p);if(!s.suppliers.some(x=>x.id===p.supplier_id))throw new Error('Proveedor inexistente: '+p.supplier_id);});
 s.projects.forEach(p=>{text(p.name,'Proyecto');schedule(p.activities);progress(p.activities,p.control_day??11);if(!Array.isArray(p.requirements)||p.requirements.length>500)throw new Error('Requisitos inválidos.');
 const seen=new Set<string>();for(const r of p.requirements){if(!p.activities.some(a=>a.id===r.activity_id)||!s.products.some(x=>x.id===r.product_id))throw new Error('Requisito: actividad o producto inexistente.');number(r.quantity,'Cantidad requerida',0,true);const key=r.activity_id+'/'+r.product_id;if(seen.has(key))throw new Error('Requisito duplicado.');seen.add(key);}});
 s.movements.forEach(m=>{if(!s.products.some(p=>p.id===m.product_id)||!['entry','exit'].includes(m.kind))throw new Error('Movimiento inválido.');number(m.quantity,'Cantidad',0,true);number(m.stock_after,'Stock');text(m.reason,'Motivo',200);if(!Number.isFinite(Date.parse(m.created_at)))throw new Error('Fecha de movimiento inválida.');});
}
export function materialPlan(project:AppState['projects'][number],products:Product[]){
 return products.map(p=>{const required=project.requirements.filter(r=>r.product_id===p.id).reduce((sum,r)=>sum+r.quantity,0);return {...p,required,missing:Math.max(0,required-p.stock),remaining:p.stock-required};}).filter(p=>p.required>0);
}
export function progress(activities:Activity[],day:number){
 number(day,'Día de control');const plan=schedule(activities);const total=activities.reduce((s,a)=>s+a.duration_cpm,0);
 for(const a of activities)if((a.actual_start??0)>day+EPS||(a.actual_finish??0)>day+EPS)throw new Error(a.id+': el registro real es posterior al día de control.');
 const planned=plan.rows.reduce((s,r)=>s+Math.min(1,Math.max(0,(day-r.es)/r.duration))*r.duration,0)/total*100;
 const actual=activities.reduce((s,a)=>s+(a.progress??0)/100*a.duration_cpm,0)/total*100;
 const observed=plan.rows.map(r=>{
  const realDuration=r.actual_finish!==undefined&&r.actual_start!==undefined?r.actual_finish-r.actual_start:null;
  return {...r,realDuration,durationDifference:realDuration===null?null:realDuration-r.duration,finishDifference:r.actual_finish===undefined?null:r.actual_finish-r.ef};
 });
 const ends=new Map<string,number>();
 for(const r of plan.rows){
  const estimate=r.actual_duration??r.duration,pct=(r.progress??0)/100;
  const predecessors=Math.max(0,...r.predecessors.map(id=>ends.get(id)!));
  let end:number;
  if(r.actual_finish!==undefined)end=r.actual_finish;
  else if(pct===1)end=Math.min(day,(r.actual_start??predecessors)+estimate);
  else if(r.actual_start!==undefined)end=Math.max(r.actual_start+estimate,day+estimate*(1-pct));
  else if(pct===0)end=Math.max(day,predecessors)+estimate;
  else end=Math.max(predecessors+estimate,day+estimate*(1-pct));
  ends.set(r.id,end);
 }
 const forecast={duration:Math.max(...ends.values())};
 const recorded=observed.filter(r=>r.realDuration!==null).length;
 const realFinish=recorded===activities.length?Math.max(...activities.map(a=>a.actual_finish!)):null;
 const realDuration=realFinish===null?null:realFinish-Math.min(...activities.map(a=>a.actual_start!));
 return {planned,actual,delay:planned-actual,forecast,observed,recorded,realDuration,realFinish,completed:activities.filter(a=>a.progress===100).length,
  late:plan.rows.filter(r=>(r.progress??0)<100&&r.ef<=day),finishedLate:observed.filter(r=>r.finishDifference!==null&&r.finishDifference>EPS)};
}
