import type {
  Entry,
  SearchMethod,
  SearchProblem,
  SearchResult,
  SearchStep,
  StateKey,
} from './types';

/**
 * 세 가지 탐색을 하나의 코드로 실행한다.
 * 제너레이터로 만들었기 때문에 한 단계 실행 / 자동 실행 / 되돌리기를
 * 알고리즘을 고치지 않고 화면 쪽에서 모두 처리할 수 있다.
 *
 * 교과서 근거
 *  - 너비 우선 탐색 진행 방식 : 인쇄 30~31쪽
 *  - 균일 비용 탐색과 오픈/닫힌 리스트 : 인쇄 32~33쪽
 *  - A* 탐색과 f(n)=g(n)+h(n) : 인쇄 36쪽
 */

/** 오픈 리스트에서 다음에 테스트할 항목의 인덱스를 고른다 */
function pickIndex<S>(open: Entry<S>[], method: SearchMethod): number {
  if (open.length === 0) return -1;

  // 너비 우선 탐색은 먼저 들어온 것부터 꺼낸다 (교과서 31쪽)
  if (method === 'bfs') return 0;

  // 나머지는 평갓값이 가장 작은 것부터 (최상 우선 탐색, 교과서 32쪽)
  const score = (e: Entry<S>) => {
    if (method === 'ucs') return e.g; // 누적 비용만 사용
    if (method === 'greedy') return e.h; // 휴리스틱값만 사용
    return e.f; // A* : g + h
  };

  let best = 0;
  for (let i = 1; i < open.length; i++) {
    if (score(open[i]) < score(open[best])) best = i;
  }
  return best;
}

/** 소수점이 생기는 비용도 자연스럽게 보이도록 정리 */
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface RunOptions {
  /** 안전장치. 8퍼즐에서 너비 우선 탐색이 폭발하는 것을 막는다. */
  maxExpanded?: number;
}

/**
 * 탐색 한 단계씩 실행. 각 단계의 화면 상태를 yield 한다.
 * 마지막에 요약 결과를 return 한다.
 */
export function* runSearch<S>(
  problem: SearchProblem<S>,
  method: SearchMethod,
  options: RunOptions = {},
): Generator<SearchStep<S>, SearchResult, void> {
  const maxExpanded = options.maxExpanded ?? 3000;

  const startEntry: Entry<S> = {
    key: problem.key(problem.start),
    state: problem.start,
    g: 0,
    h: round(problem.heuristic(problem.start)),
    f: round(problem.heuristic(problem.start)),
    parent: null,
    action: null,
    depth: 0,
  };

  const open: Entry<S>[] = [startEntry];
  const closed: Entry<S>[] = [];
  const closedKeys = new Set<StateKey>();
  const order: StateKey[] = [];
  const edges: { from: StateKey; to: StateKey; action: string }[] = [];
  /** 경로 복원을 위해 모든 항목을 키로 보관 */
  const bestEntry = new Map<StateKey, Entry<S>>([[startEntry.key, startEntry]]);

  let stepIndex = 0;
  let generatedCount = 1;

  const snapshot = (
    phase: SearchStep<S>['phase'],
    current: Entry<S> | null,
    generated: Entry<S>[],
    updated: StateKey[],
    message: string,
    extra: Partial<SearchStep<S>> = {},
  ): SearchStep<S> => ({
    index: ++stepIndex,
    phase,
    current,
    open: open.map((e) => ({ ...e })),
    closed: closed.map((e) => ({ ...e })),
    generated,
    updated,
    order: [...order],
    edges: [...edges],
    message,
    found: false,
    ...extra,
  });

  const buildPath = (goal: Entry<S>): Entry<S>[] => {
    const path: Entry<S>[] = [];
    let cur: Entry<S> | undefined = goal;
    while (cur) {
      path.unshift(cur);
      cur = cur.parent ? bestEntry.get(cur.parent) : undefined;
    }
    return path;
  };

  yield snapshot(
    'start',
    null,
    [],
    [],
    `시작 상태 ${problem.label(problem.start)}을(를) 오픈 리스트에 넣습니다.`,
  );

  while (open.length > 0) {
    if (closed.length >= maxExpanded) {
      yield snapshot(
        'fail',
        null,
        [],
        [],
        `노드를 ${maxExpanded}개까지 테스트했지만 목표를 찾지 못했습니다. ` +
          `상태 수가 많을수록 탐색 시간이 늘어난다는 것을 보여 주는 상황입니다.`,
      );
      return {
        method,
        found: false,
        expanded: closed.length,
        generated: generatedCount,
        path: [],
        totalCost: 0,
        steps: stepIndex,
      };
    }

    // ── 1) 오픈 리스트에서 하나를 고른다
    const idx = pickIndex(open, method);
    const current = open.splice(idx, 1)[0];
    order.push(current.key);

    const reason =
      method === 'bfs'
        ? '먼저 만들어진 순서대로'
        : method === 'ucs'
          ? `누적 비용 g가 가장 작으므로(g=${current.g})`
          : method === 'greedy'
            ? `휴리스틱값 h가 가장 작으므로(h=${current.h})`
            : `f = g + h 가 가장 작으므로(f=${current.f} = ${current.g} + ${current.h})`;

    // ── 2) 목표인지 테스트한다
    if (problem.isGoal(current.state)) {
      closed.push(current);
      closedKeys.add(current.key);
      const path = buildPath(current);
      const step = snapshot(
        'found',
        current,
        [],
        [],
        `${problem.label(current.state)}은(는) 목표 상태입니다. 탐색을 마칩니다.`,
        { found: true, path, totalCost: current.g },
      );
      yield step;
      return {
        method,
        found: true,
        expanded: closed.length,
        generated: generatedCount,
        path: path.map((e) => e.key),
        totalCost: current.g,
        steps: stepIndex,
      };
    }

    closed.push(current);
    closedKeys.add(current.key);

    // ── 3) 자식 상태를 만든다
    const generated: Entry<S>[] = [];
    const updated: StateKey[] = [];
    const skipped: string[] = [];

    for (const move of problem.moves(current.state)) {
      const key = problem.key(move.state);
      const g = round(current.g + move.cost);
      const h = round(problem.heuristic(move.state));

      // 이미 테스트가 끝난 상태는 다시 넣지 않는다
      if (closedKeys.has(key)) {
        skipped.push(problem.label(move.state));
        continue;
      }

      const child: Entry<S> = {
        key,
        state: move.state,
        g,
        h,
        f: round(g + h),
        parent: current.key,
        action: move.action,
        depth: current.depth + 1,
      };

      const existingIdx = open.findIndex((e) => e.key === key);
      if (existingIdx >= 0) {
        // 누적 비용을 판단 기준으로 쓰는 탐색(균일 비용, A*)에서만
        // 더 작은 쪽으로 값을 바꾼다 (교과서 33쪽).
        // 너비 우선 탐색은 비용을 보지 않고 먼저 만들어진 경로를 그대로 두므로
        // 여기서 값을 바꾸면 교과서와 다른 경로가 나온다.
        const costAware = method === 'ucs' || method === 'astar';
        if (!costAware || open[existingIdx].g <= g) {
          skipped.push(`${problem.label(move.state)}(이미 g=${open[existingIdx].g})`);
          continue;
        }
        open[existingIdx] = child;
        bestEntry.set(key, child);
        updated.push(key);
        generated.push(child);
        edges.push({ from: current.key, to: key, action: move.action });
        continue;
      }

      open.push(child);
      bestEntry.set(key, child);
      generated.push(child);
      generatedCount += 1;
      edges.push({ from: current.key, to: key, action: move.action });
    }

    const parts = [
      `${reason} ${problem.label(current.state)}을(를) 테스트했습니다.`,
      '목표 상태가 아니므로 자식 상태를 만듭니다.',
    ];
    if (generated.length > 0) {
      parts.push(`새로 만든 상태: ${generated.map((e) => problem.label(e.state)).join(', ')}`);
    }
    if (updated.length > 0) {
      parts.push('더 작은 누적 비용을 찾아 값을 바꾼 상태가 있습니다.');
    }
    if (generated.length === 0 && updated.length === 0) {
      parts.push('새로 만들 상태가 없습니다.');
    }

    yield snapshot('expand', current, generated, updated, parts.join(' '));
  }

  yield snapshot(
    'fail',
    null,
    [],
    [],
    '오픈 리스트가 비었습니다. 목표 상태에 도달할 수 없습니다.',
  );

  return {
    method,
    found: false,
    expanded: closed.length,
    generated: generatedCount,
    path: [],
    totalCost: 0,
    steps: stepIndex,
  };
}

/** 모든 단계를 한 번에 계산해 배열로 돌려준다. 되돌리기는 이 배열의 인덱스를 줄이면 된다. */
export function collectSteps<S>(
  problem: SearchProblem<S>,
  method: SearchMethod,
  options: RunOptions = {},
): { steps: SearchStep<S>[]; result: SearchResult } {
  const steps: SearchStep<S>[] = [];
  const it = runSearch(problem, method, options);
  let next = it.next();
  while (!next.done) {
    steps.push(next.value);
    next = it.next();
  }
  return { steps, result: next.value };
}

export const METHOD_LABEL: Record<SearchMethod, string> = {
  bfs: '너비 우선 탐색',
  ucs: '균일 비용 탐색',
  greedy: '탐욕적 최상 우선 탐색',
  astar: 'A* 탐색',
};

export const METHOD_HELP: Record<SearchMethod, string> = {
  bfs: '트리의 위쪽부터 한 층씩, 각 층에서는 먼저 만들어진 것부터 차례로 확인합니다.',
  ucs: '지금까지 온 누적 비용 g가 가장 작은 상태를 먼저 확인합니다.',
  greedy: '남은 비용의 추정값 h만 보고 가장 작은 상태를 먼저 확인합니다.',
  astar: '여기까지 온 비용 g와 남은 추정 비용 h를 더한 f를 보고 가장 작은 상태를 먼저 확인합니다.',
};
