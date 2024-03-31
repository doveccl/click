<script setup lang="ts">
import Sortable from 'sortablejs'
import { isNull, upperFirst } from 'lodash'
import { downloadText, readText } from './utils/file'
import { DEFAULT_DELAY, DEFAULT_THRESHOLD } from '../const'
import { type UploadRawFile } from 'element-plus'

const nop = () => 0
const dark = useDark()
const openDev = () => api.dev()
const switcher = { activeIcon: IEpMoon, inactiveIcon: IEpSunny }

const config = useStorage<Record<string, TMatcher[]>>('config', {})
const key = ref(Object.keys(config.value)[0] ?? '')
async function add() {
  const r = await ElMessageBox.prompt('Profile', { inputPattern: /.+/ })
  config.value[(key.value = r.value)] = []
}
async function del(p: unknown) {
  if (await ElMessageBox.confirm(`Delete "${p}"?`).catch(nop)) {
    const keys = Object.keys(config.value)
    delete config.value[`${p}`]
    if (key.value === p) {
      let i = keys.indexOf(`${p}`)
      i = i + 1 >= keys.length ? i - 1 : i + 1
      key.value = keys[i] ?? ''
    }
  }
}

const newItem = () => ({ id: Date.now(), action: 'click' }) as const

const tableRef = ref()
watch(tableRef, r => {
  if (!r?.$el) return
  new Sortable(r.$el.querySelector('tbody'), {
    handle: '.draggable',
    onEnd({ oldIndex, newIndex }) {
      const list = config.value[key.value]
      const a = list.splice(oldIndex!, 1)
      list.splice(newIndex!, 0, ...a)
    }
  })
})

const title = ref('Profiles')
const loading = ref(false)
const running = ref(false)

function start() {
  loading.value = true
  const s = JSON.stringify(config.value, (_, v) => (isNull(v) ? undefined : v))
  return api.start(key.value, JSON.parse(s))
}
function stop() {
  loading.value = true
  return api.stop()
}

addEventListener('message', e => {
  const { type, value: r } = e.data
  if (type === 'stopped') {
    r && ElNotification.error(r.message ?? r)
    loading.value = running.value = false
    title.value = 'Profiles'
    r && console.warn(r)
  } else if (type === 'started') {
    key.value = r
    running.value = true
    loading.value = false
    title.value = 'Monitor'
  }
})

async function upload(f: UploadRawFile) {
  Object.assign(config.value, JSON.parse(await readText(f)))
  if (!key.value) key.value = Object.keys(config.value)[0]
  return false
}
</script>

<template lang="pug">
el-main.vspace
  el-card
    el-row(justify="space-between" @click.alt="openDev")
      el-button(v-if="running" :loading="loading" type="danger" @click="stop") Stop (Ctrl + Alt + T)
      el-button(v-else :disabled="!key || !config[key].length" :loading="loading" type="success" @click="start") Start
      el-space(size="large")
        el-button(@click="downloadText(JSON.stringify(config), 'config.json')")
          el-icon
            i-ep-download
        el-upload(:before-upload="upload" :show-file-list="false" accept="application/json")
          template(#trigger)
            el-button
              el-icon
                i-ep-upload
        el-switch(v-bind="switcher" v-model="dark" inline-prompt)
  el-collapse(v-model="title" accordion)
    el-collapse-item(name="Profiles" title="Profiles")
      el-tabs(v-model="key" editable ref="tabRef" @tab-add="add().catch(nop)" @tab-remove="del")
        el-tab-pane(v-for="(_, i) in config" :key="i" :label="i" :name="i")
      el-table(v-show="key" :data="config[key]" ref="tableRef" row-key="id" style="width: 100%")
        el-table-column(fixed label="#" width="40")
          template(#default)
            el-icon.draggable(style="cursor: move")
              i-ep-sort
        el-table-column(align="center" fixed header-align="center" label="Name" width="100")
          template(#default="{ row, $index }")
            el-input(v-model="row.name" :placeholder="`#${$index}`")
        el-table-column(align="center" header-align="center" label="Image" min-width="150")
          template(#default="{ row }")
            image-uploader(v-model="row.image" v-model:name="row.name")
        el-table-column(align="center" header-align="center" label="Threshold" width="120")
          template(#default="{ row }")
            el-input-number(
              v-model="row.threshold"
              :controls="false"
              :placeholder="`${DEFAULT_THRESHOLD}`"
              :precision="2"
            )
        el-table-column(align="center" header-align="center" label="Action" width="120")
          template(#default="{ row }")
            el-select(v-model="row.action")
              el-option(v-for="i in ['click', 'jump', 'reset', 'stop']" :key="i" :label="upperFirst(i)" :value="i")
        el-table-column(align="center" header-align="center" label="Ratio / To" min-width="120")
          template(#default="{ row }")
            el-input-number(
              v-if="row.action === 'click'"
              v-model="row.ratio"
              :controls="false"
              :precision="1"
              placeholder="1.0"
            )
            el-select(v-else-if="row.action === 'jump'" v-model="row.to")
              el-option(v-for="(_, k) in config" :disabled="k === key" :key="k" :value="k")
            el-text(v-else) -
        el-table-column(align="center" header-align="center" label="Count" width="120")
          template(#default="{ row }")
            el-input-number(v-if="row.action === 'click'" v-model="row.count" :controls="false" placeholder="1")
            el-text(v-else) -
        el-table-column(align="center" header-align="center" label="Max" width="120")
          template(#default="{ row }")
            el-input-number(v-model="row.max" :controls="false" :min="1" placeholder="♾️")
        el-table-column(align="center" header-align="center" label="Delay" width="120")
          template(#default="{ row }")
            el-input-number(
              v-model="row.delay"
              :controls="false"
              :min="0"
              :placeholder="`${DEFAULT_DELAY}s`"
              :precision="1"
            )
        el-table-column(fixed="right" label="Edit" width="120")
          template(#default="{ $index }")
            el-space
              el-link(type="primary" @click="config[key].splice($index + 1, 0, newItem())") Add
              el-popconfirm(title="Delete" @confirm="config[key].splice($index, 1)")
                template(#reference)
                  el-link(type="danger") Delete
        template(#empty)
          el-link(type="primary" @click="config[key].push(newItem())") Add
    el-collapse-item(name="Monitor" title="Monitor")
      screen-monitor(:matchers="config[key]")
</template>

<style lang="sass">
@import element-plus/theme-chalk/dark/css-vars.css

body
  overflow-x: hidden
  margin-right: calc(100% - 100vw)
::-webkit-scrollbar
  width: 8px
::-webkit-scrollbar-thumb
  cursor: pointer
  border-radius: 4px
  background-color: rgba(136,136,136,0.4)
  :hover
    background-color: rgba(136,136,136,0.6)

.vspace > :not(:last-child)
  margin-bottom: 1em

.cell
  input
    text-align: center
  .el-upload
    --el-upload-dragger-padding-vertical: 20px
    --el-upload-dragger-padding-horizontal: 10px
  .el-input, .el-input-number
    max-width: 6em
    --el-input-border-color: transparent
</style>
