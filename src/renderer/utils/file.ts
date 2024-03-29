export function download(url: string, name = url.replace(/.+\//, '')) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
}

export function downloadText(txt: string, name = 'down.txt') {
  const url = URL.createObjectURL(new Blob([txt]))
  download(url, name)
  URL.revokeObjectURL(url)
}

export const readText = (f: File) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsText(f)
  })

export const readBuffer = (f: File) =>
  new Promise<ArrayBuffer>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as ArrayBuffer)
    r.onerror = () => rej(r.error)
    r.readAsArrayBuffer(f)
  })
