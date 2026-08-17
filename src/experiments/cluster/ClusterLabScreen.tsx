import { useEffect, useMemo, useState } from 'react';
import { ExperimentFrame, type LearnMode } from '../../ui/ExperimentFrame';
import { SettingRow, StepController, SPEED_MS, type Speed } from '../../ui/controls';
import { InquiryPanel } from '../../ui/InquiryPanel';
import { TeacherPanel } from '../../ui/TeacherPanel';
import { CLUSTER_TEACHER_NOTES, CLUSTER_COMMON } from '../../teacher/clusterTeacher';
import {
  collectKMeans,
  silhouetteScore,
  silhouetteValues,
  type ClusterPoint,
} from '../../core/kmeans';
import { applyScaler, fitScaler } from '../../core/stats';
import mallRaw from '../../data/mall.json' with { type: 'json' };
import cafeRaw from '../../data/cafe.json' with { type: 'json' };
import { usePersisted } from '../../usePersisted';
import { CLUSTER_INQUIRY } from './clusterInquiry';

/**
 * 화면 5-1 k-평균 군집 / 5-2 군집 개수 정하기
 * 교과서 Ⅱ-02 인쇄 118~124쪽
 *
 * 교과서 119쪽의 여섯 단계를 한 단계씩 눌러 볼 수 있게 했다.
 * MVP 1 탐색 실험실의 StepController 를 그대로 재사용한다.
 * 중심점이 지나온 자리를 잔상으로 남겨 어떻게 움직였는지 보이게 했다.
 */

const W = 620;
const H = 470;
const PAD = { top: 22, right: 20, bottom: 50, left: 62 };

/** 군집 색. 색만으로 구분하지 않도록 번호를 함께 표시한다. */
const CLUSTER_COLORS = ['#1f6fb2', '#c25a1f', '#2e7d4f', '#7b4fa8', '#b8860b', '#0e7490', '#a0481c', '#4c5a56'];

export type ClusterScreenId = 'kmeans' | 'silhouette';

type DatasetId = 'mall' | 'cafe';

interface DatasetDef {
  id: DatasetId;
  name: string;
  note: string;
  xKey: string;
  yKey: string;
  xLabel: string;
  yLabel: string;
  textbook: string;
  bestK: number;
  rows: Record<string, number | string>[];
}

const DATASETS: Record<DatasetId, DatasetDef> = {
  mall: {
    id: 'mall',
    name: '쇼핑몰 고객',
    note: '교육용 예제 데이터 · 200행',
    xKey: 'annual_income',
    yKey: 'spending_score',
    xLabel: '연 소득',
    yLabel: '소비 점수',
    textbook: '120~123쪽',
    bestK: 5,
    rows: mallRaw as Record<string, number>[],
  },
  cafe: {
    id: 'cafe',
    name: '카페 음료',
    note: '교육용 예제 데이터 · 60행',
    xKey: 'sugars',
    yKey: 'caffeine',
    xLabel: '당류 (g)',
    yLabel: '카페인 (mg)',
    textbook: '124쪽',
    bestK: 4,
    rows: cafeRaw as Record<string, number | string>[],
  },
};

interface Props {
  screen: ClusterScreenId;
  mode: LearnMode;
  onModeChange: (m: LearnMode) => void;
  teacherMode: boolean;
}

export function ClusterLabScreen({ screen, mode, onModeChange, teacherMode }: Props) {
  const [datasetId, setDatasetId] = usePersisted<DatasetId>('cluster:data', 'mall');
  const [k, setK] = usePersisted('cluster:k', 5);
  const [seed, setSeed] = usePersisted('cluster:seed', 977);
  const [normalize, setNormalize] = usePersisted('cluster:normalize', true);
  const [stepIndex, setStepIndex] = useState(0);
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState<Speed>('normal');
  const [showTrail, setShowTrail] = usePersisted('cluster:trail', true);

  const dataset = DATASETS[datasetId];

  /** 화면에 그릴 좌표. 정규화를 켜면 0~1 로 바꾼다. */
  const points = useMemo<ClusterPoint[]>(() => {
    const xs = dataset.rows.map((r) => r[dataset.xKey] as number);
    const ys = dataset.rows.map((r) => r[dataset.yKey] as number);
    const sx = fitScaler(xs);
    const sy = fitScaler(ys);
    return dataset.rows.map((r, index) => ({
      x: normalize ? applyScaler(r[dataset.xKey] as number, sx) : (r[dataset.xKey] as number),
      y: normalize ? applyScaler(r[dataset.yKey] as number, sy) : (r[dataset.yKey] as number),
      index,
    }));
  }, [dataset, normalize]);

  const { steps, result } = useMemo(
    () => collectKMeans(points, { k, seed }),
    [points, k, seed],
  );

  // 설정이 바뀌면 처음으로 되돌린다
  useEffect(() => {
    setStepIndex(0);
    setAuto(false);
  }, [steps]);

  const atEnd = stepIndex >= steps.length - 1;

  useEffect(() => {
    if (!auto) return;
    if (atEnd) {
      setAuto(false);
      return;
    }
    const t = window.setTimeout(
      () => setStepIndex((i) => Math.min(i + 1, steps.length - 1)),
      SPEED_MS[speed],
    );
    return () => window.clearTimeout(t);
  }, [auto, atEnd, stepIndex, speed, steps.length]);

  const step = steps[stepIndex];

  /** k = 2 부터 8 까지의 실루엣 점수 */
  const silhouetteByK = useMemo(() => {
    const out: { k: number; score: number }[] = [];
    for (let kk = 2; kk <= 8; kk++) {
      const { result: r } = collectKMeans(points, { k: kk, seed });
      const score =
        new Set(r.labels).size < kk ? 0 : silhouetteScore(points, r.labels, kk);
      out.push({ k: kk, score });
    }
    return out;
  }, [points, seed]);

  const bestSilhouette = useMemo(
    () => silhouetteByK.reduce((a, b) => (b.score > a.score ? b : a), silhouetteByK[0]),
    [silhouetteByK],
  );

  const currentSilhouette = useMemo(() => {
    if (new Set(result.labels).size < k) return null;
    return {
      score: silhouetteScore(points, result.labels, k),
      values: silhouetteValues(points, result.labels, k),
    };
  }, [points, result.labels, k]);

  const bounds = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const px = (maxX - minX) * 0.07;
    const py = (maxY - minY) * 0.07;
    return { minX: minX - px, maxX: maxX + px, minY: minY - py, maxY: maxY + py };
  }, [points]);

  const sx = (v: number) =>
    PAD.left + ((v - bounds.minX) / (bounds.maxX - bounds.minX)) * (W - PAD.left - PAD.right);
  const sy = (v: number) =>
    H - PAD.bottom - ((v - bounds.minY) / (bounds.maxY - bounds.minY)) * (H - PAD.top - PAD.bottom);

  const fmt = (v: number) => (normalize ? v.toFixed(2) : v.toFixed(0));
  const inquiry = CLUSTER_INQUIRY[screen];

  const sizes = useMemo(() => {
    const counts = new Array(k).fill(0);
    for (const l of result.labels) if (l >= 0) counts[l] += 1;
    return counts;
  }, [result.labels, k]);

  /* ── 왼쪽 ──────────────────────────────────────────── */
  const dataPane = (
    <>
      <p className="pane__title">데이터</p>

      <SettingRow label="데이터 고르기" help="두 데이터 모두 눈으로 보이는 덩어리의 수가 다릅니다.">
        <div className="segmented" role="group" aria-label="데이터">
          {(['mall', 'cafe'] as DatasetId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={datasetId === id ? 'is-on' : ''}
              onClick={() => setDatasetId(id)}
            >
              {DATASETS[id].name}
            </button>
          ))}
        </div>
        <div className="note" style={{ marginTop: 8 }}>
          <strong>{dataset.name}</strong>
          <br />
          {dataset.note}
          <br />
          <span className="muted">교과서 {dataset.textbook}</span>
        </div>
      </SettingRow>

      <SettingRow label="사용하는 속성">
        <ul className="field-list">
          <li>
            <span>가로축</span>
            <span>{dataset.xLabel}</span>
          </li>
          <li>
            <span>세로축</span>
            <span>{dataset.yLabel}</span>
          </li>
          <li>
            <span>타깃</span>
            <span style={{ color: 'var(--signal)' }}>없음</span>
          </li>
        </ul>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 12.5 }}>
          군집화는 정답이 주어지지 않은 비지도 학습입니다 (교과서 118쪽).
        </p>
      </SettingRow>

      <SettingRow label="군집별 데이터 수">
        <ul className="field-list">
          {sizes.map((n, i) => (
            <li key={i}>
              <span>
                <span
                  className="cluster-dot"
                  style={{ background: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }}
                />
                군집 {i + 1}
              </span>
              <span>{n}개</span>
            </li>
          ))}
        </ul>
      </SettingRow>
    </>
  );

  /* ── 가운데 ────────────────────────────────────────── */
  const PHASE_LABEL: Record<string, string> = {
    init: 'STEP 1 · 초기 중심점 선택',
    assign: 'STEP 2 · 가까운 중심점에 배정',
    update: 'STEP 3~4 · 새 중심 계산과 이동',
    done: 'STEP 6 · 반복 종료',
  };

  const stageView = (
    <>
      <div className="stage">
        <span className="stage__mode">
          k-평균 · k = {k} · {step ? PHASE_LABEL[step.phase] : ''}
        </span>
        <div style={{ padding: '36px 8px 4px' }}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="k-평균 군집화 진행 상황">
            <title>
              {`군집 ${k}개로 나누는 과정입니다. 큰 표시가 중심점이고, 흐린 선은 중심점이 지나온 자리입니다.`}
            </title>

            {[0, 0.25, 0.5, 0.75, 1].map((p) => {
              const vx = bounds.minX + (bounds.maxX - bounds.minX) * p;
              const vy = bounds.minY + (bounds.maxY - bounds.minY) * p;
              return (
                <g key={p}>
                  <line x1={PAD.left} y1={sy(vy)} x2={W - PAD.right} y2={sy(vy)} stroke="#eef1f0" />
                  <text x={sx(vx)} y={H - PAD.bottom + 18} textAnchor="middle" fontSize={11.5} fill="#7e8b87">
                    {fmt(vx)}
                  </text>
                  <text x={PAD.left - 8} y={sy(vy) + 4} textAnchor="end" fontSize={11.5} fill="#7e8b87">
                    {fmt(vy)}
                  </text>
                </g>
              );
            })}
            <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#c3cecb" />
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#c3cecb" />
            <text x={(W + PAD.left) / 2} y={H - 10} textAnchor="middle" fontSize={12.5} fill="#4c5a56">
              {dataset.xLabel}
              {normalize ? ' (0~1)' : ''}
            </text>
            <text
              x={-(H - PAD.bottom + PAD.top) / 2}
              y={15}
              transform="rotate(-90)"
              textAnchor="middle"
              fontSize={12.5}
              fill="#4c5a56"
            >
              {dataset.yLabel}
              {normalize ? ' (0~1)' : ''}
            </text>

            {/* 중심점이 지나온 경로 */}
            {showTrail &&
              step?.centers.map((c, i) =>
                c.trail.length < 2 ? null : (
                  <polyline
                    key={`t${i}`}
                    points={c.trail.map((t) => `${sx(t.x)},${sy(t.y)}`).join(' ')}
                    fill="none"
                    stroke={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
                    strokeWidth={1.6}
                    strokeOpacity={0.45}
                    strokeDasharray="5 3"
                  />
                ),
              )}

            {/* 데이터 */}
            {points.map((p, i) => {
              const label = step?.labels[i] ?? -1;
              const color = label < 0 ? '#9aa8a4' : CLUSTER_COLORS[label % CLUSTER_COLORS.length];
              return (
                <circle
                  key={i}
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={3.4}
                  fill={color}
                  fillOpacity={label < 0 ? 0.5 : 0.8}
                />
              );
            })}

            {/* 중심점 — 번호를 함께 표시해 색에만 기대지 않는다 */}
            {step?.centers.map((c, i) => (
              <g key={`c${i}`}>
                <circle cx={sx(c.x)} cy={sy(c.y)} r={13} fill="#ffffff" fillOpacity={0.9} />
                <circle
                  cx={sx(c.x)}
                  cy={sy(c.y)}
                  r={11}
                  fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
                  fillOpacity={0.3}
                  stroke={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
                  strokeWidth={2.5}
                />
                <text
                  x={sx(c.x)}
                  y={sy(c.y) + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={700}
                  fill={CLUSTER_COLORS[i % CLUSTER_COLORS.length]}
                >
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="stage-summary">
        <div className="stage-summary__step">
          {step ? (
            <>
              <strong>
                {step.index}단계 · {step.round > 0 ? `${step.round}번째 반복` : '시작'}
              </strong>{' '}
              {step.message}
            </>
          ) : (
            '오른쪽에서 [한 단계 실행]을 눌러 시작하세요.'
          )}
        </div>
        <div className="stage-summary__stat">
          {step?.phase === 'update' && step.moved > 0 && `중심점이 움직인 거리의 합 ${step.moved.toFixed(3)} · `}
          {result.converged
            ? `${result.rounds}번 반복하면 결과가 안정됩니다`
            : '아직 안정되지 않았습니다'}
          {currentSilhouette && ` · 실루엣 점수 ${currentSilhouette.score.toFixed(3)}`}
        </div>
      </div>
    </>
  );

  /* ── 오른쪽 ────────────────────────────────────────── */
  const settingsPane = (
    <>
      <p className="pane__title">설정</p>

      <SettingRow
        label="군집 개수 k"
        value={String(k)}
        help="데이터를 몇 개의 무리로 나눌지 사람이 직접 정합니다. 알고리즘이 정해 주지 않습니다."
      >
        <input
          type="range"
          min={2}
          max={8}
          step={1}
          value={k}
          onChange={(e) => setK(Number(e.target.value))}
          aria-label="군집 개수"
        />
      </SettingRow>

      <StepController
        onStep={() => setStepIndex((i) => Math.min(i + 1, steps.length - 1))}
        onBack={() => setStepIndex((i) => Math.max(i - 1, 0))}
        onReset={() => {
          setAuto(false);
          setStepIndex(0);
        }}
        onToggleAuto={() => setAuto((v) => !v)}
        auto={auto}
        canStep={!atEnd}
        canBack={stepIndex > 0}
        speed={speed}
        onSpeedChange={setSpeed}
      />

      <SettingRow
        label="초기 중심점"
        help="처음에 어디서 시작하느냐에 따라 최종 결과가 달라질 수 있습니다. 여러 번 눌러 확인해 보세요."
      >
        <button type="button" className="btn btn--wide" onClick={() => setSeed(seed + 137)}>
          초기 중심점 다시 뽑기
        </button>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 5 }}>
          지금까지 {Math.round((seed - 977) / 137)}번 다시 뽑았습니다
        </div>
      </SettingRow>

      <SettingRow label="중심점 이동 경로">
        <div className="segmented" role="group" aria-label="이동 경로">
          <button type="button" className={!showTrail ? 'is-on' : ''} onClick={() => setShowTrail(false)}>
            숨김
          </button>
          <button type="button" className={showTrail ? 'is-on' : ''} onClick={() => setShowTrail(true)}>
            표시
          </button>
        </div>
      </SettingRow>

      <SettingRow
        label="정규화"
        help="연 소득과 소비 점수처럼 값의 범위가 다르면, 범위가 큰 속성이 거리를 지배합니다."
      >
        <div className="segmented" role="group" aria-label="정규화">
          <button type="button" className={!normalize ? 'is-on' : ''} onClick={() => setNormalize(false)}>
            끔
          </button>
          <button type="button" className={normalize ? 'is-on' : ''} onClick={() => setNormalize(true)}>
            켬
          </button>
        </div>
      </SettingRow>

      <div className="metric-cards">
        <div className="metric-card">
          <span className="metric-card__label">반복 횟수</span>
          <span className="metric-card__value">{result.rounds}</span>
        </div>
        <div className="metric-card metric-card--test">
          <span className="metric-card__label">실루엣 점수</span>
          <span className="metric-card__value">
            {currentSilhouette ? currentSilhouette.score.toFixed(3) : '—'}
          </span>
        </div>
      </div>
    </>
  );

  /* ── 아래 ──────────────────────────────────────────── */
  const below = (
    <>
      {screen === 'silhouette' && (
        <section className="section-card">
          <h2>군집 개수에 따른 실루엣 점수</h2>
          <p>
            실루엣 점수는 <strong>군집 안의 데이터끼리는 얼마나 가까운지</strong>와{' '}
            <strong>다른 군집과는 얼마나 떨어져 있는지</strong>를 함께 본 값입니다. 1 에 가까울수록
            잘 나뉜 것입니다 (교과서 123쪽).
          </p>
          <SilhouetteChart data={silhouetteByK} current={k} best={bestSilhouette.k} onPick={setK} />
          <p className="muted">
            지금 데이터에서는 <strong>k = {bestSilhouette.k}</strong> 일 때 점수가 가장 높습니다 (
            {bestSilhouette.score.toFixed(3)}). 눈으로 보기에도 그렇게 나뉘는지 위 그래프에서
            확인해 보세요.
          </p>
        </section>
      )}

      <section className="section-card">
        <h2>단계별로 무슨 일이 일어났나</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">단계</th>
                <th>하는 일</th>
                <th className="num">군집이 바뀐 데이터</th>
                <th className="num">중심점 이동 거리</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={s.index} className={i === stepIndex ? 'is-best' : undefined}>
                  <td className="num">{s.index}</td>
                  <td>{PHASE_LABEL[s.phase]}</td>
                  <td className="num">{s.phase === 'assign' ? `${s.changed}개` : '—'}</td>
                  <td className="num">{s.phase === 'update' ? s.moved.toFixed(3) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          배정과 중심 이동을 번갈아 반복하다가, 더 이상 바뀌는 데이터가 없으면 멈춥니다 (교과서
          119쪽).
        </p>
      </section>

      {screen === 'kmeans' && (
        <section className="section-card">
          <h2>초기 중심점을 바꾸면 결과가 달라질까</h2>
          <p>
            같은 데이터와 같은 k 인데도, 처음에 어디서 시작하느냐에 따라 결과가 달라질 수 있습니다.
            아래는 서로 다른 시작점으로 여섯 번 실행한 결과입니다.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="num">실행</th>
                  <th className="num">반복 횟수</th>
                  <th className="num">실루엣 점수</th>
                  <th>군집별 데이터 수</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const s = 977 + i * 137;
                  const { result: r } = collectKMeans(points, { k, seed: s });
                  const counts = new Array(k).fill(0);
                  for (const l of r.labels) if (l >= 0) counts[l] += 1;
                  const score =
                    new Set(r.labels).size < k ? null : silhouetteScore(points, r.labels, k);
                  return (
                    <tr key={i} className={s === seed ? 'is-best' : undefined}>
                      <td className="num">{i + 1}</td>
                      <td className="num">{r.rounds}</td>
                      <td className="num">{score === null ? '—' : score.toFixed(3)}</td>
                      <td className="num">{counts.slice().sort((a, b) => b - a).join(' · ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted">
            반복 횟수가 다르고, 때로는 군집의 크기까지 달라집니다. 정답이 정해져 있지 않은 학습이기
            때문입니다.
          </p>
        </section>
      )}

      {teacherMode && (
        <TeacherPanel
          note={CLUSTER_TEACHER_NOTES[screen]}
          extra={[CLUSTER_COMMON.data, CLUSTER_COMMON.seed]}
          inquiry={inquiry}
        />
      )}

      <InquiryPanel spec={inquiry} mode={mode} hasRun={atEnd && steps.length > 1} />
    </>
  );

  return (
    <ExperimentFrame
      title={screen === 'kmeans' ? 'k-평균 군집' : '군집 개수 정하기'}
      textbook={screen === 'kmeans' ? 'Ⅱ-02 · 118~122쪽' : 'Ⅱ-02 · 123~124쪽'}
      mode={mode}
      onModeChange={onModeChange}
      dataPane={dataPane}
      stage={stageView}
      settingsPane={settingsPane}
      below={below}
    />
  );
}

/* ── 실루엣 점수 막대그래프 ────────────────────────────────── */

function SilhouetteChart({
  data,
  current,
  best,
  onPick,
}: {
  data: { k: number; score: number }[];
  current: number;
  best: number;
  onPick: (k: number) => void;
}) {
  const CW = 620;
  const CH = 260;
  const base = 208;
  const max = Math.max(...data.map((d) => d.score), 0.1);

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label="군집 개수에 따른 실루엣 점수">
      <title>
        {`군집 개수별 실루엣 점수. ${data.map((d) => `k=${d.k} ${d.score.toFixed(2)}`).join(', ')}.`}
      </title>
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <g key={p}>
          <line x1={54} y1={base - p * 160} x2={CW - 20} y2={base - p * 160} stroke="#eef1f0" />
          <text x={46} y={base - p * 160 + 4} textAnchor="end" fontSize={11.5} fill="#7e8b87">
            {(p * max).toFixed(2)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const bw = 52;
        const x = 74 + i * 76;
        const h = Math.max(2, (d.score / max) * 160);
        const isBest = d.k === best;
        const isCurrent = d.k === current;
        return (
          <g key={d.k} onClick={() => onPick(d.k)} style={{ cursor: 'pointer' }}>
            <rect x={x - 8} y={20} width={bw + 16} height={base - 10} fill="transparent" />
            <rect
              x={x}
              y={base - h}
              width={bw}
              height={h}
              rx={4}
              fill={isBest ? '#0b6e5c' : '#8fa8a2'}
              fillOpacity={isCurrent ? 1 : 0.55}
              stroke={isCurrent ? '#14201d' : 'none'}
              strokeWidth={2}
            />
            <text x={x + bw / 2} y={base - h - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="#14201d">
              {d.score.toFixed(2)}
            </text>
            <text x={x + bw / 2} y={base + 20} textAnchor="middle" fontSize={12.5} fill="#4c5a56">
              k = {d.k}
            </text>
            {isBest && (
              <text x={x + bw / 2} y={base + 38} textAnchor="middle" fontSize={11.5} fill="#0b6e5c" fontWeight={700}>
                가장 높음
              </text>
            )}
          </g>
        );
      })}
      <line x1={54} y1={base} x2={CW - 20} y2={base} stroke="#c3cecb" />
      <text x={54} y={CH - 6} fontSize={12} fill="#7e8b87">
        막대를 누르면 그 군집 개수로 바뀝니다
      </text>
    </svg>
  );
}
