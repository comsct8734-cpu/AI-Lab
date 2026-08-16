import type { TeacherNote } from '../teacher/searchTeacher';
import type { InquirySpec } from './InquiryPanel';
import { load } from '../storage';

/**
 * 교사용 보기
 *
 * 두 가지를 보여 준다.
 *  1) 예시 답안 — 교사가 학생들과 답을 맞춰 볼 수 있도록 질문 옆에 함께 표시한다.
 *  2) 이 기기에 입력된 내용 — 지금 이 브라우저에 저장된 학생 답변.
 *     다른 학생의 기기에 있는 답변은 여기서 볼 수 없다(아래 안내 참고).
 */

interface Props {
  note: TeacherNote;
  extra?: string[];
  /** 이 화면의 탐구 질문. 있으면 예시 답안과 입력 내용을 함께 보여 준다. */
  inquiry?: InquirySpec;
}

export function TeacherPanel({ note, extra, inquiry }: Props) {
  const answers = note.answers;

  // 지금 이 브라우저에 저장된 학생 입력
  const choice = inquiry ? load<number | null>(`${inquiry.id}:choice`, null) : null;
  const why = inquiry ? load<string>(`${inquiry.id}:why`, '') : '';
  const observe = inquiry ? load<string>(`${inquiry.id}:observe`, '') : '';
  const explain = inquiry ? load<string>(`${inquiry.id}:explain`, '') : '';
  const hasInput =
    choice !== null || why.trim() !== '' || observe.trim() !== '' || explain.trim() !== '';

  return (
    <section className="teacher">
      <h2>교사용 보기</h2>

      {inquiry && (
        <div className="teacher-answers">
          <h3>예시 답안</h3>
          <p className="teacher-answers__note">
            학생이 스스로 답한 뒤에 함께 확인해 주십시오. 정답을 먼저 제시하면 탐구가 되지 않습니다.
          </p>

          <div className="qa">
            <div className="qa__q">
              <span className="qa__tag">① 예상하기</span>
              {inquiry.predictQuestion}
            </div>
            <div className="qa__a">{answers.predict}</div>
            {inquiry.predictChoices.length > 0 && (
              <div className="qa__student">
                이 기기의 선택:{' '}
                {choice === null ? (
                  <em>아직 고르지 않음</em>
                ) : (
                  <strong>{inquiry.predictChoices[choice]}</strong>
                )}
                {why.trim() !== '' && <> · 이유: {why}</>}
              </div>
            )}
          </div>

          <div className="qa">
            <div className="qa__q">
              <span className="qa__tag">③ 관찰하기</span>
              {inquiry.observeQuestion}
            </div>
            <div className="qa__student">
              이 기기의 입력: {observe.trim() === '' ? <em>아직 비어 있음</em> : observe}
            </div>
          </div>

          <div className="qa">
            <div className="qa__q">
              <span className="qa__tag">⑤ 설명하기</span>
              {inquiry.explainQuestion}
            </div>
            <div className="qa__a">{answers.explain}</div>
            <div className="qa__student">
              이 기기의 입력: {explain.trim() === '' ? <em>아직 비어 있음</em> : explain}
            </div>
          </div>

          {inquiry.questions.map((q, i) => (
            <div className="qa" key={q}>
              <div className="qa__q">
                <span className="qa__tag">더 생각해 볼 질문 {i + 1}</span>
                {q}
              </div>
              <div className="qa__a">{answers.questions[i] ?? '—'}</div>
            </div>
          ))}

          <div className="qa">
            <div className="qa__q">
              <span className="qa__tag">발견한 사실</span>
              학생이 ⑤를 작성한 뒤에 열립니다
            </div>
            <div className="qa__a">{inquiry.finding}</div>
          </div>

          {!hasInput && (
            <p className="teacher-answers__note">
              이 기기에는 아직 입력된 내용이 없습니다. 학생 각자의 답변은 그 학생의 기기에만
              저장되므로 이 화면에서는 보이지 않습니다. 학생 답변을 함께 보시려면 학생 화면을
              화면에 띄우거나, 학생이 답한 기기에서 이 보기를 켜 주십시오.
            </p>
          )}
        </div>
      )}

      <h3>수업 정보</h3>
      <dl>
        <dt>교과서 연계</dt>
        <dd>{note.textbook}</dd>

        <dt>추천 수업 시간</dt>
        <dd>{note.minutes}</dd>

        <dt>선수 학습</dt>
        <dd>{note.prior}</dd>

        <dt>쉽게 이해할 내용</dt>
        <dd>{note.easy}</dd>

        <dt>어려워할 내용</dt>
        <dd>{note.hard}</dd>

        <dt>교사 발문</dt>
        <dd>
          <ul>
            {note.prompts.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </dd>

        <dt>예상 오개념</dt>
        <dd>
          <ul>
            {note.misconceptions.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </dd>

        {note.deeper && (
          <>
            <dt>심화 질문 (확장 학습)</dt>
            <dd>{note.deeper}</dd>
          </>
        )}

        <dt>구현 안내</dt>
        <dd>{note.implementation}</dd>

        {extra && extra.length > 0 && (
          <>
            <dt>수업 전 확인</dt>
            <dd>
              <ul>
                {extra.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
