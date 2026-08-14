import type { TeacherNote } from '../teacher/searchTeacher';

interface Props {
  note: TeacherNote;
  extra?: string[];
}

export function TeacherPanel({ note, extra }: Props) {
  return (
    <section className="teacher">
      <h2>교사용 보기</h2>
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
