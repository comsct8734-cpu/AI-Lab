/**
 * MVP 5 알고리즘 검증
 * 실행:  npx tsx src/core/verifyCluster.ts
 */
import {
  collectKMeans,
  pickInitialCenters,
  silhouetteScore,
  silhouetteValues,
  type ClusterPoint,
} from './kmeans';
import { applyScaler, fitScaler } from './stats';
import mall from '../data/mall.json' with { type: 'json' };
import cafe from '../data/cafe.json' with { type: 'json' };

let pass = 0;
let fail = 0;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

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
  if (Math.abs(actual - expected) <= tol) {
    pass += 1;
    console.log(`  통과  ${name}  →  ${r3(actual)}`);
  } else {
    fail += 1;
    console.log(`  실패  ${name}\n        기대: ${expected} ± ${tol}\n        실제: ${actual}`);
  }
}
function section(t: string) {
  console.log(`\n${t}`);
  console.log('─'.repeat(66));
}

const pts = (arr: [number, number][]): ClusterPoint[] =>
  arr.map(([x, y], index) => ({ x, y, index }));

/* ────────────────────────────────────────────────────────── */
section('1. 두 덩어리, k = 2 — 손으로 검산할 수 있는 예');
{
  // 왼쪽 아래에 3개, 오른쪽 위에 3개
  const points = pts([
    [0, 0],
    [1, 0],
    [0, 1],
    [10, 10],
    [11, 10],
    [10, 11],
  ]);
  const { steps, result } = collectKMeans(points, { k: 2, seed: 7 });

  check('결과가 안정되었는가', result.converged, true);
  check('군집이 2개', new Set(result.labels).size, 2);
  check('왼쪽 세 개가 같은 군집', new Set(result.labels.slice(0, 3)).size, 1);
  check('오른쪽 세 개가 같은 군집', new Set(result.labels.slice(3)).size, 1);
  check('두 무리가 서로 다른 군집', result.labels[0] !== result.labels[3], true);

  // 중심점은 각 무리의 평균 자리에 놓인다. (0+1+0)/3 = 0.333
  const left = result.centers[result.labels[0]];
  near('왼쪽 중심의 x', left.x, 1 / 3, 0.001);
  near('왼쪽 중심의 y', left.y, 1 / 3, 0.001);

  check('첫 단계는 초기 중심점 선택', steps[0].phase, 'init');
  check('두 번째 단계는 배정', steps[1].phase, 'assign');
  check('세 번째 단계는 중심 이동', steps[2].phase, 'update');
  check('마지막 단계는 종료', steps[steps.length - 1].phase, 'done');
  check('단계 번호가 순서대로', steps.map((s) => s.index), steps.map((_, i) => i + 1));
}

section('2. 교과서 119쪽의 여섯 단계가 실제로 나타나는가');
{
  const points = pts([
    [0, 0],
    [1, 1],
    [8, 8],
    [9, 9],
    [0, 9],
    [1, 8],
  ]);
  const { steps } = collectKMeans(points, { k: 3, seed: 3 });
  const phases = steps.map((s) => s.phase);
  check('초기 중심점 선택이 한 번', phases.filter((p) => p === 'init').length, 1);
  check('배정과 이동이 번갈아 나오는가',
    phases.slice(1, -1).every((p, i) => (i % 2 === 0 ? p === 'assign' : p === 'update')), true);
  check('배정 전에는 소속이 없다', steps[0].labels.every((l) => l === -1), true);
  check('배정 후에는 모두 소속이 있다', steps[1].labels.every((l) => l >= 0), true);
  check('중심점의 이동 경로가 쌓이는가', steps[steps.length - 1].centers[0].trail.length > 1, true);
}

section('3. 초기 중심점이 다르면 결과가 달라질 수 있다 (교과서 119쪽)');
{
  // 일부러 애매하게 늘어놓아 시작 자리에 따라 갈리게 만든다
  const points = pts([
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
    [5, 0],
    [6, 0],
    [7, 0],
  ]);
  const results = [1, 2, 3, 4, 5, 6, 7, 8].map(
    (seed) => collectKMeans(points, { k: 3, seed: seed * 131 }).result,
  );
  const shapes = results.map((r) => {
    // 군집 번호는 달라도 '어떻게 묶였는지'가 같으면 같은 결과로 본다
    const groups = new Map<number, number[]>();
    r.labels.forEach((l, i) => groups.set(l, [...(groups.get(l) ?? []), i]));
    return JSON.stringify([...groups.values()].map((g) => g.sort()).sort());
  });
  check('시작 자리에 따라 다른 결과가 나오는가', new Set(shapes).size > 1, true);
  console.log(`        참고 · 8번 실행해 서로 다른 묶음이 ${new Set(shapes).size}가지 나왔습니다`);

  check('같은 씨앗값이면 항상 같은 결과',
    JSON.stringify(collectKMeans(points, { k: 3, seed: 99 }).result.labels),
    JSON.stringify(collectKMeans(points, { k: 3, seed: 99 }).result.labels));
}

section('4. 초기 중심점은 데이터 중에서 고른다 (교과서 STEP 1)');
{
  const points = pts([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
  ]);
  const centers = pickInitialCenters(points, 3, 11);
  check('개수', centers.length, 3);
  check('모두 데이터 위에 있는가',
    centers.every((c) => points.some((p) => p.x === c.x && p.y === c.y)), true);
  check('서로 다른 자리인가', new Set(centers.map((c) => `${c.x},${c.y}`)).size, 3);
  check('k 가 데이터 수보다 크면 데이터 수만큼만', pickInitialCenters(points, 10, 5).length, 4);
}

section('5. 실루엣 점수 — 손으로 검산');
{
  // 완전히 갈라진 두 덩어리는 1 에 가깝다
  const clear = pts([
    [0, 0],
    [0, 1],
    [100, 0],
    [100, 1],
  ]);
  const clearScore = silhouetteScore(clear, [0, 0, 1, 1], 2);
  check('뚜렷하게 나뉘면 1 에 가까운가', clearScore > 0.95, true);

  // 한 덩어리를 억지로 둘로 나누면 0 에 가깝거나 음수가 된다
  const mixed = pts([
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  const mixedScore = silhouetteScore(mixed, [0, 1, 0, 1], 2);
  check('억지로 나누면 점수가 낮은가', mixedScore < 0.2, true);
  console.log(`        참고 · 뚜렷 ${r3(clearScore)}  vs  억지 ${r3(mixedScore)}`);

  check('데이터마다 값이 하나씩', silhouetteValues(clear, [0, 0, 1, 1], 2).length, 4);
  check('모든 값이 −1 과 1 사이',
    silhouetteValues(mixed, [0, 1, 0, 1], 2).every((v) => v >= -1 && v <= 1), true);
}

section('6. 쇼핑몰 고객 — k = 5 가 가장 좋은가 (교과서 120~123쪽)');
{
  const rows = mall as { annual_income: number; spending_score: number }[];
  check('행 수', rows.length, 200);

  // 값의 범위가 다르므로 0~1 로 맞춘 뒤 비교한다
  const sx = fitScaler(rows.map((r) => r.annual_income));
  const sy = fitScaler(rows.map((r) => r.spending_score));
  const points: ClusterPoint[] = rows.map((r, index) => ({
    x: applyScaler(r.annual_income, sx),
    y: applyScaler(r.spending_score, sy),
    index,
  }));

  const scores: [number, number][] = [];
  for (let k = 2; k <= 8; k++) {
    let best = -1;
    for (let seed = 1; seed <= 12; seed++) {
      const { result } = collectKMeans(points, { k, seed: seed * 977 });
      if (new Set(result.labels).size < k) continue;
      best = Math.max(best, silhouetteScore(points, result.labels, k));
    }
    scores.push([k, r3(best)]);
  }
  const top = scores.reduce((a, b) => (b[1] > a[1] ? b : a));
  check('실루엣 점수가 가장 높은 k', top[0], 5);
  console.log(`        참고 · ${scores.map(([k, s]) => `k=${k} ${s}`).join(' · ')}`);

  const { result } = collectKMeans(points, { k: 5, seed: 977 });
  check('다섯 군집이 모두 비어 있지 않은가', new Set(result.labels).size, 5);
  check('반복 횟수가 적당한가', result.rounds > 0 && result.rounds < 40, true);
}

section('7. 카페 음료 — k = 4 가 가장 좋은가 (교과서 124쪽)');
{
  const rows = cafe as { sugars: number; caffeine: number }[];
  check('행 수', rows.length, 60);
  const sx = fitScaler(rows.map((r) => r.sugars));
  const sy = fitScaler(rows.map((r) => r.caffeine));
  const points: ClusterPoint[] = rows.map((r, index) => ({
    x: applyScaler(r.sugars, sx),
    y: applyScaler(r.caffeine, sy),
    index,
  }));

  const scores: [number, number][] = [];
  for (let k = 2; k <= 8; k++) {
    let best = -1;
    for (let seed = 1; seed <= 12; seed++) {
      const { result } = collectKMeans(points, { k, seed: seed * 977 });
      if (new Set(result.labels).size < k) continue;
      best = Math.max(best, silhouetteScore(points, result.labels, k));
    }
    scores.push([k, r3(best)]);
  }
  const top = scores.reduce((a, b) => (b[1] > a[1] ? b : a));
  check('실루엣 점수가 가장 높은 k', top[0], 4);
  console.log(`        참고 · ${scores.map(([k, s]) => `k=${k} ${s}`).join(' · ')}`);
}

section('8. 정규화 여부에 따라 군집 결과가 달라진다');
{
  // 가로는 0~1, 세로는 0~1000 범위. 정규화하지 않으면 세로가 거리를 지배한다.
  const rowsRaw = pts([
    [0.1, 100],
    [0.9, 120],
    [0.1, 900],
    [0.9, 920],
  ]);
  const rawLabels = collectKMeans(rowsRaw, { k: 2, seed: 5 }).result.labels;

  const sx = fitScaler(rowsRaw.map((p) => p.x));
  const sy = fitScaler(rowsRaw.map((p) => p.y));
  const scaled = rowsRaw.map((p) => ({
    x: applyScaler(p.x, sx),
    y: applyScaler(p.y, sy),
    index: p.index,
  }));
  const scaledLabels = collectKMeans(scaled, { k: 2, seed: 5 }).result.labels;

  // 정규화 전에는 세로(위아래)로 나뉜다
  check('정규화 전에는 위아래로 나뉘는가', rawLabels[0] === rawLabels[1] && rawLabels[0] !== rawLabels[2], true);
  check('정규화 후에도 결과가 나오는가', new Set(scaledLabels).size, 2);
}

console.log(`\n${'═'.repeat(66)}`);
console.log(`통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(66));
if (fail > 0) process.exitCode = 1;
