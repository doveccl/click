<script setup lang="ts">
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
    const { x, y, w, h } = r
    ctx.fillStyle = '#0617'
    ctx.fillRect(x - w, y - h, 2 * w, 2 * h)
  } else if (type === 'click') {
    ctx.beginPath()
    ctx.arc(r.x, r.y, 10, 0, 2 * Math.PI)
    ctx.fillStyle = '#f00c'
    ctx.fill()
  }
}

function color(m: TMatcher) {
  const n = val.get(m.id)
  if (!n) return ''
  if (n === -1) return 'info'
  return n > (m.threshold ?? 0.9) ? 'success' : 'danger'
}

function result(m: TMatcher) {
  const n = val.get(m.id)
  if (!n) return '...'
  if (n === -1) return '-'
  return n.toFixed(4)
}

onBeforeMount(() => addEventListener('message', handler))
onBeforeUnmount(() => removeEventListener('message', handler))
</script>

<template lang="pug">
.relative
  canvas(ref="cvs" style="width: 100%")
  el-space.side(alignment="start" direction="vertical")
    template(v-for="(m, i) in matchers" :key="m.id")
      el-text(:tag="max.get(m.id) ? 'del' : 'b'" :type="color(m)") {{ m.name ?? `#${i}` }} {{ result(m) }}
</template>

<style lang="sass">
.relative
  position: relative
.side
  top: 0
  left: 0
  padding: 1em
  min-width: 5em
  position: absolute
  background: #666c
</style>
