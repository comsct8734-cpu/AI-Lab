/**
 * 선형 회귀
 * 교과서 Ⅱ-02 인쇄 96~103쪽
 *
 * 회귀선이 어떻게 정해지는지, 오차가 무엇인지 화면에 그대로 드러내야 하므로
 * 최소제곱법을 직접 구현했다. 다중 회귀는 정규방정식을 가우스 소거법으로 푼다.
 */

export interface Sample {
  /** 독립 변수(특징) 값들 */
  x: number[];
  /** 종속 변수(타깃) 값 */
  y: number;
}

export interface Model {
  /** 각 독립 변수의 회귀계수 */
  coefficients: number[];
  /** 절편 */
  intercept: number;
}

/** 단순 선형 회귀 — 최소제곱법 (교과서 96~97쪽) */
export function fitSimple(xs: number[], ys: number[]): Model {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { coefficients: [0], intercept: ys[0] ?? 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }
  // 모든 x 가 같으면 기울기를 정할 수 없다. 평균을 지나는 수평선으로 둔다.
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return { coefficients: [slope], intercept: my - slope * mx };
}

/**
 * 다중 선형 회귀 (교과서 102~103쪽)
 * 정규방정식 (XᵀX)β = Xᵀy 를 가우스 소거법으로 푼다.
 */
export function fitMultiple(samples: Sample[]): Model {
  if (samples.length === 0) return { coefficients: [], intercept: 0 };
  const p = samples[0].x.length;
  const size = p + 1; // 절편을 위한 열 하나를 더한다

  // 확대행렬 [XᵀX | Xᵀy]
  const A: number[][] = Array.from({ length: size }, () => new Array(size + 1).fill(0));
  for (const s of samples) {
    const row = [1, ...s.x];
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) A[i][j] += row[i] * row[j];
      A[i][size] += row[i] * s.y;
    }
  }

  // 가우스 소거법 (부분 피벗)
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let r = col + 1; r < size; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (Math.abs(A[pivot][col]) < 1e-10) continue; // 풀 수 없는 열은 건너뛴다
    [A[col], A[pivot]] = [A[pivot], A[col]];
    const d = A[col][col];
    for (let j = col; j <= size; j++) A[col][j] /= d;
    for (let r = 0; r < size; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (f === 0) continue;
      for (let j = col; j <= size; j++) A[r][j] -= f * A[col][j];
    }
  }

  const solution = A.map((row) => row[size]);
  return { intercept: solution[0], coefficients: solution.slice(1) };
}

export function predict(model: Model, x: number[]): number {
  let y = model.intercept;
  for (let i = 0; i < model.coefficients.length; i++) y += model.coefficients[i] * (x[i] ?? 0);
  return y;
}

/* ── 평가 지표 (교과서 97~98쪽) ────────────────────────────── */

export interface Metrics {
  /** 평균제곱오차 — 오차를 제곱해 평균낸 값. 큰 오차에 크게 반응한다. */
  mse: number;
  /** 평균절대오차 — 오차의 절댓값을 평균낸 값 */
  mae: number;
  /** 평균제곱근오차 — MSE 에 제곱근을 씌워 원래 단위로 되돌린 값 */
  rmse: number;
  /** 결정계수 — 1 에 가까울수록 데이터를 잘 설명한다 */
  r2: number;
  count: number;
}

export function evaluateModel(model: Model, samples: Sample[]): Metrics {
  const n = samples.length;
  if (n === 0) return { mse: 0, mae: 0, rmse: 0, r2: 0, count: 0 };
  const my = samples.reduce((a, s) => a + s.y, 0) / n;
  let ssRes = 0;
  let ssTot = 0;
  let absSum = 0;
  for (const s of samples) {
    const err = s.y - predict(model, s.x);
    ssRes += err * err;
    absSum += Math.abs(err);
    ssTot += (s.y - my) ** 2;
  }
  return {
    mse: ssRes / n,
    mae: absSum / n,
    rmse: Math.sqrt(ssRes / n),
    // 모든 y 가 같으면 설명할 변동이 없어 R² 를 정의할 수 없다
    r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot,
    count: n,
  };
}

/** 데이터 한 개가 회귀선에 얼마나 영향을 주었는지 (교과서 활동용) */
export function influenceOf(samples: Sample[], index: number): number {
  if (samples.length < 3) return 0;
  const withAll = fitMultiple(samples);
  const without = fitMultiple(samples.filter((_, i) => i !== index));
  const diff = Math.abs(withAll.coefficients[0] - without.coefficients[0]);
  return diff;
}
