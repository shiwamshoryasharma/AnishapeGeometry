import {Moon,Sun} from 'lucide-react'
import {useTheme,setTheme} from '../theme/theme'
export function ThemeToggle(){const theme=useTheme();return <button className="icon-button theme-toggle" aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'} title={theme==='light'?'Dark mode':'Light mode'} onClick={()=>setTheme(theme==='light'?'dark':'light')}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button>}
