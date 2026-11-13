import { createRouter, createWebHistory } from 'vue-router'
import routes from './routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

/**
 * Safety net for app updates. A new version normally waits for the banner
 * (src/pwa.ts), but it can still end up in charge of a tab running the old
 * one — another tab accepted it, say. Pages already open keep working; the
 * first visit to a tab that wasn't loaded yet asks for a file with the old
 * build hash that no longer exists. Reloading onto where the user was going
 * gets the new version and the tab, which is what they wanted anyway.
 */
const MISSING_CHUNK =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

let reloading = false
router.onError((error, to) => {
  // Once per session: a plain network failure would otherwise loop.
  if (reloading || !MISSING_CHUNK.test(error?.message ?? '')) return
  reloading = true
  window.location.assign(to.fullPath)
})

export default router
