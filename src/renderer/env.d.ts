/// <reference types="electron-vite/node" />

declare global {
  const send: typeof import('../preload').send
}

export {}
