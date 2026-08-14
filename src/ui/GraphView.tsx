import type { CityGraph } from '../data/cityGraph';
import type { Entry, SearchMethod, SearchStep, StateKey } from '../core/search/types';

/**
 * 도시 지도 화면 — 설계서 화면 1-2 / 1-3 / 1-4
 *
 * 노드 상태는 색과 모양을 함께 써서 구분한다 (설계서 1-3, 1-8).
 *   테스트 완료 : 채운 원        + 진한 테두리
 *   지금 테스트 : 두꺼운 이중 원
 *   대기(오픈)  : 빈 원 + 점선
 *   아직 안 만듦: 옅은 회색
 */

const W = 720;
const H = 420;
const PAD = 46;

interface Props {
  graph: CityGraph;
  step: SearchStep<string> | null;
  method: SearchMethod;
  /** g/h/f 배지를 항상 보여 줄지. 좁은 화면에서는 f만 보여 준다. */
  showBadges: boolean;
  compact: boolean;
  selectedNode: StateKey | null;
  onSelectNode: (key: StateKey | null) => void;
}

function pos(graph: CityGraph, id: string) {
  const p = graph.positions[id] ?? { x: 0.5, y: 0.5 };
  return { x: PAD + p.x * (W - PAD * 2), y: PAD + p.y * (H - PAD * 2) };
}

export function GraphView({
  graph,
  step,
  method,
  showBadges,
  compact,
  selectedNode,
  onSelectNode,
}: Props) {
  const openMap = new Map<StateKey, Entry<string>>();
  const closedMap = new Map<StateKey, Entry<string>>();
  step?.open.forEach((e) => openMap.set(e.key, e));
  step?.closed.forEach((e) => closedMap.set(e.key, e));

  const orderIndex = new Map<StateKey, number>();
  step?.order.forEach((k, i) => orderIndex.set(k, i + 1));

  const pathKeys = new Set(step?.path?.map((e) => e.key) ?? []);
  const pathEdges = new Set<string>();
  if (step?.path) {
    for (let i = 0; i < step.path.length - 1; i++) {
      const a = step.path[i].key;
      const b = step.path[i + 1].key;
      pathEdges.add([a, b].sort().join('-'));
    }
  }

  const currentKey = step?.current?.key ?? null;
  const showCost = method !== 'bfs';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="도시 지도 탐색 화면">
      <title>도시 지도에서의 탐색 진행 상황</title>

      {/* 간선 */}
      {graph.edges.map((e) => {
        const a = pos(graph, e.from);
        const b = pos(graph, e.to);
        const onPath = pathEdges.has([e.from, e.to].sort().join('-'));
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={`${e.from}-${e.to}`}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={onPath ? 'var(--accent)' : '#c3cecb'}
              strokeWidth={onPath ? 5 : 2}
              strokeLinecap="round"
            />
            <rect
              x={mx - 15}
              y={my - 12}
              width={30}
              height={22}
              rx={5}
              fill="#fbfcfc"
              stroke={onPath ? 'var(--accent)' : '#d5dedb'}
            />
            <text
              x={mx}
              y={my + 3}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill={onPath ? 'var(--accent)' : '#4c5a56'}
            >
              {e.cost}
            </text>
          </g>
        );
      })}

      {/* 노드 */}
      {graph.nodes.map((id) => {
        const p = pos(graph, id);
        const inClosed = closedMap.has(id);
        const inOpen = openMap.has(id);
        const isCurrent = currentKey === id;
        const onPath = pathKeys.has(id);
        const entry = closedMap.get(id) ?? openMap.get(id) ?? null;
        const n = orderIndex.get(id);
        const isSelected = selectedNode === id;

        const fill = inClosed ? '#dfe9e6' : inOpen ? '#ffffff' : '#f4f6f5';
        const stroke = isCurrent
          ? 'var(--signal)'
          : onPath
            ? 'var(--accent)'
            : inClosed
              ? '#5c7a73'
              : inOpen
                ? '#8fa8a2'
                : '#cfd8d5';

        return (
          <g
            key={id}
            role="button"
            tabIndex={0}
            aria-label={`도시 ${id}${entry ? `, 누적 비용 ${entry.g}, 휴리스틱값 ${entry.h}` : ''}`}
            onClick={() => onSelectNode(isSelected ? null : id)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                onSelectNode(isSelected ? null : id);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            {/* 터치 판정 영역을 시각 크기보다 넓게 (설계서 1-2) */}
            <circle cx={p.x} cy={p.y} r={30} fill="transparent" />
            {isCurrent && (
              <circle cx={p.x} cy={p.y} r={26} fill="none" stroke="var(--signal)" strokeWidth={2} />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={20}
              fill={fill}
              stroke={stroke}
              strokeWidth={isCurrent ? 4 : onPath ? 3 : 2}
              strokeDasharray={inOpen && !inClosed ? '4 3' : undefined}
            />
            <text
              x={p.x}
              y={p.y + 6}
              textAnchor="middle"
              fontSize={17}
              fontWeight={750}
              fill="#14201d"
            >
              {id}
            </text>

            {/* 탐색 순서 번호 */}
            {n != null && (
              <>
                <circle cx={p.x + 18} cy={p.y - 18} r={10} fill="#14201d" />
                <text
                  x={p.x + 18}
                  y={p.y - 14}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#ffffff"
                >
                  {n}
                </text>
              </>
            )}

            {/* g / h / f 배지 */}
            {entry && showCost && (showBadges || isSelected) && (
              <text
                x={p.x}
                y={p.y + 38}
                textAnchor="middle"
                fontSize={12}
                fontFamily="ui-monospace, monospace"
                fill="#4c5a56"
              >
                {method === 'ucs'
                  ? `g=${entry.g}`
                  : method === 'greedy'
                    ? `h=${entry.h}`
                    : `g${entry.g} h${entry.h} f${entry.f}`}
              </text>
            )}
            {entry && showCost && !showBadges && !isSelected && (
              <text
                x={p.x}
                y={p.y + 38}
                textAnchor="middle"
                fontSize={12}
                fontFamily="ui-monospace, monospace"
                fill="#7e8b87"
              >
                {method === 'ucs' ? `g=${entry.g}` : `f=${entry.f}`}
              </text>
            )}
          </g>
        );
      })}

      {/* 범례 — 접지 않고 항상 표시 (설계서 1-8) */}
      <g transform={`translate(14, ${H - 20})`} fontSize={12} fill="#4c5a56">
        <circle cx={8} cy={-4} r={7} fill="#dfe9e6" stroke="#5c7a73" strokeWidth={2} />
        <text x={20} y={0}>
          테스트 완료
        </text>
        <circle
          cx={108}
          cy={-4}
          r={7}
          fill="#fff"
          stroke="#8fa8a2"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
        <text x={120} y={0}>
          대기 중
        </text>
        <circle cx={190} cy={-4} r={7} fill="#fff" stroke="var(--signal)" strokeWidth={3} />
        <text x={202} y={0}>
          지금 테스트
        </text>
        {compact && (
          <text x={300} y={0} fill="#7e8b87">
            노드를 누르면 g · h · f 값을 볼 수 있습니다
          </text>
        )}
      </g>
    </svg>
  );
}
