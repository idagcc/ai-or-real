import type { Player, PlayerValidation } from '../core';
import { ApprovedButton } from './Chrome';
import './forms.css';

export interface RegistrationProps {
  player: Player;
  onChange: (player: Player) => void;
  onContinue: () => void;
  errors: PlayerValidation;
  attempted: boolean;
  onFocusField: (field: 'name' | 'email') => void;
  keyboardOpen: boolean;
}

const fieldLayers: [string, number, number][] = [
  ['field-blue-halo.svg', 0.657, 0.656],
  ['field-cyan-bloom.svg', 5.907, 5.908],
  ['field-outer.svg', 9.107, 9.105],
  ['field-inner.svg', 16.991, 16.991],
  ['field-lower-rail.svg', 35.56, 213.103],
  ['field-right-glow.svg', 1445.871, 45.253],
  ['field-right-line.svg', 1449.753, 48.45],
];

function RegistrationField({ top, field, player, onChange, onFocus, invalid }: {
  top: number;
  field: 'name' | 'email';
  player: Player;
  onChange: (player: Player) => void;
  onFocus: () => void;
  invalid: boolean;
}) {
  return <div className="approved-registration-field" style={{ top }}>
    <div className="approved-registration-field-art" aria-hidden="true">
      {fieldLayers.map(([name, left, layerTop]) => <img key={name} alt="" src={`approved/forms/${name}`} style={{ left, top: layerTop }} />)}
    </div>
    <input id={`approved-player-${field}`} name={field} type={field === 'email' ? 'email' : 'text'}
      inputMode="none" autoComplete="off" autoCapitalize={field === 'email' ? 'none' : 'words'}
      spellCheck={false} maxLength={field === 'email' ? 254 : 60} value={player[field]}
      placeholder={field === 'name' ? 'Enter your name' : 'Enter your email'} aria-invalid={invalid}
      aria-describedby={invalid ? `approved-${field}-error` : undefined}
      onFocus={onFocus} onChange={event => onChange({ ...player, [field]: event.target.value })} />
  </div>;
}

export function Registration({ player, onChange, onContinue, errors, attempted, onFocusField }: RegistrationProps) {
  const blank = !player.name.trim() || !player.email.trim();
  return <form className="approved-registration" noValidate onSubmit={event => { event.preventDefault(); onContinue(); }} data-node-id="4064:723">
    <p className="approved-registration-player">AGENT</p>
    <p className="approved-registration-title">REGISTRATION</p>
    <p className="approved-registration-intro approved-registration-intro-first">Enter your name and email</p>
    <p className="approved-registration-intro approved-registration-intro-second">to play Find the Real Image.</p>
    <label className="approved-registration-name-label" htmlFor="approved-player-name">Name</label>
    <RegistrationField top={1605} field="name" player={player} onChange={onChange} onFocus={() => onFocusField('name')} invalid={attempted && !!errors.name} />
    {attempted && errors.name && <p id="approved-name-error" className="approved-registration-validation approved-registration-name-error" role="alert">{errors.name}</p>}
    <label className="approved-registration-email-label" htmlFor="approved-player-email">Email</label>
    <RegistrationField top={2155} field="email" player={player} onChange={onChange} onFocus={() => onFocusField('email')} invalid={attempted && !!errors.email} />
    {attempted && errors.email && <p id="approved-email-error" className="approved-registration-validation approved-registration-email-error" role="alert">{errors.email}</p>}
    {!errors.email && errors.suggestion && <button className="approved-registration-email-suggestion" type="button" onClick={() => onChange({ ...player, email: errors.suggestion! })}>Did you mean {errors.suggestion}?</button>}
    <p className="approved-registration-ready">Ready to spot the real image?</p>
    <p className="approved-registration-continue">Register to continue to the instructions.</p>
    <ApprovedButton label="Register" left={640} top={3000} type="submit" style={blank ? { opacity: .65 } : undefined} />
  </form>;
}

export default Registration;
export { Registration as ApprovedRegistration };
