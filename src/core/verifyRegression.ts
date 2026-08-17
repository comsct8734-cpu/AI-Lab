/**
 * MVP 3 알고리즘 검증
 * 실행:  npx tsx src/core/verifyRegression.ts
 *
 * 손으로 검산할 수 있는 작은 데이터로 먼저 확인한 뒤, 실제 데이터로 넘어간다.
 */
import { evaluateModel, fitMultiple, fitSimple, predict, type Sample } from './regression';
import { trainTestSplit, type Row } from './stats';
import { evaluate, type Point } from './knn';
import body from '../data/body.json' with { type: 'json' };
import penguins from '../data/penguins.json' with { type: 'json' };

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

/* ────────────────────────────────────────────────────────── */
section('1. 단순 선형 회귀 — 완전한 직선 (0,0) (1,2) (2,4)');
{
  const m = fitSimple([0, 1, 2], [0, 2, 4]);
  check('기울기', r3(m.coefficients[0]), 2);
  check('절편', r3(m.intercept), 0);
  const ev = evaluateModel(m, [
    { x: [0], y: 0 },
    { x: [1], y: 2 },
    { x: [2], y: 4 },
  ]);
  check('오차가 0이면 R² 는 1', r3(ev.r2), 1);
  check('MSE 도 0', r3(ev.mse), 0);
  check('예측값', r3(predict(m, [10])), 20);
}

section('2. 단순 선형 회귀 — 손으로 검산할 수 있는 예');
{
  // x = 1,2,3,4 / y = 2,4,5,8 → 평균 x=2.5, y=4.75
  // Sxy = (−1.5)(−2.75)+(−0.5)(−0.75)+(0.5)(0.25)+(1.5)(3.25) = 4.125+0.375+0.125+4.875 = 9.5
  // Sxx = 2.25+0.25+0.25+2.25 = 5  →  기울기 1.9, 절편 4.75 − 1.9×2.5 = 0
  const m = fitSimple([1, 2, 3, 4], [2, 4, 5, 8]);
  check('기울기', r3(m.coefficients[0]), 1.9);
  check('절편', r3(m.intercept), 0);
}

section('3. 평가 지표 — 오차가 1, 1, 1, 1 일 때');
{
  const m = { coefficients: [0], intercept: 0 };
  const samples: Sample[] = [
    { x: [0], y: 1 },
    { x: [0], y: -1 },
    { x: [0], y: 1 },
    { x: [0], y: -1 },
  ];
  const ev = evaluateModel(m, samples);
  check('MAE = 1', r3(ev.mae), 1);
  check('MSE = 1', r3(ev.mse), 1);
  check('RMSE = 1', r3(ev.rmse), 1);
}

section('4. 이상치 하나가 MSE 와 MAE 에 미치는 영향 (교과서 97쪽)');
{
  // 오차가 모두 1 인 데이터에 오차 10 짜리 하나를 더한다
  const base: Sample[] = Array.from({ length: 9 }, () => ({ x: [0], y: 1 }));
  const m = { coefficients: [0], intercept: 0 };
  const before = evaluateModel(m, base);
  const after = evaluateModel(m, [...base, { x: [0], y: 10 }]);
  near('MAE 는 1 → 1.9 로 완만히', after.mae, 1.9, 0.001);
  near('MSE 는 1 → 10.9 로 크게', after.mse, 10.9, 0.001);
  check('MSE 가 MAE 보다 크게 반응하는가', after.mse / before.mse > after.mae / before.mae, true);
}

section('5. 다중 선형 회귀 — 정확히 y = 2a + 3b + 1');
{
  const samples: Sample[] = [
    { x: [0, 0], y: 1 },
    { x: [1, 0], y: 3 },
    { x: [0, 1], y: 4 },
    { x: [1, 1], y: 6 },
    { x: [2, 1], y: 8 },
  ];
  const m = fitMultiple(samples);
  check('a 의 계수', r3(m.coefficients[0]), 2);
  check('b 의 계수', r3(m.coefficients[1]), 3);
  check('절편', r3(m.intercept), 1);
  check('R² = 1', r3(evaluateModel(m, samples).r2), 1);
}

section('6. 다중 회귀는 단순 회귀를 포함한다');
{
  const xs = [1, 2, 3, 4, 5];
  const ys = [2, 4, 5, 8, 9];
  const simple = fitSimple(xs, ys);
  const multi = fitMultiple(xs.map((x, i) => ({ x: [x], y: ys[i] })));
  near('기울기가 같은가', multi.coefficients[0], simple.coefficients[0], 1e-6);
  near('절편이 같은가', multi.intercept, simple.intercept, 1e-6);
}

section('7. 신체 치수 데이터 — 교과서 100~103쪽');
{
  const rows = body as { neck: number; weight: number; heap: number; waist: number }[];
  check('행 수', rows.length, 300);

  const simple = fitSimple(
    rows.map((r) => r.neck),
    rows.map((r) => r.waist),
  );
  const simpleEv = evaluateModel(
    simple,
    rows.map((r) => ({ x: [r.neck], y: r.waist })),
  );
  near('목둘레 → 허리둘레 R² (교과서 약 0.72)', simpleEv.r2, 0.72, 0.07);

  const multi = fitMultiple(rows.map((r) => ({ x: [r.neck, r.weight, r.heap], y: r.waist })));
  const multiEv = evaluateModel(
    multi,
    rows.map((r) => ({ x: [r.neck, r.weight, r.heap], y: r.waist })),
  );
  check('속성을 늘리면 R² 가 커지는가 (교과서 103쪽)', multiEv.r2 > simpleEv.r2, true);
  console.log(`        참고 · 단순 ${r3(simpleEv.r2)}  vs  다중 ${r3(multiEv.r2)}`);

  check('회귀계수가 3개', multi.coefficients.length, 3);
  check('모든 계수가 유한한 값인가', multi.coefficients.every(Number.isFinite), true);
}

section('8. 훈련 데이터와 테스트 데이터 (교과서 94~95쪽)');
{
  const rows = body as { neck: number; waist: number }[];
  const samples: Sample[] = rows.map((r) => ({ x: [r.neck], y: r.waist }));
  const split = trainTestSplit(samples, 0.3, 42);

  const model = fitSimple(
    split.train.map((s) => s.x[0]),
    split.train.map((s) => s.y),
  );
  const trainEv = evaluateModel(model, split.train);
  const testEv = evaluateModel(model, split.test);

  check('훈련 210 · 테스트 90', [split.train.length, split.test.length], [210, 90]);
  check('훈련 R² 가 테스트 R² 보다 큰가 (교과서 95쪽)', trainEv.r2 > testEv.r2, true);
  console.log(`        참고 · 훈련 ${r3(trainEv.r2)}  vs  테스트 ${r3(testEv.r2)}`);

  // 비율을 바꾸면 개수가 달라진다
  const s9 = trainTestSplit(samples, 0.1, 42);
  check('테스트 비율 10% → 30개', s9.test.length, 30);
  const s5 = trainTestSplit(samples, 0.5, 42);
  check('테스트 비율 50% → 150개', s5.test.length, 150);
}

section('9. 과적합 — k 값에 따른 훈련·테스트 정확도 (교과서 95쪽)');
{
  const rows = (penguins as Row[]).filter(
    (r) =>
      typeof r.culmen_length_mm === 'number' &&
      typeof r.culmen_depth_mm === 'number' &&
      r.sex !== '.',
  );
  const points: Point[] = rows.map((r) => ({
    x: r.culmen_length_mm as number,
    y: r.culmen_depth_mm as number,
    label: r.species as string,
  }));
  const split = trainTestSplit(points, 0.3, 42);

  // k = 1 이면 훈련 데이터는 자기 자신이 가장 가까운 이웃(거리 0)이므로 거의 100% 가 된다.
  // 완전히 100% 가 아닌 이유: 부리 길이와 부리 깊이가 소수 첫째 자리까지만 기록되어
  // 좌표가 똑같은데 종이 다른 펭귄이 있기 때문이다. 이때는 거리가 둘 다 0 이라
  // 어느 쪽이 뽑힐지 정해지지 않는다. 실제 데이터에서 자연스럽게 생기는 일이다.
  const trainAt1 = evaluate(split.train, split.train, 1, 'euclidean');
  check('k=1 일 때 훈련 정확도가 거의 100%', trainAt1.accuracy >= 0.99, true);
  console.log(`        참고 · 정확히는 ${(trainAt1.accuracy * 100).toFixed(1)}% (좌표가 겹치는 데이터 때문)`);

  const testAt1 = evaluate(split.train, split.test, 1, 'euclidean');
  check('k=1 일 때 테스트 정확도는 100% 미만', testAt1.accuracy < 1, true);
  console.log(
    `        참고 · k=1 훈련 100.0%  vs  테스트 ${(testAt1.accuracy * 100).toFixed(1)}%`,
  );

  // k 를 키우면 훈련 정확도는 떨어지지만 테스트 정확도는 오히려 올라가는 구간이 있다
  const trainAt15 = evaluate(split.train, split.train, 15, 'euclidean');
  const testAt15 = evaluate(split.train, split.test, 15, 'euclidean');
  check('k 를 키우면 훈련 정확도가 떨어지는가', trainAt15.accuracy < trainAt1.accuracy, true);
  check('k=15 의 테스트 정확도가 k=1 보다 높은가', testAt15.accuracy > testAt1.accuracy, true);
  console.log(
    `        참고 · k=15 훈련 ${(trainAt15.accuracy * 100).toFixed(1)}%  vs  테스트 ${(testAt15.accuracy * 100).toFixed(1)}%`,
  );
}

section('10. 데이터 한 개가 회귀선에 주는 영향 (교과서 활동)');
{
  const base: Sample[] = [
    { x: [1], y: 1 },
    { x: [2], y: 2 },
    { x: [3], y: 3 },
    { x: [4], y: 4 },
    { x: [5], y: 5 },
  ];
  const clean = fitSimple(
    base.map((s) => s.x[0]),
    base.map((s) => s.y),
  );
  check('정상 데이터의 기울기', r3(clean.coefficients[0]), 1);

  // 끝에 이상치를 넣으면 기울기가 크게 변한다
  const withEnd = [...base, { x: [6], y: 30 }];
  const endModel = fitSimple(
    withEnd.map((s) => s.x[0]),
    withEnd.map((s) => s.y),
  );
  // 가운데에 같은 크기의 이상치를 넣으면 덜 변한다
  const withMid = [...base, { x: [3], y: 30 }];
  const midModel = fitSimple(
    withMid.map((s) => s.x[0]),
    withMid.map((s) => s.y),
  );
  const endShift = Math.abs(endModel.coefficients[0] - 1);
  const midShift = Math.abs(midModel.coefficients[0] - 1);
  check('이상치가 기울기를 바꾸는가', endShift > 0.5, true);
  check('끝에 있는 이상치가 가운데보다 영향이 큰가', endShift > midShift, true);
  console.log(`        참고 · 끝 ${r3(endShift)}  vs  가운데 ${r3(midShift)}`);
}

console.log(`\n${'═'.repeat(66)}`);
console.log(`통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(66));
if (fail > 0) process.exitCode = 1;
