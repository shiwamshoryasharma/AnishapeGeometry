export function Brand({compact=false}:{compact?:boolean}){
  return <span className="brand"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 36 12v16L20 37 4 28V12Z" fill="none" stroke="currentColor" strokeWidth="2.5"/><path d="m12 26 8-15 8 15M16 22h8M20 3v8M4 28l8-2m24 2-8-2" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round"/></svg>{!compact&&<span>Anishape<span className="brand-light">Geometry</span></span>}</span>
}
