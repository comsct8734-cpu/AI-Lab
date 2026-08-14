/**
 * 도시 방문 경로 찾기 문제
 * 교과서 인쇄 32쪽 (간선 비용), 35쪽 (휴리스틱값 = 목표 도시까지의 직선거리)
 *
 * 다섯 도시 a~e 를 잇는 도로망. 도시 a 에서 출발해 도시 e 까지
 * 가는 경로 중 시간이 가장 짧은 경로를 찾는 문제이다.
 */

export interface CityEdge {
  from: string;
  to: string;
  cost: number;
}

export interface CityGraph {
  nodes: string[];
  edges: CityEdge[];
  /** 각 도시에서 목표 도시까지의 직선거리 (휴리스틱값) */
  heuristics: Record<string, number>;
  /** 화면에 그릴 좌표 (0~1 비율) */
  positions: Record<string, { x: number; y: number }>;
  start: string;
  goal: string;
}

/** 교과서와 같은 기본값 */
export const DEFAULT_CITY_GRAPH: CityGraph = {
  nodes: ['a', 'b', 'c', 'd', 'e'],
  edges: [
    { from: 'a', to: 'b', cost: 5 },
    { from: 'a', to: 'c', cost: 4 },
    { from: 'b', to: 'c', cost: 5 },
    { from: 'b', to: 'd', cost: 8 },
    { from: 'b', to: 'e', cost: 9 },
    { from: 'c', to: 'd', cost: 3 },
    { from: 'd', to: 'e', cost: 5 },
  ],
  // 교과서 35쪽: 각 도시에서 목표 도시(e)까지의 직선거리
  heuristics: { a: 12, b: 9, c: 7, d: 5, e: 0 },
  positions: {
    a: { x: 0.08, y: 0.5 },
    b: { x: 0.42, y: 0.16 },
    c: { x: 0.42, y: 0.84 },
    d: { x: 0.72, y: 0.72 },
    e: { x: 0.94, y: 0.42 },
  },
  start: 'a',
  goal: 'e',
};

export function cloneCityGraph(g: CityGraph = DEFAULT_CITY_GRAPH): CityGraph {
  return {
    nodes: [...g.nodes],
    edges: g.edges.map((e) => ({ ...e })),
    heuristics: { ...g.heuristics },
    positions: Object.fromEntries(
      Object.entries(g.positions).map(([k, v]) => [k, { ...v }]),
    ),
    start: g.start,
    goal: g.goal,
  };
}
