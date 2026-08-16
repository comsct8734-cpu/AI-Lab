import { useMemo, useState } from 'react';
import { ExperimentFrame, type LearnMode } from '../../ui/ExperimentFrame';
import { SettingRow } from '../../ui/controls';
import { InquiryPanel, type InquirySpec } from '../../ui/InquiryPanel';
import { TeacherPanel } from '../../ui/TeacherPanel';
import { DATA_TEACHER_NOTES, DATA_LAB_COMMON } from '../../teacher/dataTeacher';
import {
  BoxPlot,
  CorrelationHeatmap,
  DistributionBars,
  ScatterPlot,
  SpeciesBar,
  SpeciesLegend,
} from '../../ui/DataCharts';
import {
  NUMERIC_FIELDS,
  PENGUIN_FIELDS,
  completeRows,
  fieldOf,
  runPipeline,
  speciesName,
  type Pipeline,
} from '../../data/penguinData';
import {
  MISSING_LABEL,
  applyScaler,
  fitScaler,
  summarize,
  type MissingStrategy,
  type Row,
} from '../../core/stats';
import { usePersisted } from '../../usePersisted';
import { DATA_INQUIRY } from './dataInquiry';

/**
 * 데이터 실험실 — 화면 2-1 · 2-2 · 2-3
 * 교과서 Ⅱ-01 인쇄 67~81쪽
 *
 * 세 화면이 같은 데이터와 같은 전처리 상태를 공유한다.
 * 화면 위쪽의 '전처리 이력'이 항상 보이므로, 학생이 지금 어떤 데이터를
 * 보고 있는지 잃지 않는다.
 */

export type DataScreen = 'observe' | 'clean' | 'normalize';

const TITLE: Record<DataScreen, string> = {
  observe: '데이터 관찰',
  clean: '결측치와 이상치',
  normalize: '정규화',
};

const TEXTBOOK: Record<DataScreen, string> = {
  observe: 'Ⅱ-01 · 67~77쪽',
  clean: 'Ⅱ-01 · 74~75, 80~81쪽',
  normalize: 'Ⅱ-01 · 76쪽',
};

interface Props {
  screen: DataScreen;
  mode: LearnMode;
  onModeChange: (m: LearnMode) => void;
  teacherMode: boolean;
}

/** 전처리 이력 막대 — 세 화면과 최근접 이웃 화면이 함께 쓴다 */
export function PipelineBar({ pipeline }: { pipeline: Pipeline }) {
  const { steps, rows } = runPipeline(pipeline);
  return (
    <div className="pipeline-bar">
      {steps.map((s, i) => (
        <span key={s.label} className="pipeline-bar__step">
          {i > 0 && <span className="pipeline-bar__arrow">→</span>}
          {s.label} <strong>{s.count}</strong>
          {s.removed > 0 && <span className="pipeline-bar__removed">−{s.removed}</span>}
        </span>
      ))}
      <span className="pipeline-bar__now">지금 보는 데이터 {rows.length}행</span>
    </div>
  );
}

export function DataLabScreen({ screen, mode, onModeChange, teacherMode }: Props) {
  const [pipeline, setPipeline] = usePersisted<Pipeline>('data:pipeline', {
    missing: 'keep',
    removeBadSex: false,
    removeMassOutliers: false,
  });
  const [xKey, setXKey] = usePersisted('data:x', 'culmen_length_mm');
  const [yKey, setYKey] = usePersisted('data:y', 'culmen_depth_mm');
  const [boxField, setBoxField] = useState('body_mass_g');
  const [selected, setSelected] = useState<Row | null>(null);
  const [normOn, setNormOn] = useState(false);
  const [statField, setStatField] = useState('culmen_length_mm');

  const { rows } = useMemo(() => runPipeline(pipeline), [pipeline]);
  const clean = useMemo(() => completeRows(rows), [rows]);

  /** 정규화 화면에서 쓸 좌표 */
  const scaledRows = useMemo(() => {
    if (!normOn) return clean;
    const scalers = new Map(
      NUMERIC_FIELDS.map((f) => [
        f.key,
        fitScaler(clean.map((r) => r[f.key] as number)),
      ]),
    );
    return clean.map((r) => {
      const next: Row = { ...r };
      for (const f of NUMERIC_FIELDS) {
        const s = scalers.get(f.key)!;
        next[f.key] = Math.round(applyScaler(r[f.key] as number, s) * 1000) / 1000;
      }
      return next;
    });
  }, [clean, normOn]);

  const missingCount = useMemo(
    () =>
      rows.filter((r) => PENGUIN_FIELDS.some((f) => r[f.key] === null || r[f.key] === undefined))
        .length,
    [rows],
  );
  const badSexCount = useMemo(() => rows.filter((r) => r.sex === '.').length, [rows]);

  const inquiry: InquirySpec = DATA_INQUIRY[screen];

  /* ── 왼쪽 · 데이터 ─────────────────────────────────── */
  const dataPane = (
    <>
      <p className="pane__title">데이터</p>
      <div className="note" style={{ marginTop: 0 }}>
        <strong>펭귄 데이터</strong>
        <br />
        교육용 예제 데이터 · 344행 · 속성 7개
        <br />
        <span className="muted">
          교과서와 같은 속성 이름과 통계 특성을 재현해 새로 만든 데이터입니다.
        </span>
      </div>

      <SettingRow
        label="속성"
        help="수치형은 크기를 비교할 수 있는 값, 범주형은 종류를 나타내는 값입니다."
      >
        <ul className="field-list">
          {PENGUIN_FIELDS.map((f) => (
            <li key={f.key}>
              <span>{f.label}</span>
              <span className={`kind kind--${f.kind}`}>
                {f.kind === 'numeric' ? '수치형' : '범주형'}
              </span>
            </li>
          ))}
        </ul>
      </SettingRow>

      {screen !== 'clean' && (
        <SettingRow label="전처리 상태" help="결측치와 이상치 화면에서 바꾼 설정이 여기에도 이어집니다.">
          <p className="muted" style={{ margin: 0 }}>
            결측치 {MISSING_LABEL[pipeline.missing]}
            <br />
            성별 이상치 {pipeline.removeBadSex ? '제거함' : '그대로'}
            <br />
            체질량 이상치 {pipeline.removeMassOutliers ? '제거함' : '그대로'}
          </p>
        </SettingRow>
      )}

      {selected && (
        <SettingRow label="선택한 데이터">
          <ul className="field-list">
            {PENGUIN_FIELDS.map((f) => (
              <li key={f.key}>
                <span>{f.label}</span>
                <span>
                  {selected[f.key] === null ? (
                    <em style={{ color: 'var(--signal)' }}>비어 있음</em>
                  ) : f.key === 'species' ? (
                    speciesName(selected[f.key])
                  ) : (
                    String(selected[f.key])
                  )}
                </span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn--wide btn--small" onClick={() => setSelected(null)}>
            선택 해제
          </button>
        </SettingRow>
      )}
    </>
  );

  /* ── 가운데 · 실험 화면 ────────────────────────────── */
  const stageView = (
    <>
      <PipelineBar pipeline={pipeline} />

      <div className="stage">
        <span className="stage__mode">{TITLE[screen]}</span>
        <div style={{ padding: '38px 8px 6px' }}>
          {screen === 'observe' && (
            <ScatterPlot
              rows={clean}
              xKey={xKey}
              yKey={yKey}
              xLabel={`${fieldOf(xKey).label} (${fieldOf(xKey).unit ?? ''})`}
              yLabel={`${fieldOf(yKey).label} (${fieldOf(yKey).unit ?? ''})`}
              selected={selected}
              onSelect={setSelected}
            />
          )}
          {screen === 'clean' && (
            <BoxPlot
              rows={rows}
              fieldKey={boxField}
              label={fieldOf(boxField).label}
              onSelectOutlier={setSelected}
            />
          )}
          {screen === 'normalize' && (
            <DistributionBars
              rows={normOn ? scaledRows : clean}
              fields={NUMERIC_FIELDS.map((f) => ({ key: f.key, label: f.label }))}
              normalized={normOn}
            />
          )}
        </div>
        <SpeciesLegend />
      </div>

      <div className="stage-summary">
        {screen === 'observe' && (
          <>
            <div className="stage-summary__step">
              {selected ? (
                <>
                  <strong>{speciesName(selected.species)}</strong> ·{' '}
                  {fieldOf(xKey).label} {String(selected[xKey])} · {fieldOf(yKey).label}{' '}
                  {String(selected[yKey])}
                </>
              ) : (
                '점을 눌러 보세요. 그 펭귄의 모든 값을 왼쪽에서 확인할 수 있습니다.'
              )}
            </div>
            <div className="stage-summary__stat">
              그래프에 표시된 데이터 {clean.length}개 · 결측치가 있어 빠진 데이터{' '}
              {rows.length - clean.length}개
            </div>
          </>
        )}
        {screen === 'clean' && (
          <>
            <div className="stage-summary__step">
              지금 데이터에 <strong>결측치가 있는 행 {missingCount}개</strong>, 성별 칸이 잘못
              들어간 행 {badSexCount}개가 남아 있습니다.
            </div>
            <div className="stage-summary__stat">
              상자 밖의 점이 이상치입니다. 점을 누르면 그 펭귄의 값을 볼 수 있습니다.
            </div>
          </>
        )}
        {screen === 'normalize' && (
          <>
            <div className="stage-summary__step">
              정규화 <strong>{normOn ? '켬' : '끔'}</strong> ·{' '}
              {normOn
                ? '모든 속성이 0 과 1 사이로 바뀌었습니다.'
                : '체질량은 수천 단위, 부리 깊이는 십 단위입니다.'}
            </div>
            <div className="stage-summary__stat">
              이 설정은 최근접 이웃 실험실에도 그대로 이어집니다.
            </div>
          </>
        )}
      </div>
    </>
  );

  /* ── 오른쪽 · 설정 ─────────────────────────────────── */
  const settingsPane = (
    <>
      <p className="pane__title">설정</p>

      {screen === 'observe' && (
        <>
          <SettingRow label="가로축" help="산점도의 가로축에 사용할 속성입니다.">
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
          <SettingRow
            label="통계 요약"
            help="개수·평균·표준편차·최솟값·사분위수·최댓값입니다. 교과서 73쪽의 describe() 와 같습니다."
          >
            <select value={statField} onChange={(e) => setStatField(e.target.value)}>
              {NUMERIC_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <StatTable rows={clean} fieldKey={statField} />
          </SettingRow>
        </>
      )}

      {screen === 'clean' && (
        <>
          <SettingRow
            label="결측치 처리"
            help="값이 비어 있는 칸을 어떻게 할지 정합니다. 방법에 따라 데이터 개수와 분포가 달라집니다."
          >
            <div style={{ display: 'grid', gap: 5 }}>
              {(['keep', 'drop', 'mean', 'median'] as MissingStrategy[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`btn btn--wide${pipeline.missing === m ? ' btn--primary' : ''}`}
                  onClick={() => setPipeline({ ...pipeline, missing: m })}
                >
                  {MISSING_LABEL[m]}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow label="이상치 처리" help="정상 범위를 벗어난 값을 어떻게 할지 정합니다.">
            <label className="check-row">
              <input
                type="checkbox"
                checked={pipeline.removeBadSex}
                onChange={(e) => setPipeline({ ...pipeline, removeBadSex: e.target.checked })}
              />
              성별이 <code>.</code> 인 행 제거
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={pipeline.removeMassOutliers}
                onChange={(e) =>
                  setPipeline({ ...pipeline, removeMassOutliers: e.target.checked })
                }
              />
              체질량 이상치 제거
            </label>
          </SettingRow>

          <SettingRow label="상자그림 속성">
            <select value={boxField} onChange={(e) => setBoxField(e.target.value)}>
              {NUMERIC_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </SettingRow>

          <button
            type="button"
            className="btn btn--wide"
            onClick={() =>
              setPipeline({ missing: 'keep', removeBadSex: false, removeMassOutliers: false })
            }
          >
            처음으로
          </button>
        </>
      )}

      {screen === 'normalize' && (
        <>
          <SettingRow
            label="최소-최대 정규화"
            help="(값 − 최솟값) ÷ (최댓값 − 최솟값) 으로 모든 값을 0 과 1 사이로 바꿉니다."
          >
            <div className="segmented" role="group" aria-label="정규화">
              <button type="button" className={!normOn ? 'is-on' : ''} onClick={() => setNormOn(false)}>
                끔
              </button>
              <button type="button" className={normOn ? 'is-on' : ''} onClick={() => setNormOn(true)}>
                켬
              </button>
            </div>
          </SettingRow>
          <div className="note">
            정규화가 결과를 어떻게 바꾸는지는 <strong>최근접 이웃 실험실</strong>에서 직접
            확인할 수 있습니다. 그 화면에서 정규화를 켜고 끄면 결정 영역이 바뀝니다.
          </div>
        </>
      )}
    </>
  );

  /* ── 아래 ──────────────────────────────────────────── */
  const below = (
    <>
      {screen === 'observe' && (
        <>
          <section className="section-card">
            <h2>종별 데이터 개수</h2>
            <SpeciesBar rows={rows} />
            <p className="muted">
              종마다 데이터의 수가 다릅니다. 가장 적은 종은 가장 많은 종의 절반도 되지 않습니다.
            </p>
          </section>
          <section className="section-card">
            <h2>속성 사이의 상관관계</h2>
            <CorrelationHeatmap
              rows={clean}
              fields={NUMERIC_FIELDS.map((f) => ({ key: f.key, label: f.label }))}
              onPick={(x, y) => {
                setXKey(x);
                setYKey(y);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
            <p className="muted">
              칸을 누르면 위 산점도가 그 조합으로 바뀝니다. 1 에 가까울수록 함께 커지고, −1 에
              가까울수록 하나가 커질 때 다른 하나가 작아집니다.
            </p>
          </section>
        </>
      )}

      {screen === 'normalize' && (
        <section className="section-card">
          <h2>정규화 전과 후</h2>
          <div className="two-up">
            <div>
              <h3>정규화 전</h3>
              <ScatterPlot
                rows={clean}
                xKey="body_mass_g"
                yKey="culmen_depth_mm"
                xLabel="체질량 (g)"
                yLabel="부리 깊이 (mm)"
                selected={null}
                onSelect={() => {}}
              />
            </div>
            <div>
              <h3>정규화 후</h3>
              <ScatterPlot
                rows={useScaled(clean)}
                xKey="body_mass_g"
                yKey="culmen_depth_mm"
                xLabel="체질량 (0~1)"
                yLabel="부리 깊이 (0~1)"
                selected={null}
                onSelect={() => {}}
                normalized
              />
            </div>
          </div>
          <p className="muted">
            점들이 놓인 모양은 같습니다. 달라진 것은 축의 눈금뿐입니다. 그런데도 거리로 판단하는
            모델에서는 결과가 달라집니다.
          </p>
        </section>
      )}

      {teacherMode && (
        <TeacherPanel
          note={DATA_TEACHER_NOTES[screen]}
          extra={[DATA_LAB_COMMON.data, DATA_LAB_COMMON.outlier]}
          inquiry={inquiry}
        />
      )}

      <InquiryPanel spec={inquiry} mode={mode} hasRun />
    </>
  );

  return (
    <ExperimentFrame
      title={TITLE[screen]}
      textbook={TEXTBOOK[screen]}
      mode={mode}
      onModeChange={onModeChange}
      dataPane={dataPane}
      stage={stageView}
      settingsPane={settingsPane}
      below={below}
    />
  );
}

/** 정규화된 사본을 만든다 */
function useScaled(rows: Row[]): Row[] {
  return useMemo(() => {
    const scalers = new Map(
      NUMERIC_FIELDS.map((f) => [f.key, fitScaler(rows.map((r) => r[f.key] as number))]),
    );
    return rows.map((r) => {
      const next: Row = { ...r };
      for (const f of NUMERIC_FIELDS) {
        next[f.key] = Math.round(applyScaler(r[f.key] as number, scalers.get(f.key)!) * 1000) / 1000;
      }
      return next;
    });
  }, [rows]);
}

function StatTable({ rows, fieldKey }: { rows: Row[]; fieldKey: string }) {
  const vs = rows.map((r) => r[fieldKey]).filter((v): v is number => typeof v === 'number');
  if (vs.length === 0) return null;
  const s = summarize(vs);
  const fmt = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(2));
  const items: [string, string][] = [
    ['개수', String(s.count)],
    ['평균', fmt(s.mean)],
    ['표준편차', fmt(s.std)],
    ['최솟값', fmt(s.min)],
    ['25%', fmt(s.q1)],
    ['50%', fmt(s.median)],
    ['75%', fmt(s.q3)],
    ['최댓값', fmt(s.max)],
  ];
  return (
    <ul className="field-list" style={{ marginTop: 8 }}>
      {items.map(([k, v]) => (
        <li key={k}>
          <span>{k}</span>
          <span style={{ fontFamily: 'ui-monospace, monospace' }}>{v}</span>
        </li>
      ))}
    </ul>
  );
}
