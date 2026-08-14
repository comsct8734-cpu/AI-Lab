import type { Move, SearchProblem } from './types';

/**
 * 8퍼즐
 * 교과서 인쇄 28~29쪽 (상태와 간선 정의), 37쪽 (활동 3, 휴리스틱값)
 *
 * 상태는 길이 9의 배열로 나타내고 0을 빈칸으로 본다.
 * 간선은 타일 8개의 이동이 아니라 '빈칸이 움직이는 네 방향'으로 정의한다.
 * (교과서 29쪽에서 관점을 바꾸어 간선을 네 가지로 정의한 것을 그대로 따랐다.)
 */

export type PuzzleState = number[];

/** 교과서 37쪽 활동 3의 초기 상태 */
export const PUZZLE_START: PuzzleState = [2, 8, 3, 1, 6, 4, 7, 0, 5];
/** 교과서 37쪽 활동 3의 목표 상태 */
export const PUZZLE_GOAL: PuzzleState = [1, 2, 3, 8, 0, 4, 7, 6, 5];

export type Direction = 'up' | 'down' | 'left' | 'right';

export const DIRECTION_LABEL: Record<Direction, string> = {
  up: '빈칸을 위로',
  down: '빈칸을 아래로',
  left: '빈칸을 왼쪽으로',
  right: '빈칸을 오른쪽으로',
};

/**
 * 빈칸을 옮기는 순서.
 * 교과서 37쪽 활동 3의 지시(위쪽, 아래쪽, 왼쪽, 오른쪽)를 기본값으로 한다.
 * 교과서 29쪽 그림은 위·왼쪽·아래·오른쪽 순서로 그려져 있어 순서가 다르다.
 * 순서가 달라지면 같은 알고리즘이라도 탐색 순서가 달라지므로 바꿀 수 있게 두었다.
 */
export const DEFAULT_DIRECTION_ORDER: Direction[] = ['up', 'down', 'left', 'right'];

const DELTA: Record<Direction, { dr: number; dc: number }> = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

export function puzzleKey(state: PuzzleState): string {
  return state.join('');
}

export function sameState(a: PuzzleState, b: PuzzleState): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** 빈칸을 한 방향으로 옮긴 결과. 옮길 수 없으면 null */
export function slide(state: PuzzleState, dir: Direction): PuzzleState | null {
  const blank = state.indexOf(0);
  const r = Math.floor(blank / 3);
  const c = blank % 3;
  const { dr, dc } = DELTA[dir];
  const nr = r + dr;
  const nc = c + dc;
  if (nr < 0 || nr > 2 || nc < 0 || nc > 2) return null;
  const target = nr * 3 + nc;
  const next = [...state];
  next[blank] = next[target];
  next[target] = 0;
  return next;
}

/**
 * 휴리스틱값 h(n)
 * 교과서 37쪽 정의: 목표 상태와 일치하지 않는 숫자 타일의 수 (공백 제외)
 */
export function misplacedTiles(state: PuzzleState, goal: PuzzleState): number {
  let count = 0;
  for (let i = 0; i < 9; i++) {
    if (state[i] === 0) continue; // 공백은 세지 않는다
    if (state[i] !== goal[i]) count += 1;
  }
  return count;
}

/** 어떤 8퍼즐 상태가 목표 상태에 도달할 수 있는지 확인 (짝수 개의 뒤바뀜만 가능) */
export function isSolvable(state: PuzzleState, goal: PuzzleState): boolean {
  const inversions = (arr: PuzzleState) => {
    const flat = arr.filter((v) => v !== 0);
    let n = 0;
    for (let i = 0; i < flat.length; i++) {
      for (let j = i + 1; j < flat.length; j++) {
        if (flat[i] > flat[j]) n += 1;
      }
    }
    return n;
  };
  return inversions(state) % 2 === inversions(goal) % 2;
}

export interface PuzzleOptions {
  goal?: PuzzleState;
  directionOrder?: Direction[];
  /** 휴리스틱을 쓰지 않는 실험에서는 0으로 둘 수 있다 */
  useHeuristic?: boolean;
}

export function makePuzzleProblem(
  start: PuzzleState = PUZZLE_START,
  options: PuzzleOptions = {},
): SearchProblem<PuzzleState> {
  const goal = options.goal ?? PUZZLE_GOAL;
  const order = options.directionOrder ?? DEFAULT_DIRECTION_ORDER;
  const useHeuristic = options.useHeuristic ?? true;

  return {
    title: '8퍼즐',
    start,
    isGoal: (s) => sameState(s, goal),
    moves: (s) => {
      const list: Move<PuzzleState>[] = [];
      for (const dir of order) {
        const next = slide(s, dir);
        if (next) {
          // 교과서에서는 비용 정보가 없으므로 모든 간선의 비용을 1로 본다 (31쪽)
          list.push({ state: next, cost: 1, action: DIRECTION_LABEL[dir] });
        }
      }
      return list;
    },
    key: puzzleKey,
    label: (s) => puzzleKey(s),
    heuristic: (s) => (useHeuristic ? misplacedTiles(s, goal) : 0),
  };
}
