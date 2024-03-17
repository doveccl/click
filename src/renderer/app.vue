<script setup lang="ts">
import Sortable from 'sortablejs'
import zh from 'element-plus/es/locale/lang/zh-cn'
import type { UploadRawFile } from 'element-plus'

const nop = () => 0
const dark = useDark()
const switcher = { activeIcon: IEpMoon, inactiveIcon: IEpSunny }

const tabs = useStorage('tabs', ['默认方案'])
const tab = ref(tabs.value.at(0) ?? '')
async function add() {
  const r = await ElMessageBox.prompt('方案名称', { inputPattern: /.+/ })
  tabs.value.push(r.value)
  tab.value = r.value
}
async function del(p: unknown) {
  if (tabs.value.length < 2) return ElMessage.warning('至少保留一个方案')
  let i = tabs.value.indexOf(`${p}`)
  if (await ElMessageBox.confirm('确认删除方案？').catch(nop)) {
    tabs.value.splice(i, 1)
    if (tab.value === p) {
      i = Math.min(i, tabs.value.length - 1)
      tab.value = tabs.value[Math.max(i, 0)]
    }
  }
}

const getList = (k = '') => JSON.parse(localStorage.getItem(k) ?? '[]')
const list = ref(getList(tab.value))
const newItem = () => ({ id: Date.now() + Math.random(), ratio: 1, threshold: 0.8 })
watchDeep([tab, list], ([t, l], [ot, ol]) => {
  if (t !== ot) {
    list.value = getList(t)
  } else if (l === ol) {
    // object content updated, not pointer
    localStorage.setItem(tab.value, JSON.stringify(l))
  }
})

const tableRef = ref()
watch(tableRef, r => {
  if (!r?.$el) return
  new Sortable(r.$el.querySelector('tbody'), {
    handle: '.draggable',
    onEnd({ oldIndex, newIndex }) {
      const a = list.value.splice(oldIndex, 1)
      list.value.splice(newIndex, 0, ...a)
    }
  })
})

function select(m: TMatcher, f: UploadRawFile) {
  const r = new FileReader()
  r.readAsDataURL(f)
  r.onload = () => (m.img = r.result as string)
  if (!m.desc) m.desc = f.name.replace(/\.[^.]+$/, '')
  return false
}

const loading = ref(false)
const running = ref(false)
const logs = ref<string[]>([])
const logstr = computed(() => logs.value.join('\n'))
const forbid = computed(() => !list.value.length || !list.value.every(({ img = '' }) => img))
const start = () => ((loading.value = true), send(toRaw(list.value)))
const stop = () => ((loading.value = true), send('stop'))

addEventListener('message', ({ data }) => {
  if (data === 'started') {
    logs.value = []
    running.value = true
    loading.value = false
  } else if (data === 'stopped') {
    running.value = false
    loading.value = false
  } else if (data.log) {
    logs.value.unshift(data.log)
    logs.value.splice(100, logs.value.length)
  }
})

function download() {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(list.value)]))
  a.download = tab.value + '.json'
  a.click()
}
function upload(f: UploadRawFile) {
  const r = new FileReader()
  r.readAsText(f)
  r.onload = () => {
    const name = f.name.replace(/\.[^.]+$/, '')
    tabs.value.includes(name) || tabs.value.push(name)
    localStorage.setItem(name, r.result as string)
    tab.value = name
  }
  return false
}
</script>

<template lang="pug">
el-config-provider(:locale="zh")
  el-main.vspace
    el-card
      el-row(justify="space-between")
        el-button(v-if="running" :loading="loading" type="danger" @click="stop") 停止 (Ctrl + Alt + T)
        el-button(v-else :disabled="forbid" :loading="loading" type="success" @click="start") 开始
        el-space(size="large")
          el-button(@click="download")
            el-icon
              i-ep-download
          el-upload(:before-upload="upload" :show-file-list="false" accept="application/json")
            template(#trigger)
              el-button
                el-icon
                  i-ep-upload
          el-switch(v-bind="switcher" v-model="dark" inline-prompt)
    el-card(v-if="running")
      el-input(v-model="logstr" read-only rows="15" type="textarea")
    el-card(v-else)
      el-tabs(v-model="tab" editable ref="tabRef" @tab-add="add().catch(nop)" @tab-remove="del")
        el-tab-pane(v-for="i in tabs" :key="i" :label="i" :name="i")
      el-table(:data="list" ref="tableRef" row-key="id" table-layout="auto")
        el-table-column(label="#")
          template(#default)
            el-icon.draggable(style="cursor: move")
              i-ep-sort
        el-table-column(header-align="center" label="描述")
          template(#default="{ row }")
            el-input(v-model="row.desc" placeholder="添加描述")
        el-table-column(header-align="center" label="匹配图像" prop="img")
          template(#default="{ row }")
            .image(v-if="row.img")
              img(:src="row.img")
              .actions
                el-popconfirm(title="确认删除" @confirm="delete row.img")
                  template(#reference)
                    el-button(link type="danger")
                      el-icon
                        i-ep-delete
            el-upload(v-else :before-upload="f => select(row, f)" :show-file-list="false" accept="image/*" drag)
              el-icon
                i-ep-plus
        el-table-column(align="center" header-align="center" label="可点区域比")
          template(#default="{ row }")
            el-input-number(v-model="row.ratio" :controls="false" :min="0.1" :precision="2")
        el-table-column(align="center" header-align="center" label="最低相似度")
          template(#default="{ row }")
            el-input-number(v-model="row.threshold" :controls="false" :max="1" :precision="2")
        el-table-column(label="操作")
          template(#default="{ $index }")
            el-space
              el-link(type="primary" @click="list.splice($index + 1, 0, newItem())") 插入
              el-popconfirm(title="确认删除" @confirm="list.splice($index, 1)")
                template(#reference)
                  el-link(type="danger") 删除
        template(#empty)
          el-link(type="primary" @click="list.push(newItem())") 添加
</template>

<style lang="stylus">
@import 'element-plus/theme-chalk/dark/css-vars.css'
body
  overflow-x hidden
  margin-right calc(100% - 100vw)
::-webkit-scrollbar
  width 8px
::-webkit-scrollbar-thumb
  cursor pointer
  border-radius 4px
  background-color #8886
  & :hover
    background-color #8889

.vspace > :not(:last-child)
  margin-bottom 1em
.cell
  input
    text-align center
  .el-input__wrapper
    --el-input-border-color transparent
  .el-upload
    --el-upload-dragger-padding-vertical 20px
    --el-upload-dragger-padding-horizontal 10px

.image
  display flex
  padding 4px 0
  position relative
  justify-content center
  border var(--el-border)
  border-radius var(--el-border-radius-base)
  img
    max-width 150px
  .actions
    top 0
    left 0
    width 100%
    height 100%
    display flex
    position absolute
    background #000c
    border-radius inherit
    justify-content center
    transition all .2s ease-in-out
    opacity 0
.image:hover > .actions
  opacity 1
</style>
