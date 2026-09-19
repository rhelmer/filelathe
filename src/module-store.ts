/** Client-only store for tracker module bytes (kept out of compose API / Jev). */
const modules = new Map<string, ArrayBuffer>();

export function putModule(id: string, data: ArrayBuffer) {
  modules.set(id, data);
}

export function getModule(id: string) {
  return modules.get(id);
}

export function deleteModule(id: string) {
  modules.delete(id);
}

export function nextModuleId() {
  return `mod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
