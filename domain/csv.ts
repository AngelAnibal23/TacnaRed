import type {Activity,Product} from './types.ts';
// Lectura de CSV y conversión a registros del dominio. Sin dependencias externas:
// se ejecuta igual en el navegador y en las pruebas de Node.
export interface CsvTable {header:string[];rows:string[][];}
export interface ImportIssue {row:number;message:string;}
export interface ImportResult<T> {items:T[];issues:ImportIssue[];}
function countDelimiter(line:string,delimiter:string){
 let count=0,quoted=false;
 for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"')i++;else quoted=!quoted;}else if(ch===delimiter&&!quoted)count++;}
 return count;
}
export function normalizeHeader(value:string){
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
}
export function parseCsv(input:string):CsvTable {
 const text=input.replace(/^\uFEFF/,'');
 const firstLine=text.split(/\r?\n/,1)[0]??'';
 const delimiter=countDelimiter(firstLine,';')>=countDelimiter(firstLine,',')?';':',';
 const rows:string[][]=[];let field='',row:string[]=[],quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=ch;}
  else if(ch==='"')quoted=true;
  else if(ch===delimiter){row.push(field);field='';}
  else if(ch==='\n'){row.push(field);rows.push(row);row=[];field='';}
  else if(ch!=='\r')field+=ch;
 }
 if(field!==''||row.length){row.push(field);rows.push(row);}
 const clean=rows.map(r=>r.map(c=>c.trim())).filter(r=>r.some(c=>c!==''));
 if(!clean.length)return {header:[],rows:[]};
 return {header:clean[0].map(normalizeHeader),rows:clean.slice(1)};
}
function reader(header:string[],row:string[],line:number,issues:ImportIssue[]){
 const index=new Map(header.map((h,i)=>[h,i]));
 const pick=(aliases:string[],key:string,required=false):string=>{
  const found=aliases.find(a=>index.has(a));
  if(found===undefined){if(required)issues.push({row:line,message:'Falta la columna «'+key+'».'});return '';}
  return row[index.get(found)!]??'';
 };
 const number=(raw:string,key:string):number|undefined=>{
  if(raw==='')return undefined;
  const normalized=raw.includes(',')&&!raw.includes('.')?raw.replace(',','.'):raw;
  const value=Number(normalized);
  if(!Number.isFinite(value)){issues.push({row:line,message:'«'+key+'» no es un número válido: '+raw+'.'});return undefined;}
  return value;
 };
 return {pick,number};
}
const ACTIVITY_COLUMNS={id:['id','codigo','cod'],name:['nombre','actividad','descripcion'],duration:['duracion','duracion_cpm','dias','duracion_dias'],predecessors:['predecesoras','predecesores','precedencias','deps'],a:['a','optimista'],m:['m','probable','mas_probable'],b:['b','pesimista'],progress:['avance','avance_pct','progress'],actual_duration:['duracion_estimada','estimacion','duracion_total_estimada'],actual_start:['inicio_real','inicio_re'],actual_finish:['fin_real','fin_re']};
export function activitiesFromCsv(table:CsvTable,knownIds:string[]=[]):ImportResult<Activity>{
 const issues:ImportIssue[]=[];const items:Activity[]=[];
 if(!table.header.length){issues.push({row:1,message:'El CSV está vacío o no tiene encabezados.'});return {items,issues};}
 table.rows.forEach((row,index)=>{
  const line=index+2;const r=reader(table.header,row,line,issues);
  const id=r.pick(ACTIVITY_COLUMNS.id,'id',true).toUpperCase();
  const name=r.pick(ACTIVITY_COLUMNS.name,'nombre',true);
  const duration=r.number(r.pick(ACTIVITY_COLUMNS.duration,'duracion',true),'duración');
  const a=r.number(r.pick(ACTIVITY_COLUMNS.a,'a'),'a')??duration??0;
  const m=r.number(r.pick(ACTIVITY_COLUMNS.m,'m'),'m')??duration??0;
  const b=r.number(r.pick(ACTIVITY_COLUMNS.b,'b'),'b')??duration??0;
  const progress=r.number(r.pick(ACTIVITY_COLUMNS.progress,'avance'),'avance');
  const actualDuration=r.number(r.pick(ACTIVITY_COLUMNS.actual_duration,'duración estimada'),'duración estimada');
  const actualStart=r.number(r.pick(ACTIVITY_COLUMNS.actual_start,'inicio real'),'inicio real');
  const actualFinish=r.number(r.pick(ACTIVITY_COLUMNS.actual_finish,'fin real'),'fin real');
  const predecessors=r.pick(ACTIVITY_COLUMNS.predecessors,'predecesoras',false).split(/[,;\s]+/).map(x=>x.trim().toUpperCase()).filter(Boolean);
  if(!id)issues.push({row:line,message:'El identificador es obligatorio.'});
  if(!name)issues.push({row:line,message:'El nombre es obligatorio.'});
  if(duration===undefined)issues.push({row:line,message:'La duración CPM es obligatoria.'});
  if(duration!==undefined&&duration<=0)issues.push({row:line,message:'La duración debe ser mayor que cero.'});
  if(a>m||m>b)issues.push({row:line,message:'Debe cumplirse a ≤ m ≤ b.'});
  if(progress!==undefined&&(progress<0||progress>100))issues.push({row:line,message:'El avance debe estar entre 0 y 100.'});
  items.push({id,name,predecessors,duration_cpm:duration??0,a,m,b,...(progress===undefined?{}:{progress}),actual_duration:actualDuration??duration??0,...(actualStart===undefined?{}:{actual_start:actualStart}),...(actualFinish===undefined?{}:{actual_finish:actualFinish})});
 });
 const seen=new Set<string>();
 for(const item of items){
  if(seen.has(item.id))issues.push({row:1,message:'Identificador repetido en el archivo: '+item.id+'.'});
  seen.add(item.id);
  const universe=new Set([...knownIds,...items.map(x=>x.id)]);
  for(const predecessor of item.predecessors)if(!universe.has(predecessor))issues.push({row:1,message:'La actividad '+item.id+' referencia una predecesora inexistente: '+predecessor+'.'});
 }
 return {items,issues};
}
const PRODUCT_COLUMNS={id:['id','codigo','cod'],name:['nombre','producto','descripcion'],unit:['unidad','um','medida'],supplier:['proveedor','proveedor_id','supplier_id'],demand:['demanda_anual','demanda','d'],unitCost:['costo_unitario','costo_u','cu','precio'],orderCost:['costo_pedido','costo_orden','s','costo_por_pedido'],holdingRate:['tasa_mantenimiento','tasa_anual','mantenimiento','i','h_tasa'],lead:['plazo_entrega','plazo','lead_time','l'],safety:['stock_seguridad','ss'],stock:['stock','stock_inicial','inventario'],multiple:['multiplo','multiplo_pedido','multiplo_compra'],eligible:['politica','eoq','usa_eoq','aplica_eoq'],baseline:['lote_anterior','q_anterior'],capacity:['capacidad','capacidad_maxima']};
const truthy=(value:string)=>['si','sí','1','true','x','eoq','continua','s'].includes(value.trim().toLowerCase());
export function productsFromCsv(table:CsvTable,context:{suppliers:{id:string;name:string}[];firstSupplierId:string}):ImportResult<Product>{
 const issues:ImportIssue[]=[];const items:Product[]=[];
 if(!table.header.length){issues.push({row:1,message:'El CSV está vacío o no tiene encabezados.'});return {items,issues};}
 table.rows.forEach((row,index)=>{
  const line=index+2;const r=reader(table.header,row,line,issues);
  const id=r.pick(PRODUCT_COLUMNS.id,'id',true).toUpperCase();
  const name=r.pick(PRODUCT_COLUMNS.name,'nombre',true);
  const unit=r.pick(PRODUCT_COLUMNS.unit,'unidad',true)||'unidad';
  const demand=r.number(r.pick(PRODUCT_COLUMNS.demand,'demanda anual',true),'demanda anual');
  const unitCost=r.number(r.pick(PRODUCT_COLUMNS.unitCost,'costo unitario',true),'costo unitario');
  const orderCost=r.number(r.pick(PRODUCT_COLUMNS.orderCost,'costo de pedido',true),'costo de pedido');
  const holdingRate=r.number(r.pick(PRODUCT_COLUMNS.holdingRate,'tasa de mantenimiento',true),'tasa de mantenimiento');
  const lead=r.number(r.pick(PRODUCT_COLUMNS.lead,'plazo de entrega',true),'plazo de entrega');
  const safety=r.number(r.pick(PRODUCT_COLUMNS.safety,'stock de seguridad'),'stock de seguridad')??0;
  const stock=r.number(r.pick(PRODUCT_COLUMNS.stock,'stock'),'stock')??0;
  const multiple=r.number(r.pick(PRODUCT_COLUMNS.multiple,'múltiplo de compra',true),'múltiplo de compra');
  const policy=r.pick(PRODUCT_COLUMNS.eligible,'política',false);
  const eligible=policy===''?true:truthy(policy);
  const baseline=r.number(r.pick(PRODUCT_COLUMNS.baseline,'lote anterior'),'lote anterior')??null;
  const capacity=r.number(r.pick(PRODUCT_COLUMNS.capacity,'capacidad'),'capacidad')??null;
  const supplierRaw=r.pick(PRODUCT_COLUMNS.supplier,'proveedor',false).toUpperCase();
  const supplier=context.suppliers.find(s=>s.id===supplierRaw)??context.suppliers.find(s=>normalizeHeader(s.name)===normalizeHeader(supplierRaw));
  if(!id)issues.push({row:line,message:'El identificador es obligatorio.'});
  if(!name)issues.push({row:line,message:'El nombre es obligatorio.'});
  for(const [key,value] of [['demanda anual',demand],['costo unitario',unitCost],['costo de pedido',orderCost],['plazo de entrega',lead],['múltiplo de compra',multiple]] as const)if(value===undefined||value<=0)issues.push({row:line,message:'«'+key+'» debe ser mayor que cero.'});
  if(holdingRate===undefined||holdingRate<=0||holdingRate>1)issues.push({row:line,message:'La tasa de mantenimiento debe estar entre 0 y 1 (excluyendo 0).'});
  if(supplierRaw&&!supplier)issues.push({row:line,message:'Proveedor inexistente: '+supplierRaw+'. Debe existir antes de importar.'});
  items.push({id,name,unit,annual_demand:demand??0,unit_cost:unitCost??0,order_cost:orderCost??0,holding_rate:holdingRate??0,holding_cost:(unitCost??0)*(holdingRate??0),lead_time_days:lead??0,safety_stock:safety,stock,order_multiple:multiple??1,eoq_eligible:eligible,baseline_order_quantity:baseline,capacity,supplier_id:supplier?.id??context.firstSupplierId,supply_policy:eligible?'Revisión continua con EOQ':'Compra y reserva según proyecto'});
 });
 const seen=new Set<string>();
 for(const item of items){if(seen.has(item.id))issues.push({row:1,message:'Identificador repetido en el archivo: '+item.id+'.'});seen.add(item.id);}
 return {items,issues};
}
export const ACTIVITY_TEMPLATE='ID;Nombre;Predecesoras;Duracion;a;m;b\r\nA;Inicio;"";2;1;2;3\r\nB;Segunda actividad;A;3;2;3;4\r\n';
export const PRODUCT_TEMPLATE='ID;Nombre;Unidad;Proveedor;Demanda anual;Costo unitario;Costo pedido;Tasa mantenimiento;Plazo entrega;Stock seguridad;Stock;Multiplo;Politica\r\nMAT01;Cable UTP categoria 6;metros;PROV01;12000;1.2;45;0.22;7;200;1200;100;EOQ\r\n';
