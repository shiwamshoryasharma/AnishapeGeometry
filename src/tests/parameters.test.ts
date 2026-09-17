import { expect,it } from 'vitest'
import { evaluateExpression, resolveParameters } from '../cad/parameters'
it('evaluates dimensioned expressions and rejects incompatible units and cycles',()=>{
 const p=resolveParameters({width:'100 mm',half:'width / 2',radius:'2 in'})
 expect(evaluateExpression('half + 1 cm',p).value).toBe(60)
 expect(evaluateExpression('sin(30 deg)',p).value).toBeCloseTo(.5)
 expect(()=>evaluateExpression('1 mm + 1 deg',p)).toThrow(/unit|dimension/i)
 expect(()=>evaluateExpression('globalThis.alert(1)',p)).toThrow()
 expect(()=>resolveParameters({a:'b',b:'a'})).toThrow(/cycle/i)
})
