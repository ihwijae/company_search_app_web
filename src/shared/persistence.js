const STORAGE_PREFIX = 'company_search_app:';
const MISSING_FLAG_KEY = '__companySearchStateMissing';
const IDB_NAME = 'company-search-app-persistence';
const IDB_STORE = 'entries';

let cachedLocalStorage = undefined;
let idbPromise = null;

const isQuotaExceededError = (err) => (
  err
  && (
    err.name === 'QuotaExceededError'
    || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    || err.code === 22
    || err.code === 1014
  )
);

const resolveLocalStorage = () => {
  if (typeof window === 'undefined') return null;
  if (cachedLocalStorage !== undefined) return cachedLocalStorage;
  let storage = null;
  try {
    storage = window.localStorage;
    const probeKey = `${STORAGE_PREFIX}__probe__`;
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    cachedLocalStorage = storage;
    return cachedLocalStorage;
  } catch (err) {
    if (storage && isQuotaExceededError(err)) {
      console.warn('[persistence] localStorage write probe exceeded quota; using read/delete fallback:', err);
      cachedLocalStorage = storage;
      return cachedLocalStorage;
    }
    console.warn('[persistence] localStorage unavailable:', err);
    cachedLocalStorage = null;
    return null;
  }
};

const electronAPI = () => {
  if (typeof window === 'undefined') return null;
  const api = window.electronAPI;
  if (!api) return null;
  if (typeof api.stateLoadSync !== 'function') return null;
  return api;
};

const withPrefix = (key) => `${STORAGE_PREFIX}${key}`;

const openPersistenceDb = () => {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('[persistence] IndexedDB open failed:', request.error);
      resolve(null);
    };
    request.onblocked = () => {
      console.warn('[persistence] IndexedDB open blocked');
      resolve(null);
    };
  });
  return idbPromise;
};

const loadFromIndexedDb = async (fullKey) => {
  const db = await openPersistenceDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const request = store.get(fullKey);
    request.onsuccess = () => {
      const row = request.result;
      resolve(row && Object.prototype.hasOwnProperty.call(row, 'value') ? row.value : undefined);
    };
    request.onerror = () => {
      console.warn('[persistence] IndexedDB load failed:', request.error);
      resolve(undefined);
    };
  });
};

const saveToIndexedDb = async (fullKey, value) => {
  const db = await openPersistenceDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const request = store.put({ key: fullKey, value, savedAt: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.warn('[persistence] IndexedDB save failed:', request.error);
      resolve();
    };
  });
};

const removeFromIndexedDb = async (fullKey) => {
  const db = await openPersistenceDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const request = store.delete(fullKey);
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.warn('[persistence] IndexedDB remove failed:', request.error);
      resolve();
    };
  });
};

const loadFromElectron = (fullKey) => {
  const api = electronAPI();
  if (!api) return undefined;
  try {
    const result = api.stateLoadSync(fullKey);
    if (result && typeof result === 'object' && result[MISSING_FLAG_KEY]) {
      return undefined;
    }
    // Undefined cannot be serialized across IPC; treat explicit null as stored value
    if (result === undefined) return undefined;
    return result;
  } catch (err) {
    console.warn('[persistence] electron fallback load failed:', err);
    return undefined;
  }
};

const saveToElectron = (fullKey, value) => {
  const api = electronAPI();
  if (!api) return;
  try {
    const maybePromise = api.stateSave(fullKey, value);
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch((err) => console.warn('[persistence] electron fallback save failed:', err));
    }
  } catch (err) {
    console.warn('[persistence] electron fallback save dispatch failed:', err);
  }
};

const removeFromElectron = (fullKey) => {
  const api = electronAPI();
  if (!api) return;
  try {
    const maybePromise = api.stateRemove(fullKey);
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch((err) => console.warn('[persistence] electron fallback remove failed:', err));
    }
  } catch (err) {
    console.warn('[persistence] electron fallback remove dispatch failed:', err);
  }
};

const clearElectron = (prefix) => {
  const api = electronAPI();
  if (!api) return;
  try {
    const maybePromise = api.stateClear(prefix);
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch((err) => console.warn('[persistence] electron fallback clear failed:', err));
    }
  } catch (err) {
    console.warn('[persistence] electron fallback clear dispatch failed:', err);
  }
};

export const loadPersisted = (key, fallback) => {
  const fullKey = withPrefix(key);
  const storage = resolveLocalStorage();
  if (storage) {
    try {
      const raw = storage.getItem(fullKey);
      if (raw !== null && raw !== undefined) {
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[persistence] load failed (localStorage):', err);
    }
  }

  const fallbackValue = loadFromElectron(fullKey);
  if (fallbackValue !== undefined) {
    if (storage) {
      try {
        storage.setItem(fullKey, JSON.stringify(fallbackValue));
      } catch (err) {
        console.warn('[persistence] electron fallback cache failed:', err);
      }
    }
    return fallbackValue;
  }

  return fallback;
};

export const loadPersistedAsync = async (key, fallback) => {
  const localValue = loadPersisted(key, undefined);
  if (localValue !== undefined) return localValue;

  const fullKey = withPrefix(key);
  const indexedDbValue = await loadFromIndexedDb(fullKey);
  if (indexedDbValue !== undefined) {
    const storage = resolveLocalStorage();
    if (storage) {
      try {
        storage.setItem(fullKey, JSON.stringify(indexedDbValue));
      } catch (err) {
        console.warn('[persistence] IndexedDB cache restore failed:', err);
      }
    }
    return indexedDbValue;
  }

  return fallback;
};

export const savePersisted = (key, value) => {
  const fullKey = withPrefix(key);
  const storage = resolveLocalStorage();
  if (storage) {
    try {
      storage.setItem(fullKey, JSON.stringify(value));
    } catch (err) {
      try {
        storage.removeItem(fullKey);
        storage.setItem(fullKey, JSON.stringify(value));
      } catch (retryErr) {
        console.warn('[persistence] save failed (localStorage):', retryErr || err);
      }
    }
  }
  saveToIndexedDb(fullKey, value).catch((err) => {
    console.warn('[persistence] IndexedDB save dispatch failed:', err);
  });
  saveToElectron(fullKey, value);
};

export const removePersisted = (key) => {
  const fullKey = withPrefix(key);
  const storage = resolveLocalStorage();
  if (storage) {
    try {
      storage.removeItem(fullKey);
    } catch (err) {
      console.warn('[persistence] remove failed (localStorage):', err);
    }
  }
  removeFromIndexedDb(fullKey).catch((err) => {
    console.warn('[persistence] IndexedDB remove dispatch failed:', err);
  });
  removeFromElectron(fullKey);
};

export const clearPersisted = (prefix = '') => {
  const storage = resolveLocalStorage();
  const resolvedPrefix = withPrefix(prefix);
  if (storage) {
    try {
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);
        if (key && key.startsWith(resolvedPrefix)) {
          storage.removeItem(key);
        }
      }
    } catch (err) {
      console.warn('[persistence] clear failed (localStorage):', err);
    }
  }
  clearElectron(resolvedPrefix);
};
