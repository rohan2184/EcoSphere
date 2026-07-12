/**
 * INTEGRATION SEAM — delete useFakeRole and wire real user.role from Person C's AuthContext once merged.
 * Delete the local axios client in lib/api.ts and import Person C's shared client instead —
 * just update the import path in files that do `from '../lib/api'`, the axios call signatures should stay compatible.
 */

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "eco_fake_role";
export type FakeRole = "admin" | "employee";

let _role: FakeRole = (localStorage.getItem(STORAGE_KEY) as FakeRole) || "employee";
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
}

function getSnapshot(): FakeRole {
  return _role;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setFakeRole(role: FakeRole) {
  _role = role;
  localStorage.setItem(STORAGE_KEY, role);
  emitChange();
}

export function getFakeRole(): FakeRole {
  return _role;
}

/**
 * React hook — re-renders the component when the fake role changes.
 */
export function useFakeRole(): [FakeRole, (r: FakeRole) => void] {
  const role = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return [role, useCallback((r: FakeRole) => setFakeRole(r), [])];
}
