import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { roriskApi } from './server/Index.js'


export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, '.', '')
  const serverEnv = Object.freeze({
    SUPABASE_URL: loadedEnv.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: loadedEnv.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SECRET_KEY: loadedEnv.SUPABASE_SECRET_KEY,
    RORISK_USER_SECRET: loadedEnv.RORISK_USER_SECRET,
    HCAPTCHA_SECRET: loadedEnv.HCAPTCHA_SECRET,
    HCAPTCHA_SITE_KEY: loadedEnv.HCAPTCHA_SITE_KEY || loadedEnv.VITE_HCAPTCHA_SITE_KEY,
  })

  return {

    envPrefix: 'PUBLIC_CLIENT_',
    build: { sourcemap: false },
    plugins: [roriskApi(serverEnv), react()],
    server: {
      allowedHosts: ['rorisk-v2.onrender.com'],
      host: '0.0.0.0', 
    },
    preview: {
      allowedHosts: ['rorisk-v2.onrender.com'],
      host: '0.0.0.0',
    },
  }
})
