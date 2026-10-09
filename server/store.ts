import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {schedule,validateState} from '../domain/engine.ts';
import type {AppState} from '../domain/types.ts';
export function seed(revision=0):AppState {
 const c=JSON.parse(readFileSync(new URL('../data/caso.json',import.meta.url),'utf8'));
 const plan=schedule(c.activities);
 const state:AppState={revision,company:c.company,operating_days:c.inventory_operating_days,
  projects:[{id:c.case_id,name:c.project,control_day:11,activities:plan.rows.map(r=>({id:r.id,name:r.name,predecessors:r.predecessors,duration_cpm:r.duration_cpm,a:r.a,m:r.m,b:r.b,progress:Math.min(100,Math.max(0,(11-r.es)/r.duration*100)),actual_duration:r.duration_cpm,...(r.ef<=11?{actual_start:r.es,actual_finish:r.ef}:r.es<11?{actual_start:r.es}:{})})),requirements:c.material_requirements}],
  products:c.products,suppliers:c.suppliers,movements:[]};
 validateState(state);return state;
}
export function createStore(dataDir:string){
 mkdirSync(dataDir,{recursive:true});
 const db=new DatabaseSync(resolve(dataDir,'tacnared.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS application_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT NOT NULL);');
 const get=db.prepare('SELECT revision,payload FROM application_state WHERE id=1');
 if(!get.get()){const s=seed();db.prepare('INSERT INTO application_state(id,revision,payload) VALUES(1,?,?)').run(s.revision,JSON.stringify(s));}
 const read=():AppState=>JSON.parse(get.get()!.payload as string);
 validateState(read());
 return {read,write(input:AppState){
  validateState(input);
  const next={...input,revision:input.revision+1};
  const result=db.prepare('UPDATE application_state SET revision=?,payload=? WHERE id=1 AND revision=?').run(next.revision,JSON.stringify(next),input.revision);
  if(result.changes!==1)throw Object.assign(new Error('Los datos cambiaron en otra ventana. Recarga antes de guardar.'),{statusCode:409});
  return next;
 },close(){db.close();}};
}
