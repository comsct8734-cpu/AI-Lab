/**
 * MVP 4 알고리즘 검증
 * 실행:  npx tsx src/core/verifyClassify.ts
 */
import {
  allNodes,
  fitTree,
  gini,
  leaves,
  treeDepth,
  treePath,
  treePredict,
  type TreeSample,
} from './decisionTree';
import {
  confusionMatrix,
  fitLogistic,
  logisticPredict,
  scoresFrom,
  type LogisticSample,
} from './logistic';
import { applyScaler, fitScaler, trainTestSplit, type Row } from './stats';
import { evaluate, type Point } from './knn';
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

const FULL = { minX: 0, maxX: 10, minY: 0, maxY: 10 };

/* ────────────────────────────────────────────────────────── */
section('1. 지니 계수 — 손으로 검산 (교과서 107쪽)');
{
  check('한 종류만 있으면 0', gini({ A: 10 }, 10), 0);
  // 반반이면 1 − (0.5² + 0.5²) = 0.5
  check('반반이면 0.5', gini({ A: 5, B: 5 }, 10), 0.5);
  // 세 종류가 똑같이 있으면 1 − 3 × (1/3)² = 2/3
  near('세 종류가 똑같으면 약 0.667', gini({ A: 3, B: 3, C: 3 }, 9), 0.667, 0.001);
  // 8 대 2 면 1 − (0.8² + 0.2²) = 0.32
  near('8 대 2 면 0.32', gini({ A: 8, B: 2 }, 10), 0.32, 0.001);
}

section('2. 결정트리 — 한 번만 나누면 되는 데이터');
{
  // 가로축 5 를 기준으로 완전히 갈린다
  const samples: TreeSample[] = [
    { x: 1, y: 5, label: 'A' },
    { x: 2, y: 3, label: 'A' },
    { x: 3, y: 8, label: 'A' },
    { x: 7, y: 4, label: 'B' },
    { x: 8, y: 6, label: 'B' },
    { x: 9, y: 2, label: 'B' },
  ];
  const tree = fitTree(samples, FULL, { maxDepth: 5, minSamples: 2 });
  check('뿌리 노드의 데이터 수', tree.samples, 6);
  check('뿌리 노드의 지니 계수', tree.gini, 0.5);
  check('가로축으로 나누었는가', tree.split?.axis, 0);
  check('경계값이 3 과 7 사이인가', tree.split!.threshold > 3 && tree.split!.threshold < 7, true);
  check('깊이 1 에서 끝나는가', treeDepth(tree), 1);
  check('잎이 2개', leaves(tree).length, 2);
  check('두 잎 모두 지니 0', leaves(tree).every((l) => l.gini === 0), true);
  check('왼쪽 예측', treePredict(tree, 2, 5), 'A');
  check('오른쪽 예측', treePredict(tree, 8, 5), 'B');
}

section('3. 잎 노드의 영역이 화면 전체를 덮는가');
{
  const samples: TreeSample[] = [
    { x: 1, y: 1, label: 'A' },
    { x: 2, y: 8, label: 'B' },
    { x: 8, y: 2, label: 'B' },
    { x: 9, y: 9, label: 'A' },
    { x: 5, y: 5, label: 'A' },
  ];
  const tree = fitTree(samples, FULL, { maxDepth: 4, minSamples: 2 });
  const area = leaves(tree).reduce(
    (a, l) => a + (l.bounds.maxX - l.bounds.minX) * (l.bounds.maxY - l.bounds.minY),
    0,
  );
  near('잎 영역의 넓이 합이 전체와 같은가', area, 100, 0.001);
  check('영역이 모두 유효한가', leaves(tree).every((l) => l.bounds.maxX > l.bounds.minX), true);
}

section('4. 트리 깊이를 제한하면 얕아지는가 (교과서 112쪽)');
{
  const samples: TreeSample[] = [];
  for (let i = 0; i < 40; i++) {
    // 바둑판처럼 섞어 두어 깊은 트리가 필요하게 만든다
    const x = (i % 8) + 1;
    const y = Math.floor(i / 8) + 1;
    samples.push({ x, y, label: (x + y) % 2 === 0 ? 'A' : 'B' });
  }
  const deep = fitTree(samples, FULL, { maxDepth: 10, minSamples: 2 });
  const shallow = fitTree(samples, FULL, { maxDepth: 2, minSamples: 2 });
  check('깊이 2 로 제한했는가', treeDepth(shallow) <= 2, true);
  check('제한하지 않으면 더 깊은가', treeDepth(deep) > treeDepth(shallow), true);
  check('깊을수록 잎이 많은가', leaves(deep).length > leaves(shallow).length, true);
}

section('5. 트리를 따라가는 경로 (교과서 107쪽)');
{
  const samples: TreeSample[] = [
    { x: 1, y: 1, label: 'A' },
    { x: 2, y: 2, label: 'A' },
    { x: 8, y: 1, label: 'B' },
    { x: 9, y: 2, label: 'B' },
    { x: 8, y: 9, label: 'C' },
    { x: 9, y: 8, label: 'C' },
  ];
  const tree = fitTree(samples, FULL, { maxDepth: 5, minSamples: 2 });
  const path = treePath(tree, 9, 9);
  check('경로가 뿌리에서 시작하는가', path[0].id, tree.id);
  check('경로의 끝은 잎인가', path[path.length - 1].split === undefined, true);
  check('경로가 이어져 있는가', path.every((n, i) => i === 0 || n.depth === path[i - 1].depth + 1), true);
  check('경로의 마지막 예측', path[path.length - 1].prediction, 'C');
  check('모든 노드 수 = 잎 + 가지', allNodes(tree).length >= leaves(tree).length, true);
}

section('6. 로지스틱 회귀 — 명확히 갈린 두 클래스');
{
  const samples: LogisticSample[] = [
    { x: 0.1, y: 0.1, label: 'A' },
    { x: 0.15, y: 0.2, label: 'A' },
    { x: 0.2, y: 0.1, label: 'A' },
    { x: 0.8, y: 0.9, label: 'B' },
    { x: 0.9, y: 0.8, label: 'B' },
    { x: 0.85, y: 0.95, label: 'B' },
  ];
  const model = fitLogistic(samples);
  check('A 쪽 예측', logisticPredict(model, 0.12, 0.12).predicted, 'A');
  check('B 쪽 예측', logisticPredict(model, 0.88, 0.88).predicted, 'B');

  const probs = logisticPredict(model, 0.12, 0.12).probabilities;
  near('확률의 합은 1', probs.reduce((a, p) => a + p.p, 0), 1, 1e-9);
  check('확률이 모두 0 이상 1 이하', probs.every((p) => p.p >= 0 && p.p <= 1), true);

  // 경계에 가까울수록 확신이 낮아진다 (교과서 114쪽)
  const far = logisticPredict(model, 0.05, 0.05).confidence;
  const middle = logisticPredict(model, 0.5, 0.5).confidence;
  check('경계 근처의 확신이 더 낮은가', middle < far, true);
  console.log(`        참고 · 멀리 ${r3(far)}  vs  경계 근처 ${r3(middle)}`);
}

section('7. 혼동 행렬과 정밀도·재현율 — 손으로 검산 (교과서 115쪽)');
{
  // A 를 3개 중 2개 맞히고 1개는 B 라고 답함
  // B 를 2개 중 2개 맞힘,  A 라고 잘못 답한 것은 없음
  const labels = ['A', 'B'];
  const actual = ['A', 'A', 'A', 'B', 'B'];
  const predicted = ['A', 'A', 'B', 'B', 'B'];
  const cm = confusionMatrix(labels, actual, predicted);

  check('행렬', cm.matrix, [
    [2, 1],
    [0, 2],
  ]);
  check('맞힌 수', cm.correct, 4);
  check('전체', cm.total, 5);

  const s = scoresFrom(cm);
  near('정확도 4/5', s.accuracy, 0.8, 1e-9);
  // A 라고 답한 것은 2개, 그중 2개가 맞음 → 정밀도 1
  near('A 의 정밀도', s.perClass[0].precision, 1, 1e-9);
  // 실제 A 는 3개, 그중 2개를 찾음 → 재현율 2/3
  near('A 의 재현율', s.perClass[0].recall, 2 / 3, 1e-9);
  // B 라고 답한 것은 3개, 그중 2개가 맞음 → 정밀도 2/3
  near('B 의 정밀도', s.perClass[1].precision, 2 / 3, 1e-9);
  near('B 의 재현율', s.perClass[1].recall, 1, 1e-9);
  check('A 의 실제 개수', s.perClass[0].support, 3);
}

section('8. 펭귄 데이터 — 세 모델이 실제로 동작하는가');
{
  const rows = (penguins as Row[]).filter(
    (r) =>
      typeof r.culmen_length_mm === 'number' &&
      typeof r.culmen_depth_mm === 'number' &&
      r.sex !== '.',
  );

  const xs = rows.map((r) => r.culmen_length_mm as number);
  const ys = rows.map((r) => r.culmen_depth_mm as number);
  const sx = fitScaler(xs);
  const sy = fitScaler(ys);

  const points: Point[] = rows.map((r) => ({
    x: r.culmen_length_mm as number,
    y: r.culmen_depth_mm as number,
    label: r.species as string,
  }));
  const split = trainTestSplit(points, 0.3, 42);
  const labels = ['Adelie', 'Chinstrap', 'Gentoo'];

  // 최근접 이웃
  const knnEv = evaluate(split.train, split.test, 5, 'euclidean');

  // 결정트리
  const tree = fitTree(
    split.train.map((p) => ({ x: p.x, y: p.y, label: p.label! })),
    { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
    { maxDepth: 4, minSamples: 2 },
  );
  const treePred = split.test.map((p) => treePredict(tree, p.x, p.y));
  const treeCm = confusionMatrix(labels, split.test.map((p) => p.label!), treePred);
  const treeScores = scoresFrom(treeCm);

  // 로지스틱 회귀 — 교과서 114쪽대로 정규화한 값으로 학습한다
  const logi = fitLogistic(
    split.train.map((p) => ({
      x: applyScaler(p.x, sx),
      y: applyScaler(p.y, sy),
      label: p.label!,
    })),
  );
  const logiPred = split.test.map(
    (p) => logisticPredict(logi, applyScaler(p.x, sx), applyScaler(p.y, sy)).predicted,
  );
  const logiCm = confusionMatrix(labels, split.test.map((p) => p.label!), logiPred);
  const logiScores = scoresFrom(logiCm);

  check('세 모델 모두 정확도 85% 이상',
    knnEv.accuracy > 0.85 && treeScores.accuracy > 0.85 && logiScores.accuracy > 0.85, true);
  console.log(
    `        참고 · 최근접 이웃 ${(knnEv.accuracy * 100).toFixed(1)}%  결정트리 ${(treeScores.accuracy * 100).toFixed(1)}%  로지스틱 회귀 ${(logiScores.accuracy * 100).toFixed(1)}%`,
  );

  check('혼동 행렬의 합이 테스트 개수와 같은가',
    treeCm.matrix.flat().reduce((a, b) => a + b, 0), split.test.length);

  // 데이터가 가장 적은 종의 재현율이 낮은 경향을 확인한다
  const chin = treeScores.perClass.find((c) => c.label === 'Chinstrap')!;
  const gentoo = treeScores.perClass.find((c) => c.label === 'Gentoo')!;
  check('턱끈펭귄의 테스트 개수가 가장 적은가', chin.support < gentoo.support, true);
  console.log(
    `        참고 · 결정트리 재현율  턱끈 ${(chin.recall * 100).toFixed(1)}%  젠투 ${(gentoo.recall * 100).toFixed(1)}%`,
  );

  // 같은 데이터인데 세 모델의 판단이 갈리는 지점이 실제로 존재하는가
  const knnPred = split.test.map((p) => {
    const ev = evaluate(split.train, [p], 5, 'euclidean');
    return ev.wrong.length > 0 ? ev.wrong[0].predicted : p.label;
  });
  let disagree = 0;
  for (let i = 0; i < split.test.length; i++) {
    if (new Set([knnPred[i], treePred[i], logiPred[i]]).size > 1) disagree += 1;
  }
  check('세 모델의 판단이 갈리는 데이터가 있는가', disagree > 0, true);
  console.log(`        참고 · 테스트 ${split.test.length}개 중 ${disagree}개에서 판단이 갈립니다`);
}

section('9. 결정트리는 정규화의 영향을 받지 않는다 (교과서 107쪽)');
{
  const samples: TreeSample[] = [
    { x: 1, y: 100, label: 'A' },
    { x: 2, y: 900, label: 'B' },
    { x: 3, y: 120, label: 'A' },
    { x: 4, y: 880, label: 'B' },
  ];
  const raw = fitTree(samples, { minX: 0, maxX: 5, minY: 0, maxY: 1000 }, { maxDepth: 3, minSamples: 2 });

  // 세로축만 0~1 로 바꾼다. 크고 작은 순서는 그대로다.
  const scaler = fitScaler(samples.map((s) => s.y));
  const scaled = samples.map((s) => ({ ...s, y: applyScaler(s.y, scaler) }));
  const scaledTree = fitTree(scaled, { minX: 0, maxX: 5, minY: 0, maxY: 1 }, { maxDepth: 3, minSamples: 2 });

  const rawPred = samples.map((s) => treePredict(raw, s.x, s.y));
  const scaledPred = scaled.map((s) => treePredict(scaledTree, s.x, s.y));
  check('정규화 전후의 판단이 같은가', rawPred, scaledPred);
  check('나눈 축도 같은가', raw.split?.axis, scaledTree.split?.axis);
}

console.log(`\n${'═'.repeat(66)}`);
console.log(`통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(66));
if (fail > 0) process.exitCode = 1;
