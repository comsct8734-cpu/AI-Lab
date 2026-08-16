/**
 * 최근접 이웃 (k-Nearest Neighbors)
 * 교과서 Ⅱ-02 인쇄 108~109·114쪽
 *
 * 이 모델의 핵심은 결과가 아니라 '무엇을 근거로 판단했는가'이다.
 * 그래서 예측값만 돌려주지 않고, 참고한 이웃 k개와 각각의 거리·클래스를
 * 함께 돌려준다. 화면에서 이웃을 선으로 잇고 표로 보여 주기 위해서다.
 */

export type Distance = 'euclidean' | 'manhattan';

export const DISTANCE_LABEL: Record<Distance, string> = {
  euclidean: '유클리디언 거리',
  manhattan: '맨해튼 거리',
};

export const DISTANCE_HELP: Record<Distance, string> = {
  euclidean: '두 점을 잇는 가장 짧은 직선의 길이입니다.',
  manhattan: '가로로 간 거리와 세로로 간 거리를 더한 값입니다.',
};

/** 2차원 위의 한 점. label 이 있으면 학습 데이터, 없으면 판단할 대상이다. */
export interface Point {
  x: number;
  y: number;
  label?: string;
  /** 원본 데이터에서 몇 번째 행인지 */
  index?: number;
}

export function distanceBetween(a: Point, b: Point, kind: Distance): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  if (kind === 'manhattan') return Math.abs(dx) + Math.abs(dy);
  return Math.sqrt(dx * dx + dy * dy);
}

export interface Neighbor {
  point: Point;
  distance: number;
  label: string;
}

export interface KnnResult {
  /** 다수결로 정해진 클래스 */
  predicted: string | null;
  /** 판단에 사용된 이웃 k개 (가까운 순) */
  neighbors: Neighbor[];
  /** 클래스별 표의 수 */
  votes: { label: string; count: number }[];
  /** 표가 같아서 가장 가까운 이웃으로 정한 경우 */
  tie: boolean;
}

/**
 * 새로운 점 하나를 분류한다.
 *
 * 표가 같을 때는 더 가까운 이웃이 있는 클래스를 고른다.
 * (교과서에는 동점 처리 규칙이 없으므로, 학생이 이해하기 쉬운 방식을 골랐고
 *  화면에도 '표가 같아 가까운 이웃으로 정했다'고 표시한다.)
 */
export function knnClassify(
  train: Point[],
  target: Point,
  k: number,
  kind: Distance = 'euclidean',
): KnnResult {
  const labeled = train.filter((p): p is Point & { label: string } => p.label != null);
  if (labeled.length === 0) {
    return { predicted: null, neighbors: [], votes: [], tie: false };
  }

  const sorted = labeled
    .map((p) => ({ point: p, distance: distanceBetween(p, target, kind), label: p.label }))
    .sort((a, b) => a.distance - b.distance);

  const neighbors = sorted.slice(0, Math.min(k, sorted.length));

  const counts = new Map<string, number>();
  for (const n of neighbors) counts.set(n.label, (counts.get(n.label) ?? 0) + 1);

  const votes = [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const top = votes[0].count;
  const tied = votes.filter((v) => v.count === top);
  let predicted = votes[0].label;
  if (tied.length > 1) {
    // 동점이면 가장 가까운 이웃의 클래스를 따른다
    const tiedLabels = new Set(tied.map((v) => v.label));
    predicted = neighbors.find((n) => tiedLabels.has(n.label))?.label ?? predicted;
  }

  return { predicted, neighbors, votes, tie: tied.length > 1 };
}

/**
 * 결정 영역 계산 (교과서 106쪽 활동 5)
 * 화면을 격자로 나누어 각 칸이 어떤 클래스로 분류되는지 미리 구한다.
 * 격자 수 × 데이터 수만큼 거리 계산이 일어나므로, 조작 중에는 해상도를 낮춘다.
 */
export function decisionGrid(
  train: Point[],
  k: number,
  kind: Distance,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  resolution: number,
): (string | null)[] {
  const cells: (string | null)[] = new Array(resolution * resolution);
  const spanX = bounds.maxX - bounds.minX || 1;
  const spanY = bounds.maxY - bounds.minY || 1;

  for (let row = 0; row < resolution; row++) {
    // 화면의 위쪽이 y 값이 큰 쪽이 되도록 뒤집는다
    const y = bounds.maxY - (spanY * (row + 0.5)) / resolution;
    for (let col = 0; col < resolution; col++) {
      const x = bounds.minX + (spanX * (col + 0.5)) / resolution;
      cells[row * resolution + col] = knnClassify(train, { x, y }, k, kind).predicted;
    }
  }
  return cells;
}

/** 정확도 — 테스트 데이터 중 맞힌 비율 (교과서 108·115쪽) */
export interface Evaluation {
  total: number;
  correct: number;
  accuracy: number;
  /** 잘못 분류한 데이터 */
  wrong: { point: Point; actual: string; predicted: string | null }[];
}

export function evaluate(
  train: Point[],
  test: Point[],
  k: number,
  kind: Distance,
): Evaluation {
  const wrong: Evaluation['wrong'] = [];
  let correct = 0;
  for (const p of test) {
    if (p.label == null) continue;
    const { predicted } = knnClassify(train, p, k, kind);
    if (predicted === p.label) correct += 1;
    else wrong.push({ point: p, actual: p.label, predicted });
  }
  const total = test.filter((p) => p.label != null).length;
  return { total, correct, accuracy: total === 0 ? 0 : correct / total, wrong };
}
