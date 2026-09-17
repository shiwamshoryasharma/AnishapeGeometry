import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CadDocument, ExportResult, ModelResult } from '../cad/types'
import { applyCommand, createDocument } from '../cad/document'
import { geometryClient } from '../cad/worker-client'
import { database, loadProject } from '../persistence/projects'
import { useEditor } from '../store/editor'

vi.mock('../cad/worker-client', () => ({
  // Deliberately leave requests pending on dispose: already queued callbacks and
  // completions must also be rejected by the store's transaction boundary.
  geometryClient: { build: vi.fn(), export: vi.fn(), dispose: vi.fn() },
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function modelFor(document: CadDocument): ModelResult {
  return {
    revision: document.revision, faces: [], edges: [], volume: 6000,
    surfaceArea: 2200, center: [5, 10, 15],
    bounds: { min: [0, 0, 0], max: [10, 20, 30] },
    triangleCount: 12, brep: `fixture-revision-${document.revision}`, durationMs: 1,
  }
}

beforeEach(async () => {
  vi.clearAllMocks()
  useEditor.setState({
    history: null, model: null, preview: null, selection: [], busy: false,
    progress: 'Ready', error: null, saveState: 'unsaved',
  })
  const sketch = applyCommand(createDocument('Cancellation fixture', 'mm'), {
    type: 'set-sketch', plane: 'XY', x: 0, y: 0, width: 10, height: 20,
  })
  const document = applyCommand(sketch, { type: 'extrude', distance: 30 })
  vi.mocked(geometryClient.build).mockImplementation(async doc => modelFor(doc))
  await useEditor.getState().open(document)
  await useEditor.getState().execute({ type: 'extrude', distance: 40 })
  await useEditor.getState().undo()
  await useEditor.getState().save()
  useEditor.getState().select({ kind: 'face', id: 'committed-face' })
})

afterEach(async () => {
  useEditor.setState({ busy: false })
  await useEditor.getState().save()
  await database.projects.clear()
  await database.snapshots.clear()
})

const kinds = ['build', 'preview', 'export'] as const

function beginPending(kind: typeof kinds[number]) {
  const pending = deferred<ModelResult | ExportResult>()
  let progress: ((text: string) => void) | undefined
  if (kind === 'export') {
    vi.mocked(geometryClient.export).mockImplementationOnce((_doc, _options, callback) => {
      progress = callback
      return pending.promise as Promise<ExportResult>
    })
  } else {
    vi.mocked(geometryClient.build).mockImplementationOnce((_doc, callback) => {
      progress = callback
      return pending.promise as Promise<ModelResult>
    })
  }
  const operation = kind === 'export'
    ? useEditor.getState().exportStl({ format: 'binary', unit: 'mm', tolerance: 0.1, angle: 0.3 })
    : kind === 'preview'
      ? useEditor.getState().previewCommand({ type: 'extrude', distance: 99 })
      : useEditor.getState().execute({ type: 'extrude', distance: 99 })
  return { ...pending, operation, report: (text: string) => progress?.(text) }
}

describe.each(kinds)('cancelling pending %s', kind => {
  it('preserves the committed document, undo/redo history and model, ignores late completion, and permits the next edit', async () => {
    const committed = useEditor.getState()
    expect(committed.history!.past).toHaveLength(0)
    expect(committed.history!.future).toHaveLength(1)
    const pending = beginPending(kind)
    expect(useEditor.getState().busy).toBe(true)

    useEditor.getState().cancelOperation()

    expect(useEditor.getState()).toMatchObject({
      busy: false, error: null, preview: null, history: committed.history,
      model: committed.model, selection: committed.selection,
    })
    expect(await loadProject(committed.history!.present.id)).toEqual(committed.history!.present)

    const next = deferred<ModelResult>()
    let nextDocument!: CadDocument
    vi.mocked(geometryClient.build).mockImplementationOnce((doc, progress) => {
      nextDocument = doc
      progress?.('Building the next edit')
      return next.promise
    })
    const nextOperation = useEditor.getState().execute({ type: 'extrude', distance: 50 })
    pending.report('Stale operation progress')
    const staleResult = kind === 'export'
      ? { bytes: new Uint8Array([1, 2, 3]), triangles: 12, unit: 'mm' as const, closed: true }
      : { ...committed.model!, brep: 'stale-geometry' }
    pending.resolve(staleResult)
    expect(await pending.operation).toBe(kind === 'export' ? null : false)
    expect(useEditor.getState()).toMatchObject({
      busy: true, progress: 'Building the next edit', error: null, preview: null,
      history: committed.history, model: committed.model,
    })

    const nextModel = modelFor(nextDocument)
    next.resolve(nextModel)
    expect(await nextOperation).toBe(true)
    expect(useEditor.getState().model).toBe(nextModel)
    expect(useEditor.getState().history!.present.features[1].parameters).toMatchObject({ distance: 50 })
    expect(useEditor.getState().history!.past).toHaveLength(1)
    expect(useEditor.getState().history!.future).toHaveLength(0)
    expect(useEditor.getState().busy).toBe(false)
    await useEditor.getState().save()
    expect(await loadProject(nextDocument.id)).toEqual(nextDocument)
  })

  it('ignores a late worker rejection without changing cancellation state', async () => {
    const committed = useEditor.getState()
    const pending = beginPending(kind)
    useEditor.getState().cancelOperation()
    const cancelledProgress = useEditor.getState().progress
    pending.report('Late progress')
    pending.reject(new Error('The disposed worker stopped'))

    expect(await pending.operation).toBe(kind === 'export' ? null : false)
    expect(useEditor.getState()).toMatchObject({
      busy: false, progress: cancelledProgress, error: null, preview: null,
      history: committed.history, model: committed.model,
    })
    expect(await loadProject(committed.history!.present.id)).toEqual(committed.history!.present)
  })
})
