import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Download, LoaderCircle, X, Settings2 } from 'lucide-react';
import { createRound, createResult, DEFAULT_SETTINGS, exportResultsCsv, formatTime, makeAnswer, normalizeSettings, rankResults, validatePlayer, parseQuestionBank } from './core';
import type { Answer, GameSettings, ImageAnswer, Player, Question, Result } from './core';
import * as platform from './platform';
import { ApprovedChrome } from './approved/Chrome';
import { ApprovedHome } from './approved/Home';
import { ApprovedRegistration } from './approved/Registration';
import { ApprovedInstructions } from './approved/Instructions';
import { ApprovedGame } from './approved/Game';
import { ApprovedResults } from './approved/Results';
import TouchKeyboard from './keyboard/TouchKeyboard';
import { StageTransition, getSceneTransitionDelay } from './presentation/StageTransition';
import { soundEffects, useAppAudio } from './presentation/audio';
import { AudioControls } from './presentation/AudioControls';

type Screen = 'home' | 'register' | 'instructions' | 'game' | 'results';
const emptyPlayer = { name: '', email: '' };
const msg = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please contact the operator.';
function App() {
  useAppAudio();
  const [scale, setScale] = useState(1);
  const [screen, setScreen] = useState<Screen>('home');
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS });
  const [roundSettings, setRoundSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS });
  const [bank, setBank] = useState<Question[]>([]);
  const [demo, setDemo] = useState(true);
  const [results, setResults] = useState<Result[]>([]);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [notice, setNotice] = useState('');
  const [player, setPlayer] = useState<Player>(emptyPlayer);
  const [attempted, setAttempted] = useState(false);
  const [keyboardField, setKeyboardField] = useState<keyof Player | null>(null);
  const [round, setRound] = useState<Question[]>([]);
  const [realFirst, setRealFirst] = useState<boolean[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [feedback, setFeedback] = useState<Answer | null>(null);
  const [ready, setReady] = useState(false);
  const [imageError, setImageError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [remaining, setRemaining] = useState(30_000);
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [autoBack, setAutoBack] = useState(30);
  const [admin, setAdmin] = useState(false);
  const started = useRef(0);
  const answerLock = useRef(true);
  const inactivityEnabled = ['register', 'instructions', 'game'].includes(screen) && !admin;
  const screenRef = useRef(screen); screenRef.current = screen;
  const viewport = useRef<HTMLDivElement>(null);
  const current = round[index];
  const ranked = rankResults(results.filter(r => r.isDemo === demo && sameCompetition(r.settings, settings)));
  const errors = validatePlayer(player);
  const sceneKey = screen === 'game' ? `game-${index}` : screen;
  const previousScene = useRef(sceneKey);

  useEffect(() => {
    if (previousScene.current === sceneKey) return;
    previousScene.current = sceneKey;
    if (screen === 'results') soundEffects.complete();
    else soundEffects.transition();
  }, [sceneKey, screen]);

  useEffect(() => {
    const resize = () => setScale(Math.min(window.innerWidth / 2160, window.innerHeight / 3840));
    resize(); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);

  const boot = useCallback(async () => {
    setBooting(true); setBootError('');
    try {
      const [state, rawBank] = await Promise.all([platform.loadStore(), platform.loadQuestionBank()]);
      const parsed = parseQuestionBank(rawBank);
      setSettings(state.settings); setResults(state.results); setNotice(state.warning || '');
      setBank(parsed.questions); setDemo(parsed.mode === 'demo');
    } catch (error) { setBootError(msg(error)); }
    finally { setBooting(false); }
  }, []);
  useEffect(() => { void boot(); }, [boot]);

  const reset = useCallback(() => {
    answerLock.current = true; setScreen('home'); setPlayer(emptyPlayer); setAttempted(false);
    setKeyboardField(null); setRound([]); setAnswers([]); setIndex(0); setFeedback(null); setResult(null);
    setReady(false); setImageError(''); setSaveError(''); setSaved(false); 
  }, []);

  useEffect(() => platform.onAdminRequested(() => {
    if (screenRef.current === 'home') setAdmin(value => !value);
  }), []);

  useEffect(() => {
    if (!inactivityEnabled) return;
    const timeoutMs = settings.idleTimeoutSeconds * 1000;
    let lastActivity = Date.now();
    let timer: number;
    const check = () => {
      window.clearTimeout(timer);
      const remaining = timeoutMs - (Date.now() - lastActivity);
      if (remaining <= 0) reset();
      else timer = window.setTimeout(check, remaining);
    };
    const activity = () => { lastActivity = Date.now(); check(); };
    const visibility = () => { if (document.visibilityState === 'visible') check(); };
    check();
    window.addEventListener('pointerdown', activity, true);
    window.addEventListener('keydown', activity, true);
    window.addEventListener('input', activity, true);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', activity, true);
      window.removeEventListener('keydown', activity, true);
      window.removeEventListener('input', activity, true);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [inactivityEnabled, settings.idleTimeoutSeconds, reset]);

  useEffect(() => {
    if (screen !== 'game' || !current) return;
    let cancelled = false;
    setReady(false); setFeedback(null); setImageError(''); answerLock.current = true;
    setRemaining(roundSettings.questionTimeLimitSeconds * 1000);
    let entranceTimer: number | undefined;
    const entrance = new Promise<void>(resolve => { entranceTimer = window.setTimeout(resolve, getSceneTransitionDelay()); });
    const load = (url: string) => new Promise<void>((resolve, reject) => {
      const image = new Image(); const timeout = window.setTimeout(() => { image.src = ''; reject(new Error('Image loading timed out.')); }, 15000);
      image.onload = () => { window.clearTimeout(timeout); image.decode().then(resolve, reject); };
      image.onerror = () => { window.clearTimeout(timeout); reject(new Error('An image could not be loaded. Please retry or ask the operator to check the image bank.')); };
      image.src = url;
    });
    Promise.all([load(current.image), load(current.decoyImage!), entrance]).then(() => {
      if (cancelled) return;
      started.current = performance.now(); setRemaining(roundSettings.questionTimeLimitSeconds * 1000); answerLock.current = false; setReady(true);
    }).catch(error => { if (!cancelled) setImageError(msg(error)); });
    return () => { cancelled = true; window.clearTimeout(entranceTimer); answerLock.current = true; };
  }, [screen, current, roundSettings.questionTimeLimitSeconds, loadAttempt]);

  const answer = useCallback((selected: ImageAnswer | null) => {
    if (answerLock.current || !current || screen !== 'game') return;
    answerLock.current = true;
    const elapsed = selected === null ? roundSettings.questionTimeLimitSeconds * 1000 : performance.now() - started.current;
    const next = makeAnswer(current, selected, elapsed, roundSettings);
    if (selected === null) soundEffects.timeout();
    else if (next.correct) soundEffects.correct();
    else soundEffects.incorrect();
    setFeedback(next); setAnswers(previous => [...previous, next]); setReady(false);
  }, [current, screen, roundSettings]);

  useEffect(() => {
    if (!ready || screen !== 'game') return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, roundSettings.questionTimeLimitSeconds * 1000 - (performance.now() - started.current));
      setRemaining(left); if (left <= 0) answer(null);
    }, 40);
    const visibility = () => { if (document.visibilityState === 'visible' && performance.now() - started.current >= roundSettings.questionTimeLimitSeconds * 1000) answer(null); };
    document.addEventListener('visibilitychange', visibility);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [ready, screen, roundSettings.questionTimeLimitSeconds, answer]);

  const persistResult = useCallback(async (value: Result) => {
    setSaving(true); setSaveError('');
    try { await platform.saveResult(value); setResults(previous => [...previous.filter(r => r.id !== value.id), value]); setSaved(true); }
    catch (error) { setSaveError(msg(error)); setSaved(false); }
    finally { setSaving(false); }
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => {
      if (index + 1 < round.length) { setFeedback(null); setIndex(i => i + 1); }
      else {
        const final = createResult(player, answers, roundSettings, demo);
        setResult(final);  setScreen('results'); setAutoBack(roundSettings.resultsTimeoutSeconds); void persistResult(final);
      }
    }, roundSettings.feedbackDurationMs);
    return () => clearTimeout(timer);
  }, [feedback, index, round.length, player, answers, roundSettings, demo, persistResult]);

  useEffect(() => {
    if (screen !== 'results' || !saved) return;
    const timer = window.setInterval(() => setAutoBack(seconds => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [screen, saved]);
  useEffect(() => { if (screen === 'results' && saved && autoBack === 0) reset(); }, [autoBack, screen, saved, reset]);

  function register() {
    setAttempted(true);
    if (errors.name || errors.email) return;
    setPlayer({name:player.name.trim(),email:player.email.trim().toLowerCase()}); setKeyboardField(null); setScreen('instructions');
  }
  function startRound() {
    try {
      const selected = createRound(bank, settings.questionsPerRound);
      setRoundSettings({ ...settings }); setRound(selected); setRealFirst(selected.map(() => Math.random() < 0.5));
      setIndex(0); setAnswers([]); setFeedback(null); setResult(null); setSaved(false); setScreen('game');
    } catch (error) { setNotice(msg(error)); }
  }
  function keyPress(key: string) {
    if (!keyboardField) return;
    setPlayer(previous => ({...previous, [keyboardField]: key === 'BACKSPACE' ? previous[keyboardField].slice(0,-1) : (previous[keyboardField] + key).slice(0, keyboardField === 'name' ? 60 : 254)}));
  }

  return <div className="viewport" ref={viewport}>
    <div className="approved-stage" style={{ transform:`scale(${scale})` }}>
      <ApprovedChrome panel={screen!=='game'&&screen!=='results'} sceneKey={sceneKey}/>
      {booting ? <main className="approved-error"><LoaderCircle className="spin" size={90}/><p>Loading…</p></main> : bootError ? <main className="approved-error"><h1>Operator attention needed</h1><p>{bootError}</p><button className="primary" onClick={()=>void boot()}>Try again</button></main> : <>
        <StageTransition sceneKey={sceneKey}>
        {screen==='home'&&<ApprovedHome rows={ranked.slice(0,5)} onStart={()=>setScreen('register')}/>}
        {screen==='register'&&<ApprovedRegistration player={player} onChange={setPlayer} onContinue={register} errors={errors} attempted={attempted} onFocusField={setKeyboardField} keyboardOpen={!!keyboardField}/>}
        {screen==='instructions'&&<ApprovedInstructions onNext={startRound} questionsPerRound={settings.questionsPerRound} timeLimit={settings.questionTimeLimitSeconds}/>}
        {screen==='game'&&current&&<ApprovedGame question={current} realFirst={realFirst[index]} index={index} count={round.length} playerName={player.name} elapsedMs={roundSettings.questionTimeLimitSeconds*1000-remaining} correctCount={answers.filter(a=>a.correct).length} score={answers.reduce((sum,a)=>sum+a.points,0)} feedback={feedback} ready={ready} imageError={imageError} onAnswer={answer} onRetry={()=>setLoadAttempt(a=>a+1)} onExit={reset}/>}
        {screen==='results'&&result&&<ApprovedResults result={result} saved={saved} saving={saving} saveError={saveError} onRetry={()=>void persistResult(result)} onHome={reset} autoBack={autoBack}/>}
        </StageTransition>
        {screen==='register'&&keyboardField&&<TouchKeyboard field={keyboardField} onKey={keyPress} onClose={()=>{setKeyboardField(null);(document.activeElement as HTMLElement | null)?.blur();}}/>}
        {screen==='home'&&notice&&<p className="approved-notice" role="status">{notice}</p>}
      </>}

      {admin&&<Admin settings={settings} results={results} bankSize={bank.length} demo={demo} onClose={()=>setAdmin(false)} onSaved={next=>setSettings(next)} onCleared={()=>setResults([])} onReload={boot}/>}
    </div>
  </div>;
}

function sameCompetition(a:GameSettings,b:GameSettings) {return a.questionsPerRound===b.questionsPerRound&&a.baseCorrectPoints===b.baseCorrectPoints&&a.maxSpeedBonus===b.maxSpeedBonus&&a.questionTimeLimitSeconds===b.questionTimeLimitSeconds;}

function Admin({settings,results,bankSize,demo,onClose,onSaved,onCleared,onReload}:{settings:GameSettings;results:Result[];bankSize:number;demo:boolean;onClose:()=>void;onSaved:(settings:GameSettings)=>void;onCleared:()=>void;onReload:()=>Promise<void>}) {
 const [draft,setDraft]=useState(settings); const [message,setMessage]=useState(''); const [busy,setBusy]=useState(false); const [confirm,setConfirm]=useState(false);
 const fields:[keyof GameSettings,string,number,number][]=[['questionsPerRound','Questions per game',1,Math.min(50,bankSize)],['questionTimeLimitSeconds','Seconds per question',5,120],['baseCorrectPoints','Points per correct answer',100,100000],['maxSpeedBonus','Maximum speed bonus',0,Math.floor(draft.baseCorrectPoints/(draft.questionsPerRound+1))],['feedbackDurationMs','Answer reveal (milliseconds)',500,10000],['idleTimeoutSeconds','Inactivity reset (seconds)',30,900],['resultsTimeoutSeconds','Results display (seconds)',5,300]];
 async function run(action:()=>Promise<void>) {setBusy(true);setMessage('');try{await action();}catch(error){setMessage(msg(error));}finally{setBusy(false);}}
 return <div className="admin-backdrop"><section className="admin-panel"><div className="admin-title"><div><Settings2 size={24}/><h2>Operator settings</h2></div><button className="icon-button" aria-label="Close settings" onClick={onClose}><X/></button></div><p className="admin-info">{bankSize} question pairs · {demo?'Demo bank':'Production bank'} · {results.length} saved results</p><div className="admin-fields">{fields.map(([key,label,min,max])=><label key={key}>{label}<input type="number" min={min} max={max} value={draft[key]} onChange={e=>setDraft({...draft,[key]:Number(e.target.value)})}/></label>)}</div><div className="scoring-formula">Correct = base + round(bonus × (1 − seconds / time limit))<br/>Wrong or timed out = 0. Speed bonus is capped so accuracy always wins.<br/>Changing scoring starts a separate leaderboard; exports include all results.</div><AudioControls/><button className="primary" disabled={busy} onClick={()=>void run(async()=>{const value=normalizeSettings(draft);await platform.saveSettings(value);setDraft(value);onSaved(value);setMessage('Settings saved.');})}>Save settings <Check size={20}/></button><div className="admin-actions"><button className="secondary" disabled={busy} onClick={()=>void run(async()=>{const done=await platform.exportResults(exportResultsCsv(results));setMessage(done?'Results exported.':'Export cancelled.');})}><Download size={18}/> Export all results</button><button className="secondary" disabled={busy} onClick={()=>void run(async()=>{await onReload();setMessage('Image bank reloaded.');})}>Reload image bank</button><button className="secondary" disabled={busy} onClick={()=>void run(()=>platform.setFullscreen(false))}>Exit fullscreen</button><button className="danger-text" disabled={busy} onClick={()=>setConfirm(true)}>Clear leaderboard…</button></div>{confirm&&<div className="clear-confirm"><p>Clear all {results.length} results from the device? Export them first if you need a copy.</p><button disabled={busy} className="secondary" onClick={()=>void run(async()=>{await platform.clearResults();onCleared();setConfirm(false);setMessage('Leaderboard cleared.');})}>Yes, clear results</button><button className="text-button" onClick={()=>setConfirm(false)}>Cancel</button></div>}{message&&<p className="admin-message" role="status">{message}</p>}<p className="admin-shortcuts">Ctrl + Shift + A: settings · F11: fullscreen · Ctrl + Shift + Q: quit<br/>Close settings to begin a game. Emails are available only in exported results.</p></section></div>;
}
export default App;
