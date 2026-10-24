import type { Result } from '../core';
import { ApprovedButton } from './Chrome';
import './results.css';

export interface ResultsProps {
  result: Result;
  saved: boolean;
  saving: boolean;
  saveError: string;
  onRetry: () => void;
  onHome: () => void;
  autoBack: number;
}

function totalTime(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function ApprovedResults({ result, saved, saving, saveError, onRetry, onHome }: ResultsProps) {
  return <div className="approved-results" data-node-id="4064:1501">
    <div className="approved-results-panel" aria-hidden="true" data-node-id="4064:1508">
      <div className="approved-results-panel-art"><img src="approved/game/results-panel.svg" alt="" /></div>
      <div className="approved-results-panel-bloom" />
      <div className="approved-results-panel-halo" />
      <div className="approved-results-panel-diffusion" />
      <div className="approved-results-panel-inner" />
      <div className="approved-results-panel-outer" />
    </div>
    <p className="approved-results-thanks">Thank you!</p>
    <p className="approved-results-game">Find the Real Image</p>
    <p className="approved-results-complete">COMPLETE</p>
    <p className="approved-results-count">{result.correctCount} / {result.answers.length}</p>
    <p className="approved-results-score-label">YOUR SCORE</p>
    <p className="approved-results-time">Total time: {totalTime(result.totalTimeMs)}</p>
    <p className="approved-results-player">{result.player.name}</p>
    <ApprovedButton label="Finish" left={640} top={2645} onClick={onHome} disabled={!saved || saving} />
    {saveError && <div className="approved-results-save-error" role="alert"><p>{saveError}</p><button type="button" onClick={onRetry}>Retry saving</button></div>}
  </div>;
}

export default ApprovedResults;
