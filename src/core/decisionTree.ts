/**
 * 결정트리
 * 교과서 Ⅱ-02 인쇄 107·112쪽
 *
 * 결과만 보여 주지 않고 '어떤 질문으로 데이터를 나누는가'를 드러내야 하므로
 * 직접 구현했다. 각 노드가 담당하는 영역(bounds)을 함께 계산해 두어,
 * 트리의 노드를 누르면 산점도의 해당 영역을 강조할 수 있게 했다.
 */

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface TreeSample {
  x: number;
  y: number;
  label: string;
}

export interface TreeNode {
  id: number;
  depth: number;
  /** 이 노드에 들어온 데이터 수 */
  samples: number;
  /** 클래스별 개수 */
  counts: Record<string, number>;
  /** 지니 계수 — 0 이면 한 종류만 남은 것 (교과서 107쪽) */
  gini: number;
  /** 이 노드가 답한다면 무엇이라고 답할지 (가장 많은 클래스) */
  prediction: string;
  /** 이 노드가 담당하는 화면 영역 */
  bounds: Bounds;
  /** 나누는 조건. 잎 노드에는 없다. */
  split?: {
    /** 0 이면 가로축, 1 이면 세로축 */
    axis: 0 | 1;
    threshold: number;
  };
  left?: TreeNode;
  right?: TreeNode;
}

/**
 * 지니 계수
 * 한 노드에 여러 클래스가 섞여 있을수록 커진다.
 * 모두 같은 클래스면 0 이다.
 */
export function gini(counts: Record<string, number>, total: number): number {
  if (total === 0) return 0;
  let sum = 0;
  for (const n of Object.values(counts)) {
    const p = n / total;
    sum += p * p;
  }
  return 1 - sum;
}

function countLabels(samples: TreeSample[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of samples) counts[s.label] = (counts[s.label] ?? 0) + 1;
  return counts;
}

function majority(counts: Record<string, number>): string {
  let best = '';
  let bestN = -1;
  // 개수가 같으면 이름 순서로 정해 결과가 흔들리지 않게 한다
  for (const [label, n] of Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (n > bestN) {
      best = label;
      bestN = n;
    }
  }
  return best;
}

export interface TreeOptions {
  maxDepth: number;
  /** 이보다 적게 남으면 더 나누지 않는다 */
  minSamples: number;
}

let nextId = 0;

function build(
  samples: TreeSample[],
  bounds: Bounds,
  depth: number,
  options: TreeOptions,
): TreeNode {
  const counts = countLabels(samples);
  const node: TreeNode = {
    id: nextId++,
    depth,
    samples: samples.length,
    counts,
    gini: gini(counts, samples.length),
    prediction: majority(counts),
    bounds,
  };

  if (
    depth >= options.maxDepth ||
    samples.length < options.minSamples ||
    node.gini === 0
  ) {
    return node;
  }

  // 가장 잘 나누는 조건 하나를 찾는다.
  // 축과 나란한 직선으로만 나누므로 결정 영역이 계단 모양이 된다.
  let best: { axis: 0 | 1; threshold: number; score: number } | null = null;

  for (const axis of [0, 1] as const) {
    const values = [...new Set(samples.map((s) => (axis === 0 ? s.x : s.y)))].sort(
      (a, b) => a - b,
    );
    for (let i = 0; i < values.length - 1; i++) {
      const threshold = (values[i] + values[i + 1]) / 2;
      const left = samples.filter((s) => (axis === 0 ? s.x : s.y) <= threshold);
      const right = samples.filter((s) => (axis === 0 ? s.x : s.y) > threshold);
      if (left.length === 0 || right.length === 0) continue;

      // 나눈 뒤의 지니 계수를 개수로 가중평균한다. 작을수록 잘 나눈 것이다.
      const score =
        (left.length / samples.length) * gini(countLabels(left), left.length) +
        (right.length / samples.length) * gini(countLabels(right), right.length);

      if (best === null || score < best.score - 1e-12) {
        best = { axis, threshold, score };
      }
    }
  }

  // 어떻게 나누어도 나아지지 않으면 여기서 멈춘다
  if (best === null || best.score >= node.gini - 1e-12) return node;

  const { axis, threshold } = best;
  node.split = { axis, threshold };

  const leftSamples = samples.filter((s) => (axis === 0 ? s.x : s.y) <= threshold);
  const rightSamples = samples.filter((s) => (axis === 0 ? s.x : s.y) > threshold);

  const leftBounds: Bounds =
    axis === 0 ? { ...bounds, maxX: threshold } : { ...bounds, maxY: threshold };
  const rightBounds: Bounds =
    axis === 0 ? { ...bounds, minX: threshold } : { ...bounds, minY: threshold };

  node.left = build(leftSamples, leftBounds, depth + 1, options);
  node.right = build(rightSamples, rightBounds, depth + 1, options);
  return node;
}

export function fitTree(
  samples: TreeSample[],
  bounds: Bounds,
  options: TreeOptions,
): TreeNode {
  nextId = 0;
  return build(samples, bounds, 0, options);
}

/** 한 점이 트리를 따라 어느 잎까지 가는지 경로를 함께 돌려준다 */
export function treePath(root: TreeNode, x: number, y: number): TreeNode[] {
  const path: TreeNode[] = [root];
  let node = root;
  while (node.split && node.left && node.right) {
    const v = node.split.axis === 0 ? x : y;
    node = v <= node.split.threshold ? node.left : node.right;
    path.push(node);
  }
  return path;
}

export function treePredict(root: TreeNode, x: number, y: number): string {
  const path = treePath(root, x, y);
  return path[path.length - 1].prediction;
}

/** 잎 노드만 모은다. 결정 영역을 사각형으로 그릴 때 쓴다. */
export function leaves(root: TreeNode): TreeNode[] {
  if (!root.left || !root.right) return [root];
  return [...leaves(root.left), ...leaves(root.right)];
}

/** 트리의 모든 노드 */
export function allNodes(root: TreeNode): TreeNode[] {
  if (!root.left || !root.right) return [root];
  return [root, ...allNodes(root.left), ...allNodes(root.right)];
}

export function treeDepth(root: TreeNode): number {
  if (!root.left || !root.right) return root.depth;
  return Math.max(treeDepth(root.left), treeDepth(root.right));
}
