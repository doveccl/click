<script setup lang="ts">
import type { UploadRawFile } from 'element-plus'

const props = defineProps<{ name?: string; modelValue?: string }>()
const emit = defineEmits<{
  (e: 'update:name', s?: string): void
  (e: 'update:modelValue', s?: string): void
}>()

function save(img: unknown) {
  api.save(img).then(
    s => emit('update:modelValue', s),
    e => ElMessage.error(e.message)
  )
}

function select(f: UploadRawFile) {
  const n = f.name.replace(/\.[^.]+$/, '')
  if (!props.name) emit('update:name', n)
  const r = new FileReader()
  r.onload = () => save(r.result)
  r.readAsArrayBuffer(f)
  return false
}
</script>

<template lang="pug">
.image(v-if="modelValue")
  img(:src="modelValue")
  .actions
    el-popconfirm(title="Delete" @confirm="emit('update:modelValue')")
      template(#reference)
        el-button(link type="danger")
          el-icon
            i-ep-delete
el-upload(v-else :before-upload="select" :show-file-list="false" accept="image/*" drag)
  el-icon
    i-ep-plus
</template>

<style lang="sass">
.image
  display: flex
  position: relative
  justify-content: center
  border: var(--el-border)
  border-radius: var(--el-border-radius-base)
  img
    max-width: 100%
    border-radius: inherit
  .actions
    top: 0
    left: 0
    width: 100%
    height: 100%
    display: flex
    position: absolute
    background: #000b
    border-radius: inherit
    justify-content: center
    transition: all 0.2s ease-in-out
    opacity: 0
  &:hover > .actions
    opacity: 1
</style>
