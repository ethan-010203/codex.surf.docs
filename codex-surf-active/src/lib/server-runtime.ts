import 'server-only'

type StorageName = 'localStorage' | 'sessionStorage'

interface StorageShape {
  clear(): void
  getItem(key: string): string | null
  key(index: number): string | null
  readonly length: number
  removeItem(key: string): void
  setItem(key: string, value: string): void
}

function createMemoryStorage(): StorageShape {
  const memory = new Map<string, string>()

  return {
    getItem(key) {
      return memory.has(key) ? memory.get(key)! : null
    },
    setItem(key, value) {
      memory.set(String(key), String(value))
    },
    removeItem(key) {
      memory.delete(String(key))
    },
    clear() {
      memory.clear()
    },
    key(index) {
      return Array.from(memory.keys())[index] ?? null
    },
    get length() {
      return memory.size
    },
  }
}

function isStorageLike(value: unknown): value is StorageShape {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<StorageShape>

  return (
    typeof candidate.getItem === 'function' &&
    typeof candidate.setItem === 'function' &&
    typeof candidate.removeItem === 'function' &&
    typeof candidate.clear === 'function' &&
    typeof candidate.key === 'function'
  )
}

function ensureStorage(name: StorageName) {
  if (typeof window !== 'undefined') {
    return
  }

  const globalScope = globalThis as typeof globalThis & Record<StorageName, unknown>

  if (isStorageLike(globalScope[name])) {
    return
  }

  const storage = createMemoryStorage()

  try {
    Object.defineProperty(globalScope, name, {
      configurable: true,
      enumerable: true,
      value: storage,
      writable: true,
    })
  } catch {
    globalScope[name] = storage
  }
}

ensureStorage('localStorage')
ensureStorage('sessionStorage')

export {}
