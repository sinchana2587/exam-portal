import urllib.request
import urllib.parse
import json
import base64
import os
import sys

TOKEN = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
BASE_URL = "http://127.0.0.1:8081/api/v1"

def api_post(endpoint, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        f"{BASE_URL}/{endpoint}",
        data=data,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode('utf-8')), resp.status
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return json.loads(body), e.code
        except Exception:
            return {"error": body}, e.code

def file_to_b64(path):
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode('utf-8')

passed = 0
failed = 0

def check(condition, desc):
    global passed, failed
    if condition:
        print(f"[PASS] {desc}")
        passed += 1
    else:
        print(f"[FAIL] {desc}")
        failed += 1

print("=================================================================")
print("RUNNING USN DEPARTMENT PREFIX & EXCEL VALIDATION TESTS")
print("=================================================================\n")

EXCEL_DIR = r"c:\Users\Dhanush K N\Downloads\ALL 3 PORTALS\admin-portal (7)"

# Test 1: Validate valid CS students Excel in Sem 5 Sec A
b64_valid = file_to_b64(os.path.join(EXCEL_DIR, "test_students_valid_cs.xlsx"))
res1, code1 = api_post("hod/student-lists/validate-excel", {
    "semesterNumber": 5,
    "section": "A",
    "fileBase64": b64_valid
})
print("Test 1 Result:", res1.get("success"), "Data:", res1.get("data", {}).get("validCount"), "valid,", res1.get("data", {}).get("invalidCount"), "invalid")
check(code1 == 200 and res1.get("success") is True, "Test 1: Backend accepts valid CS Excel (4MH21CS001, etc.)")
check(res1.get("data", {}).get("validCount") == 5, "Test 1: All 5 CS students marked valid")
check(res1.get("data", {}).get("invalidCount") == 0, "Test 1: 0 invalid records")

# Test 2: Validate mismatched department branch Excel (contains 4MH21EC001 in E158CS)
b64_mismatch = file_to_b64(os.path.join(EXCEL_DIR, "test_students_mismatch.xlsx"))
res2, code2 = api_post("hod/student-lists/validate-excel", {
    "semesterNumber": 5,
    "section": "A",
    "fileBase64": b64_mismatch
})
print("Test 2 Result:", res2.get("success"), "Data:", res2.get("data", {}).get("validCount"), "valid,", res2.get("data", {}).get("invalidCount"), "invalid")
errors2 = res2.get("data", {}).get("errors", [])
print("Test 2 Errors:", errors2)
check(res2.get("data", {}).get("validCount") == 1, "Test 2: Valid CS student accepted")
check(res2.get("data", {}).get("invalidCount") == 1, "Test 2: Mismatched EC student rejected")
has_dept_mismatch_error = any("Department-prefix mismatch" in err and "EC" in err and "E158CS" in err for err in errors2)
check(has_dept_mismatch_error, "Test 2: Error explicitly states Department-prefix mismatch ('EC' does not belong to E158CS)")

# Test 3: Validate duplicate USN inside Excel
b64_dup = file_to_b64(os.path.join(EXCEL_DIR, "test_students_duplicate.xlsx"))
res3, code3 = api_post("hod/student-lists/validate-excel", {
    "semesterNumber": 5,
    "section": "A",
    "fileBase64": b64_dup
})
print("Test 3 Result:", res3.get("success"), "Errors:", res3.get("data", {}).get("errors", []))
check(res3.get("data", {}).get("invalidCount") >= 1, "Test 3: Duplicate USN rejected")
check(any("Duplicate USN" in err for err in res3.get("data", {}).get("errors", [])), "Test 3: Error indicates duplicate USN in file")

# Test 4: Validate invalid DOB in Excel
b64_dob = file_to_b64(os.path.join(EXCEL_DIR, "test_students_invalid_dob.xlsx"))
res4, code4 = api_post("hod/student-lists/validate-excel", {
    "semesterNumber": 5,
    "section": "A",
    "fileBase64": b64_dob
})
print("Test 4 Result:", res4.get("success"), "Errors:", res4.get("data", {}).get("errors", []))
check(res4.get("data", {}).get("invalidCount") == 1, "Test 4: Invalid DOB rejected")
check(any("Invalid Date of Birth" in err for err in res4.get("data", {}).get("errors", [])), "Test 4: Error indicates invalid DOB format")

# Test 5: Validate JSON payload with multiple admission years (21, 22, 23) and lateral entry (4MH24CS450)
res5, code5 = api_post("hod/student-lists/validate-excel", {
    "semesterNumber": 5,
    "section": "A",
    "rows": [
        {"usn": "4MH21CS050", "studentName": "Ananya Sharma", "dob": "2003-05-14"},
        {"usn": "4MH22CS051", "studentName": "Bhavana K", "dob": "2004-01-20"},
        {"usn": "4MH23CS052", "studentName": "Chetan Kumar", "dob": "2005-08-22"},
        {"usn": "4MH24CS450", "studentName": "Dhanush Lateral", "dob": "2004-12-10"}
    ]
})
print("Test 5 Result:", res5.get("success"), "valid:", res5.get("data", {}).get("validCount"))
check(code5 == 200 and res5.get("data", {}).get("validCount") == 4, "Test 5: Validates 21, 22, 23 admission years and 24 lateral entry")

# Test 6: Sem 3 Section A validation for 4MH23CS001
res6, code6 = api_post("hod/student-lists/validate-excel", {
    "semesterNumber": 3,
    "section": "A",
    "rows": [
        {"usn": "4MH23CS001", "studentName": "Aarav Sharma", "dob": "2005-08-22"}
    ]
})
print("Test 6 Result:", res6.get("success"), "valid:", res6.get("data", {}).get("validCount"))
check(code6 == 200 and res6.get("data", {}).get("validCount") == 1, "Test 6: Validates 4MH23CS001 in Sem 3 Section A")

# Test 7: Attempting to upload invalid roster with isReplacement=True must be REJECTED atomically
res7, code7 = api_post("hod/student-lists/upload", {
    "semesterNumber": 5,
    "section": "A",
    "fileName": "test_students_mismatch.xlsx",
    "sourceType": "EXCEL",
    "isReplacement": True,
    "fileBase64": b64_mismatch
})
print("Test 7 Upload Mismatch Result code:", code7, "Response:", res7)
check(code7 >= 400 or res7.get("success") is False, "Test 7: Upload with mismatched department prefix rejected atomically")

# Test 8: Verify Sem 5 Section A roster was NOT modified by failed upload (Atomicity)
req8 = urllib.request.Request(
    f"{BASE_URL}/hod/student-lists?semesterNumber=5&section=A",
    headers={"Authorization": f"Bearer {TOKEN}"}
)
with urllib.request.urlopen(req8) as resp8:
    data8 = json.loads(resp8.read().decode('utf-8'))
secA_students = data8.get("data", [{}])[0].get("students", [])
print("Test 8 Sem 5 Section A Student Count:", len(secA_students))
check(len(secA_students) >= 45, "Test 8: Section A roster intact (no partial replacement)")

print(f"\n=================================================================")
print(f"TEST SUMMARY: {passed} PASSED, {failed} FAILED")
print(f"=================================================================")
if failed > 0:
    sys.exit(1)
