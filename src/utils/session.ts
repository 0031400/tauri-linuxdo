export const SESSION_EVENT = "linuxdo-session-changed";

export function notifySessionChanged() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}
