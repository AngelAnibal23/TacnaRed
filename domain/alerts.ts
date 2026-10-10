import type {AppState,Project,Schedule} from './types.ts';
import {eoq,materialPlan,pert,progress} from './engine.ts';
// Alertas de gestión: traducen los cálculos de CPM, PERT, avance y almacén en
// avisos accionables para el operador. Función pura para poder probarla sin navegador.
export type AlertLevel='danger'|'warning';
export interface ProjectAlert {id:string;level:AlertLevel;title:string;detail:string;view:string;action:string;}
export interface AlertSummary {alerts:ProjectAlert[];critical:number;warnings:number;}
const fmt=(value:number,digits=2)=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:digits}).format(Math.abs(value)<1e-9?0:value);
const percent=(value:number)=>fmt(value*100)+' %';
export function projectAlerts(state:AppState,project:Project,cpm:Schedule):AlertSummary {
 const day=project.control_day??11;
 const control=progress(project.activities,day);
 const inventory=materialPlan(project,state.products);
 const missing=inventory.filter(p=>p.missing>0);
 const lowStock=state.products.flatMap(p=>{
  if(!p.eoq_eligible)return [];
  try{const result=eoq(p,state.operating_days);return p.stock<=result.rop?[{product:p,rop:result.rop}]:[];}catch{return [];}
 });
 const estimate=pert(project.activities,cpm.duration);
 const slip=control.forecast.duration-cpm.duration;
 const alerts:ProjectAlert[]=[];
 if(control.late.length)alerts.push({id:'late',level:'danger',title:control.late.length+(control.late.length===1?' actividad vencida sin terminar':' actividades vencidas sin terminar'),detail:'Al corte t = '+fmt(day)+': '+control.late.map(r=>r.id).join(', ')+'. El avance registrado no cubre el plan de esas actividades.',view:'projects',action:'Ver control de avance'});
 if(control.finishedLate.length)alerts.push({id:'finished-late',level:'warning',title:control.finishedLate.length+(control.finishedLate.length===1?' actividad terminada tarde':' actividades terminadas tarde'),detail:control.finishedLate.map(r=>r.id+' (+'+fmt(r.finishDifference??0)+' días)').join(', ')+'.',view:'projects',action:'Ver tiempos reales'});
 if(control.delay>0.5)alerts.push({id:'breach',level:'warning',title:'Avance por debajo del plan en '+fmt(control.delay)+' puntos',detail:'Planificado al corte: '+fmt(control.planned)+' % frente a '+fmt(control.actual)+' % registrado.',view:'projects',action:'Revisar seguimiento'});
 if(slip>0.001)alerts.push({id:'slip',level:'danger',title:'La proyección supera el plazo planificado en '+fmt(slip)+' días',detail:'Fin estimado t = '+fmt(control.forecast.duration)+' frente al plan CPM de t = '+fmt(cpm.duration)+'.',view:'scenarios',action:'Simular el efecto'});
 if(estimate.probability<0.5)alerts.push({id:'probability',level:'warning',title:'El plazo planificado tiene probabilidad baja (PERT)',detail:'Con la ruta crítica y las estimaciones a, m y b registradas, P(terminar en '+fmt(cpm.duration)+' días o menos) = '+percent(estimate.probability)+' y σ = '+fmt(estimate.sigma)+' días. El plan determinista de CPM resulta optimista frente a la incertidumbre.',view:'methods',action:'Ver CPM y PERT'});
 if(missing.length)alerts.push({id:'shortage',level:'danger',title:missing.length+(missing.length===1?' material con faltante':' materiales con faltantes'),detail:missing.map(p=>p.name+' (faltan '+fmt(p.missing)+' '+p.unit+')').join(', ')+'.',view:'inventory',action:'Ver inventario'});
 if(lowStock.length)alerts.push({id:'rop',level:'warning',title:lowStock.length+(lowStock.length===1?' producto en o bajo el punto de pedido':' productos en o bajo el punto de pedido'),detail:lowStock.map(x=>x.product.id+' (stock '+fmt(x.product.stock)+' ≤ ROP '+fmt(x.rop)+')').join(', ')+'.',view:'inventory',action:'Revisar reposición'});
 return {alerts,critical:alerts.filter(a=>a.level==='danger').length,warnings:alerts.filter(a=>a.level==='warning').length};
}
