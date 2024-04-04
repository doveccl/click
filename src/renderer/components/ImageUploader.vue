<script setup lang="ts">
import { download, readBuffer } from '../utils/file'
import type { UploadRawFile } from 'element-plus'

const props = defineProps<{ name?: string; modelValue?: string }>()
const emit = defineEmits<{
  (e: 'update:name', s?: string): void
  (e: 'update:modelValue', s?: string): void
}>()

const url = ref('')
api.url().then(x => (url.value = x))
const src = computed(() => `${url.value}/${props.modelValue}`)

watchEffect(() => {
  // auto change image path for old version
  props.modelValue?.startsWith('file:') && emit('update:modelValue', decodeURI(props.modelValue.split('/').at(-1)!))
})

function save(i: unknown, n?: string) {
  return api.save(i, n).then(
    s => emit('update:modelValue', s),
    e => ElMessage.error(e.message)
  )
}

async function upload(f: UploadRawFile) {
  const n = f.name.replace(/\.[^.]+$/, '')
  if (!props.name) emit('update:name', n)
  return !save(await readBuffer(f), f.name)
}
</script>

<template lang="pug">
.image(v-if="modelValue")
  el-image(v-if="url" :preview-src-list="[src]" :src="src" preview-teleported)
  .actions
    el-button(link @click="$el.querySelector('img').click()")
      el-icon
        i-ep-view
    el-button(link type="primary" @click="download(modelValue)")
      el-icon
        i-ep-download
    el-popconfirm(title="Delete" @confirm="emit('update:modelValue')")
      template(#reference)
        el-button(link type="danger")
          el-icon
            i-ep-delete
el-upload(v-else :before-upload="upload" :show-file-list="false" accept="image/*" drag)
  el-icon
    i-ep-plus
</template>

<style lang="sass">
.image
  display: flex
  position: relative
  justify-content: center
  border: var(--el-border)
  .actions
    top: 0
    left: 0
    width: 100%
    height: 100%
    display: flex
    position: absolute
    background: #000a
    backdrop-filter: blur(5px)
    justify-content: center
    transition: all 0.3s ease-in-out
    opacity: 0
  &:hover > .actions
    opacity: 1
</style>
