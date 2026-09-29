// 均时差（Meeus《Astronomical Algorithms》第 28 章），返回秒。仅用于真太阳时校正。
export function equationOfTimeSeconds(epochSec: number): number {
  const jd = epochSec / 86400 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const rad = Math.PI / 180;
  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) * rad;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * rad;
  const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
  const eps = (23.439291 - 0.0130042 * T) * rad;
  const y = Math.tan(eps / 2) ** 2;
  const E =
    y * Math.sin(2 * L0) - 2 * e * Math.sin(M) + 4 * e * y * Math.sin(M) * Math.cos(2 * L0) -
    0.5 * y * y * Math.sin(4 * L0) - 1.25 * e * e * Math.sin(2 * M);
  return Math.round((E / rad) * 4 * 60); // 弧度→度→分钟(×4)→秒(×60)
}
