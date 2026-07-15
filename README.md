# 눈치맵

정확한 개인 일정을 공개하지 않고, 등록된 구성원 사이의 일정·지역 중복 가능성을 확인하는 익명 동선 조정 캘린더입니다.

## 현재 구현 범위

- Next.js, TypeScript strict mode, Tailwind CSS 기반 앱 골격
- Prisma + SQLite `User`, `Schedule` 모델과 3명의 데모 사용자/일정 시드
- 시간 중복, Haversine 거리, 최종 충돌 판정 로직
- 핵심 계산 로직 단위 테스트
- 오늘 강조, 날짜 선택, 이전/다음 달 이동이 가능한 월간 캘린더
- 데모 사용자 전환과 날짜별 본인 일정 조회·삭제
- 직접 입력 일정의 익명 충돌 확인과 안전한 일정 등록
- 다른 사용자의 신원·장소·좌표를 숨긴 충돌 결과
- Kakao Maps JavaScript SDK 어댑터와 키 없는 지도 목업 모드
- 선택 장소 마커, 확인 반경, 충돌 상태에 따른 영역 색상
- 로컬 Ollama `qwen2.5:7b` 기반 한국어 자연어 일정 분석
- JSON Schema 출력 강제와 Zod 재검증, 실패 시 직접 입력 유지

Kakao JavaScript 키를 설정하면 실제 지도가 활성화되며, 키가 없거나 SDK 연결에 실패하면 목업 지도가 유지됩니다. 자연어 분석은 로컬 Ollama만 호출하며 실패해도 직접 입력 기능은 유지됩니다. 일정 저장 직전에는 최신 데이터를 기준으로 트랜잭션 안에서 충돌을 다시 확인합니다.

## 설치와 실행

```powershell
npm install
Copy-Item .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

### Kakao 지도 활성화

Kakao Developers에서 앱을 만든 뒤 Kakao Map 사용 설정을 켜고 JavaScript 키의 SDK 도메인에 `http://localhost:3000`을 등록합니다. `.env`의 `NEXT_PUBLIC_KAKAO_MAP_KEY`에 JavaScript 키를 넣고 개발 서버를 다시 시작하세요. REST API 키가 아닌 JavaScript 키가 필요합니다.

### Ollama 자연어 분석

```powershell
ollama pull qwen2.5:7b
ollama list
```

`.env`의 `AI_BASE_URL`은 기본적으로 `http://localhost:11434`, `AI_MODEL`은 `qwen2.5:7b`를 사용합니다. 앱의 자연어 입력란에서 분석하면 검증된 결과가 직접 입력 폼에 반영됩니다.

## 검증

```powershell
npm test
npm run build
```

## 충돌 판정 규칙

두 일정의 날짜가 같고, 시간 구간이 실제로 겹치며, 두 중심 좌표 사이의 거리가 반경 합보다 작거나 같을 때만 충돌합니다. 끝 시간과 다음 일정의 시작 시간이 맞닿는 경우는 겹침으로 보지 않습니다.

## 다음 단계

충돌 계산으로 검증된 대체 장소·시간 후보를 생성하고, Ollama가 후보를 자연스럽게 설명하도록 연결합니다.
