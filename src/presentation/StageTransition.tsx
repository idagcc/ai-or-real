import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import './motion.css';

export const SCENE_TRANSITION_MS = 650;

/** Keep question timers paused until the page has finished arriving. */
export function getSceneTransitionDelay(): number {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  return SCENE_TRANSITION_MS;
}

interface SceneSnapshot {
  key: string;
  children: ReactNode;
}

export interface StageTransitionProps {
  sceneKey: string;
  children: ReactNode;
}

/** The stage's continuously playing background belongs outside this component. */
export function StageTransition({ sceneKey, children }: StageTransitionProps) {
  const snapshotRef = useRef<SceneSnapshot | null>(null);
  const timerRef = useRef<number | null>(null);
  const generationRef = useRef(0);
  const [outgoing, setOutgoing] = useState<SceneSnapshot | null>(null);
  const [transitioning, setTransitioning] = useState(() => getSceneTransitionDelay() > 0);

  useLayoutEffect(() => {
    const generation = ++generationRef.current;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    const delay = getSceneTransitionDelay();
    const previous = snapshotRef.current;

    setOutgoing(delay > 0 && previous?.key !== sceneKey ? previous : null);
    setTransitioning(delay > 0);
    if (delay > 0) {
      timerRef.current = window.setTimeout(() => {
        if (generationRef.current !== generation) return;
        timerRef.current = null;
        setOutgoing(null);
        setTransitioning(false);
      }, delay);
    }
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [sceneKey]);

  // Capture current props on every render without restarting the scene's timer.
  // This follows the transition effect so a new scene can retain the old page.
  useLayoutEffect(() => {
    snapshotRef.current = { key: sceneKey, children };
  });

  useLayoutEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const settle = () => {
      if (!preference.matches) return;
      generationRef.current += 1;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      setOutgoing(null);
      setTransitioning(false);
    };
    preference.addEventListener('change', settle);
    return () => preference.removeEventListener('change', settle);
  }, []);

  return <div className="stage-transition" data-transitioning={transitioning ? 'true' : 'false'}>
    {outgoing && <div key={`outgoing:${outgoing.key}`} className="stage-transition__scene stage-transition__outgoing" inert aria-hidden="true">
      {outgoing.children}
    </div>}
    <div key={sceneKey} className={`stage-transition__scene stage-transition__current${transitioning ? ' stage-transition__arriving' : ''}`} inert={transitioning}>
      {children}
    </div>
    {transitioning && <div key={`sweep:${sceneKey}`} className="stage-transition__sweep" aria-hidden="true" />}
  </div>;
}

export default StageTransition;
