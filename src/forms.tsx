import {useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import type {Activity,Product,AppState,Requirement} from '../domain/types.ts';
import {Field,Modal} from './components.tsx';
function Form({onSubmit,children,label='Aplicar cambios'}:{onSubmit:()=>void;children:ReactNode;label?:string}){
 const [error,setError]=useState('');
 function submit(e:FormEvent){e.preventDefault();try{onSubmit();}catch(err){setError((err as Error).message);}}
 return <form onSubmit={submit}>{children}{error&&<div className="notice danger" role="alert">{error}</div>}<div className="form-actions"><small>Se aplicará al borrador. Usa Guardar cambios para conservarlo.</small><button className="button primary" type="submit">{label}</button></div></form>;
}
export function ActivityForm({initial,existing,onSubmit,onClose}:{initial:Activity;existing:boolean;onSubmit:(a:Activity)=>void;onClose:()=>void}){
 const [v,setV]=useState({...initial});const [deps,setDeps]=useState(initial.predecessors.join(', '));
 const num=(key:'duration_cpm'|'a'|'m'|'b'|'progress'|'actual_duration',label:string)=><Field label={label}><input type="number" min={key==='progress'?0:.01} max={key==='progress'?100:undefined} step="any" required value={v[key]??0} onChange={e=>setV({...v,[key]:Number(e.target.value)})}/></Field>;
 return <Modal title={existing?'Editar actividad '+initial.id:'Nueva actividad'} onClose={onClose}><Form onSubmit={()=>onSubmit({...v,predecessors:deps.split(',').map(x=>x.trim()).filter(Boolean)})}><div className="form-grid">
 <Field label="Identificador"><input required maxLength={40} disabled={existing} value={v.id} onChange={e=>setV({...v,id:e.target.value.toUpperCase()})}/></Field>
 <Field label="Nombre"><input required maxLength={160} value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></Field>
 <Field label="Predecesoras" hint="Identificadores separados por comas. Vacío para una actividad inicial."><input value={deps} onChange={e=>setDeps(e.target.value)}/></Field>
 {num('duration_cpm','Duración CPM (días)')}{num('a','PERT: optimista a')}{num('m','PERT: más probable m')}{num('b','PERT: pesimista b')}{num('progress','Avance real (%)')}{num('actual_duration','Duración total estimada actual (días)')}
 <Field label="Inicio real (día t)" hint="Opcional. Días laborables desde t = 0; vacío si no hay registro."><input type="number" min="0" step="any" value={v.actual_start??''} onChange={e=>setV({...v,actual_start:e.target.value===''?undefined:Number(e.target.value)})}/></Field>
 <Field label="Fin real (día t)" hint="Solo para actividades terminadas con avance 100 %."><input type="number" min="0" step="any" value={v.actual_finish??''} onChange={e=>setV({...v,actual_finish:e.target.value===''?undefined:Number(e.target.value)})}/></Field>
 </div><p className="muted">Duración real = fin real − inicio real. Para una actividad en curso, deja el fin vacío. La estimación total se usa para prever el trabajo restante. El caso utiliza registros simulados, días laborables y precedencias fin a inicio.</p></Form></Modal>;
}
export function ProductForm({initial,existing,suppliers,onSubmit,onClose}:{initial:Product;existing:boolean;suppliers:AppState['suppliers'];onSubmit:(p:Product)=>void;onClose:()=>void}){
 const [v,setV]=useState({...initial});
 const num=(key:keyof Product,label:string,min=0)=><Field label={label}><input type="number" min={min} step="any" required value={v[key] as number??0} onChange={e=>setV({...v,[key]:Number(e.target.value)})}/></Field>;
 return <Modal title={existing?'Editar '+initial.name:'Nuevo producto'} onClose={onClose}><Form onSubmit={()=>onSubmit({...v,holding_cost:v.unit_cost*v.holding_rate,supply_policy:v.eoq_eligible?'Revisión continua con EOQ':'Compra y reserva según proyecto'})}><div className="form-grid">
 <Field label="Identificador"><input required disabled={existing} maxLength={40} value={v.id} onChange={e=>setV({...v,id:e.target.value.toUpperCase()})}/></Field><Field label="Nombre"><input required maxLength={160} value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></Field><Field label="Unidad"><input required maxLength={30} value={v.unit} onChange={e=>setV({...v,unit:e.target.value})}/></Field><Field label="Proveedor"><select value={v.supplier_id} onChange={e=>setV({...v,supplier_id:e.target.value})}>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
 {num('annual_demand','Demanda anual D',.01)}{num('unit_cost','Costo unitario (S/)',.01)}{num('order_cost','Costo de pedido S (S/)',.01)}{num('holding_rate','Tasa anual de mantenimiento (0 a 1)',.001)}{num('lead_time_days','Plazo de entrega L (días)')}{num('safety_stock','Stock de seguridad SS')}{num('order_multiple','Múltiplo del pedido',.01)}
 {!existing&&num('stock','Stock inicial')}
 <Field label="Capacidad máxima (opcional)"><input type="number" min=".01" step="any" value={v.capacity??''} onChange={e=>setV({...v,capacity:e.target.value===''?null:Number(e.target.value)})}/></Field>
 <Field label="Lote anterior (opcional)"><input type="number" min=".01" step="any" value={v.baseline_order_quantity??''} onChange={e=>setV({...v,baseline_order_quantity:e.target.value===''?null:Number(e.target.value)})}/></Field>
 <Field label="Política"><select value={v.eoq_eligible?'eoq':'project'} onChange={e=>setV({...v,eoq_eligible:e.target.value==='eoq'})}><option value="eoq">Revisión continua con EOQ</option><option value="project">Compra según proyecto</option></select></Field>
 </div><p className="muted">H se calcula como costo unitario × tasa anual. El stock existente cambia mediante entradas y salidas.</p></Form></Modal>;
}
export function MovementForm({products,onSubmit,onClose}:{products:Product[];onSubmit:(input:{product_id:string;kind:'entry'|'exit';quantity:number;reason:string})=>Promise<void>;onClose:()=>void}){
 const [product,setProduct]=useState(products[0].id),[kind,setKind]=useState<'entry'|'exit'>('entry'),[quantity,setQuantity]=useState(1),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <Modal title="Registrar movimiento" onClose={onClose}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await onSubmit({product_id:product,kind,quantity,reason});}catch(err){setError((err as Error).message);}finally{setBusy(false);}}}><div className="form-grid">
 <Field label="Producto"><select value={product} onChange={e=>setProduct(e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name+' · stock '+p.stock+' '+p.unit}</option>)}</select></Field><Field label="Tipo"><select value={kind} onChange={e=>setKind(e.target.value as 'entry'|'exit')}><option value="entry">Entrada</option><option value="exit">Salida</option></select></Field><Field label="Cantidad"><input required type="number" min=".01" step="any" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></Field><Field label="Motivo"><input required maxLength={200} value={reason} onChange={e=>setReason(e.target.value)}/></Field></div>{error&&<div role="alert" className="notice danger">{error}</div>}<div className="form-actions"><small>Este movimiento se guarda directamente en la base de datos.</small><button disabled={busy} className="button primary" type="submit">{busy?'Registrando…':'Registrar movimiento'}</button></div></form></Modal>;
}
export function RequirementForm({initial,activities,products,onSubmit,onClose}:{initial:Requirement;activities:Activity[];products:Product[];onSubmit:(r:Requirement)=>void;onClose:()=>void}){
 const [v,setV]=useState(initial);
 return <Modal title="Material para una actividad" onClose={onClose}><Form onSubmit={()=>onSubmit(v)}><div className="form-grid"><Field label="Actividad"><select value={v.activity_id} onChange={e=>setV({...v,activity_id:e.target.value})}>{activities.map(a=><option key={a.id} value={a.id}>{a.id+' · '+a.name}</option>)}</select></Field><Field label="Producto"><select value={v.product_id} onChange={e=>setV({...v,product_id:e.target.value})}>{products.map(p=><option key={p.id} value={p.id}>{p.name+' ('+p.unit+')'}</option>)}</select></Field><Field label="Cantidad necesaria"><input required type="number" min=".01" step="any" value={v.quantity} onChange={e=>setV({...v,quantity:Number(e.target.value)})}/></Field></div></Form></Modal>;
}
export function SimpleForm({title,fields,onSubmit,onClose}:{title:string;fields:{key:string;label:string;value:string;disabled?:boolean}[];onSubmit:(values:Record<string,string>)=>void;onClose:()=>void}){
 const [values,setValues]=useState(Object.fromEntries(fields.map(f=>[f.key,f.value])));
 return <Modal title={title} onClose={onClose}><Form onSubmit={()=>onSubmit(values)}><div className="form-grid">{fields.map(f=><Field key={f.key} label={f.label}><input required maxLength={f.key==='id'?40:160} disabled={f.disabled} value={values[f.key]} onChange={e=>setValues({...values,[f.key]:e.target.value})}/></Field>)}</div></Form></Modal>;
}
