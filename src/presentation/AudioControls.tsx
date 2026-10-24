import { soundEffects, useAudioPreferences } from './audio';
import './audio-controls.css';
export function AudioControls({ compact = false }: { compact?: boolean }) {
  const [preferences, setPreferences] = useAudioPreferences();
  return <section className={`audio-controls${compact ? ' audio-controls-compact' : ''}`} aria-label="Audio settings">
    <label className="audio-enable"><input type="checkbox" checked={preferences.enabled} onChange={event => {setPreferences({ enabled: event.target.checked }); if(event.target.checked) void soundEffects.unlock();}}/><span>Enable audio</span></label>
    <label className="audio-volume"><span>Music volume <output>{Math.round(preferences.musicVolume * 100)}%</output></span><input aria-label="Music volume" type="range" min="0" max="100" step="1" value={Math.round(preferences.musicVolume * 100)} disabled={!preferences.enabled} onChange={event => setPreferences({ musicVolume: Number(event.target.value) / 100 })}/></label>
    <label className="audio-volume"><span>Effects volume <output>{Math.round(preferences.effectsVolume * 100)}%</output></span><input aria-label="Effects volume" type="range" min="0" max="100" step="1" value={Math.round(preferences.effectsVolume * 100)} disabled={!preferences.enabled} onChange={event => setPreferences({ effectsVolume: Number(event.target.value) / 100 })}/></label>
    <button className="audio-preview" type="button" disabled={!preferences.enabled} onClick={() => void soundEffects.unlock().then(() => soundEffects.correct())}>Preview sound</button>
  </section>;
}
export default AudioControls;
