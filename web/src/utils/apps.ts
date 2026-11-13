import type { App } from "../../../shared/types";

/** {host} becomes whatever host this dashboard was opened on. */
export const resolveAppUrl = (url: string) => url.replaceAll("{host}", window.location.hostname);

export function appHost(url: string): string {
  try {
    return new URL(resolveAppUrl(url)).host;
  } catch {
    return url;
  }
}

// The server finds and caches the icon. The app's URL goes in as a version,
// so editing it fetches a fresh one past the browser cache.
export const appIconSrc = (app: App) => `/api/apps/${app.id}/icon?v=${encodeURIComponent(app.url)}`;
