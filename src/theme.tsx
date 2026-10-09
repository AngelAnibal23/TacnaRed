import {useEffect,useState} from 'react';
import {Icon} from './components.tsx';
export type Theme='light'|'dark';
const KEY='tacnared-theme';
export function readTheme():Theme {
 try{return localStorage.getItem(KEY)==='dark'?'dark':'light';}catch{return 'light';}
}
export function useTheme(){
 const [theme,setTheme]=useState<Theme>(readTheme);
 useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem(KEY,theme);}catch{}},[theme]);
 return {theme,toggleTheme:()=>setTheme(previous=>previous==='light'?'dark':'light')};
}
export function ThemeSwitch({theme,onToggle}:{theme:Theme;onToggle:()=>void}){
 const dark=theme==='dark';
 return <button type="button" className="theme-switch no-print" role="switch" aria-checked={dark} aria-label="Modo oscuro" title={dark?'Activar modo claro':'Activar modo oscuro'} onClick={onToggle}><Icon name={dark?'moon':'sun'} size={17}/><span className="theme-label">{dark?'Oscuro':'Claro'}</span><span className="theme-track" aria-hidden="true"><i/></span></button>;
}
