/**
 * 교육용 예제 데이터 생성 — 펭귄
 * 실행:  npx tsx src/data/generate/penguins.ts
 *
 * 교과서의 원본 데이터를 복제하지 않고, 같은 속성 이름·단위·통계 특성을
 * 재현하는 데이터를 새로 만든다. 화면에는 '교육용 예제 데이터'로 표시한다.
 *
 * 맞추어야 할 값 (교과서 인쇄 73쪽 표 Ⅱ-4, 79~83쪽)
 *   전체 344행 / 종별 152 · 68 · 124            (80쪽)
 *   부리 길이  평균 43.92  표준편차 5.46          (73쪽)
 *   부리 깊이  평균 17.15  표준편차 1.97
 *   날개 길이  평균 200.92 표준편차 14.06
 *   체질량     평균 4201.75 표준편차 801.95
 *   날개 길이와 체질량의 상관계수 약 0.87         (83쪽)
 *   결측치 10행 → 제거하면 334행                  (80쪽)
 *   sex 값에 '.' 이상치 1행 → 제거하면 333행      (81쪽)
 *
 * 고정된 씨앗값을 쓰기 때문에 몇 번을 실행해도 같은 데이터가 나온다.
 * 학생마다 통계값이 달라지면 교사용 발문의 예상 답도 흔들리기 때문이다.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** 씨앗값이 같으면 항상 같은 수열이 나오는 난수 생성기 */
function mulberry32(seed: number) {
  return function random(): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260816);

/** 표준정규분포를 따르는 난수 (박스-뮐러 변환) */
function gauss(): number {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function round(x: number, digits: number): number {
  const p = 10 ** digits;
  return Math.round(x * p) / p;
}

interface SpeciesSpec {
  species: string;
  n: number;
  islands: { name: string; weight: number }[];
  length: [number, number]; // 부리 길이 평균, 표준편차
  depth: [number, number];
  flipper: [number, number];
  mass: [number, number];
}

/**
 * 종별 분포.
 * 교과서 82쪽에서 '부리 길이 + 부리 깊이' 조합으로 세 종이 구분되는 것을
 * 학생이 발견하도록, 젠투의 부리 깊이를 뚜렷하게 낮게 둔다.
 */
const SPECS: SpeciesSpec[] = [
  {
    species: 'Adelie',
    n: 152,
    islands: [
      { name: 'Biscoe', weight: 0.29 },
      { name: 'Dream', weight: 0.37 },
      { name: 'Torgersen', weight: 0.34 },
    ],
    length: [38.8, 2.95],
    depth: [18.35, 1.22],
    flipper: [189.95, 6.54],
    mass: [3700, 458],
  },
  {
    species: 'Chinstrap',
    n: 68,
    islands: [{ name: 'Dream', weight: 1 }],
    length: [48.83, 3.6],
    depth: [18.42, 1.14],
    flipper: [195.82, 7.13],
    mass: [3733, 384],
  },
  {
    species: 'Gentoo',
    n: 124,
    islands: [{ name: 'Biscoe', weight: 1 }],
    length: [47.5, 3.45],
    depth: [14.98, 0.98],
    flipper: [217.19, 6.48],
    mass: [5076, 504],
  },
];

export interface Penguin {
  species: string;
  island: string;
  culmen_length_mm: number | null;
  culmen_depth_mm: number | null;
  flipper_length_mm: number | null;
  body_mass_g: number | null;
  sex: string | null;
}

function pickIsland(spec: SpeciesSpec): string {
  const r = rand();
  let acc = 0;
  for (const isl of spec.islands) {
    acc += isl.weight;
    if (r <= acc) return isl.name;
  }
  return spec.islands[spec.islands.length - 1].name;
}

const rows: Penguin[] = [];

for (const spec of SPECS) {
  for (let i = 0; i < spec.n; i++) {
    // 개체의 '전체적인 크기'를 하나의 잠재 변수로 두고,
    // 날개 길이와 체질량이 이 값을 함께 따르게 해서 상관관계를 만든다.
    const size = gauss();
    const male = rand() < 0.5;
    // 수컷이 조금 더 크다. 성별에 따른 차이도 데이터에 남긴다.
    const sexShift = male ? 0.45 : -0.45;

    const flipper = spec.flipper[0] + spec.flipper[1] * (0.86 * size + 0.32 * gauss() + 0.3 * sexShift);
    // 체질량은 날개 길이와 같은 잠재 변수를 덜 공유하게 해서
    // 상관계수가 교과서의 0.87 수준이 되도록 맞춘다. 너무 높으면 산점도가 직선이 되어
    // '상관이 있다'는 개념을 관찰하기에 오히려 부자연스럽다.
    const mass = spec.mass[0] + spec.mass[1] * (0.72 * size + 0.62 * gauss() + 0.5 * sexShift);
    const length = spec.length[0] + spec.length[1] * (0.45 * size + 0.83 * gauss() + 0.4 * sexShift);
    const depth = spec.depth[0] + spec.depth[1] * (0.3 * size + 0.9 * gauss() + 0.5 * sexShift);

    rows.push({
      species: spec.species,
      island: pickIsland(spec),
      culmen_length_mm: round(length, 1),
      culmen_depth_mm: round(depth, 1),
      flipper_length_mm: Math.round(flipper),
      body_mass_g: Math.round(mass / 25) * 25,
      sex: male ? 'MALE' : 'FEMALE',
    });
  }
}

/* ── 상자그림에서 보이는 체질량 이상치 (교과서 75쪽 그림 Ⅱ-17) ─────────── */
// 턱끈펭귄 두 마리에 무거운 값을 넣는다. 학생이 상자그림에서 점으로 발견한다.
const chinstrapIdx = rows
  .map((r, i) => ({ r, i }))
  .filter(({ r }) => r.species === 'Chinstrap')
  .map(({ i }) => i);
rows[chinstrapIdx[7]].body_mass_g = 5750;
rows[chinstrapIdx[31]].body_mass_g = 5525;

/* ── 결측치 10행 (교과서 80쪽: 제거하면 334행) ────────────────────────── */
// 어떤 행이 비는지도 교과서와 같게: 측정값 전체가 빈 행 2개 + 성별만 빈 행 8개
const missingAll = [3, 271];
const missingSex = [8, 47, 96, 130, 178, 219, 286, 324];
for (const i of missingAll) {
  rows[i].culmen_length_mm = null;
  rows[i].culmen_depth_mm = null;
  rows[i].flipper_length_mm = null;
  rows[i].body_mass_g = null;
  rows[i].sex = null;
}
for (const i of missingSex) rows[i].sex = null;

/* ── 성별 칸의 이상치 (교과서 81쪽: 제거하면 333행) ───────────────────── */
rows[336].sex = '.';

/* ── 검증 ──────────────────────────────────────────────────────────── */
const nums = (key: keyof Penguin) =>
  rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number');

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  // 교과서의 describe() 와 같은 표본표준편차
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const corr = (a: number[], b: number[]) => {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
};

const complete = rows.filter(
  (r) =>
    r.culmen_length_mm !== null &&
    r.culmen_depth_mm !== null &&
    r.flipper_length_mm !== null &&
    r.body_mass_g !== null,
);

const targets: [string, number, number, number][] = [
  // 이름, 실제값, 교과서 값, 허용 오차
  ['전체 행 수', rows.length, 344, 0],
  ['아델리', rows.filter((r) => r.species === 'Adelie').length, 152, 0],
  ['턱끈', rows.filter((r) => r.species === 'Chinstrap').length, 68, 0],
  ['젠투', rows.filter((r) => r.species === 'Gentoo').length, 124, 0],
  ['결측치 제거 후', rows.filter((r) => Object.values(r).every((v) => v !== null)).length, 334, 0],
  ['부리 길이 평균', round(mean(nums('culmen_length_mm')), 2), 43.92, 0.6],
  ['부리 길이 표준편차', round(sd(nums('culmen_length_mm')), 2), 5.46, 0.6],
  ['부리 깊이 평균', round(mean(nums('culmen_depth_mm')), 2), 17.15, 0.4],
  ['부리 깊이 표준편차', round(sd(nums('culmen_depth_mm')), 2), 1.97, 0.4],
  ['날개 길이 평균', round(mean(nums('flipper_length_mm')), 2), 200.92, 1.5],
  ['날개 길이 표준편차', round(sd(nums('flipper_length_mm')), 2), 14.06, 1.5],
  ['체질량 평균', round(mean(nums('body_mass_g')), 2), 4201.75, 90],
  ['체질량 표준편차', round(sd(nums('body_mass_g')), 2), 801.95, 90],
  [
    '날개 길이 ↔ 체질량 상관',
    round(
      corr(
        complete.map((r) => r.flipper_length_mm as number),
        complete.map((r) => r.body_mass_g as number),
      ),
      2,
    ),
    0.87,
    0.06,
  ],
];

console.log('\n교육용 예제 데이터 · 펭귄');
console.log('─'.repeat(66));
let fail = 0;
for (const [name, actual, expected, tol] of targets) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) fail += 1;
  console.log(
    `  ${ok ? '통과' : '실패'}  ${name.padEnd(22, ' ')} ${String(actual).padStart(9)}  (교과서 ${expected})`,
  );
}

const missingCount = rows.filter((r) => Object.values(r).some((v) => v === null)).length;
const dotRow = rows.filter((r) => r.sex === '.').length;
console.log(`\n  결측치가 있는 행 ${missingCount}개 · 성별이 '.' 인 행 ${dotRow}개`);
console.log(
  `  전처리 후 최종 ${rows.filter((r) => Object.values(r).every((v) => v !== null) && r.sex !== '.').length}행 (교과서 333)`,
);

const out = resolve(import.meta.dirname, '../penguins.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(rows), 'utf-8');
console.log(`\n  저장: ${out}`);
console.log('═'.repeat(66));
console.log(fail === 0 ? '모든 목표값을 만족합니다.' : `${fail}개 항목이 목표에서 벗어났습니다.`);
if (fail > 0) process.exitCode = 1;
