import {it,expect} from 'vitest'
import {sweepPath} from '../cad/sweep-path'
it('orders reversed connected path edges and excludes construction',()=>{const result=sweepPath([{id:'a',type:'line',start:[0,0],end:[0,10]},{id:'b',type:'line',start:[0,20],end:[0,10]},{id:'helper',type:'circle',center:[0,0],radius:5,construction:true}]);expect(result.map(s=>s.reversed)).toEqual([false,true])})
it('rejects a sharp corner before asking the kernel for a sweep',()=>{expect(()=>sweepPath([{id:'a',type:'line',start:[0,0],end:[0,10]},{id:'b',type:'line',start:[0,10],end:[10,10]}])).toThrow(/sharp corner/i)})
it('rejects a branch or a disconnected extra loop',()=>{expect(()=>sweepPath([{id:'a',type:'line',start:[0,0],end:[0,10]},{id:'b',type:'line',start:[0,10],end:[10,10]},{id:'c',type:'line',start:[0,10],end:[-10,10]}])).toThrow(/branches/i);expect(()=>sweepPath([{id:'a',type:'line',start:[0,0],end:[0,10]},{id:'b',type:'circle',center:[30,30],radius:5}])).toThrow(/open/i)})
