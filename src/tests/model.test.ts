import { describe, expect, it } from 'vitest'
import { UnitService } from '../cad/units'
import { createDocument, applyCommand, parseProject, serializeProject, createHistory, commitHistory, undoHistory, redoHistory } from '../cad/document'

describe('engineering units', () => {
  it('converts units without rounding authoritative values', () => {
    expect(UnitService.toInternal(1, 'in')).toBe(25.4)
    expect(UnitService.parse('2.5 cm', 'mm')).toBe(25)
    expect(UnitService.fromInternal(25.4, 'in')).toBe(1)
    const value = 25.123456789012
    expect(UnitService.format(value, 'mm', 3)).toBe('25.123 mm')
    expect(UnitService.parse(String(value), 'mm')).toBe(value)
  })
  it('rejects non-finite and executable input', () => {
    expect(() => UnitService.parse('Infinity', 'mm')).toThrow()
    expect(() => UnitService.parse('alert(1)', 'mm')).toThrow()
    expect(() => UnitService.toInternal(NaN, 'mm')).toThrow()
  })
})

describe('parametric command transactions', () => {
  it('preserves dependency identity and exactly restores dimensions through undo/redo', () => {
    let doc = createDocument('Plate', 'mm')
    doc = applyCommand(doc, { type: 'set-sketch', plane: 'XY', x: 0, y: 0, width: 10, height: 20 })
    doc = applyCommand(doc, { type: 'extrude', distance: 30 })
    let history = createHistory(doc)
    history = commitHistory(history, { type: 'set-sketch', plane: 'XY', x: 0, y: 0, width: 15, height: 20 })
    expect(history.present.features[1].dependencies).toEqual([doc.features[0].id])
    expect(history.present.features[0].parameters).toMatchObject({ width: 15 })
    history = undoHistory(history)
    expect(history.present.features[0].parameters).toMatchObject({ width: 10 })
    history = redoHistory(history)
    expect(history.present.features[0].parameters).toMatchObject({ width: 15 })
  })
  it('rejects invalid commands without modifying the original document', () => {
    const doc = createDocument('Plate', 'mm')
    expect(() => applyCommand(doc, { type: 'extrude', distance: 30 })).toThrow(/sketch/i)
    expect(() => applyCommand(doc, { type: 'set-sketch', plane: 'XY', x: 0, y: 0, width: -1, height: 20 })).toThrow()
    expect(doc.features).toHaveLength(0)
  })
  it('roundtrips a versioned document and rejects unsupported or malformed input', () => {
    const doc = applyCommand(createDocument('Plate', 'in'), { type: 'set-sketch', plane: 'XY', x: 0, y: 0, width: 10, height: 20 })
    expect(parseProject(serializeProject(doc))).toEqual(doc)
    expect(() => parseProject('{"format":"AnishapeGeometry","version":999,"document":{}}')).toThrow(/version/i)
    expect(() => parseProject('{"format":"AnishapeGeometry","version":1,"document":{"features":[]}}')).toThrow()
  })
  it('discards redo only after a new successful command', () => {
    let h = createHistory(createDocument('Part', 'mm'))
    h = commitHistory(h, { type: 'set-sketch', plane: 'XY', x: 0, y: 0, width: 10, height: 20 })
    h = undoHistory(h)
    expect(h.future).toHaveLength(1)
    h = commitHistory(h, { type: 'set-sketch', plane: 'YZ', x: 0, y: 0, width: 5, height: 5 })
    expect(h.future).toHaveLength(0)
  })
})

it('deleting a sketch removes its dependent solid as one undoable transaction',()=>{
  let doc=applyCommand(createDocument('Deletion','mm'),{type:'set-sketch',plane:'XY',x:0,y:0,width:10,height:20})
  doc=applyCommand(doc,{type:'extrude',distance:30})
  const history=commitHistory(createHistory(doc),{type:'remove-feature',id:doc.features[0].id})
  expect(history.present.features).toEqual([])
  expect(undoHistory(history).present).toEqual(doc)
  expect(()=>applyCommand(doc,{type:'remove-feature',id:'missing'})).toThrow(/found/i)
})
