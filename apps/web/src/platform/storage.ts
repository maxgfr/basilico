import type { StateStorage } from 'zustand/middleware'

/**
 * Where the app's state lives: IndexedDB, in a database named after the app.
 *
 * `maxgfr.github.io` is one origin for every Pages project on the account, and
 * localStorage belongs to the origin: about five million characters shared by
 * all of them. The session log only ever grows, so it does not belong there —
 * once another site has filled the quota, every write here would fail.
 *
 * Three rules the store relies on:
 * - state written by an earlier version under the same name in localStorage is
 *   moved here once, then removed (the key is this app's own);
 * - nothing is written before the stored state has been read, so a default
 *   state rendered during the read can never overwrite real data;
 * - a write that fails never throws into the UI: it raises `storageFailed`,
 *   which the interface turns into a visible warning;
 * - IndexedDB is asynchronous, and a tab closed right after a change can take
 *   the write down with it. A write still in flight when the page is hidden is
 *   copied, synchronously, to a localStorage journal that the next load reads
 *   first and then removes.
 *
 * Without IndexedDB (some private modes, jsdom) it falls back to localStorage,
 * guarded the same way.
 */

export const DB_NAME = 'basilico-store'
const STORE = 'kv'

let mode: 'idb' | 'local' | null = null
let connection: Promise<IDBDatabase> | null = null
/** Set once the stored state has been read: writes before that are dropped. */
let ready = false
let failed = false
const listeners = new Set<() => void>()

function setFailed(value: boolean): void {
  if (failed === value) return
  failed = value
  for (const listener of listeners) listener()
}

/** Whether the last write was refused: what is on screen will not survive a reload. */
export function storageFailed(): boolean {
  return failed
}

export function subscribeStorage(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function open(): Promise<IDBDatabase> {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.addEventListener('upgradeneeded', () => request.result.createObjectStore(STORE))
    request.addEventListener('success', () => {
      const db = request.result
      // Let a deletion from another tab (or the browser's site settings) proceed.
      db.addEventListener('versionchange', () => {
        db.close()
        connection = null
      })
      resolve(db)
    })
    request.addEventListener('error', () => reject(request.error))
  }).catch((error: unknown) => {
    connection = null
    throw error
  })
  return connection
}

async function run<T>(
  txMode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, txMode)
    const request = action(tx.objectStore(STORE))
    tx.addEventListener('complete', () => resolve(request.result))
    tx.addEventListener('error', () => reject(tx.error))
    tx.addEventListener('abort', () => reject(tx.error))
  })
}

function readLocal(name: string): string | null {
  try {
    return localStorage.getItem(name)
  } catch {
    return null
  }
}

async function pickMode(): Promise<'idb' | 'local'> {
  if (mode) return mode
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no IndexedDB')
    await open()
    mode = 'idb'
  } catch {
    mode = 'local'
  }
  return mode
}

/** Writes go one after the other: each is a full snapshot, and the last one must win. */
let queue: Promise<void> = Promise.resolve()
/** The snapshot not yet committed to IndexedDB, if any. */
let inFlight: { name: string; value: string } | null = null
/** Whether this page wrote a journal that a later commit has made stale. */
let journaled = false

const journalKey = (name: string) => `${name}:unsaved`

function writeJournal(): void {
  if (!inFlight) return
  try {
    localStorage.setItem(journalKey(inFlight.name), inFlight.value)
    journaled = true
  } catch {
    /* best effort: the IndexedDB write may still land */
  }
}

function dropJournal(name: string): void {
  try {
    localStorage.removeItem(journalKey(name))
  } catch {
    /* nothing we can do */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', writeJournal)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') writeJournal()
  })
}

export const appStorage: StateStorage = {
  async getItem(name) {
    if ((await pickMode()) === 'local') {
      ready = true
      return readLocal(name)
    }
    // The last change of a page closed mid-write is newer than anything here.
    const journal = readLocal(journalKey(name))
    if (journal !== null) {
      await run('readwrite', (store) => store.put(journal, name))
      dropJournal(name)
      ready = true
      return journal
    }
    // A read that fails throws: the store then stays on its defaults in memory
    // and writes nothing, rather than replacing data it could not see.
    const stored = await run<unknown>('readonly', (store) => store.get(name))
    if (typeof stored === 'string') {
      ready = true
      return stored
    }
    const legacy = readLocal(name)
    if (legacy !== null) {
      await run('readwrite', (store) => store.put(legacy, name))
      try {
        localStorage.removeItem(name)
      } catch {
        /* moved anyway; the old copy is ignored from now on */
      }
    }
    ready = true
    return legacy
  },

  setItem(name, value) {
    if (!ready) return
    if (mode === 'local') {
      try {
        localStorage.setItem(name, value)
        setFailed(false)
      } catch {
        setFailed(true)
      }
      return
    }
    const snapshot = { name, value }
    inFlight = snapshot
    queue = queue
      .then(() => run('readwrite', (store) => store.put(value, name)))
      .then(
        () => {
          if (inFlight !== snapshot) return
          inFlight = null
          setFailed(false)
          if (journaled) {
            journaled = false
            dropJournal(name)
          }
        },
        () => setFailed(true),
      )
    return queue
  },

  removeItem(name) {
    if (mode === 'local') {
      try {
        localStorage.removeItem(name)
      } catch {
        /* nothing to remove, or nothing we can do */
      }
      return
    }
    queue = queue
      .then(() => run('readwrite', (store) => store.delete(name)))
      .then(
        () => undefined,
        () => undefined,
      )
    return queue
  },
}

/** Test seam: forget the connection and the read, as a fresh page load would. */
export function resetStorageForTests(): void {
  mode = null
  connection = null
  ready = false
  failed = false
  queue = Promise.resolve()
  inFlight = null
  journaled = false
}
