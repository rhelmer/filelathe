/** Client-only store for archive container bytes (kept out of compose / Jev). */
const archives = new Map<string, ArrayBuffer>();

export function putArchive(id: string, data: ArrayBuffer) {
  archives.set(id, data);
}

export function getArchive(id: string) {
  return archives.get(id);
}

export function deleteArchive(id: string) {
  archives.delete(id);
}

export function nextArchiveId() {
  return `arc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Opener registry so ArchiveBrowser can open an extracted entry through the
 * same drop path (loadDroppedFile → composeAndOpen) that App owns. Kept as a
 * module-level callback (like module-store) so it also works from pop-outs.
 */
type ArchiveOpener = (file: File) => void;
let opener: ArchiveOpener | null = null;

export function setArchiveOpener(fn: ArchiveOpener | null) {
  opener = fn;
}

export function openArchiveFile(file: File) {
  opener?.(file);
}
