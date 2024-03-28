import vue from '@vitejs/plugin-vue'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [
      vue(),
      Icons({ autoInstall: true }),
      AutoImport({
        dts: true,
        imports: ['vue', '@vueuse/core'],
        resolvers: [IconsResolver(), ElementPlusResolver()]
      }),
      Components({
        dts: true,
        dirs: ['components'],
        resolvers: [IconsResolver(), ElementPlusResolver()]
      })
    ]
  }
})
