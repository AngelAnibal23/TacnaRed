import type {AppState,Project,Schedule} from '../domain/types.ts';
import {projectAlerts} from '../domain/alerts.ts';
import {Badge,Panel} from './components.tsx';
export function Alerts({state,project,cpm,onNavigate}:{state:AppState;project:Project;cpm:Schedule;onNavigate:(key:string)=>void}){
 const {alerts,critical,warnings}=projectAlerts(state,project,cpm);
 const day=project.control_day??11;
 return <Panel title="Alertas del proyecto" sub={'Detección automática al día de control t = '+day+'. Revisa qué decisión conviene tomar.'} action={<Badge tone={alerts.length?(critical?'danger':'neutral'):'teal'}>{alerts.length?(critical?critical+' críticas':'0 críticas')+(warnings?' · '+warnings+' avisos':''):'Sin alertas'}</Badge>}>
 {alerts.length?<ul className="alert-list">{alerts.map(a=><li key={a.id} className={'alert-row '+a.level}><span className="alert-dot" aria-hidden="true"/><div className="alert-body"><strong>{a.title}</strong><p>{a.detail}</p></div><button className="button text" onClick={()=>onNavigate(a.view)}>{a.action} →</button></li>)}</ul>:<p className="panel-copy">Sin desviaciones detectadas: no hay actividades vencidas, el avance acompaña al plan, la proyección respeta el plazo y el stock cubre los requisitos del proyecto.</p>}
 </Panel>;
}
