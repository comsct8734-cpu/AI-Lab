import { useEffect, useMemo, useState } from 'react';
import { ExperimentFrame, type LearnMode } from '../../ui/ExperimentFrame';
import { SettingRow, StepController } from '../../ui/controls';
import { GraphView } from '../../ui/GraphView';
import { PuzzleTreeView } from '../../ui/PuzzleView';
import { InquiryPanel, type InquirySpec } from '../../ui/InquiryPanel';
import { TeacherPanel } from '../../ui/TeacherPanel';
import { SEARCH_LAB_COMMON, TEACHER_NOTES } from '../../teacher/searchTeacher';
import { METHOD_HELP, METHOD_LABEL, collectSteps } from '../../core/search/bestFirst';
import { makeGraphProblem } from '../../core/search/graphProblem';
import { PUZZLE_START, makePuzzleProblem, puzzleKey } from '../../core/search/puzzle';
import { DEFAULT_CITY_GRAPH, cloneCityGraph, type CityGraph } from '../../data/cityGraph';
import type { SearchMethod } from '../../core/search/types';
import { useSearchRun } from './useSearchRun';
import { usePersisted } from '../../usePersisted';

/**
 * 화면 1-2 너비 우선 탐색 / 1-3 균일 비용 탐색 / 1-4 A* 탐색
 * 교과서 인쇄 30~37쪽
 *
 * 세 화면이 같은 도시 지도와 같은 8퍼즐을 공유한다.
 * 그래야 마지막에 "같은 문제, 다른 방법"을 비교할 수 있다.
 */

type ProblemKind = 'city' | 'puzzle';

interface Props {
  method: SearchMethod;
  mode: LearnMode;
  onModeChange: (m: LearnMode) => void;
  teacherMode: boolean;
}

const SCREEN_TITLE: Record<string, string> = {
  bfs: '너비 우선 탐색',
  ucs: '균일 비용 탐색',
  astar: 'A* 탐색',
};

const SCREEN_TEXTBOOK: Record<string, string> = {
  bfs: 'Ⅰ-02 · 30~31쪽',
  ucs: 'Ⅰ-02 · 32~33쪽',
  astar: 'Ⅰ-02 · 34~37쪽',
};

const INQUIRY: Record<string, InquirySpec> = {
  bfs: {
    id: 'search-bfs',
    predictQuestion:
      '도시 a에서 e까지 갈 때, 목표를 찾기까지 몇 개의 도시를 테스트하게 될까요?',
    predictChoices: ['3개 이하', '4~5개', '6개 이상'],
    observeQuestion:
      '실제로 테스트한 노드 수와 찾은 경로를 적어 보세요. 예상과 무엇이 달랐나요?',
    explainQuestion:
      '너비 우선 탐색이 찾은 경로의 총비용은 가장 작지 않았습니다. 왜 그럴까요?',
    questions: [
      '목표 상태가 여러 개라면 너비 우선 탐색은 그중 어떤 것을 먼저 찾는가? 왜 그런가? (34쪽)',
      '문제를 8퍼즐로 바꾸면 테스트한 노드 수가 몇 개가 되는가? 도시 지도와 왜 이렇게 차이가 나는가?',
      '“언젠가는 반드시 찾는다”는 장점은 무엇을 대가로 얻은 것인가? (34쪽 표 Ⅰ-1)',
    ],
    finding:
      '너비 우선 탐색은 트리의 위쪽부터 한 층씩 차례로 확인하므로, 목표가 있다면 언젠가는 반드시 찾는다. ' +
      '다만 간선의 수가 가장 적은 경로를 찾을 뿐 비용이 가장 작은 경로를 찾아 주지는 않는다. ' +
      '또 상태 수가 많아질수록 테스트해야 하는 노드가 급격히 늘어난다.',
  },
  ucs: {
    id: 'search-ucs',
    predictQuestion:
      '모든 간선의 비용을 1로 바꾸면, 균일 비용 탐색의 결과는 너비 우선 탐색과 같아질까요?',
    predictChoices: ['같아진다', '달라진다', '같을 때도 다를 때도 있다'],
    observeQuestion:
      '[모든 비용을 1로]를 누르고 실행해 보세요. 두 탐색의 경로와 총비용은 어떻게 되었나요?',
    explainQuestion:
      'b는 오픈 리스트에 5로 들어 있었는데 c를 거쳐 오면 9가 됩니다. 왜 9로 바꾸지 않을까요?',
    questions: [
      'a–c의 비용을 4에서 얼마까지 올리면 최종 경로가 바뀌는가? 직접 찾아보자.',
      '오픈 리스트와 닫힌 리스트는 각각 어떤 역할을 하는가? (32쪽)',
      '균일 비용 탐색은 너비 우선 탐색보다 항상 노드를 적게 테스트하는가?',
    ],
    finding:
      '균일 비용 탐색은 오픈 리스트에서 누적 비용이 가장 작은 상태를 먼저 고른다. ' +
      '같은 상태로 가는 더 싼 길을 찾으면 값을 바꾸고, 더 비싼 길은 버린다. ' +
      '모든 간선의 비용이 같다면 균일 비용 탐색은 너비 우선 탐색과 같게 진행된다.',
  },
  astar: {
    id: 'search-astar',
    predictQuestion:
      '세 알고리즘이 찾은 경로가 같다면, 그래도 A*를 쓸 이유가 있을까요?',
    predictChoices: ['이유가 있다', '이유가 없다', '문제에 따라 다르다'],
    observeQuestion:
      '세 알고리즘을 모두 실행한 뒤 비교표를 보세요. 무엇이 같고 무엇이 달랐나요?',
    explainQuestion:
      'A*는 왜 더 적은 노드만 테스트하고도 같은 경로를 찾을 수 있었나요?',
    questions: [
      'c의 휴리스틱값을 7에서 30으로 크게 올리면 탐색 순서는 어떻게 바뀌는가? 최단 경로를 놓칠 수도 있는가?',
      '휴리스틱값을 모두 0으로 만들면 A*는 어떤 알고리즘이 되는가? 직접 해 보고 이유를 설명하자.',
      '휴리스틱값은 사람마다 다르게 정할 수 있다고 했다(35쪽). 그렇다면 “좋은 휴리스틱”이란 무엇일까?',
    ],
    finding:
      '같은 문제라도 어떤 정보를 사용하는지에 따라 확인해야 하는 상태의 수가 달라진다. ' +
      'A*는 여기까지 온 비용 g와 남은 추정 비용 h를 더한 f를 보고 고르기 때문에, ' +
      '같은 경로를 더 적은 노드만 확인하고 찾을 수 있다. ' +
      '다만 휴리스틱값은 정확한 값이 아니라 경험에 따른 추정값이므로, 어떻게 정하느냐에 따라 결과가 달라질 수 있다.',
  },
};

interface Snapshot {
  method: SearchMethod;
  problem: ProblemKind;
  expanded: number;
  path: string;
  cost: number;
  found: boolean;
}

export function SearchLabScreen({ method, mode, onModeChange, teacherMode }: Props) {
  const [kind, setKind] = useState<ProblemKind>('city');
  const [graph, setGraph] = useState<CityGraph>(() => cloneCityGraph());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [snapshots, setSnapshots] = usePersisted<Snapshot[]>(
    `search-${method}:snapshots`,
    [],
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const cityProblem = useMemo(() => makeGraphProblem(graph), [graph]);
  const puzzleProblem = useMemo(() => makePuzzleProblem(PUZZLE_START), []);

  const cityRun = useSearchRun(cityProblem, method);
  const puzzleRun = useSearchRun(puzzleProblem, method);
  const run = kind === 'city' ? cityRun : puzzleRun;

  // 세 알고리즘 비교 — 지금 문제에 대해 세 가지를 모두 계산해 둔다
  const comparison = useMemo(() => {
    const methods: SearchMethod[] = ['bfs', 'ucs', 'astar'];
    return methods.map((m) => {
      // 두 문제는 상태의 타입이 다르므로 분기해서 계산한다
      const { result } =
        kind === 'city'
          ? collectSteps(makeGraphProblem(graph), m, { maxExpanded: 3000 })
          : collectSteps(makePuzzleProblem(PUZZLE_START), m, { maxExpanded: 3000 });
      return result;
    });
  }, [kind, graph]);

  const guidedLock = mode === 'guided';
  const [predicted] = usePersisted<number | null>(`${INQUIRY[method].id}:choice`, null);
  const canRun = !guidedLock || predicted !== null;

  const setEdgeCost = (from: string, to: string, cost: number) => {
    setGraph((g) => ({
      ...g,
      edges: g.edges.map((e) =>
        e.from === from && e.to === to ? { ...e, cost: Math.max(0, cost) } : e,
      ),
    }));
  };

  const setHeuristic = (node: string, value: number) => {
    setGraph((g) => ({ ...g, heuristics: { ...g.heuristics, [node]: Math.max(0, value) } }));
  };

  /* ── 왼쪽 · 문제 설정 ─────────────────────────────────── */
  const dataPane = (
    <>
      <p className="pane__title">문제</p>

      <SettingRow label="문제 고르기" help="같은 알고리즘을 서로 다른 문제에 적용해 볼 수 있습니다.">
        <div className="segmented" role="group" aria-label="문제">
          <button
            type="button"
            className={kind === 'city' ? 'is-on' : ''}
            onClick={() => setKind('city')}
          >
            도시 지도
          </button>
          <button
            type="button"
            className={kind === 'puzzle' ? 'is-on' : ''}
            onClick={() => setKind('puzzle')}
          >
            8퍼즐
          </button>
        </div>
      </SettingRow>

      {kind === 'city' ? (
        <>
          <SettingRow label="시작 도시">
            <select
              value={graph.start}
              onChange={(e) => setGraph((g) => ({ ...g, start: e.target.value }))}
            >
              {graph.nodes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow label="목표 도시">
            <select
              value={graph.goal}
              onChange={(e) => setGraph((g) => ({ ...g, goal: e.target.value }))}
            >
              {graph.nodes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </SettingRow>
        </>
      ) : (
        <div className="note" style={{ marginTop: 0 }}>
          교과서 37쪽 활동 3의 초기 상태와 목표 상태를 사용합니다. 빈칸을 옮기는 순서는 위 → 아래
          → 왼쪽 → 오른쪽입니다.
        </div>
      )}

      <SettingRow
        label="알고리즘"
        help={METHOD_HELP[method]}
      >
        <div className="note" style={{ marginTop: 0 }}>
          {METHOD_LABEL[method]}
        </div>
      </SettingRow>
    </>
  );

  /* ── 가운데 · 실험 화면 ───────────────────────────────── */
  const step = run.step;
  const stageView = (
    <>
      <div className="stage">
        <span className="stage__mode">
          {kind === 'city' ? '도시 지도' : '8퍼즐'} · {METHOD_LABEL[method]}
        </span>
        {kind === 'city' ? (
          <GraphView
            graph={graph}
            step={cityRun.step}
            method={method}
            showBadges={!narrow}
            compact={narrow}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
          />
        ) : (
          <div className="tree-scroll">
            <PuzzleTreeView
              step={puzzleRun.step}
              method={method}
              rootKey={puzzleKey(PUZZLE_START)}
            />
          </div>
        )}
      </div>

      {/* 실험 화면 바로 아래에 항상 붙는 결과 요약 (설계서 1-1) */}
      <div className="stage-summary">
        <div className="stage-summary__step">
          {step ? (
            <>
              <strong>{step.index}단계 ·</strong> {step.message}
            </>
          ) : (
            '오른쪽에서 [한 단계 실행]을 눌러 시작하세요.'
          )}
        </div>
        <div className="stage-summary__stat">
          테스트한 노드 {step?.closed.length ?? 0}개 · 대기 중 {step?.open.length ?? 0}개
          {step?.found && step.path
            ? ` · 경로 ${step.path.map((e) => e.key).join(' → ')} · 총비용 ${step.totalCost}`
            : ''}
        </div>
      </div>

      {/* 오픈 / 닫힌 리스트 — 균일 비용·A*에서 특히 중요 (교과서 33쪽) */}
      {kind === 'city' && (
        <div className="lists">
          <div className="list-row">
            <span className="list-row__label">오픈 리스트</span>
            <span className="list-row__items">
              {step && step.open.length > 0 ? (
                step.open.map((e) => (
                  <span
                    key={e.key}
                    className={`chip${step.updated.includes(e.key) ? ' is-updated' : ''}`}
                  >
                    {method === 'bfs'
                      ? e.key
                      : method === 'astar'
                        ? `${e.key}(f${e.f})`
                        : `${e.key}(${e.g})`}
                  </span>
                ))
              ) : (
                <span className="list-empty">비어 있음</span>
              )}
            </span>
          </div>
          <div className="list-row">
            <span className="list-row__label">닫힌 리스트</span>
            <span className="list-row__items">
              {step && step.closed.length > 0 ? (
                step.closed.map((e) => (
                  <span
                    key={e.key}
                    className={`chip${step.current?.key === e.key ? ' is-selected' : ''}`}
                  >
                    {method === 'bfs' ? e.key : `${e.key}(${e.g})`}
                  </span>
                ))
              ) : (
                <span className="list-empty">비어 있음</span>
              )}
            </span>
          </div>
        </div>
      )}
    </>
  );

  /* ── 오른쪽 · 설정 ────────────────────────────────────── */
  const settingsPane = (
    <>
      <p className="pane__title">설정</p>

      <StepController
        onStep={run.stepForward}
        onBack={run.stepBack}
        onReset={run.reset}
        onToggleAuto={run.toggleAuto}
        auto={run.auto}
        canStep={canRun && !run.atEnd}
        canBack={run.index > 0}
        speed={run.speed}
        onSpeedChange={run.setSpeed}
      />

      {!canRun && (
        <div className="lock-note">
          <strong>안내 실험 모드입니다.</strong>
          <p>
            아래 <strong>① 예상하기</strong>에서 결과를 먼저 예상해야 실행할 수 있습니다.
            결과를 보고 나서 예상을 맞춰 쓰는 것을 막기 위한 장치입니다.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--small btn--primary"
              onClick={() =>
                document
                  .getElementById('inquiry')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              예상하기로 이동
            </button>
            <button type="button" className="btn btn--small" onClick={() => onModeChange('free')}>
              자유 실험으로
            </button>
          </div>
        </div>
      )}

      {kind === 'city' && method !== 'bfs' && (
        <SettingRow
          label="간선 비용"
          help="한 도시에서 다른 도시로 이동하는 데 걸리는 시간입니다. 값을 바꾸면 탐색이 처음으로 돌아갑니다."
        >
          <div style={{ display: 'grid', gap: 5 }}>
            {graph.edges.map((e) => (
              <label
                key={`${e.from}-${e.to}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}
              >
                <span style={{ fontFamily: 'ui-monospace, monospace', width: 40 }}>
                  {e.from}–{e.to}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={e.cost}
                  onChange={(ev) => setEdgeCost(e.from, e.to, Number(ev.target.value))}
                  style={{ minHeight: 34, padding: '4px 8px' }}
                />
              </label>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn--small"
              onClick={() =>
                setGraph((g) => ({ ...g, edges: g.edges.map((e) => ({ ...e, cost: 1 })) }))
              }
            >
              모든 비용을 1로
            </button>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => setGraph(cloneCityGraph(DEFAULT_CITY_GRAPH))}
            >
              기본값 복원
            </button>
          </div>
        </SettingRow>
      )}

      {kind === 'city' && method === 'astar' && (
        <SettingRow
          label="휴리스틱값 h(n)"
          help="목표까지 얼마나 남았는지 경험으로 추정한 값입니다. 사람마다 다르게 정할 수 있습니다."
        >
          <div style={{ display: 'grid', gap: 5 }}>
            {graph.nodes.map((n) => (
              <label
                key={n}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}
              >
                <span style={{ fontFamily: 'ui-monospace, monospace', width: 40 }}>h({n})</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={graph.heuristics[n] ?? 0}
                  onChange={(ev) => setHeuristic(n, Number(ev.target.value))}
                  style={{ minHeight: 34, padding: '4px 8px' }}
                />
              </label>
            ))}
          </div>
          <button
            type="button"
            className="btn btn--wide btn--small"
            style={{ marginTop: 8 }}
            onClick={() =>
              setGraph((g) => ({
                ...g,
                heuristics: Object.fromEntries(g.nodes.map((n) => [n, 0])),
              }))
            }
          >
            휴리스틱값을 모두 0으로
          </button>
        </SettingRow>
      )}

      {method === 'astar' && (
        <SettingRow
          label="f(n) = g(n) + h(n)"
          help="여기까지 온 비용 g와 앞으로 남은 추정 비용 h를 더한 값입니다. A*는 이 값이 가장 작은 상태를 먼저 확인합니다."
        >
          <p className="muted" style={{ margin: 0 }}>
            {step?.current
              ? `지금 고른 상태: f=${step.current.f} = g${step.current.g} + h${step.current.h}`
              : '실행하면 지금 고른 상태의 계산이 표시됩니다.'}
          </p>
        </SettingRow>
      )}

      <SettingRow label="비교함">
        <button
          type="button"
          className="btn btn--wide"
          onClick={() =>
            setSnapshots([
              ...snapshots,
              {
                method,
                problem: kind,
                expanded: run.result.expanded,
                path: run.result.path.join(' → ') || '찾지 못함',
                cost: run.result.totalCost,
                found: run.result.found,
              },
            ])
          }
        >
          지금 결과를 비교함에 저장
        </button>
      </SettingRow>
    </>
  );

  /* ── 아래 · 결과 및 생각하기 ──────────────────────────── */
  const below = (
    <>
      <section className="section-card">
        <h2>세 알고리즘 비교 — 같은 문제, 다른 방법</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>알고리즘</th>
                <th className="num">테스트한 노드 수</th>
                <th>최종 경로</th>
                <th className="num">총비용</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((c) => {
                const best = Math.min(...comparison.map((x) => x.expanded));
                return (
                  <tr key={c.method} className={c.expanded === best ? 'is-best' : undefined}>
                    <td>
                      {METHOD_LABEL[c.method]}
                      {c.method === method ? ' (지금 화면)' : ''}
                    </td>
                    <td className="num">{c.expanded}</td>
                    <td className="num">
                      {c.found
                        ? kind === 'city'
                          ? c.path.join(' → ')
                          : `${c.path.length - 1}번 이동`
                        : '찾지 못함'}
                    </td>
                    <td className="num">{c.found ? c.totalCost : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ marginTop: 10 }}>
          지금 화면의 문제 설정으로 세 알고리즘을 각각 계산한 결과입니다. 왼쪽에서 문제나 비용을
          바꾸면 이 표도 함께 바뀝니다.
        </p>
      </section>

      {snapshots.length > 0 && (
        <section className="section-card">
          <h2>비교함</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="num">번호</th>
                  <th>알고리즘</th>
                  <th>문제</th>
                  <th className="num">테스트한 노드 수</th>
                  <th>경로</th>
                  <th className="num">총비용</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s, i) => (
                  <tr key={i}>
                    <td className="num">실험 {i + 1}</td>
                    <td>{METHOD_LABEL[s.method]}</td>
                    <td>{s.problem === 'city' ? '도시 지도' : '8퍼즐'}</td>
                    <td className="num">{s.expanded}</td>
                    <td className="num">{s.path}</td>
                    <td className="num">{s.found ? s.cost : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn btn--small"
            style={{ marginTop: 10 }}
            onClick={() => setSnapshots([])}
          >
            비교함 비우기
          </button>
        </section>
      )}

      {teacherMode && (
        <TeacherPanel
          note={TEACHER_NOTES[method]}
          extra={[SEARCH_LAB_COMMON.data, SEARCH_LAB_COMMON.order]}
          inquiry={INQUIRY[method]}
        />
      )}

      <InquiryPanel spec={INQUIRY[method]} mode={mode} hasRun={run.hasRun} />
    </>
  );

  return (
    <ExperimentFrame
      title={SCREEN_TITLE[method]}
      textbook={SCREEN_TEXTBOOK[method]}
      mode={mode}
      onModeChange={onModeChange}
      dataPane={dataPane}
      stage={stageView}
      settingsPane={settingsPane}
      below={below}
    />
  );
}
