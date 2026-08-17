import { useMemo, useRef, useState } from 'react';
import { ExperimentFrame, type LearnMode } from '../../ui/ExperimentFrame';
import { SettingRow } from '../../ui/controls';
import { InquiryPanel } from '../../ui/InquiryPanel';
import { TeacherPanel } from '../../ui/TeacherPanel';
import { REGRESSION_TEACHER_NOTES, REGRESSION_COMMON } from '../../teacher/regressionTeacher';
import {
  evaluateModel,
  fitMultiple,
  fitSimple,
  predict,
  type Metrics,
  type Sample,
} from '../../core/regression';
import { trainTestSplit } from '../../core/stats';
import bodyRaw from '../../data/body.json' with { type: 'json' };
import { usePersisted } from '../../usePersisted';
import { REGRESSION_INQUIRY } from './regressionInquiry';

/**
 * 화면 3-3 선형 회귀
 * 교과서 Ⅱ-02 인쇄 96~103쪽
 *
 * 회귀선을 보여 주고 끝내지 않는다. 학생이 점을 직접 옮기고 지우고 더하면
 * 회귀선이 그 자리에서 다시 계산된다. 데이터 하나가 모델을 얼마나 흔드는지
 * 손으로 겪어 보게 하는 것이 이 화면의 목적이다.
 */

interface Body {
  neck: number;
  weight: number;
  heap: number;
  waist: number;
}
const BODY = bodyRaw as Body[];

const FEATURES: { key: keyof Body; label: string; unit: string }[] = [
  { key: 'neck', label: '목둘레', unit: 'cm' },
  { key: 'weight', label: '몸무게', unit: 'kg' },
  { key: 'heap', label: '엉덩이둘레', unit: 'cm' },
];

const W = 620;
const H = 460;
const PAD = { top: 22, right: 20, bottom: 50, left: 62 };

type EditMode = 'none' | 'add' | 'move' | 'delete';

const EDIT_LABEL: Record<EditMode, string> = {
  none: '보기만',
  add: '점 추가',
  move: '점 이동',
  delete: '점 삭제',
};

interface Props {
  mode: LearnMode;
  onModeChange: (m: LearnMode) => void;
  teacherMode: boolean;
}

/** 손으로 다루기 좋은 크기의 예제 (전체 300개 중 고르게 15개) */
function makeSmallSet(): { x: number; y: number }[] {
  const step = Math.floor(BODY.length / 15);
  return Array.from({ length: 15 }, (_, i) => ({
    x: BODY[i * step].neck,
    y: BODY[i * step].waist,
  }));
}

export function RegressionScreen({ mode, onModeChange, teacherMode }: Props) {
  const [dataset, setDataset] = usePersisted<'small' | 'full'>('reg:dataset', 'small');
  const [featureKey, setFeatureKey] = usePersisted<keyof Body>('reg:feature', 'neck');
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [showErrors, setShowErrors] = usePersisted('reg:errors', true);
  const [smallPoints, setSmallPoints] = useState(makeSmallSet);
  const [selected, setSelected] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<Metrics | null>(null);
  const [multiKeys, setMultiKeys] = usePersisted<string[]>('reg:multi', ['neck']);
  const dragging = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const feature = FEATURES.find((f) => f.key === featureKey) ?? FEATURES[0];

  const points = useMemo(
    () =>
      dataset === 'small'
        ? smallPoints
        : BODY.map((b) => ({ x: b[featureKey] as number, y: b.waist })),
    [dataset, smallPoints, featureKey],
  );

  const model = useMemo(
    () =>
      fitSimple(
        points.map((p) => p.x),
        points.map((p) => p.y),
      ),
    [points],
  );

  const samples: Sample[] = useMemo(() => points.map((p) => ({ x: [p.x], y: p.y })), [points]);
  const metrics = useMemo(() => evaluateModel(model, samples), [model, samples]);

  /* 다중 회귀 — 전체 데이터로만 (교과서 102~103쪽) */
  const multi = useMemo(() => {
    const keys = FEATURES.filter((f) => multiKeys.includes(f.key));
    if (keys.length === 0) return null;
    const s: Sample[] = BODY.map((b) => ({
      x: keys.map((f) => b[f.key] as number),
      y: b.waist,
    }));
    const split = trainTestSplit(s, 0.3, 42);
    const m = fitMultiple(split.train);
    return {
      keys,
      model: m,
      train: evaluateModel(m, split.train),
      test: evaluateModel(m, split.test),
    };
  }, [multiKeys]);

  const bounds = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const px = (maxX - minX) * 0.12 || 2;
    const py = (maxY - minY) * 0.12 || 2;
    return { minX: minX - px, maxX: maxX + px, minY: minY - py, maxY: maxY + py };
  }, [points]);

  const sx = (v: number) =>
    PAD.left + ((v - bounds.minX) / (bounds.maxX - bounds.minX)) * (W - PAD.left - PAD.right);
  const sy = (v: number) =>
    H - PAD.bottom - ((v - bounds.minY) / (bounds.maxY - bounds.minY)) * (H - PAD.top - PAD.bottom);
  const invX = (px: number) =>
    bounds.minX + ((px - PAD.left) / (W - PAD.left - PAD.right)) * (bounds.maxX - bounds.minX);
  const invY = (py: number) =>
    bounds.minY + ((H - PAD.bottom - py) / (H - PAD.top - PAD.bottom)) * (bounds.maxY - bounds.minY);

  const toLocal = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  };

  const editable = dataset === 'small';

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!editable || editMode === 'none') return;
    const local = toLocal(e.clientX, e.clientY);
    if (!local) return;
    if (local.x < PAD.left || local.x > W - PAD.right) return;
    if (local.y < PAD.top || local.y > H - PAD.bottom) return;

    const nearest = points.reduce(
      (best, p, i) => {
        const d = Math.hypot(sx(p.x) - local.x, sy(p.y) - local.y);
        return d < best.d ? { i, d } : best;
      },
      { i: -1, d: Infinity },
    );

    if (editMode === 'add') {
      setSmallPoints([
        ...smallPoints,
        { x: Math.round(invX(local.x) * 10) / 10, y: Math.round(invY(local.y) * 10) / 10 },
      ]);
      return;
    }
    if (editMode === 'delete') {
      if (nearest.i >= 0 && nearest.d < 26 && smallPoints.length > 3) {
        setSmallPoints(smallPoints.filter((_, i) => i !== nearest.i));
        setSelected(null);
      }
      return;
    }
    if (editMode === 'move' && nearest.i >= 0 && nearest.d < 26) {
      dragging.current = nearest.i;
      setSelected(nearest.i);
    }
  };

  const handleMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragging.current === null) return;
    const local = toLocal(e.clientX, e.clientY);
    if (!local) return;
    const i = dragging.current;
    const next = [...smallPoints];
    next[i] = {
      x: Math.round(invX(Math.max(PAD.left, Math.min(W - PAD.right, local.x))) * 10) / 10,
      y: Math.round(invY(Math.max(PAD.top, Math.min(H - PAD.bottom, local.y))) * 10) / 10,
    };
    setSmallPoints(next);
  };

  const addOutlier = () => {
    setDataset('small');
    const xs = smallPoints.map((p) => p.x);
    const ys = smallPoints.map((p) => p.y);
    setSmallPoints([
      ...smallPoints,
      { x: Math.round(Math.max(...xs) * 10) / 10, y: Math.round(Math.min(...ys) * 0.78 * 10) / 10 },
    ]);
  };

  const inquiry = REGRESSION_INQUIRY.regression;
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(2));
  const delta = (now: number, before: number | undefined) => {
    if (before === undefined) return null;
    const d = now - before;
    if (Math.abs(d) < 1e-9) return null;
    return `${d > 0 ? '+' : ''}${fmt(d)}`;
  };

  /* ── 왼쪽 ──────────────────────────────────────────── */
  const dataPane = (
    <>
      <p className="pane__title">데이터</p>
      <div className="note" style={{ marginTop: 0 }}>
        <strong>신체 치수 데이터</strong>
        <br />
        교육용 예제 데이터 · 300행
        <br />
        <span className="muted">교과서와 같은 속성 이름과 관계의 세기를 재현했습니다.</span>
      </div>

      <SettingRow label="데이터 크기" help="적은 데이터는 점을 직접 옮기며 실험하기 좋고, 전체 데이터는 실제 결과를 확인하기 좋습니다.">
        <div className="segmented" role="group" aria-label="데이터 크기">
          <button type="button" className={dataset === 'small' ? 'is-on' : ''} onClick={() => setDataset('small')}>
            15개
          </button>
          <button type="button" className={dataset === 'full' ? 'is-on' : ''} onClick={() => setDataset('full')}>
            전체 300개
          </button>
        </div>
      </SettingRow>

      <SettingRow label="독립 변수" help="허리둘레를 예측하는 데 사용할 속성입니다.">
        <select
          value={featureKey}
          onChange={(e) => setFeatureKey(e.target.value as keyof Body)}
          disabled={dataset === 'small'}
        >
          {FEATURES.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        {dataset === 'small' && (
          <p className="muted" style={{ margin: '5px 0 0', fontSize: 12.5 }}>
            15개 예제는 목둘레로 고정되어 있습니다.
          </p>
        )}
      </SettingRow>

      <SettingRow label="종속 변수">
        <div className="note" style={{ marginTop: 0 }}>허리둘레 (cm)</div>
      </SettingRow>

      <SettingRow label="회귀식">
        <p className="mono-box">
          허리둘레 = {fmt(model.coefficients[0])} × {dataset === 'small' ? '목둘레' : feature.label}{' '}
          {model.intercept >= 0 ? '+' : '−'} {fmt(Math.abs(model.intercept))}
        </p>
      </SettingRow>
    </>
  );

  /* ── 가운데 ────────────────────────────────────────── */
  const x1 = bounds.minX;
  const x2 = bounds.maxX;

  const stageView = (
    <>
      <div className="stage">
        <span className="stage__mode">
          선형 회귀 · 데이터 {points.length}개{editable && editMode !== 'none' && ` · ${EDIT_LABEL[editMode]} 중`}
        </span>
        <div style={{ padding: '34px 8px 4px' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="산점도와 회귀선"
            style={{ touchAction: editable && editMode !== 'none' ? 'none' : 'auto' }}
            onPointerDown={handlePointer}
            onPointerMove={handleMove}
            onPointerUp={() => {
              dragging.current = null;
            }}
            onPointerLeave={() => {
              dragging.current = null;
            }}
          >
            <title>산점도 위에 회귀선을 그렸습니다. 세로선은 실젯값과 예측값의 차이입니다.</title>

            {[0, 0.25, 0.5, 0.75, 1].map((p) => {
              const vx = bounds.minX + (bounds.maxX - bounds.minX) * p;
              const vy = bounds.minY + (bounds.maxY - bounds.minY) * p;
              return (
                <g key={p}>
                  <line x1={PAD.left} y1={sy(vy)} x2={W - PAD.right} y2={sy(vy)} stroke="#eef1f0" />
                  <text x={sx(vx)} y={H - PAD.bottom + 18} textAnchor="middle" fontSize={11.5} fill="#7e8b87">
                    {vx.toFixed(0)}
                  </text>
                  <text x={PAD.left - 8} y={sy(vy) + 4} textAnchor="end" fontSize={11.5} fill="#7e8b87">
                    {vy.toFixed(0)}
                  </text>
                </g>
              );
            })}
            <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#c3cecb" />
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#c3cecb" />
            <text x={(W + PAD.left) / 2} y={H - 10} textAnchor="middle" fontSize={12.5} fill="#4c5a56">
              {dataset === 'small' ? '목둘레' : feature.label} ({dataset === 'small' ? 'cm' : feature.unit})
            </text>
            <text
              x={-(H - PAD.bottom + PAD.top) / 2}
              y={15}
              transform="rotate(-90)"
              textAnchor="middle"
              fontSize={12.5}
              fill="#4c5a56"
            >
              허리둘레 (cm)
            </text>

            {/* 오차 — 실젯값과 예측값의 차이 (교과서 97쪽 그림 Ⅱ-34) */}
            {showErrors &&
              points.map((p, i) => (
                <line
                  key={`e${i}`}
                  x1={sx(p.x)}
                  y1={sy(p.y)}
                  x2={sx(p.x)}
                  y2={sy(predict(model, [p.x]))}
                  stroke="#a0481c"
                  strokeWidth={1.4}
                  strokeOpacity={dataset === 'small' ? 0.75 : 0.25}
                />
              ))}

            {/* 회귀선 */}
            <line
              x1={sx(x1)}
              y1={sy(predict(model, [x1]))}
              x2={sx(x2)}
              y2={sy(predict(model, [x2]))}
              stroke="#0b6e5c"
              strokeWidth={3}
            />

            {points.map((p, i) => (
              <g key={i} onClick={() => editMode === 'none' && setSelected(selected === i ? null : i)}>
                <circle cx={sx(p.x)} cy={sy(p.y)} r={dataset === 'small' ? 14 : 6} fill="transparent" />
                <circle
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={selected === i ? 8 : dataset === 'small' ? 6 : 3}
                  fill="#1f6fb2"
                  fillOpacity={dataset === 'small' ? 0.85 : 0.5}
                  stroke={selected === i ? '#14201d' : 'none'}
                  strokeWidth={2}
                />
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="stage-summary">
        <div className="stage-summary__step">
          {selected !== null && points[selected] ? (
            <>
              선택한 데이터 · 실젯값 <strong>{points[selected].y.toFixed(1)}</strong> · 예측값{' '}
              <strong>{predict(model, [points[selected].x]).toFixed(1)}</strong> · 오차{' '}
              <strong>{(points[selected].y - predict(model, [points[selected].x])).toFixed(1)}</strong>
            </>
          ) : editable && editMode !== 'none' ? (
            `${EDIT_LABEL[editMode]} 모드입니다. 그래프를 조작하면 회귀선이 바로 다시 계산됩니다.`
          ) : (
            '점을 눌러 그 데이터의 실젯값과 예측값을 확인해 보세요.'
          )}
        </div>
        <div className="stage-summary__stat">
          주황색 세로선이 오차입니다. 회귀선은 이 오차의 제곱을 모두 더한 값이 가장 작아지도록
          정해집니다.
        </div>
      </div>
    </>
  );

  /* ── 오른쪽 ────────────────────────────────────────── */
  const settingsPane = (
    <>
      <p className="pane__title">모델 설정</p>

      {editable && (
        <SettingRow label="데이터 편집" help="모드를 고른 뒤 그래프를 누르면 됩니다. 점을 옮기면 회귀선이 즉시 다시 계산됩니다.">
          <div style={{ display: 'grid', gap: 5 }}>
            {(['none', 'add', 'move', 'delete'] as EditMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`btn btn--wide${editMode === m ? ' btn--primary' : ''}`}
                onClick={() => setEditMode(m)}
              >
                {EDIT_LABEL[m]}
              </button>
            ))}
          </div>
        </SettingRow>
      )}

      <SettingRow label="실험" help="이상치 하나가 회귀선을 얼마나 흔드는지 확인해 보세요.">
        <div style={{ display: 'grid', gap: 5 }}>
          <button type="button" className="btn btn--wide" onClick={() => setBaseline(metrics)}>
            지금 값을 기준으로 저장
          </button>
          <button type="button" className="btn btn--wide" onClick={addOutlier}>
            이상치 하나 넣기
          </button>
          <button
            type="button"
            className="btn btn--wide"
            onClick={() => {
              setSmallPoints(makeSmallSet());
              setSelected(null);
              setEditMode('none');
            }}
          >
            데이터 처음으로
          </button>
        </div>
      </SettingRow>

      <SettingRow label="오차 표시">
        <div className="segmented" role="group" aria-label="오차 표시">
          <button type="button" className={!showErrors ? 'is-on' : ''} onClick={() => setShowErrors(false)}>
            숨김
          </button>
          <button type="button" className={showErrors ? 'is-on' : ''} onClick={() => setShowErrors(true)}>
            표시
          </button>
        </div>
      </SettingRow>

      <div className="metric-cards metric-cards--four">
        {([
          ['MSE', metrics.mse, '오차를 제곱해 평균낸 값'],
          ['MAE', metrics.mae, '오차의 절댓값을 평균낸 값'],
          ['RMSE', metrics.rmse, 'MSE 에 제곱근을 씌운 값'],
          ['R²', metrics.r2, '1 에 가까울수록 잘 설명한다'],
        ] as [string, number, string][]).map(([label, value, desc], i) => {
          const before = baseline
            ? [baseline.mse, baseline.mae, baseline.rmse, baseline.r2][i]
            : undefined;
          const d = delta(value, before);
          return (
            <div className="metric-card" key={label} title={desc}>
              <span className="metric-card__label">{label}</span>
              <span className="metric-card__value">{fmt(value)}</span>
              {d && (
                <span
                  className={`metric-card__delta${
                    (label === 'R²' ? d.startsWith('+') : d.startsWith('-')) ? ' is-good' : ' is-bad'
                  }`}
                >
                  {d}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {baseline && (
        <p className="muted" style={{ fontSize: 12.5 }}>
          저장한 기준값과 비교한 변화량입니다.
        </p>
      )}
    </>
  );

  /* ── 아래 ──────────────────────────────────────────── */
  const below = (
    <>
      <section className="section-card">
        <h2>다중 선형 회귀 — 속성을 더하면 좋아질까</h2>
        <p>
          허리둘레를 예측하는 데 사용할 속성을 골라 보세요. 전체 300개 데이터를 훈련 7 대 테스트
          3 으로 나누어 계산합니다.
        </p>
        <div className="check-group">
          {FEATURES.map((f) => (
            <label key={f.key} className="check-row">
              <input
                type="checkbox"
                checked={multiKeys.includes(f.key)}
                onChange={(e) =>
                  setMultiKeys(
                    e.target.checked
                      ? [...multiKeys, f.key]
                      : multiKeys.filter((k) => k !== f.key),
                  )
                }
              />
              {f.label}
            </label>
          ))}
        </div>

        {multi ? (
          <>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>속성</th>
                    <th className="num">회귀계수</th>
                    <th>뜻</th>
                  </tr>
                </thead>
                <tbody>
                  {multi.keys.map((f, i) => (
                    <tr key={f.key}>
                      <td>{f.label}</td>
                      <td className="num">{multi.model.coefficients[i].toFixed(3)}</td>
                      <td className="muted">
                        {f.label}이(가) 1{f.unit} 늘 때 허리둘레가{' '}
                        {multi.model.coefficients[i].toFixed(2)}cm 달라집니다
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>절편</td>
                    <td className="num">{multi.model.intercept.toFixed(3)}</td>
                    <td className="muted">모든 값이 0 일 때의 예측값</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="metric-cards" style={{ marginTop: 12 }}>
              <div className="metric-card">
                <span className="metric-card__label">훈련 R²</span>
                <span className="metric-card__value">{multi.train.r2.toFixed(3)}</span>
              </div>
              <div className="metric-card metric-card--test">
                <span className="metric-card__label">테스트 R²</span>
                <span className="metric-card__value">{multi.test.r2.toFixed(3)}</span>
              </div>
              <div className="metric-card">
                <span className="metric-card__label">테스트 RMSE</span>
                <span className="metric-card__value">{multi.test.rmse.toFixed(2)}</span>
              </div>
            </div>
            <p className="muted">
              속성을 하나씩 더해 보면서 훈련 R² 와 테스트 R² 가 어떻게 달라지는지 비교해 보세요.
              훈련 R² 는 속성을 더할수록 거의 항상 올라갑니다.
            </p>
          </>
        ) : (
          <p className="muted">속성을 하나 이상 골라 주세요.</p>
        )}
      </section>

      {teacherMode && (
        <TeacherPanel
          note={REGRESSION_TEACHER_NOTES.regression}
          extra={[REGRESSION_COMMON.data, REGRESSION_COMMON.metrics]}
          inquiry={inquiry}
        />
      )}

      <InquiryPanel spec={inquiry} mode={mode} hasRun />
    </>
  );

  return (
    <ExperimentFrame
      title="선형 회귀"
      textbook="Ⅱ-02 · 96~103쪽"
      mode={mode}
      onModeChange={onModeChange}
      dataPane={dataPane}
      stage={stageView}
      settingsPane={settingsPane}
      below={below}
    />
  );
}
