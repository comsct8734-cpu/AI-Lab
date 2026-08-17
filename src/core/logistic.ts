/**
 * 로지스틱 회귀와 분류 평가 지표
 * 교과서 Ⅱ-02 인쇄 108·114~115쪽
 *
 * 로지스틱 회귀는 각 클래스에 속할 '확률'을 내놓는다는 점이 핵심이다.
 * 그래서 예측 결과뿐 아니라 클래스별 확률을 함께 돌려주고,
 * 화면에서는 결정 경계 근처일수록 확률이 0.5 에 가까워지는 것을 색의 진하기로 보여 준다.
 *
 * 복잡한 수학적 유도는 하지 않는다. 경사하강법으로 가중치를 조금씩 고쳐 나가는
 * 방식만 사용하고, 학생 화면에는 수식을 노출하지 않는다.
 */

export interface LogisticSample {
  /** 0~1 로 정규화된 특징값 (교과서 114쪽) */
  x: number;
  y: number;
  label: string;
}

export interface LogisticModel {
  labels: string[];
  /** 클래스마다 [x 가중치, y 가중치] */
  weights: number[][];
  /** 클래스마다 절편 */
  biases: number[];
}

/** 여러 값을 합이 1 인 확률로 바꾼다 */
function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export interface LogisticOptions {
  /** 학습 횟수 */
  epochs: number;
  /** 한 번에 얼마나 고칠지 */
  learningRate: number;
}

export const DEFAULT_LOGISTIC: LogisticOptions = { epochs: 600, learningRate: 1.2 };

export function fitLogistic(
  samples: LogisticSample[],
  options: LogisticOptions = DEFAULT_LOGISTIC,
): LogisticModel {
  const labels = [...new Set(samples.map((s) => s.label))].sort();
  const K = labels.length;
  const weights = labels.map(() => [0, 0]);
  const biases = labels.map(() => 0);
  if (samples.length === 0) return { labels, weights, biases };

  const indexOf = new Map(labels.map((l, i) => [l, i]));
  const n = samples.length;

  for (let epoch = 0; epoch < options.epochs; epoch++) {
    const gradW = labels.map(() => [0, 0]);
    const gradB = labels.map(() => 0);

    for (const s of samples) {
      const scores = weights.map((w, k) => w[0] * s.x + w[1] * s.y + biases[k]);
      const probs = softmax(scores);
      const truth = indexOf.get(s.label) ?? 0;
      for (let k = 0; k < K; k++) {
        // 맞아야 할 클래스면 1, 아니면 0 과의 차이만큼 고친다
        const diff = probs[k] - (k === truth ? 1 : 0);
        gradW[k][0] += diff * s.x;
        gradW[k][1] += diff * s.y;
        gradB[k] += diff;
      }
    }

    for (let k = 0; k < K; k++) {
      weights[k][0] -= (options.learningRate * gradW[k][0]) / n;
      weights[k][1] -= (options.learningRate * gradW[k][1]) / n;
      biases[k] -= (options.learningRate * gradB[k]) / n;
    }
  }

  return { labels, weights, biases };
}

export interface LogisticResult {
  predicted: string;
  /** 클래스별 확률. 모두 더하면 1 이 된다. */
  probabilities: { label: string; p: number }[];
  /** 가장 높은 확률. 0.5 에 가까울수록 모델이 확신하지 못한다는 뜻이다. */
  confidence: number;
}

export function logisticPredict(model: LogisticModel, x: number, y: number): LogisticResult {
  if (model.labels.length === 0) {
    return { predicted: '', probabilities: [], confidence: 0 };
  }
  const scores = model.weights.map((w, k) => w[0] * x + w[1] * y + model.biases[k]);
  const probs = softmax(scores);
  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[bestIdx]) bestIdx = i;
  return {
    predicted: model.labels[bestIdx],
    probabilities: model.labels.map((label, i) => ({ label, p: probs[i] })),
    confidence: probs[bestIdx],
  };
}

/* ── 분류 평가 지표 (교과서 108·115쪽) ─────────────────────── */

export interface ConfusionMatrix {
  labels: string[];
  /** matrix[실제][예측] = 개수 */
  matrix: number[][];
  total: number;
  correct: number;
}

export function confusionMatrix(
  labels: string[],
  actual: string[],
  predicted: string[],
): ConfusionMatrix {
  const index = new Map(labels.map((l, i) => [l, i]));
  const matrix = labels.map(() => labels.map(() => 0));
  let correct = 0;
  for (let i = 0; i < actual.length; i++) {
    const a = index.get(actual[i]);
    const p = index.get(predicted[i]);
    if (a === undefined || p === undefined) continue;
    matrix[a][p] += 1;
    if (a === p) correct += 1;
  }
  return { labels, matrix, total: actual.length, correct };
}

export interface ClassScore {
  label: string;
  /** 실제로 이 클래스인 데이터 수 */
  support: number;
  /** 정밀도 — 이 클래스라고 답한 것 중 실제로 맞은 비율 */
  precision: number;
  /** 재현율 — 실제 이 클래스인 것 중 찾아낸 비율 */
  recall: number;
}

export interface Scores {
  accuracy: number;
  perClass: ClassScore[];
}

export function scoresFrom(cm: ConfusionMatrix): Scores {
  const K = cm.labels.length;
  const perClass: ClassScore[] = cm.labels.map((label, i) => {
    const tp = cm.matrix[i][i];
    let predictedAsI = 0;
    let actualI = 0;
    for (let j = 0; j < K; j++) {
      predictedAsI += cm.matrix[j][i];
      actualI += cm.matrix[i][j];
    }
    return {
      label,
      support: actualI,
      precision: predictedAsI === 0 ? 0 : tp / predictedAsI,
      recall: actualI === 0 ? 0 : tp / actualI,
    };
  });
  return {
    accuracy: cm.total === 0 ? 0 : cm.correct / cm.total,
    perClass,
  };
}
