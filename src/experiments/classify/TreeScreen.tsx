import { useMemo, useState } from 'react';
import { ExperimentFrame, type LearnMode } from '../../ui/ExperimentFrame';
import { SettingRow } from '../../ui/controls';
import { InquiryPanel } from '../../ui/InquiryPanel';
import { TeacherPanel } from '../../ui/TeacherPanel';
import { CLASSIFY_TEACHER_NOTES, CLASSIFY_COMMON } from '../../teacher/classifyTeacher';
import { SpeciesLegend } from '../../ui/DataCharts';
import { PipelineBar } from '../data/DataLabScreen';
import {
  NUMERIC_FIELDS,
  SPECIES_STYLE,
  completeRows,
  fieldOf,
  runPipeline,
  speciesName,
  type Pipeline,
} from '../../data/penguinData';
import { trainTestSplit } from '../../core/stats';
import {
  allNodes,
  fitTree,
  leaves,
  treeDepth,
  treePath,
  treePredict,
  type TreeNode,
} from '../../core/decisionTree';
import { confusionMatrix, scoresFrom } from '../../core/logistic';
import { usePersisted } from '../../usePersisted';
import { CLASSIFY_INQUIRY } from './classifyInquiry';

/**
 * 화면 4-1 결정트리
 * 교과서 Ⅱ-02 인쇄 107·112쪽
 *
 * 이 화면의 핵심은 트리와 산점도를 양방향으로 이어 놓은 것이다.
 * 트리의 노드를 누르면 산점도에서 그 노드가 담당하는 영역이 강조되고,
 * 산점도의 영역을 누르면 그 자리로 내려가는 트리 경로가 강조된다.
 * "어떤 질문으로 데이터를 나누는가"를 학생이 눈으로 따라갈 수 있게 하기 위해서다.
 */

const W = 620;
const H = 460;
const PAD = { top: 20, right: 18, bottom: 48, left: 62 };

interface Props {
  mode: LearnMode;
  onModeChange: (m: LearnMode) => void;
  teacherMode: boolean;
}

function shapePath(shape: string, x: number, y: number, r: number): string {
  if (shape === 'triangle') return `M ${x} ${y - r * 1.15} L ${x + r} ${y + r * 0.75} L ${x - r} ${y + r * 0.75} Z`;
  if (shape === 'square') return `M ${x - r * 0.9} ${y - r * 0.9} h ${r * 1.8} v ${r * 1.8} h ${-r * 1.8} Z`;
  return `M ${x} ${y - r} a ${r} ${r} 0 1 0 0.01 0 Z`;
}

export function TreeScreen({ mode, onModeChange, teacherMode }: Props) {
  const [pipeline] = usePersisted<Pipeline>('data:pipeline', {
    missing: 'keep',
    removeBadSex: false,
    removeMassOutliers: false,
  });
  const [xKey, setXKey] = usePersisted('tree:x', 'culmen_length_mm');
  const [yKey, setYKey] = usePersisted('tree:y', 'culmen_depth_mm');
  const [maxDepth, setMaxDepth] = usePersisted('tree:depth', 3);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { rows } = useMemo(() => runPipeline(pipeline), [pipeline]);
  const clean = useMemo(() => completeRows(rows), [rows]);

  const points = useMemo(
    () =>
      clean.map((r) => ({
        x: r[xKey] as number,
        y: r[yKey] as number,
        label: r.species as string,
      })),
    [clean, xKey, yKey],
  );

  const bounds = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const px = (maxX - minX) * 0.06;
    const py = (maxY - minY) * 0.06;
    return { minX: minX - px, maxX: maxX + px, minY: minY - py, maxY: maxY + py };
  }, [points]);

  const split = useMemo(() => trainTestSplit(points, 0.3, 42), [points]);

  const tree = useMemo(
    () => fitTree(split.train, bounds, { maxDepth, minSamples: 2 }),
    [split.train, bounds, maxDepth],
  );

  const nodes = useMemo(() => allNodes(tree), [tree]);
  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );
  const pathIds = useMemo(() => {
    if (!selected) return new Set<number>();
    // 뿌리에서 선택한 노드까지의 경로를 구한다
    const findPath = (node: TreeNode): TreeNode[] | null => {
      if (node.id === selected.id) return [node];
      for (const child of [node.left, node.right]) {
        if (!child) continue;
        const sub = findPath(child);
        if (sub) return [node, ...sub];
      }
      return null;
    };
    return new Set((findPath(tree) ?? []).map((n) => n.id));
  }, [tree, selected]);

  const evaluation = useMemo(() => {
    const labels = ['Adelie', 'Chinstrap', 'Gentoo'];
    const trainPred = split.train.map((p) => treePredict(tree, p.x, p.y));
    const testPred = split.test.map((p) => treePredict(tree, p.x, p.y));
    const trainCm = confusionMatrix(labels, split.train.map((p) => p.label), trainPred);
    const testCm = confusionMatrix(labels, split.test.map((p) => p.label), testPred);
    return { train: scoresFrom(trainCm), test: scoresFrom(testCm), testCm };
  }, [tree, split]);

  const sx = (v: number) =>
    PAD.left + ((v - bounds.minX) / (bounds.maxX - bounds.minX)) * (W - PAD.left - PAD.right);
  const sy = (v: number) =>
    H - PAD.bottom - ((v - bounds.minY) / (bounds.maxY - bounds.minY)) * (H - PAD.top - PAD.bottom);

  const inquiry = CLASSIFY_INQUIRY.tree;
  const leafList = leaves(tree);
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

  /* ── 왼쪽 ──────────────────────────────────────────── */
  const dataPane = (
    <>
      <p className="pane__title">데이터</p>
      <div className="note" style={{ marginTop: 0 }}>
        <strong>펭귄 데이터</strong>
        <br />
        교육용 예제 데이터
        <br />
        <span className="muted">데이터 실험실에서 한 전처리가 이어집니다.</span>
      </div>
      <SettingRow label="특징 (가로축)">
        <select value={xKey} onChange={(e) => setXKey(e.target.value)}>
          {NUMERIC_FIELDS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="특징 (세로축)">
        <select value={yKey} onChange={(e) => setYKey(e.target.value)}>
          {NUMERIC_FIELDS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </SettingRow>

      {selected ? (
        <SettingRow label="선택한 노드">
          <ul className="field-list">
            <li>
              <span>깊이</span>
              <span>{selected.depth}</span>
            </li>
            <li>
              <span>데이터 수</span>
              <span>{selected.samples}개</span>
            </li>
            <li>
              <span>지니 계수</span>
              <span>{selected.gini.toFixed(3)}</span>
            </li>
            <li>
              <span>답</span>
              <span>{speciesName(selected.prediction)}</span>
            </li>
            {selected.split && (
              <li>
                <span>나누는 조건</span>
                <span>
                  {fieldOf(selected.split.axis === 0 ? xKey : yKey).label} ≤{' '}
                  {selected.split.threshold.toFixed(1)}
                </span>
              </li>
            )}
          </ul>
          <div style={{ marginTop: 8 }}>
            {Object.entries(selected.counts)
              .sort()
              .map(([label, n]) => (
                <span key={label} className="vote-chip" style={{ marginRight: 5 }}>
                  {speciesName(label)} {n}
                </span>
              ))}
          </div>
          <button
            type="button"
            className="btn btn--wide btn--small"
            style={{ marginTop: 8 }}
            onClick={() => setSelectedId(null)}
          >
            선택 해제
          </button>
        </SettingRow>
      ) : (
        <div className="note">
          아래 트리의 노드를 누르거나, 산점도의 아무 곳이나 눌러 보세요. 트리와 산점도가 서로
          연결되어 있습니다.
        </div>
      )}
    </>
  );

  /* ── 가운데 ────────────────────────────────────────── */
  const stageView = (
    <>
      <PipelineBar pipeline={pipeline} />
      <div className="stage">
        <span className="stage__mode">
          결정트리 · 최대 깊이 {maxDepth} · 잎 {leafList.length}개
        </span>
        <div style={{ padding: '34px 8px 4px' }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="결정트리의 데이터 공간 분할"
            onClick={(e) => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const px = ((e.clientX - rect.left) / rect.width) * W;
              const py = ((e.clientY - rect.top) / rect.height) * H;
              if (px < PAD.left || px > W - PAD.right || py < PAD.top || py > H - PAD.bottom) return;
              const vx =
                bounds.minX + ((px - PAD.left) / (W - PAD.left - PAD.right)) * (bounds.maxX - bounds.minX);
              const vy =
                bounds.minY +
                ((H - PAD.bottom - py) / (H - PAD.top - PAD.bottom)) * (bounds.maxY - bounds.minY);
              const path = treePath(tree, vx, vy);
              setSelectedId(path[path.length - 1].id);
            }}
          >
            <title>결정트리가 나눈 영역입니다. 경계가 축과 나란한 계단 모양입니다.</title>

            {/* 잎 노드의 영역을 사각형으로 칠한다 */}
            {leafList.map((leaf) => {
              const st = SPECIES_STYLE[leaf.prediction] ?? { color: '#7e8b87' };
              const isSel = selected?.id === leaf.id;
              const inSel = selected ? pathIds.has(leaf.id) : false;
              return (
                <rect
                  key={leaf.id}
                  x={sx(leaf.bounds.minX)}
                  y={sy(leaf.bounds.maxY)}
                  width={Math.max(0, sx(leaf.bounds.maxX) - sx(leaf.bounds.minX))}
                  height={Math.max(0, sy(leaf.bounds.minY) - sy(leaf.bounds.maxY))}
                  fill={st.color}
                  fillOpacity={isSel ? 0.42 : 0.16}
                  stroke={isSel || inSel ? '#14201d' : '#ffffff'}
                  strokeWidth={isSel ? 2.5 : 1}
                />
              );
            })}

            {/* 선택한 노드가 가지 노드라면 그 영역 전체를 강조한다 */}
            {selected && selected.split && (
              <rect
                x={sx(selected.bounds.minX)}
                y={sy(selected.bounds.maxY)}
                width={Math.max(0, sx(selected.bounds.maxX) - sx(selected.bounds.minX))}
                height={Math.max(0, sy(selected.bounds.minY) - sy(selected.bounds.maxY))}
                fill="none"
                stroke="#14201d"
                strokeWidth={3}
                strokeDasharray="6 4"
              />
            )}

            <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#c3cecb" />
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#c3cecb" />
            {[0, 0.25, 0.5, 0.75, 1].map((p) => {
              const vx = bounds.minX + (bounds.maxX - bounds.minX) * p;
              const vy = bounds.minY + (bounds.maxY - bounds.minY) * p;
              return (
                <g key={p}>
                  <text x={sx(vx)} y={H - PAD.bottom + 18} textAnchor="middle" fontSize={11.5} fill="#7e8b87">
                    {fmt(vx)}
                  </text>
                  <text x={PAD.left - 8} y={sy(vy) + 4} textAnchor="end" fontSize={11.5} fill="#7e8b87">
                    {fmt(vy)}
                  </text>
                </g>
              );
            })}
            <text x={(W + PAD.left) / 2} y={H - 10} textAnchor="middle" fontSize={12.5} fill="#4c5a56">
              {fieldOf(xKey).label}
            </text>
            <text
              x={-(H - PAD.bottom + PAD.top) / 2}
              y={15}
              transform="rotate(-90)"
              textAnchor="middle"
              fontSize={12.5}
              fill="#4c5a56"
            >
              {fieldOf(yKey).label}
            </text>

            {split.train.map((p, i) => {
              const st = SPECIES_STYLE[p.label] ?? { color: '#7e8b87', shape: 'circle' as const };
              return <path key={i} d={shapePath(st.shape, sx(p.x), sy(p.y), 3.6)} fill={st.color} fillOpacity={0.8} />;
            })}
          </svg>
        </div>
        <SpeciesLegend />
      </div>

      <div className="stage-summary">
        <div className="stage-summary__step">
          {selected ? (
            selected.split ? (
              <>
                이 노드는 <strong>
                  {fieldOf(selected.split.axis === 0 ? xKey : yKey).label} ≤{' '}
                  {selected.split.threshold.toFixed(1)}
                </strong>{' '}
                인지 물어 데이터 {selected.samples}개를 나눕니다.
              </>
            ) : (
              <>
                더 나누지 않는 잎 노드입니다. 데이터 {selected.samples}개가 남았고{' '}
                <strong>{speciesName(selected.prediction)}</strong>(으)로 답합니다. 지니 계수{' '}
                {selected.gini.toFixed(3)}.
              </>
            )
          ) : (
            '트리의 노드나 산점도의 영역을 눌러 보세요. 서로 연결되어 강조됩니다.'
          )}
        </div>
        <div className="stage-summary__stat">
          훈련 정확도 {(evaluation.train.accuracy * 100).toFixed(1)}% · 테스트 정확도{' '}
          {(evaluation.test.accuracy * 100).toFixed(1)}% · 실제 깊이 {treeDepth(tree)}
        </div>
      </div>

      <div className="lists">
        <TreeDiagram
          tree={tree}
          xLabel={fieldOf(xKey).label}
          yLabel={fieldOf(yKey).label}
          selectedId={selectedId}
          pathIds={pathIds}
          onSelect={setSelectedId}
        />
      </div>
    </>
  );

  /* ── 오른쪽 ────────────────────────────────────────── */
  const settingsPane = (
    <>
      <p className="pane__title">모델 설정</p>

      <SettingRow
        label="최대 깊이"
        value={String(maxDepth)}
        help="질문을 몇 번까지 이어서 할지 정합니다. 깊을수록 훈련 데이터에 더 딱 맞는 복잡한 트리가 됩니다."
      >
        <input
          type="range"
          min={1}
          max={8}
          step={1}
          value={maxDepth}
          onChange={(e) => setMaxDepth(Number(e.target.value))}
          aria-label="최대 깊이"
        />
      </SettingRow>

      <div className="metric-cards">
        <div className="metric-card">
          <span className="metric-card__label">훈련 정확도</span>
          <span className="metric-card__value">{(evaluation.train.accuracy * 100).toFixed(1)}%</span>
        </div>
        <div className="metric-card metric-card--test">
          <span className="metric-card__label">테스트 정확도</span>
          <span className="metric-card__value">{(evaluation.test.accuracy * 100).toFixed(1)}%</span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">잎 노드 수</span>
          <span className="metric-card__value">{leafList.length}</span>
        </div>
        <div className="metric-card">
          <span className="metric-card__label">실제 깊이</span>
          <span className="metric-card__value">{treeDepth(tree)}</span>
        </div>
      </div>

      <SettingRow label="정규화" help="결정트리는 값의 크고 작은 순서만 보기 때문에 정규화가 필요 없습니다.">
        <div className="note" style={{ marginTop: 0 }}>
          결정트리는 정규화가 필요 없습니다 (교과서 107쪽).
        </div>
      </SettingRow>

      <button
        type="button"
        className="btn btn--wide"
        style={{ marginTop: 10 }}
        onClick={() => {
          setMaxDepth(3);
          setSelectedId(null);
        }}
      >
        처음으로
      </button>
    </>
  );

  /* ── 아래 ──────────────────────────────────────────── */
  const below = (
    <>
      <section className="section-card">
        <h2>깊이를 바꾸면 어떻게 달라질까</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">최대 깊이</th>
                <th className="num">잎 노드 수</th>
                <th className="num">훈련 정확도</th>
                <th className="num">테스트 정확도</th>
                <th className="num">차이</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => {
                const t = fitTree(split.train, bounds, { maxDepth: d, minSamples: 2 });
                const labels = ['Adelie', 'Chinstrap', 'Gentoo'];
                const trainS = scoresFrom(
                  confusionMatrix(labels, split.train.map((p) => p.label), split.train.map((p) => treePredict(t, p.x, p.y))),
                );
                const testS = scoresFrom(
                  confusionMatrix(labels, split.test.map((p) => p.label), split.test.map((p) => treePredict(t, p.x, p.y))),
                );
                return (
                  <tr key={d} className={d === maxDepth ? 'is-best' : undefined}>
                    <td className="num">{d}</td>
                    <td className="num">{leaves(t).length}</td>
                    <td className="num">{(trainS.accuracy * 100).toFixed(1)}%</td>
                    <td className="num">{(testS.accuracy * 100).toFixed(1)}%</td>
                    <td className="num">
                      {((trainS.accuracy - testS.accuracy) * 100).toFixed(1)}%p
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted">
          깊이를 늘리면 훈련 정확도는 계속 올라갑니다. 테스트 정확도도 함께 올라가는지 확인해
          보세요.
        </p>
      </section>

      {teacherMode && (
        <TeacherPanel
          note={CLASSIFY_TEACHER_NOTES.tree}
          extra={[CLASSIFY_COMMON.tree, CLASSIFY_COMMON.data]}
          inquiry={inquiry}
        />
      )}

      <InquiryPanel spec={inquiry} mode={mode} hasRun />
    </>
  );

  return (
    <ExperimentFrame
      title="결정트리"
      textbook="Ⅱ-02 · 107, 112쪽"
      mode={mode}
      onModeChange={onModeChange}
      dataPane={dataPane}
      stage={stageView}
      settingsPane={settingsPane}
      below={below}
    />
  );
}

/* ── 트리 다이어그램 ───────────────────────────────────────── */

function TreeDiagram({
  tree,
  xLabel,
  yLabel,
  selectedId,
  pathIds,
  onSelect,
}: {
  tree: TreeNode;
  xLabel: string;
  yLabel: string;
  selectedId: number | null;
  pathIds: Set<number>;
  onSelect: (id: number) => void;
}) {
  const depth = treeDepth(tree);
  const levelNodes: TreeNode[][] = [];
  const collect = (node: TreeNode) => {
    (levelNodes[node.depth] ??= []).push(node);
    if (node.left) collect(node.left);
    if (node.right) collect(node.right);
  };
  collect(tree);

  const widest = Math.max(...levelNodes.map((l) => l.length));
  const nodeW = 118;
  const width = Math.max(640, widest * (nodeW + 14));
  const rowH = 92;
  const height = (depth + 1) * rowH + 26;

  const coords = new Map<number, { x: number; y: number }>();
  levelNodes.forEach((nodesAtLevel, d) => {
    nodesAtLevel.forEach((n, i) => {
      coords.set(n.id, { x: ((i + 1) * width) / (nodesAtLevel.length + 1), y: 32 + d * rowH });
    });
  });

  const edges: { from: TreeNode; to: TreeNode; yes: boolean }[] = [];
  const walk = (node: TreeNode) => {
    if (node.left) {
      edges.push({ from: node, to: node.left, yes: true });
      walk(node.left);
    }
    if (node.right) {
      edges.push({ from: node, to: node.right, yes: false });
      walk(node.right);
    }
  };
  walk(tree);

  return (
    <div className="tree-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="결정트리 구조" style={{ display: 'block', maxWidth: 'none' }}>
        <title>결정트리의 구조입니다. 노드를 누르면 산점도에서 그 영역이 강조됩니다.</title>

        {edges.map((e, i) => {
          const a = coords.get(e.from.id)!;
          const b = coords.get(e.to.id)!;
          const on = pathIds.has(e.from.id) && pathIds.has(e.to.id);
          return (
            <g key={i}>
              <line
                x1={a.x}
                y1={a.y + 26}
                x2={b.x}
                y2={b.y - 22}
                stroke={on ? '#14201d' : '#c3cecb'}
                strokeWidth={on ? 2.5 : 1.4}
              />
              <text
                x={(a.x + b.x) / 2 + (e.yes ? -14 : 14)}
                y={(a.y + b.y) / 2}
                textAnchor="middle"
                fontSize={11.5}
                fill={on ? '#14201d' : '#7e8b87'}
                fontWeight={on ? 700 : 400}
              >
                {e.yes ? '예' : '아니오'}
              </text>
            </g>
          );
        })}

        {[...coords.entries()].map(([id, p]) => {
          const node = levelNodes.flat().find((n) => n.id === id)!;
          const st = SPECIES_STYLE[node.prediction] ?? { color: '#7e8b87' };
          const isSel = selectedId === id;
          const onPath = pathIds.has(id);
          return (
            <g key={id} onClick={() => onSelect(id)} style={{ cursor: 'pointer' }}>
              <rect
                x={p.x - nodeW / 2}
                y={p.y - 22}
                width={nodeW}
                height={48}
                rx={6}
                fill={isSel ? st.color : '#ffffff'}
                fillOpacity={isSel ? 0.28 : 1}
                stroke={isSel ? '#14201d' : onPath ? '#5c7a73' : '#d5dedb'}
                strokeWidth={isSel ? 2.5 : onPath ? 2 : 1.4}
              />
              <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize={11.5} fill="#14201d" fontWeight={650}>
                {node.split
                  ? `${(node.split.axis === 0 ? xLabel : yLabel).slice(0, 5)} ≤ ${node.split.threshold.toFixed(1)}`
                  : speciesName(node.prediction)}
              </text>
              <text x={p.x} y={p.y + 9} textAnchor="middle" fontSize={10.5} fill="#7e8b87" fontFamily="ui-monospace, monospace">
                {node.samples}개 · 지니 {node.gini.toFixed(2)}
              </text>
              <rect x={p.x - nodeW / 2 + 6} y={p.y + 14} width={nodeW - 12} height={7} rx={3} fill="#eef1f0" />
              {(() => {
                const total = node.samples || 1;
                let offset = 0;
                return Object.entries(node.counts)
                  .sort()
                  .map(([label, n]) => {
                    const w = ((nodeW - 12) * n) / total;
                    const x = p.x - nodeW / 2 + 6 + offset;
                    offset += w;
                    return (
                      <rect
                        key={label}
                        x={x}
                        y={p.y + 14}
                        width={w}
                        height={7}
                        rx={2}
                        fill={SPECIES_STYLE[label]?.color ?? '#7e8b87'}
                      />
                    );
                  });
              })()}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
