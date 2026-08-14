/**
 * 탐색 실험실 공통 타입
 * 교과서 Ⅰ-02 인공지능과 탐색 (인쇄 26~37쪽)
 *
 * 세 가지 탐색 알고리즘(너비 우선 / 균일 비용 / A*)은 모두
 * "오픈 리스트에서 하나를 골라 → 목표인지 테스트 → 자식 상태 생성"
 * 이라는 같은 뼈대를 가진다. 무엇을 기준으로 고르느냐만 다르다.
 *   - 너비 우선 : 먼저 들어온 것부터        (교과서 31쪽)
 *   - 균일 비용 : 누적 비용 g가 가장 작은 것 (교과서 32쪽)
 *   - A*        : f = g + h 가 가장 작은 것  (교과서 36쪽)
 * 그래서 알고리즘을 따로 만들지 않고 '고르는 함수'만 교체한다.
 */

/** 상태를 문자열 하나로 구분하기 위한 키 (예: 도시 'a', 8퍼즐 '283164705') */
export type StateKey = string;

/** 탐색 방법 */
export type SearchMethod = 'bfs' | 'ucs' | 'greedy' | 'astar';

/** 한 상태에서 갈 수 있는 다음 상태 하나 */
export interface Move<S> {
  state: S;
  /** 이 간선을 지나는 데 드는 비용 */
  cost: number;
  /** 학생에게 보여 줄 행동 이름 (예: '빈칸을 위로') */
  action: string;
}

/**
 * 탐색으로 풀 문제의 정의.
 * 도시 지도든 8퍼즐이든 이 형태만 맞추면 세 알고리즘이 그대로 돌아간다.
 */
export interface SearchProblem<S> {
  /** 문제 이름 (화면 표시용) */
  title: string;
  start: S;
  isGoal(state: S): boolean;
  /** 다음 상태 목록. 교과서에서 정한 순서를 그대로 지킨다. */
  moves(state: S): Move<S>[];
  /** 상태를 구분하는 키 */
  key(state: S): StateKey;
  /** 화면에 보여 줄 짧은 이름 */
  label(state: S): string;
  /** 휴리스틱값 h(n). 너비 우선·균일 비용에서는 쓰이지 않는다. */
  heuristic(state: S): number;
}

/** 오픈/닫힌 리스트에 들어가는 항목 하나 */
export interface Entry<S> {
  key: StateKey;
  state: S;
  /** 초기 상태에서 여기까지 온 누적 비용 (교과서 32쪽) */
  g: number;
  /** 목표까지 남은 비용의 추정값 (교과서 35쪽) */
  h: number;
  /** f = g + h (교과서 36쪽) */
  f: number;
  /** 어느 상태에서 왔는지 */
  parent: StateKey | null;
  /** 어떤 행동으로 왔는지 */
  action: string | null;
  /** 트리에서의 깊이 */
  depth: number;
}

/** 한 단계가 끝났을 때의 화면 상태 */
export interface SearchStep<S> {
  /** 몇 번째 단계인가 (1부터) */
  index: number;
  /** 이번 단계에서 무슨 일이 일어났는가 */
  phase: 'start' | 'select' | 'expand' | 'found' | 'fail';
  /** 지금 테스트 중인 상태 */
  current: Entry<S> | null;
  open: Entry<S>[];
  closed: Entry<S>[];
  /** 이번 단계에서 새로 만들어진 자식들 */
  generated: Entry<S>[];
  /** 이번 단계에서 값이 갱신된 항목의 키 (화면에서 강조 표시용) */
  updated: StateKey[];
  /** 테스트한 순서 — 노드 옆에 ①②③ 을 붙이는 데 쓴다 */
  order: StateKey[];
  /** 지금까지 만들어진 부모-자식 관계 전체 */
  edges: { from: StateKey; to: StateKey; action: string }[];
  /** 학생에게 보여 줄 한 줄 설명 */
  message: string;
  found: boolean;
  /** 목표를 찾았을 때의 경로 */
  path?: Entry<S>[];
  totalCost?: number;
}

/** 탐색이 끝난 뒤의 요약 — 세 알고리즘 비교표에 쓴다. 상태가 아닌 키만 담는다. */
export interface SearchResult {
  method: SearchMethod;
  found: boolean;
  /** 테스트(확장)한 노드 수 */
  expanded: number;
  /** 만들어진 노드 수 */
  generated: number;
  path: StateKey[];
  totalCost: number;
  steps: number;
}
