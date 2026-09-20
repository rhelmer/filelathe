/** True when floating windows should favor touch / narrow-viewport UX. */
export function prefersTouchUi(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(max-width: 767px)").matches
  );
}
