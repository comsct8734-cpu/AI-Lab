/**
 * MVP 6 알고리즘 검증
 * 실행:  npx tsx src/core/verifyNeural.ts
 */
import {
  accuracy,
  createNetwork,
  forward,
  fromWeights,
  loss,
  predict,
  predictLabel,
  trainNetwork,
  type Sample,
} from './neuralNet';
import shapes from '../data/shapes.json' with { type: 'json' };
import digitModel from '../data/digitModel.json' with { type: 'json' };

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

type ShapeSet = Record<string, { x: number; y: number; label: number }[]>;
const SHAPES = shapes as ShapeSet;

const toSamples = (pts: { x: number; y: number; label: number }[]): Sample[] =>
  pts.map((p) => ({ input: [p.x, p.y], target: p.label }));

function split(samples: Sample[]): { train: Sample[]; test: Sample[] } {
  const train: Sample[] = [];
  const test: Sample[] = [];
  // 훈련 데이터를 절반만 주어 과적합이 드러나기 쉽게 한다
  samples.forEach((s, i) => (i % 10 < 5 ? train : test).push(s));
  return { train, test };
}

function trainTo(
  shape: number[],
  data: Sample[],
  epochs: number,
  lr = 0.4,
  seed = 11,
): { acc: number; lastLoss: number; firstLoss: number } {
  const net = createNetwork(shape, 'relu', seed);
  let firstLoss = 0;
  let lastLoss = 0;
  for (const step of trainNetwork(net, data, data, { epochs, learningRate: lr, batchSize: 16, seed: 7 })) {
    if (step.epoch === 1) firstLoss = step.trainLoss;
    lastLoss = step.trainLoss;
  }
  return { acc: accuracy(net, data), lastLoss, firstLoss };
}

/* ────────────────────────────────────────────────────────── */
section('1. 순전파 — 손으로 검산할 수 있는 신경망');
{
  // 입력 2개 → 출력 2개, 은닉층 없음. 가중치를 직접 정한다.
  const net = fromWeights([2, 2], 'relu', [
    { weights: [[1, 0], [0, 1]], biases: [0, 0] },
  ]);
  const outs = forward(net, [2, 0]);
  check('층의 개수만큼 출력이 쌓이는가', outs.length, 2);
  // 마지막 층은 softmax 이므로 [2,0] → e² 과 e⁰ 의 비율
  const p = outs[1];
  near('확률의 합은 1', p[0] + p[1], 1, 1e-9);
  near('큰 쪽의 확률', p[0], Math.exp(2) / (Math.exp(2) + 1), 1e-6);
  check('더 큰 쪽을 답으로 고르는가', predictLabel(net, [2, 0]), 0);
  check('반대쪽도 맞는가', predictLabel(net, [0, 2]), 1);
}

section('2. ReLU — 0보다 작은 값은 0이 된다 (교과서 134쪽)');
{
  const net = fromWeights([1, 2, 2], 'relu', [
    { weights: [[1], [-1]], biases: [0, 0] },
    { weights: [[1, 0], [0, 1]], biases: [0, 0] },
  ]);
  const outs = forward(net, [3]);
  check('양수는 그대로', outs[1][0], 3);
  check('음수는 0으로', outs[1][1], 0);
}

section('3. 학습하면 손실이 줄어드는가');
{
  const data = toSamples(SHAPES.linear);
  const r = trainTo([2, 4, 2], data, 40);
  check('손실이 줄었는가', r.lastLoss < r.firstLoss, true);
  console.log(`        참고 · 첫 회 ${r3(r.firstLoss)} → 마지막 ${r3(r.lastLoss)}`);
  check('직선 데이터를 잘 배웠는가', r.acc > 0.95, true);
}

section('4. 은닉층이 없으면 못 푸는 데이터가 있다 (교과서 128쪽)');
{
  // 은닉층 없이 입력에서 바로 출력으로 가면 직선 하나로만 나눌 수 있다
  const cases: [string, Sample[]][] = [
    ['직선', toSamples(SHAPES.linear)],
    ['원', toSamples(SHAPES.circle)],
    ['네 칸', toSamples(SHAPES.xor)],
  ];
  for (const [name, data] of cases) {
    const flat = trainTo([2, 2], data, 120, 0.5);
    const deep = trainTo([2, 8, 8, 2], data, 220, 0.4);
    console.log(
      `        ${name.padEnd(4)} · 은닉층 없음 ${(flat.acc * 100).toFixed(1)}%  vs  은닉층 2개 ${(deep.acc * 100).toFixed(1)}%`,
    );
    if (name === '직선') {
      check(`${name}: 은닉층 없이도 풀린다`, flat.acc > 0.95, true);
    } else {
      check(`${name}: 은닉층 없이는 못 푼다`, flat.acc < 0.8, true);
      check(`${name}: 은닉층이 있으면 풀린다`, deep.acc > 0.85, true);
    }
  }
}

section('5. 노드 수를 늘리면 어려운 데이터도 배울 수 있다');
{
  const data = toSamples(SHAPES.circle);
  const small = trainTo([2, 2, 2], data, 200, 0.4);
  const big = trainTo([2, 12, 12, 2], data, 260, 0.4);
  check('노드가 많은 쪽이 더 잘 배우는가', big.acc >= small.acc, true);
  console.log(`        참고 · 노드 2개 ${(small.acc * 100).toFixed(1)}%  vs  노드 12개 ${(big.acc * 100).toFixed(1)}%`);
}

section('6. 학습을 오래 하면 훈련과 테스트가 벌어진다 (교과서 95쪽 과적합)');
{
  const { train, test } = split(toSamples(SHAPES.spiral));
  // 나선은 어려운 데이터라 노드가 넉넉해야 훈련 데이터를 다 외울 수 있다.
  // 다 외운 뒤에야 훈련과 테스트의 차이가 드러난다.
  const net = createNetwork([2, 32, 32, 2], 'relu', 5);
  const history: { epoch: number; train: number; test: number }[] = [];
  for (const step of trainNetwork(net, train, test, {
    epochs: 1200,
    learningRate: 0.4,
    batchSize: 16,
    seed: 3,
  })) {
    history.push({ epoch: step.epoch, train: step.trainAccuracy, test: step.testAccuracy });
  }
  const last = history[history.length - 1];
  check('훈련 정확도가 테스트보다 높은가', last.train >= last.test, true);
  console.log(
    `        참고 · 1200회 학습 후  훈련 ${(last.train * 100).toFixed(1)}%  테스트 ${(last.test * 100).toFixed(1)}%`,
  );
  const early = history[19];
  check('학습을 하면 처음보다 좋아지는가', last.train > early.train, true);
}

section('7. 학습 횟수가 부족하면 제대로 못 배운다');
{
  const data = toSamples(SHAPES.circle);
  const few = trainTo([2, 10, 10, 2], data, 5, 0.4);
  const many = trainTo([2, 10, 10, 2], data, 250, 0.4);
  check('많이 학습한 쪽이 더 정확한가', many.acc > few.acc, true);
  console.log(`        참고 · 5회 ${(few.acc * 100).toFixed(1)}%  vs  250회 ${(many.acc * 100).toFixed(1)}%`);
}

section('8. 처음 가중치가 다르면 결과도 조금 달라진다');
{
  const data = toSamples(SHAPES.xor);
  const a = trainTo([2, 6, 2], data, 150, 0.4, 1);
  const b = trainTo([2, 6, 2], data, 150, 0.4, 999);
  check('두 결과가 완전히 같지는 않은가', a.lastLoss !== b.lastLoss, true);
  console.log(`        참고 · 씨앗값 1 → ${(a.acc * 100).toFixed(1)}%,  씨앗값 999 → ${(b.acc * 100).toFixed(1)}%`);
}

section('9. 학습률이 너무 높으면 오히려 무너진다');
{
  const data = toSamples(SHAPES.circle);
  const safe = trainTo([2, 10, 10, 2], data, 250, 0.4);
  const tooHigh = trainTo([2, 10, 10, 2], data, 250, 1.2);
  check('안전한 학습률에서는 잘 배우는가', safe.acc > 0.9, true);
  check('너무 높으면 오히려 나빠지는가', tooHigh.acc < safe.acc, true);
  console.log(
    `        참고 · 학습률 0.4 → ${(safe.acc * 100).toFixed(1)}%,  1.2 → ${(tooHigh.acc * 100).toFixed(1)}%`,
  );
}

section('10. 손글씨 모델 — 미리 학습한 가중치가 제대로 동작하는가');
{
  const model = digitModel as {
    shape: number[];
    activation: 'relu';
    size: number;
    testAccuracy: number;
    layers: { weights: number[][]; biases: number[] }[];
  };
  check('입력 크기', model.shape[0], 14 * 14);
  check('출력 노드 10개', model.shape[model.shape.length - 1], 10);
  check('층의 개수', model.layers.length, model.shape.length - 1);
  check('테스트 정확도가 90% 이상', model.testAccuracy >= 0.9, true);
  console.log(`        참고 · 실제 MNIST 로 학습 · 테스트 정확도 ${(model.testAccuracy * 100).toFixed(1)}%`);

  const net = fromWeights(model.shape, model.activation, model.layers);

  // 아무것도 그리지 않은 빈 입력에도 답은 나온다. 다만 확신이 낮아야 한다.
  const blank = new Array(196).fill(0);
  const blankProbs = predict(net, blank);
  near('빈 화면에서도 확률의 합은 1', blankProbs.reduce((a, b) => a + b, 0), 1, 1e-6);

  // 가운데 세로줄을 그리면 1 쪽에 확률이 쏠려야 한다
  const one = new Array(196).fill(0);
  for (let r = 2; r < 12; r++) {
    one[r * 14 + 7] = 1;
    one[r * 14 + 6] = 0.6;
  }
  const oneProbs = predict(net, one);
  const oneBest = predictLabel(net, one);
  console.log(
    `        참고 · 가운데 세로줄을 그리면 ${oneBest} 로 판단 (확률 ${(oneProbs[oneBest] * 100).toFixed(1)}%)`,
  );
  check('세로줄은 1 로 판단하는가', oneBest, 1);

  check('손실이 유한한 값인가', Number.isFinite(loss(net, [{ input: one, target: 1 }])), true);
}

console.log(`\n${'═'.repeat(66)}`);
console.log(`통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(66));
if (fail > 0) process.exitCode = 1;
