/**
 * 알고리즘 검증
 * 설계서 6절의 검증 계획대로, 사람이 손으로 확인할 수 있는 작은 데이터로
 * 먼저 확인한다. 검증되지 않은 알고리즘은 화면에 연결하지 않는다.
 *
 * 실행:  node --experimental-strip-types src/core/search/verify.ts
 */
import { collectSteps } from './bestFirst';
import { makeGraphProblem } from './graphProblem';
import {
  PUZZLE_GOAL,
  PUZZLE_START,
  makePuzzleProblem,
  misplacedTiles,
  slide,
} from './puzzle';
import { DEFAULT_CITY_GRAPH } from '../../data/cityGraph';
import type { SearchProblem } from './types';

let pass = 0;
let fail = 0;

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

function section(title: string) {
  console.log(`\n${title}`);
  console.log('─'.repeat(64));
}

// ─────────────────────────────────────────────────────────────
section('1. 너비 우선 탐색 — 교과서 31쪽 트리 a~f');
// 교과서 31쪽 옆단: 탐색 순서 a–b–c–d–e–f
{
  const tree: Record<string, string[]> = {
    a: ['b', 'c'],
    b: ['d', 'e'],
    c: ['f'],
    d: [],
    e: [],
    f: [],
  };
  const problem: SearchProblem<string> = {
    title: '교과서 31쪽 트리',
    start: 'a',
    isGoal: (s) => s === 'f',
    moves: (s) => (tree[s] ?? []).map((t) => ({ state: t, cost: 1, action: `${s}→${t}` })),
    key: (s) => s,
    label: (s) => s,
    heuristic: () => 0,
  };
  const { steps, result } = collectSteps(problem, 'bfs');
  const order = steps[steps.length - 1].order;
  check('방문 순서', order, ['a', 'b', 'c', 'd', 'e', 'f']);
  check('목표 발견', result.found, true);
}

// ─────────────────────────────────────────────────────────────
section('2. 균일 비용 탐색 — 교과서 32~33쪽 도시 지도');
{
  const problem = makeGraphProblem(DEFAULT_CITY_GRAPH);
  const { result } = collectSteps(problem, 'ucs');
  check('최종 경로', result.path, ['a', 'c', 'd', 'e']);
  check('총비용', result.totalCost, 12);
  check('테스트한 노드 수', result.expanded, 5);
}

// ─────────────────────────────────────────────────────────────
section('3. 오픈 리스트 갱신 규칙 — 교과서 33쪽');
// c를 거쳐 b로 가면 4+5=9 이지만, 오픈 리스트에 이미 b(5)가 있으므로 b(5)를 남긴다.
{
  const problem = makeGraphProblem(DEFAULT_CITY_GRAPH);
  const { steps } = collectSteps(problem, 'ucs');
  // steps[0]은 시작 스냅숏이므로 a를 확장한 단계는 steps[1]
  const afterA = steps[1];
  check(
    'a 확장 직후 오픈 리스트',
    afterA.open.map((e) => `${e.key}(${e.g})`).sort(),
    ['b(5)', 'c(4)'],
  );
  // 그 다음 단계에서 c를 확장한다 → b는 그대로 5, d는 7
  const afterC = steps[2];
  check(
    'c 확장 직후 오픈 리스트',
    afterC.open.map((e) => `${e.key}(${e.g})`).sort(),
    ['b(5)', 'd(7)'],
  );
}

// ─────────────────────────────────────────────────────────────
section('4. 너비 우선 탐색 — 같은 도시 지도 (경로가 달라진다)');
{
  const problem = makeGraphProblem(DEFAULT_CITY_GRAPH);
  const { result } = collectSteps(problem, 'bfs');
  check('최종 경로', result.path, ['a', 'b', 'e']);
  check('총비용', result.totalCost, 14);
}

// ─────────────────────────────────────────────────────────────
section('5. A* 탐색 — 같은 경로를 더 적은 노드로 (교과서 36쪽)');
{
  const problem = makeGraphProblem(DEFAULT_CITY_GRAPH);
  const astar = collectSteps(problem, 'astar').result;
  const ucs = collectSteps(problem, 'ucs').result;
  check('최종 경로', astar.path, ['a', 'c', 'd', 'e']);
  check('총비용', astar.totalCost, 12);
  check('테스트한 노드 수', astar.expanded, 4);
  check('균일 비용보다 적게 테스트했는가', astar.expanded < ucs.expanded, true);
}

// ─────────────────────────────────────────────────────────────
section('6. 휴리스틱값을 모두 0으로 두면 A*는 균일 비용 탐색이 된다');
{
  const zeroH = { ...DEFAULT_CITY_GRAPH, heuristics: { a: 0, b: 0, c: 0, d: 0, e: 0 } };
  const astar = collectSteps(makeGraphProblem(zeroH), 'astar').result;
  const ucs = collectSteps(makeGraphProblem(DEFAULT_CITY_GRAPH), 'ucs').result;
  check('경로가 같은가', astar.path, ucs.path);
  check('테스트한 노드 수가 같은가', astar.expanded, ucs.expanded);
}

// ─────────────────────────────────────────────────────────────
section('7. 모든 비용이 같으면 균일 비용 탐색은 너비 우선 탐색과 같아진다 (교과서 32쪽)');
{
  const flat = {
    ...DEFAULT_CITY_GRAPH,
    edges: DEFAULT_CITY_GRAPH.edges.map((e) => ({ ...e, cost: 1 })),
  };
  const ucs = collectSteps(makeGraphProblem(flat), 'ucs').result;
  const bfs = collectSteps(makeGraphProblem(flat), 'bfs').result;
  check('경로가 같은가', ucs.path, bfs.path);
  check('총비용이 같은가', ucs.totalCost, bfs.totalCost);
}

// ─────────────────────────────────────────────────────────────
section('8. 8퍼즐 휴리스틱값 — 교과서 37쪽 예시');
// 현재 2 8 3 / 1 _ 4 / 7 6 5,  목표 1 2 3 / 8 _ 4 / 7 6 5  →  h(n) = 3
{
  const current = [2, 8, 3, 1, 0, 4, 7, 6, 5];
  check('h(n)', misplacedTiles(current, PUZZLE_GOAL), 3);
  check('목표 상태의 h(n)', misplacedTiles(PUZZLE_GOAL, PUZZLE_GOAL), 0);
}

// ─────────────────────────────────────────────────────────────
section('9. 8퍼즐 간선 정의 — 빈칸의 이동 (교과서 29쪽)');
{
  // 2 8 3 / 1 _ 4 / 7 6 5 에서 빈칸은 가운데(인덱스 4). 네 방향 모두 가능.
  const s = [2, 8, 3, 1, 0, 4, 7, 6, 5];
  check('빈칸을 위로', slide(s, 'up'), [2, 0, 3, 1, 8, 4, 7, 6, 5]);
  check('빈칸을 아래로', slide(s, 'down'), [2, 8, 3, 1, 6, 4, 7, 0, 5]);
  check('빈칸을 왼쪽으로', slide(s, 'left'), [2, 8, 3, 0, 1, 4, 7, 6, 5]);
  check('빈칸을 오른쪽으로', slide(s, 'right'), [2, 8, 3, 1, 4, 0, 7, 6, 5]);
  // 모서리에서는 갈 수 없는 방향이 생긴다
  const corner = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  check('왼쪽 위에서 위로는 불가', slide(corner, 'up'), null);
  check('왼쪽 위에서 왼쪽으로는 불가', slide(corner, 'left'), null);
}

// ─────────────────────────────────────────────────────────────
section('10. 8퍼즐 A* — 교과서 37쪽 초기 상태에서 목표까지');
{
  const problem = makePuzzleProblem(PUZZLE_START);
  const astar = collectSteps(problem, 'astar', { maxExpanded: 5000 }).result;
  const bfs = collectSteps(makePuzzleProblem(PUZZLE_START), 'bfs', {
    maxExpanded: 5000,
  }).result;
  check('A*가 목표를 찾았는가', astar.found, true);
  check('A* 경로 길이(이동 횟수)', astar.path.length - 1, 5);
  check('너비 우선도 같은 길이의 경로를 찾았는가', bfs.path.length - 1, 5);
  check('A*가 더 적은 노드를 테스트했는가', astar.expanded < bfs.expanded, true);
  console.log(
    `        참고 · 테스트한 노드 수  너비 우선 ${bfs.expanded}개  vs  A* ${astar.expanded}개`,
  );
}

// ─────────────────────────────────────────────────────────────
section('11. 되돌리기 — 단계 배열의 인덱스만 줄이면 된다');
{
  const problem = makeGraphProblem(DEFAULT_CITY_GRAPH);
  const { steps } = collectSteps(problem, 'ucs');
  check('단계가 순서대로 번호를 갖는가', steps.map((s) => s.index), [1, 2, 3, 4, 5, 6]);
  check('마지막 단계가 목표 발견인가', steps[steps.length - 1].phase, 'found');
  check('각 단계가 서로 다른 객체인가', steps[1].open !== steps[2].open, true);
}

// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
section('12. 8퍼즐 탐색 트리의 층별 순서 — 부모 순서대로 놓이는가');
// 상태 문자열로 정렬하면 부모가 다른 노드끼리 뒤섞여 선이 교차한다.
// 부모 순서 → 만들어진 순서로 놓아야 왼쪽에서 오른쪽으로 읽는 순서가 탐색 순서와 맞는다.
{
  const { steps } = collectSteps(makePuzzleProblem(PUZZLE_START), 'bfs', {
    maxExpanded: 40,
  });
  const last = steps[steps.length - 1];

  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  const root = PUZZLE_START.join('');
  for (const e of last.edges) {
    if (parentOf.has(e.to) || e.to === root) continue;
    parentOf.set(e.to, e.from);
    const list = childrenOf.get(e.from) ?? [];
    list.push(e.to);
    childrenOf.set(e.from, list);
  }

  const levels: string[][] = [[root]];
  for (let d = 0; d < 3; d++) {
    const next: string[] = [];
    for (const p of levels[d]) for (const c of childrenOf.get(p) ?? []) next.push(c);
    if (next.length === 0) break;
    levels.push(next);
  }

  check('층 수', levels.length, 4);
  check('깊이 1의 노드 수 (빈칸이 아래 가운데 → 위·왼쪽·오른쪽)', levels[1].length, 3);

  // 같은 부모의 자식들이 붙어 있어야 한다 = 부모별로 한 덩어리
  const contiguous = (level: string[]) => {
    const seen: string[] = [];
    for (const k of level) {
      const p = parentOf.get(k)!;
      if (seen[seen.length - 1] !== p) {
        if (seen.includes(p)) return false; // 떨어져 나타나면 교차가 생긴다
        seen.push(p);
      }
    }
    return true;
  };
  check('깊이 2에서 형제가 붙어 있는가', contiguous(levels[2]), true);
  check('깊이 3에서 형제가 붙어 있는가', contiguous(levels[3]), true);

  // 예전 방식(상태 문자열 정렬)과 실제로 달라야 한다
  const sorted = [...levels[3]].sort();
  check('상태 문자열 정렬과 다른 순서인가', JSON.stringify(levels[3]) !== JSON.stringify(sorted), true);
}

console.log(`\n${'═'.repeat(64)}`);
console.log(`통과 ${pass}개 · 실패 ${fail}개`);
console.log('═'.repeat(64));
if (fail > 0) process.exitCode = 1;
