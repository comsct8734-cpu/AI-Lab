import { useEffect, useMemo, useRef, useState } from 'react';
import { ExperimentFrame, type LearnMode } from '../../ui/ExperimentFrame';
import { SettingRow } from '../../ui/controls';
import { InquiryPanel } from '../../ui/InquiryPanel';
import { TeacherPanel } from '../../ui/TeacherPanel';
import { CLASSIFY_TEACHER_NOTES, CLASSIFY_COMMON } from '../../teacher/classifyTeacher';
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
import { knnClassify, type Point } from '../../core/knn';
import { fitTree, treePredict } from '../../core/decisionTree';
import {
  confusionMatrix,
  fitLogistic,
  logisticPredict,
  scoresFrom,
  type ConfusionMatrix,
} from '../../core/logistic';
import { usePersisted } from '../../usePersisted';
import { CLASSIFY_INQUIRY } from './classifyInquiry';

/**
 * 화면 4-2 로지스틱 회귀 / 4-3 모델 비교실
 * 교과서 Ⅱ-02 인쇄 106·114~115쪽
 *
 * 4-2 는 '확률'을 보여 주는 것이 핵심이다. 결정 경계에 가까울수록 확신이
 * 낮아지는 것을 배경색의 진하기로 나타낸다.
 * 4-3 은 같은 데이터에 세 모델을 함께 적용해, 판단이 갈리는 지점과
 * 혼동 행렬을 나란히 보여 준다.
 */

const W = 560;
const H = 420;
const PAD = { top: 18, right: 16, bottom: 44, left: 56 };
const GRID = 70;
const LABELS = ['Adelie', 'Chinstrap', 'Gentoo'];

export type ClassifyScreenId = 'logistic' | 'compare';
type ModelId = 'knn' | 'tree' | 'logistic';

const MODEL_LABEL: Record<ModelId, string> = {
  knn: '최근접 이웃',
  tree: '결정트리',
  logistic: '로지스틱 회귀',
};

interface Props {
  screen: ClassifyScreenId;
  mode: LearnMode;
  onModeChange: (m: LearnMode) => void;
  teacherMode: boolean;
}

function shapePath(shape: string, x: number, y: number, r: number): string {
  if (shape === 'triangle') return `M ${x} ${y - r * 1.15} L ${x + r} ${y + r * 0.75} L ${x - r} ${y + r * 0.75} Z`;
  if (shape === 'square') return `M ${x - r * 0.9} ${y - r * 0.9} h ${r * 1.8} v ${r * 1.8} h ${-r * 1.8} Z`;
  return `M ${x} ${y - r} a ${r} ${r} 0 1 0 0.01 0 Z`;
}

export function ClassifyLabScreen({ screen, mode, onModeChange, teacherMode }: Props) {
  const [pipeline] = usePersisted<Pipeline>('data:pipeline', {
    missing: 'keep',
    removeBadSex: false,
    removeMassOutliers: false,
  });
  const [xKey, setXKey] = usePersisted('cls:x', 'culmen_length_mm');
  const [yKey, setYKey] = usePersisted('cls:y', 'culmen_depth_mm');
  const [k, setK] = usePersisted('cls:k', 5);
  const [depth, setDepth] = usePersisted('cls:depth', 3);
  const [probe, setProbe] = useState<{ x: number; y: number } | null>(null);
  const [cmModelRaw, setCmModel] = useState<ModelId>('logistic');
  // 로지스틱 화면에는 그 모델의 그래프만 있으므로 혼동 행렬도 로지스틱으로 고정한다.
  const cmModel: ModelId = screen === 'logistic' ? 'logistic' : cmModelRaw;
  const [cmCell, setCmCell] = useState<{ a: number; p: number } | null>(null);
  const [showDisagree, setShowDisagree] = usePersisted('cls:disagree', false);

  const { rows } = useMemo(() => runPipeline(pipeline), [pipeline]);
  const clean = useMemo(() => completeRows(rows), [rows]);

  const raw = useMemo(
    () =>
      clean.map((r) => ({
        x: r[xKey] as number,
        y: r[yKey] as number,
        label: r.species as string,
      })),
    [clean, xKey, yKey],
  );

  const scalers = useMemo(
    () => ({
      x: fitScaler(raw.map((p) => p.x)),
      y: fitScaler(raw.map((p) => p.y)),
    }),
    [raw],
  );

  const split = useMemo(() => trainTestSplit(raw, 0.3, 42), [raw]);

  const bounds = useMemo(() => {
    const xs = raw.map((p) => p.x);
    const ys = raw.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const px = (maxX - minX) * 0.06;
    const py = (maxY - minY) * 0.06;
    return { minX: minX - px, maxX: maxX + px, minY: minY - py, maxY: maxY + py };
  }, [raw]);

  /* 세 모델을 모두 학습해 둔다 */
  const models = useMemo(() => {
    const trainPoints: Point[] = split.train.map((p) => ({ x: p.x, y: p.y, label: p.label }));
    const tree = fitTree(split.train, bounds, { maxDepth: depth, minSamples: 2 });
    const logistic = fitLogistic(
      split.train.map((p) => ({
        x: applyScaler(p.x, scalers.x),
        y: applyScaler(p.y, scalers.y),
        label: p.label,
      })),
    );
    return { trainPoints, tree, logistic };
  }, [split.train, bounds, depth, scalers]);

  const predictWith = useMemo(
    () => ({
      knn: (x: number, y: number) =>
        knnClassify(models.trainPoints, { x, y }, k, 'euclidean').predicted ?? '',
      tree: (x: number, y: number) => treePredict(models.tree, x, y),
      logistic: (x: number, y: number) =>
        logisticPredict(models.logistic, applyScaler(x, scalers.x), applyScaler(y, scalers.y))
          .predicted,
    }),
    [models, k, scalers],
  );

  const results = useMemo(() => {
    const actual = split.test.map((p) => p.label);
    const out = {} as Record<ModelId, { cm: ConfusionMatrix; scores: ReturnType<typeof scoresFrom>; pred: string[] }>;
    for (const id of ['knn', 'tree', 'logistic'] as ModelId[]) {
      const pred = split.test.map((p) => predictWith[id](p.x, p.y));
      const cm = confusionMatrix(LABELS, actual, pred);
      out[id] = { cm, scores: scoresFrom(cm), pred };
    }
    return out;
  }, [split.test, predictWith]);

  /** 세 모델의 판단이 갈리는 테스트 데이터 */
  const disagreements = useMemo(
    () =>
      split.test
        .map((p, i) => ({
          point: p,
          knn: results.knn.pred[i],
          tree: results.tree.pred[i],
          logistic: results.logistic.pred[i],
        }))
        .filter((d) => new Set([d.knn, d.tree, d.logistic]).size > 1),
    [split.test, results],
  );

  const probeResult = useMemo(() => {
    if (!probe) return null;
    return logisticPredict(
      models.logistic,
      applyScaler(probe.x, scalers.x),
      applyScaler(probe.y, scalers.y),
    );
  }, [probe, models.logistic, scalers]);

  const inquiry = CLASSIFY_INQUIRY[screen];
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));

  const sx = (v: number) =>
    PAD.left + ((v - bounds.minX) / (bounds.maxX - bounds.minX)) * (W - PAD.left - PAD.right);
  const sy = (v: number) =>
    H - PAD.bottom - ((v - bounds.minY) / (bounds.maxY - bounds.minY)) * (H - PAD.top - PAD.bottom);

  /* ── 왼쪽 ──────────────────────────────────────────── */
  const dataPane = (
    <>
      <p className="pane__title">데이터</p>
      <div className="note" style={{ marginTop: 0 }}>
        <strong>펭귄 데이터</strong>
        <br />
        교육용 예제 데이터
        <br />
        <span className="muted">훈련 {split.train.length}개 · 테스트 {split.test.length}개</span>
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

      {screen === 'logistic' && probeResult && probe && (
        <SettingRow label="이 자리의 확률">
          <ul className="field-list">
            {probeResult.probabilities
              .slice()
              .sort((a, b) => b.p - a.p)
              .map((p) => (
                <li key={p.label}>
                  <span>{speciesName(p.label)}</span>
                  <span style={{ fontFamily: 'ui-monospace, monospace' }}>
                    {(p.p * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
          </ul>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 12.5 }}>
            {probeResult.confidence > 0.9
              ? '모델이 꽤 확신하고 있습니다.'
              : probeResult.confidence > 0.6
                ? '어느 정도 확신하지만 다른 가능성도 남아 있습니다.'
                : '경계에 가까워 판단이 불확실합니다.'}
          </p>
          <button
            type="button"
            className="btn btn--wide btn--small"
            style={{ marginTop: 8 }}
            onClick={() => setProbe(null)}
          >
            점 지우기
          </button>
        </SettingRow>
      )}
    </>
  );

  /* ── 가운데 ────────────────────────────────────────── */
  const stageView = (
    <>
      <PipelineBar pipeline={pipeline} />
      <div className="stage">
        <span className="stage__mode">
          {screen === 'logistic' ? '로지스틱 회귀 · 클래스별 확률' : '모델 비교실 · 같은 데이터, 세 모델'}
        </span>

        {screen === 'logistic' ? (
          <div style={{ position: 'relative', padding: '34px 8px 4px' }}>
            <ProbabilityCanvas
              model={models.logistic}
              scalers={scalers}
              bounds={bounds}
              style={{
                left: `${(PAD.left / W) * 100}%`,
                top: `calc(34px + ${(PAD.top / H) * (H - 38)}px)`,
                width: `${((W - PAD.left - PAD.right) / W) * 100}%`,
                height: `${((H - PAD.top - PAD.bottom) / H) * 100}%`,
              }}
            />
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label="로지스틱 회귀의 분류 경계와 확률"
              style={{ position: 'relative' }}
              onClick={(e) => {
                const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                const px = ((e.clientX - rect.left) / rect.width) * W;
                const py = ((e.clientY - rect.top) / rect.height) * H;
                if (px < PAD.left || px > W - PAD.right || py < PAD.top || py > H - PAD.bottom) return;
                setProbe({
                  x: bounds.minX + ((px - PAD.left) / (W - PAD.left - PAD.right)) * (bounds.maxX - bounds.minX),
                  y:
                    bounds.minY +
                    ((H - PAD.bottom - py) / (H - PAD.top - PAD.bottom)) * (bounds.maxY - bounds.minY),
                });
              }}
            >
              <title>색이 옅은 곳일수록 모델이 확신하지 못하는 자리입니다.</title>
              <Axes bounds={bounds} sx={sx} sy={sy} xLabel={fieldOf(xKey).label} yLabel={fieldOf(yKey).label} fmt={fmt} />
              {split.train.map((p, i) => {
                const st = SPECIES_STYLE[p.label] ?? { color: '#7e8b87', shape: 'circle' as const };
                return <path key={i} d={shapePath(st.shape, sx(p.x), sy(p.y), 3.4)} fill={st.color} fillOpacity={0.85} />;
              })}

              {/* 테스트 데이터는 속이 빈 모양으로 구분한다 */}
              {split.test.map((p, i) => {
                const st = SPECIES_STYLE[p.label] ?? { color: '#7e8b87', shape: 'circle' as const };
                const isWrong = results.logistic.pred[i] !== p.label;
                return (
                  <g key={`te${i}`}>
                    {isWrong && (
                      <circle cx={sx(p.x)} cy={sy(p.y)} r={8} fill="none" stroke="#a0481c" strokeWidth={2.2} />
                    )}
                    <path
                      d={shapePath(st.shape, sx(p.x), sy(p.y), 4.2)}
                      fill="#ffffff"
                      stroke={st.color}
                      strokeWidth={1.8}
                    />
                  </g>
                );
              })}

              {/* 혼동 행렬에서 고른 칸에 해당하는 데이터를 강조한다 */}
              {cmCell &&
                split.test.map((p, i) =>
                  p.label === LABELS[cmCell.a] && results.logistic.pred[i] === LABELS[cmCell.p] ? (
                    <circle
                      key={`hl${i}`}
                      cx={sx(p.x)}
                      cy={sy(p.y)}
                      r={12}
                      fill="none"
                      stroke="#14201d"
                      strokeWidth={2.6}
                    />
                  ) : null,
                )}

              {probe && (
                <g>
                  <circle cx={sx(probe.x)} cy={sy(probe.y)} r={9} fill="#14201d" />
                  <circle cx={sx(probe.x)} cy={sy(probe.y)} r={15} fill="none" stroke="#14201d" strokeWidth={1.5} />
                </g>
              )}
            </svg>
          </div>
        ) : (
          <div className="model-grid">
            {(['knn', 'tree', 'logistic'] as ModelId[]).map((id) => (
              <div key={id} className="model-cell">
                <h4>
                  {MODEL_LABEL[id]}
                  {id === cmModel && <em className="model-cell__tag">표를 보는 모델</em>}
                  <span>{(results[id].scores.accuracy * 100).toFixed(1)}%</span>
                </h4>
                {cmCell && (
                  <p className="model-cell__count">
                    이 모델이 그 칸에 넣은 데이터{' '}
                    <strong>
                      {
                        split.test.filter(
                          (p, i) =>
                            p.label === LABELS[cmCell.a] &&
                            results[id].pred[i] === LABELS[cmCell.p],
                        ).length
                      }
                      개
                    </strong>
                  </p>
                )}
                <RegionCanvas
                  predict={predictWith[id]}
                  bounds={bounds}
                  points={split.train}
                  test={split.test}
                  wrong={split.test.filter((p, i) => results[id].pred[i] !== p.label)}
                  highlight={
                    cmCell
                      ? split.test.filter(
                          (p, i) =>
                            p.label === LABELS[cmCell.a] && results[id].pred[i] === LABELS[cmCell.p],
                        )
                      : []
                  }
                  disagree={showDisagree ? disagreements.map((d) => d.point) : []}
                />
              </div>
            ))}
          </div>
        )}

        <SpeciesLegend />
        <div className="legend legend--extra">
          <span className="legend__item">채운 모양 · 훈련 데이터</span>
          <span className="legend__item">빈 모양 · 테스트 데이터</span>
          <span className="legend__item legend__item--warn">
            주황 테두리 · 그 모델이 잘못 분류한 테스트 데이터
          </span>
          {screen === 'compare' && showDisagree && (
            <span className="legend__item legend__item--dark">
              보라 점선 · 세 모델의 판단이 갈리는 데이터
            </span>
          )}
          {cmCell && (
            <span className="legend__item legend__item--dark">
              검은 테두리 · 혼동 행렬에서 고른 칸의 데이터
            </span>
          )}
        </div>
      </div>

      <div className="stage-summary">
        {screen === 'logistic' ? (
          <>
            <div className="stage-summary__step">
              {probeResult && probe ? (
                <>
                  이 자리는 <strong>{speciesName(probeResult.predicted)}</strong> 일 확률이{' '}
                  <strong>{(probeResult.confidence * 100).toFixed(1)}%</strong> 입니다.
                </>
              ) : (
                '그래프의 아무 곳이나 눌러 보세요. 그 자리가 각 종일 확률을 알려 줍니다.'
              )}
            </div>
            <div className="stage-summary__stat">
              테스트 {split.test.length}개 중 {results.logistic.cm.correct}개를 올바르게
              분류했습니다 · 정확도 {(results.logistic.scores.accuracy * 100).toFixed(1)}% ·
              경계에 가까울수록 배경색이 옅어집니다.
            </div>
          </>
        ) : (
          <>
            <div className="stage-summary__step">
              같은 데이터인데 세 모델의 판단이 갈리는 데이터가{' '}
              <strong>{disagreements.length}개</strong> 있습니다.
            </div>
            <div className="stage-summary__stat">
              결정 영역의 모양을 비교해 보세요. 결정트리는 계단 모양, 로지스틱 회귀는 곧은 직선,
              최근접 이웃은 들쭉날쭉합니다. 오른쪽에서 [판단이 갈리는 데이터 표시]를 켜면 그
              데이터들이 보라색 점선으로 나타납니다.
            </div>
          </>
        )}
      </div>
    </>
  );

  /* ── 오른쪽 ────────────────────────────────────────── */
  const settingsPane = (
    <>
      <p className="pane__title">모델 설정</p>

      {screen === 'compare' && (
        <>
          <SettingRow label="최근접 이웃의 k" value={String(k)} help="가까운 데이터를 몇 개까지 참고할지 정합니다.">
            <input type="range" min={1} max={19} step={2} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="k 값" />
          </SettingRow>
          <SettingRow label="결정트리의 최대 깊이" value={String(depth)} help="질문을 몇 번까지 이어서 할지 정합니다.">
            <input type="range" min={1} max={8} step={1} value={depth} onChange={(e) => setDepth(Number(e.target.value))} aria-label="최대 깊이" />
          </SettingRow>
        </>
      )}

      {screen === 'compare' && (
        <SettingRow
          label="판단이 갈리는 데이터"
          help="세 모델이 서로 다른 답을 낸 테스트 데이터를 보라색 점선으로 표시합니다. 잘못 분류한 데이터(주황 테두리)와는 다른 것입니다."
        >
          <div className="segmented" role="group" aria-label="판단이 갈리는 데이터 표시">
            <button type="button" className={!showDisagree ? 'is-on' : ''} onClick={() => setShowDisagree(false)}>
              숨김
            </button>
            <button type="button" className={showDisagree ? 'is-on' : ''} onClick={() => setShowDisagree(true)}>
              표시 ({disagreements.length}개)
            </button>
          </div>
        </SettingRow>
      )}

      <SettingRow label="정확도 비교">
        <ul className="field-list">
          {(['knn', 'tree', 'logistic'] as ModelId[]).map((id) => (
            <li key={id}>
              <span>{MODEL_LABEL[id]}</span>
              <span style={{ fontFamily: 'ui-monospace, monospace' }}>
                {(results[id].scores.accuracy * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </SettingRow>

      {screen === 'compare' && (
        <SettingRow
          label="혼동 행렬을 볼 모델"
          help="어떤 데이터를 어떤 종으로 판단했는지 표로 보여 줍니다. 표의 칸을 누르면 위 그래프에서 그 데이터가 검은 테두리로 강조됩니다."
        >
          <div style={{ display: 'grid', gap: 5 }}>
            {(['knn', 'tree', 'logistic'] as ModelId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`btn btn--wide${cmModel === id ? ' btn--primary' : ''}`}
                onClick={() => {
                  setCmModel(id);
                  setCmCell(null);
                }}
              >
                {MODEL_LABEL[id]}
              </button>
            ))}
          </div>
        </SettingRow>
      )}

      {screen === 'logistic' && (
        <div className="note">
          로지스틱 회귀는 값의 범위에 영향을 받는 모델이라, 학습 전에 정규화를 합니다 (교과서
          114쪽).
        </div>
      )}
    </>
  );

  /* ── 아래 ──────────────────────────────────────────── */
  const cm = results[cmModel].cm;
  const scores = results[cmModel].scores;

  const below = (
    <>
      <section className="section-card">
        <h2>혼동 행렬 — {MODEL_LABEL[cmModel]}</h2>
        <p>
          가로는 모델의 판단, 세로는 실제 종입니다. 대각선이 맞힌 것이고 나머지가 틀린 것입니다.
          칸을 누르면 위 그래프에서 그 데이터들이 검은 테두리로 강조됩니다.
        </p>
        {screen === 'compare' && (
          <p className="muted">
            표의 숫자는 <strong>{MODEL_LABEL[cmModel]}</strong>의 것입니다. 칸을 누르면 세 그래프에
            모두 검은 테두리가 나타나는데, 이는 <strong>같은 칸에 각 모델이 어떤 데이터를
            넣었는지 비교</strong>하기 위한 것입니다. 모델마다 그 칸에 넣은 데이터가 다르므로
            강조되는 점도 다릅니다. 각 그래프 위에 모델별 개수를 함께 적어 두었습니다.
          </p>
        )}
        <ConfusionTable cm={cm} selected={cmCell} onSelect={setCmCell} />
        {cmCell && (
          <p className="muted">
            실제 <strong>{speciesName(LABELS[cmCell.a])}</strong>인데{' '}
            <strong>{speciesName(LABELS[cmCell.p])}</strong>(으)로 판단한 데이터{' '}
            {cm.matrix[cmCell.a][cmCell.p]}개를 강조했습니다.{' '}
            <button type="button" className="btn btn--small" onClick={() => setCmCell(null)}>
              강조 해제
            </button>
          </p>
        )}

        <h3>종별 정밀도와 재현율</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>종</th>
                <th className="num">실제 개수</th>
                <th className="num">정밀도</th>
                <th className="num">재현율</th>
              </tr>
            </thead>
            <tbody>
              {scores.perClass.map((c) => (
                <tr key={c.label}>
                  <td>{speciesName(c.label)}</td>
                  <td className="num">{c.support}</td>
                  <td className="num">{(c.precision * 100).toFixed(1)}%</td>
                  <td className="num">{(c.recall * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          <strong>정밀도</strong>는 그 종이라고 답한 것 중 실제로 맞은 비율,{' '}
          <strong>재현율</strong>은 실제 그 종인 것 중 찾아낸 비율입니다 (교과서 115쪽).
        </p>
      </section>

      {screen === 'compare' && (
        <section className="section-card">
          <h2>세 모델의 판단이 갈리는 데이터 {disagreements.length}개</h2>
          <p className="muted">
            오른쪽 설정의 <strong>[판단이 갈리는 데이터]</strong>를 켜면 위 그래프 세 곳에 보라색
            점선으로 표시됩니다. 그래프의 <strong style={{ color: 'var(--signal)' }}>주황 테두리</strong>는
            이것과 다른 것으로, <strong>그 모델이 잘못 분류한 테스트 데이터</strong>를 뜻합니다.
          </p>
          {disagreements.length === 0 ? (
            <p className="muted">지금 설정에서는 세 모델의 판단이 모두 같습니다. 설정을 바꿔 보세요.</p>
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>실제 종</th>
                      <th>최근접 이웃</th>
                      <th>결정트리</th>
                      <th>로지스틱 회귀</th>
                      <th className="num">{fieldOf(xKey).label}</th>
                      <th className="num">{fieldOf(yKey).label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {disagreements.map((d, i) => (
                      <tr key={i}>
                        <td>{speciesName(d.point.label)}</td>
                        <td className={d.knn === d.point.label ? '' : 'wrong-cell'}>{speciesName(d.knn)}</td>
                        <td className={d.tree === d.point.label ? '' : 'wrong-cell'}>{speciesName(d.tree)}</td>
                        <td className={d.logistic === d.point.label ? '' : 'wrong-cell'}>{speciesName(d.logistic)}</td>
                        <td className="num">{fmt(d.point.x)}</td>
                        <td className="num">{fmt(d.point.y)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted">
                같은 데이터인데 왜 판단이 갈릴까요? 위 결정 영역에서 이 데이터들이 어디에 있는지
                찾아보세요.
              </p>
            </>
          )}

          <h3>세 모델의 종별 재현율</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>종</th>
                  {(['knn', 'tree', 'logistic'] as ModelId[]).map((id) => (
                    <th key={id} className="num">
                      {MODEL_LABEL[id]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SPECIES_ORDER.map((s, i) => (
                  <tr key={s}>
                    <td>{speciesName(s)}</td>
                    {(['knn', 'tree', 'logistic'] as ModelId[]).map((id) => (
                      <td key={id} className="num">
                        {(results[id].scores.perClass[i].recall * 100).toFixed(1)}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">
            전체 정확도가 가장 높은 모델이 모든 종을 가장 잘 맞히는 것은 아닙니다. 데이터가 가장
            적은 종을 살펴보세요.
          </p>
        </section>
      )}

      {teacherMode && (
        <TeacherPanel
          note={CLASSIFY_TEACHER_NOTES[screen]}
          extra={[CLASSIFY_COMMON.logistic, CLASSIFY_COMMON.data]}
          inquiry={inquiry}
        />
      )}

      <InquiryPanel spec={inquiry} mode={mode} hasRun />
    </>
  );

  return (
    <ExperimentFrame
      title={screen === 'logistic' ? '로지스틱 회귀' : '모델 비교실'}
      textbook={screen === 'logistic' ? 'Ⅱ-02 · 114쪽' : 'Ⅱ-02 · 106, 115쪽'}
      mode={mode}
      onModeChange={onModeChange}
      dataPane={dataPane}
      stage={stageView}
      settingsPane={settingsPane}
      below={below}
    />
  );
}

/* ── 보조 컴포넌트 ─────────────────────────────────────────── */

function Axes({
  bounds,
  sx,
  sy,
  xLabel,
  yLabel,
  fmt,
}: {
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  sx: (v: number) => number;
  sy: (v: number) => number;
  xLabel: string;
  yLabel: string;
  fmt: (v: number) => string;
}) {
  return (
    <>
      <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#c3cecb" />
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#c3cecb" />
      {[0, 0.25, 0.5, 0.75, 1].map((p) => {
        const vx = bounds.minX + (bounds.maxX - bounds.minX) * p;
        const vy = bounds.minY + (bounds.maxY - bounds.minY) * p;
        return (
          <g key={p}>
            <text x={sx(vx)} y={H - PAD.bottom + 17} textAnchor="middle" fontSize={11} fill="#7e8b87">
              {fmt(vx)}
            </text>
            <text x={PAD.left - 7} y={sy(vy) + 4} textAnchor="end" fontSize={11} fill="#7e8b87">
              {fmt(vy)}
            </text>
          </g>
        );
      })}
      <text x={(W + PAD.left) / 2} y={H - 9} textAnchor="middle" fontSize={12} fill="#4c5a56">
        {xLabel}
      </text>
      <text
        x={-(H - PAD.bottom + PAD.top) / 2}
        y={14}
        transform="rotate(-90)"
        textAnchor="middle"
        fontSize={12}
        fill="#4c5a56"
      >
        {yLabel}
      </text>
    </>
  );
}

/** 확률의 진하기로 확신의 정도를 보여 준다 */
function ProbabilityCanvas({
  model,
  scalers,
  bounds,
  style,
}: {
  model: ReturnType<typeof fitLogistic>;
  scalers: { x: { min: number; max: number }; y: { min: number; max: number } };
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  style: React.CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(GRID, GRID);
    for (let row = 0; row < GRID; row++) {
      const y = bounds.maxY - ((bounds.maxY - bounds.minY) * (row + 0.5)) / GRID;
      for (let col = 0; col < GRID; col++) {
        const x = bounds.minX + ((bounds.maxX - bounds.minX) * (col + 0.5)) / GRID;
        const r = logisticPredict(model, applyScaler(x, scalers.x), applyScaler(y, scalers.y));
        const hex = SPECIES_STYLE[r.predicted]?.color ?? '#7e8b87';
        const i = (row * GRID + col) * 4;
        img.data[i] = parseInt(hex.slice(1, 3), 16);
        img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        // 확신이 높을수록 진하게. 경계 근처는 옅어진다.
        img.data[i + 3] = Math.round(12 + (r.confidence - 0.34) * 130);
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [model, scalers, bounds]);
  return <canvas ref={ref} width={GRID} height={GRID} className="knn-canvas" style={style} aria-hidden="true" />;
}

/** 모델 비교실의 작은 결정 영역 그림 */
function RegionCanvas({
  predict,
  bounds,
  points,
  test,
  wrong,
  highlight,
  disagree,
}: {
  predict: (x: number, y: number) => string;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** 훈련 데이터 — 채운 모양 */
  points: { x: number; y: number; label: string }[];
  /** 테스트 데이터 — 빈 모양 */
  test: { x: number; y: number; label: string }[];
  /** 이 모델이 잘못 분류한 테스트 데이터 — 주황 테두리 */
  wrong: { x: number; y: number; label: string }[];
  /** 혼동 행렬에서 고른 칸의 데이터 — 검은 테두리 */
  highlight: { x: number; y: number; label: string }[];
  /** 세 모델의 판단이 갈리는 데이터 — 보라 점선 */
  disagree: { x: number; y: number; label: string }[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const CW = 300;
  const CH = 230;
  const P = 8;

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(GRID, GRID);
    for (let row = 0; row < GRID; row++) {
      const y = bounds.maxY - ((bounds.maxY - bounds.minY) * (row + 0.5)) / GRID;
      for (let col = 0; col < GRID; col++) {
        const x = bounds.minX + ((bounds.maxX - bounds.minX) * (col + 0.5)) / GRID;
        const hex = SPECIES_STYLE[predict(x, y)]?.color ?? '#7e8b87';
        const i = (row * GRID + col) * 4;
        img.data[i] = parseInt(hex.slice(1, 3), 16);
        img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        img.data[i + 3] = 60;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [predict, bounds]);

  const sx = (v: number) => P + ((v - bounds.minX) / (bounds.maxX - bounds.minX)) * (CW - P * 2);
  const sy = (v: number) => CH - P - ((v - bounds.minY) / (bounds.maxY - bounds.minY)) * (CH - P * 2);

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={ref}
        width={GRID}
        height={GRID}
        className="knn-canvas"
        style={{ left: `${(P / CW) * 100}%`, top: `${(P / CH) * 100}%`, width: `${((CW - P * 2) / CW) * 100}%`, height: `${((CH - P * 2) / CH) * 100}%` }}
        aria-hidden="true"
      />
      <svg viewBox={`0 0 ${CW} ${CH}`} style={{ position: 'relative', width: '100%' }} role="img" aria-label="결정 영역">
        {points.map((p, i) => {
          const st = SPECIES_STYLE[p.label] ?? { color: '#7e8b87', shape: 'circle' as const };
          return <path key={i} d={shapePath(st.shape, sx(p.x), sy(p.y), 2.4)} fill={st.color} fillOpacity={0.8} />;
        })}
        {test.map((p, i) => {
          const st = SPECIES_STYLE[p.label] ?? { color: '#7e8b87', shape: 'circle' as const };
          return (
            <path
              key={`t${i}`}
              d={shapePath(st.shape, sx(p.x), sy(p.y), 2.9)}
              fill="#ffffff"
              stroke={st.color}
              strokeWidth={1.4}
            />
          );
        })}
        {disagree.map((p, i) => (
          <circle
            key={`d${i}`}
            cx={sx(p.x)}
            cy={sy(p.y)}
            r={7.5}
            fill="none"
            stroke="#7b4fa8"
            strokeWidth={2}
            strokeDasharray="3 2"
          />
        ))}
        {wrong.map((p, i) => (
          <circle key={`w${i}`} cx={sx(p.x)} cy={sy(p.y)} r={5} fill="none" stroke="#a0481c" strokeWidth={2} />
        ))}
        {highlight.map((p, i) => (
          <circle key={`h${i}`} cx={sx(p.x)} cy={sy(p.y)} r={8} fill="none" stroke="#14201d" strokeWidth={2.5} />
        ))}
      </svg>
    </div>
  );
}

function ConfusionTable({
  cm,
  selected,
  onSelect,
}: {
  cm: ConfusionMatrix;
  selected: { a: number; p: number } | null;
  onSelect: (c: { a: number; p: number } | null) => void;
}) {
  const max = Math.max(...cm.matrix.flat(), 1);
  return (
    <div className="table-wrap">
      <table className="confusion">
        <thead>
          <tr>
            <th>실제 \ 판단</th>
            {cm.labels.map((l) => (
              <th key={l} className="num">
                {speciesName(l)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cm.matrix.map((row, a) => (
            <tr key={a}>
              <th scope="row">{speciesName(cm.labels[a])}</th>
              {row.map((n, p) => {
                const isDiag = a === p;
                const isSel = selected?.a === a && selected?.p === p;
                return (
                  <td
                    key={p}
                    className="num confusion__cell"
                    onClick={() => onSelect(isSel || n === 0 ? null : { a, p })}
                    style={{
                      background: isSel
                        ? '#14201d'
                        : isDiag
                          ? `rgba(11,110,92,${0.12 + (n / max) * 0.5})`
                          : n > 0
                            ? `rgba(160,72,28,${0.12 + (n / max) * 0.6})`
                            : '#ffffff',
                      color: isSel ? '#ffffff' : '#14201d',
                      cursor: n > 0 ? 'pointer' : 'default',
                      fontWeight: 700,
                    }}
                  >
                    {n}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
