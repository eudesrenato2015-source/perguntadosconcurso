export function uid(prefix='id'){const s=crypto.getRandomValues(new Uint32Array(4)).join('-');return `${prefix}-${Date.now()}-${s}`;}
