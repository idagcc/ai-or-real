# AI or Real — touchscreen game

Source: [idagcc/ai-or-real](https://github.com/idagcc/ai-or-real). Download the ready-to-run Windows ZIP from [release v1.1.1](https://github.com/idagcc/ai-or-real/releases/tag/v1.1.1). Extract the entire archive before opening **AI or Real.exe**.

A local game for a Windows portrait touchscreen. The landing screen is the leaderboard, followed by registration, instructions, a random ten-question round and a score. The finished round is saved on this computer. The public leaderboard follows the approved Figma layout and shows rank, agent name, correct answers and correct-answer time. Email addresses and the calculated score remain in the operator export.

Registration, instructions and gameplay return to the home screen after 30 seconds without a tap, key press or text input. The reset clears the unfinished session. Operator settings can adjust this inactivity period; existing installations using the previous 120-second default use 30 seconds after updating.

## Run on Windows

1. Set Windows **Settings → System → Display → Display orientation** to **Portrait** and select **2160 × 3840** where supported. Set the touchscreen as the correct display in Windows touch settings. The app selects a portrait display if one is attached; Windows controls the display's physical rotation.
2. Extract **AI-or-Real-1.1.1-windows-x64.zip** completely, then open **AI or Real.exe** inside the extracted folder. Keep the other files beside it. The app opens in fullscreen kiosk mode. Keep a keyboard available for the operator controls below.
3. Test registration and all ten questions on the physical touchscreen before opening the event. Check that touch points match the portrait screen and that tapping a field brings up the intended keyboard.

The game works offline once installed. No email-verification service is required. Email validation checks address syntax and suggests corrections to common domain typos; it does **not** prove that an address exists or belongs to the agent.

### Operator controls

| Action | Keyboard shortcut |
| --- | --- |
| Open operator settings | **Ctrl + Shift + A** |
| Leave or restore fullscreen | **F11** |
| Quit the Windows app | **Ctrl + Shift + Q** |

Open settings from the landing screen. The panel controls scoring and round timing, reloads the image bank, and exports the complete leaderboard. It is separate from the approved agent-facing screens. Kiosk fullscreen hides normal window controls; these shortcuts are operator controls, not an account login or a Windows security boundary. For a locked-down public installation, use the Windows account and kiosk policies appropriate to the venue.

### Background, motion and audio

The supplied `DGE_BG_Potrite.mp4` plays continuously as a muted 2160 × 3840 background loop. It stays mounted between screens and uses a local poster if playback is unavailable. Neon panels power on as each page arrives; the game starts timing only after both images are decoded and the 650 ms entrance has finished. Reduced-motion preferences disable the page and panel animations.

The original electronic music score loops offline, with separate cues for taps, transitions, correct and incorrect answers, timeouts and game completion. Operator settings include an audio switch and separate music/effects volumes; changes apply immediately and are remembered on this device. The review sidebar includes the same controls and a **Replay entrance** button. Browser audio starts on the first touch; the Electron app allows music at launch. Audio and video pause while the app is hidden.

The editable music source is `scripts/create-audio-score.py`; its provenance and encoding details are in `public/media/AUDIO-SOURCES.txt`. The supplied background video and generated score are included in the Windows ZIP.

### Touch keyboard

The app includes an on-screen keyboard that appears when a registration field is selected. Tap **Done** to close it. A physical keyboard also works. The packaged app does not invoke an external keyboard program or change Windows preferences.

## Scoring

A correct answer earns base points plus a speed bonus. An incorrect answer or an expired question earns zero. The speed bonus decreases linearly as the question timer runs out; only the time spent answering correctly affects a speed bonus.

```text
correct points = base points + round(maximum bonus × (1 − answer time / time limit))
```

The application bounds the maximum speed bonus so that an extra correct answer always outweighs the speed bonuses available in a round. Tied scores are ordered by total time spent on correct answers, then completion time. Changes affect new rounds; existing saved results retain the settings used to calculate them. The public leaderboard automatically groups results by the scoring rules used, so changing a scoring rule shows a separate competition. CSV export includes every saved result and its original rules.

## Game images

The included production bank contains the 50 office image pairs from the approved Figma file. Its 100 original photographs and AI images retain the explicit real/AI labels in that file. Original file hashes, node IDs and dimensions are recorded in `public/images/office-sources.json`. A round selects 10 distinct pairs and randomizes which image appears at the top.

The source project keeps local images in `public/images/` and the editable bank in `public/questions.json`. The question bank defines each image's identifier, local image path, `real` or `ai` answer, title, explanation and optional source/credit. In paired mode, `image` is the real photograph and `decoyImage` is the AI image; the game randomizes the two display positions. The supplied bank contains 50 approved pairs, each with its own real photograph and AI image.

To replace content **without rebuilding the Windows app**, create this folder under the same application-data directory as the leaderboard:

```text
%APPDATA%\AI or Real\content\questions.json
%APPDATA%\AI or Real\content\images\photo-01.jpg
%APPDATA%\AI or Real\content\images\ai-01.png
```

Copy the supplied `public/questions.json` structure and replace the content and labels, retaining `mode: "production"` and `demo: false`. Use relative paths such as `images/photo-01.jpg`; external URLs and paths outside this content folder are rejected. Each image must exist and be under 40 MB. Close and reopen the game after changing the bank. If the override contains an error, the game reports it rather than quietly using different content. Remove or rename the external `questions.json` to use the built-in approved Figma bank again.

The browser preview reads `public/questions.json` through its web server and does not read the Windows override. All production assets must be local for offline use. Test every final image before opening the event.

## Saved data and exports

The Windows app saves `ai-or-real-data.json` under Electron's application data directory, normally:

```text
%APPDATA%\AI or Real\ai-or-real-data.json
```

The exact directory can vary with Windows account and package settings. Settings and completed results use atomic writes, and the previous valid data file is kept as `.backup`. Writes are serialized to avoid dropping results. Retrying a completed round's save does not create a duplicate result. If an invalid main file is found, it is preserved with a `.corrupt-…` suffix and the valid backup is recovered. Recovery can omit the most recent write; if both files are damaged, the app reports the problem and preserves the files for an operator.

Use the operator panel's export to create a CSV containing agent names, emails and scores. Protect that exported file and retain personal data only as long as needed. Clearing the leaderboard removes results from the active file and its regular backup while retaining settings. Previously exported CSVs and any damaged files preserved for recovery are separate files and must be handled by the operator. No completed round is saved until the application requests a save.

The browser preview uses browser local storage instead. Browser data belongs to that browser and site address; clearing site data removes it. The Windows app uses the data file above and does not depend on browser cache. Storage failures are reported instead of silently claiming that a result was saved.

## Develop and build

Use a current Node.js LTS installation. From this project directory:

```powershell
npm ci
npm run dev
```

For the Electron development window, run `npm run desktop:dev`; this starts the web server and the kiosk together. Run `npm run desktop` for a local preview of the built assets. The development shell uses `http://127.0.0.1:5173` by default, or `ELECTRON_RENDERER_URL` for a different localhost URL. Passing `--built` to Electron loads the built assets instead.

Build the production web assets and Windows distribution using the project's scripts:

```powershell
npm run build
npm run dist:win:zip
```

On Windows, `npm run dist:win` also builds a single-file portable executable and an NSIS installer. The supplied download is the ready-to-run ZIP; the installer compiler bundled here requires an Intel macOS runtime, so the ZIP was produced with the native build path.

Building Windows installers on Windows is recommended. The Electron entry is `electron/main.cjs`; packaged files must include both `electron/` and `dist/`. `electron-builder` should target Windows x64 portable and NSIS artifacts. Unsigned Windows builds may display a Windows reputation warning until a production signing certificate is configured.

Run the logic, storage and content checks without opening Electron:

```powershell
npm test
npm run test:desktop
node scripts/check-assets.mjs
```

These checks exercise restart persistence, concurrent writes, retry deduplication, invalid data rejection, corrupt-file backup recovery and clearing. Physical Windows touchscreen behavior, display selection, the Windows touch keyboard and installer operation require validation on the installation computer; a development preview does not establish those hardware results.

## Approved UI reference

The agent-facing screens follow Figma file `aXSIhrFP89npxkNOq8gOqB`, portrait frames `4064:533` (landing), `4064:723` (registration), `4064:598` (instructions), `4064:639` (game), and `4064:1501` (results). The approved overlay, field and button artwork are stored locally under `public/approved/`. The supplied video replaces the static background while preserving the approved screen geometry. The canvas is 2160 × 3840 and scales uniformly to the available screen. Live game values replace sample values in the existing designed positions.

## Review every approved screen

Run `npm run desktop:review` to open the AI or Real Electron review window. Select Leaderboard, Registration, Instructions, Game or Results in the sidebar. The game section can hold correct/incorrect feedback and show each approved image pair. Review uses sample data and pauses timers.

In the Windows ZIP, double-click `Review-AI-or-Real.cmd` for this review window. Double-click `AI or Real.exe` for the fullscreen game. The browser review is available at `http://127.0.0.1:5173/?review=1` while the development server is running.

## Touch keyboard specification

Registration uses the exact keyboard supplied in Catch-the-Phish-Keyboard.zip: Noto Kufi Arabic Regular 400, 50px key labels, 48px heading, 174px minimum standard keys, 116px key height, 130px minimum bottom keys, 360px spacebar and 18px key gaps. The keyboard is mounted directly on the 2160 × 3840 canvas and anchored to its bottom. Input fields suppress the Windows software keyboard while retaining physical keyboard support. In the flow review, open Registration and choose Name keyboard or Email keyboard.
