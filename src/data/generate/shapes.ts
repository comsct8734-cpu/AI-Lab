/**
 * 교육용 예제 데이터 — 신경망 실험용 2차원 데이터
 * 실행:  npx tsx src/data/generate/shapes.ts
 *
 * 교과서 Ⅱ-03 인쇄 129쪽 활동 7(텐서플로 플레이그라운드)에 대응한다.
 * 은닉층이 있어야만 풀리는 데이터와, 없어도 풀리는 데이터를 함께 둔다.
 * 그래야 학생이 "은닉층이 무엇을 가능하게 하는가"를 스스로 발견할 수 있다.
 *
 * 식품 데이터는 교과서 134쪽 food_nn.csv 에 대응한다.
 * 원본을 복제하지 않고 같은 속성 이름(당도·아삭함)과 세 분류만 재현한다.
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
const rand = mulberry32(20260820);
function gauss(): number {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export interface ShapePoint {
  x: number;
  y: number;
  label: number;
}

/** 직선 하나로 나뉜다. 은닉층이 없어도 풀린다. */
function makeLinear(n: number): ShapePoint[] {
  const out: ShapePoint[] = [];
  for (let i = 0; i < n; i++) {
    const x = rand();
    const y = rand();
    // 경계 바로 위의 점은 빼서 애매함을 줄인다
    if (Math.abs(x + y - 1) < 0.08) continue;
    out.push({ x: r3(x), y: r3(y), label: x + y > 1 ? 1 : 0 });
  }
  return out;
}

/** 가운데 원과 바깥 고리. 직선 하나로는 나눌 수 없다. */
function makeCircle(n: number): ShapePoint[] {
  const out: ShapePoint[] = [];
  for (let i = 0; i < n; i++) {
    const inner = i % 2 === 0;
    const radius = inner ? 0.16 * Math.sqrt(rand()) : 0.3 + 0.14 * rand();
    const angle = rand() * Math.PI * 2;
    out.push({
      x: r3(clamp01(0.5 + radius * Math.cos(angle))),
      y: r3(clamp01(0.5 + radius * Math.sin(angle))),
      label: inner ? 0 : 1,
    });
  }
  return out;
}

/** 대각선으로 갈린 네 칸. 직선 하나로는 절대 나눌 수 없다. */
function makeXor(n: number): ShapePoint[] {
  const out: ShapePoint[] = [];
  for (let i = 0; i < n; i++) {
    const x = rand();
    const y = rand();
    if (Math.abs(x - 0.5) < 0.06 || Math.abs(y - 0.5) < 0.06) continue;
    const label = (x > 0.5) === (y > 0.5) ? 0 : 1;
    out.push({ x: r3(x), y: r3(y), label });
  }
  return out;
}

/** 두 갈래 나선. 가장 어렵다. */
function makeSpiral(n: number): ShapePoint[] {
  const out: ShapePoint[] = [];
  const per = Math.floor(n / 2);
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < per; i++) {
      // 반 바퀴만 돌면 두 갈래가 사실상 위아래로 갈려 직선으로도 나뉜다.
      // 두 바퀴 넘게 감아야 직선 하나로는 풀 수 없는 데이터가 된다.
      const t = (i / per) * 7 + 0.5;
      const angle = t + arm * Math.PI;
      const radius = 0.04 + t * 0.056;
      out.push({
        x: r3(clamp01(0.5 + radius * Math.cos(angle) + gauss() * 0.018)),
        y: r3(clamp01(0.5 + radius * Math.sin(angle) + gauss() * 0.018)),
        label: arm,
      });
    }
  }
  return out;
}

/** 식품 데이터 — 당도와 아삭함으로 세 종류를 나눈다 (교과서 134쪽) */
export interface Food {
  sweet: number;
  crunchy: number;
  label: number;
}
const FOOD_CLASS = ['과일', '단백질', '채소'];
function makeFood(): Food[] {
  const groups = [
    { label: 0, sweet: 7.6, crunchy: 6.4, sd: 1.5 }, // 과일 — 달고 아삭함
    { label: 1, sweet: 2.2, crunchy: 2.6, sd: 1.4 }, // 단백질 — 둘 다 낮음
    { label: 2, sweet: 3.0, crunchy: 8.2, sd: 1.4 }, // 채소 — 안 달고 아삭함
  ];
  const out: Food[] = [];
  for (const g of groups) {
    for (let i = 0; i < 30; i++) {
      out.push({
        sweet: Math.round(Math.max(0, Math.min(10, g.sweet + gauss() * g.sd)) * 10) / 10,
        crunchy: Math.round(Math.max(0, Math.min(10, g.crunchy + gauss() * g.sd)) * 10) / 10,
        label: g.label,
      });
    }
  }
  return out;
}

const shapes = {
  linear: makeLinear(220),
  circle: makeCircle(220),
  xor: makeXor(220),
  spiral: makeSpiral(220),
};
const food = makeFood();

console.log('\n교육용 예제 데이터 · 신경망 실험용');
console.log('─'.repeat(64));
let fail = 0;

/** 직선 하나로 얼마나 잘 나뉘는지 대략 확인한다 (로지스틱 회귀와 같은 방식) */
function linearSeparability(points: ShapePoint[]): number {
  let w0 = 0;
  let w1 = 0;
  let b = 0;
  for (let epoch = 0; epoch < 400; epoch++) {
    let g0 = 0;
    let g1 = 0;
    let gb = 0;
    for (const p of points) {
      const z = w0 * p.x + w1 * p.y + b;
      const pr = 1 / (1 + Math.exp(-z));
      const d = pr - p.label;
      g0 += d * p.x;
      g1 += d * p.y;
      gb += d;
    }
    const n = points.length;
    w0 -= (2 * g0) / n;
    w1 -= (2 * g1) / n;
    b -= (2 * gb) / n;
  }
  let correct = 0;
  for (const p of points) {
    const z = w0 * p.x + w1 * p.y + b;
    if ((z > 0 ? 1 : 0) === p.label) correct += 1;
  }
  return correct / points.length;
}

const expectations: [string, ShapePoint[], boolean][] = [
  ['직선', shapes.linear, true],
  ['원', shapes.circle, false],
  ['네 칸', shapes.xor, false],
  ['나선', shapes.spiral, false],
];

for (const [name, points, shouldBeLinear] of expectations) {
  const acc = linearSeparability(points);
  const ok = shouldBeLinear ? acc > 0.95 : acc < 0.75;
  if (!ok) fail += 1;
  console.log(
    `  ${ok ? '통과' : '실패'}  ${name.padEnd(6)} ${points.length}개 · 직선 하나로 ${(acc * 100).toFixed(1)}% ` +
      `(${shouldBeLinear ? '나뉘어야 함' : '나뉘지 않아야 함'})`,
  );
}

const foodCounts = FOOD_CLASS.map((c, i) => `${c} ${food.filter((f) => f.label === i).length}`);
console.log(`  통과  식품 ${food.length}개 · ${foodCounts.join(' · ')}`);

writeFileSync(resolve(import.meta.dirname, '../shapes.json'), JSON.stringify(shapes), 'utf-8');
writeFileSync(resolve(import.meta.dirname, '../food.json'), JSON.stringify(food), 'utf-8');
console.log(`\n  저장: src/data/shapes.json, src/data/food.json`);
console.log('═'.repeat(64));
console.log(fail === 0 ? '모든 목표값을 만족합니다.' : `${fail}개 항목이 목표에서 벗어났습니다.`);
if (fail > 0) process.exitCode = 1;
