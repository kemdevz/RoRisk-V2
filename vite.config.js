import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { roriskApi } from './server/Index.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [roriskApi(env), react()],
  }
})
