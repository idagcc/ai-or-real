import { ApprovedButton } from './Chrome';
import './forms.css';

export interface InstructionsProps {
  onNext: () => void;
  questionsPerRound: number;
  timeLimit: number;
}

export function Instructions({ onNext }: InstructionsProps) {
  return <div className="approved-instructions" data-node-id="4064:598">
    <h1>Find the Real Image</h1>
    <h2>HOW TO PLAY</h2>
    <p className="approved-instruction-number" style={{ top: 1244.16 }}>01</p>
    <p className="approved-instruction-heading" style={{ top: 1264.128 }}>FIND THE REAL IMAGE</p>
    <p className="approved-instruction-copy" style={{ top: 1401.984 }}>One image is real.</p>
    <p className="approved-instruction-copy" style={{ top: 1491.84 }}>The other is AI generated.</p>
    <p className="approved-instruction-number" style={{ top: 1623.936 }}>02</p>
    <p className="approved-instruction-heading" style={{ top: 1643.904 }}>TAP YOUR CHOICE</p>
    <p className="approved-instruction-copy" style={{ top: 1782.144 }}>Select the image you believe is real.</p>
    <p className="approved-instruction-number" style={{ top: 2004.096 }}>03</p>
    <p className="approved-instruction-heading" style={{ top: 2024.064 }}>WATCH THE FEEDBACK</p>
    <p className="approved-instruction-copy" style={{ top: 2161.92 }}>Green means correct.</p>
    <p className="approved-instruction-copy" style={{ top: 2252.16 }}>Red means incorrect.</p>
    <p className="approved-instruction-number" style={{ top: 2383.872 }}>04</p>
    <p className="approved-instruction-heading" style={{ top: 2403.84 }}>BE ACCURATE AND QUICK</p>
    <ApprovedButton label="Next" left={640} top={3000} onClick={onNext} />
  </div>;
}

export default Instructions;
export { Instructions as ApprovedInstructions };
