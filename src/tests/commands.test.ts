import { expect,it } from 'vitest'
import { shortcutCommand, unavailable, type CommandContext } from '../commands/catalog'
const empty:CommandContext={tool:null,busy:false,hasSketch:false,hasBody:false,face:false,planarFace:false,edge:false,feature:false,canUndo:false,canRedo:false}
it('uses the user-requested sketch and dimension bindings',()=>{
  expect(shortcutCommand('s')).toBe('sketch')
  expect(shortcutCommand('d')).toBe('dimension')
  expect(shortcutCommand('z',true,true)).toBe('redo')
  expect(shortcutCommand('k',true)).toBeNull()
})
it('enforces the same contextual prerequisites for every command surface',()=>{
  expect(unavailable('extrude',empty)).toMatch(/sketch/i)
  expect(unavailable('pushpull',{...empty,hasBody:true})).toMatch(/planar/i)
  expect(unavailable('pushpull',{...empty,hasBody:true,planarFace:true})).toBeNull()
  expect(unavailable('rectangle',{...empty,tool:'sketch'})).toBeNull()
  expect(unavailable('undo',{...empty,tool:'sketch',canUndo:true})).toMatch(/Finish/)
  expect(unavailable('cancel',{...empty,busy:true})).toBeNull()
})
