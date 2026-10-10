import {useMemo,useState} from 'react';
import type {Activity,AppState,Product,Project} from '../domain/types.ts';
import {validateState} from '../domain/engine.ts';
import {ACTIVITY_TEMPLATE,PRODUCT_TEMPLATE,activitiesFromCsv,parseCsv,productsFromCsv} from '../domain/csv.ts';
import {Field,Modal,download} from './components.tsx';
export type ImportMode='replace'|'merge';
export function mergeById<T extends {id:string}>(current:T[],incoming:T[]):T[]{
 const map=new Map(current.map(item=>[item.id,item]));
 for(const item of incoming)map.set(item.id,item);
 const order=current.map(item=>item.id);
 for(const item of incoming)if(!order.includes(item.id))order.push(item.id);
 return order.map(id=>map.get(id)!);
}
export function ImportForm({state,project,onClose,onApplyActivities,onApplyProducts}:{state:AppState;project:Project;onClose:()=>void;onApplyActivities:(items:Activity[],mode:ImportMode)=>void;onApplyProducts:(items:Product[],mode:ImportMode)=>void}){
 const [kind,setKind]=useState<'activities'|'products'>('activities');
 const [mode,setMode]=useState<ImportMode>('merge');
 const [text,setText]=useState('');
 const [fileError,setFileError]=useState('');
 const table=useMemo(()=>parseCsv(text),[text]);
 const parsed=useMemo(()=>{
  if(!text.trim())return null;
  const existing=project.activities.map(a=>a.id);
  return kind==='activities'?activitiesFromCsv(table,mode==='merge'?existing:[]):productsFromCsv(table,{suppliers:state.suppliers,firstSupplierId:state.suppliers[0].id});
 },[text,table,kind,mode,project.activities,state.suppliers]);
 const validation=useMemo(()=>{
  if(!parsed||parsed.issues.length||!parsed.items.length)return null;
  try{
   const next=structuredClone(state);const current=next.projects.find(p=>p.id===project.id)!;
   if(kind==='activities'){
    current.activities=mode==='replace'?(parsed.items as Activity[]):mergeById(current.activities,parsed.items as Activity[]);
    current.requirements=current.requirements.filter(r=>current.activities.some(a=>a.id===r.activity_id));
   }else{
    next.products=mode==='replace'?(parsed.items as Product[]):mergeById(next.products,parsed.items as Product[]);
   }
   validateState(next);
   return {ok:true as const,message:''};
  }catch(err){return {ok:false as const,message:(err as Error).message};}
 },[parsed,mode,kind,state,project.id]);
 const readFile=(file:File|undefined)=>{
  if(!file)return;
  setFileError('');
  const reader=new FileReader();
  reader.onload=()=>setText(String(reader.result??''));
  reader.onerror=()=>setFileError('No se pudo leer el archivo. Copia el contenido en el cuadro de texto.');
  reader.readAsText(file,'utf-8');
 };
 const apply=()=>{
  if(!parsed)return;
  if(kind==='activities')onApplyActivities(parsed.items as Activity[],mode);
  else onApplyProducts(parsed.items as Product[],mode);
  onClose();
 };
 const canApply=!!parsed&&parsed.items.length>0&&!parsed.issues.length&&!!validation?.ok;
 const preview=parsed?.items??[];
 return <Modal title="Importar datos desde CSV" onClose={onClose}>
  <div className="segmented wide"><button className={kind==='activities'?'active':''} onClick={()=>{setKind('activities');}}>Actividades del proyecto</button><button className={kind==='products'?'active':''} onClick={()=>{setKind('products');}}>Catálogo de productos</button></div>
  <p className="panel-copy">Carga un archivo con encabezados en la primera fila; también puedes pegar el texto directamente. Se aceptan comas o punto y coma como separador y la plantilla admite acentos. Los datos se aplican al borrador: usa Guardar cambios para conservarlos.</p>
  <div className="inline-form import-toolbar">
   <Field label="Archivo CSV"><input type="file" accept=".csv,text/csv" onChange={e=>readFile(e.target.files?.[0])}/></Field>
   <button className="button secondary" onClick={()=>download(kind==='activities'?'plantilla_actividades.csv':'plantilla_productos.csv',kind==='activities'?ACTIVITY_TEMPLATE:PRODUCT_TEMPLATE,'text/csv')}>Descargar plantilla</button>
  </div>
  {fileError&&<div className="notice danger" role="alert">{fileError}</div>}
  <Field label="Contenido CSV" hint="Se aceptan las columnas de la plantilla; las columnas extra se ignoran."><textarea rows={6} value={text} onChange={e=>setText(e.target.value)} placeholder={kind==='activities'?'ID;Nombre;Predecesoras;Duracion;a;m;b':'ID;Nombre;Unidad;Demanda anual;Costo unitario;Costo pedido;Tasa mantenimiento;Plazo entrega;Multiplo'}/></Field>
  <div className="segmented wide"><button className={mode==='merge'?'active':''} onClick={()=>setMode('merge')}>Agregar o actualizar por identificador</button><button className={mode==='replace'?'active':''} onClick={()=>setMode('replace')}>Reemplazar todo el contenido</button></div>
  {parsed&&<div className="import-report">
   <p className="panel-copy">{parsed.items.length?parsed.items.length+' registro(s) leído(s)':'Sin registros leídos'} {table.header.length?'· columnas detectadas: '+table.header.join(', '):''}</p>
   {parsed.issues.length>0&&<div className="notice danger" role="alert"><strong>Revisa el archivo antes de importar:</strong><ul className="import-issues">{parsed.issues.slice(0,12).map((issue,index)=><li key={index}>Fila {issue.row}: {issue.message}</li>)}{parsed.issues.length>12&&<li>… y {parsed.issues.length-12} problema(s) más.</li>}</ul></div>}
   {validation&&(validation.ok?<div className="notice">{mode==='replace'?'Se reemplazará el contenido actual.':'Se agregarán o actualizarán los registros por identificador.'} Los cálculos de CPM, PERT, EOQ y ABC serán válidos con estos datos.</div>:<div className="notice danger" role="alert">{validation.message}</div>)}
   {preview.length>0&&<div className="table-wrap import-preview"><table><thead><tr>{kind==='activities'?<><th>ID</th><th>Nombre</th><th>Predecesoras</th><th>Duración</th></>:<><th>ID</th><th>Nombre</th><th>Unidad</th><th>Demanda</th><th>Costo unitario</th><th>Política</th></>}</tr></thead><tbody>{preview.slice(0,40).map(item=>kind==='activities'?<tr key={item.id}><td><strong>{(item as Activity).id}</strong></td><td>{(item as Activity).name}</td><td>{(item as Activity).predecessors.join(', ')||'—'}</td><td>{(item as Activity).duration_cpm}</td></tr>:<tr key={item.id}><td><strong>{(item as Product).id}</strong></td><td>{(item as Product).name}</td><td>{(item as Product).unit}</td><td>{(item as Product).annual_demand}</td><td>{(item as Product).unit_cost}</td><td>{(item as Product).eoq_eligible?'EOQ':'Por proyecto'}</td></tr>)}</tbody></table>{preview.length>40&&<p className="panel-copy">Vista previa limitada a 40 filas de {preview.length}.</p>}</div>}
  </div>}
  <div className="form-actions import-actions"><small>La importación no se guarda en la base de datos hasta que confirmes Guardar cambios.</small><button className="button primary" disabled={!canApply} onClick={apply}>Importar {parsed?parsed.items.length:0} registro(s)</button></div>
 </Modal>;
}
