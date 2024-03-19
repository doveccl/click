import cv, { type Mat } from '@u4/opencv4nodejs'
import { isArray, pick, random } from 'lodash'
import { mouse, screen } from '@nut-tree/nut-js'
import { parentPort } from 'node:worker_threads'

const post = (m: unknown) => parentPort?.postMessage(m)

function trand(min = -1, max = 1) {
  return (random(min, max, true) + random(min, max, true)) / 2
}

let matchers: TMatcher[] = []
let timer: ReturnType<typeof setTimeout> | null = null

function matchTemplate(i: Mat, t: Mat) {
  const res = i.matchTemplate(t, cv.TM_CCOEFF_NORMED)
  const loc = cv.minMaxLoc(res)
  return res.release(), loc
}

async function loop() {
  const sc = await screen.grab()
  const sw = await screen.width()
  const sh = await screen.height()
  const mat = new cv.Mat(sc.data, sc.height, sc.width, cv.CV_8UC4)
  post(pick(await sc.toRGB(), 'data', 'width', 'height'))

  for (let i = 0; i < matchers.length; i++) {
    const m = matchers[i]
    const loc = matchTemplate(mat, m.mat!)
    if (!timer) break
    post({ i, confidence: loc.maxVal })
    if (loc.maxVal > (m.threshold ?? 0.8)) {
      let [w, h] = [m.mat!.cols / 2, m.mat!.rows / 2]
      let [x, y] = [loc.maxLoc.x + w, loc.maxLoc.y + h]
      w *= m.ratio ?? 1
      h *= m.ratio ?? 1
      post({ x, y, w, h })
      x = trand(x - w, x + w)
      y = trand(y - h, y + h)
      post({ x, y })
      await mouse.move([{ x: (x * sw) / mat.cols, y: (y * sh) / mat.rows }])
      await mouse.leftClick()
      break
    }
  }

  mat.release()
  if (timer) timer = setTimeout(loop, 1000)
}

function stop() {
  if (timer) clearTimeout(timer)
  timer = null
  while (matchers.length) matchers.pop()?.mat?.release()
  post('stopped')
}

async function start(list: TMatcher[]) {
  for (const m of (matchers = list)) {
    m.img = m.img!.replace(/^[^,]+,/, '')
    m.mat = cv.imdecode(Buffer.from(m.img, 'base64'), cv.IMREAD_UNCHANGED)
  }
  post('started')
  timer = setTimeout(loop)
}

parentPort?.on('message', m => {
  if (m === 'stop') stop()
  else if (isArray(m)) start(m)
})

process.on('unhandledRejection', err => {
  post(err)
  stop()
})
