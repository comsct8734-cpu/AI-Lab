import { usePersisted } from '../usePersisted';
import type { LearnMode } from './ExperimentFrame';

/**
 * 탐구 5단계 — 설계서 1-6
 * 예상하기 → 실행하기 → 관찰하기 → 비교하기 → 설명하기
 *
 * '이 실험에서 발견한 사실'은 학생이 ⑤ 설명하기를 쓴 뒤에만 열린다.
 * 정답을 먼저 알려 주지 않기 위해서다.
 */

export interface InquirySpec {
  /** 실험 구분 키. 저장할 때 쓴다. */
  id: string;
  /** ① 예상하기 질문 */
  predictQuestion: string;
  /** ① 선택지 */
  predictChoices: string[];
  /** ③ 관찰하기 질문 */
  observeQuestion: string;
  /** ⑤ 설명하기 질문 */
  explainQuestion: string;
  /** 추가 탐구 질문 */
  questions: string[];
  /** 발견한 사실 */
  finding: string;
}

interface Props {
  spec: InquirySpec;
  mode: LearnMode;
  /** 실행이 한 번이라도 끝났는가 — ③ 이후를 여는 조건 */
  hasRun: boolean;
}

export function InquiryPanel({ spec, mode, hasRun }: Props) {
  const [choice, setChoice] = usePersisted<number | null>(`${spec.id}:choice`, null);
  const [why, setWhy] = usePersisted(`${spec.id}:why`, '');
  const [observe, setObserve] = usePersisted(`${spec.id}:observe`, '');
  const [explain, setExplain] = usePersisted(`${spec.id}:explain`, '');
  const [openFinding, setOpenFinding] = usePersisted(`${spec.id}:finding`, false);

  const explained = explain.trim().length >= 10;

  return (
    <section className="section-card">
      <h2>결과 및 생각하기</h2>

      <div className="inquiry-step">
        <div className="inquiry-step__label">① 예상하기</div>
        <p className="inquiry-step__q">{spec.predictQuestion}</p>
        <div className="choices">
          {spec.predictChoices.map((c, i) => (
            <button
              key={c}
              type="button"
              className={`choice${choice === i ? ' is-on' : ''}`}
              onClick={() => setChoice(choice === i ? null : i)}
              aria-pressed={choice === i}
            >
              {c}
            </button>
          ))}
        </div>
        <label>
          <span className="muted">그렇게 생각한 이유</span>
          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="실행하기 전에 먼저 적어 보세요."
          />
        </label>
        {mode === 'guided' && choice === null && (
          <p className="locked-note">
            안내 실험에서는 먼저 예상을 고른 뒤에 실행할 수 있습니다.
          </p>
        )}
      </div>

      <div className="inquiry-step">
        <div className="inquiry-step__label">② 실행하기</div>
        <p className="inquiry-step__q">
          {hasRun
            ? '실행을 마쳤습니다. 예상과 결과를 비교해 보세요.'
            : '오른쪽 설정에서 [한 단계 실행] 또는 [자동 실행]을 눌러 진행하세요.'}
        </p>
      </div>

      <div className="inquiry-step">
        <div className="inquiry-step__label">③ 관찰하기</div>
        <p className="inquiry-step__q">{spec.observeQuestion}</p>
        <textarea
          value={observe}
          onChange={(e) => setObserve(e.target.value)}
          placeholder="무엇이 달라졌는지 적어 보세요."
        />
      </div>

      <div className="inquiry-step">
        <div className="inquiry-step__label">④ 비교하기</div>
        <p className="inquiry-step__q">
          설정을 바꾸어 다시 실행하고, 아래 비교표에서 결과가 어떻게 달라졌는지 확인해 보세요.
        </p>
      </div>

      <div className="inquiry-step">
        <div className="inquiry-step__label">⑤ 설명하기</div>
        <p className="inquiry-step__q">{spec.explainQuestion}</p>
        <textarea
          value={explain}
          onChange={(e) => setExplain(e.target.value)}
          placeholder="왜 그런 결과가 나왔다고 생각하는지 자신의 말로 적어 보세요."
        />
      </div>

      <div className="inquiry-step">
        <div className="inquiry-step__label">더 생각해 볼 질문</div>
        <ol style={{ margin: 0, paddingLeft: '1.15em' }}>
          {spec.questions.map((q) => (
            <li key={q} style={{ marginBottom: 5, fontSize: 14.5 }}>
              {q}
            </li>
          ))}
        </ol>
      </div>

      {openFinding ? (
        <div className="finding">
          <strong>이 실험에서 발견한 사실</strong>
          <p style={{ margin: '6px 0 0' }}>{spec.finding}</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="btn"
            onClick={() => setOpenFinding(true)}
            disabled={!explained}
          >
            이 실험에서 발견한 사실 열기
          </button>
          {!explained && (
            <p className="locked-note">
              ⑤ 설명하기를 먼저 작성하면 열립니다. 스스로 설명해 본 뒤에 확인하는 것이 더 오래
              남습니다.
            </p>
          )}
        </>
      )}
    </section>
  );
}
