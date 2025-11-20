import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import VoiceActorSpreadsheet from '../views/VoiceActorSpreadsheet.vue'

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/voice-actor-spreadsheet',
    name: 'VoiceActorSpreadsheet',
    component: VoiceActorSpreadsheet
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router