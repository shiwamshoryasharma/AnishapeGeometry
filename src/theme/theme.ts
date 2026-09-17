import {useSyncExternalStore} from 'react'
export type Theme='light'|'dark'
const event='anishape-theme-change'
export function getTheme():Theme{return document.documentElement.dataset.theme==='dark'?'dark':'light'}
export function setTheme(theme:Theme){document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;try{localStorage.setItem('anishape-theme',theme)}catch{/* Session choice still works when storage is unavailable. */}window.dispatchEvent(new Event(event))}
export function initializeTheme(){let theme:Theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';try{const saved=localStorage.getItem('anishape-theme');if(saved==='light'||saved==='dark')theme=saved}catch{/* Use system preference. */}document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}
const subscribe=(listener:()=>void)=>{window.addEventListener(event,listener);return()=>window.removeEventListener(event,listener)}
export const useTheme=()=>useSyncExternalStore(subscribe,getTheme,()=> 'light' as Theme)
