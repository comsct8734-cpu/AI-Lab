/**
 * MVP 2 알고리즘 검증
 * 실행:  npx tsx src/core/verifyData.ts
 *
 * 설계서의 원칙대로, 사람이 종이에 계산해 확인할 수 있는 작은 데이터로 먼저 검증한다.
 * 검증되지 않은 알고리즘은 화면에 연결하지 않는다.
 */
import {
  applyScaler,
  correlation,
  fitScaler,
  handleMissing,
  mean,
  outlierBounds,
  quantile,
  stdev,
  summarize,
  trainTestSplit,
  type Field,
  type Row,
} from './stats';
import { decisionGrid, evaluate, knnClassify, type Point } from './knn';
import penguins from '../data/penguins.json' with { type: 'json' };

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) {
    pass += 1;
    console.log(`  통과  ${name}  →  ${a}`);
  } else {
    fail += 1;
    console.log(`  실패  ${name}\n        기대: ${b}\n        실제: ${a}`);
  }
}

function near(name: string, actual: number, expected: number, tol: number) {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) {
    pass += 1;
    console.log(`  통과  ${name}  →  ${Math.round(actual * 1000) / 1000}`);
  } else {
    fail += 1;
    console.log(`  실패  ${name}\n        기대: ${expected} ± ${tol}\n        실제: ${actual}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
  console.log('─'.repeat(66));
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/* ────────────────────────────────────────────────────────── */
section('1. 기본 통계 — 1, 2, 3, 4, 5 로 손 계산');
{
  const xs = [1, 2, 3, 4, 5];
  check('평균', mean(xs), 3);
  check('중앙값', quantile(xs, 0.5), 3);
  check('Q1', quantile(xs, 0.25), 2);
  check('Q3', quantile(xs, 0.75), 4);
  near('표본표준편차', stdev(xs), 1.5811, 0.0001);
  const s = summarize(xs);
  check('요약의 최솟값·최댓값', [s.min, s.max], [1, 5]);
  check('요약의 개수', s.count, 5);
}

section('2. 상관계수 — 완전히 비례·반비례하는 값');
{
  check('완전 비례', correlation([1, 2, 3], [2, 4, 6]), 1);
  check('완전 반비례', correlation([1, 2, 3], [6, 4, 2]), -1);
  near('관계 없음에 가까움', correlation([1, 2, 3, 4], [3, 1, 4, 2]), 0, 0.45);
}

section('3. 이상치 경계 — 교과서 75쪽 방식');
{
  // 1~9 에 100 하나. 값이 10개이므로 백분위 위치는 (10−1) × p 로 구한다.
  //   Q1 위치 = 9 × 0.25 = 2.25 → 3 과 4 사이 → 3.25
  //   Q3 위치 = 9 × 0.75 = 6.75 → 7 과 8 사이 → 7.75
  //   IQR = 7.75 − 3.25 = 4.5,  위 경계 = 7.75 + 6.75 = 14.5
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
  const b = outlierBounds(xs);
  check('Q1', r3(b.q1), 3.25);
  check('Q3', r3(b.q3), 7.75);
  check('IQR', r3(b.iqr), 4.5);
  check('위 경계 = Q3 + 1.5 × IQR', r3(b.upper), 14.5);
  check('아래 경계 = Q1 − 1.5 × IQR', r3(b.lower), -3.5);
  check('100은 이상치인가', 100 > b.upper, true);
  check('9는 이상치가 아닌가', 9 <= b.upper, true);
}

section('4. 결측치 처리 — 세 가지 방법의 결과가 다른가');
{
  const fields: Field[] = [
    { key: 'a', label: 'a', kind: 'numeric' },
    { key: 'g', label: 'g', kind: 'categorical' },
  ];
  const rows: Row[] = [
    { a: 10, g: 'x' },
    { a: 20, g: 'x' },
    { a: null, g: 'y' },
    { a: 60, g: 'y' },
  ];
  check('그대로 두기', handleMissing(rows, fields, 'keep').length, 4);
  check('행 제거 후 개수', handleMissing(rows, fields, 'drop').length, 3);
  // 평균은 (10+20+60)/3 = 30, 중앙값은 20
  check('평균값으로 대체', handleMissing(rows, fields, 'mean')[2].a, 30);
  check('중앙값으로 대체', handleMissing(rows, fields, 'median')[2].a, 20);
  check('대체하면 개수는 그대로', handleMissing(rows, fields, 'mean').length, 4);
}

section('5. 최소-최대 정규화 — 교과서 76쪽');
{
  const xs = [10, 20, 30, 40, 50];
  const s = fitScaler(xs);
  check('최솟값은 0', applyScaler(10, s), 0);
  check('최댓값은 1', applyScaler(50, s), 1);
  check('가운데 값은 0.5', applyScaler(30, s), 0.5);
  check('모든 값이 0~1 사이', xs.every((x) => applyScaler(x, s) >= 0 && applyScaler(x, s) <= 1), true);
}

section('6. 훈련·테스트 분할 — 교과서 94쪽');
{
  const items = Array.from({ length: 100 }, (_, i) => i);
  const s = trainTestSplit(items, 0.3, 42);
  check('테스트 30개', s.test.length, 30);
  check('훈련 70개', s.train.length, 70);
  check('겹치는 데이터가 없는가', s.train.filter((x) => s.test.includes(x)).length, 0);
  check('합치면 원래 개수', s.train.length + s.test.length, 100);
  const again = trainTestSplit(items, 0.3, 42);
  check('같은 씨앗값이면 같은 결과', again.test, s.test);
  const other = trainTestSplit(items, 0.3, 7);
  check('씨앗값이 다르면 다른 결과', JSON.stringify(other.test) !== JSON.stringify(s.test), true);
}

section('7. 최근접 이웃 — 점 6개, k=3 으로 손 계산');
{
  // A 그룹은 왼쪽 아래, B 그룹은 오른쪽 위
  const train: Point[] = [
    { x: 0, y: 0, label: 'A' },
    { x: 1, y: 0, label: 'A' },
    { x: 0, y: 1, label: 'A' },
    { x: 5, y: 5, label: 'B' },
    { x: 6, y: 5, label: 'B' },
    { x: 5, y: 6, label: 'B' },
  ];
  const near1 = knnClassify(train, { x: 0.5, y: 0.5 }, 3);
  check('왼쪽 아래 점은 A', near1.predicted, 'A');
  check('참고한 이웃은 3개', near1.neighbors.length, 3);
  check('이웃이 모두 A', near1.neighbors.every((n) => n.label === 'A'), true);

  const near2 = knnClassify(train, { x: 5.5, y: 5.5 }, 3);
  check('오른쪽 위 점은 B', near2.predicted, 'B');

  // k=5 로 늘리면 가운데 점은 가까운 쪽 3개가 다수결에서 이긴다
  const mid = knnClassify(train, { x: 2, y: 2 }, 5);
  check('가운데 점 k=5 → A (A쪽 3개가 더 가깝다)', mid.predicted, 'A');

  // k=1 은 가장 가까운 하나만 본다
  const one = knnClassify(train, { x: 4.9, y: 4.9 }, 1);
  check('k=1 은 이웃 하나만', one.neighbors.length, 1);
  check('k=1 결과', one.predicted, 'B');

  // 거리 계산이 실제로 맞는가 — (0,0) 에서 (3,4) 까지
  const d = knnClassify([{ x: 3, y: 4, label: 'A' }], { x: 0, y: 0 }, 1);
  check('유클리디언 거리 (3,4) → 5', d.neighbors[0].distance, 5);
  const dm = knnClassify([{ x: 3, y: 4, label: 'A' }], { x: 0, y: 0 }, 1, 'manhattan');
  check('맨해튼 거리 (3,4) → 7', dm.neighbors[0].distance, 7);
}

section('8. k 값에 따라 결정 영역이 달라지는가');
{
  const train: Point[] = [
    { x: 0, y: 0, label: 'A' },
    { x: 1, y: 1, label: 'A' },
    { x: 2, y: 2, label: 'B' },
    { x: 3, y: 3, label: 'B' },
    { x: 1, y: 3, label: 'B' },
    { x: 3, y: 1, label: 'A' },
  ];
  const bounds = { minX: 0, maxX: 3, minY: 0, maxY: 3 };
  const g1 = decisionGrid(train, 1, 'euclidean', bounds, 12);
  const g5 = decisionGrid(train, 5, 'euclidean', bounds, 12);
  check('격자 칸 수', g1.length, 144);
  check('k=1 과 k=5 의 결정 영역이 다른가', JSON.stringify(g1) !== JSON.stringify(g5), true);
  check('빈 칸이 없는가', g1.every((c) => c !== null), true);
}

section('9. 정규화가 결과를 바꾸는가 — 범위가 크게 다른 두 속성');
{
  // x 는 0~1 범위, y 는 500 안팎. 정규화하지 않으면 y 의 차이가 거리를 지배한다.
  //   원래 값 기준 : A 까지 15.0,  B 까지 5.06  → B 로 판단
  //   정규화 후    : A 까지 0.75,  B 까지 0.97  → A 로 판단
  // 같은 데이터인데 판단이 뒤바뀐다. 이것이 교과서 108쪽이 말하는 정규화의 이유다.
  const raw: Point[] = [
    { x: 0.9, y: 500, label: 'A' },
    { x: 0.1, y: 520, label: 'B' },
  ];
  const target = { x: 0.85, y: 515 };
  const rawResult = knnClassify(raw, target, 1);
  check('정규화 전에는 y 가 거리를 지배해 B', rawResult.predicted, 'B');

  const sx = fitScaler(raw.map((p) => p.x));
  const sy = fitScaler(raw.map((p) => p.y));
  const scaled = raw.map((p) => ({ ...p, x: applyScaler(p.x, sx), y: applyScaler(p.y, sy) }));
  const scaledResult = knnClassify(
    scaled,
    { x: applyScaler(target.x, sx), y: applyScaler(target.y, sy) },
    1,
  );
  check('정규화 후에는 x 도 반영되어 A', scaledResult.predicted, 'A');
}

section('10. 합성 펭귄 데이터 — 교과서 값과 맞는가');
{
  const rows = penguins as Row[];
  check('전체 행 수', rows.length, 344);

  const fields: Field[] = [
    { key: 'species', label: '종', kind: 'categorical' },
    { key: 'island', label: '서식지', kind: 'categorical' },
    { key: 'culmen_length_mm', label: '부리 길이', kind: 'numeric' },
    { key: 'culmen_depth_mm', label: '부리 깊이', kind: 'numeric' },
    { key: 'flipper_length_mm', label: '날개 길이', kind: 'numeric' },
    { key: 'body_mass_g', label: '체질량', kind: 'numeric' },
    { key: 'sex', label: '성별', kind: 'categorical' },
  ];

  const dropped = handleMissing(rows, fields, 'drop');
  check('결측치 제거 후 (교과서 80쪽)', dropped.length, 334);

  const cleaned = dropped.filter((r) => r.sex !== '.');
  check("성별 '.' 제거 후 (교과서 81쪽)", cleaned.length, 333);

  const counts = (label: string) => rows.filter((r) => r.species === label).length;
  check('종별 개수', [counts('Adelie'), counts('Chinstrap'), counts('Gentoo')], [152, 68, 124]);

  const num = (key: string) =>
    rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number');
  near('부리 길이 평균 (교과서 43.92)', mean(num('culmen_length_mm')), 43.92, 0.6);
  near('부리 깊이 평균 (교과서 17.15)', mean(num('culmen_depth_mm')), 17.15, 0.4);
  near('날개 길이 평균 (교과서 200.92)', mean(num('flipper_length_mm')), 200.92, 1.5);
  near('체질량 평균 (교과서 4201.75)', mean(num('body_mass_g')), 4201.75, 90);
  near(
    '날개 길이 ↔ 체질량 상관 (교과서 0.87)',
    correlation(
      cleaned.map((r) => r.flipper_length_mm as number),
      cleaned.map((r) => r.body_mass_g as number),
    ),
    0.87,
    0.06,
  );

  // 체질량 이상치 (교과서 75쪽 그림 Ⅱ-17)
  // 전체를 한 덩어리로 보면 젠투가 원래 무거워서 이상치가 잡히지 않는다.
  // 종별로 나누어 상자그림을 그려야 발견된다. 화면도 종별 상자그림으로 만든다.
  const allMass = cleaned.map((r) => r.body_mass_g as number);
  check('전체를 한 덩어리로 보면 이상치가 없다', (() => {
    const b = outlierBounds(allMass);
    return allMass.filter((m) => m > b.upper || m < b.lower).length;
  })(), 0);

  const chinstrapMass = cleaned
    .filter((r) => r.species === 'Chinstrap')
    .map((r) => r.body_mass_g as number);
  const cb = outlierBounds(chinstrapMass);
  const chinstrapOutliers = chinstrapMass.filter((m) => m > cb.upper || m < cb.lower);
  check('턱끈펭귄만 보면 이상치가 보인다', chinstrapOutliers.length, 2);
}

section('11. 펭귄 데이터로 최근접 이웃이 실제로 동작하는가');
{
  const rows = (penguins as Row[]).filter(
    (r) =>
      typeof r.culmen_length_mm === 'number' &&
      typeof r.culmen_depth_mm === 'number' &&
      r.sex !== '.',
  );
  const points: Point[] = rows.map((r, i) => ({
    x: r.culmen_length_mm as number,
    y: r.culmen_depth_mm as number,
    label: r.species as string,
    index: i,
  }));

  const split = trainTestSplit(points, 0.3, 42);
  const ev = evaluate(split.train, split.test, 5, 'euclidean');
  check('테스트 데이터 개수', ev.total, split.test.length);
  near('부리 길이 + 부리 깊이 조합의 정확도 (교과서 82쪽)', ev.accuracy, 0.94, 0.08);
  check('맞힌 수 + 틀린 수 = 전체', ev.correct + ev.wrong.length, ev.total);

  // 교과서 82쪽: 부리 깊이 + 날개 길이 조합은 종 구분이 덜 된다
  const worse: Point[] = rows.map((r) => ({
    x: r.culmen_depth_mm as number,
    y: r.flipper_length_mm as number,
    label: r.species as string,
  }));
  const s2 = trainTestSplit(worse, 0.3, 42);
  const ev2 = evaluate(s2.train, s2.test, 5, 'euclidean');
  check('부리 길이 조합이 더 정확한가 (교과서 82쪽)', ev.accuracy > ev2.accuracy, true);
  console.log(
    `        참고 · 부리 길이+깊이 ${(ev.accuracy * 100).toFixed(1)}%  vs  부리 깊이+날개 길이 ${(ev2.accuracy * 100).toFixed(1)}%`,
  );
}

console.log(`\n${'═'.repeat(66)}`);
console.log(`통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(66));
if (fail > 0) process.exitCode = 1;
