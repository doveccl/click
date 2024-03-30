import Jimp from 'jimp'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import type { Mat as MatCC } from '@u4/opencv4nodejs'
import type { Mat as MatJS } from '@techstark/opencv-js'

export async function saveImage(ab: ArrayBuffer, name?: string) {
  const buf = Buffer.from(ab)
  const { app } = await import('electron')
  const path = join(app.getPath('userData'), 'images')
  let file = join(path, name || `${Date.now()}.${(await Jimp.read(buf)).getExtension()}`)
  if ((await stat(file).catch(() => null))?.isFile())
    if (buf.compare(await readFile(file))) file = file.replace(/([^/\\]*)$/, `${Date.now()}-$1`)
  await mkdir(path, { recursive: true })
  await writeFile(file, buf)
  return pathToFileURL(file).href
}

let cvcc: typeof import('@u4/opencv4nodejs') | undefined
let cvjs: typeof import('@techstark/opencv-js') | undefined

async function initCV() {
  if (cvcc || cvjs) return
  try {
    cvcc = (await import('@u4/opencv4nodejs')).default
  } catch (e) {
    console.warn('init native cv:', e)
    cvjs = (await import('@techstark/opencv-js')).default
    while (!cvjs.Mat) await new Promise(r => setTimeout(r, 50))
  }
}

const resized = new WeakSet<Jimp>()
const mMatsCC = new WeakMap<Jimp, MatCC>()
const mMatsJS = new WeakMap<Jimp, MatJS>()

export function resizeOnce(i: Jimp, dw: number) {
  if (resized.has(i)) return
  i.resize(dw, Jimp.AUTO)
  resized.add(i)
}

async function initMat(i: Jimp) {
  if (mMatsCC.has(i) || mMatsJS.has(i)) return
  await initCV()
  const b = i.bitmap
  if (cvcc) mMatsCC.set(i, new cvcc.Mat(b.data, b.height, b.width, cvcc.CV_8UC4))
  else if (cvjs) mMatsJS.set(i, cvjs.matFromImageData(b))
}

export async function matchTmpl(i: Jimp, t: Jimp) {
  await initMat(i)
  await initMat(t)
  if (cvcc) {
    const res = await mMatsCC.get(i)!.matchTemplateAsync(mMatsCC.get(t)!, cvcc.TM_CCOEFF_NORMED)
    const { maxLoc, maxVal } = await cvcc.minMaxLocAsync(res)
    return res.release(), { ...maxLoc, v: maxVal }
  } else if (cvjs) {
    const res = new cvjs.Mat()
    cvjs.matchTemplate(mMatsJS.get(i)!, mMatsJS.get(t)!, res, cvjs.TM_CCOEFF_NORMED)
    // @ts-ignore
    const { maxLoc, maxVal } = cvjs.minMaxLoc(res)
    return res.delete(), { ...maxLoc, v: maxVal }
  } else {
    throw 'cv init fail'
  }
}

export function releaseMat(i: Jimp) {
  mMatsCC.get(i)?.release()
  mMatsJS.get(i)?.delete()
  mMatsCC.delete(i)
  mMatsJS.delete(i)
}
