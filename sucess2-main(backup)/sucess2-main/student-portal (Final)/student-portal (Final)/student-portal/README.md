# MIT Mysore – Offline CBT Examination System
## Strict Anti-Malpractice Security Lockdown & Question Palette Colour Logic

The **MIT Mysore Computer-Based Test (CBT)** platform is an enterprise-grade examination system modeled after national-level CBT engines (such as JEE / NTA CBT).

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install --legacy-peer-deps

# 2. Run local development server
npm run dev

# 3. Access web application
http://localhost:3000/
```

- **Student CBT Portal**: [http://localhost:3000/student/login](http://localhost:3000/student/login)

---

## ⚙️ Backend Integration & Configuration

This frontend connects to the local MIT Mysore Lab Server or remote backend API. Full endpoint specifications are documented in [`API_CONTRACT.md`](./API_CONTRACT.md).

### Environment Variables

Configure connection settings in `.env.local` (or `.env`):

| Variable | Default Value | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | Base URL of the Lab Server REST API. |
| `VITE_LAB_API_BASE_URL` | `http://localhost:8080` | Alternate alias for `VITE_API_URL` for backward compatibility. |
| `VITE_API_TIMEOUT_MS` | `8000` | HTTP request timeout in milliseconds before triggering timeout error. |
| `VITE_API_MODE` | `integration` | API communication mode (`integration` connects to live REST endpoints). |

### Pointing to Backend
1. **Local Development**:
   Leave `VITE_API_URL="http://localhost:8080"`. The built-in Vite reverse proxy in `vite.config.ts` automatically forwards all `/api/*` calls from port `3000` to port `8080` without requiring CORS configuration on the backend.
2. **College Lab LAN Deployment**:
   Set `VITE_API_URL="http://192.168.10.100:8080"` (or your local laboratory server IP address) in `.env.production` or `.env.local`.

---

## 🎨 1. Question Navigation Palette – Colour Logic

The question navigation palette visually distinguishes unopened questions from opened but unanswered questions:

| State | Background Colour | Text Colour | Border Colour | Visual Meaning |
| :--- | :---: | :---: | :---: | :--- |
| **Not Visited** | `#FFFFFF` (White) | `#1F2937` (Dark Navy) | `#D1D5DB` (Subtle Grey) | Candidate has not opened or visited this question. |
| **Not Answered** | `#E0E0E0` (Light Grey) | `#1F2937` (Dark Grey) | `#9CA3AF` (Darker Grey) | Candidate opened/visited this question but has not selected an answer. |
| **Answered** | `#16834A` (Green) | `#FFFFFF` (White) | `#16834A` | Candidate has selected and saved a response. |
| **Marked for Review** | `#6D5CE8` (Purple) | `#FFFFFF` (White) | `#6D5CE8` | Candidate has flagged the question for later review (unanswered). |
| **Answered & Marked Review** | `#6D5CE8` (Purple) | `#FFFFFF` (White) | `#16834A` (Border + Check) | Candidate answered the question and flagged it for review (will be graded). |
| **Active Question** | *State Background* | *State Text* | Ring (`ring-2 ring-[#17243A]`) | Question currently displayed on the candidate's workspace. |

### Dynamic Status Transitions:
1. **Initial State**: All questions except Question 1 appear **White (`#FFFFFF`)**.
2. **On Visiting**: Navigating to an unvisited question changes its status to **Light Grey (`#E0E0E0`)**.
3. **On Answering**: Selecting an option changes the tile to **Green (`#16834A`)**.
4. **On Clearing**: Clicking "Clear Response" returns the tile to **Light Grey (`#E0E0E0`)** because the question has already been visited.
5. **On Review**: Marking for review applies **Purple (`#6D5CE8`)** styling with clear evaluation flags.
6. **Matching Legend**: The Status Legend below the palette uses the exact same background, text, and border colours.

---

## 📋 2. Student Instructions Page (Concise 4-Card UI)

The Instructions page features four concise, readable cards preserving the institutional layout:

- **CARD 1: General Rules & Security**
  - The exam consists of 30 Multiple Choice Questions.
  - **Strict Monitoring:** Do not switch browser tabs, minimize the window, or open other applications. The system logs navigation away from the exam screen and may issue an automatic warning or lock your session.
  - Do not disconnect network cables during the active examination.
- **CARD 2: Question Navigation**
  - Use "Previous" and "Save & Next" to move sequentially between questions.
  - Click any number on the right-side Question Palette to jump directly to that specific question.
- **CARD 3: Answering & Reviewing**
  - Click an option card to select your response.
  - Use "Clear Response" to remove your answer entirely.
  - **Note:** Questions marked as "Answered & Marked for Review" WILL be evaluated and graded upon final submission.
- **CARD 4: Submission & Timer**
  - The exam will automatically lock and submit when the top countdown timer reaches 00:00:00.
  - To finish early, click "Submit Examination" and confirm your final submission on the summary screen.

---

## 🔒 3. Strict Examination Lockdown & Anti-Malpractice

When an examination is active, the candidate terminal operates under strict anti-malpractice lockdown:

1. **Instant Activity Detection**:
   - **Tab Switching**: Detected via `document.visibilitychange` (`document.hidden`).
   - **Window Focus Lost / Minimized**: Detected via `window.blur`.
   - **Fullscreen Exit**: Detected via `fullscreenchange` (`!document.fullscreenElement`).
   - **Prohibited Keyboard Shortcuts**: Intercepts `Ctrl+Tab`, `Ctrl+Shift+Tab`, `Alt+Tab`, Developer Tools (`F12`, `Ctrl+Shift+I`, `Ctrl+Shift+J`, `Ctrl+Shift+C`, `Ctrl+U`), and window operations (`Ctrl+W`, `Ctrl+R`, `F5`).
   - **Right-Click Context Menu**: Prevented via `contextmenu` listener.
2. **Immediate Progress Snapshot**:
   - Before presenting the lock screen, the system captures candidate state: Student USN, examination ID, assigned question order, selected answers, visited questions, marked-for-review flags, current question index, remaining examination seconds, violation timestamp, and violation counter.
3. **Full-Screen Security Lock Screen (`#0B132B`)**:
   - Rendered with a high `z-index` (`z-[9999]`), fully concealing question texts, options, and palettes.
   - Minimal institutional MIT Mysore branding.
   - Animated security lock shield with subtle pulsing accents.
   - Heading: `EXAMINATION SESSION LOCKED`.
   - Message: *"A security violation has been detected. Your examination progress has been securely saved."*
   - Status badge: `INVIGILATOR AUTHORIZATION REQUIRED`.
   - Violation telemetry badge displaying incident number, violation type, and exact timestamp.

---

## 🔑 4. Invigilator Secret Password Verification

- **Invigilator Secret Password**: `MIT@CBT2026`
- **Security Features**:
  - Empty passwords rejected.
  - Incorrect attempts display: *"Authorization failed. Incorrect password. (X/3 attempts used)."*
  - Password input field automatically clears after failed attempts.
  - **Maximum Failed Attempts**: After **3 consecutive failed attempts**, the terminal transitions to **Permanent Lockout** (`isPermanentlyLocked: true`).
- **Successful Resumption**:
  - Invigilator enters `MIT@CBT2026`.
  - Lock screen is removed and state is restored without reshuffling questions or wiping answers.
  - Candidate returns to the exact question being answered.
  - Confirmation toast appears: *"Invigilator verification successful. Your examination session has been restored."*
  - Examination timer continues smoothly without restarting.

---

## ⏱️ 5. Authoritative Timer Policy

- **No Timer Reset**: Triggering security violations does not reward candidates with additional examination time.
- **Continuous Deadline**: The timer continues calculating remaining time towards the authoritative session deadline.
- **Auto-Submission on Expiry**: If the examination duration expires while the candidate terminal is in lockdown, the saved examination responses are automatically submitted via the auto-submit protocol.
