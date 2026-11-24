import os
import subprocess
import sys
import time
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = "http://127.0.0.1:8080/api"
PASSWD = "password1234"

def get_token(username, password):
    r = requests.post(f"{BASE_URL}/login", data={"username": username, "password": password}, headers={"Content-Type": "application/x-www-form-urlencoded"})
    if r.status_code == 200:
        return r.json().get("token")
    return None

def publish_exam(admin_token, title, duration_sec=3600, opens_offset_sec=-120, closes_offset_sec=3600, attempts=1, bank_id=1, group_id=1):
    now = datetime.now(timezone.utc)
    opens = (now + timedelta(seconds=opens_offset_sec)).strftime("%Y-%m-%dT%H:%M:%SZ")
    closes = (now + timedelta(seconds=closes_offset_sec)).strftime("%Y-%m-%dT%H:%M:%SZ")
    res = requests.post(
        f"{BASE_URL}/publish",
        headers={"Authorization": f"Bearer {admin_token}", "Content-Type": "application/x-www-form-urlencoded"},
        data={
            "bank": str(bank_id),
            "title": title,
            "instructions": "Automated Test Suite Exam",
            "mode": "PRACTICE",
            "duration": str(duration_sec),
            "attempts": str(attempts),
            "opens": opens,
            "closes": closes,
            "pass": "1",
            "easy": "1",
            "medium": "0",
            "hard": "0",
            "groups": str(group_id),
        }
    )
    if res.status_code == 200:
        return res.json().get("id")
    return None

def start_attempt(student_token, exam_id):
    res = requests.post(
        f"{BASE_URL}/start",
        headers={"Authorization": f"Bearer {student_token}", "Content-Type": "application/x-www-form-urlencoded"},
        data={"exam": str(exam_id)}
    )
    if res.status_code == 200:
        return res.json().get("id")
    return None

def main():
    print("=" * 70)
    print("  TESTSPRITE AUTOMATED TEST SUITE EXECUTION (TC001 - TC010)")
    print("=" * 70)

    admin_token = get_token("admin", PASSWD)
    student_token = get_token("student", PASSWD)
    observer_token = get_token("observer", PASSWD)

    tests = [
        ("TC001", "TC001_verify_system_health_and_authenticated_identity_lifecycle.py", {}),
        ("TC002", "TC002_verify_institutional_administration_and_access_control.py", {}),
        ("TC003", "TC003_verify_faculty_scopes_and_question_bank_authoring.py", {}),
        ("TC004", "TC004_verify_question_bank_approval_transitions.py", {}),
        ("TC005", "TC005_verify_exam_publication_and_visibility.py", {"EMPTY_GROUP_ID": "3"}),
        ("TC006", "TC006_verify_student_exam_start_and_attempt_content.py", {}),
        ("TC007", "TC007_verify_answer_autosave_and_concurrency_protection.py", {}),
        ("TC008", "TC008_verify_attempt_heartbeat_and_submission.py", {}),
        ("TC009", "TC009_verify_score_release_prerequisites_and_answer_unmasking.py", {}),
        ("TC010", "TC010_verify_live_exam_monitoring_permissions.py", {}),
    ]

    base_env = os.environ.copy()
    base_env.update({
        "CAMPUSEXAM_USERNAME": "admin",
        "CAMPUSEXAM_PASSWORD": PASSWD,
        "CAMPUS_ADMIN_USERNAME": "admin",
        "CAMPUS_ADMIN_PASSWORD": PASSWD,
        "ADMIN_USERNAME": "admin",
        "ADMIN_PASSWORD": PASSWD,
        "TEST_ADMIN_USERNAME": "admin",
        "TEST_ADMIN_PASSWORD": PASSWD,
        "FACULTY_USERNAME": "faculty",
        "FACULTY_PASSWORD": PASSWD,
        "TEST_FACULTY_USERNAME": "faculty",
        "TEST_FACULTY_PASSWORD": PASSWD,
        "STUDENT_USERNAME": "student",
        "STUDENT_PASSWORD": PASSWD,
        "OBSERVER_USERNAME": "observer",
        "OBSERVER_PASSWORD": PASSWD,
        "ANSWER_VERSION": "1",
    })

    results = []

    for test_id, script_name, extra_env in tests:
        script_path = os.path.join("testsprite_tests", script_name)
        env = base_env.copy()
        env.update(extra_env)

        # Dynamic fixtures for TC007, TC008, TC009, TC010
        if test_id in ("TC007", "TC008"):
            exam_id = publish_exam(admin_token, f"Fresh Exam for {test_id} {int(time.time())}", duration_sec=3600, attempts=5)
            env["EXAM_ID"] = str(exam_id)
        elif test_id == "TC009":
            # Closes in 10 seconds so release window transition can be validated
            exam_id = publish_exam(admin_token, f"Release Exam {test_id} {int(time.time())}", duration_sec=60, opens_offset_sec=-120, closes_offset_sec=10, attempts=1)
            attempt_id = start_attempt(student_token, exam_id)
            env["EXAM_ID"] = str(exam_id)
            env["ATTEMPT_ID"] = str(attempt_id)
        elif test_id == "TC010":
            exam_id = publish_exam(admin_token, f"Monitor Exam {test_id} {int(time.time())}", duration_sec=3600, attempts=1)
            attempt_id = start_attempt(student_token, exam_id)
            requests.post(f"{BASE_URL}/heartbeat", headers={"Authorization": f"Bearer {student_token}", "Content-Type": "application/x-www-form-urlencoded"}, data={"attempt": str(attempt_id), "pending": 0})
            env["EXAM_ID"] = str(exam_id)

        print(f"Running {test_id}: {script_name} ...", end=" ", flush=True)
        t0 = time.time()
        proc = subprocess.run([sys.executable, script_path], env=env, capture_output=True, text=True)
        duration = time.time() - t0

        if proc.returncode == 0:
            print(f"PASSED ({duration:.2f}s)")
            results.append((test_id, script_name, "PASSED", duration, ""))
        else:
            err = proc.stderr.strip() or proc.stdout.strip()
            last_line = err.splitlines()[-1] if err.splitlines() else "Unknown error"
            print(f"FAILED ({duration:.2f}s) -> {last_line}")
            results.append((test_id, script_name, "FAILED", duration, last_line))

    print("\n" + "=" * 70)
    print("  FINAL TEST RESULTS SUMMARY")
    print("=" * 70)
    passed_count = sum(1 for r in results if r[2] == "PASSED")
    total_count = len(results)
    for test_id, script_name, status, duration, err in results:
        status_str = "PASS" if status == "PASSED" else "FAIL"
        err_str = f" | Error: {err}" if err else ""
        print(f"  [{status_str}] {test_id} ({duration:.2f}s) - {script_name}{err_str}")
    print("-" * 70)
    print(f"  TOTAL: {passed_count}/{total_count} PASSED ({passed_count/total_count*100:.1f}%)")
    print("=" * 70)

    if passed_count != total_count:
        sys.exit(1)

if __name__ == "__main__":
    main()
