# 돌봄도 통역 됩니다 — 1차 시제품 (v0.1, 시험용)

두 번 누르면, 말이 통한다. 요양병원 고령 환자·외국인 간병사·간호사용 그림 + 고정 문장 PWA.

- 빌드 도구 없음. 정적 파일만으로 동작 (GitHub Pages 등 정적 호스팅에 그대로 올리면 됨)
- 회원가입·개인정보·대화 기록 저장 없음. 기기에 저장하는 것은 선택 언어·역할 2가지뿐
- 모든 번역은 **시험용 초안**(review: "draft"). 모국어 화자 검수 전 실제 돌봄에 단독 사용 금지

## 파일
| 파일 | 역할 |
|---|---|
| `index.html` | 화면 틀과 디자인 |
| `app.js` | 화면 흐름(역할 → 그림 → 문장 → 큰 글씨+음성), 음성 재생 |
| `icons.js` | 범용 픽토그램(선 그림 SVG) |
| `data/phrases.json` | **문장 데이터 — 문장 교체·추가는 이 파일만 고치면 됨** |
| `audio/` | 사전 녹음 음성 파일 자리 (`audio/zh/p01.mp3` 등) |
| `sw.js`, `manifest.webmanifest` | 오프라인 캐시·홈 화면 추가 |

## 문장 데이터 필드
`id` 고유번호 · `role` 말하는 사람(patient/caregiver/nurse) · `to` 듣는 사람 · `category` 분류 · `icon` 그림 · `ko` 한국어 원문 ·
`tr` 언어별 번역 · `audio` 언어별 음성 파일 경로(비면 기기 TTS) · `review` 검수 상태(draft/reviewed) · `active` 사용 여부 · `safety` normal/caution/urgent

## QR 주소로 역할 바로 열기
- 환자용: `…/?role=patient&lang=zh`
- 간병사용: `…/?role=caregiver&lang=ru`
- 간호사용: `…/?role=nurse`

## 음성 우선순위
1) `audio`에 파일이 있으면 그 파일 재생 → 2) 없으면 기기 TTS(Web Speech API) → 3) 둘 다 안 되면 "화면 글자를 보여 주세요" 안내. 번역 글자는 항상 표시.

© 2026 SOCRA × TESS. All rights reserved.
