# 온보딩 트래커

수강생의 입과 첫날 온보딩 체크리스트를 관리하고, 관리자가 달성률을 실시간으로 모니터링할 수 있는 웹 애플리케이션입니다.

---

## 주요 기능

### 수강생 화면
- 이름 입력 후 오늘 날짜에 해당하는 할 일 목록 자동 표시
- 할 일 완료 체크 및 드래그 순서 변경
- 타임라인 플래너 (나만의 일정 계획)
- 퇴실 타이머 및 퇴실 시간 확인
- 전체 완료 시 Confetti 애니메이션

### 관리자 화면 (6개 탭)

| 탭 | 기능 |
|---|---|
| **트래킹** | 수강생별 달성률 실시간 모니터링, 기준치 설정, 달성률 구간 필터 |
| **수강생 관리** | 수강생 CRUD, 엑셀 일괄 업로드, 중간 합류자 관리 |
| **할 일 관리** | Day별 할 일 CRUD, 엑셀 일괄 업로드 |
| **날짜 매핑** | Day 번호와 실제 날짜 연결 |
| **수업 시간** | 그룹별 수업 시작/종료 시간 설정 |
| **설정** | 관리자 계정 및 PIN 관리 |

### 엑셀 업로드
- 수강생 / 할 일 모두 `.xlsx` 파일로 일괄 등록 가능
- 템플릿 다운로드 제공
- 업로드 전 미리보기 및 오류 행 표시
- 중복 수강생 자동 감지 → 이름 뒤 `B` 자동 추가

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| **프론트엔드** | React 19, Vite, Tailwind CSS |
| **백엔드/DB** | Supabase (PostgreSQL) |
| **라우팅** | react-router-dom |
| **엑셀 처리** | SheetJS (xlsx) |
| **기타** | react-confetti |

---

## 시작하기

### 사전 요구사항
- Node.js 18 이상
- Supabase 프로젝트

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 환경변수 설정
cp .env.example .env
# .env 파일에 Supabase URL과 anon key 입력

# 개발 서버 실행
npm run dev
```

### 환경변수

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## DB 스키마

```sql
-- 수강생
students (id, name, track, cohort, is_late_joiner, join_date, created_at)

-- 할 일
tasks (id, day_number, title, target_date, track, cohort, created_at)

-- 달성 현황
progress (id, student_id, task_id, is_completed, completed_at)

-- 개별 추가 할 일 (중간 합류자용)
student_custom_tasks (id, student_id, target_date, title, is_completed, completed_at)

-- 관리자
admins (id, name, pin_code, role, created_at)

-- 수업 시간
class_schedules (id, track, cohort, start_time, end_time)
```

---

## 라우팅

| 경로 | 화면 |
|---|---|
| `/` | 수강생 이름 입력 |
| `/student` | 수강생 온보딩 체크리스트 |
| `/admin` | 관리자 로그인 |
| `/admin/dashboard` | 관리자 대시보드 |
