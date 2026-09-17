import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  applyCommand, commitHistory, createDocument, createHistory, parseHistory,
  parseProject, redoHistory, serializeProject, undoHistory, type History,
} from '../cad/document'
import { database, loadHistory, loadProject, saveProject } from '../persistence/projects'

afterEach(async () => {
  await database.projects.clear()
  await database.snapshots.clear()
})

function editedRectangle(): History {
  const document = applyCommand(createDocument('Editable plate', 'mm'), {
    type: 'set-sketch', plane: 'XY', x: 0, y: 0, width: 10, height: 20,
  })
  let history = createHistory(document)
  history = commitHistory(history, {
    type: 'set-sketch', plane: 'XY', x: 0, y: 0, width: 15, height: 20,
  })
  return commitHistory(history, { type: 'settings', unit: 'in', precision: 5 })
}

function backup(history: History): string {
  return JSON.stringify({
    format: 'AnishapeGeometry', version: 1, document: history.present,
    history: { past: history.past, future: history.future },
  })
}

describe('persisted parametric history', () => {
  it('reloads committed parameter and unit edits with exact undo and redo documents', async () => {
    const history = editedRectangle()
    await saveProject(history.present, 'BRep fixture', history)
    const reloaded = await loadHistory(history.present.id)

    expect(reloaded).toEqual(history)
    expect(await loadProject(history.present.id)).toEqual(history.present)
    const beforeSettings = undoHistory(reloaded)
    expect(beforeSettings.present.unit).toBe('mm')
    expect(beforeSettings.present.precision).toBe(3)
    const beforeDimension = undoHistory(beforeSettings)
    expect(beforeDimension.present.features[0].parameters).toMatchObject({ width: 10 })
    expect(redoHistory(redoHistory(beforeDimension)).present).toEqual(history.present)
  })

  it('retains a redo branch across save and reload, then clears it on a new edit', async () => {
    const history = editedRectangle()
    const undone = undoHistory(history)
    await saveProject(undone.present, 'Undone BRep fixture', undone)
    const reloaded = await loadHistory(undone.present.id)

    expect(reloaded.future).toEqual(undone.future)
    expect(redoHistory(reloaded).present).toEqual(history.present)
    const branched = commitHistory(reloaded, {
      type: 'set-sketch', plane: 'XY', x: 0, y: 0, width: 18, height: 20,
    })
    await saveProject(branched.present, 'Branched BRep fixture', branched)
    expect((await loadHistory(branched.present.id)).future).toEqual([])
  })

  it('opens legacy database rows without history as an empty undo/redo session', async () => {
    const document = editedRectangle().present
    await database.projects.put({
      id: document.id, document, brep: '', savedAt: new Date().toISOString(),
    })
    expect(await loadHistory(document.id)).toEqual(createHistory(document))
  })

  it('rejects saving history belonging to a different document without replacing the saved project', async () => {
    const history = editedRectangle()
    await saveProject(history.present, 'Original BRep fixture', history)
    const other = createHistory(createDocument('Unrelated document', 'mm'))
    await expect(saveProject(history.present, 'Wrong BRep', other)).rejects.toThrow()
    expect(await loadHistory(history.present.id)).toEqual(history)
    expect((await database.projects.get(history.present.id))!.brep).toBe('Original BRep fixture')
  })
})

describe('history in .anishape backups', () => {
  it('roundtrips both undo and redo stacks without losing feature identities or parameters', () => {
    const history = undoHistory(editedRectangle())
    const serialized = serializeProject(history.present, history)
    expect(parseHistory(serialized)).toEqual(history)
    expect(parseProject(serialized)).toEqual(history.present)
    expect(undoHistory(parseHistory(serialized)).present.features[0].parameters).toMatchObject({ width: 10 })
    expect(redoHistory(parseHistory(serialized)).present.unit).toBe('in')
  })

  it('reads legacy version 1 files without history', () => {
    const document = editedRectangle().present
    const legacy = JSON.stringify({ format: 'AnishapeGeometry', version: 1, document })
    expect(parseProject(legacy)).toEqual(document)
    expect(parseHistory(legacy)).toEqual(createHistory(document))
  })

  it('persists the latest 60 edits and preserves all available undo steps', async () => {
    let history = createHistory(createDocument('Bounded history', 'mm'))
    for (let i = 0; i < 65; i++) {
      history = commitHistory(history, { type: 'settings', unit: 'mm', precision: i % 10 })
    }
    expect(history.past).toHaveLength(60)
    await saveProject(history.present, '', history)
    const serialized = serializeProject(history.present, history)
    expect(parseHistory(serialized)).toEqual(history)
    let reloaded = await loadHistory(history.present.id)
    for (let i = 0; i < 60; i++) reloaded = undoHistory(reloaded)
    expect(reloaded.present).toEqual(history.past[0].before)
    expect(reloaded.past).toHaveLength(0)
    expect(reloaded.future).toHaveLength(60)
    expect(parseHistory(serializeProject(reloaded.present, reloaded))).toEqual(reloaded)
  })

  const corruptions: [string, (history: History) => void][] = [
    ['disconnected past transactions', history => {
      history.past[0].after.name = 'Different intermediate document'
    }],
    ['past that does not end at the present document', history => {
      history.past.at(-1)!.after.precision = 11
    }],
    ['future that does not start at the present document', history => {
      const undone = undoHistory(history)
      Object.assign(history, JSON.parse(JSON.stringify(undone)) as History)
      history.future.at(-1)!.before.name = 'Wrong redo start'
    }],
    ['transactions from another project', history => {
      history.past[0].before.id = 'unrelated-project'
    }],
    ['invalid document parameters in an undo snapshot', history => {
      const feature = history.past[0].before.features[0]
      if (feature.type === 'sketch') feature.parameters.width = -20
    }],
    ['unknown command types', history => {
      Object.assign(history.past[0].command, { type: 'run-arbitrary-command' })
    }],
    ['invalid command parameters', history => {
      Object.assign(history.past[0].command, { width: -10 })
    }],
    ['a command whose parameters do not produce its after snapshot', history => {
      Object.assign(history.past[0].command, { width: 70 })
    }],
    ['more than 60 stored transactions', history => {
      const transaction = structuredClone(history.past[0])
      history.past = Array.from({ length: 61 }, () => structuredClone(transaction))
    }],
  ]

  it.each(corruptions)('rejects %s through both history and document import', (_name, corrupt) => {
    // JSON roundtrip removes shared object identities, as in an imported file.
    const history = JSON.parse(JSON.stringify(editedRectangle())) as History
    corrupt(history)
    const contents = backup(history)
    expect(parseHistory).toBeTypeOf('function')
    expect(() => parseHistory(contents)).toThrow()
    expect(() => parseProject(contents)).toThrow()
  })

  it('rejects a malformed history envelope instead of silently dropping it', () => {
    const file = JSON.parse(backup(editedRectangle()))
    file.history = { past: 'invalid', future: [] }
    expect(() => parseProject(JSON.stringify(file))).toThrow()
  })
})
