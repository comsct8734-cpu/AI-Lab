import { useState, type ReactNode } from 'react';

/**
 * 공통 컨트롤 — 설계서 1-4, 1-5
 * 도움말은 눌러야만 열린다. 마우스를 올려야 보이는 정보는 만들지 않는다(아이패드 대응).
 */

interface SettingRowProps {
  label: string;
  value?: ReactNode;
  help?: string;
  children: ReactNode;
}

export function SettingRow({ label, value, help, children }: SettingRowProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="setting">
      <div className="setting__head">
        <span className="setting__label">{label}</span>
        {help && (
          <button
            type="button"
            className="help-btn"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${label} 설명 ${open ? '닫기' : '열기'}`}
          >
            ?
          </button>
        )}
        {value != null && <span className="setting__value">{value}</span>}
      </div>
      {open && help && <p className="help-body">{help}</p>}
      {children}
    </div>
  );
}

export type Speed = 'slow' | 'normal' | 'fast';

export const SPEED_MS: Record<Speed, number> = {
  slow: 1400,
  normal: 700,
  fast: 300,
};

interface StepControllerProps {
  onStep: () => void;
  onBack: () => void;
  onReset: () => void;
  onToggleAuto: () => void;
  auto: boolean;
  canStep: boolean;
  canBack: boolean;
  speed: Speed;
  onSpeedChange: (s: Speed) => void;
}

export function StepController({
  onStep,
  onBack,
  onReset,
  onToggleAuto,
  auto,
  canStep,
  canBack,
  speed,
  onSpeedChange,
}: StepControllerProps) {
  return (
    <div className="setting">
      <div className="setting__head">
        <span className="setting__label">실행</span>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <button
          type="button"
          className="btn btn--primary btn--wide"
          onClick={onStep}
          disabled={!canStep || auto}
        >
          한 단계 실행
        </button>
        <button type="button" className="btn btn--wide" onClick={onToggleAuto} disabled={!canStep && !auto}>
          {auto ? '자동 실행 멈추기' : '자동 실행'}
        </button>
        <div className="btn-row">
          <button type="button" className="btn" onClick={onBack} disabled={!canBack || auto}>
            한 단계 뒤로
          </button>
          <button type="button" className="btn" onClick={onReset}>
            처음으로
          </button>
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div className="setting__head">
          <span className="setting__label">속도</span>
        </div>
        <div className="segmented" role="group" aria-label="자동 실행 속도">
          {(['slow', 'normal', 'fast'] as Speed[]).map((s) => (
            <button
              key={s}
              type="button"
              className={speed === s ? 'is-on' : ''}
              onClick={() => onSpeedChange(s)}
              aria-pressed={speed === s}
            >
              {s === 'slow' ? '느림' : s === 'normal' ? '보통' : '빠름'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
