import type { PuzzleState } from '../core/search/puzzle';
import type { SearchMethod, SearchStep } from '../core/search/types';

/**
 * 8퍼즐 화면 — 설계서 화면 1-1
 * 위쪽에 현재 상태를 크게, 아래에 지금까지 만들어진 트리를 보여 준다.
 * 아이패드 세로 높이를 고려해 트리는 깊이 3까지만 그린다.
 */

interface BoardProps {
  state: PuzzleState;
  size?: number;
  onTileClick?: (index: number) => void;
  goal?: PuzzleState;
  /** 목표와 다른 타일을 표시할지 (휴리스틱값 설명용) */
  markMismatch?: boolean;
  label?: string;
}

export function PuzzleBoard({
  state,
  size = 132,
  onTileClick,
  goal,
  markMismatch = false,
  label,
}: BoardProps) {
  const cell = size / 3;
  return (
    <div style={{ display: 'inline-block', textAlign: 'center' }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={label ?? `8퍼즐 상태 ${state.join('')}`}
      >
        {state.map((v, i) => {
          const r = Math.floor(i / 3);
          const c = i % 3;
          const mismatch =
            markMismatch && goal != null && v !== 0 && goal[i] !== v;
          return (
            <g
              key={i}
              onClick={onTileClick ? () => onTileClick(i) : undefined}
              style={{ cursor: onTileClick ? 'pointer' : 'default' }}
            >
              <rect
                x={c * cell + 1.5}
                y={r * cell + 1.5}
                width={cell - 3}
                height={cell - 3}
                rx={5}
                fill={v === 0 ? '#eef1f0' : mismatch ? '#f7ebe3' : '#ffffff'}
                stroke={v === 0 ? '#cfd8d5' : mismatch ? '#c9a389' : '#a2c9be'}
                strokeWidth={2}
              />
              {v !== 0 && (
                <text
                  x={c * cell + cell / 2}
                  y={r * cell + cell / 2 + cell * 0.16}
                  textAnchor="middle"
                  fontSize={cell * 0.46}
                  fontWeight={700}
                  fill={mismatch ? 'var(--signal)' : '#14201d'}
                >
                  {v}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {label && (
        <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 2 }}>{label}</div>
      )}
    </div>
  );
}

/* ── 탐색 트리 ────────────────────────────────────────────── */

const TW = 720;
const TH = 360;
const MAX_DEPTH = 3;

interface TreeProps {
  step: SearchStep<PuzzleState> | null;
  method: SearchMethod;
  rootKey: string;
}

export function PuzzleTreeView({ step, method, rootKey }: TreeProps) {
  if (!step) return <svg viewBox={`0 0 ${TW} ${TH}`} />;

  // 부모-자식 관계. 먼저 만들어진 순서를 그대로 유지한다.
  const parentOf = new Map<string, string>();
  const childrenOf = new Map<string, string[]>();
  for (const e of step.edges) {
    if (parentOf.has(e.to) || e.to === rootKey) continue;
    parentOf.set(e.to, e.from);
    const list = childrenOf.get(e.from) ?? [];
    list.push(e.to);
    childrenOf.set(e.from, list);
  }

  /**
   * 한 층씩 내려가며 노드 순서를 정한다.
   *
   * 여기서 상태 문자열로 정렬하면(예전 방식) 부모가 다른 노드끼리 뒤섞여
   * 선이 교차하고 번호도 뒤죽박죽으로 보인다.
   * 부모 순서대로, 그 안에서는 만들어진 순서대로 놓아야
   * 왼쪽에서 오른쪽으로 읽는 순서가 탐색 순서와 맞는다. (교과서 31쪽)
   */
  const levels: string[][] = [[rootKey]];
  for (let d = 0; d < MAX_DEPTH; d++) {
    const next: string[] = [];
    for (const parent of levels[d]) {
      for (const child of childrenOf.get(parent) ?? []) next.push(child);
    }
    if (next.length === 0) break;
    levels.push(next);
  }

  const placed = new Set(levels.flat());
  const totalNodes = new Set<string>([rootKey, ...step.edges.map((e) => e.to)]).size;
  const hidden = totalNodes - placed.size;

  const orderIndex = new Map<string, number>();
  step.order.forEach((k, i) => orderIndex.set(k, i + 1));
  const closedKeys = new Set(step.closed.map((e) => e.key));
  const openKeys = new Set(step.open.map((e) => e.key));
  const entryOf = new Map([...step.closed, ...step.open].map((e) => [e.key, e] as const));
  const pathKeys = new Set(step.path?.map((e) => e.key) ?? []);

  // 한 층에 노드가 많아지면 화면을 넓히고 좌우로 스크롤한다.
  // 억지로 밀어 넣으면 원이 겹쳐서 오히려 읽을 수 없다.
  const widest = Math.max(...levels.map((l) => l.length));
  const W = Math.max(TW, widest * 58);

  const coords = new Map<string, { x: number; y: number }>();
  levels.forEach((nodes, d) => {
    const y = 40 + (d * (TH - 92)) / Math.max(1, MAX_DEPTH);
    nodes.forEach((key, i) => {
      coords.set(key, { x: ((i + 1) * W) / (nodes.length + 1), y });
    });
  });

  return (
    <svg
      viewBox={`0 0 ${W} ${TH}`}
      width={W}
      height={TH}
      role="img"
      aria-label="8퍼즐 탐색 트리"
      style={{ display: 'block', maxWidth: 'none' }}
    >
      <title>지금까지 만들어진 탐색 트리</title>

      {step.edges.map((e, i) => {
        const a = coords.get(e.from);
        const b = coords.get(e.to);
        if (!a || !b) return null;
        const onPath = pathKeys.has(e.from) && pathKeys.has(e.to);
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y + 12}
            x2={b.x}
            y2={b.y - 12}
            stroke={onPath ? 'var(--accent)' : '#c3cecb'}
            strokeWidth={onPath ? 3 : 1.5}
          />
        );
      })}

      {[...coords.entries()].map(([key, p]) => {
        const isClosed = closedKeys.has(key);
        const isOpen = openKeys.has(key);
        const isCurrent = step.current?.key === key;
        const onPath = pathKeys.has(key);
        const n = orderIndex.get(key);
        const entry = entryOf.get(key);
        return (
          <g key={key}>
            <circle
              cx={p.x}
              cy={p.y}
              r={12}
              fill={isClosed ? '#dfe9e6' : isOpen ? '#ffffff' : '#f4f6f5'}
              stroke={
                isCurrent
                  ? 'var(--signal)'
                  : onPath
                    ? 'var(--accent)'
                    : isClosed
                      ? '#5c7a73'
                      : '#8fa8a2'
              }
              strokeWidth={isCurrent ? 3.5 : onPath ? 3 : 1.8}
              strokeDasharray={isOpen && !isClosed ? '3 2' : undefined}
            />
            {n != null && (
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="#14201d"
              >
                {n}
              </text>
            )}
            {entry && method === 'astar' && (
              <text
                x={p.x}
                y={p.y + 26}
                textAnchor="middle"
                fontSize={10.5}
                fontFamily="ui-monospace, monospace"
                fill="#7e8b87"
              >
                f{entry.f}
              </text>
            )}
          </g>
        );
      })}

      {hidden > 0 && (
        <text x={W - 12} y={TH - 10} textAnchor="end" fontSize={12} fill="#7e8b87">
          깊이 {MAX_DEPTH}까지만 표시 · 더 아래의 노드 {hidden}개는 그리지 않았습니다
        </text>
      )}
      <text x={12} y={TH - 10} fontSize={12} fill="#4c5a56">
        번호는 테스트한 순서 · 왼쪽에서 오른쪽으로 읽습니다
      </text>
    </svg>
  );
}
