// In-memory file handoff between tools. Works because navigation between
// pages is client-side (next/link), so module state survives the transition.
// Falls back gracefully: after a hard reload there is simply nothing to take.
let pending: File[] | null = null;

export function stashFiles(files: File[]): void {
  pending = files;
}

export function takeFiles(): File[] | null {
  const files = pending;
  pending = null;
  return files;
}
