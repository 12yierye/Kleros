const PREFIX = '[Kleros]'
let enabled = false

export function debug(tag: string, ...args: unknown[]): void {
  if (!enabled) return
  console.log(`${PREFIX} ${tag}`, ...args)
}

export function debugWarn(tag: string, ...args: unknown[]): void {
  if (!enabled) return
  console.warn(`${PREFIX} ${tag}`, ...args)
}

export function setDebug(on: boolean): void {
  enabled = on
  if (on) console.log(`${PREFIX} debug enabled`)
}

export function isDebugOn(): boolean {
  return enabled
}
