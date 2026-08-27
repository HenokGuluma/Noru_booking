'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * A local-only CRUD overlay for demo purposes: there is no write API yet (no
 * Server Actions, no session/auth to attribute the write to, no audit trail —
 * see CLAUDE.md §7, "every write is scoped and audited"). Real persistence
 * needs all three before it can go in. Until then, adds/edits/deletes are
 * layered on top of the server-fetched rows and kept in this browser's
 * localStorage, so they survive navigation within a session but never touch
 * Postgres and never leave this device.
 *
 * Deliberately initialised empty and hydrated in an effect, not read
 * synchronously on first render — reading localStorage during the initial
 * render would make the client's first paint diverge from the server-rendered
 * HTML and trip a hydration mismatch.
 */
interface Overlay<T> {
  added: T[];
  edited: Record<string, Partial<T>>;
  deleted: string[];
}

const EMPTY: Overlay<never> = { added: [], edited: {}, deleted: [] };

function storageKeyFor(name: string): string {
  return `noru-crew:overlay:${name}`;
}

function loadOverlay<T>(name: string): Overlay<T> {
  try {
    const raw = window.localStorage.getItem(storageKeyFor(name));
    return raw ? (JSON.parse(raw) as Overlay<T>) : { added: [], edited: {}, deleted: [] };
  } catch {
    return { added: [], edited: {}, deleted: [] };
  }
}

function saveOverlay<T>(name: string, overlay: Overlay<T>) {
  try {
    window.localStorage.setItem(storageKeyFor(name), JSON.stringify(overlay));
  } catch {
    // Storage full or unavailable (private browsing) — edits just won't
    // survive a refresh; not worth surfacing an error for a demo overlay.
  }
}

export function useLocalOverlay<T extends { id: string }>(name: string, serverRows: T[]) {
  const [overlay, setOverlay] = useState<Overlay<T>>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setOverlay(loadOverlay<T>(name));
    setHydrated(true);
  }, [name]);

  const persist = useCallback(
    (next: Overlay<T>) => {
      setOverlay(next);
      saveOverlay(name, next);
    },
    [name],
  );

  const rows = serverRows
    .filter((row) => !overlay.deleted.includes(row.id))
    .map((row) => ({ ...row, ...(overlay.edited[row.id] ?? {}) }))
    .concat(overlay.added);

  const addRow = useCallback((row: T) => persist({ ...overlay, added: [...overlay.added, row] }), [overlay, persist]);

  const updateRow = useCallback(
    (id: string, patch: Partial<T>) => {
      const locallyAdded = overlay.added.some((row) => row.id === id);
      if (locallyAdded) {
        persist({ ...overlay, added: overlay.added.map((row) => (row.id === id ? { ...row, ...patch } : row)) });
      } else {
        persist({ ...overlay, edited: { ...overlay.edited, [id]: { ...overlay.edited[id], ...patch } } });
      }
    },
    [overlay, persist],
  );

  const deleteRow = useCallback(
    (id: string) => {
      const locallyAdded = overlay.added.some((row) => row.id === id);
      if (locallyAdded) {
        persist({ ...overlay, added: overlay.added.filter((row) => row.id !== id) });
      } else {
        persist({ ...overlay, deleted: [...overlay.deleted, id] });
      }
    },
    [overlay, persist],
  );

  const isLocal = useCallback(
    (id: string) => overlay.added.some((row) => row.id === id) || id in overlay.edited,
    [overlay],
  );

  return { rows, addRow, updateRow, deleteRow, isLocal, hydrated };
}

/** Matches uuidv7's shape closely enough for a client-only synthetic id — never sent to Postgres. */
export function localId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
