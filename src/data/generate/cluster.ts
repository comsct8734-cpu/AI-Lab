/**
 * 교육용 예제 데이터 — 군집
 * 실행:  npx tsx src/data/generate/cluster.ts
 *
 * 교과서 인쇄 120~124쪽의 군집 실습에 대응하는 데이터를 새로 만든다.
 * 원본(Mall_Customers.csv, caffe_menu.csv)을 복제하지 않고
 * 같은 속성 이름과 '눈으로 보이는 덩어리의 수'만 재현한다.
 *
 * 맞추어야 할 것
 *   쇼핑몰 고객 : k = 5 에서 실루엣 점수가 가장 높을 것 (교과서 120~123쪽)
 *   카페 음료   : k = 4 에서 실루엣 점수가 가장 높을 것 (교과서 124쪽)
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
const rand = mulberry32(20260818);
function gauss(): number {
  const u = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/* ── 쇼핑몰 고객 (교과서 120쪽) ────────────────────────────── */
export interface Mall {
  age: number;
  annual_income: number;
  spending_score: number;
}

/** 다섯 덩어리. 소득과 소비 점수의 조합이 서로 다른 고객층이다. */
const MALL_GROUPS: { n: number; income: number; score: number; sd: [number, number] }[] = [
  { n: 22, income: 26, score: 20, sd: [7, 9] }, // 소득 낮고 소비도 적음
  { n: 22, income: 26, score: 79, sd: [7, 9] }, // 소득 낮은데 소비는 많음
  { n: 82, income: 55, score: 50, sd: [9, 9] }, // 가운데 (가장 많음)
  { n: 37, income: 88, score: 17, sd: [12, 8] }, // 소득 높은데 소비는 적음
  { n: 37, income: 88, score: 82, sd: [12, 8] }, // 소득도 소비도 많음
];

const mall: Mall[] = [];
for (const g of MALL_GROUPS) {
  for (let i = 0; i < g.n; i++) {
    mall.push({
      age: Math.round(clamp(38 + gauss() * 13, 18, 70)),
      annual_income: Math.round(clamp(g.income + gauss() * g.sd[0], 15, 140)),
      spending_score: Math.round(clamp(g.score + gauss() * g.sd[1], 1, 100)),
    });
  }
}

/* ── 카페 음료 (교과서 124쪽) ──────────────────────────────── */
export interface Cafe {
  name: string;
  sugars: number;
  caffeine: number;
}

// 네 덩어리가 한 줄로 늘어서면 k = 5 로도 잘 나뉘어 버린다.
// 서로 떨어진 네 자리에 뭉치게 두어야 k = 4 가 뚜렷하게 가장 좋아진다.
const CAFE_GROUPS: { label: string; n: number; sugars: number; caffeine: number; sd: [number, number] }[] = [
  { label: '아메리카노 계열', n: 15, sugars: 3, caffeine: 155, sd: [1.5, 9] },
  { label: '라떼 계열', n: 15, sugars: 22, caffeine: 95, sd: [2.5, 8] },
  { label: '초콜릿·프라페 계열', n: 15, sugars: 52, caffeine: 48, sd: [3, 7] },
  { label: '차·에이드 계열', n: 15, sugars: 28, caffeine: 6, sd: [3.5, 3] },
];

const cafe: Cafe[] = [];
for (const g of CAFE_GROUPS) {
  for (let i = 0; i < g.n; i++) {
    cafe.push({
      name: `${g.label} ${i + 1}`,
      sugars: Math.round(clamp(g.sugars + gauss() * g.sd[0], 0, 70) * 10) / 10,
      caffeine: Math.round(clamp(g.caffeine + gauss() * g.sd[1], 0, 220)),
    });
  }
}

/* ── 검증: 실루엣 점수가 가장 높은 k 를 찾는다 ─────────────── */
interface P {
  x: number;
  y: number;
}

function kmeansLabels(points: P[], k: number, seed: number): number[] {
  const r = mulberry32(seed);
  // k-평균++ 없이 단순 무작위 선택. 교과서와 같은 방식이다.
  const centers: P[] = [];
  const used = new Set<number>();
  while (centers.length < k) {
    const i = Math.floor(r() * points.length);
    if (used.has(i)) continue;
    used.add(i);
    centers.push({ ...points[i] });
  }
  let labels = new Array(points.length).fill(0);
  for (let iter = 0; iter < 100; iter++) {
    const next = points.map((p) => {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (p.x - centers[c].x) ** 2 + (p.y - centers[c].y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      return best;
    });
    const changed = next.some((v, i) => v !== labels[i]);
    labels = next;
    for (let c = 0; c < k; c++) {
      const members = points.filter((_, i) => labels[i] === c);
      if (members.length === 0) continue;
      centers[c] = {
        x: members.reduce((a, b) => a + b.x, 0) / members.length,
        y: members.reduce((a, b) => a + b.y, 0) / members.length,
      };
    }
    if (!changed && iter > 0) break;
  }
  return labels;
}

function silhouette(points: P[], labels: number[], k: number): number {
  const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const own = labels[i];
    const groups: number[][] = Array.from({ length: k }, () => []);
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      groups[labels[j]].push(dist(points[i], points[j]));
    }
    const a = groups[own].length === 0 ? 0 : groups[own].reduce((x, y) => x + y, 0) / groups[own].length;
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === own || groups[c].length === 0) continue;
      b = Math.min(b, groups[c].reduce((x, y) => x + y, 0) / groups[c].length);
    }
    if (!Number.isFinite(b)) continue;
    sum += (b - a) / Math.max(a, b);
  }
  return sum / points.length;
}

/** 값의 범위가 다르므로 0~1 로 맞춘 뒤 비교한다 */
function normalize(points: P[]): P[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const nx = { min: Math.min(...xs), max: Math.max(...xs) };
  const ny = { min: Math.min(...ys), max: Math.max(...ys) };
  return points.map((p) => ({
    x: (p.x - nx.min) / (nx.max - nx.min),
    y: (p.y - ny.min) / (ny.max - ny.min),
  }));
}

function bestK(points: P[]): { k: number; score: number; all: [number, number][] } {
  const norm = normalize(points);
  const all: [number, number][] = [];
  for (let k = 2; k <= 8; k++) {
    // 초기 중심점에 따라 결과가 달라지므로 여러 번 해 보고 가장 좋은 값을 쓴다
    let best = -1;
    for (let seed = 1; seed <= 12; seed++) {
      const labels = kmeansLabels(norm, k, seed * 977);
      if (new Set(labels).size < k) continue;
      best = Math.max(best, silhouette(norm, labels, k));
    }
    all.push([k, Math.round(best * 1000) / 1000]);
  }
  const top = all.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { k: top[0], score: top[1], all };
}

console.log('\n교육용 예제 데이터 · 군집');
console.log('─'.repeat(66));
let fail = 0;

const mallPoints: P[] = mall.map((m) => ({ x: m.annual_income, y: m.spending_score }));
const mallBest = bestK(mallPoints);
console.log(`  쇼핑몰 고객 ${mall.length}행`);
console.log(`    k별 실루엣 점수: ${mallBest.all.map(([k, s]) => `k=${k} ${s}`).join(' · ')}`);
if (mallBest.k === 5) console.log(`    통과  가장 높은 k = 5 (교과서 120쪽)`);
else {
  console.log(`    실패  가장 높은 k = ${mallBest.k} (교과서는 5)`);
  fail += 1;
}

const cafePoints: P[] = cafe.map((c) => ({ x: c.sugars, y: c.caffeine }));
const cafeBest = bestK(cafePoints);
console.log(`\n  카페 음료 ${cafe.length}행`);
console.log(`    k별 실루엣 점수: ${cafeBest.all.map(([k, s]) => `k=${k} ${s}`).join(' · ')}`);
if (cafeBest.k === 4) console.log(`    통과  가장 높은 k = 4 (교과서 124쪽)`);
else {
  console.log(`    실패  가장 높은 k = ${cafeBest.k} (교과서는 4)`);
  fail += 1;
}

writeFileSync(resolve(import.meta.dirname, '../mall.json'), JSON.stringify(mall), 'utf-8');
writeFileSync(resolve(import.meta.dirname, '../cafe.json'), JSON.stringify(cafe), 'utf-8');
console.log(`\n  저장: src/data/mall.json, src/data/cafe.json`);
console.log('═'.repeat(66));
console.log(fail === 0 ? '모든 목표값을 만족합니다.' : `${fail}개 항목이 목표에서 벗어났습니다.`);
if (fail > 0) process.exitCode = 1;
