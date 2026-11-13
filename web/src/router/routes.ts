import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('../layouts/DefaultLayout.vue'),
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('../views/HomeView.vue'),
      },
      {
        path: 'history',
        name: 'history',
        component: () => import('../views/HistoryView.vue'),
      },
      {
        path: 'services',
        name: 'services',
        component: () => import('../views/ServicesView.vue'),
      },
      {
        path: 'ufw',
        name: 'ufw',
        component: () => import('../views/UfwView.vue'),
      },
      {
        path: 'docker',
        name: 'docker',
        component: () => import('../views/DockerView.vue'),
      },
      {
        path: 'pironman',
        name: 'pironman',
        component: () => import('../views/PironmanView.vue'),
      },
      {
        path: 'apps',
        name: 'apps',
        component: () => import('../views/AppsView.vue'),
      },
      // Inside the layout so a bad link still shows the header and menu.
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('../views/NotFoundView.vue'),
      },
    ],
  },
]

export default routes
