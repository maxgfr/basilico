import 'fake-indexeddb/auto'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appStorage, DB_NAME, resetStorageForTests, storageFailed } from './storage'

const NAME = 'basilico:v1:app'

async function readIdb(name: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore('kv')
    request.onsuccess = () => {
      const get = request.result.transaction('kv').objectStore('kv').get(name)
      get.onsuccess = () => {
        request.result.close()
        resolve(get.result)
      }
      get.onerror = () => reject(get.error)
    }
    request.onerror = () => reject(request.error)
  })
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  localStorage.clear()
  resetStorageForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('app storage on a shared origin', () => {
  it('moves state saved in localStorage by an earlier version into IndexedDB, then drops it', async () => {
    localStorage.setItem(NAME, '{"state":{"sessions":[1]},"version":1}')

    expect(await appStorage.getItem(NAME)).toBe('{"state":{"sessions":[1]},"version":1}')
    expect(await readIdb(NAME)).toBe('{"state":{"sessions":[1]},"version":1}')
    expect(localStorage.getItem(NAME)).toBeNull()

    // Idempotent: the next load reads IndexedDB and finds nothing left to move.
    resetStorageForTests()
    expect(await appStorage.getItem(NAME)).toBe('{"state":{"sessions":[1]},"version":1}')
  })

  it('leaves keys it does not own alone', async () => {
    localStorage.setItem('theme', 'dark')
    await appStorage.getItem(NAME)
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('writes nothing before the saved state has been read', async () => {
    await appStorage.setItem(NAME, '{"state":{"sessions":[]}}')
    expect(await readIdb(NAME)).toBeUndefined()

    await appStorage.getItem(NAME)
    await appStorage.setItem(NAME, '{"state":{"sessions":[2]}}')
    expect(await readIdb(NAME)).toBe('{"state":{"sessions":[2]}}')
  })

  it('keeps a change still in flight when the page goes away, and reads it back first', async () => {
    await appStorage.getItem(NAME)
    await appStorage.setItem(NAME, '{"state":{"sessions":[1]}}')
    // Not awaited: the tab is closed while this one is still being written.
    void appStorage.setItem(NAME, '{"state":{"sessions":[1,2]}}')
    window.dispatchEvent(new Event('pagehide'))
    expect(localStorage.getItem(`${NAME}:unsaved`)).toBe('{"state":{"sessions":[1,2]}}')

    resetStorageForTests()
    expect(await appStorage.getItem(NAME)).toBe('{"state":{"sessions":[1,2]}}')
    expect(await readIdb(NAME)).toBe('{"state":{"sessions":[1,2]}}')
    expect(localStorage.getItem(`${NAME}:unsaved`)).toBeNull()
  })

  it('drops the journal once the write it covered has landed', async () => {
    await appStorage.getItem(NAME)
    const write = appStorage.setItem(NAME, '{"state":{}}')
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))
    await write
    expect(localStorage.getItem(`${NAME}:unsaved`)).toBeNull()
  })

  it('says so when the browser refuses a write, instead of throwing', async () => {
    await appStorage.getItem(NAME)
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    await expect(appStorage.setItem(NAME, '{}')).resolves.toBeUndefined()
    expect(storageFailed()).toBe(true)

    vi.restoreAllMocks()
    await appStorage.setItem(NAME, '{}')
    expect(storageFailed()).toBe(false)
  })

  it('falls back to localStorage without IndexedDB, guarded the same way', async () => {
    // @ts-expect-error - a browser without IndexedDB
    delete globalThis.indexedDB
    await appStorage.getItem(NAME)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    expect(() => appStorage.setItem(NAME, '{}')).not.toThrow()
    expect(storageFailed()).toBe(true)
  })
})
