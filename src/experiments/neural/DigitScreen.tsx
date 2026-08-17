import { useMemo, useRef, useState } from 'react';
import { ExperimentFrame, type LearnMode } from '../../ui/ExperimentFrame';
import { SettingRow } from '../../ui/controls';
import { InquiryPanel } from '../../ui/InquiryPanel';
import { TeacherPanel } from '../../ui/TeacherPanel';
import { NEURAL_TEACHER_NOTES, NEURAL_COMMON } from '../../teacher/neuralTeacher';
import { fromWeights, predict, type Layer } from '../../core/neuralNet';
import digitModelRaw from '../../data/digitModel.json' with { type: 'json' };
import { usePersisted } from '../../usePersisted';
import { NEURAL_INQUIRY } from './neuralInquiry';
import { load } from '../../storage';

/**
 * 화면 6-2 손글씨 숫자
 * 교과서 Ⅱ-03 인쇄 137~142쪽
 *
 * 가중치는 실제 MNIST 로 미리 학습해 파일로 넣어 두었다.
 * (6만 장을 학교 컴퓨터의 브라우저에서 학습시키면 수 분이 걸린다.)
 * 다만 학생이 그린 숫자에 대한 계산은 브라우저에서 실제로 수행한다.
 * 결과 이미지를 바꿔치기하는 방식이 아니다.
 */

const MODEL = digitModelRaw as {
  shape: number[];
  activation: 'relu';
  size: number;
  trainedOn: string;
  testAccuracy: number;
  epochs: number;
  layers: Layer[];
};

const SIZE = MODEL.size; // 14
const BRUSH = 1.15; // 붓 굵기 (격자 칸 기준)

interface Props {
  mode: LearnMode;
  onModeChange: (m: LearnMode) => void;
  teacherMode: boolean;
}

export function DigitScreen({ mode, onModeChange, teacherMode }: Props) {
  const [pixels, setPixels] = useState<number[]>(() => new Array(SIZE * SIZE).fill(0));
  const [drawn, setDrawn] = useState(false);
  const drawing = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const net = useMemo(
    () => fromWeights(MODEL.shape, MODEL.activation, MODEL.layers),
    [],
  );

  const probs = useMemo(() => predict(net, pixels), [net, pixels]);
  const best = useMemo(() => probs.indexOf(Math.max(...probs)), [probs]);
  const sorted = useMemo(
    () => probs.map((p, digit) => ({ digit, p })).sort((a, b) => b.p - a.p),
    [probs],
  );

  const paint = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const gx = ((clientX - rect.left) / rect.width) * SIZE;
    const gy = ((clientY - rect.top) / rect.height) * SIZE;
    if (gx < 0 || gx >= SIZE || gy < 0 || gy >= SIZE) return;
    setPixels((prev) => {
      const next = [...prev];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const d = Math.hypot(c + 0.5 - gx, r + 0.5 - gy);
          if (d > BRUSH) continue;
          // 가운데는 진하게, 가장자리는 옅게 칠한다
          const v = Math.max(0, 1 - d / BRUSH);
          next[r * SIZE + c] = Math.min(1, next[r * SIZE + c] + v * 0.9);
        }
      }
      return next;
    });
    setDrawn(true);
  };

  const clear = () => {
    setPixels(new Array(SIZE * SIZE).fill(0));
    setDrawn(false);
  };

  const inquiry = NEURAL_INQUIRY.digit;

  const dataPane = (
    <>
      <p className="pane__title">모델</p>
      <div className="note" style={{ marginTop: 0 }}>
        <strong>손글씨 숫자 인식 모델</strong>
        <br />
        {MODEL.trainedOn}
        <br />
        <span className="muted">
          테스트 정확도 {(MODEL.testAccuracy * 100).toFixed(1)}% · {MODEL.epochs}회 학습
        </span>
      </div>

      <SettingRow label="모델 구조" help="입력층의 노드 하나가 그림의 칸 하나에 대응합니다.">
        <ul className="field-list">
          <li>
            <span>입력층</span>
            <span>{MODEL.shape[0]}개 ({SIZE}×{SIZE} 칸)</span>
          </li>
          <li>
            <span>은닉층</span>
            <span>{MODEL.shape[1]}개</span>
          </li>
          <li>
            <span>출력층</span>
            <span>10개 (0~9)</span>
          </li>
        </ul>
      </SettingRow>

      <SettingRow label="이 모델이 보는 것" help="사람이 보는 그림이 아니라, 칸마다의 진하기 숫자입니다.">
        <p className="muted" style={{ margin: 0 }}>
          여러분이 그린 그림은 {SIZE}×{SIZE} = {MODEL.shape[0]}개의 숫자로 바뀌어 모델에
          들어갑니다. 오른쪽 아래 그림이 모델이 실제로 받는 값입니다.
        </p>
      </SettingRow>

      <div className="note">
        이 모델은 사람이 쓴 숫자 사진 수천 장으로 미리 학습해 두었습니다. 여러분이 그린 숫자를
        판단하는 계산은 <strong>지금 이 기기에서 실제로 이루어집니다.</strong>
      </div>
    </>
  );

  const stageView = (
    <>
      <div className="stage">
        <span className="stage__mode">손글씨 숫자 · 칸 안에 크게 그려 주세요</span>
        <div className="digit-stage">
          <div>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="digit-canvas"
              role="img"
              aria-label="숫자를 그리는 칸"
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => {
                drawing.current = true;
                (e.target as Element).setPointerCapture?.(e.pointerId);
                paint(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (drawing.current) paint(e.clientX, e.clientY);
              }}
              onPointerUp={() => {
                drawing.current = false;
              }}
              onPointerLeave={() => {
                drawing.current = false;
              }}
            >
              <rect x={0} y={0} width={SIZE} height={SIZE} fill="#ffffff" />
              {pixels.map((v, i) =>
                v <= 0.02 ? null : (
                  <rect
                    key={i}
                    x={i % SIZE}
                    y={Math.floor(i / SIZE)}
                    width={1}
                    height={1}
                    fill="#14201d"
                    fillOpacity={Math.min(1, v)}
                  />
                ),
              )}
              {Array.from({ length: SIZE + 1 }, (_, i) => (
                <g key={`g${i}`}>
                  <line x1={i} y1={0} x2={i} y2={SIZE} stroke="#e7edeb" strokeWidth={0.03} />
                  <line x1={0} y1={i} x2={SIZE} y2={i} stroke="#e7edeb" strokeWidth={0.03} />
                </g>
              ))}
            </svg>
            <p className="muted" style={{ textAlign: 'center', margin: '6px 0 0', fontSize: 12.5 }}>
              마우스나 손가락으로 그려 보세요
            </p>
          </div>

          <div className="digit-probs">
            <h4>각 숫자일 확률</h4>
            {probs.map((p, digit) => (
              <div className="prob-row" key={digit}>
                <span className="prob-row__digit">{digit}</span>
                <span className="prob-row__bar">
                  <span
                    style={{
                      width: `${Math.max(1, p * 100)}%`,
                      background: digit === best ? 'var(--accent)' : '#a2c9be',
                    }}
                  />
                </span>
                <span className="prob-row__value">{(p * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="stage-summary">
        <div className="stage-summary__step">
          {!drawn ? (
            '아직 아무것도 그리지 않았습니다. 빈 화면에도 모델은 답을 내놓는다는 점을 눈여겨보세요.'
          ) : (
            <>
              이 모델은 <strong>{best}</strong> 라고 판단했습니다 · 확률{' '}
              <strong>{(probs[best] * 100).toFixed(1)}%</strong>
              {probs[best] < 0.6 && ' · 확신이 낮습니다'}
            </>
          )}
        </div>
        <div className="stage-summary__stat">
          두 번째로 높은 것은 {sorted[1].digit} ({(sorted[1].p * 100).toFixed(1)}%) 입니다 · 열 개
          확률을 모두 더하면 100% 가 됩니다.
        </div>
      </div>
    </>
  );

  const settingsPane = (
    <>
      <p className="pane__title">설정</p>
      <div className="setting">
        <div style={{ display: 'grid', gap: 6 }}>
          <button type="button" className="btn btn--primary btn--wide" onClick={clear}>
            지우고 다시 그리기
          </button>
        </div>
      </div>

      <SettingRow label="모델이 받는 값" help="사람이 보는 그림이 아니라 칸마다의 진하기 숫자입니다.">
        <div className="pixel-preview">
          {pixels.map((v, i) => (
            <span key={i} style={{ background: `rgba(20,32,29,${Math.min(1, v)})` }} />
          ))}
        </div>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 12.5 }}>
          {SIZE}×{SIZE} = {MODEL.shape[0]}개의 숫자
        </p>
      </SettingRow>

      <SettingRow label="해 볼 만한 것">
        <ul style={{ margin: 0, paddingLeft: '1.05em', fontSize: 13.5 }}>
          <li>아주 작게 그려 보기</li>
          <li>칸 구석에 치우쳐 그려 보기</li>
          <li>1 과 7 을 비슷하게 그려 보기</li>
          <li>한글 자음을 그려 보기</li>
        </ul>
      </SettingRow>
    </>
  );

  const below = (
    <>
      <section className="section-card">
        <h2>이 모델은 어떻게 만들어졌나</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <th scope="row">학습에 사용한 데이터</th>
                <td>{MODEL.trainedOn}</td>
              </tr>
              <tr>
                <th scope="row">모델 구조</th>
                <td>{MODEL.shape.join(' → ')} (은닉층 1개)</td>
              </tr>
              <tr>
                <th scope="row">학습 횟수</th>
                <td>{MODEL.epochs}회</td>
              </tr>
              <tr>
                <th scope="row">테스트 정확도</th>
                <td>{(MODEL.testAccuracy * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <th scope="row">지금 이 기기에서 하는 일</th>
                <td>여러분이 그린 그림을 모델에 넣어 확률을 계산합니다</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted">
          테스트 정확도가 {(MODEL.testAccuracy * 100).toFixed(1)}% 라는 것은, 열 장 중 한 장쯤은
          틀린다는 뜻이기도 합니다. 여러분이 그린 숫자를 틀리게 판단했다면 그것은 고장이 아니라
          모델의 한계입니다.
        </p>
      </section>

      {teacherMode && (
        <TeacherPanel
          note={NEURAL_TEACHER_NOTES.digit}
          extra={[NEURAL_COMMON.digit]}
          inquiry={inquiry}
        />
      )}

      <InquiryPanel spec={inquiry} mode={mode} hasRun={drawn} />
    </>
  );

  return (
    <ExperimentFrame
      title="손글씨 숫자"
      textbook="Ⅱ-03 · 137~142쪽"
      mode={mode}
      onModeChange={onModeChange}
      dataPane={dataPane}
      stage={stageView}
      settingsPane={settingsPane}
      below={below}
    />
  );
}

/* ══════════════════════════════════════════════════════════ */
/* 화면 6-3 도전 과제                                          */
/* ══════════════════════════════════════════════════════════ */

interface Challenge {
  id: string;
  title: string;
  condition: string;
  where: string;
  hint: string;
  textbook: string;
}

const CHALLENGES: Challenge[] = [
  {
    id: 'c1',
    title: '펭귄의 종을 가장 잘 맞히는 방법을 찾아라',
    condition:
      '분류 실험실에서 특징 두 개와 모델을 골라, 테스트 정확도를 가능한 한 높여 보세요. 어떤 조합에서 가장 높았는지 적어야 합니다.',
    where: '분류 실험실 · 모델 비교실',
    hint: '먼저 데이터 관찰에서 어떤 속성 조합이 세 종을 잘 나누는지 살펴보세요.',
    textbook: 'Ⅱ-02 · 106~115쪽',
  },
  {
    id: 'c2',
    title: '데이터 하나가 회귀선을 얼마나 흔드는지 보여라',
    condition:
      '선형 회귀에서 점 하나만 옮겨 R² 를 0.1 이상 떨어뜨려 보세요. 어디에 있는 점을 옮겨야 효과가 큰지 설명해야 합니다.',
    where: '회귀 실험실 · 선형 회귀',
    hint: '가운데에 있는 점과 양 끝에 있는 점 중 어느 쪽이 더 큰 영향을 줄까요?',
    textbook: 'Ⅱ-02 · 96~103쪽',
  },
  {
    id: 'c3',
    title: '가장 적은 노드를 확인하고 목적지에 도착하라',
    condition:
      'A* 탐색에서 휴리스틱값을 조정해, 최단 경로를 유지하면서 테스트한 노드 수를 가능한 한 줄여 보세요.',
    where: '탐색 실험실 · A* 탐색',
    hint: '휴리스틱값을 너무 크게 하면 최단 경로를 놓칩니다. 그 경계를 찾아보세요.',
    textbook: 'Ⅰ-02 · 34~37쪽',
  },
  {
    id: 'c4',
    title: '두 모델이 서로 다르게 판단하는 자리를 찾아라',
    condition:
      '모델 비교실에서 설정을 조정해, 세 모델의 판단이 갈리는 데이터를 5개 이상 만들어 보세요. 그 데이터들이 어디에 모여 있는지 설명해야 합니다.',
    where: '분류 실험실 · 모델 비교실',
    hint: 'k 값과 트리 깊이를 극단적으로 바꿔 보세요.',
    textbook: 'Ⅱ-02 · 106, 115쪽',
  },
  {
    id: 'c5',
    title: '고객을 자연스러운 무리로 나누어라',
    condition:
      '군집 실험실에서 실루엣 점수가 가장 높은 k 를 찾고, 각 무리에 어떤 고객층인지 이름을 붙여 보세요.',
    where: '군집 실험실 · 군집 개수 정하기',
    hint: '연 소득과 소비 점수가 각각 높은지 낮은지로 이름을 지어 보세요.',
    textbook: 'Ⅱ-02 · 118~124쪽',
  },
  {
    id: 'c6',
    title: '은닉층이 꼭 필요한 데이터를 찾아라',
    condition:
      '신경망 실험실에서 은닉층을 0개로 두었을 때 못 풀지만, 은닉층을 늘리면 풀리는 데이터를 찾아 두 경우의 정확도를 비교해 보세요.',
    where: '신경망 실험실',
    hint: '직선 하나로 나눌 수 있는 데이터와 그렇지 않은 데이터를 비교해 보세요.',
    textbook: 'Ⅱ-03 · 127~129쪽',
  },
];

export function ChallengeScreen({ mode, onModeChange, teacherMode }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [answers, setAnswers] = usePersisted<Record<string, string>>('challenge:answers', {});
  const [doneIds, setDoneIds] = usePersisted<string[]>('challenge:done', []);

  const inquiry = NEURAL_INQUIRY.challenge;

  const dataPane = (
    <>
      <p className="pane__title">도전 과제</p>
      <div className="note" style={{ marginTop: 0 }}>
        조건만 주어집니다. 어떤 실험실에서 어떤 방법을 쓸지는 여러분이 정합니다.
      </div>
      <SettingRow label="진행 상황">
        <ul className="field-list">
          <li>
            <span>전체</span>
            <span>{CHALLENGES.length}개</span>
          </li>
          <li>
            <span>해결함</span>
            <span>{doneIds.length}개</span>
          </li>
        </ul>
      </SettingRow>
    </>
  );

  const stageView = (
    <>
      <div className="stage">
        <span className="stage__mode">도전 과제 {CHALLENGES.length}개</span>
        <div style={{ padding: '38px 16px 18px' }}>
          {CHALLENGES.map((c, i) => {
            const isOpen = openId === c.id;
            const isDone = doneIds.includes(c.id);
            return (
              <div className={`challenge${isDone ? ' is-done' : ''}`} key={c.id}>
                <button
                  type="button"
                  className="challenge__head"
                  onClick={() => setOpenId(isOpen ? null : c.id)}
                  aria-expanded={isOpen}
                >
                  <span className="challenge__no">도전 {i + 1}</span>
                  <span className="challenge__title">{c.title}</span>
                  {isDone && <span className="challenge__done">해결함</span>}
                </button>
                {isOpen && (
                  <div className="challenge__body">
                    <p>{c.condition}</p>
                    <ul className="field-list">
                      <li>
                        <span>어디에서</span>
                        <span>{c.where}</span>
                      </li>
                      <li>
                        <span>교과서</span>
                        <span>{c.textbook}</span>
                      </li>
                    </ul>
                    <details className="challenge__hint">
                      <summary>힌트 보기</summary>
                      <p>{c.hint}</p>
                    </details>
                    <label>
                      <span className="muted">내가 찾은 방법과 결과</span>
                      <textarea
                        value={answers[c.id] ?? ''}
                        onChange={(e) => setAnswers({ ...answers, [c.id]: e.target.value })}
                        placeholder="어떤 설정에서 어떤 결과가 나왔는지, 왜 그렇게 되었는지 적어 보세요."
                      />
                    </label>
                    <button
                      type="button"
                      className={`btn btn--small${isDone ? '' : ' btn--primary'}`}
                      onClick={() =>
                        setDoneIds(
                          isDone ? doneIds.filter((d) => d !== c.id) : [...doneIds, c.id],
                        )
                      }
                    >
                      {isDone ? '해결 표시 취소' : '해결했음으로 표시'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="stage-summary">
        <div className="stage-summary__step">
          {doneIds.length === 0
            ? '과제를 눌러 조건을 확인하세요. 정답을 알려 주지 않습니다.'
            : `${CHALLENGES.length}개 중 ${doneIds.length}개를 해결했습니다.`}
        </div>
        <div className="stage-summary__stat">
          적은 내용은 [내 실험 기록]에서 모아 볼 수 있고 인쇄할 수 있습니다.
        </div>
      </div>
    </>
  );

  const settingsPane = (
    <>
      <p className="pane__title">안내</p>
      <div className="note" style={{ marginTop: 0 }}>
        도전 과제에는 정해진 하나의 답이 없습니다. 어떤 설정에서 어떤 결과가 나왔고, 왜 그렇게
        되었는지를 설명하는 것이 과제입니다.
      </div>
      <SettingRow label="기록">
        <p className="muted" style={{ margin: 0 }}>
          여기에 적은 내용은 브라우저에 임시로 저장됩니다. 수업이 끝나면 [내 실험 기록]에서
          인쇄하거나 화면을 캡처해 두세요.
        </p>
      </SettingRow>
    </>
  );

  const below = (
    <>
      {teacherMode && (
        <TeacherPanel note={NEURAL_TEACHER_NOTES.challenge} extra={[NEURAL_COMMON.challenge]} inquiry={inquiry} />
      )}
      <InquiryPanel spec={inquiry} mode={mode} hasRun={doneIds.length > 0} />
    </>
  );

  return (
    <ExperimentFrame
      title="도전 과제"
      textbook="Ⅰ~Ⅱ 단원 종합"
      mode={mode}
      onModeChange={onModeChange}
      dataPane={dataPane}
      stage={stageView}
      settingsPane={settingsPane}
      below={below}
    />
  );
}

/* ══════════════════════════════════════════════════════════ */
/* 화면 6-4 내 실험 기록                                       */
/* ══════════════════════════════════════════════════════════ */

interface RecordEntry {
  id: string;
  unit: string;
  name: string;
  textbook: string;
}

const RECORD_ENTRIES: RecordEntry[] = [
  { id: 'problem-tree', unit: 'Ⅰ-02', name: '문제를 트리로 표현하기', textbook: '27~29쪽' },
  { id: 'search-bfs', unit: 'Ⅰ-02', name: '너비 우선 탐색', textbook: '30~31쪽' },
  { id: 'search-ucs', unit: 'Ⅰ-02', name: '균일 비용 탐색', textbook: '32~33쪽' },
  { id: 'search-astar', unit: 'Ⅰ-02', name: 'A* 탐색', textbook: '34~37쪽' },
  { id: 'data-observe', unit: 'Ⅱ-01', name: '데이터 관찰', textbook: '67~77쪽' },
  { id: 'data-clean', unit: 'Ⅱ-01', name: '결측치와 이상치', textbook: '74~81쪽' },
  { id: 'data-normalize', unit: 'Ⅱ-01', name: '정규화', textbook: '76쪽' },
  { id: 'data-knn', unit: 'Ⅱ-02', name: '최근접 이웃', textbook: '108~114쪽' },
  { id: 'reg-split', unit: 'Ⅱ-02', name: '훈련 데이터와 테스트 데이터', textbook: '94, 100쪽' },
  { id: 'reg-overfit', unit: 'Ⅱ-02', name: '과적합', textbook: '95쪽' },
  { id: 'reg-linear', unit: 'Ⅱ-02', name: '선형 회귀', textbook: '96~103쪽' },
  { id: 'cls-tree', unit: 'Ⅱ-02', name: '결정트리', textbook: '107, 112쪽' },
  { id: 'cls-logistic', unit: 'Ⅱ-02', name: '로지스틱 회귀', textbook: '114쪽' },
  { id: 'cls-compare', unit: 'Ⅱ-02', name: '모델 비교실', textbook: '106, 115쪽' },
  { id: 'clu-kmeans', unit: 'Ⅱ-02', name: 'k-평균 군집', textbook: '118~122쪽' },
  { id: 'clu-silhouette', unit: 'Ⅱ-02', name: '군집 개수 정하기', textbook: '123~124쪽' },
  { id: 'nn-neural', unit: 'Ⅱ-03', name: '신경망 실험실', textbook: '127~140쪽' },
  { id: 'nn-digit', unit: 'Ⅱ-03', name: '손글씨 숫자', textbook: '137~142쪽' },
];

export function RecordScreen() {
  const [name, setName] = usePersisted('record:name', '');
  const rows = RECORD_ENTRIES.map((e) => ({
    ...e,
    why: load<string>(`${e.id}:why`, ''),
    observe: load<string>(`${e.id}:observe`, ''),
    explain: load<string>(`${e.id}:explain`, ''),
    finding: load<boolean>(`${e.id}:finding`, false),
  }));
  const written = rows.filter(
    (r) => r.why.trim() || r.observe.trim() || r.explain.trim() || r.finding,
  );
  const challengeAnswers = load<Record<string, string>>('challenge:answers', {});
  const challengeDone = load<string[]>('challenge:done', []);
  const writtenChallenges = CHALLENGES.filter(
    (c) => (challengeAnswers[c.id] ?? '').trim() || challengeDone.includes(c.id),
  );

  return (
    <div className="record">
      <div className="record__top">
        <h1>내 실험 기록</h1>
        <div className="record__actions">
          <label className="record__name">
            이름
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 적으면 인쇄물에 함께 나옵니다"
            />
          </label>
          <button type="button" className="btn btn--primary" onClick={() => window.print()}>
            인쇄하기
          </button>
        </div>
      </div>

      <p className="record__meta">
        {name && <strong>{name} · </strong>}
        {written.length + writtenChallenges.length === 0
          ? '아직 기록된 내용이 없습니다. 각 실험의 [결과 및 생각하기]에 적은 내용이 여기에 모입니다.'
          : `실험 ${written.length}개 · 도전 과제 ${writtenChallenges.length}개를 기록했습니다.`}
      </p>

      {written.map((r) => (
        <section className="record__item" key={r.id}>
          <h2>
            {r.name}
            <span className="record__textbook">
              {r.unit} · {r.textbook}
            </span>
            {r.finding && <span className="record__badge">완료</span>}
          </h2>
          {r.why.trim() && (
            <p>
              <strong>① 예상한 이유</strong>
              <br />
              {r.why}
            </p>
          )}
          {r.observe.trim() && (
            <p>
              <strong>③ 관찰한 것</strong>
              <br />
              {r.observe}
            </p>
          )}
          {r.explain.trim() && (
            <p>
              <strong>⑤ 내 설명</strong>
              <br />
              {r.explain}
            </p>
          )}
        </section>
      ))}

      {writtenChallenges.length > 0 && (
        <>
          <h2 className="record__section">도전 과제</h2>
          {writtenChallenges.map((c) => (
            <section className="record__item" key={c.id}>
              <h2>
                {c.title}
                <span className="record__textbook">{c.textbook}</span>
                {challengeDone.includes(c.id) && <span className="record__badge">해결함</span>}
              </h2>
              {(challengeAnswers[c.id] ?? '').trim() && <p>{challengeAnswers[c.id]}</p>}
            </section>
          ))}
        </>
      )}

      <p className="record__note">
        이 기록은 이 기기의 브라우저에만 저장됩니다. 여러 사람이 함께 쓰는 컴퓨터라면 수업이 끝난
        뒤 화면 위쪽의 [내 기록 지우기]를 눌러 주세요.
      </p>
    </div>
  );
}
