# 둥근마루 원탁토의실 예약 시스템 ⚪

중학교 교직원분들이 원탁토의실의 대관 현황을 확인하고, 실 전체 사용 예약을 직관적으로 조작할 수 있는 **달력 기반의 단일 페이지 웹 애플리케이션(SPA)**입니다.

![Dashboard Preview](https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80) <!-- 임시 데모용 고품질 이미지 링크 -->

## ✨ 주요 기능 및 특징

1. **글래스모피즘(Glassmorphism) UI**
   - 어두운 밤하늘과 보라/인디고 빛의 세련된 조화를 특징으로 하는 현대적인 대시보드 디자인입니다.
   - 부드러운 호버 애니메이션과 가독성 높은 폰트(Outfit 및 Noto Sans KR)를 사용합니다.

2. **지능형 달력 예약 시스템**
   - **예약 가능 기간 제한**: **2026년 7월부터 2027년 1월**까지의 날짜만 예약 및 네비게이션이 활성화됩니다.
   - **요일별 자동 차시 매핑**:
     - **월·화요일**: 1~7교시, 점심시간(3-4교시 사이), 방과후시간
     - **수·목·금요일**: 1~6교시, 점심시간(3-4교시 사이), 방과후시간
   - **대관 불가 예외 처리**: 토요일 및 일요일은 예약을 차단하고 시각적으로 비활성화합니다.

3. **대시보드 통계 및 퀵 네비게이션**
   - 누적 예약 수, 오늘 잔여 대관 가능 차시, 이달의 우수 예약 교사 등의 유용한 통계를 실시간 집계합니다.
   - 다가올 대관 일정을 사이드바에 순서대로 표시하며, 일정 클릭 시 해당 날짜 예약창으로 즉시 이동합니다.

4. **클라이언트 사이드 데이터 영속성**
   - 서버 구축 없이 브라우저 내의 `LocalStorage`에 데이터를 저장하므로, 새로고침하거나 브라우저를 껐다 켜도 데이터가 영구 보존됩니다.

---

## 🚀 GitHub Pages를 통한 무료 배포 방법

이 프로젝트는 서버가 필요 없는 정적 HTML/CSS/JS 파일로 구성되어 있어, **GitHub Pages**를 통해 단 3분 만에 무료로 배포할 수 있습니다.

### 방법 1. GitHub 웹사이트에서 직접 파일 업로드 (가장 간단한 방법)
1. **GitHub 저장소 생성**: [GitHub](https://github.com)에 로그인한 후, 우측 상단의 `New` 버튼을 눌러 새 저장소(Public)를 생성합니다. (예: 저장소 이름 `roundtable-reservation`)
2. **파일 업로드**: 생성된 저장소 화면 중앙의 **"uploading an existing file"** 링크를 누릅니다.
3. **드래그 앤 드롭**: 로컬 PC의 `roundtable-reservation` 폴더 안에 있는 아래 3개 파일을 웹 브라우저 창으로 드래그하여 업로드합니다.
   - `index.html`
   - `style.css`
   - `app.js`
4. **커밋(Commit)**: 화면 하단의 `Commit changes` 초록색 버튼을 클릭합니다.
5. **Pages 활성화**:
   - 저장소 상단 메뉴의 **Settings** -> 왼쪽 사이드바의 **Pages** 메뉴로 이동합니다.
   - **Build and deployment** 섹션의 Branch 항목에서 **`main`** (또는 `master`) 선택, 경로를 **`/(root)`**로 설정한 후 **Save** 버튼을 누릅니다.
6. **완료**: 약 1~2분 후 설정 페이지 상단에 배포 완료 링크(`https://<유저네임>.github.io/roundtable-reservation/`)가 나타납니다.

### 방법 2. Git CLI를 이용한 배포 (개발자 권장)
프로젝트 폴더 내에서 터미널을 열고 아래 명령어를 순서대로 실행합니다.

```bash
# 1. git 초기화 및 커밋
git init
git add .
git commit -m "Initial commit of Roundtable Reservation System"

# 2. 기본 브랜치 이름을 main으로 변경
git branch -M main

# 3. 원격 GitHub 저장소 연결 (본인의 저장소 URL 주소 입력)
git remote add origin https://github.com/<본인_깃허브_아이디>/<저장소_이름>.git

# 4. 소스코드 업로드
git push -u origin main
```
이후 **방법 1의 5번 단계(Settings -> Pages 설정)**와 동일하게 진행하면 배포가 완료됩니다.

---

## 🛠 사용된 기술 스택
- **Markup**: Semantic HTML5
- **Styling**: Vanilla CSS3 (Custom Variables, CSS Grid, Flexbox)
- **Logic**: Vanilla Javascript (ES6+)
- **Storage**: HTML5 LocalStorage API
