/**
 * Service worker registration and app updates.
 *
 * A new version installs on its own but stays *waiting* instead of taking over
 * (registerType: 'prompt' in vite.config.ts). That keeps a tab loaded with the
 * previous version from being served by the new service worker, which is how
 * the first visit to a not-yet-loaded tab breaks. So the switch is a chosen
 * moment: a banner asks, and on accept the waiting worker is let in and the
 * page reloads.
 */
import { computed, ref } from "vue";
import { registerSW } from "virtual:pwa-register";

/**
 * How often, at most, the server is asked whether there is a new version. On
 * its own the browser only checks on navigation and at most once a day — and a
 * dashboard left open on a tablet never navigates.
 */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

/** If the new worker never confirms it took over, reload anyway after this. */
const APPLY_TIMEOUT_MS = 3000;

/** A new version is installed and waiting to be let in. */
export const updateReady = ref(false);

/** It is being applied; keeps the button from being pressed twice. */
export const updating = ref(false);

/**
 * Closing only hides the banner for this session: the waiting version is still
 * there, so it comes back on the next visit until it is applied.
 */
const dismissed = ref(false);

export const updateVisible = computed(() => updateReady.value && !dismissed.value);

export function dismissUpdate(): void {
  dismissed.value = true;
}

let registration: ServiceWorkerRegistration | undefined;
let lastCheck = 0;

function checkForUpdate(): void {
  if (!registration || !navigator.onLine) return;

  const now = Date.now();
  if (now - lastCheck < CHECK_INTERVAL_MS) return;
  lastCheck = now;

  // Offline, or the Pi briefly down: this fails and that's not an app failure —
  // the next check will work.
  void registration.update().catch(() => undefined);
}

// Also fires at startup when a version was left waiting from an earlier visit,
// so the banner shows without needing another deploy.
const updateSW = registerSW({
  onNeedRefresh() {
    updateReady.value = true;
  },
  onRegisteredSW(_url, r) {
    registration = r;
    lastCheck = Date.now();
    // Kept open on a tablet: check on a timer...
    setInterval(checkForUpdate, CHECK_INTERVAL_MS);
  },
  onRegisterError(err) {
    console.error("Service worker registration failed:", err);
  },
});

// ...and when coming back to the app, which is exactly when it's about to be used.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForUpdate();
});

/** Lets the new version through and reloads onto it. */
export function applyUpdate(): void {
  if (updating.value) return;
  updating.value = true;

  // Safety net: if the worker doesn't answer, reloading beats leaving the
  // banner up forever. A waiting worker gone already (another tab applied it)
  // ends up here too, and reloading is all that's left anyway.
  setTimeout(() => window.location.reload(), APPLY_TIMEOUT_MS);

  void updateSW(true);
}
