import { Image } from '@nut-tree/nut-js'
import type { Mat as MatCC } from '@u4/opencv4nodejs'
import type { Mat as MatJS } from '@techstark/opencv-js'

let cvcc: typeof import('@u4/opencv4nodejs') | undefined
let cvjs: typeof import('@techstark/opencv-js') | undefined

async function initCV() {
  if (cvcc || cvjs) return
  try {
    // throw 'test for cvjs'
    cvcc = (await import('@u4/opencv4nodejs')).default
  } catch (e) {
    console.warn('init native cv:', e)
    cvjs = (await import('@techstark/opencv-js')).default
    while (!cvjs.Mat) await new Promise(r => setTimeout(r, 50))
  }
}

const mScale = new WeakMap<Image, string>()
const mMatsCC = new WeakMap<Image, MatCC>()
const mMatsJS = new WeakMap<Image, MatJS>()

export function releaseMat(i: Image) {
  mMatsCC.get(i)?.release()
  mMatsJS.get(i)?.delete()
  mMatsCC.delete(i)
  mMatsJS.delete(i)
  mScale.delete(i)
}

async function initMat(i: Image, sx = 1, sy = 1) {
  const sxy = [sx, sy].join(',')
  if (mScale.get(i) === sxy) return
  releaseMat(i)
  mScale.set(i, sxy)
  await initCV()
  const [dw, dh] = [i.width / sx, i.height / sy].map(Math.round)
  if (cvcc) {
    const m = new cvcc.Mat(i.data, i.height, i.width, cvcc.CV_8UC4)
    mMatsCC.set(i, await m.resizeAsync(dh, dw))
    m.release()
  } else if (cvjs) {
    const r = new cvjs.Mat()
    const m = cvjs.matFromImageData(i)
    cvjs.resize(m, r, new cvjs.Size(dw, dh))
    mMatsJS.set(i, r)
    m.delete()
  }
}

export async function matchWithScale(i: Image, t: Image, fast = 1) {
  const { scaleX, scaleY } = i.pixelDensity
  await initMat(i, scaleX * fast, scaleY * fast)
  await initMat(t, scaleX * fast, scaleY * fast)
  const [w, h] = [t.width / scaleX, t.height / scaleY]
  if (cvcc) {
    const res = await mMatsCC.get(i)!.matchTemplateAsync(mMatsCC.get(t)!, cvcc.TM_CCOEFF_NORMED)
    const { maxLoc, maxVal } = await cvcc.minMaxLocAsync(res)
    return res.release(), { w, h, v: maxVal, ...maxLoc.mul(fast) }
  } else if (cvjs) {
    const res = new cvjs.Mat()
    cvjs.matchTemplate(mMatsJS.get(i)!, mMatsJS.get(t)!, res, cvjs.TM_CCOEFF_NORMED)
    // @ts-ignore
    const { maxLoc, maxVal } = cvjs.minMaxLoc(res)
    return res.delete(), { w, h, v: maxVal, x: maxLoc.x * fast, y: maxLoc.y * fast }
  } else {
    throw 'cv init fail'
  }
}
