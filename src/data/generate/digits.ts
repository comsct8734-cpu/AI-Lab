/**
 * 손글씨 숫자 모델 미리 학습하기
 * 실행:  npx tsx src/data/generate/digits.ts
 *
 * 교과서 Ⅱ-03 인쇄 137~142쪽의 손글씨 숫자 실습에 대응한다.
 *
 * 왜 미리 학습하는가
 *   MNIST 6만 장을 학교 컴퓨터의 브라우저에서 처음부터 학습시키면 수 분이 걸린다.
 *   그래서 가중치는 여기서 미리 만들어 두고,
 *   학생이 그린 숫자에 대한 계산(순전파)은 브라우저에서 실제로 수행한다.
 *   결과 이미지를 미리 만들어 두고 바꿔치기하는 방식이 아니다.
 *
 * 입력을 28×28 그대로 쓰면 가중치 파일이 커지므로 14×14 로 줄여서 학습한다.
 * 학교망에서 내려받는 용량을 줄이기 위해서다.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import mnist from 'mnist';
import {
  accuracy,
  createNetwork,
  trainNetwork,
  type Sample,
} from '../../core/neuralNet';

/** 28×28 을 14×14 로 줄인다. 이웃한 네 칸의 평균을 쓴다. */
export function downsample(pixels: number[]): number[] {
  const out: number[] = [];
  for (let r = 0; r < 14; r++) {
    for (let c = 0; c < 14; c++) {
      const a = pixels[r * 2 * 28 + c * 2];
      const b = pixels[r * 2 * 28 + c * 2 + 1];
      const d = pixels[(r * 2 + 1) * 28 + c * 2];
      const e = pixels[(r * 2 + 1) * 28 + c * 2 + 1];
      out.push((a + b + d + e) / 4);
    }
  }
  return out;
}

console.log('\n손글씨 숫자 모델 학습');
console.log('─'.repeat(64));

const TRAIN_N = 6000;
const TEST_N = 1200;
const set = mnist.set(TRAIN_N, TEST_N);

const toSample = (item: { input: number[]; output: number[] }): Sample => ({
  input: downsample(item.input),
  target: item.output.indexOf(1),
});

const train: Sample[] = set.training.map(toSample);
const test: Sample[] = set.test.map(toSample);
console.log(`  훈련 ${train.length}장 · 테스트 ${test.length}장 · 입력 ${train[0].input.length}개`);

const SHAPE = [196, 32, 10];
const net = createNetwork(SHAPE, 'relu', 20260819);

const started = Date.now();
let last = { epoch: 0, testAccuracy: 0, trainAccuracy: 0 };
for (const step of trainNetwork(net, train, test, {
  epochs: 30,
  learningRate: 0.5,
  batchSize: 32,
  seed: 4242,
})) {
  last = step;
  if (step.epoch % 5 === 0 || step.epoch === 1) {
    console.log(
      `    ${String(step.epoch).padStart(2)}회  훈련 ${(step.trainAccuracy * 100).toFixed(1)}%  테스트 ${(step.testAccuracy * 100).toFixed(1)}%  손실 ${step.trainLoss.toFixed(3)}`,
    );
  }
}
console.log(`  학습 시간 ${((Date.now() - started) / 1000).toFixed(1)}초`);

const finalAcc = accuracy(net, test);
const ok = finalAcc >= 0.9;
console.log(`\n  ${ok ? '통과' : '실패'}  테스트 정확도 ${(finalAcc * 100).toFixed(1)}% (목표 90% 이상)`);

/** 소수점을 줄여 파일 크기를 줄인다. 정확도에는 거의 영향이 없다. */
const r4 = (x: number) => Math.round(x * 10000) / 10000;

const payload = {
  shape: SHAPE,
  activation: 'relu' as const,
  size: 14,
  trainedOn: `MNIST 훈련 ${TRAIN_N}장`,
  testAccuracy: r4(finalAcc),
  epochs: last.epoch,
  layers: net.layers.map((l) => ({
    weights: l.weights.map((w) => w.map(r4)),
    biases: l.biases.map(r4),
  })),
};

const out = resolve(import.meta.dirname, '../digitModel.json');
const json = JSON.stringify(payload);
writeFileSync(out, json, 'utf-8');
console.log(`  저장: ${out}  (${(json.length / 1024).toFixed(0)}KB)`);
console.log('═'.repeat(64));
if (!ok) process.exitCode = 1;
