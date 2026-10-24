import { useEffect, useRef, useState } from 'react';
import { ApprovedChrome } from './approved/Chrome';
import { ApprovedHome } from './approved/Home';
import { ApprovedRegistration } from './approved/Registration';
import { ApprovedInstructions } from './approved/Instructions';
import { ApprovedGame } from './approved/Game';
import { ApprovedResults } from './approved/Results';
import { createResult, DEFAULT_SETTINGS, makeAnswer, parseQuestionBank, validatePlayer } from './core';
import type { Answer, Player, Question, Result } from './core';
import { loadQuestionBank } from './platform';
import TouchKeyboard from './keyboard/TouchKeyboard';
import { StageTransition } from './presentation/StageTransition';
import { soundEffects, useAppAudio } from './presentation/audio';
import { AudioControls } from './presentation/AudioControls';
import './review.css';

const steps = [
  {id:'leaderboard',label:'Leaderboard',node:'4064:533'},
  {id:'registration',label:'Agent registration',node:'4064:723'},
  {id:'instructions',label:'How to play',node:'4064:598'},
  {id:'game',label:'Find the real image',node:'4064:639'},
  {id:'results',label:'Results',node:'4064:1501'},
] as const;
type Feedback = 'waiting' | 'correct' | 'incorrect' | 'timeout';
const settings = {...DEFAULT_SETTINGS};
const previewNames = ['Aisha Khan','Jordan Lee','Maya Chen','Omar Ali','Alex Rivera'];
const previewCorrect = [3,3,2,2,1];
const previewTimes = [18000,23000,19000,28000,24000];
function sampleResult(name:string,correct:number,time:number):Result {
  const answers:Answer[] = Array.from({length:10},(_,i)=>({questionId:`preview-${i}`,selected:i<correct?'real':'ai',correct:i<correct,elapsedMs:i<correct?Math.floor(time/correct)+(i<time%correct?1:0):0,points:0}));
  return createResult({name,email:'preview@example.com'},answers,settings,false);
}
const sampleRows = previewNames.map((name,i)=>sampleResult(name,previewCorrect[i],previewTimes[i]));

export default function Review() {
  useAppAudio();
  const [step,setStep] = useState(()=>Math.max(0,steps.findIndex(s=>s.id===location.hash.slice(1))));
  const [bank,setBank] = useState<Question[]>([]);
  const [error,setError] = useState('');
  const [pair,setPair] = useState(0);
  const [player,setPlayer] = useState<Player>({name:'',email:''});
  const [attempted,setAttempted] = useState(false);
  const [keyboardField,setKeyboardField] = useState<keyof Player | null>(null);
  const [feedback,setFeedback] = useState<Feedback>('waiting');
  const [realFirst,setRealFirst] = useState(true);
  const [animate,setAnimate] = useState(false);
  const [scale,setScale] = useState(.2);
  const [replay,setReplay] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const question = bank[pair];
  const name = player.name.trim() || 'Jordan Lee';
  const result = sampleResult(name,3,23000);
  const response = question && feedback!=='waiting' ? makeAnswer(question,feedback==='timeout'?null:feedback==='correct'?'real':'ai',feedback==='timeout'?30000:7000,settings) : null;
  const sceneKey = `${steps[step].id}-${step===3?pair:0}-${replay}`;
  const previousScene = useRef(sceneKey);
  useEffect(()=>{if(previousScene.current===sceneKey)return;previousScene.current=sceneKey;if(step===4)soundEffects.complete();else soundEffects.transition();},[sceneKey,step]);
  function showFeedback(value:Feedback){setFeedback(value);if(value==='correct')soundEffects.correct();else if(value==='incorrect')soundEffects.incorrect();else if(value==='timeout')soundEffects.timeout();}
  function selectScreen(index:number) {const next=Math.max(0,Math.min(steps.length-1,index));setStep(next);setKeyboardField(null);history.replaceState(null,'',`?review=1#${steps[next].id}`);}
  useEffect(()=>{let stopped=false;loadQuestionBank().then(value=>{const parsed=parseQuestionBank(value);if(!stopped)setBank(parsed.questions);}).catch(e=>{if(!stopped)setError(e instanceof Error?e.message:'The image bank could not be loaded.');});return()=>{stopped=true;};},[]);
  useEffect(()=>{if(!host.current)return;const observer=new ResizeObserver(([entry])=>setScale(Math.max(.02,Math.min((entry.contentRect.width-32)/2160,(entry.contentRect.height-32)/3840))));observer.observe(host.current);return()=>observer.disconnect();},[]);
  useEffect(()=>{const handler=(event:KeyboardEvent)=>{if((event.target as HTMLElement)?.closest('input,textarea,select'))return;if(event.key==='ArrowRight'){event.preventDefault();selectScreen(step+1);}if(event.key==='ArrowLeft'){event.preventDefault();selectScreen(step-1);}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[step]);
  function closeKeyboard(){setKeyboardField(null);(document.activeElement as HTMLElement | null)?.blur();}
  function keyboardKey(key:string){if(!keyboardField)return;setPlayer(previous=>({...previous,[keyboardField]:key==='BACKSPACE'?previous[keyboardField].slice(0,-1):(previous[keyboardField]+key).slice(0,keyboardField==='name'?60:254)}));}
  function showKeyboard(field:keyof Player){setKeyboardField(field);document.getElementById(`approved-player-${field}`)?.focus();}
  function register(){setAttempted(true);const errors=validatePlayer(player);if(!errors.name&&!errors.email)selectScreen(2);}
  return <div className="flow-review">
    <aside className="review-controls">
      <div className="review-brand">AI or Real</div><h1>Full flow review</h1><p className="review-intro">Select a screen and compare it with the approved Figma frame.</p>
      <nav aria-label="Flow screens">{steps.map((item,i)=><button key={item.id} aria-current={i===step?'step':undefined} onClick={()=>selectScreen(i)}><span>{String(i+1).padStart(2,'0')}</span>{item.label}</button>)}</nav>
      <div className="review-options">
        {step===1&&<><h2>Registration state</h2><div className="review-choice-buttons"><button onClick={()=>{closeKeyboard();setPlayer({name:'',email:''});setAttempted(false);}}>Empty</button><button onClick={()=>{closeKeyboard();setPlayer({name:'Jordan Lee',email:'jordan.lee@example.com'});setAttempted(false);}}>Filled</button><button onClick={()=>{closeKeyboard();setPlayer({name:'J',email:'invalid-email'});setAttempted(true);}}>Validation</button><button onClick={()=>showKeyboard('name')}>Name keyboard</button><button onClick={()=>showKeyboard('email')}>Email keyboard</button></div></>}
        {step===3&&<><h2>Game state</h2><label>Image pair<select value={pair} onChange={e=>{setPair(Number(e.target.value));setFeedback('waiting');}}>{bank.map((q,i)=><option value={i} key={q.id}>{String(i+1).padStart(2,'0')} · {q.title}</option>)}</select></label><label>Feedback<select value={feedback} onChange={e=>showFeedback(e.target.value as Feedback)}><option value="waiting">Waiting for a choice</option><option value="correct">Correct answer · green</option><option value="incorrect">Incorrect answer · red</option><option value="timeout">Time ran out</option></select></label><label className="review-checkbox"><input type="checkbox" checked={realFirst} onChange={e=>setRealFirst(e.target.checked)}/>Real photograph at top</label><label className="review-checkbox"><input type="checkbox" checked={animate} onChange={e=>setAnimate(e.target.checked)}/>Animate feedback</label><p className="review-note">You can also tap an image to inspect its feedback.</p></>}
        <div className="review-choice-buttons"><button onClick={()=>setReplay(value=>value+1)}>Replay entrance</button></div>
      </div>
      <AudioControls compact/>
      <div className="review-links"><a href={`https://www.figma.com/design/aXSIhrFP89npxkNOq8gOqB/AI-or-Real---UI-Flow?node-id=${steps[step].node.replace(':','-')}`} target="_blank" rel="noreferrer">Open approved Figma frame ↗</a>{!window.kiosk&&<a href="./" target="_blank" rel="noreferrer">Open playable AI or Real ↗</a>}</div>
      <div className="review-bottom"><p>2160 × 3840 portrait canvas<br/>Sample data · timers paused<br/>Review actions don’t save results.</p><div className="review-paging"><button disabled={step===0} onClick={()=>selectScreen(step-1)}>← Previous</button><button disabled={step===steps.length-1} onClick={()=>selectScreen(step+1)}>Next →</button></div><small>Use ← and → to move between screens.</small></div>
    </aside>
    <section className="review-canvas-host" ref={host} aria-label={`AI or Real preview: ${steps[step].label}`}>
      {error?<div className="review-load-error">{error}</div>:!bank.length?<div className="review-load-error">Loading AI or Real…</div>:<div className={`approved-stage ${animate?'':'review-hold-feedback'}`} style={{transform:`scale(${scale})`}}>
        <ApprovedChrome panel={step!==3&&step!==4} sceneKey={sceneKey}/>
        <StageTransition sceneKey={sceneKey}>
        {step===0&&<ApprovedHome rows={sampleRows} onStart={()=>selectScreen(1)}/>}
        {step===1&&<ApprovedRegistration player={player} onChange={setPlayer} onContinue={register} errors={validatePlayer(player)} attempted={attempted} onFocusField={setKeyboardField} keyboardOpen={!!keyboardField}/>}
        {step===2&&<ApprovedInstructions onNext={()=>selectScreen(3)} questionsPerRound={10} timeLimit={30}/>}
        {step===3&&question&&<ApprovedGame question={question} realFirst={realFirst} index={0} count={10} playerName={name} elapsedMs={feedback==='timeout'?30000:feedback==='waiting'?0:7000} correctCount={feedback==='correct'?1:0} score={response?.points||0} feedback={response||null} ready={feedback==='waiting'} imageError="" onAnswer={choice=>showFeedback(choice==='real'?'correct':'incorrect')} onRetry={()=>{}} onExit={()=>selectScreen(0)}/>}
        {step===4&&<ApprovedResults result={result} saved={true} saving={false} saveError="" onRetry={()=>{}} onHome={()=>selectScreen(0)} autoBack={30}/>}
        </StageTransition>
        {step===1&&keyboardField&&<TouchKeyboard field={keyboardField} onKey={keyboardKey} onClose={closeKeyboard}/>}
      </div>}
    </section>
  </div>;
}
