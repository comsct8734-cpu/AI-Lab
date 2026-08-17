/**
 * k-평균 군집화
 * 교과서 Ⅱ-02 인쇄 118~123쪽
 *
 * 교과서 119쪽 그림의 여섯 단계를 그대로 한 단계씩 볼 수 있어야 하므로,
 * MVP 1 의 탐색 실험실과 같은 방식으로 제너레이터로 만들었다.
 * StepController(한 단계 실행 / 자동 실행 / 되돌리기)를 그대로 재사용한다.
 *
 * 정답이 없는 학습이라는 점이 이 실험의 핵심이다.
 * 그래서 초기 중심점을 어떻게 뽑느냐에 따라 결과가 달라지는 것을 숨기지 않고 보여 준다.
 */

export interface ClusterPoint {
  x: number;
  y: number;
  /** 원본 데이터에서 몇 번째 행인지 */
  index: number;
}

export interface Center {
  x: number;
  y: number;
  /** 지금까지 지나온 자리. 중심점의 이동 경로를 잔상으로 그린다. */
  trail: { x: number; y: number }[];
}

export interface KMeansStep {
  index: number;
  /**
   * init   : 초기 중심점을 골랐다            (교과서 STEP 1)
   * assign : 각 데이터를 가까운 중심에 배정했다 (STEP 2 · 5)
   * update : 각 군집의 새 중심을 계산해 옮겼다  (STEP 3 · 4)
   * done   : 더 이상 바뀌지 않아 멈추었다       (STEP 6)
   */
  phase: 'init' | 'assign' | 'update' | 'done';
  /** 몇 번째 반복인지 */
  round: number;
  centers: Center[];
  /** 각 데이터가 속한 군집 번호. 아직 배정 전이면 -1 */
  labels: number[];
  /** 이번 단계에서 배정이 바뀐 데이터 수 */
  changed: number;
  /** 중심점이 움직인 거리의 합 */
  moved: number;
  message: string;
  done: boolean;
}

export interface KMeansResult {
  centers: Center[];
  labels: number[];
  rounds: number;
  /** 군집 안의 데이터가 중심에서 떨어진 정도의 합. 작을수록 뭉쳐 있다. */
  inertia: number;
  converged: boolean;
}

function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** 씨앗값이 같으면 항상 같은 순서가 나오는 난수 */
function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 데이터 중에서 k 개를 골라 초기 중심점으로 삼는다 (교과서 STEP 1) */
export function pickInitialCenters(points: ClusterPoint[], k: number, seed: number): Center[] {
  const next = rng(seed);
  const chosen = new Set<number>();
  const centers: Center[] = [];
  let guard = 0;
  while (centers.length < Math.min(k, points.length) && guard < 10000) {
    guard += 1;
    const i = Math.floor(next() * points.length);
    if (chosen.has(i)) continue;
    chosen.add(i);
    centers.push({ x: points[i].x, y: points[i].y, trail: [{ x: points[i].x, y: points[i].y }] });
  }
  return centers;
}

function assignAll(points: ClusterPoint[], centers: Center[]): number[] {
  return points.map((p) => {
    let best = 0;
    let bestD = Infinity;
    for (let c = 0; c < centers.length; c++) {
      const d = distance(p.x, p.y, centers[c].x, centers[c].y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  });
}

export interface KMeansOptions {
  k: number;
  seed: number;
  /** 안전장치. 이 횟수를 넘으면 멈춘다. */
  maxRounds?: number;
}

/**
 * 한 단계씩 실행한다.
 * 배정(assign)과 중심 이동(update)을 번갈아 yield 하므로,
 * 학생이 [한 단계 실행]을 누를 때마다 교과서 그림의 한 칸씩 넘어간다.
 */
export function* runKMeans(
  points: ClusterPoint[],
  options: KMeansOptions,
): Generator<KMeansStep, KMeansResult, void> {
  const maxRounds = options.maxRounds ?? 40;
  const centers = pickInitialCenters(points, options.k, options.seed);
  let labels: number[] = new Array(points.length).fill(-1);
  let stepIndex = 0;
  let round = 0;

  const snapshot = (
    phase: KMeansStep['phase'],
    changed: number,
    moved: number,
    message: string,
    done = false,
  ): KMeansStep => ({
    index: ++stepIndex,
    phase,
    round,
    centers: centers.map((c) => ({ x: c.x, y: c.y, trail: [...c.trail] })),
    labels: [...labels],
    changed,
    moved,
    message,
    done,
  });

  yield snapshot(
    'init',
    0,
    0,
    `데이터 중에서 ${centers.length}개를 골라 처음 중심점으로 삼았습니다. 아직 아무 데이터도 배정하지 않았습니다.`,
  );

  const inertiaOf = () =>
    points.reduce(
      (sum, p, i) =>
        labels[i] < 0 ? sum : sum + distance(p.x, p.y, centers[labels[i]].x, centers[labels[i]].y) ** 2,
      0,
    );

  while (round < maxRounds) {
    round += 1;

    // ── 배정 (교과서 STEP 2 · 5)
    const next = assignAll(points, centers);
    const changed = next.filter((v, i) => v !== labels[i]).length;
    labels = next;
    yield snapshot(
      'assign',
      changed,
      0,
      round === 1
        ? '각 데이터를 가장 가까운 중심점에 배정했습니다.'
        : `각 데이터를 다시 배정했습니다. 이번에 군집이 바뀐 데이터는 ${changed}개입니다.`,
    );

    // ── 중심 계산과 이동 (교과서 STEP 3 · 4)
    let moved = 0;
    for (let c = 0; c < centers.length; c++) {
      const members = points.filter((_, i) => labels[i] === c);
      if (members.length === 0) continue; // 빈 군집은 그 자리에 둔다
      const nx = members.reduce((a, b) => a + b.x, 0) / members.length;
      const ny = members.reduce((a, b) => a + b.y, 0) / members.length;
      moved += distance(centers[c].x, centers[c].y, nx, ny);
      centers[c].x = nx;
      centers[c].y = ny;
      centers[c].trail.push({ x: nx, y: ny });
    }

    const settled = changed === 0 && moved < 1e-9;
    yield snapshot(
      'update',
      changed,
      moved,
      settled
        ? '중심점이 더 이상 움직이지 않습니다.'
        : '각 군집에 속한 데이터의 평균 자리로 중심점을 옮겼습니다.',
    );

    if (settled) {
      yield snapshot('done', 0, 0, `${round}번 반복한 뒤 결과가 더 이상 바뀌지 않아 멈추었습니다.`, true);
      return { centers, labels, rounds: round, inertia: inertiaOf(), converged: true };
    }
  }

  yield snapshot('done', 0, 0, `${maxRounds}번 반복해도 결과가 안정되지 않아 멈추었습니다.`, true);
  return { centers, labels, rounds: round, inertia: inertiaOf(), converged: false };
}

/** 모든 단계를 미리 계산해 둔다. 되돌리기는 배열의 인덱스를 줄이면 된다. */
export function collectKMeans(
  points: ClusterPoint[],
  options: KMeansOptions,
): { steps: KMeansStep[]; result: KMeansResult } {
  const steps: KMeansStep[] = [];
  const it = runKMeans(points, options);
  let next = it.next();
  while (!next.done) {
    steps.push(next.value);
    next = it.next();
  }
  return { steps, result: next.value };
}

/* ── 실루엣 점수 (교과서 123쪽) ────────────────────────────── */

/**
 * 한 데이터의 실루엣 값
 *   a = 같은 군집에 있는 다른 데이터까지의 평균 거리 (군집 안의 유사성)
 *   b = 가장 가까운 다른 군집까지의 평균 거리        (군집 사이의 상이성)
 *   s = (b − a) / 둘 중 큰 값
 * 1 에 가까울수록 잘 나뉜 것이고, 0 에 가까우면 경계에 걸쳐 있다는 뜻이다.
 */
export function silhouetteValues(points: ClusterPoint[], labels: number[], k: number): number[] {
  return points.map((p, i) => {
    const sums = new Array(k).fill(0);
    const counts = new Array(k).fill(0);
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const c = labels[j];
      if (c < 0) continue;
      sums[c] += distance(p.x, p.y, points[j].x, points[j].y);
      counts[c] += 1;
    }
    const own = labels[i];
    if (own < 0 || counts[own] === 0) return 0;
    const a = sums[own] / counts[own];
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === own || counts[c] === 0) continue;
      b = Math.min(b, sums[c] / counts[c]);
    }
    if (!Number.isFinite(b)) return 0;
    return (b - a) / Math.max(a, b);
  });
}

export function silhouetteScore(points: ClusterPoint[], labels: number[], k: number): number {
  const values = silhouetteValues(points, labels, k);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
