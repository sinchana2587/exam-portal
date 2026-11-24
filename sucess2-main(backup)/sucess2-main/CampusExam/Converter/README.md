# ProTick â€” Smart Examination Document Converter

**Institution:** Maharaja Institute of Technology Mysore (MIT Mysore)  
**System:** ProTick Offline Computer-Based Examination System  
**Authority:** Office of the Controller of Examinations (COE)  
**Target Environment:** 100% Offline Campus Intranet / Local Area Network (LAN)

---

## 1. Overview & Project Objective

The **Smart Examination Document Converter** is an essential enterprise subsystem of the ProTick Examination Portal. It standardizes heterogeneous academic documents uploaded across varying college departments (CSE, ISE, ECE, MECH, CIVIL, AIML) into immutable reference templates established by the Controller of Examinations (COE).

The system consists of two independent, production-ready conversion modules:

1. **Question Paper Converter:** Accepts PDF, DOCX, XLSX, XLS, CSV, TXT, PNG, and JPG/JPEG question papers in common departmental layouts. It detects modules dynamically, extracts numbered questions and A&ndash;D options, runs OCR on scanned PDFs and images, and exports all extracted questions in the supplied 12-column workbook template (`Sl.no.`, `Questions`, `Question image`, `option A`, `option A img`, `option B`, `option B img`, `option C`, `option C img`, `option D `, `option D  img`, `Key Answer`). Legacy binary DOC files must be saved as DOCX or PDF before upload.
2. **Student List Converter:** Accepts student lists in Excel (.xlsx, .xls), CSV, PDF (tables), and DOCX. Uses an intelligent synonym-matching engine to map arbitrary column arrangements into the supplied four-column workbook template (`Sl.no.`, `Student Name`, `USN`, `Date of Birth`). Detects duplicate USNs without silent deletion, allows inline correction, validates records, and integrates directly into the institutional Central Student Database with conflict resolution.

---

## 2. Institutional Brand & UI/UX Standards

Fully compliant with the **MIT Mysore Unified UI/UX Style Guide**:

| Token | Hex Value | Application |
| :--- | :--- | :--- |
| `--brand-navy` | `#1A237E` | Primary institutional headers, primary actions, active tabs |
| `--brand-navy-dark` | `#0D1442` | Dark header strips, footers, high-contrast borders |
| `--brand-orange` | `#E65100` | Saffron accent, primary call-to-actions, warning cues |
| `--brand-green` | `#1B5E20` | Success badges, answered status, verified state |
| `--bg-main` | `#F8FAFC` | Low-fatigue slate page surface |
| `--bg-surface` | `#FFFFFF` | Card surfaces, modals, question editors |

**Offline Resilience:** Zero CDN reliance. Fonts, SVG icons, brand assets, and the English OCR model are hosted locally.

---

## 3. Architecture & Core Workflow

### The 12-Step Conversion Engine
```
 [ Upload Document ]
         â”‚
         â–¼
 1. Receive uploaded file (multipart/form-data)
 2. Validate file format & size limits (up to 50MB)
 3. Store original document securely in /uploads/originals/
 4. Extract text streams, layout blocks, and embedded media assets
 5. OCR Execution via Tesseract engine (for scanned PDFs & image questions)
 6. Identify & classify document type (Question Paper vs Student List)
 7. Detect & map relevant fields to reference schema
 8. Transform into COE Reference Template (module-specific Question Paper sheets / four-column Student List)
 9. Run automated validation checks (missing text, empty options, duplicate USNs)
 10. Hydrate visual Review & Verification Workspace
 11. Obtain Administrator / COE verification & approval
 12. Generate standardized exports (.xlsx, .json, .csv)
```

---

## 4. Key Functional Features

### A. Reference Template Configuration (COE Only)
- **Question Paper Reference Template:** Uses `q_template.xlsx` copied from the supplied `question_temp.xlsx`, preserving its five module sheets, 12 headers, order, and formatting. Each question keeps a unique `questionId` in the database, and each module is exported to its matching sheet.
- **Dynamic Module Architecture:** Never hardcodes 5 modules. Supports 3, 5, 8 or any number of modules auto-detected from headings (`MODULE 1`, `UNIT II`, `PART A`, `Section 1`) or dynamically configured by administrators.
- **Answer Key Strictness:** Strictly limits answers to `A`, `B`, `C`, or `D`. Leaves answers unassigned if the original document does not clearly provide a key (prevents fabricated records).
- **Student List Template:** Uses the supplied `std_template.xlsx` workbook, preserving its four headers, order, and formatting (`Sl.no.`, `Student Name`, `USN`, `Date of Birth`).

### B. Question Paper Converter
- **Rich Editor & Independent Media:** Each question and each of the 4 options (`A`, `B`, `C`, `D`) has independent text and dedicated image upload, preview, removal, and replacement controls.
- **Code Snippet & Math Support:** Preserves code block indentation and syntax (`Python`, `C`, `Java`, `SQL`) as well as mathematical notation.
- **Question Management:** Add, duplicate, delete, reorder up/down, change question numbering, and move questions between dynamic modules.
- **Verification Dashboard:** Surfaces missing question text, missing options, missing answer keys, duplicate question numbers, unassigned modules, and overall extraction confidence score.

### C. Student List Converter
- **Intelligent Header Mapping:** Maps synonym headers (`Register Number`, `Roll No`, `RegNo`, `Hall Ticket` &rarr; `USN`; `Student Name`, `Candidate Name`, `Name` &rarr; `Student Name`; `Class`, `Div` &rarr; `Section`).
- **Duplicate USN Protection:** Flagged duplicate records are highlighted in a dedicated review banner and preserved for administrator review instead of being silently deleted.
- **Searchable Editable Table:** Inline editing, adding records, deleting, sorting by any column, and filtering by section, semester, and validation status.
- **Central Student Database Import:** Single-click import with conflict detection. Compares existing vs incoming records and requires administrator confirmation before overwriting existing students.

### D. Automated Test Suite (10 Specification Test Cases)
Includes pre-generated test documents compliant with Section 12:
1. `01_digital_question_paper_3modules.pdf` &mdash; Digitally generated PDF with selectable text.
2. `02_scanned_question_paper.pdf` &mdash; Scanned PDF with OCR extraction.
3. `03_code_snippets_paper.pdf` &mdash; PDF containing Python & C code snippets.
4. `04_diagram_question_paper.pdf` &mdash; PDF containing circuit diagrams.
5. `05_images_in_options_paper.pdf` &mdash; PDF with images inside answer options.
6. `06_dynamic_8_modules_paper.pdf` &mdash; PDF with 8 dynamic modules.
7. `07_inconsistent_numbering_paper.pdf` &mdash; PDF with inconsistent question numbering.
8. `08_student_list_standard.xlsx` &mdash; Student roster in Excel.
9. `09_student_list_table.pdf` &mdash; Student roster in tabular PDF.
10. `10_student_list_messy_headers.xlsx` &mdash; Student roster with non-standard headers & duplicate USNs.

---

## 5. Getting Started

### Prerequisites
- Node.js &gt;= 18.0.0
- npm &gt;= 9.0.0
- Poppler `pdftoppm` available on `PATH` to OCR scanned PDF pages

### Installation
```bash
# Install all root, server, and client dependencies
npm install
```

### Running the Application
```bash
# Start both Backend Server (port 5001) and Frontend Client (port 3001) concurrently
npm run dev

# Or start backend server directly (serves compiled frontend on http://localhost:5001)
npm start
```

### Accessing the Web Interface
- **Combined Portal URL:** `http://localhost:5001`
- **Vite Dev Server URL:** `http://localhost:3001`
- **API Health Check:** `http://localhost:5001/api/health`

### Running the Automated Test Suite
From the web UI, navigate to the **Automated Test Suite** tab and click **"Execute All 10 Test Cases"**, or run via terminal:
```bash
npm run test:all
```

---

## 6. Project Structure

```
converter_ProTick/
â”œâ”€â”€ client/                       # React 18 + Vite + Tailwind CSS Frontend
â”‚   â”œâ”€â”€ public/assets/            # MIT Mysore crest & static assets
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ components/layout/    # Institutional Header & Role Navigation Sidebar
â”‚       â”œâ”€â”€ context/              # AuthContext (COE vs Department role switcher)
â”‚       â”œâ”€â”€ pages/                # Dashboard, Question Paper, Student List, Templates, Central DB, History, Tests
â”‚       â””â”€â”€ services/             # REST API Client
â”œâ”€â”€ server/                       # Node.js Express REST Backend Server
â”‚   â”œâ”€â”€ data/                     # Persistent JSON Database & Generated Sample Test Documents
â”‚   â”œâ”€â”€ uploads/                  # Secure archive for original files & extracted image assets
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ controllers/          # Dashboard, Templates, Question Paper, Student List, History, Central DB
â”‚       â”œâ”€â”€ database/             # Atomic JSON database layer with audit logging
â”‚       â”œâ”€â”€ engine/
â”‚       â”‚   â”œâ”€â”€ extractors/       # PDF, OCR (Tesseract), DOCX (Mammoth), Excel (XLSX)
â”‚       â”‚   â”œâ”€â”€ parsers/          # Layout-aware Question Paper Parser & Student List Synonym Parser
â”‚       â”‚   â””â”€â”€ exporters/        # Standardized Excel (.xlsx), JSON, and CSV Exporters
â”‚       â”œâ”€â”€ middleware/           # File & Image upload validation
â”‚       â”œâ”€â”€ sampleGenerator.js    # Pre-generates all 10 specification test documents
â”‚       â””â”€â”€ server.js             # Express API application & static asset server
â””â”€â”€ package.json                 # Monorepo workspaces & build orchestration
```

