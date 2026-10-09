import {useEffect,useRef,useId,cloneElement,isValidElement} from 'react';
import type {ReactNode,ReactElement} from 'react';
import type {Schedule,Product} from '../domain/types.ts';
import {inventoryCost} from '../domain/engine.ts';
export const fmt=(value:number,digits=2)=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:digits}).format(Math.abs(value)<1e-9?0:value);
export const money=(value:number)=>'S/ '+new Intl.NumberFormat('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
export const percent=(value:number)=>fmt(value*100)+' %';
export function download(name:string,content:string,type='text/plain'){
 const url=URL.createObjectURL(new Blob([content],{type:type+';charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function csv(name:string,headers:string[],rows:(string|number)[][]){
 const esc=(x:string|number)=>'"'+String(x).replace(/"/g,'""')+'"';
 download(name,'\uFEFF'+[headers,...rows].map(row=>row.map(esc).join(';')).join('\r\n'),'text/csv');
}
export function Icon({name,size=20}:{name:string;size?:number}){
 const paths:Record<string,ReactNode>={
 sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
 moon:<path d="M20.2 15.2A9 9 0 0 1 8.8 3.8a9 9 0 1 0 11.4 11.4Z"/>,
 home:<><path d="M3 10 12 3l9 7v10H3z"/><path d="M9 20v-7h6v7"/></>,
 project:<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h7M7 17h5"/></>,
 route:<><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><path d="m6 7 5 10m7-10-5 10M7 5h10"/></>,
 stock:<><path d="m3 7 9-4 9 4-9 4zM3 7v10l9 4 9-4V7M12 11v10"/></>,
 curve:<><path d="M4 3v17h17M7 6c0 10 8 11 13 12M7 17 20 5"/></>,
 abc:<><path d="M4 20V9h4v11M10 20V5h4v15M16 20V2h4v18M2 21h20"/></>,
 scenario:<><path d="M5 4v16m14-16v16M2 9h6m8 6h6"/><circle cx="5" cy="9" r="2"/><circle cx="19" cy="15" r="2"/></>,
 report:<><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7"/></>,
 save:<><path d="M4 3h14l3 3v15H3V3zM7 3v6h10V3M7 21v-8h10v8"/></>,
 logout:<><path d="M9 3H4v18h5m4-14 5 5-5 5m-4-5h12"/></>,
 plus:<path d="M12 4v16M4 12h16"/>,
 check:<path d="m4 12 5 5L20 6"/>,
 arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
 menu:<path d="M3 6h18M3 12h18M3 18h18"/>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]??paths.project}</svg>;
}
export function Badge({children,tone='neutral'}:{children:ReactNode;tone?:string}){return <span className={'badge '+tone}>{children}</span>;}
export function Panel({title,sub,action,children,className=''}:{title?:string;sub?:string;action?:ReactNode;children:ReactNode;className?:string}){
 return <section className={'panel '+className}>{title&&<div className="panel-heading"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{action}</div>}{children}</section>;
}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){
 const fieldId=useId();const control=isValidElement(children)?cloneElement(children as ReactElement<Record<string,unknown>>,{id:fieldId,'aria-describedby':hint?fieldId+'-hint':undefined}):children;return <div className="field"><label htmlFor={fieldId}>{label}</label>{control}{hint&&<small id={fieldId+'-hint'}>{hint}</small>}</div>;
}
export function Stat({label,value,sub,tone=''}:{label:string;value:ReactNode;sub?:string;tone?:string}){return <div className={'stat '+tone}><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div>;}
export function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const old=document.activeElement as HTMLElement;const previous=document.body.style.overflow;document.body.style.overflow='hidden';ref.current?.querySelector<HTMLElement>('input,select,button')?.focus();return ()=>{document.body.style.overflow=previous;old?.focus();};},[]);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title} onKeyDown={e=>{
  if(e.key==='Escape')onClose();
  if(e.key==='Tab'){const els=Array.from(ref.current!.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]')).filter(x=>!x.hasAttribute('disabled'));const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
 }}><div className="modal-title"><h2>{title}</h2><button className="icon-button" aria-label="Cerrar diálogo" onClick={onClose}>×</button></div>{children}</div></div>;
}
export function Gantt({result,actual=false}:{result:Schedule;actual?:boolean}){
 const left=165,w=870,scale=(w-left-40)/Math.max(1,result.duration);const h=result.rows.length*37+55;
 return <div className="chart-scroll"><svg className="gantt" width={w} height={h} viewBox={'0 0 '+w+' '+h} role="img" aria-label="Diagrama de Gantt: actividades críticas resaltadas y actividades con holgura diferenciadas">
 {Array.from({length:Math.min(25,Math.ceil(result.duration)+1)},(_,i)=>{const day=i*Math.max(1,Math.ceil(result.duration/24));return <g key={i}><line x1={left+day*scale} y1="26" x2={left+day*scale} y2={h-16} stroke="var(--chart-grid,#e5eaf1)"/><text x={left+day*scale} y="16" textAnchor="middle" className="chart-tick">{fmt(day,0)}</text></g>;})}
 {result.rows.map((r,i)=><g key={r.id}><text x="8" y={51+i*37} className="chart-label">{r.id+' · '+r.name.slice(0,20)}</text><rect x={left+r.es*scale} y={34+i*37} width={Math.max(2,r.duration*scale)} height="24" rx="4" fill={r.critical?'var(--chart-critical,#c5453d)':'var(--chart-flexible,#406e9e)'}/>{actual&&<rect x={left+r.es*scale} y={54+i*37} width={r.duration*scale*(r.progress??0)/100} height="4" rx="2" fill="var(--chart-text-strong,#17334d)"/>}<text x={left+r.ef*scale+5} y={51+i*37} className="chart-tick">{fmt(r.ef)}</text><title>{r.name+': inicio '+fmt(r.es)+', fin '+fmt(r.ef)+', holgura '+fmt(r.slack)}</title></g>)}
 </svg><div className="legend"><span><i className="red"/>Actividad crítica</span><span><i className="blue"/>Actividad con holgura</span>{actual&&<span><i className="navy"/>Avance registrado</span>}<span>Días laborables desde t = 0</span></div></div>;
}
export function Network({result}:{result:Schedule}){
 const groups=new Map<number,typeof result.rows>();for(const r of result.rows)groups.set(r.level,[...(groups.get(r.level)??[]),r]);
 const max=Math.max(...result.rows.map(r=>r.level));const h=Math.max(160,...[...groups.values()].map(g=>g.length*90+30));const w=(max+1)*145+35;
 const pos=new Map(result.rows.map(r=>[r.id,{x:15+r.level*145,y:20+(groups.get(r.level)!.findIndex(a=>a.id===r.id))*90}]));
 return <div className="chart-scroll network"><svg width={w} height={h} viewBox={'0 0 '+w+' '+h} role="img" aria-label="Red de precedencias de actividades"><defs><marker id="arrow-end" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6" fill="var(--chart-arrow,#6d8097)"/></marker></defs>
 {result.rows.flatMap(r=>r.predecessors.map(p=>{const a=pos.get(p)!,b=pos.get(r.id)!;const critical=r.critical&&result.rows.find(x=>x.id===p)!.critical&&Math.abs(result.rows.find(x=>x.id===p)!.ef-r.es)<1e-7;return <path key={p+r.id} d={'M'+(a.x+122)+' '+(a.y+30)+' C'+(a.x+136)+' '+(a.y+30)+','+(b.x-15)+' '+(b.y+30)+','+b.x+' '+(b.y+30)} stroke={critical?'var(--chart-critical,#c5453d)':'var(--chart-node-border,#bac6d3)'} strokeWidth={critical?2.2:1.3} fill="none" markerEnd="url(#arrow-end)"/>;}))}
 {result.rows.map(r=>{const p=pos.get(r.id)!;return <g key={r.id}><rect x={p.x} y={p.y} width="122" height="60" rx="7" fill={r.critical?'var(--chart-critical-surface,#fff1ef)':'var(--chart-node-surface,#f5f8fc)'} stroke={r.critical?'var(--chart-critical,#c5453d)':'var(--chart-node-border,#b9c9db)'}/><text x={p.x+10} y={p.y+20} fontWeight="700" fill={r.critical?'var(--chart-critical-text,#a62c26)':'var(--chart-text-strong,#17334d)'}>{r.id+' · '+fmt(r.duration)+' d'}</text><text x={p.x+10} y={p.y+38} className="chart-tick">{r.name.slice(0,17)}</text><text x={p.x+10} y={p.y+52} className="chart-tick">{fmt(r.es)+' → '+fmt(r.ef)+' · H '+fmt(r.slack)}</text><title>{r.name}</title></g>;})}
 </svg></div>;
}
export function ScheduleTable({result}:{result:Schedule}){
 return <div className="table-wrap"><table><thead><tr><th>Actividad</th><th>Duración</th><th>ES</th><th>EF</th><th>LS</th><th>LF</th><th>Holgura</th><th>Condición</th></tr></thead><tbody>{result.rows.map(r=><tr key={r.id}><td><strong>{r.id}</strong> · {r.name}</td><td>{fmt(r.duration)}</td><td>{fmt(r.es)}</td><td>{fmt(r.ef)}</td><td>{fmt(r.ls)}</td><td>{fmt(r.lf)}</td><td>{fmt(r.slack)}</td><td><Badge tone={r.critical?'danger':'neutral'}>{r.critical?'Crítica':'Flexible'}</Badge></td></tr>)}</tbody></table></div>;
}
export function CostCurve({product,quantity}:{product:Product;quantity:number}){
 const w=700,h=270,left=70,bottom=225,top=22;const qmin=Math.max(product.order_multiple,quantity*.25),qmax=quantity*2.2;
 const samples=Array.from({length:70},(_,i)=>{const q=qmin+(qmax-qmin)*i/69;return {q,...inventoryCost(product,q)};});const ymax=Math.max(...samples.map(x=>x.relevant))*1.06;
 const x=(q:number)=>left+(q-qmin)/(qmax-qmin)*(w-left-30);const y=(v:number)=>bottom-v/ymax*(bottom-top);
 const line=(key:'ordering'|'holding'|'relevant')=>samples.map((s,i)=>(i?'L':'M')+x(s.q)+' '+y(s[key])).join(' ');
 return <div className="chart-scroll"><svg width={w} height={h} viewBox={'0 0 '+w+' '+h} role="img" aria-label="Curva de costo de ordenar, mantener y costo relevante anual">{[0,.25,.5,.75,1].map(v=><g key={v}><line x1={left} y1={y(ymax*v)} x2={w-20} y2={y(ymax*v)} stroke="var(--chart-grid,#e5eaf1)"/><text x={left-10} y={y(ymax*v)+4} textAnchor="end" className="chart-tick">{fmt(ymax*v,0)}</text></g>)}<path d={line('ordering')} stroke="var(--chart-curve-order,#8499ae)" strokeWidth="2" fill="none"/><path d={line('holding')} stroke="var(--chart-curve-hold,#178471)" strokeWidth="2" fill="none"/><path d={line('relevant')} stroke="var(--chart-curve-total,#1b53a0)" strokeWidth="3" fill="none"/><line x1={x(quantity)} y1={top} x2={x(quantity)} y2={bottom} stroke="var(--chart-critical,#c5453d)" strokeDasharray="5 4"/><text x={x(quantity)} y={bottom+20} textAnchor="middle" className="chart-label">{fmt(quantity)+' '+product.unit}</text><text x={left} y="13" className="chart-tick">Costo anual (S/)</text><text x={w-30} y={h-5} textAnchor="end" className="chart-tick">Cantidad por pedido</text></svg><div className="legend"><span><i className="blue"/>Costo relevante</span><span><i className="teal"/>Mantener</span><span><i className="gray"/>Ordenar</span><span><i className="red"/>Lote factible elegido</span></div></div>;
}
export function Pareto({rows}:{rows:{id:string;value:number;cumulative:number;category:string}[]}){
 const w=Math.max(700,rows.length*55),h=280,left=70,right=w-45,bottom=235,top=20;const ymax=Math.max(1,...rows.map(r=>r.value));const step=(right-left)/Math.max(1,rows.length);
 const x=(i:number)=>left+(i+.5)*step,y=(v:number)=>bottom-v/ymax*(bottom-top);
 return <div className="chart-scroll"><svg width={w} height={h} viewBox={'0 0 '+w+' '+h} role="img" aria-label="Pareto ABC: consumo anual valorizado y porcentaje acumulado">{[0,.5,1].map(v=><g key={v}><line x1={left} x2={right} y1={y(ymax*v)} y2={y(ymax*v)} stroke="var(--chart-grid,#e5eaf1)"/><text x={left-8} y={y(ymax*v)+4} textAnchor="end" className="chart-tick">{fmt(ymax*v,0)}</text><text x={right+8} y={bottom-v*(bottom-top)+4} className="chart-tick">{fmt(v*100,0)+'%'}</text></g>)}{rows.map((r,i)=><g key={r.id}><rect x={x(i)-step*.32} y={y(r.value)} width={step*.64} height={bottom-y(r.value)} rx="3" fill={r.category==='A'?'var(--chart-abc-a,#234e7c)':r.category==='B'?'var(--chart-abc-b,#5e83a6)':'var(--chart-abc-c,#b3c6d8)'}/><text x={x(i)} y={bottom+19} textAnchor="middle" className="chart-tick">{r.id}</text><title>{r.id+' · '+r.category+' · '+money(r.value)}</title></g>)}<path d={rows.map((r,i)=>(i?'L':'M')+x(i)+' '+(bottom-r.cumulative*(bottom-top))).join(' ')} fill="none" stroke="var(--chart-critical,#c5453d)" strokeWidth="2.5"/>{[.8,.95].map(v=><line key={v} x1={left} x2={right} y1={bottom-v*(bottom-top)} y2={bottom-v*(bottom-top)} stroke="var(--chart-critical,#c5453d)" strokeOpacity=".35" strokeDasharray="4 4"/>)}</svg><div className="legend"><span><i className="navy"/>Consumo anual valorizado</span><span><i className="red"/>Porcentaje acumulado</span></div></div>;
}
