import writeXlsxFile from 'write-excel-file/node';
import {abc,eoq,materialPlan,pert,progress,schedule} from '../domain/engine.ts';
import type {AppState,Project} from '../domain/types.ts';
// Libro Excel del caso: una hoja por módulo del sistema. Se genera en el servidor
// a partir del estado visible en pantalla (incluye el borrador sin guardar).
type Cell=string|number|{value:string|number;fontWeight?:'bold';backgroundColor?:string;fontSize?:number;format?:string};
const head=(cells:string[]):Cell[]=>cells.map(value=>({value,fontWeight:'bold' as const,backgroundColor:'#EAF0F6'}));
const bold=(value:string):Cell[]=>[{value,fontWeight:'bold' as const}];
const widths=(...values:number[])=>values.map(width=>({width}));
export async function buildWorkbook(state:AppState,project:Project):Promise<Buffer> {
 const cpm=schedule(project.activities);
 const day=project.control_day??11;
 const control=progress(project.activities,day);
 const estimate=pert(project.activities,cpm.duration);
 const classification=abc(state.products);
 const inventory=materialPlan(project,state.products);
 const orders=state.products.filter(p=>p.eoq_eligible).map(product=>{try{return {product,result:eoq(product,state.operating_days),error:''};}catch(error){return {product,result:null,error:(error as Error).message};}});
 const sheets=[{
  sheet:'Programación CPM',
  columns:widths(10,34,16,14,9,9,9,9,10,12),
  data:[
   bold('Programación CPM · '+project.name),
   [{value:'Generado con TacnaRed · '+new Date().toLocaleString('es-PE')} as Cell],
   [],
   head(['ID','Actividad','Predecesoras','Duración','ES','EF','LS','LF','Holgura','¿Crítica?']),
   ...cpm.rows.map(r=>[r.id,r.name,r.predecessors.join(', ')||'—',r.duration,r.es,r.ef,r.ls,r.lf,r.slack,r.critical?'Sí':'No'] as Cell[]),
   [],
   bold('Duración total: '+cpm.duration+' días laborables'),
   bold('Ruta crítica: '+cpm.paths[0].join(' → ')),
   [{value:'Rutas críticas detectadas: '+cpm.paths.length+(cpm.pathsTruncated?' (lista truncada a 20)':'')} as Cell]
  ]
 },{
  sheet:'PERT',
  columns:widths(10,34,9,9,9,10,12),
  data:[
   bold('Estimación PERT con tres valores · '+project.name),
   head(['ID','Actividad','a','m','b','tₑ','Varianza (días²)']),
   ...estimate.rows.map(r=>[r.id,r.name,r.a,r.m,r.b,Number(r.duration.toFixed(4)),Number(r.variance.toFixed(4))] as Cell[]),
   [],
   bold('Ruta evaluada: '+estimate.path.join(' → ')),
   bold('Duración esperada: '+estimate.duration.toFixed(2)+' días'),
   bold('Varianza de la ruta: '+estimate.variance.toFixed(4)+' días²'),
   bold('Desviación estándar σ: '+estimate.sigma.toFixed(4)+' días'),
   bold('Probabilidad de cumplir el plazo CPM de '+cpm.duration+' días: '+(estimate.probability*100).toFixed(2)+' %'),
   [{value:'La probabilidad usa la aproximación normal sobre la ruta crítica seleccionada y supone duraciones independientes.'} as Cell]
  ]
 },{
  sheet:'Seguimiento',
  columns:widths(10,34,12,12,13,11,11,11,12,12,12,20),
  data:[
   bold('Control de avance al día t = '+day),
   [{value:'Avance planificado: '+control.planned.toFixed(2)+' % · Avance registrado: '+control.actual.toFixed(2)+' % · Brecha: '+control.delay.toFixed(2)+' puntos'} as Cell],
   [{value:'Fin estimado t = '+control.forecast.duration.toFixed(2)+' · Actividades terminadas: '+control.completed+'/'+control.observed.length+' · Actividades vencidas: '+(control.late.map(r=>r.id).join(', ')||'ninguna')} as Cell],
   [],
   head(['ID','Actividad','Inicio plan','Fin plan','Duración plan','Avance %','Inicio real','Fin real','Duración real','Δ duración','Δ fin','Registro']),
   ...control.observed.map(r=>[r.id,r.name,r.es,r.ef,r.duration,r.progress??0,r.actual_start??'',r.actual_finish??'',r.realDuration??'',r.durationDifference??'',r.finishDifference??'',r.realDuration!==null?'Terminada':r.actual_start!==undefined?'En curso':r.progress===100?'Terminada sin tiempos':'Sin inicio registrado'] as Cell[])
  ]
 },{
  sheet:'EOQ',
  columns:widths(10,32,11,14,12,12,14,12,12,10,16,16,12,14),
  data:[
   bold('Política de pedidos EOQ · '+state.operating_days+' días operativos por año'),
   head(['ID','Producto','Unidad','Demanda D','Costo S','Mantenim. H','EOQ teórico','Lote elegido','Múltiplos','ROP','Costo relevante','Ahorro anual','Pedidos/año','Intervalo (días)']),
   ...orders.map(({product,result,error}):Cell[]=>result?[product.id,product.name,product.unit,product.annual_demand,product.order_cost,product.holding_cost,Number(result.ideal.toFixed(4)),result.quantity,result.packages,result.rop,Number(result.relevant.toFixed(2)),result.saving===null?'—':Number(result.saving.toFixed(2)),Number(result.orders.toFixed(3)),Number(result.cycle.toFixed(2))]:[product.id,product.name,'—','—','—','—','—','—','—','—','—','—','—','—'])
  ]
 },{
  sheet:'ABC',
  columns:widths(10,34,14,14,16,14,14,8,40),
  data:[
   bold('Clasificación ABC por consumo anual valorizado'),
   head(['ID','Producto','Demanda anual','Costo unitario','Valor anual','Participación','Acumulado','Clase','Control recomendado']),
   ...classification.rows.map(r=>[r.id,r.name,r.annual_demand,r.unit_cost,Number(r.value.toFixed(2)),{value:r.share,format:'0.00%'} as Cell,{value:r.cumulative,format:'0.00%'} as Cell,r.category,r.category==='A'?'Seguimiento frecuente y conteo prioritario':r.category==='B'?'Revisión regular':'Control simple y periódico'] as Cell[]),
   [],
   bold('Valor total del consumo anual: S/ '+classification.total.toFixed(2))
  ]
 },{
  sheet:'Inventario',
  columns:widths(10,34,11,11,12,12,22,8,12,12,12),
  data:[
   bold('Catálogo y disponibilidad para el proyecto'),
   head(['ID','Producto','Unidad','Stock','Requerido','Faltante','Política','Clase','ROP','Plazo entrega','Stock seguridad']),
   ...state.products.map(p=>{
    const requirement=inventory.find(r=>r.id===p.id);
    let rop:string|number='—';
    try{if(p.eoq_eligible)rop=eoq(p,state.operating_days).rop;}catch{rop='No factible';}
    return [p.id,p.name,p.unit,p.stock,requirement?.required??0,requirement?.missing??0,p.supply_policy,classification.rows.find(r=>r.id===p.id)?.category??'—',rop,p.lead_time_days,p.safety_stock] as Cell[];
   })
  ]
 },{
  sheet:'Movimientos',
  columns:widths(22,34,10,12,14,40),
  data:[
   bold('Historial de entradas y salidas'),
   head(['Fecha','Producto','Tipo','Cantidad','Stock posterior','Motivo']),
   ...[...state.movements].reverse().map(m=>[new Date(m.created_at).toLocaleString('es-PE'),state.products.find(p=>p.id===m.product_id)?.name??m.product_id,m.kind==='entry'?'Entrada':'Salida',m.quantity,m.stock_after,m.reason] as Cell[]),
   ...(state.movements.length?[]:[[{value:'Sin movimientos registrados.'} as Cell]])
  ]
 }];
 return await writeXlsxFile(sheets as Parameters<typeof writeXlsxFile>[0]).toBuffer() as Buffer;
}
