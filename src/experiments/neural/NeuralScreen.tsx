import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExperimentFrame, type LearnMode } from '../../ui/ExperimentFrame';
import { SettingRow } from '../../ui/controls';
import { InquiryPanel } from '../../ui/InquiryPanel';
import { TeacherPanel } from '../../ui/TeacherPanel';
import { NEURAL_TEACHER_NOTES, NEURAL_COMMON } from '../../teacher/neuralTeacher';
import {
  ACTIVATION_HELP,
  ACTIVATION_LABEL,
  MAX_LEARNING_RATE,
  accuracy,
  createNetwork,
  forward,
  predict,
  predictLabel,
  trainNetwork,
  type Activation,
  type Network,
  type Sample,
} from '../../core/neuralNet';
import shapesRaw from '../../data/shapes.json' with { type: 'json' };
import foodRaw from '../../data/food.json' with { type: 'json' };
import { usePersisted } from '../../usePersisted';
import { NEURAL_INQUIRY } from './neuralInquiry';

/**
 * 화면 6-1 신경망 실험실
 * 교과서 Ⅱ-03 인쇄 127~140쪽 (활동 7 · 129쪽)
 *
 * 학습을 한 번에 끝내면 브라우저가 몇 초간 멈춘다.
 * 그래서 한 에포크씩 나누어 requestAnimationFrame 으로 넘기고,
 * 학습 중에도 [멈추기] 버튼이 항상 눌리도록 했다.
 */

const W = 600;
const H = 440;
const PAD = { top: 18, right: 16, bottom: 44, left: 52 };
const GRID = 60;

const CLASS_COLORS = ['#1f6fb2', '#c25a1f', '#2e7d4f'];
const CLASS_SHAPES = ['circle', 'triangle', 'square'] as const;

type DataId = 'linear' | 'circle' | 'xor' | 'spiral' | 'food';

const DATA_LABEL: Record<DataId, string> = {
  linear: '직선으로 나뉨',
  circle: '가운데 원',
  xor: '네 칸',
  spiral: '두 갈래 나선',
  food: '식품 (당도·아삭함)',
};

const DATA_HELP: Record<DataId, string> = {
  linear: '직선 하나로 나눌 수 있는 데이터입니다.',
  circle: '가운데 원과 바깥 고리. 직선 하나로는 나눌 수 없습니다.',
  xor: '대각선으로 갈린 네 칸. 직선 하나로는 절대 나눌 수 없습니다.',
  spiral: '두 갈래로 감긴 나선. 가장 어렵습니다.',
  food: '교과서 134쪽의 식품 분류입니다. 세 가지로 나눕니다.',
};

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

type Shapes = Record<string, { x: number; y: number; label: number }[]>;
const SHAPES = shapesRaw as Shapes;
const FOODS = foodRaw as { sweet: number; crunchy: number; label: number }[];

const FOOD_CLASS = ['과일', '단백질', '채소'];

export function NeuralScreen({ mode, onModeChange, teacherMode }: Props) {
  const [dataId, setDataId] = usePersisted<DataId>('nn:data', 'circle');
  const [hidden, setHidden] = usePersisted<number[]>('nn:hidden', [6, 6]);
  const [activation, setActivation] = usePersisted<Activation>('nn:act', 'relu');
  const [learningRate, setLearningRate] = usePersisted('nn:lr', 0.3);
  const [seed, setSeed] = usePersisted('nn:seed', 11);
  const [training, setTraining] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [history, setHistory] = useState<
    { epoch: number; trainAcc: number; testAcc: number; loss: number }[]
  >([]);
  const [, forceRender] = useState(0);
  const netRef = useRef<Network | null>(null);
  const iterRef = useRef<ReturnType<typeof trainNetwork> | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ── 데이터 ─────────────────────────────────────────── */
  const { points, classCount, classNames, xLabel, yLabel } = useMemo(() => {
    if (dataId === 'food') {
      return {
        points: FOODS.map((f) => ({ x: f.sweet / 10, y: f.crunchy / 10, label: f.label })),
        classCount: 3,
        classNames: FOOD_CLASS,
        xLabel: '당도',
        yLabel: '아삭함',
      };
    }
    return {
      points: SHAPES[dataId],
      classCount: 2,
      classNames: ['A 무리', 'B 무리'],
      xLabel: '특징 1',
      yLabel: '특징 2',
    };
  }, [dataId]);

  const { train, test } = useMemo(() => {
    const tr: Sample[] = [];
    const te: Sample[] = [];
    points.forEach((p, i) => {
      const s: Sample = { input: [p.x, p.y], target: p.label };
      (i % 10 < 7 ? tr : te).push(s);
    });
    return { train: tr, test: te };
  }, [points]);

  const shape = useMemo(
    () => [2, ...hidden.filter((n) => n > 0), classCount],
    [hidden, classCount],
  );

  /** 구조나 데이터가 바뀌면 신경망을 새로 만든다 */
  const rebuild = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setTraining(false);
    netRef.current = createNetwork(shape, activation, seed);
    iterRef.current = null;
    setEpoch(0);
    setHistory([]);
    forceRender((v) => v + 1);
  }, [shape, activation, seed]);

  useEffect(() => {
    rebuild();
  }, [rebuild]);

  /* ── 학습 ───────────────────────────────────────────── */
  const stepOnce = useCallback(() => {
    const net = netRef.current;
    if (!net) return false;
    if (!iterRef.current) {
      iterRef.current = trainNetwork(net, train, test, {
        epochs: 100000,
        learningRate,
        batchSize: 16,
        seed: 7,
      });
    }
    const next = iterRef.current.next();
    if (next.done) return false;
    const s = next.value;
    setEpoch(s.epoch);
    setHistory((h) =>
      [...h, { epoch: s.epoch, trainAcc: s.trainAccuracy, testAcc: s.testAccuracy, loss: s.trainLoss }].slice(
        -400,
      ),
    );
    return true;
  }, [train, test, learningRate]);

  useEffect(() => {
    if (!training) return;
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      // 한 번에 3 에포크씩만 돌린다. 더 많이 돌리면 화면이 멈춘 것처럼 보인다.
      for (let i = 0; i < 3; i++) stepOnce();
      forceRender((v) => v + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [training, stepOnce]);

  /* ── 결정 영역 ──────────────────────────────────────── */
  useEffect(() => {
    const net = netRef.current;
    const ctx = canvasRef.current?.getContext('2d');
    if (!net || !ctx) return;
    const img = ctx.createImageData(GRID, GRID);
    for (let row = 0; row < GRID; row++) {
      const y = 1 - (row + 0.5) / GRID;
      for (let col = 0; col < GRID; col++) {
        const x = (col + 0.5) / GRID;
        const probs = predict(net, [x, y]);
        let best = 0;
        for (let i = 1; i < probs.length; i++) if (probs[i] > probs[best]) best = i;
        const hex = CLASS_COLORS[best % CLASS_COLORS.length];
        const i = (row * GRID + col) * 4;
        img.data[i] = parseInt(hex.slice(1, 3), 16);
        img.data[i + 1] = parseInt(hex.slice(3, 5), 16);
        img.data[i + 2] = parseInt(hex.slice(5, 7), 16);
        // 확신이 높을수록 진하게
        img.data[i + 3] = Math.round(14 + (probs[best] - 1 / classCount) * 150);
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [epoch, classCount, shape, activation, seed, dataId]);

  const net = netRef.current;
  const trainAcc = net ? accuracy(net, train) : 0;
  const testAcc = net ? accuracy(net, test) : 0;
  const last = history[history.length - 1];

  const sx = (v: number) => PAD.left + v * (W - PAD.left - PAD.right);
  const sy = (v: number) => H - PAD.bottom - v * (H - PAD.top - PAD.bottom);

  const inquiry = NEURAL_INQUIRY.neural;

  const setHiddenLayers = (count: number) => {
    const next = [...hidden];
    while (next.length < count) next.push(4);
    setHidden(next.slice(0, count));
  };
  const setNodes = (layer: number, n: number) => {
    const next = [...hidden];
    next[layer] = n;
    setHidden(next);
  };

  /* ── 왼쪽 ──────────────────────────────────────────── */
  const dataPane = (
    <>
      <p className="pane__title">데이터</p>
      <SettingRow label="데이터 고르기" help={DATA_HELP[dataId]}>
        <div style={{ display: 'grid', gap: 5 }}>
          {(['linear', 'circle', 'xor', 'spiral', 'food'] as DataId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`btn btn--wide${dataId === id ? ' btn--primary' : ''}`}
              onClick={() => setDataId(id)}
            >
              {DATA_LABEL[id]}
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="데이터 수">
        <ul className="field-list">
          <li>
            <span>훈련</span>
            <span>{train.length}개</span>
          </li>
          <li>
            <span>테스트</span>
            <span>{test.length}개</span>
          </li>
          <li>
            <span>분류할 종류</span>
            <span>{classCount}가지</span>
          </li>
        </ul>
      </SettingRow>
      <div className="note">
        교육용 예제 데이터입니다. 직선으로 나뉘는 데이터와 그렇지 않은 데이터를 골라 은닉층의
        역할을 확인해 보세요.
      </div>
    </>
  );

  /* ── 가운데 ────────────────────────────────────────── */
  const stageView = (
    <>
      <div className="stage">
        <span className="stage__mode">
          신경망 · {shape.join(' → ')} · 학습 {epoch}회
        </span>
        <div style={{ position: 'relative', padding: '34px 8px 4px' }}>
          <canvas
            ref={canvasRef}
            width={GRID}
            height={GRID}
            className="knn-canvas"
            style={{
              left: `${(PAD.left / W) * 100}%`,
              top: `calc(34px + ${(PAD.top / H) * (H - 38)}px)`,
              width: `${((W - PAD.left - PAD.right) / W) * 100}%`,
              height: `${((H - PAD.top - PAD.bottom) / H) * 100}%`,
            }}
            aria-hidden="true"
          />
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="신경망의 결정 영역" style={{ position: 'relative' }}>
            <title>{`학습 ${epoch}회 후의 결정 영역입니다. 색이 옅은 곳은 확신이 낮은 자리입니다.`}</title>
            <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="#c3cecb" />
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="#c3cecb" />
            <text x={(W + PAD.left) / 2} y={H - 10} textAnchor="middle" fontSize={12.5} fill="#4c5a56">
              {xLabel}
            </text>
            <text
              x={-(H - PAD.bottom + PAD.top) / 2}
              y={14}
              transform="rotate(-90)"
              textAnchor="middle"
              fontSize={12.5}
              fill="#4c5a56"
            >
              {yLabel}
            </text>
            {points.map((p, i) => {
              const isTest = i % 10 >= 7;
              const color = CLASS_COLORS[p.label % CLASS_COLORS.length];
              const sh = CLASS_SHAPES[p.label % CLASS_SHAPES.length];
              const wrong = net ? predictLabel(net, [p.x, p.y]) !== p.label : false;
              return (
                <g key={i}>
                  {wrong && epoch > 0 && (
                    <circle cx={sx(p.x)} cy={sy(p.y)} r={7} fill="none" stroke="#a0481c" strokeWidth={1.8} />
                  )}
                  <path
                    d={shapePath(sh, sx(p.x), sy(p.y), isTest ? 4 : 3.4)}
                    fill={isTest ? '#ffffff' : color}
                    stroke={isTest ? color : 'none'}
                    strokeWidth={1.8}
                    fillOpacity={isTest ? 1 : 0.85}
                  />
                </g>
              );
            })}
          </svg>
        </div>
        <div className="legend">
          {classNames.map((name, i) => (
            <span className="legend__item" key={name}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d={shapePath(CLASS_SHAPES[i % 3], 7, 7, 5)} fill={CLASS_COLORS[i % 3]} />
              </svg>
              {name}
            </span>
          ))}
        </div>
        <div className="legend legend--extra">
          <span className="legend__item">채운 모양 · 훈련 데이터</span>
          <span className="legend__item">빈 모양 · 테스트 데이터</span>
          <span className="legend__item legend__item--warn">주황 테두리 · 아직 못 맞힌 데이터</span>
        </div>
      </div>

      <div className="stage-summary">
        <div className="stage-summary__step">
          {epoch === 0 ? (
            '오른쪽에서 [학습 시작]을 눌러 보세요. 처음에는 아무것도 배우지 않은 상태입니다.'
          ) : (
            <>
              <strong>{epoch}회</strong> 학습했습니다 · 훈련 정확도{' '}
              <strong>{(trainAcc * 100).toFixed(1)}%</strong> · 테스트 정확도{' '}
              <strong>{(testAcc * 100).toFixed(1)}%</strong>
              {last && ` · 손실 ${last.loss.toFixed(3)}`}
            </>
          )}
        </div>
        <div className="stage-summary__stat">
          구조 {shape.join(' → ')} · 은닉층 {hidden.length}개 ·{' '}
          {ACTIVATION_LABEL[activation]} · 배경색이 옅은 곳은 확신이 낮은 자리입니다.
        </div>
      </div>

      <div className="lists">
        <NetworkDiagram net={net} shape={shape} classNames={classNames} />
      </div>
    </>
  );

  /* ── 오른쪽 ────────────────────────────────────────── */
  const settingsPane = (
    <>
      <p className="pane__title">신경망 설정</p>

      <SettingRow
        label="은닉층 개수"
        value={String(hidden.length)}
        help="입력층과 출력층 사이의 층입니다. 은닉층이 없으면 직선 하나로만 나눌 수 있습니다."
      >
        <input
          type="range"
          min={0}
          max={3}
          step={1}
          value={hidden.length}
          onChange={(e) => setHiddenLayers(Number(e.target.value))}
          aria-label="은닉층 개수"
        />
      </SettingRow>

      {hidden.map((n, i) => (
        <SettingRow key={i} label={`${i + 1}번째 은닉층 노드 수`} value={String(n)}>
          <input
            type="range"
            min={1}
            max={16}
            step={1}
            value={n}
            onChange={(e) => setNodes(i, Number(e.target.value))}
            aria-label={`${i + 1}번째 은닉층 노드 수`}
          />
        </SettingRow>
      ))}

      <SettingRow label="활성화 함수" help={ACTIVATION_HELP[activation]}>
        <div className="segmented" role="group" aria-label="활성화 함수">
          {(['relu', 'sigmoid', 'tanh'] as Activation[]).map((a) => (
            <button key={a} type="button" className={activation === a ? 'is-on' : ''} onClick={() => setActivation(a)}>
              {a === 'relu' ? 'ReLU' : a === 'sigmoid' ? '시그모이드' : 'tanh'}
            </button>
          ))}
        </div>
        <ActivationCurve activation={activation} />
      </SettingRow>

      <SettingRow
        label="학습률"
        value={learningRate.toFixed(2)}
        help="한 번에 얼마나 크게 고칠지 정합니다. 너무 크면 오히려 학습이 무너질 수 있습니다."
      >
        <input
          type="range"
          min={0.05}
          max={MAX_LEARNING_RATE}
          step={0.05}
          value={learningRate}
          onChange={(e) => setLearningRate(Number(e.target.value))}
          aria-label="학습률"
        />
      </SettingRow>

      <div className="setting">
        <div className="setting__head">
          <span className="setting__label">학습</span>
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <button
            type="button"
            className="btn btn--primary btn--wide"
            onClick={() => setTraining((v) => !v)}
          >
            {training ? '멈추기' : epoch === 0 ? '학습 시작' : '이어서 학습'}
          </button>
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                stepOnce();
                forceRender((v) => v + 1);
              }}
              disabled={training}
            >
              1회만 학습
            </button>
            <button type="button" className="btn" onClick={rebuild}>
              처음으로
            </button>
          </div>
          <button type="button" className="btn btn--wide" onClick={() => setSeed(seed + 1)}>
            처음 가중치 다시 뽑기
          </button>
        </div>
      </div>

      <div className="metric-cards">
        <div className="metric-card">
          <span className="metric-card__label">훈련 정확도</span>
          <span className="metric-card__value">{(trainAcc * 100).toFixed(1)}%</span>
        </div>
        <div className="metric-card metric-card--test">
          <span className="metric-card__label">테스트 정확도</span>
          <span className="metric-card__value">{(testAcc * 100).toFixed(1)}%</span>
        </div>
      </div>
    </>
  );

  /* ── 아래 ──────────────────────────────────────────── */
  const below = (
    <>
      <section className="section-card">
        <h2>학습이 진행되는 모습</h2>
        {history.length === 0 ? (
          <p className="muted">학습을 시작하면 손실과 정확도의 변화가 여기에 그려집니다.</p>
        ) : (
          <LearningCurve history={history} />
        )}
        <p className="muted">
          손실은 모델이 틀린 정도입니다. 학습이 잘 되면 손실이 줄고 정확도가 오릅니다. 다만 훈련
          정확도만 계속 오르고 테스트 정확도가 따라오지 않는다면 과적합을 의심해야 합니다 (교과서
          95쪽).
        </p>
      </section>

      {teacherMode && (
        <TeacherPanel
          note={NEURAL_TEACHER_NOTES.neural}
          extra={[NEURAL_COMMON.data, NEURAL_COMMON.lr]}
          inquiry={inquiry}
        />
      )}

      <InquiryPanel spec={inquiry} mode={mode} hasRun={epoch > 0} />
    </>
  );

  return (
    <ExperimentFrame
      title="신경망 실험실"
      textbook="Ⅱ-03 · 127~140쪽"
      mode={mode}
      onModeChange={onModeChange}
      dataPane={dataPane}
      stage={stageView}
      settingsPane={settingsPane}
      below={below}
    />
  );
}

/* ── 신경망 구조 그림 ──────────────────────────────────────── */

function NetworkDiagram({
  net,
  shape,
  classNames,
}: {
  net: Network | null;
  shape: number[];
  classNames: string[];
}) {
  const [tapped, setTapped] = useState<{ l: number; j: number; i: number } | null>(null);
  const width = 620;
  const height = 34 + Math.max(...shape) * 26 + 30;
  const colX = (l: number) => 80 + (l * (width - 170)) / Math.max(1, shape.length - 1);
  const nodeY = (l: number, i: number) => {
    const n = shape[l];
    return 30 + ((i + 1) * (height - 60)) / (n + 1);
  };

  const maxW = net
    ? Math.max(
        0.001,
        ...net.layers.flatMap((layer) => layer.weights.flatMap((w) => w.map(Math.abs))),
      )
    : 1;

  return (
    <div className="tree-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="신경망 구조" style={{ display: 'block', maxWidth: 'none' }}>
        <title>입력층에서 출력층까지의 구조입니다. 선의 굵기는 연결의 세기를 나타냅니다.</title>

        {net?.layers.map((layer, l) =>
          layer.weights.map((w, j) =>
            w.map((weight, i) => {
              const strength = Math.abs(weight) / maxW;
              if (strength < 0.06) return null;
              const isTapped = tapped?.l === l && tapped?.j === j && tapped?.i === i;
              return (
                <line
                  key={`${l}-${j}-${i}`}
                  x1={colX(l)}
                  y1={nodeY(l, i)}
                  x2={colX(l + 1)}
                  y2={nodeY(l + 1, j)}
                  stroke={weight >= 0 ? '#0b6e5c' : '#a0481c'}
                  strokeWidth={0.5 + strength * 3.4}
                  strokeOpacity={isTapped ? 1 : 0.16 + strength * 0.5}
                  onClick={() => setTapped(isTapped ? null : { l, j, i })}
                  style={{ cursor: 'pointer' }}
                />
              );
            }),
          ),
        )}

        {shape.map((n, l) => (
          <g key={l}>
            <text x={colX(l)} y={16} textAnchor="middle" fontSize={12} fill="#4c5a56" fontWeight={650}>
              {l === 0 ? '입력층' : l === shape.length - 1 ? '출력층' : `은닉층 ${l}`}
            </text>
            {Array.from({ length: n }, (_, i) => (
              <circle
                key={i}
                cx={colX(l)}
                cy={nodeY(l, i)}
                r={8}
                fill={l === shape.length - 1 ? CLASS_COLORS[i % CLASS_COLORS.length] : '#ffffff'}
                fillOpacity={l === shape.length - 1 ? 0.35 : 1}
                stroke={l === shape.length - 1 ? CLASS_COLORS[i % CLASS_COLORS.length] : '#8fa8a2'}
                strokeWidth={2}
              />
            ))}
          </g>
        ))}

        {classNames.map((name, i) => (
          <text
            key={name}
            x={colX(shape.length - 1) + 16}
            y={nodeY(shape.length - 1, i) + 4}
            fontSize={11.5}
            fill="#4c5a56"
          >
            {name}
          </text>
        ))}

        {tapped && net && (
          <text x={12} y={height - 8} fontSize={12} fill="#14201d">
            선택한 연결의 세기 {net.layers[tapped.l].weights[tapped.j][tapped.i].toFixed(3)} (
            {net.layers[tapped.l].weights[tapped.j][tapped.i] >= 0 ? '밀어 주는' : '눌러 주는'} 방향)
          </text>
        )}
        {!tapped && (
          <text x={12} y={height - 8} fontSize={12} fill="#7e8b87">
            선을 누르면 연결의 세기를 볼 수 있습니다 · 초록은 밀어 주고 주황은 눌러 줍니다
          </text>
        )}
      </svg>
    </div>
  );
}

/* ── 활성화 함수 그래프 ────────────────────────────────────── */

function ActivationCurve({ activation }: { activation: Activation }) {
  const f = (x: number) =>
    activation === 'relu' ? Math.max(0, x) : activation === 'sigmoid' ? 1 / (1 + Math.exp(-x)) : Math.tanh(x);
  const w = 200;
  const h = 84;
  const sx = (x: number) => 10 + ((x + 4) / 8) * (w - 20);
  const sy = (y: number) => h - 10 - ((y + 1.2) / 3.4) * (h - 20);
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = -4 + (i / 60) * 8;
    pts.push(`${i === 0 ? 'M' : 'L'} ${sx(x)} ${sy(f(x))}`);
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', marginTop: 8 }} role="img" aria-label={`${ACTIVATION_LABEL[activation]} 그래프`}>
      <line x1={10} y1={sy(0)} x2={w - 10} y2={sy(0)} stroke="#d5dedb" />
      <line x1={sx(0)} y1={8} x2={sx(0)} y2={h - 8} stroke="#d5dedb" />
      <path d={pts.join(' ')} fill="none" stroke="#0b6e5c" strokeWidth={2.2} />
    </svg>
  );
}

/* ── 학습 곡선 ─────────────────────────────────────────────── */

function LearningCurve({
  history,
}: {
  history: { epoch: number; trainAcc: number; testAcc: number; loss: number }[];
}) {
  const w = 620;
  const h = 260;
  const p = { top: 18, right: 18, bottom: 40, left: 52 };
  const n = history.length;
  const maxLoss = Math.max(...history.map((d) => d.loss), 0.1);
  const sx = (i: number) => p.left + (i / Math.max(1, n - 1)) * (w - p.left - p.right);
  const syAcc = (v: number) => h - p.bottom - v * (h - p.top - p.bottom);
  const syLoss = (v: number) => h - p.bottom - (v / maxLoss) * (h - p.top - p.bottom);

  const line = (get: (d: (typeof history)[0]) => number, scale: (v: number) => number) =>
    history.map((d, i) => `${i === 0 ? 'M' : 'L'} ${sx(i)} ${scale(get(d))}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="학습 곡선">
      <title>학습이 진행되면서 손실과 정확도가 어떻게 변하는지 보여 줍니다.</title>
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1={p.left} y1={syAcc(v)} x2={w - p.right} y2={syAcc(v)} stroke="#eef1f0" />
          <text x={p.left - 8} y={syAcc(v) + 4} textAnchor="end" fontSize={11} fill="#7e8b87">
            {(v * 100).toFixed(0)}%
          </text>
        </g>
      ))}
      <path d={line((d) => d.loss, syLoss)} fill="none" stroke="#7b4fa8" strokeWidth={2} strokeDasharray="4 3" />
      <path d={line((d) => d.trainAcc, syAcc)} fill="none" stroke="#a0481c" strokeWidth={2.4} />
      <path d={line((d) => d.testAcc, syAcc)} fill="none" stroke="#0b6e5c" strokeWidth={2.4} />
      <line x1={p.left} y1={h - p.bottom} x2={w - p.right} y2={h - p.bottom} stroke="#c3cecb" />
      <text x={(w + p.left) / 2} y={h - 8} textAnchor="middle" fontSize={12} fill="#4c5a56">
        학습 횟수 (지금 {history[n - 1]?.epoch ?? 0}회)
      </text>
      <g transform={`translate(${w - p.right - 176}, ${p.top + 4})`}>
        <rect x={-10} y={-14} width={186} height={62} rx={6} fill="#fff" fillOpacity={0.92} stroke="#d5dedb" />
        <line x1={0} y1={0} x2={18} y2={0} stroke="#a0481c" strokeWidth={2.4} />
        <text x={24} y={4} fontSize={11.5} fill="#4c5a56">훈련 정확도</text>
        <line x1={0} y1={18} x2={18} y2={18} stroke="#0b6e5c" strokeWidth={2.4} />
        <text x={24} y={22} fontSize={11.5} fill="#4c5a56">테스트 정확도</text>
        <line x1={0} y1={36} x2={18} y2={36} stroke="#7b4fa8" strokeWidth={2} strokeDasharray="4 3" />
        <text x={24} y={40} fontSize={11.5} fill="#4c5a56">손실 (작을수록 좋음)</text>
      </g>
    </svg>
  );
}

export { forward };
