# Approved image bank sources

The application now uses the **50 approved image pairs** supplied in the Figma **Office image pool · 50 sets** (node `4155:1104`). The 100 images are copied byte-for-byte from the local Figma export, with no cropping, re-encoding, generation, substitution, or guessed labels.

[Open the source image pool](https://www.figma.com/design/aXSIhrFP89npxkNOq8gOqB/AI-or-Real---UI-Flow?node-id=4155-1104). The export was saved on 24 October 2026.

Each source image node is explicitly named `Office asset · setXX · real` or `Office asset · setXX · ai`. Those labels and original pair associations are preserved. The bank has 50 unique IDs and 100 distinct image hashes. Labels are authoritative user-provided annotations, rather than results from an image detection algorithm. No external photographer attribution or source provenance has been invented.

The top/bottom display order is randomized by the application. `image` always points to the source labeled real, while `decoyImage` points to the source labeled ai. The earlier sample imagery has been moved outside `public` and is not part of the production bank.

## Original interface artwork

- `images/kiosk-background.png`: original `Cyber_NoTitle_Icons_SubtleMotion-v3` image fill from node `4064:535`; PNG, 941 × 1672 pixels, presented at 2160 × 3840 in Figma.
- `images/kiosk-blue-overlay.png`: original `Asdfhxd-blue-overlay` image fill from node `4064:539`; PNG, 2161 × 3839 pixels, presented at 2160 × 3840 in Figma.

## Pair traceability

`images/office-sources.json` records the original Figma node ID, original image name, embedded image hash, dimensions and byte size for every image. The table below maps every question to its authoritative labels.

| Set | Real source node | AI source node | Real asset | AI asset |
| --- | --- | --- | --- | --- |
| 01 | `4155:1114` | `4155:1117` | `images/office-01-real.jpg` | `images/office-01-ai.jpg` |
| 02 | `4155:1124` | `4155:1127` | `images/office-02-real.jpg` | `images/office-02-ai.jpg` |
| 03 | `4155:1134` | `4155:1137` | `images/office-03-real.jpg` | `images/office-03-ai.jpg` |
| 04 | `4155:1145` | `4155:1148` | `images/office-04-real.jpg` | `images/office-04-ai.jpg` |
| 05 | `4155:1155` | `4155:1158` | `images/office-05-real.jpg` | `images/office-05-ai.jpg` |
| 06 | `4155:1165` | `4155:1168` | `images/office-06-real.jpg` | `images/office-06-ai.jpg` |
| 07 | `4155:1176` | `4155:1179` | `images/office-07-real.jpg` | `images/office-07-ai.jpg` |
| 08 | `4155:1186` | `4155:1189` | `images/office-08-real.jpg` | `images/office-08-ai.jpg` |
| 09 | `4155:1196` | `4155:1199` | `images/office-09-real.jpg` | `images/office-09-ai.jpg` |
| 10 | `4155:1207` | `4155:1210` | `images/office-10-real.jpg` | `images/office-10-ai.jpg` |
| 11 | `4155:1217` | `4155:1220` | `images/office-11-real.jpg` | `images/office-11-ai.jpg` |
| 12 | `4155:1227` | `4155:1230` | `images/office-12-real.jpg` | `images/office-12-ai.jpg` |
| 13 | `4155:1238` | `4155:1241` | `images/office-13-real.jpg` | `images/office-13-ai.jpg` |
| 14 | `4155:1248` | `4155:1251` | `images/office-14-real.jpg` | `images/office-14-ai.jpg` |
| 15 | `4155:1258` | `4155:1261` | `images/office-15-real.jpg` | `images/office-15-ai.jpg` |
| 16 | `4203:1110` | `4203:1113` | `images/office-16-real.jpg` | `images/office-16-ai.jpg` |
| 17 | `4203:1120` | `4203:1123` | `images/office-17-real.jpg` | `images/office-17-ai.jpg` |
| 18 | `4203:1130` | `4203:1133` | `images/office-18-real.jpg` | `images/office-18-ai.jpg` |
| 19 | `4203:1141` | `4203:1144` | `images/office-19-real.jpg` | `images/office-19-ai.jpg` |
| 20 | `4203:1151` | `4203:1154` | `images/office-20-real.jpg` | `images/office-20-ai.jpg` |
| 21 | `4203:1161` | `4203:1164` | `images/office-21-real.jpg` | `images/office-21-ai.jpg` |
| 22 | `4203:1172` | `4203:1175` | `images/office-22-real.jpg` | `images/office-22-ai.jpg` |
| 23 | `4203:1182` | `4203:1185` | `images/office-23-real.jpg` | `images/office-23-ai.jpg` |
| 24 | `4203:1192` | `4203:1195` | `images/office-24-real.jpg` | `images/office-24-ai.jpg` |
| 25 | `4203:1203` | `4203:1206` | `images/office-25-real.jpg` | `images/office-25-ai.jpg` |
| 26 | `4203:1213` | `4203:1216` | `images/office-26-real.jpg` | `images/office-26-ai.jpg` |
| 27 | `4203:1223` | `4203:1226` | `images/office-27-real.jpg` | `images/office-27-ai.jpg` |
| 28 | `4203:1234` | `4203:1237` | `images/office-28-real.jpg` | `images/office-28-ai.jpg` |
| 29 | `4203:1244` | `4203:1247` | `images/office-29-real.jpg` | `images/office-29-ai.jpg` |
| 30 | `4203:1254` | `4203:1257` | `images/office-30-real.jpg` | `images/office-30-ai.jpg` |
| 31 | `4203:1265` | `4203:1268` | `images/office-31-real.jpg` | `images/office-31-ai.jpg` |
| 32 | `4203:1275` | `4203:1278` | `images/office-32-real.jpg` | `images/office-32-ai.jpg` |
| 33 | `4203:1285` | `4203:1288` | `images/office-33-real.jpg` | `images/office-33-ai.jpg` |
| 34 | `4203:1296` | `4203:1299` | `images/office-34-real.jpg` | `images/office-34-ai.jpg` |
| 35 | `4203:1306` | `4203:1309` | `images/office-35-real.jpg` | `images/office-35-ai.jpg` |
| 36 | `4203:1316` | `4203:1319` | `images/office-36-real.jpg` | `images/office-36-ai.jpg` |
| 37 | `4203:1327` | `4203:1330` | `images/office-37-real.jpg` | `images/office-37-ai.jpg` |
| 38 | `4203:1337` | `4203:1340` | `images/office-38-real.jpg` | `images/office-38-ai.jpg` |
| 39 | `4203:1347` | `4203:1350` | `images/office-39-real.jpg` | `images/office-39-ai.jpg` |
| 40 | `4203:1358` | `4203:1361` | `images/office-40-real.jpg` | `images/office-40-ai.jpg` |
| 41 | `4203:1368` | `4203:1371` | `images/office-41-real.jpg` | `images/office-41-ai.jpg` |
| 42 | `4203:1378` | `4203:1381` | `images/office-42-real.jpg` | `images/office-42-ai.jpg` |
| 43 | `4203:1389` | `4203:1392` | `images/office-43-real.jpg` | `images/office-43-ai.jpg` |
| 44 | `4203:1399` | `4203:1402` | `images/office-44-real.jpg` | `images/office-44-ai.jpg` |
| 45 | `4203:1409` | `4203:1412` | `images/office-45-real.jpg` | `images/office-45-ai.jpg` |
| 46 | `4203:1420` | `4203:1423` | `images/office-46-real.jpg` | `images/office-46-ai.jpg` |
| 47 | `4203:1430` | `4203:1433` | `images/office-47-real.jpg` | `images/office-47-ai.jpg` |
| 48 | `4203:1440` | `4203:1443` | `images/office-48-real.jpg` | `images/office-48-ai.jpg` |
| 49 | `4203:1451` | `4203:1454` | `images/office-49-real.jpg` | `images/office-49-ai.jpg` |
| 50 | `4203:1461` | `4203:1464` | `images/office-50-real.jpg` | `images/office-50-ai.jpg` |

## Replacing or correcting content

Add approved files under `public/images/` and update `public/questions.json`, retaining a unique ID for each pair. Preserve the correct real and AI associations and replace the explanation when you have a specific educational note. Use only local relative image paths. Keep `mode` set to `production` and `demo` set to `false` for approved content. Rebuild the Windows package after changing bundled files.
