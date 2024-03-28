/// <reference types="electron-vite/node" />

declare global {
  const api: typeof import('../preload').default
}

export {}
