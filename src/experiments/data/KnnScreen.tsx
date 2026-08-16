import { useEffect, useMemo, useRef, useState } from 'react';
import { ExperimentFrame, type LearnMode } from '../../ui/ExperimentFrame';
import { SettingRow } from '../../ui/controls';
import { InquiryPanel } from '../../ui/InquiryPanel';
import { TeacherPanel } from '../../ui/TeacherPanel';
import { DATA_TEACHER_NOTES, DATA_LAB_COMMON } from '../../teacher/dataTeacher';
import { SpeciesLegend } from '../../ui/DataCharts';
import { PipelineBar } from '../data/DataLabScreen';
import {
  NUMERIC_FIELDS,
  SPECIES_ORDER,
  SPECIES_STYLE,
  completeRows,
  fieldOf,
  runPipeline,
  speciesName,
  type Pipeline,
} from '../../data/penguinData';
import { applyScaler, fitScaler, trainTestSplit } from '../../core/stats';
import {
  DISTANCE_HELP,
  DISTANCE_LABEL,
  decisionGrid,
  evaluate,
  knnClassify,
  type Distance,
  type Point,
} from '../../core/knn';
import { usePersisted } from '../../usePersisted';
import { DATA_INQUIRY } from '../data/dataInquiry';

/**
 * 최근접 이웃 실험실 — 화면 2-4
 * 교과서 Ⅱ-02 인쇄 108~109·114쪽
 *
 * 이 화면의 핵심은 정확도가 아니라 '무엇을 근거로 판단했는가'이다.
 * 새 점을 누르면 참고한 이웃 k개를 선으로 잇고, 거리와 클래스를 표로 보여 준다.
 */

const W = 620;
const H = 480;
const PAD = { top: 20, right: 18, bottom: 50, left: 62 };
const GRID = 70;

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

export function KnnScreen({ mode, onModeChange, teacherMode }: Props) {
  const [pipeline] = usePersisted<Pipeline>('data:pipeline', {
    missing: 'keep',
    removeBadSex: false,
    removeMassOutliers: false,
  });
  const [xKey, setXKey] = usePersisted('knn:x', 'culmen_length_mm');
  const [yKey, setYKey] = usePersisted('knn:y', 'body_mass_g');
  const [k, setK] = usePersisted('knn:k', 3);
  const [distance, setDistance] = usePersisted<Distance>('knn:distance', 'euclidean');
  const [normalize, setNormalize] = usePersisted('knn:normalize', false);
  const [showRegion, setShowRegion] = usePersisted('knn:region', true);
  const [probe, setProbe] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { rows } = useMemo(() => runPipeline(pipeline), [pipeline]);
  const clean = useMemo(() => completeRows(rows), [rows]);

  /** 화면에 쓸 좌표. 정규화를 켜면 0~1 로 바꾼다. */
  const points = useMemo<Point[]>(() => {
    const xs = clean.map((r) => r[xKey] as number);
    const ys = clean.map((r) => r[yKey] as number);
    const sx = fitScaler(xs);
    const sy = fitScaler(ys);
    return clean.map((r, i) => ({
      x: normalize ? applyScaler(r[xKey] as number, sx) : (r[xKey] as number),
      y: normalize ? applyScaler(r[yKey] as number, sy) : (r[yKey] as number),
      label: r.species as string,
      index: i,
    }));
  }, [clean, xKey, yKey, normalize]);

  const split = useMemo(() => trainTestSplit(points, 0.3, 42), [points]);
  const evaluation = useMemo(
    () => evaluate(split.train, split.test, k, distance),
    [split, k, distance],
  );

  const bounds = useMemo(() => {
    if (points.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
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
  const invX = (px: number) =>
    bounds.minX + ((px - PAD.left) / (W - PAD.left - PAD.right)) * (bounds.maxX - bounds.minX);
  const invY = (py: number) =>
    bounds.minY +
    ((H - PAD.bottom - py) / (H - PAD.top - PAD.bottom)) * (bounds.maxY - bounds.minY);

  /* 결정 영역은 격자 계산이 무거우므로 캔버스에 한 번에 그린다 */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showRegion) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const cells = decisionGrid(split.train, k, distance, bounds, GRID);
    const img = ctx.createImageData(GRID, GRID);
    for (let i = 0; i < cells.length; i++) {
      const label = cells[i];
      const hex = label ? SPECIES_STYLE[label]?.color ?? '#7e8b87' : '#eef1f0';
      const rr = parseInt(hex.slice(1, 3), 16);
      const gg = parseInt(hex.slice(3, 5), 16);
      const bb = parseInt(hex.slice(5, 7), 16);
      img.data[i * 4] = rr;
      img.data[i * 4 + 1] = gg;
      img.data[i * 4 + 2] = bb;
      img.data[i * 4 + 3] = 56;
    }
    ctx.putImageData(img, 0, 0);
  }, [split.train, k, distance, bounds, showRegion]);

  const probeResult = useMemo(
    () => (probe ? knnClassify(split.train, probe, k, distance) : null),
    [probe, split.train, k, distance],
  );

  const wrongSet = useMemo(() => new Set(evaluation.wrong.map((w) => w.point)), [evaluation]);
  const inquiry = DATA_INQUIRY.knn;

  const fmt = (v: number) => (normalize ? v.toFixed(3) : Math.round(v * 10) / 10);

  /* ── 왼쪽 ──────────────────────────────────────────── */
  const dataPane = (
    <>
      <p className="pane__title">데이터</p>
      <div className="note" style={{ marginTop: 0 }}>
        <strong>펭귄 데이터</strong>
        <br />
        교육용 예제 데이터
        <br />
        <span className="muted">데이터 실험실에서 한 전처리가 그대로 이어집니다.</span>
      </div>

      <SettingRow label="특징 (가로축)" help="판단의 근거로 사용할 속성입니다.">
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
      <SettingRow label="타깃" help="모델이 맞혀야 하는 값입니다.">
        <div className="note" style={{ marginTop: 0 }}>
          종 (아델리 · 턱끈 · 젠투)
        </div>
      </SettingRow>
      <SettingRow label="훈련 · 테스트" help="학습에 쓰는 데이터와, 새로운 데이터를 얼마나 잘 맞히는지 확인하려고 남겨 둔 데이터입니다.">
        <p className="muted" style={{ margin: 0 }}>
          훈련 {split.train.length}개 · 테스트 {split.test.length}개 (7 대 3)
        </p>
      </SettingRow>
    </>
  );

  /* ── 가운데 ────────────────────────────────────────── */
  const stageView = (
    <>
      <PipelineBar pipeline={pipeline} />

      <div className="stage">
        <span className="stage__mode">
          최근접 이웃 · k = {k} · {normalize ? '정규화 켬' : '정규화 끔'}
        </span>
        <div style={{ position: 'relative', padding: '36px 8px 4px' }}>
          {showRegion && (
            <canvas
              ref={canvasRef}
              width={GRID}
              height={GRID}
              className="knn-canvas"
              style={{
                left: `${(PAD.left / W) * 100}%`,
                top: `calc(36px + ${(PAD.top / H) * (H - 40)}px)`,
                width: `${((W - PAD.left - PAD.right) / W) * 100}%`,
                height: `${((H - PAD.top - PAD.bottom) / H) * 100}%`,
              }}
              aria-hidden="true"
            />
          )}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="최근접 이웃 실험 화면"
            style={{ position: 'relative' }}
            onClick={(e) => {
              const rect = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect() ??
                (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const px = ((e.clientX - rect.left) / rect.width) * W;
              const py = ((e.clientY - rect.top) / rect.height) * H;
              if (px < PAD.left || px > W - PAD.right || py < PAD.top || py > H - PAD.bottom) return;
              setProbe({ x: invX(px), y: invY(py) });
            }}
          >
            <title>새로운 점을 누르면 참고한 이웃을 선으로 보여 줍니다.</title>

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
              {normalize ? ' (0~1)' : ` (${fieldOf(xKey).unit ?? ''})`}
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
              {normalize ? ' (0~1)' : ` (${fieldOf(yKey).unit ?? ''})`}
            </text>

            {/* 훈련 데이터 */}
            {split.train.map((p, i) => {
              const st = SPECIES_STYLE[p.label ?? ''] ?? { color: '#7e8b87', shape: 'circle' as const };
              return (
                <path key={`tr${i}`} d={shapePath(st.shape, sx(p.x), sy(p.y), 3.6)} fill={st.color} fillOpacity={0.75} />
              );
            })}

            {/* 테스트 데이터 — 속이 빈 모양으로 구분 */}
            {split.test.map((p, i) => {
              const st = SPECIES_STYLE[p.label ?? ''] ?? { color: '#7e8b87', shape: 'circle' as const };
              const isWrong = wrongSet.has(p);
              return (
                <g key={`te${i}`}>
                  {isWrong && <circle cx={sx(p.x)} cy={sy(p.y)} r={8} fill="none" stroke="#a0481c" strokeWidth={2.2} />}
                  <path
                    d={shapePath(st.shape, sx(p.x), sy(p.y), 4.4)}
                    fill="#ffffff"
                    stroke={st.color}
                    strokeWidth={2}
                  />
                </g>
              );
            })}

            {/* 이웃 연결선 — 이 화면의 핵심 */}
            {probe &&
              probeResult?.neighbors.map((n, i) => (
                <line
                  key={i}
                  x1={sx(probe.x)}
                  y1={sy(probe.y)}
                  x2={sx(n.point.x)}
                  y2={sy(n.point.y)}
                  stroke="#14201d"
                  strokeWidth={1.6}
                  strokeDasharray="4 3"
                />
              ))}
            {probe &&
              probeResult?.neighbors.map((n, i) => (
                <circle key={`nb${i}`} cx={sx(n.point.x)} cy={sy(n.point.y)} r={9} fill="none" stroke="#14201d" strokeWidth={2} />
              ))}

            {probe && (
              <g>
                <circle cx={sx(probe.x)} cy={sy(probe.y)} r={9} fill="#14201d" />
                <circle cx={sx(probe.x)} cy={sy(probe.y)} r={15} fill="none" stroke="#14201d" strokeWidth={1.5} />
              </g>
            )}
          </svg>
        </div>
        <SpeciesLegend />
        <div className="legend legend--extra">
          <span className="legend__item">채운 모양 · 훈련 데이터</span>
          <span className="legend__item">빈 모양 · 테스트 데이터</span>
          <span className="legend__item legend__item--warn">주황 테두리 · 잘못 분류</span>
        </div>
      </div>

      <div className="stage-summary">
        <div className="stage-summary__step">
          {probe && probeResult ? (
            <>
              가까운 이웃 <strong>{k}개</strong>를 참고해{' '}
              <strong>{speciesName(probeResult.predicted)}</strong>(으)로 판단했습니다.
              {probeResult.tie && ' 표가 같아 가장 가까운 이웃을 따랐습니다.'}
            </>
          ) : (
            '그래프의 빈 곳을 눌러 새로운 펭귄을 놓아 보세요. 무엇을 근거로 판단하는지 보여 줍니다.'
          )}
        </div>
        <div className="stage-summary__stat">
          테스트 데이터 {evaluation.total}개 중 <strong>{evaluation.correct}개</strong>를 올바르게
          분류했습니다 · 정확도 {(evaluation.accuracy * 100).toFixed(1)}% · 잘못 분류{' '}
          {evaluation.wrong.length}개
        </div>
      </div>

      {probe && probeResult && probeResult.neighbors.length > 0 && (
        <div className="lists">
          <div className="neighbor-table">
            <table>
              <thead>
                <tr>
                  <th>순서</th>
                  <th>이웃의 종</th>
                  <th className="num">거리</th>
                  <th className="num">
                    {fieldOf(xKey).label}
                  </th>
                  <th className="num">{fieldOf(yKey).label}</th>
                </tr>
              </thead>
              <tbody>
                {probeResult.neighbors.map((n, i) => (
                  <tr key={i}>
                    <td className="num">{i + 1}</td>
                    <td>{speciesName(n.label)}</td>
                    <td className="num">{n.distance.toFixed(normalize ? 3 : 1)}</td>
                    <td className="num">{fmt(n.point.x)}</td>
                    <td className="num">{fmt(n.point.y)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="votes">
            {probeResult.votes.map((v) => (
              <span key={v.label} className="vote-chip">
                {speciesName(v.label)} <strong>{v.count}표</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );

  /* ── 오른쪽 ────────────────────────────────────────── */
  const settingsPane = (
    <>
      <p className="pane__title">모델 설정</p>

      <SettingRow
        label="k 값"
        value={String(k)}
        help="새로운 데이터를 판단할 때 가까운 데이터를 몇 개까지 참고할지 정합니다."
      >
        <input
          type="range"
          min={1}
          max={19}
          step={2}
          value={k}
          onChange={(e) => setK(Number(e.target.value))}
          aria-label="k 값"
        />
        <div className="muted" style={{ fontSize: 12.5 }}>
          1 · 3 · 5 · 7 … 19 (홀수)
        </div>
      </SettingRow>

      <SettingRow label="거리 계산 방법" help={DISTANCE_HELP[distance]}>
        <div className="segmented" role="group" aria-label="거리 계산 방법">
          {(['euclidean', 'manhattan'] as Distance[]).map((d) => (
            <button key={d} type="button" className={distance === d ? 'is-on' : ''} onClick={() => setDistance(d)}>
              {DISTANCE_LABEL[d].replace(' 거리', '')}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow
        label="정규화"
        help="속성값의 범위를 0 과 1 사이로 맞춥니다. 거리로 판단하는 모델에서는 결과가 달라질 수 있습니다."
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

      <SettingRow label="결정 영역" help="화면의 각 위치가 어떤 종으로 분류되는지 배경색으로 보여 줍니다.">
        <div className="segmented" role="group" aria-label="결정 영역">
          <button type="button" className={!showRegion ? 'is-on' : ''} onClick={() => setShowRegion(false)}>
            숨김
          </button>
          <button type="button" className={showRegion ? 'is-on' : ''} onClick={() => setShowRegion(true)}>
            표시
          </button>
        </div>
      </SettingRow>

      <div className="btn-row" style={{ marginTop: 10 }}>
        <button type="button" className="btn" onClick={() => setProbe(null)}>
          점 지우기
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setK(3);
            setDistance('euclidean');
            setNormalize(false);
            setProbe(null);
          }}
        >
          처음으로
        </button>
      </div>
    </>
  );

  /* ── 아래 ──────────────────────────────────────────── */
  const below = (
    <>
      <section className="section-card">
        <h2>결과 자세히 보기</h2>
        <p>
          테스트 데이터 <strong>{evaluation.total}개</strong> 중{' '}
          <strong>{evaluation.correct}개</strong>를 올바르게 분류했습니다.
          정확도는 {(evaluation.accuracy * 100).toFixed(1)}% 입니다.
        </p>
        {evaluation.wrong.length > 0 && (
          <>
            <h3>잘못 분류한 데이터 {evaluation.wrong.length}개</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>실제 종</th>
                    <th>모델의 판단</th>
                    <th className="num">{fieldOf(xKey).label}</th>
                    <th className="num">{fieldOf(yKey).label}</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluation.wrong.map((w, i) => (
                    <tr key={i}>
                      <td>{speciesName(w.actual)}</td>
                      <td>{speciesName(w.predicted)}</td>
                      <td className="num">{fmt(w.point.x)}</td>
                      <td className="num">{fmt(w.point.y)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              그래프에서 주황색 테두리가 그려진 점들입니다. 대부분 서로 다른 종이 겹치는 자리에
              있습니다.
            </p>
          </>
        )}
      </section>

      <section className="section-card">
        <h2>종별로 얼마나 맞혔을까</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>종</th>
                <th className="num">테스트 개수</th>
                <th className="num">맞힌 수</th>
                <th className="num">정확도</th>
              </tr>
            </thead>
            <tbody>
              {SPECIES_ORDER.map((s) => {
                const total = split.test.filter((p) => p.label === s).length;
                const wrong = evaluation.wrong.filter((w) => w.actual === s).length;
                const correct = total - wrong;
                return (
                  <tr key={s}>
                    <td>{speciesName(s)}</td>
                    <td className="num">{total}</td>
                    <td className="num">{correct}</td>
                    <td className="num">
                      {total === 0 ? '—' : `${((correct / total) * 100).toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted">
          전체 정확도가 높아도 특정 종은 잘 못 맞힐 수 있습니다. 데이터 수가 가장 적은 종을
          살펴보세요.
        </p>
      </section>

      {teacherMode && (
        <TeacherPanel
          note={DATA_TEACHER_NOTES.knn}
          extra={[DATA_LAB_COMMON.data, DATA_LAB_COMMON.split, DATA_LAB_COMMON.tie]}
          inquiry={inquiry}
        />
      )}

      <InquiryPanel spec={inquiry} mode={mode} hasRun={probe !== null} />
    </>
  );

  return (
    <ExperimentFrame
      title="최근접 이웃"
      textbook="Ⅱ-02 · 108~109, 114쪽"
      mode={mode}
      onModeChange={onModeChange}
      dataPane={dataPane}
      stage={stageView}
      settingsPane={settingsPane}
      below={below}
    />
  );
}
