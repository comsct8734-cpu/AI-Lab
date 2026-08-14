import type { CityGraph } from '../../data/cityGraph';
import type { Move, SearchProblem } from './types';

/** 도시 지도를 탐색 문제로 바꾼다 (교과서 인쇄 32쪽) */
export function makeGraphProblem(graph: CityGraph): SearchProblem<string> {
  /** 인접 목록. 무방향 그래프이므로 양쪽 모두 넣는다. */
  const adjacency = new Map<string, Move<string>[]>();
  for (const node of graph.nodes) adjacency.set(node, []);
  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push({
      state: edge.to,
      cost: edge.cost,
      action: `${edge.from} → ${edge.to}`,
    });
    adjacency.get(edge.to)?.push({
      state: edge.from,
      cost: edge.cost,
      action: `${edge.to} → ${edge.from}`,
    });
  }
  // 교과서와 같은 순서로 보이도록 알파벳순 정렬
  for (const [, list] of adjacency) list.sort((x, y) => x.state.localeCompare(y.state));

  return {
    title: '도시 방문 경로 찾기',
    start: graph.start,
    isGoal: (s) => s === graph.goal,
    moves: (s) => adjacency.get(s) ?? [],
    key: (s) => s,
    label: (s) => s,
    heuristic: (s) => graph.heuristics[s] ?? 0,
  };
}
