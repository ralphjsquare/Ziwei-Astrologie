import type { BirthInput } from '../src/core/types';

export function rng(seed: number) {
  let s = seed >>> 0;
  const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  return { next, int: (a: number, b: number) => a + Math.floor(next() * (b - a + 1)) };
}

export const CN = { utcOffsetMinutes: 480, dstMinutes: 0 };
export const solarInput = (y: number, m: number, d: number, hh: number, mm: number, gender: 'M' | 'F' = 'M', place = CN): BirthInput =>
  ({ calendar: 'solar', year: y, month: m, day: d, hour: hh, minute: mm, gender, place });
