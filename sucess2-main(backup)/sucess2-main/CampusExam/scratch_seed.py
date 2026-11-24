import pypdf
import docx
import re
import os
import json
import subprocess

pdf_path = r'C:\Users\User\.gemini\antigravity\brain\de6b32a5-6c6a-4676-b76f-cf7eb8192065\.user_uploaded\media_1795026857262_e26da964.pdf'
docx_path = r'C:\Users\User\.gemini\antigravity\brain\de6b32a5-6c6a-4676-b76f-cf7eb8192065\.user_uploaded\media_1795026857369_cc7e9411.docx'

# --- 1. Parse DSA PDF (150 Qs) ---
reader = pypdf.PdfReader(pdf_path)
dsa_lines = []
for p in reader.pages:
    txt = p.extract_text() or ''
    for l in txt.split('\n'):
        if l.strip():
            dsa_lines.append(l.strip())

dsa_questions = []
cur_q = None
for l in dsa_lines:
    q_m = re.match(r'^Q(\d{1,3})\.\s*(.+)$', l)
    if q_m:
        if cur_q:
            dsa_questions.append(cur_q)
        q_num = int(q_m.group(1))
        cur_q = {
            'qNum': q_num,
            'module': (q_num - 1) // 30 + 1,
            'text': q_m.group(2).strip(),
            'optionA': '',
            'optionB': '',
            'optionC': '',
            'optionD': '',
            'correct': ''
        }
        continue
    if not cur_q:
        continue
    opt_m = re.match(r'^([A-D])\)\s*(.+)$', l)
    if opt_m:
        cur_q['option' + opt_m.group(1).upper()] = opt_m.group(2).strip()
        continue
    ans_m = re.search(r'Correct\s+Answer:\s*([A-D])\b', l, re.I)
    if ans_m:
        cur_q['correct'] = ans_m.group(1).upper()
        continue
    if not cur_q['optionA']:
        cur_q['text'] += ' ' + l
    elif cur_q['optionD'] and not cur_q['correct']:
        cur_q['optionD'] += ' ' + l
    elif cur_q['optionC'] and not cur_q['optionD']:
        cur_q['optionC'] += ' ' + l
    elif cur_q['optionB'] and not cur_q['optionC']:
        cur_q['optionB'] += ' ' + l
    elif cur_q['optionA'] and not cur_q['optionB']:
        cur_q['optionA'] += ' ' + l
if cur_q:
    dsa_questions.append(cur_q)

# --- 2. Parse LDCO DOCX (60 Qs) ---
doc = docx.Document(docx_path)
ldco_questions = []
cur_q = None
for p in [p.text.strip() for p in doc.paragraphs if p.text.strip()]:
    q_m = re.match(r'^Q(\d{1,3})\.\s*(.+)$', p)
    if q_m:
        if cur_q:
            ldco_questions.append(cur_q)
        calc_mod = 1 if len(ldco_questions) < 30 else 2
        cur_q = {
            'qNum': len(ldco_questions) + 1,
            'module': calc_mod,
            'text': q_m.group(2).strip(),
            'optionA': '',
            'optionB': '',
            'optionC': '',
            'optionD': '',
            'correct': ''
        }
        continue
    if not cur_q:
        continue
    opt_m = re.match(r'^\(([A-D])\)\s*(.+)$', p)
    if opt_m:
        cur_q['option' + opt_m.group(1).upper()] = opt_m.group(2).strip()
        continue
    ans_m = re.search(r'(?:Correct\s+Answer|Ans(?:wer)?|Key)\s*[:=-]\s*\(?([A-D])\)?', p, re.I)
    if ans_m:
        cur_q['correct'] = ans_m.group(1).upper()
        continue
if cur_q:
    ldco_questions.append(cur_q)

# Add answer keys from tables
m1_keys = ['D','A','A','C','D','C','C','A','B','C', 'B','C','A','D','D','A','A','D','C','B', 'C','A','A','A','B','B','D','B','A','A']
m2_keys = ['B','A','D','C','C','B','A','B','D','D', 'C','A','C','B','B','C','C','B','B','D', 'D','D','A','B','B','B','A','B','D','D']

for i in range(min(30, len(ldco_questions))):
    ldco_questions[i]['correct'] = m1_keys[i]
for i in range(30, min(60, len(ldco_questions))):
    ldco_questions[i]['correct'] = m2_keys[i - 30]

print(f"DSA Questions: {len(dsa_questions)}, All have correct key: {all(bool(q['correct']) for q in dsa_questions)}")
print(f"LDCO Questions: {len(ldco_questions)}, All have correct key: {all(bool(q['correct']) for q in ldco_questions)}")

# Write to JSON for inspection
with open(r'D:\Downloads\protick (2)\protick\CampusExam\dsa_parsed.json', 'w', encoding='utf-8') as f:
    json.dump(dsa_questions, f, indent=2)

with open(r'D:\Downloads\protick (2)\protick\CampusExam\ldco_parsed.json', 'w', encoding='utf-8') as f:
    json.dump(ldco_questions, f, indent=2)

print("Saved parsed JSONs!")
