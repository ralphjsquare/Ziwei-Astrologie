import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { canonicalJson, hashOf, sha256 } from '../src/core/hash';
import { jiaziIndex, jiaziName, nayinElement, nayinName, yinMonthStem, ziHourStem } from '../src/core/ganzhi';

describe('哈希与规范化', () => {
  it('SHA-256 标准向量', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
    expect(sha256('紫微斗数')).toHaveLength(64);
    expect(sha256('紫微斗数')).toBe(sha256('紫微斗数'));
  });
  it('规范化 JSON：键序无关，拒绝非有限数', () => {
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
    expect(hashOf({ a: 1, b: 2 })).toBe(hashOf({ b: 2, a: 1 }));
    expect(() => canonicalJson({ a: NaN })).toThrow();
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
  it('性质：任意对象键序打乱后哈希不变', () => {
    fc.assert(fc.property(fc.dictionary(fc.string(), fc.integer()), (o) => {
      const rev = Object.fromEntries(Object.entries(o).reverse());
      return hashOf(o) === hashOf(rev);
    }));
  });
});

describe('干支基础表', () => {
  it('60 甲子往返与纳音（抽查经典对应）', () => {
    for (let i = 0; i < 60; i++) expect(jiaziIndex(i % 10, i % 12)).toBe(i);
    expect(jiaziName(0)).toBe('甲子');
    expect(nayinName(0)).toBe('海中金');
    expect(nayinName(59)).toBe('大海水');
    expect(nayinName(jiaziIndex(9, 11) )).toBe('大海水'); // 癸亥
    expect(nayinElement(jiaziIndex(1, 1))).toBe('金'); // 乙丑 海中金
    expect(nayinName(12)).toBe('涧下水'); // 丙子
    expect(nayinName(jiaziIndex(4, 0))).toBe('霹雳火'); // 戊子
  });
  it('五虎遁、五鼠遁', () => {
    expect([0, 1, 2, 3, 4].map((s) => yinMonthStem(s))).toEqual([2, 4, 6, 8, 0]); // 甲→丙 乙→戊 丙→庚 丁→壬 戊→甲
    expect([0, 1, 2, 3, 4].map((s) => ziHourStem(s))).toEqual([0, 2, 4, 6, 8]); // 甲→甲 乙→丙 丙→戊 丁→庚 戊→壬
  });
});
