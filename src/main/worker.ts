import jimp from 'jimp'
import cv from '@techstark/opencv-js'
import { isArray, random } from 'lodash'
import { mouse, screen } from '@nut-tree/nut-js'
import { parentPort } from 'node:worker_threads'

const post = (m: unknown) => parentPort?.postMessage(m)

function trand(min = -1, max = 1) {
  return (random(min, max, true) + random(min, max, true)) / 2
}

let matchers: TMatcher[] = []
let timer: ReturnType<typeof setTimeout> | null = null

function matchTemplate(i: cv.Mat, t: cv.Mat) {
  const res = new cv.Mat()
  cv.matchTemplate(i, t, res, cv.TM_CCOEFF_NORMED)
  // @ts-ignore
  const loc = cv.minMaxLoc(res)
  return res.delete(), loc
}

async function loop() {
  // 屏幕分辨率与截图大小可能不一致
  const sw = await screen.width()
  const sh = await screen.height()
  const mat = cv.matFromImageData(await screen.grab())

  let find = false
  for (const m of matchers) {
    if (timer === null) break
    const loc = matchTemplate(mat, m.mat!)
    post({ log: `匹配图像${m.desc ?? ''}相似度: ${loc.maxVal}` })
    if (loc.maxVal > (m.threshold ?? 0.8)) {
      find = true
      let [w, h] = [m.mat!.cols / 2, m.mat!.rows / 2]
      let [x, y] = [loc.maxLoc.x + w, loc.maxLoc.y + h]
      w *= m.ratio ?? 1
      h *= m.ratio ?? 1
      x = trand(x - w, x + w)
      y = trand(y - h, y + h)
      post({ log: `鼠标点击位置 (${x}, ${y})` })
      await mouse.move([{ x: (x * sw) / mat.cols, y: (y * sh) / mat.rows }])
      await mouse.leftClick()
      break
    }
  }

  mat.delete()
  find || post({ log: '未匹配到相似图像' })
  if (timer !== null) timer = setTimeout(loop, 500)
}

function stop() {
  if (timer !== null) clearTimeout(timer)
  timer = null
  while (matchers.length) matchers.pop()?.mat?.delete()
  post('stopped')
}

function error(err = '未知错误') {
  post({ err })
  stop()
}

async function start(list: TMatcher[]) {
  try {
    for (const m of (matchers = list)) {
      m.img = m.img!.replace(/^[^,]+,/, '')
      const im = await jimp.read(Buffer.from(m.img, 'base64'))
      m.mat = cv.matFromImageData(im.bitmap)
    }
    timer = setTimeout(loop)
    post('started')
  } catch (e) {
    error(`${e}`)
  }
}

parentPort?.on('message', m => {
  if (m === 'stop') stop()
  else if (isArray(m)) start(m)
})
