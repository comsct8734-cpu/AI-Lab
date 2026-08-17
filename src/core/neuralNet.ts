/**
 * 인공 신경망
 * 교과서 Ⅱ-03 인쇄 127~140쪽
 *
 * 층과 노드가 무엇을 하는지, 학습이 어떻게 진행되는지를 화면에 드러내야 하므로
 * 라이브러리를 쓰지 않고 직접 구현했다.
 * 텐서플로 계열 라이브러리는 번들이 수 MB 라 학교망에서 실패할 위험이 크고,
 * 가중치와 중간 계산을 화면에 그대로 보여 주기도 어렵다.
 *
 * 학생 화면에는 수식을 노출하지 않는다. 구조와 결과의 변화만 보여 준다.
 */

export type Activation = 'relu' | 'sigmoid' | 'tanh';

export const ACTIVATION_LABEL: Record<Activation, string> = {
  relu: 'ReLU',
  sigmoid: '시그모이드',
  tanh: '하이퍼볼릭 탄젠트',
};

export const ACTIVATION_HELP: Record<Activation, string> = {
  relu: '0보다 작은 값은 모두 0으로 바꾸고, 0보다 큰 값은 그대로 둡니다.',
  sigmoid: '어떤 값이든 0과 1 사이로 부드럽게 눌러 줍니다.',
  tanh: '어떤 값이든 −1과 1 사이로 부드럽게 눌러 줍니다.',
};

/** 활성화 함수와 그 기울기 */
const ACT = {
  relu: {
    f: (x: number) => (x > 0 ? x : 0),
    d: (y: number) => (y > 0 ? 1 : 0),
  },
  sigmoid: {
    f: (x: number) => 1 / (1 + Math.exp(-x)),
    d: (y: number) => y * (1 - y),
  },
  tanh: {
    f: (x: number) => Math.tanh(x),
    d: (y: number) => 1 - y * y,
  },
} as const;

export interface Layer {
  /** weights[출력 노드][입력 노드] */
  weights: number[][];
  biases: number[];
}

export interface Network {
  layers: Layer[];
  activation: Activation;
  /** 입력 노드 수부터 출력 노드 수까지 */
  shape: number[];
}

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 신경망을 만든다.
 * 처음 가중치는 무작위로 정한다. 그래서 같은 구조라도 학습 결과가 조금씩 다르다.
 */
export function createNetwork(
  shape: number[],
  activation: Activation,
  seed: number,
): Network {
  const rand = rng(seed);
  const layers: Layer[] = [];
  for (let i = 0; i < shape.length - 1; i++) {
    const fanIn = shape[i];
    // 층이 깊어져도 값이 너무 커지거나 작아지지 않도록 범위를 조절한다
    const scale = Math.sqrt(2 / fanIn);
    layers.push({
      weights: Array.from({ length: shape[i + 1] }, () =>
        Array.from({ length: fanIn }, () => (rand() * 2 - 1) * scale),
      ),
      // 편향을 0 이 아니라 약간의 양수로 시작한다.
      // ReLU 는 값이 음수로 밀리면 기울기가 0 이 되어 그 노드가 영영 학습되지 않는다.
      // (화면에서는 아무 반응이 없는 죽은 노드로 보인다)
      biases: new Array(shape[i + 1]).fill(0.02),
    });
  }
  return { layers, activation, shape };
}

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/**
 * 순전파 — 입력이 층을 지나며 출력으로 바뀌는 과정 (교과서 136쪽)
 * 각 층의 출력값을 모두 돌려준다. 화면에서 노드의 밝기로 보여 주기 위해서다.
 */
export function forward(net: Network, input: number[]): number[][] {
  const outputs: number[][] = [input];
  let current = input;
  for (let l = 0; l < net.layers.length; l++) {
    const layer = net.layers[l];
    const isLast = l === net.layers.length - 1;
    const raw = layer.weights.map(
      (w, j) => w.reduce((sum, wij, i) => sum + wij * current[i], 0) + layer.biases[j],
    );
    // 마지막 층은 확률로 바꾼다 (교과서 134쪽 softmax)
    current = isLast ? softmax(raw) : raw.map(ACT[net.activation].f);
    outputs.push(current);
  }
  return outputs;
}

export function predict(net: Network, input: number[]): number[] {
  const outputs = forward(net, input);
  return outputs[outputs.length - 1];
}

export function predictLabel(net: Network, input: number[]): number {
  const probs = predict(net, input);
  let best = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
  return best;
}

export interface Sample {
  input: number[];
  /** 정답 클래스 번호 */
  target: number;
}

/** 손실 — 정답일 확률이 낮을수록 커진다 (교과서 136쪽 손실 함수) */
export function loss(net: Network, samples: Sample[]): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) {
    const p = predict(net, s.input)[s.target] ?? 1e-12;
    sum += -Math.log(Math.max(p, 1e-12));
  }
  return sum / samples.length;
}

export function accuracy(net: Network, samples: Sample[]): number {
  if (samples.length === 0) return 0;
  let correct = 0;
  for (const s of samples) if (predictLabel(net, s.input) === s.target) correct += 1;
  return correct / samples.length;
}

/**
 * 한 묶음의 데이터로 가중치를 한 번 고친다 (교과서 136쪽 역전파)
 * 출력에서 시작해 입력 쪽으로 거슬러 가며 각 가중치를 얼마나 고칠지 계산한다.
 */
function trainBatch(net: Network, batch: Sample[], learningRate: number): void {
  const L = net.layers.length;
  const gradW = net.layers.map((l) => l.weights.map((w) => w.map(() => 0)));
  const gradB = net.layers.map((l) => l.biases.map(() => 0));

  for (const s of batch) {
    const outs = forward(net, s.input);

    // 출력층: 예측 확률과 정답의 차이
    let delta = outs[L].map((p, i) => p - (i === s.target ? 1 : 0));

    for (let l = L - 1; l >= 0; l--) {
      const inputs = outs[l];
      for (let j = 0; j < net.layers[l].weights.length; j++) {
        gradB[l][j] += delta[j];
        const w = net.layers[l].weights[j];
        for (let i = 0; i < w.length; i++) gradW[l][j][i] += delta[j] * inputs[i];
      }
      if (l === 0) break;
      // 한 층 앞으로 거슬러 간다
      const prev = new Array(net.layers[l].weights[0].length).fill(0);
      for (let j = 0; j < net.layers[l].weights.length; j++) {
        const w = net.layers[l].weights[j];
        for (let i = 0; i < w.length; i++) prev[i] += w[i] * delta[j];
      }
      delta = prev.map((v, i) => v * ACT[net.activation].d(outs[l][i]));
    }
  }

  const n = batch.length || 1;
  for (let l = 0; l < L; l++) {
    for (let j = 0; j < net.layers[l].weights.length; j++) {
      net.layers[l].biases[j] -= (learningRate * gradB[l][j]) / n;
      const w = net.layers[l].weights[j];
      for (let i = 0; i < w.length; i++) w[i] -= (learningRate * gradW[l][j][i]) / n;
    }
  }
}

/**
 * 학습률의 안전 범위.
 * 0.6 을 넘기면 ReLU 노드가 무더기로 죽어 정확도가 50% 로 주저앉는 일이 생긴다.
 * 화면의 슬라이더도 이 범위 안에서만 고를 수 있게 한다.
 */
export const MAX_LEARNING_RATE = 0.6;

export interface TrainOptions {
  epochs: number;
  learningRate: number;
  batchSize: number;
  seed: number;
}

export interface TrainStep {
  epoch: number;
  trainLoss: number;
  trainAccuracy: number;
  testLoss: number;
  testAccuracy: number;
}

/**
 * 한 에포크씩 학습한다.
 * 제너레이터라서 화면이 멈추지 않게 한 번에 조금씩만 돌릴 수 있다.
 * (모든 학습을 한 번에 끝내면 브라우저가 몇 초간 얼어붙는다.)
 */
export function* trainNetwork(
  net: Network,
  train: Sample[],
  test: Sample[],
  options: TrainOptions,
): Generator<TrainStep, void, void> {
  const rand = rng(options.seed);
  for (let epoch = 1; epoch <= options.epochs; epoch++) {
    // 순서를 섞어 한쪽으로 치우쳐 배우지 않게 한다
    const order = train.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (let start = 0; start < order.length; start += options.batchSize) {
      const batch = order.slice(start, start + options.batchSize).map((i) => train[i]);
      trainBatch(net, batch, options.learningRate);
    }
    yield {
      epoch,
      trainLoss: loss(net, train),
      trainAccuracy: accuracy(net, train),
      testLoss: loss(net, test),
      testAccuracy: accuracy(net, test),
    };
  }
}

/** 저장된 가중치에서 신경망을 되살린다 (손글씨 실험에서 쓴다) */
export function fromWeights(
  shape: number[],
  activation: Activation,
  layers: Layer[],
): Network {
  return { shape, activation, layers };
}
