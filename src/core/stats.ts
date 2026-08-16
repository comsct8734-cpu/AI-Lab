/**
 * 통계와 전처리
 * 교과서 Ⅱ-01 데이터 탐색과 전처리 (인쇄 72~81쪽)
 *
 * 교과서의 describe(), 상자그림, 상관계수, 최소-최대 정규화에 해당하는 계산을
 * 브라우저에서 직접 수행한다. 결과만 보여 주는 것이 아니라 과정을 화면에
 * 드러내야 하므로 라이브러리를 쓰지 않았다.
 */

export type Value = number | string | null;
export type Row = Record<string, Value>;

/** 속성의 종류 (교과서 67~68쪽) */
export type FieldKind = 'numeric' | 'categorical';

export interface Field {
  key: string;
  /** 학생에게 보여 줄 이름 */
  label: string;
  kind: FieldKind;
  unit?: string;
}

/* ── 기본 통계 ─────────────────────────────────────────────── */

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** 표본표준편차. 교과서의 describe() 와 같은 방식이다. */
export function stdev(xs: number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/**
 * 백분위수. 교과서의 describe() 및 상자그림과 같은 방식(선형 보간)으로 계산한다.
 * p 는 0~1.
 */
export function quantile(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface Summary {
  count: number;
  mean: number;
  std: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

/** 교과서 73쪽의 describe() 에 해당한다 */
export function summarize(xs: number[]): Summary {
  return {
    count: xs.length,
    mean: mean(xs),
    std: stdev(xs),
    min: Math.min(...xs),
    q1: quantile(xs, 0.25),
    median: quantile(xs, 0.5),
    q3: quantile(xs, 0.75),
    max: Math.max(...xs),
  };
}

/** 피어슨 상관계수. −1 ~ 1 (교과서 77·83쪽) */
export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return NaN;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? NaN : num / den;
}

/* ── 이상치 ────────────────────────────────────────────────── */

export interface OutlierBounds {
  q1: number;
  q3: number;
  iqr: number;
  lower: number;
  upper: number;
}

/**
 * 상자그림의 수염 범위 (교과서 75쪽)
 *   아래 경계 = Q1 − 1.5 × IQR
 *   위  경계 = Q3 + 1.5 × IQR
 * 이 범위를 벗어난 값을 이상치로 본다.
 */
export function outlierBounds(xs: number[]): OutlierBounds {
  const q1 = quantile(xs, 0.25);
  const q3 = quantile(xs, 0.75);
  const iqr = q3 - q1;
  return { q1, q3, iqr, lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

export function isOutlier(x: number, b: OutlierBounds): boolean {
  return x < b.lower || x > b.upper;
}

/* ── 결측치 ────────────────────────────────────────────────── */

export type MissingStrategy = 'keep' | 'drop' | 'mean' | 'median';

export const MISSING_LABEL: Record<MissingStrategy, string> = {
  keep: '그대로 두기',
  drop: '해당 행 제거',
  mean: '평균값으로 대체',
  median: '중앙값으로 대체',
};

export function hasMissing(row: Row, keys: string[]): boolean {
  return keys.some((k) => row[k] === null || row[k] === undefined || row[k] === '');
}

/**
 * 결측치 처리 (교과서 74·80쪽)
 * 범주형 속성은 평균·중앙값을 구할 수 없으므로, 그 경우에는 행을 제거한다.
 */
export function handleMissing(
  rows: Row[],
  fields: Field[],
  strategy: MissingStrategy,
): Row[] {
  const keys = fields.map((f) => f.key);
  if (strategy === 'keep') return rows;
  if (strategy === 'drop') return rows.filter((r) => !hasMissing(r, keys));

  const numericFields = fields.filter((f) => f.kind === 'numeric');
  const fill = new Map<string, number>();
  for (const f of numericFields) {
    const xs = rows
      .map((r) => r[f.key])
      .filter((v): v is number => typeof v === 'number');
    fill.set(f.key, strategy === 'mean' ? mean(xs) : quantile(xs, 0.5));
  }

  // 범주형에 결측이 있는 행은 채울 값이 없으므로 제거한다
  const categoricalKeys = fields.filter((f) => f.kind === 'categorical').map((f) => f.key);
  return rows
    .filter((r) => !hasMissing(r, categoricalKeys))
    .map((r) => {
      const next: Row = { ...r };
      for (const f of numericFields) {
        if (next[f.key] === null || next[f.key] === undefined) {
          next[f.key] = Math.round((fill.get(f.key) ?? 0) * 10) / 10;
        }
      }
      return next;
    });
}

/* ── 정규화 ────────────────────────────────────────────────── */

export interface Scaler {
  min: number;
  max: number;
}

/**
 * 최소-최대 정규화 (교과서 76쪽)
 *   (값 − 최솟값) / (최댓값 − 최솟값)
 * 모든 값이 0과 1 사이로 바뀐다.
 */
export function fitScaler(xs: number[]): Scaler {
  return { min: Math.min(...xs), max: Math.max(...xs) };
}

export function applyScaler(x: number, s: Scaler): number {
  if (s.max === s.min) return 0;
  return (x - s.min) / (s.max - s.min);
}

/* ── 훈련 데이터와 테스트 데이터 ───────────────────────────── */

/** 씨앗값이 같으면 항상 같은 순서로 섞인다 */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed | 0;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface Split<T> {
  train: T[];
  test: T[];
}

/**
 * 훈련 데이터와 테스트 데이터로 나눈다 (교과서 94·100쪽)
 * testRatio 는 테스트로 뺄 비율(0~1). seed 를 바꾸면 다르게 나뉜다.
 */
export function trainTestSplit<T>(items: T[], testRatio: number, seed: number): Split<T> {
  const shuffled = seededShuffle(items, seed);
  const testCount = Math.max(1, Math.round(items.length * testRatio));
  return {
    test: shuffled.slice(0, testCount),
    train: shuffled.slice(testCount),
  };
}
