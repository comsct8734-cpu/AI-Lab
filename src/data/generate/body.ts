/**
 * 교육용 예제 데이터 — 신체 치수
 * 실행:  npx tsx src/data/generate/body.ts
 *
 * 교과서 인쇄 99~103쪽의 회귀 실습에 대응하는 데이터를 새로 만든다.
 * 원본(jeans.csv)을 복제하지 않고 같은 속성 이름과 관계의 세기만 재현한다.
 *
 * 맞추어야 할 값
 *   목둘레 → 허리둘레 단순 회귀의 결정계수 R² 약 0.72   (교과서 100~101쪽)
 *   속성을 늘린 다중 회귀는 단순 회귀보다 R² 가 커질 것 (교과서 102~103쪽)
 *   훈련 데이터의 R² 가 테스트 데이터의 R² 보다 클 것    (교과서 95쪽 과적합)
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function mulberry32(seed: number) {
  return function random(): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260817);
function gauss(): number {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
const r1 = (x: number) => Math.round(x * 10) / 10;

export interface Body {
  neck: number;
  weight: number;
  heap: number;
  waist: number;
}

const rows: Body[] = [];
const N = 300;

for (let i = 0; i < N; i++) {
  // 사람의 '전체적인 체격'을 잠재 변수 하나로 두고,
  // 네 측정값이 이 값을 서로 다른 정도로 따르게 한다.
  // 그래야 속성마다 허리둘레와의 관계의 세기가 달라진다.
  const size = gauss();

  const neck = 38 + 2.3 * (0.95 * size + 0.312 * gauss());
  const weight = 70 + 9 * (0.92 * size + 0.392 * gauss());
  const heap = 95 + 6 * (0.85 * size + 0.527 * gauss());
  const waist = 82 + 8 * (0.9 * size + 0.436 * gauss());

  rows.push({
    neck: r1(neck),
    weight: r1(weight),
    heap: r1(heap),
    waist: r1(waist),
  });
}

/* ── 검증 ─────────────────────────────────────────────────── */
const col = (k: keyof Body) => rows.map((r) => r[k]);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function simpleR2(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < xs.length; i++) {
    const pred = slope * xs[i] + intercept;
    ssRes += (ys[i] - pred) ** 2;
    ssTot += (ys[i] - my) ** 2;
  }
  return 1 - ssRes / ssTot;
}

const waist = col('waist');
const targets: [string, number, number, number][] = [
  ['행 수', rows.length, N, 0],
  ['목둘레 → 허리둘레 R² (교과서 약 0.72)', simpleR2(col('neck'), waist), 0.72, 0.07],
  ['몸무게 → 허리둘레 R²', simpleR2(col('weight'), waist), 0.7, 0.12],
  ['엉덩이둘레 → 허리둘레 R²', simpleR2(col('heap'), waist), 0.58, 0.14],
  ['목둘레 평균 (cm)', mean(col('neck')), 38, 1],
  ['허리둘레 평균 (cm)', mean(waist), 82, 2],
];

console.log('\n교육용 예제 데이터 · 신체 치수');
console.log('─'.repeat(64));
let fail = 0;
for (const [name, actual, expected, tol] of targets) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) fail += 1;
  console.log(
    `  ${ok ? '통과' : '실패'}  ${name.padEnd(34)} ${(Math.round(actual * 1000) / 1000)
      .toString()
      .padStart(8)}  (목표 ${expected})`,
  );
}

const out = resolve(import.meta.dirname, '../body.json');
writeFileSync(out, JSON.stringify(rows), 'utf-8');
console.log(`\n  저장: ${out}`);
console.log('═'.repeat(64));
console.log(fail === 0 ? '모든 목표값을 만족합니다.' : `${fail}개 항목이 목표에서 벗어났습니다.`);
if (fail > 0) process.exitCode = 1;
