import { useMemo, useState } from 'react';
import { ExperimentFrame, type LearnMode } from '../../ui/ExperimentFrame';
import { PuzzleBoard } from '../../ui/PuzzleView';
import { SettingRow } from '../../ui/controls';
import { InquiryPanel } from '../../ui/InquiryPanel';
import { TeacherPanel } from '../../ui/TeacherPanel';
import { SEARCH_LAB_COMMON, TEACHER_NOTES } from '../../teacher/searchTeacher';
import { usePersisted } from '../../usePersisted';
import {
  DEFAULT_DIRECTION_ORDER,
  DIRECTION_LABEL,
  PUZZLE_GOAL,
  PUZZLE_START,
  misplacedTiles,
  sameState,
  slide,
  type Direction,
  type PuzzleState,
} from '../../core/search/puzzle';

/**
 * 화면 1-1 · 문제를 트리로 표현하기
 * 교과서 인쇄 27~29쪽
 *
 * 알고리즘을 배우기 전에 상태 · 간선 · 트리라는 표현 방식을 먼저 경험하게 한다.
 * 학생이 직접 빈칸을 움직이고, 자식 상태를 눌러 트리를 한 층씩 펼친다.
 */

interface Props {
  mode: LearnMode;
  onModeChange: (m: LearnMode) => void;
  teacherMode: boolean;
}

type Stage = 1 | 2 | 3;

export function ProblemTreeScreen({ mode, onModeChange, teacherMode }: Props) {
  const [board, setBoard] = useState<PuzzleState>(PUZZLE_START);
  const [goal, setGoal] = useState<PuzzleState>(PUZZLE_GOAL);
  const [stage, setStage] = useState<Stage>(1);
  const [expanded, setExpanded] = usePersisted<string[]>('problem-tree:expanded', []);

  const children = useMemo(
    () =>
      DEFAULT_DIRECTION_ORDER.map((dir) => ({ dir, state: slide(board, dir) })).filter(
        (c): c is { dir: Direction; state: PuzzleState } => c.state !== null,
      ),
    [board],
  );

  const h = misplacedTiles(board, goal);
  const reached = sameState(board, goal);

  const moveTile = (index: number) => {
    const blank = board.indexOf(0);
    const br = Math.floor(blank / 3);
    const bc = blank % 3;
    const tr = Math.floor(index / 3);
    const tc = index % 3;
    if (Math.abs(br - tr) + Math.abs(bc - tc) !== 1) return; // 인접한 타일만 이동
    const next = [...board];
    next[blank] = next[index];
    next[index] = 0;
    setBoard(next);
  };

  const applyDirection = (dir: Direction) => {
    const next = slide(board, dir);
    if (!next) return;
    setBoard(next);
    setExpanded([...new Set([...expanded, next.join('')])]);
  };

  const dataPane = (
    <>
      <p className="pane__title">문제 고르기</p>
      <SettingRow
        label="문제"
        help="교과서 28쪽의 8퍼즐입니다. 빈칸으로 숫자 타일을 한 칸씩 움직여 원하는 위치로 배치하는 퍼즐입니다."
      >
        <div className="note" style={{ marginTop: 0 }}>
          8퍼즐 (교과서 28쪽)
        </div>
      </SettingRow>

      <SettingRow
        label="목표 상태"
        help="도달하고자 하는 상태입니다. 초기 상태는 어떤 상태에서도 시작할 수 있습니다."
      >
        <div style={{ textAlign: 'center' }}>
          <PuzzleBoard state={goal} size={112} label="목표" />
        </div>
        <button
          type="button"
          className="btn btn--wide btn--small"
          style={{ marginTop: 8 }}
          onClick={() => setGoal(board)}
        >
          지금 화면의 상태를 목표로
        </button>
        <button
          type="button"
          className="btn btn--wide btn--small"
          style={{ marginTop: 6 }}
          onClick={() => setGoal(PUZZLE_GOAL)}
        >
          기본값 복원
        </button>
      </SettingRow>

      <SettingRow
        label="휴리스틱값 h(n)"
        value={String(h)}
        help="목표 상태와 일치하지 않는 숫자 타일의 수입니다. 공백은 세지 않습니다."
      >
        <p className="muted" style={{ margin: 0 }}>
          목표와 다른 타일은 화면에서 다른 색으로 표시됩니다. 지금은 {h}개입니다.
        </p>
      </SettingRow>
    </>
  );

  const stage3 = stage === 3;

  const stageView = (
    <>
      <div className="stage">
        <span className="stage__mode">
          단계 {stage} · {stage === 1 ? '상태 정의' : stage === 2 ? '간선 정의' : '탐색 트리 구성'}
        </span>
        <div style={{ padding: '46px 16px 18px', textAlign: 'center' }}>
          <PuzzleBoard
            state={board}
            size={168}
            onTileClick={moveTile}
            goal={goal}
            markMismatch
            label="현재 상태 — 빈칸 옆의 타일을 눌러 옮겨 보세요"
          />

          {stage >= 2 && (
            <div style={{ marginTop: 18 }}>
              <p style={{ fontSize: 14, color: 'var(--ink2)', margin: '0 0 8px' }}>
                간선은 타일 8개의 이동이 아니라 <strong>빈칸이 움직이는 네 방향</strong>으로
                정의합니다.
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {DEFAULT_DIRECTION_ORDER.map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    className="btn btn--small"
                    onClick={() => applyDirection(dir)}
                    disabled={slide(board, dir) === null}
                  >
                    {DIRECTION_LABEL[dir]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {stage3 && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 14, color: 'var(--ink2)', margin: '0 0 10px' }}>
                이 상태에서 만들어질 수 있는 자식 상태는 {children.length}개입니다. 눌러서 한 층
                내려가 보세요.
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                }}
              >
                {children.map((c) => (
                  <button
                    key={c.dir}
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onClick={() => {
                      setBoard(c.state);
                      setExpanded([...new Set([...expanded, c.state.join('')])]);
                    }}
                  >
                    <PuzzleBoard
                      state={c.state}
                      size={96}
                      goal={goal}
                      markMismatch
                      label={DIRECTION_LABEL[c.dir]}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="stage-summary">
        <div className="stage-summary__step">
          {reached ? (
            <>
              <strong>목표 상태에 도달했습니다.</strong> 초기 상태에서 간선을 따라 이동하다가 목표
              상태에 도달하면 경로가 구해지므로 문제가 해결된 것입니다.
            </>
          ) : (
            <>
              지금 상태에서 목표와 다른 타일은 <strong>{h}개</strong>입니다. 자식 상태는{' '}
              <strong>{children.length}개</strong> 만들 수 있습니다.
            </>
          )}
        </div>
        <div className="stage-summary__stat">
          지금까지 만들어 본 서로 다른 상태 {expanded.length}개
        </div>
      </div>
    </>
  );

  const settingsPane = (
    <>
      <p className="pane__title">단계</p>
      <SettingRow
        label="문제 표현 과정"
        help="교과서 28쪽의 안내입니다. 상태를 정하고, 간선을 정의하고, 탐색 트리를 구성합니다."
      >
        <div style={{ display: 'grid', gap: 6 }}>
          {([1, 2, 3] as Stage[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`btn btn--wide${stage === s ? ' btn--primary' : ''}`}
              onClick={() => setStage(s)}
            >
              단계 {s} ·{' '}
              {s === 1 ? '상태 정의' : s === 2 ? '간선 정의' : '탐색 트리 구성'}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow
        label="상태"
        help="문제의 어느 한 순간의 모습을 말합니다. 8퍼즐에서는 숫자 타일이 놓인 모양 하나가 상태입니다."
      >
        <p className="muted" style={{ margin: 0 }}>
          현재 상태: <code>{board.join('')}</code> (0이 빈칸)
        </p>
      </SettingRow>

      <SettingRow
        label="간선"
        help="한 상태에서 다음 상태로 가기 위한 행동입니다. 8퍼즐에서는 빈칸을 위·아래·왼쪽·오른쪽으로 옮기는 네 가지입니다."
      >
        <p className="muted" style={{ margin: 0 }}>
          지금 가능한 행동 {children.length}가지
        </p>
      </SettingRow>

      <div style={{ marginTop: 10 }}>
        <button
          type="button"
          className="btn btn--wide"
          onClick={() => {
            setBoard(PUZZLE_START);
            setStage(1);
          }}
        >
          처음으로
        </button>
      </div>
    </>
  );

  const below = (
    <>
      {teacherMode && (
        <TeacherPanel
          note={TEACHER_NOTES['problem-tree']}
          extra={[SEARCH_LAB_COMMON.order]}
        />
      )}
      <InquiryPanel
        mode={mode}
        hasRun={expanded.length > 0}
        spec={{
          id: 'problem-tree',
          predictQuestion:
            '한 상태에서 만들어지는 자식 상태는 항상 4개일까요?',
          predictChoices: ['항상 4개다', '4개보다 적을 때가 있다', '4개보다 많을 때가 있다'],
          observeQuestion:
            '빈칸을 여러 위치로 옮겨 보면서, 자식 상태의 개수가 언제 달라지는지 적어 보세요.',
          explainQuestion:
            '자식 상태의 개수가 달라지는 이유는 무엇인가요?',
          questions: [
            '타일 8개를 각각 옮기는 것으로도 간선을 정의할 수 있는데, 교과서는 왜 빈칸의 이동으로 정의했을까? (29쪽)',
            '깊이 3까지만 펼쳐도 상태가 몇 개나 되는가? 이것이 34쪽의 9! = 362,880과 어떻게 연결되는가?',
            '초기 상태를 다른 모양으로 바꾸면 목표까지 가는 경로의 길이도 달라질까?',
          ],
          finding:
            '문제를 탐색으로 풀려면 먼저 상태와 간선을 정하고 트리로 표현해야 한다. ' +
            '같은 문제라도 간선을 어떻게 정의하느냐에 따라 만들어지는 트리의 모양이 달라진다. ' +
            '빈칸의 이동으로 정의하면 타일마다 정의할 때보다 간선의 종류가 훨씬 줄어든다.',
        }}
      />
    </>
  );

  return (
    <ExperimentFrame
      title="문제를 트리로 표현하기"
      textbook="Ⅰ-02 · 27~29쪽"
      mode={mode}
      onModeChange={onModeChange}
      dataPane={dataPane}
      stage={stageView}
      settingsPane={settingsPane}
      below={below}
    />
  );
}
