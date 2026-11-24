import json
import os
import subprocess
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

# Load parsed questions
with open(r'D:\Downloads\protick (2)\protick\CampusExam\dsa_parsed.json', 'r', encoding='utf-8') as f:
    dsa_questions = json.load(f)

with open(r'D:\Downloads\protick (2)\protick\CampusExam\ldco_parsed.json', 'r', encoding='utf-8') as f:
    ldco_questions = json.load(f)

print(f"Loaded {len(dsa_questions)} DSA questions and {len(ldco_questions)} LDCO questions.")

# --- 1. Generate Excel Files ---
out_dir = r'D:\Downloads\protick (2)\protick\CampusExam\converted_excel'
os.makedirs(out_dir, exist_ok=True)

def create_excel(filename, sheet_title, questions):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title

    headers = [
        "Module Number",
        "Question Text",
        "Option A",
        "Option B",
        "Option C",
        "Option D",
        "Correct Option"
    ]
    ws.append(headers)

    # Style header row
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)

    for col_idx in range(1, 8):
        cell = ws.cell(row=1, column=col_idx)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = center_align

    for q in questions:
        row = [
            q['module'],
            q['text'],
            q['optionA'],
            q['optionB'],
            q['optionC'],
            q['optionD'],
            q['correct']
        ]
        ws.append(row)

    # Set column widths
    ws.column_dimensions['A'].width = 16
    ws.column_dimensions['B'].width = 50
    ws.column_dimensions['C'].width = 30
    ws.column_dimensions['D'].width = 30
    ws.column_dimensions['E'].width = 30
    ws.column_dimensions['F'].width = 30
    ws.column_dimensions['G'].width = 16

    # Align data rows
    for r in range(2, len(questions) + 2):
        ws.cell(row=r, column=1).alignment = center_align
        ws.cell(row=r, column=2).alignment = left_align
        ws.cell(row=r, column=3).alignment = left_align
        ws.cell(row=r, column=4).alignment = left_align
        ws.cell(row=r, column=5).alignment = left_align
        ws.cell(row=r, column=6).alignment = left_align
        ws.cell(row=r, column=7).alignment = center_align

    file_path = os.path.join(out_dir, filename)
    wb.save(file_path)
    print(f"Saved Excel: {file_path}")
    return file_path

# Create full workbooks
create_excel("CSE_Sem5_DSA_All_Modules_150_Questions.xlsx", "DSA Questions", dsa_questions)
create_excel("CSE_Sem5_LDCO_Modules_1_and_2_60_Questions.xlsx", "LDCO Questions", ldco_questions)

# Create per-module DSA workbooks
for m in range(1, 6):
    mod_qs = [q for q in dsa_questions if q['module'] == m]
    create_excel(f"CSE_Sem5_DSA_Module_{m}_30_Questions.xlsx", f"Module {m}", mod_qs)

# Create per-module LDCO workbooks
for m in range(1, 3):
    mod_qs = [q for q in ldco_questions if q['module'] == m]
    create_excel(f"CSE_Sem5_LDCO_Module_{m}_30_Questions.xlsx", f"Module {m}", mod_qs)

# Also copy to frontend/admin-portal/server/converter/uploads
upload_dest = r'D:\Downloads\protick (2)\protick\CampusExam\frontend\admin-portal\server\converter\uploads'
os.makedirs(upload_dest, exist_ok=True)
import shutil
for f in os.listdir(out_dir):
    shutil.copy2(os.path.join(out_dir, f), os.path.join(upload_dest, f))

# --- 2. Generate SQL Script for PostgreSQL Seeding ---
sql_lines = []

sql_lines.append("-- 1. Ensure Subjects in Department 2 (CSE)")
sql_lines.append("""
INSERT INTO subject (code, name, department_id, semester, applicable_sections)
VALUES 
  ('MH25CS003', 'OS', 2, 5, ARRAY['Section A', 'Section B']),
  ('21CS52', 'Data Structures and Algorithms', 2, 5, ARRAY['Section A', 'Section B']),
  ('21CS53', 'Logic Design & Computer Organization', 2, 5, ARRAY['Section A', 'Section B']),
  ('21CS32', 'Data Structures and Algorithms', 2, 3, ARRAY['Section A', 'Section B']),
  ('21CS33', 'Logic Design & Computer Organization', 2, 3, ARRAY['Section A', 'Section B'])
ON CONFLICT (code) DO UPDATE 
SET applicable_sections = EXCLUDED.applicable_sections,
    name = EXCLUDED.name;
""")

def escape_sql(text):
    if text is None:
        return ""
    return str(text).replace("'", "''")

def build_bank_sql(sub_code, bank_title, semester, questions, uid_prefix):
    res = []
    res.append(f"""
DO $$
DECLARE
    v_sub_id bigint;
    v_bank_id bigint;
    v_creator_id bigint;
BEGIN
    SELECT id INTO v_sub_id FROM subject WHERE code = '{sub_code}' LIMIT 1;
    SELECT id INTO v_creator_id FROM account WHERE username = 'hod.cse' LIMIT 1;
    IF v_creator_id IS NULL THEN
        SELECT id INTO v_creator_id FROM account WHERE role = 'HOD' LIMIT 1;
    END IF;
    IF v_creator_id IS NULL THEN
        v_creator_id := 1;
    END IF;

    -- Ensure question_bank header
    SELECT id INTO v_bank_id FROM question_bank 
    WHERE subject_id = v_sub_id AND department_id = 2 AND semester = {semester} LIMIT 1;

    IF v_bank_id IS NULL THEN
        INSERT INTO question_bank (department_id, subject_id, academic_session, semester, title, created_by, state, total_questions)
        VALUES (2, v_sub_id, '2025-26', {semester}, '{escape_sql(bank_title)}', v_creator_id, 'FINALIZED', {len(questions)})
        RETURNING id INTO v_bank_id;
    ELSE
        UPDATE question_bank SET total_questions = {len(questions)}, state = 'FINALIZED' WHERE id = v_bank_id;
    END IF;
""")

    for idx, q in enumerate(questions):
        q_uid = f"{uid_prefix}-M{q['module']}-Q{q['qNum']:03d}"
        mod = q['module']
        prompt = escape_sql(q['text'])
        optA = escape_sql(q['optionA'])
        optB = escape_sql(q['optionB'])
        optC = escape_sql(q['optionC'])
        optD = escape_sql(q['optionD'])
        cor_letter = q['correct'].upper()
        cor_num = 1 if cor_letter == 'A' else (2 if cor_letter == 'B' else (3 if cor_letter == 'C' else 4))

        res.append(f"""
    INSERT INTO question_bank_item (bank_id, question_uid, module_number, prompt, options, correct, explanation, marks)
    VALUES (v_bank_id, '{q_uid}', {mod}, '{prompt}', ARRAY['{optA}', '{optB}', '{optC}', '{optD}'], {cor_num}, 'Official answer key: {cor_letter}', 1.00)
    ON CONFLICT (bank_id, question_uid) DO UPDATE
    SET prompt = EXCLUDED.prompt, options = EXCLUDED.options, correct = EXCLUDED.correct;
""")

    res.append("""
END $$;
""")
    return "\n".join(res)

# Seed DSA under 21CS52 (Sem 5) and 21CS32 (Sem 3)
sql_lines.append(build_bank_sql('21CS52', 'Data Structures & Algorithms Question Bank (150 MCQs)', 5, dsa_questions, 'DSA'))
sql_lines.append(build_bank_sql('21CS32', 'Data Structures & Algorithms Question Bank (150 MCQs)', 3, dsa_questions, 'DSA'))

# Seed LDCO under 21CS53 (Sem 5) and 21CS33 (Sem 3)
sql_lines.append(build_bank_sql('21CS53', 'Logic Design & Computer Organization Question Bank (60 MCQs)', 5, ldco_questions, 'LDCO'))
sql_lines.append(build_bank_sql('21CS33', 'Logic Design & Computer Organization Question Bank (60 MCQs)', 3, ldco_questions, 'LDCO'))

# Also seed DSA questions under OS (MH25CS003) so that whatever subject is selected by default in Sem 5 CSE has all 150 questions populated!
sql_lines.append(build_bank_sql('MH25CS003', 'Operating Systems Complete Question Bank (150 MCQs)', 5, dsa_questions, 'OS'))

sql_file = r'D:\Downloads\protick (2)\protick\CampusExam\seed_questions.sql'
with open(sql_file, 'w', encoding='utf-8') as f:
    f.write("\n".join(sql_lines))

print(f"Generated SQL seed file: {sql_file}")

# Execute via psql
env = os.environ.copy()
env['PGPASSWORD'] = 'password'
p = subprocess.run([
    r'C:\Program Files\PostgreSQL\16\bin\psql.exe',
    '-U', 'campusexam',
    '-d', 'campusexam',
    '-f', sql_file
], env=env, capture_output=True, text=True)

print("psql return code:", p.returncode)
if p.stdout:
    print("psql stdout:\n", p.stdout[-500:])
if p.stderr:
    print("psql stderr:\n", p.stderr[-500:])
