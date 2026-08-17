import { useMemo, useState } from 'react';
import { ExperimentFrame, type LearnMode } from '../../ui/ExperimentFrame';
import { SettingRow } from '../../ui/controls';
import { InquiryPanel } from '../../ui/InquiryPanel';
import { TeacherPanel } from '../../ui/TeacherPanel';
import { REGRESSION_TEACHER_NOTES, REGRESSION_COMMON } from '../../teacher/regressionTeacher';
import { SpeciesLegend } from '../../ui/DataCharts';
import { PipelineBar } from '../data/DataLabScreen';
import {
  NUMERIC_FIELDS,
  SPECIES_STYLE,
  completeRows,
  fieldOf,
  runPipeline,
  type Pipeline,
} from '../../data/penguinData';
import { trainTestSplit } from '../../core/stats';
import { evaluate, type Point } from '../../core/knn';
import { usePersisted } from '../../usePersisted';
import { REGRESSION_INQUIRY } from './regressionInquiry';

/**
 * 화면 3-1 훈련 데이터와 테스트 데이터 / 3-2 과적합
 * 교과서 Ⅱ-02 인쇄 94~95, 100쪽
 *
 * 두 화면이 같은 데이터와 같은 분할을 공유한다.
 * 3-1 에서 비율을 바꾸면 3-2 의 곡선도 함께 달라진다.
 */

const W = 620;
const H = 430;
const PAD = { top: 20, right: 18, bottom: 48, left: 60 };

export type SplitScreenId = 'split' | 'overfit';

interface Props {
  screen: SplitScreenId;
  mode: LearnMode;
  onModeChange: (m: LearnMode) => void;
  teacherMode: boolean;
}

function shapePath(shape: string, x: number, y: number, r: number): string {
  if (shape === 'triangle') return `M ${x} ${y - r * 1.15} L ${x + r} ${y + r * 0.75} L ${x - r} ${y + r * 0.75} Z`;
  if (shape === 'square') return `M ${x - r * 0.9} ${y - r * 0.9} h ${r * 1.8} v ${r * 1.8} h ${-r * 1.8} Z`;
  return `M ${x} ${y - r} a ${r} ${r} 0 1 0 0.01 0 Z`;
}

export function SplitLabScreen({ screen, mode, onModeChange, teacherMode }: Props) {
  const [pipeline] = usePersisted<Pipeline>('data:pipeline', {
    missing: 'keep',
    removeBadSex: false,
    removeMassOutliers: false,
  });
  const [testRatio, setTestRatio] = usePersisted('split:ratio', 0.3);
  const [seed, setSeed] = usePersisted('split:seed', 42);
  const [k, setK] = usePersisted('overfit:k', 5);
  const [xKey, setXKey] = usePersisted('split:x', 'culmen_length_mm');
  const [yKey, setYKey] = usePersisted('split:y', 'culmen_depth_mm');

  const { rows } = useMemo(() => runPipeline(pipeline), [pipeline]);
  const clean = useMemo(() => completeRows(rows), [rows]);

  const points = useMemo<Point[]>(
    () =>
      clean.map((r) => ({
        x: r[xKey] as number,
        y: r[yKey] as number,
        label: r.species as string,
      })),
    [clean, xKey, yKey],
  );

  const split = useMemo(
    () => trainTestSplit(points, testRatio, seed),
    [points, testRatio, seed],
  );

  /** k = 1 부터 25 까지의 훈련·테스트 정확도 곡선 */
  const curve = useMemo(() => {
    const ks: number[] = [];
    for (let i = 1; i <= 25; i += 2) ks.push(i);
    return ks.map((kk) => ({
      k: kk,
      train: evaluate(split.train, split.train, kk, 'euclidean').accuracy,
      test: evaluate(split.train, split.test, kk, 'euclidean').accuracy,
    }));
  }, [split]);

  const current = useMemo(
    () => ({
      train: evaluate(split.train, split.train, k, 'euclidean'),
      test: evaluate(split.train, split.test, k, 'euclidean'),
    }),
    [split, k],
  );

  /** 테스트 정확도가 가장 높았던 k */
  const bestK = useMemo(
    () => curve.reduce((a, b) => (b.test > a.test ? b : a), curve[0]),
    [curve],
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

  const sx = (v: number) =>
    PAD.left + ((v - bounds.minX) / (bounds.maxX - bounds.minX)) * (W - PAD.left - PAD.right);
  const sy = (v: number) =>
    H - PAD.bottom - ((v - bounds.minY) / (bounds.maxY - bounds.minY)) * (H - PAD.top - PAD.bottom);

  const inquiry = REGRESSION_INQUIRY[screen];

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
      <SettingRow label="가로축">
        <select value={xKey} onChange={(e) => setXKey(e.target.value)}>
          {NUMERIC_FIELDS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="세로축">
        <select value={yKey} onChange={(e) => setYKey(e.target.value)}>
          {NUMERIC_FIELDS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </SettingRow>
      <SettingRow label="지금 나뉜 결과">
        <ul className="field-list">
          <li>
            <span>전체</span>
            <span>{points.length}개</span>
          </li>
          <li>
            <span>훈련 데이터</span>
            <span>{split.train.length}개</span>
          </li>
          <li>
            <span>테스트 데이터</span>
            <span>{split.test.length}개</span>
          </li>
        </ul>
      </SettingRow>
    </>
  );

  /* ── 가운데 ────────────────────────────────────────── */
  const stageView = (
    <>
      <PipelineBar pipeline={pipeline} />
      <div className="stage">
        <span className="stage__mode">
          {screen === 'split'
            ? `훈련 ${Math.round((1 - testRatio) * 100)}% / 테스트 ${Math.round(testRatio * 100)}%`
            : `과적합 · k = ${k}`}
        </span>

        {screen === 'split' ? (
          <div style={{ padding: '34px 8px 4px' }}>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="훈련 데이터와 테스트 데이터 분할">
              <title>{`전체 ${points.length}개 중 훈련 ${split.train.length}개, 테스트 ${split.test.length}개로 나누었습니다.`}</title>
              <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#c3cecb" />
              <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#c3cecb" />
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
                const st = SPECIES_STYLE[p.label ?? ''] ?? { color: '#7e8b87', shape: 'circle' as const };
                return <path key={`tr${i}`} d={shapePath(st.shape, sx(p.x), sy(p.y), 3.8)} fill={st.color} fillOpacity={0.75} />;
              })}
              {split.test.map((p, i) => {
                const st = SPECIES_STYLE[p.label ?? ''] ?? { color: '#7e8b87', shape: 'circle' as const };
                return (
                  <path
                    key={`te${i}`}
                    d={shapePath(st.shape, sx(p.x), sy(p.y), 4.6)}
                    fill="#ffffff"
                    stroke={st.color}
                    strokeWidth={2}
                  />
                );
              })}
            </svg>
          </div>
        ) : (
          <div style={{ padding: '34px 8px 4px' }}>
            <AccuracyCurve curve={curve} k={k} bestK={bestK.k} />
          </div>
        )}

        <SpeciesLegend />
        {screen === 'split' && (
          <div className="legend legend--extra">
            <span className="legend__item">채운 모양 · 훈련 데이터</span>
            <span className="legend__item">빈 모양 · 테스트 데이터</span>
          </div>
        )}
      </div>

      <div className="stage-summary">
        {screen === 'split' ? (
          <>
            <div className="stage-summary__step">
              전체 {points.length}개 중 <strong>훈련 {split.train.length}개</strong>,{' '}
              <strong>테스트 {split.test.length}개</strong>로 나누었습니다.
            </div>
            <div className="stage-summary__stat">
              k = {k} 로 학습했을 때 테스트 정확도 {(current.test.accuracy * 100).toFixed(1)}% ·
              테스트 {current.test.total}개 중 {current.test.correct}개를 맞혔습니다.
            </div>
          </>
        ) : (
          <>
            <div className="stage-summary__step">
              k = {k} 일 때 훈련 정확도 <strong>{(current.train.accuracy * 100).toFixed(1)}%</strong>,
              테스트 정확도 <strong>{(current.test.accuracy * 100).toFixed(1)}%</strong> ·
              두 값의 차이 {((current.train.accuracy - current.test.accuracy) * 100).toFixed(1)}%p
            </div>
            <div className="stage-summary__stat">
              테스트 정확도가 가장 높았던 값은 k = {bestK.k} 입니다 (
              {(bestK.test * 100).toFixed(1)}%).
            </div>
          </>
        )}
      </div>
    </>
  );

  /* ── 오른쪽 ────────────────────────────────────────── */
  const settingsPane = (
    <>
      <p className="pane__title">설정</p>

      <SettingRow
        label="테스트 데이터 비율"
        value={`${Math.round(testRatio * 100)}%`}
        help="학습에 사용하지 않고, 모델이 새로운 데이터를 얼마나 잘 판단하는지 확인하기 위해 남겨 두는 데이터의 비율입니다."
      >
        <input
          type="range"
          min={10}
          max={50}
          step={5}
          value={Math.round(testRatio * 100)}
          onChange={(e) => setTestRatio(Number(e.target.value) / 100)}
          aria-label="테스트 데이터 비율"
        />
        <div className="muted" style={{ fontSize: 12.5 }}>
          훈련 {Math.round((1 - testRatio) * 100)}% / 테스트 {Math.round(testRatio * 100)}%
        </div>
      </SettingRow>

      <SettingRow
        label="다시 나누기"
        help="무작위로 다시 나눕니다. 같은 비율이어도 어떤 데이터가 뽑히느냐에 따라 결과가 조금씩 달라집니다."
      >
        <button type="button" className="btn btn--wide" onClick={() => setSeed(seed + 1)}>
          무작위로 다시 나누기
        </button>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 5 }}>
          지금까지 {seed - 41}번 나누었습니다
        </div>
      </SettingRow>

      <SettingRow
        label="모델의 k 값"
        value={String(k)}
        help="k 가 작을수록 훈련 데이터에 더 딱 맞는 복잡한 모델이 되고, 클수록 단순한 모델이 됩니다."
      >
        <input
          type="range"
          min={1}
          max={25}
          step={2}
          value={k}
          onChange={(e) => setK(Number(e.target.value))}
          aria-label="k 값"
        />
      </SettingRow>

      <div className="metric-cards">
        <div className="metric-card">
          <span className="metric-card__label">훈련 정확도</span>
          <span className="metric-card__value">{(current.train.accuracy * 100).toFixed(1)}%</span>
        </div>
        <div className="metric-card metric-card--test">
          <span className="metric-card__label">테스트 정확도</span>
          <span className="metric-card__value">{(current.test.accuracy * 100).toFixed(1)}%</span>
        </div>
      </div>

      <button
        type="button"
        className="btn btn--wide"
        style={{ marginTop: 10 }}
        onClick={() => {
          setTestRatio(0.3);
          setSeed(42);
          setK(5);
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
        <h2>k 값에 따른 정확도</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="num">k</th>
                <th className="num">훈련 정확도</th>
                <th className="num">테스트 정확도</th>
                <th className="num">차이</th>
              </tr>
            </thead>
            <tbody>
              {curve.map((c) => (
                <tr key={c.k} className={c.k === k ? 'is-best' : undefined}>
                  <td className="num">{c.k}</td>
                  <td className="num">{(c.train * 100).toFixed(1)}%</td>
                  <td className="num">{(c.test * 100).toFixed(1)}%</td>
                  <td className="num">{((c.train - c.test) * 100).toFixed(1)}%p</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          k = 1 에서는 훈련 정확도가 거의 100% 입니다. 훈련 데이터 자기 자신이 가장 가까운
          이웃이기 때문입니다. 그런데 테스트 정확도는 그렇지 않습니다.
        </p>
      </section>

      {teacherMode && (
        <TeacherPanel
          note={REGRESSION_TEACHER_NOTES[screen]}
          extra={[REGRESSION_COMMON.split, REGRESSION_COMMON.overfit]}
          inquiry={inquiry}
        />
      )}

      <InquiryPanel spec={inquiry} mode={mode} hasRun />
    </>
  );

  return (
    <ExperimentFrame
      title={screen === 'split' ? '훈련 데이터와 테스트 데이터' : '과적합'}
      textbook={screen === 'split' ? 'Ⅱ-02 · 94, 100쪽' : 'Ⅱ-02 · 95쪽'}
      mode={mode}
      onModeChange={onModeChange}
      dataPane={dataPane}
      stage={stageView}
      settingsPane={settingsPane}
      below={below}
    />
  );
}

/* ── 훈련·테스트 정확도 2선 그래프 ─────────────────────────── */

function AccuracyCurve({
  curve,
  k,
  bestK,
}: {
  curve: { k: number; train: number; test: number }[];
  k: number;
  bestK: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const lo = Math.min(...curve.flatMap((c) => [c.train, c.test])) - 0.02;
  const hi = 1.005;
  const sx = (kk: number) => PAD.left + ((kk - 1) / 24) * (W - PAD.left - PAD.right);
  const sy = (v: number) => H - PAD.bottom - ((v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const line = (key: 'train' | 'test') =>
    curve.map((c, i) => `${i === 0 ? 'M' : 'L'} ${sx(c.k)} ${sy(c[key])}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="k 값에 따른 훈련 정확도와 테스트 정확도"
      onMouseLeave={() => setHover(null)}
    >
      <title>k 값이 커질수록 훈련 정확도는 낮아지고, 테스트 정확도는 어느 지점까지 올라갔다가 다시 낮아집니다.</title>

      {[0, 0.25, 0.5, 0.75, 1].map((p) => {
        const v = lo + (hi - lo) * p;
        return (
          <g key={p}>
            <line x1={PAD.left} y1={sy(v)} x2={W - PAD.right} y2={sy(v)} stroke="#eef1f0" />
            <text x={PAD.left - 8} y={sy(v) + 4} textAnchor="end" fontSize={11.5} fill="#7e8b87">
              {(v * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#c3cecb" />

      {curve.map((c) => (
        <text key={c.k} x={sx(c.k)} y={H - PAD.bottom + 18} textAnchor="middle" fontSize={11} fill="#7e8b87">
          {c.k}
        </text>
      ))}
      <text x={(W + PAD.left) / 2} y={H - 10} textAnchor="middle" fontSize={12.5} fill="#4c5a56">
        k 값
      </text>

      {/* 지금 고른 k */}
      <line x1={sx(k)} y1={PAD.top} x2={sx(k)} y2={H - PAD.bottom} stroke="#14201d" strokeWidth={1.5} strokeDasharray="4 3" />
      {/* 테스트 정확도가 가장 높은 k */}
      <line x1={sx(bestK)} y1={PAD.top} x2={sx(bestK)} y2={H - PAD.bottom} stroke="#0b6e5c" strokeWidth={1.2} strokeDasharray="2 4" />

      <path d={line('train')} fill="none" stroke="#a0481c" strokeWidth={2.6} />
      <path d={line('test')} fill="none" stroke="#0b6e5c" strokeWidth={2.6} />

      {curve.map((c) => (
        <g key={`p${c.k}`} onMouseEnter={() => setHover(c.k)}>
          <rect x={sx(c.k) - 10} y={PAD.top} width={20} height={H - PAD.top - PAD.bottom} fill="transparent" />
          <circle cx={sx(c.k)} cy={sy(c.train)} r={c.k === k || hover === c.k ? 5 : 3} fill="#a0481c" />
          <circle cx={sx(c.k)} cy={sy(c.test)} r={c.k === k || hover === c.k ? 5 : 3} fill="#0b6e5c" />
        </g>
      ))}

      <g transform={`translate(${W - PAD.right - 168}, ${PAD.top + 6})`}>
        <rect x={-10} y={-14} width={178} height={44} rx={6} fill="#ffffff" fillOpacity={0.92} stroke="#d5dedb" />
        <line x1={0} y1={0} x2={20} y2={0} stroke="#a0481c" strokeWidth={2.6} />
        <text x={26} y={4} fontSize={12} fill="#4c5a56">
          훈련 데이터 정확도
        </text>
        <line x1={0} y1={18} x2={20} y2={18} stroke="#0b6e5c" strokeWidth={2.6} />
        <text x={26} y={22} fontSize={12} fill="#4c5a56">
          테스트 데이터 정확도
        </text>
      </g>
    </svg>
  );
}
