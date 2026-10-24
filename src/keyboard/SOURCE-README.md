# Exact Catch the Phish touch keyboard

This kit contains the custom React/TypeScript keyboard used in Catch the Phish. The keyboard markup and interaction logic are copied from `TouchKeyboard` in `src/App.tsx`. Its CSS comes from `src/style.css`, with the original inherited font, box sizing, touch behavior, and focus outline made explicit so it can work in another app.

## Files

- `TouchKeyboard.tsx`: original keyboard component, exported for reuse.
- `TouchKeyboard.css`: original styling, plus the inherited styles required to reproduce its appearance.
- `KeyboardOverlay.tsx`: optional wrapper that reproduces the original portrait scaling and placement over another app.
- `fonts/noto-kufi-arabic-400.ttf`: the exact Regular 400 font used by the keyboard.
- `fonts/OFL.txt`: the font's included license.

The component uses React's `useState`; there is no separate keyboard package, icon package, or runtime network request. The optional wrapper also uses React's `useEffect`. Use a React/TypeScript app whose build tool supports CSS imports and relative font files, such as the existing Vite app.

## Exact key layout

All letter and number rows are centered. Keys are generated in this order:

```text
1 2 3 4 5 6 7 8 9 0
q w e r t y u i o p
a s d f g h j k l
z x c v b n m
```

Name mode final row:

```text
Shift  -  _  '  +  Space  ⌫
```

Email mode final row:

```text
Shift  @  .  .com  -  _  '  +  Space  ⌫
```

The header says `Enter your name` or `Enter your email`, with `Done ✓` aligned to the right. The checkmark and backspace symbol are text characters.

## Exact appearance

All dimensions below are logical pixels on the original **2160 × 3840** design canvas. The keyboard is anchored at its bottom-left and is 2160px wide. Its height is determined by the font and content rather than a fixed height.

| Property | Exact value |
| --- | --- |
| Font family / weight | Noto Kufi Arabic / Regular 400 |
| Letter and number key text | 50px |
| Header and Done text | 48px |
| Text line height | `normal`, using the supplied font |
| Letter/number key minimum width | 174px |
| Key height | 116px |
| Final-row key minimum width | 130px |
| Space key width | 360px |
| Horizontal key gap | 18px |
| Row margin | 15px above and below |
| Container padding | 35px top, 40px left/right, 45px bottom |
| Header bottom margin | 20px |
| Done button padding | 8px top/bottom, 35px left/right |
| Keyboard background | `rgba(0, 16, 50, 0.98)` |
| Keyboard top border | `5px solid #5be9ff` |
| Keyboard shadow | `0 -15px 80px #004ab8` |
| Header text color | `#b8d8f3` |
| Key text color | `#ffffff` |
| Key background | `#092c62` |
| Key border | `2px solid #2d76ab` |
| Key corner radius | 16px |
| Pressed key background | `#00629c` |
| Keyboard focus outline | `6px solid #b8fbff`, offset 9px |
| Keyboard stacking level | `z-index: 20` within its canvas |

At a **1080 × 1920 CSS-pixel viewport**, the original scale is 0.5: key height 58px, letter-key minimum width 87px, key gap 9px, and key text 25px. Windows display scaling can make CSS viewport dimensions differ from the panel's physical pixel resolution.

## Exact behavior

- Opens when the associated input gains focus; the parent selects name or email mode.
- Name mode starts with Shift enabled when the component mounts. Email mode starts with Shift disabled.
- Shift changes letter case. After any letter/number-row key is pressed, Shift switches off.
- Shift is initialized on mount. Switching fields while the same keyboard remains open retains its current Shift state, matching the original component.
- The `@`, `.`, `.com`, `-`, `_`, apostrophe, and `+` keys insert those strings. Space inserts one space.
- Backspace calls `onKey('BACKSPACE')`; the parent removes the final character.
- The keyboard prevents the default pointer-down action so touching a key preserves focus in the input.
- Done calls `onClose()`. The original parent hides the keyboard and blurs the active input.
- Original text handling appends characters to the end of the value and removes the last UTF-16 code unit on backspace. Touch insertion does not use the caret position.
- The original name field is limited to 32 characters; email is limited to 120. These limits belong to the parent, not the keyboard component.
- There is no suggestion row, autocorrect, Caps Lock, or long-press repeat.
- Inputs use `inputMode="none"`; physical keyboard input remains supported through their `onChange` handlers.

## Copy into another app

Copy this complete folder into the other app's source directory. Keep the `fonts` folder beside `TouchKeyboard.css` so the font URL resolves.

Mount the keyboard **outside the form element**, as in the original app. If the other app already has the same 2160 × 3840 scaled canvas, render `TouchKeyboard` inside it directly. Otherwise use the optional `KeyboardOverlay` wrapper below.

```tsx
import {useState} from 'react';
import KeyboardOverlay from './reusable-keyboard/KeyboardOverlay';

export default function Registration() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [field, setField] = useState<'name' | 'email' | null>(null);

  const onKey = (key: string) => {
    const setter = field === 'name' ? setName : setEmail;
    setter(value => key === 'BACKSPACE'
      ? value.slice(0, -1)
      : (value + key).slice(0, field === 'name' ? 32 : 120));
  };

  return <>
    <form>
      <label>
        Name
        <input
          value={name}
          maxLength={32}
          inputMode="none"
          autoComplete="off"
          onFocus={() => setField('name')}
          onChange={event => setName(event.target.value)}
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={email}
          maxLength={120}
          inputMode="none"
          autoComplete="off"
          onFocus={() => setField('email')}
          onChange={event => setEmail(event.target.value)}
        />
      </label>
    </form>
    {field && <KeyboardOverlay
      field={field}
      onKey={onKey}
      onClose={() => {
        setField(null);
        (document.activeElement as HTMLElement | null)?.blur();
      }}
    />}
  </>;
}
```

The original portrait scaling formula is:

```ts
const scale = Math.min(window.innerWidth / 2160, window.innerHeight / 3840);
```

This preserves the exact keyboard size relative to the original 9:16 game. Adapt only the wrapper if the destination app uses a different canvas.
