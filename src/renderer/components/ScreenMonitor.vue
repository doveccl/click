<script setup lang="ts">
import { DEFAULT_THRESHOLD } from '../../const'

defineProps<{ matchers?: TMatcher[] }>()
const val = reactive(new Map<number, number>())
const max = reactive(new Map<number, boolean>())
const cvs = ref<HTMLCanvasElement>()

function handler(e: MessageEvent) {
  const { type, value: r } = e.data
  if (type === 'started') max.clear()
  else if (type === 'check') val.delete(r.id)
  else if (type === 'max') max.set(r.id, true)
  else if (type === 'result') val.set(r.id, r.v)
  if (!cvs.value) return
  const ctx = cvs.value.getContext('2d')!
  if (type === 'screen') {
    const buf = new Uint8ClampedArray(r.data)
    cvs.value.width = r.width
    cvs.value.height = r.height
    ctx.putImageData(new ImageData(buf, r.width), 0, 0)
    val.forEach((_, i) => max.get(i) || val.delete(i))
  } else if (type === 'rect') {
    ctx.fillStyle = '#00bb'
    ctx.fillRect(r.x, r.y, r.w, r.h)
  } else if (type === 'click') {
    ctx.fillStyle = '#0909'
    ctx.fillRect(r.left, r.top, r.width, r.height)
    ctx.beginPath()
    ctx.arc(r.x, r.y, 10, 0, 2 * Math.PI)
    ctx.fillStyle = '#e00e'
    ctx.fill()
  }
}

function color(m: TMatcher) {
  const n = val.get(m.id)
  if (!n) return ''
  if (n === -1) return 'info'
  return n > (m.threshold ?? DEFAULT_THRESHOLD) ? 'success' : 'danger'
}

function result(m: TMatcher) {
  const n = val.get(m.id)
  if (!n) return '...'
  if (n === -1) return '-'
  return n.toFixed(2)
}

onBeforeMount(() => addEventListener('message', handler))
onBeforeUnmount(() => removeEventListener('message', handler))
</script>

<template lang="pug">
.relative
  canvas(ref="cvs" style="width: 100%")
  .side(v-if="matchers?.length")
    template(v-for="(m, i) in matchers" :key="m.id")
      el-row(justify="space-between")
        el-text(:tag="max.get(m.id) ? 's' : 'b'") {{ m.name ?? `#${i}` }}
        el-text(:type="color(m)" tag="b") {{ result(m) }}
</template>

<style lang="sass">
.relative
  position: relative
.side
  top: 0
  left: 0
  min-width: 8em
  padding: 4px 8px
  position: absolute
  background: #666c
</style>
