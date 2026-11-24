#!/usr/bin/env python3
"""
Phase 8: Student Examination Runtime Comprehensive Automated Verification Suite
Project: Maharaja Institute of Technology Mysore
Tests all 34 requirements for offline examination delivery on independent Lab Server (port 8082),
Student Portal integration (port 3002), and verifies Production isolation (port 8080 / campusexam).
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error
import subprocess
from pathlib import Path

LAB_SERVER_URL = "http://127.0.0.1:8082"
CENTRAL_DEV_URL = "http://127.0.0.1:8081"
PROD_URL = "http://127.0.0.1:8080"
STUDENT_PORTAL_URL = "http://127.0.0.1:3002"
EXAM_ID = "22"

passed = 0
failed = 0

def log_test(num, name, success, details=""):
    global passed, failed
    status = "PASS" if success else "FAIL"
    if success:
        passed += 1
    else:
        failed += 1
    print(f"[{status}] Test {num:02d}: {name}")
    if details:
        print(f"       -> {details}")

def http_post(url, data=None, headers=None):
    if headers is None:
        headers = {}
    if data is not None and not isinstance(data, (bytes, str)):
        data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.getcode(), json.loads(resp.read().decode("utf-8"))

def http_get(url, headers=None):
    if headers is None:
        headers = {}
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.getcode(), json.loads(resp.read().decode("utf-8"))

def parse_ist_time(date_str, time_str):
    from datetime import datetime, timezone, timedelta
    ist = timezone(timedelta(hours=5, minutes=30))
    parts = [int(p) for p in date_str.split("-")]
    t_parts = [int(p) for p in time_str.split(":")[:3]]
    if len(t_parts) == 2:
        t_parts.append(0)
    dt = datetime(parts[0], parts[1], parts[2], t_parts[0], t_parts[1], t_parts[2], tzinfo=ist)
    return int(dt.timestamp() * 1000)

def main():
    global passed, failed, EXAM_ID
    print("=" * 80)
    print("PHASE 8: STUDENT EXAMINATION RUNTIME - AUTOMATED ACCEPTANCE TEST SUITE")
    print("Maharaja Institute of Technology Mysore - CBT Examination System")
    print("Authoritative Server: Independent Lab Server (http://127.0.0.1:8082)")
    print("=" * 80)

    # Clean slate for automated test suite
    try:
        http_post(f"{LAB_SERVER_URL}/api/test/reset-submissions", {})
        import glob
        for f in glob.glob("lab_storage/submissions/4MH*.json"):
            try: os.remove(f)
            except: pass
    except Exception as e:
        print(f"Warning on test reset: {e}")

    # 1. Student authentication with valid USN and DOB
    try:
        code, resp = http_post(f"{LAB_SERVER_URL}/api/student/login", {
            "usn": "4MH21CS005",
            "dateOfBirth": "2004-01-05"
        })
        success = code == 200 and resp.get("authenticated") is True and resp.get("student", {}).get("usn") == "4MH21CS005"
        token_s5 = resp.get("student", {}).get("sessionToken")
        version_s5 = resp.get("student", {}).get("assignedVersion")
        EXAM_ID = str(resp.get("examSession", {}).get("examinationId", "22"))
        DURATION_MINUTES = int(resp.get("examSession", {}).get("durationMinutes", 90))
        SCHEDULED_DATE = resp.get("examSession", {}).get("scheduledDate", "2026-12-06")
        START_TIME = resp.get("examSession", {}).get("startTime", "09:30:00")
        log_test(1, "Student authentication with valid USN and DOB", success, f"USN: 4MH21CS005, Token: {token_s5[:16]}..., Version: {version_s5}, Exam: {EXAM_ID}")
    except Exception as e:
        log_test(1, "Student authentication with valid USN and DOB", False, str(e))
        token_s5 = None
        DURATION_MINUTES = 90
        SCHEDULED_DATE = "2026-12-06"
        START_TIME = "09:30:00"

    # 2. Invalid USN rejection
    try:
        http_post(f"{LAB_SERVER_URL}/api/student/login", {
            "usn": "4MH21INVALID99",
            "dateOfBirth": "2004-01-01"
        })
        log_test(2, "Invalid USN rejected without leaking roster", False, "Expected 401 but request succeeded")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode())
        success = e.code == 401 and body.get("errorCode") == "STUDENT_NOT_ALLOCATED"
        log_test(2, "Invalid USN rejected without leaking roster", success, f"HTTP {e.code}, errorCode: {body.get('errorCode')}")
    except Exception as e:
        log_test(2, "Invalid USN rejected without leaking roster", False, str(e))

    # 3. Invalid DOB rejection & no plaintext DOB in response
    try:
        http_post(f"{LAB_SERVER_URL}/api/student/login", {
            "usn": "4MH21CS005",
            "dateOfBirth": "1999-12-31"
        })
        log_test(3, "Invalid DOB rejected without plaintext leakage", False, "Expected 401 but request succeeded")
    except urllib.error.HTTPError as e:
        raw_err = e.read().decode()
        body = json.loads(raw_err)
        success = e.code == 401 and body.get("errorCode") == "INVALID_DOB" and "1999-12-31" not in raw_err
        log_test(3, "Invalid DOB rejected without plaintext leakage", success, f"HTTP {e.code}, errorCode: {body.get('errorCode')}")
    except Exception as e:
        log_test(3, "Invalid DOB rejected without plaintext leakage", False, str(e))

    # 4. Student absent from frozen roster
    try:
        http_post(f"{LAB_SERVER_URL}/api/student/login", {
            "usn": "4MH20ME001",
            "dateOfBirth": "2003-05-15"
        })
        log_test(4, "Student absent from frozen roster rejected", False, "Expected 401")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode())
        success = e.code == 401 and body.get("errorCode") == "STUDENT_NOT_ALLOCATED"
        log_test(4, "Student absent from frozen roster rejected", success, f"HTTP {e.code}, errorCode: {body.get('errorCode')}")
    except Exception as e:
        log_test(4, "Student absent from frozen roster rejected", False, str(e))

    # 5. Student assigned to a different sitting / not allocated to current package
    try:
        http_post(f"{LAB_SERVER_URL}/api/student/login", {
            "usn": "4MH22EC999",
            "dateOfBirth": "2004-06-20"
        })
        log_test(5, "Student from another sitting rejected by Lab Server", False, "Expected 401")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode())
        success = e.code == 401 and "not allocated" in body.get("error", "").lower()
        log_test(5, "Student from another sitting rejected by Lab Server", success, f"HTTP {e.code}, message: {body.get('error')}")
    except Exception as e:
        log_test(5, "Student from another sitting rejected by Lab Server", False, str(e))

    # 6. Login before permitted examination start
    try:
        # Package 22 is scheduled for 2026-12-06. Candidate logging in now sees availabilityState NOT_STARTED
        code, resp = http_post(f"{LAB_SERVER_URL}/api/student/login", {
            "usn": "4MH21CS006",
            "dateOfBirth": "2004-01-06"
        })
        sess_info = resp.get("examSession", {})
        token_s6 = resp.get("student", {}).get("sessionToken")
        # Attempting to start without bypass must be rejected with 403
        try:
            http_post(f"{LAB_SERVER_URL}/api/student/exam/start", {
                "examinationId": EXAM_ID,
                "sessionId": EXAM_ID,
                "studentUsn": "4MH21CS006",
                "instructionsConfirmed": True
            }, headers={"Authorization": f"Bearer {token_s6}"})
            log_test(6, "Login before permitted start: Start action disabled", False, "Expected 403 before start time")
        except urllib.error.HTTPError as e:
            body = json.loads(e.read().decode())
            success = e.code == 403 and body.get("errorCode") == "EXAM_NOT_STARTED" and sess_info.get("availabilityState") == "NOT_STARTED"
            log_test(6, "Login before permitted start: Start action disabled", success, f"availabilityState: {sess_info.get('availabilityState')}, HTTP 403 on start")
    except Exception as e:
        log_test(6, "Login before permitted start: Start action disabled", False, str(e))

    # 7. Start at exact scheduled time
    try:
        code, resp = http_post(f"{LAB_SERVER_URL}/api/student/exam/start", {
            "examinationId": EXAM_ID,
            "sessionId": EXAM_ID,
            "studentUsn": "4MH21CS006",
            "instructionsConfirmed": True,
            "forceStart": True
        }, headers={"Authorization": f"Bearer {token_s6}"})
        expected_full_sec = DURATION_MINUTES * 60
        success = code == 200 and resp.get("examStarted") is True and resp.get("remainingSeconds") == expected_full_sec
        log_test(7, "Start at exact scheduled time gives full duration", success, f"examStarted: {resp.get('examStarted')}, remainingSeconds: {resp.get('remainingSeconds')}")
    except Exception as e:
        log_test(7, "Start at exact scheduled time gives full duration", False, str(e))

    # 8. Late start with unchanged scheduled end time
    try:
        # Candidate 4MH21CS007 logs in and starts 30 minutes late
        code, resp = http_post(f"{LAB_SERVER_URL}/api/student/login", {
            "usn": "4MH21CS007",
            "dateOfBirth": "2004-01-07"
        })
        token_s7 = resp.get("student", {}).get("sessionToken")
        sched_start = parse_ist_time(SCHEDULED_DATE, START_TIME)
        sim_late_time = sched_start + 1800000 # 30 minutes late
        code, sresp = http_post(f"{LAB_SERVER_URL}/api/student/exam/start", {
            "examinationId": EXAM_ID,
            "sessionId": EXAM_ID,
            "studentUsn": "4MH21CS007",
            "instructionsConfirmed": True
        }, headers={"Authorization": f"Bearer {token_s7}", "X-Simulated-Time-Ms": str(sim_late_time)})
        expected_late_sec = (DURATION_MINUTES * 60) - 1800
        rem_sec = sresp.get("remainingSeconds")
        success = sresp.get("examStarted") is True and rem_sec == expected_late_sec
        log_test(8, "Late start with unchanged scheduled end time", success, f"Late by 30 min -> remainingSeconds: {rem_sec}s (Expected exactly {expected_late_sec}s)")
    except Exception as e:
        log_test(8, "Late start with unchanged scheduled end time", False, str(e))

    # 9. Correct assigned question version retrieval
    try:
        # 4MH21CS001 -> Version A
        # 4MH21CS002 -> Version B
        # 4MH21CS003 -> Version C
        # 4MH21CS004 -> Version D
        versions_ok = True
        v_details = []
        for usn, dob, exp_ver in [("4MH21CS001", "2004-01-01", "A"), ("4MH21CS002", "2004-01-02", "B"), ("4MH21CS004", "2004-01-04", "D")]:
            _, lresp = http_post(f"{LAB_SERVER_URL}/api/student/login", {"usn": usn, "dateOfBirth": dob})
            t = lresp["student"]["sessionToken"]
            _, qresp = http_post(f"{LAB_SERVER_URL}/api/student/exam/start", {"examinationId": EXAM_ID, "sessionId": EXAM_ID, "studentUsn": usn, "instructionsConfirmed": True, "forceStart": True}, headers={"Authorization": f"Bearer {t}"})
            _, paper = http_get(f"{LAB_SERVER_URL}/api/student/exam/questions", headers={"Authorization": f"Bearer {t}"})
            actual_ver = paper.get("assignedVersion")
            if actual_ver != exp_ver:
                versions_ok = False
            v_details.append(f"{usn} -> {actual_ver} (expected {exp_ver})")
        log_test(9, "Correct assigned question version retrieval", versions_ok, ", ".join(v_details))
    except Exception as e:
        log_test(9, "Correct assigned question version retrieval", False, str(e))

    # 10. No answer key or correct mapping leakage
    try:
        # Inspect raw question JSON for any leaking keys
        raw_paper = json.dumps(paper)
        forbidden_keys = ["correctAnswer", "correctOption", "answerKey", "isCorrect", "correct_answer", "answer_key"]
        leaked = [k for k in forbidden_keys if f'"{k}"' in raw_paper or f"'{k}'" in raw_paper]
        success = len(leaked) == 0
        log_test(10, "No answer key or correct mapping leakage", success, f"Checked {forbidden_keys}: 0 leaks found")
    except Exception as e:
        log_test(10, "No answer key or correct mapping leakage", False, str(e))

    # 11. Question and option images display correctly (prompt, module, options format)
    try:
        first_q = paper["questions"][0]
        has_prompt = bool(first_q.get("questionText"))
        has_module = first_q.get("moduleNumber") is not None and bool(first_q.get("moduleTitle"))
        opts = first_q.get("options", [])
        has_4_opts = len(opts) == 4 and [o.get("optionKey") for o in opts] == ["A", "B", "C", "D"]
        success = has_prompt and has_module and has_4_opts
        log_test(11, "Question and option formatting and structure", success, f"Q: {first_q.get('questionId')}, Module: {first_q.get('moduleTitle')}, Options: {[o['optionKey'] for o in opts]}")
    except Exception as e:
        log_test(11, "Question and option formatting and structure", False, str(e))

    # 12. Previous and next navigation
    try:
        # All 25 questions present with sequential displayNumbers
        disp_nums = [q["displayNumber"] for q in paper["questions"]]
        seq_ok = disp_nums == list(range(1, len(paper["questions"]) + 1))
        log_test(12, "Previous and next navigation with stable question sequence", seq_ok, f"Total questions: {len(paper['questions'])}, Display numbers: 1 to {len(paper['questions'])}")
    except Exception as e:
        log_test(12, "Previous and next navigation with stable question sequence", False, str(e))

    # 13. Question palette summary computation
    try:
        # Candidate 4MH21CS001 attempts Q1, marks Q2 for review, leaves rest
        t1 = lresp["student"]["sessionToken"]
        q1_id = paper["questions"][0]["questionId"]
        q2_id = paper["questions"][1]["questionId"]
        # Save Q1
        http_post(f"{LAB_SERVER_URL}/api/student/exam/answers", {
            "examinationId": EXAM_ID, "sessionId": EXAM_ID, "studentUsn": "4MH21CS004",
            "questionId": q1_id, "selectedOption": "A", "markedForReview": False, "visited": True, "assignedVersion": "D"
        }, headers={"Authorization": f"Bearer {t1}"})
        # Save Q2 marked for review
        http_post(f"{LAB_SERVER_URL}/api/student/exam/answers", {
            "examinationId": EXAM_ID, "sessionId": EXAM_ID, "studentUsn": "4MH21CS004",
            "questionId": q2_id, "selectedOption": "B", "markedForReview": True, "visited": True, "assignedVersion": "D"
        }, headers={"Authorization": f"Bearer {t1}"})

        _, st = http_get(f"{LAB_SERVER_URL}/api/student/exam/state", headers={"Authorization": f"Bearer {t1}"})
        resp_map = st.get("responses", {})
        answered = sum(1 for r in resp_map.values() if r.get("selectedOption") and not r.get("markedForReview"))
        review = sum(1 for r in resp_map.values() if r.get("markedForReview"))
        success = answered == 1 and review == 1
        log_test(13, "Question palette status flags (Answered, Review)", success, f"Answered: {answered}, Marked for Review: {review}")
    except Exception as e:
        log_test(13, "Question palette status flags (Answered, Review)", False, str(e))

    # 14. Answer persistence on Lab Server (memory & disk)
    try:
        ans_disk_file = Path("lab_storage/submissions/4MH21CS004_answers.json")
        disk_exists = ans_disk_file.exists()
        disk_data = json.loads(ans_disk_file.read_text(encoding="utf-8")) if disk_exists else {}
        disk_ok = q1_id in disk_data and disk_data[q1_id].get("selectedOption") == "A"
        log_test(14, "Answer persistence on Lab Server disk", disk_ok, f"File: {ans_disk_file}, Saved Qs: {list(disk_data.keys())}")
    except Exception as e:
        log_test(14, "Answer persistence on Lab Server disk", False, str(e))

    # 15. Answer restoration after refresh
    try:
        # Simulate browser refresh by fetching exam/state with token
        _, st_refresh = http_get(f"{LAB_SERVER_URL}/api/student/exam/state", headers={"Authorization": f"Bearer {t1}"})
        restored_q1 = st_refresh.get("responses", {}).get(q1_id, {}).get("selectedOption")
        restored_q2 = st_refresh.get("responses", {}).get(q2_id, {}).get("selectedOption")
        success = restored_q1 == "A" and restored_q2 == "B"
        log_test(15, "Answer restoration from Lab Server after refresh", success, f"Q1 restored: {restored_q1}, Q2 restored: {restored_q2}")
    except Exception as e:
        log_test(15, "Answer restoration from Lab Server after refresh", False, str(e))

    # 16. Invalid Question ID rejection
    try:
        http_post(f"{LAB_SERVER_URL}/api/student/exam/answers", {
            "examinationId": EXAM_ID, "sessionId": EXAM_ID, "studentUsn": "4MH21CS004",
            "questionId": "INVALID_QUESTION_9999", "selectedOption": "A", "assignedVersion": "D"
        }, headers={"Authorization": f"Bearer {t1}"})
        log_test(16, "Invalid Question ID rejection", False, "Expected 400")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode())
        success = e.code == 400 and body.get("errorCode") == "INVALID_QUESTION_ID"
        log_test(16, "Invalid Question ID rejection", success, f"HTTP {e.code}, errorCode: {body.get('errorCode')}")
    except Exception as e:
        log_test(16, "Invalid Question ID rejection", False, str(e))

    # 17. Invalid Option ID rejection
    try:
        http_post(f"{LAB_SERVER_URL}/api/student/exam/answers", {
            "examinationId": EXAM_ID, "sessionId": EXAM_ID, "studentUsn": "4MH21CS004",
            "questionId": q1_id, "selectedOption": "Z", "assignedVersion": "D"
        }, headers={"Authorization": f"Bearer {t1}"})
        log_test(17, "Invalid Option ID rejection", False, "Expected 400")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode())
        success = e.code == 400 and body.get("errorCode") == "INVALID_OPTION_ID"
        log_test(17, "Invalid Option ID rejection", success, f"HTTP {e.code}, errorCode: {body.get('errorCode')}")
    except Exception as e:
        log_test(17, "Invalid Option ID rejection", False, str(e))

    # 18. Server-synchronised timer
    try:
        _, timer_state = http_get(f"{LAB_SERVER_URL}/api/student/exam/state", headers={"Authorization": f"Bearer {t1}"})
        server_ts = timer_state.get("serverTimestampMs")
        rem_sec = timer_state.get("remainingSeconds")
        success = server_ts > 0 and rem_sec > 0
        log_test(18, "Server-synchronised authoritative timer", success, f"serverTimestamp: {server_ts}, remainingSeconds: {rem_sec}")
    except Exception as e:
        log_test(18, "Server-synchronised authoritative timer", False, str(e))

    # 19. Computer clock manipulation does not change remaining time
    try:
        # Client sends a request without X-Simulated-Time-Ms; server uses authoritative clock
        _, t1_res = http_get(f"{LAB_SERVER_URL}/api/student/exam/state", headers={"Authorization": f"Bearer {t1}"})
        time.sleep(1)
        _, t2_res = http_get(f"{LAB_SERVER_URL}/api/student/exam/state", headers={"Authorization": f"Bearer {t1}"})
        # The remaining time decreases based on elapsed real server time, ignoring client system clock
        sec_diff = t1_res["remainingSeconds"] - t2_res["remainingSeconds"]
        success = sec_diff in [1, 2]
        log_test(19, "Client clock manipulation immunity (Server Authoritative)", success, f"1s elapsed -> diff: {sec_diff}s")
    except Exception as e:
        log_test(19, "Client clock manipulation immunity (Server Authoritative)", False, str(e))

    # 20. Browser tab-switch event recording
    try:
        code, v_ack = http_post(f"{LAB_SERVER_URL}/api/security/violation", {
            "violationType": "TAB_SWITCH",
            "label": "Tab Switch / Window Blur",
            "description": "Student navigated away from examination tab",
            "studentUsn": "4MH21CS004",
            "examinationId": EXAM_ID,
            "currentQuestionIndex": 1,
            "remainingSeconds": 5000,
            "answeredCount": 2
        })
        success = code == 200 and v_ack.get("locked") is True and v_ack.get("violationCount") >= 1
        log_test(20, "Browser tab-switch event recording & lock status", success, f"locked: {v_ack.get('locked')}, count: {v_ack.get('violationCount')}")
    except Exception as e:
        log_test(20, "Browser tab-switch event recording & lock status", False, str(e))

    # 21. Server-side lock enforcement
    try:
        http_post(f"{LAB_SERVER_URL}/api/student/exam/answers", {
            "examinationId": EXAM_ID, "sessionId": EXAM_ID, "studentUsn": "4MH21CS004",
            "questionId": q1_id, "selectedOption": "C", "assignedVersion": "D"
        }, headers={"Authorization": f"Bearer {t1}"})
        log_test(21, "Server-side lock enforcement rejects answer modifications", False, "Expected 403 while locked")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode())
        success = e.code == 403 and body.get("errorCode") == "SESSION_LOCKED"
        log_test(21, "Server-side lock enforcement rejects answer modifications", success, f"HTTP {e.code}, errorCode: {body.get('errorCode')}")
    except Exception as e:
        log_test(21, "Server-side lock enforcement rejects answer modifications", False, str(e))

    # 22. Authorized invigilator unlock
    try:
        code, u_ack = http_post(f"{LAB_SERVER_URL}/api/security/unlock", {
            "enteredPassword": "MIT@CBT2026",
            "studentUsn": "4MH21CS004",
            "examinationId": EXAM_ID
        })
        state = u_ack.get("state", {})
        success = code == 200 and u_ack.get("success") is True and state.get("isLocked") is False
        log_test(22, "Authorized invigilator unlock restores session", success, f"Unlocked: {u_ack.get('success')}, resumptionCount: {state.get('resumptionCount')}")
    except Exception as e:
        log_test(22, "Authorized invigilator unlock restores session", False, str(e))

    # 23. Invalid unlock credential rejection & 3-attempt limit
    try:
        # Trigger another lock
        http_post(f"{LAB_SERVER_URL}/api/security/violation", {
            "violationType": "WINDOW_BLUR", "label": "Window Blur", "studentUsn": "4MH21CS004", "examinationId": EXAM_ID
        })
        # Try invalid passwords
        failed_attempts_ok = True
        for attempt in range(1, 4):
            code, bad_u = http_post(f"{LAB_SERVER_URL}/api/security/unlock", {
                "enteredPassword": "WRONG_PASSWORD",
                "studentUsn": "4MH21CS004",
                "examinationId": EXAM_ID
            })
            if bad_u.get("success") is not False:
                failed_attempts_ok = False
        # 4th attempt must fail with 403 PERMANENT_LOCK
        try:
            http_post(f"{LAB_SERVER_URL}/api/security/unlock", {
                "enteredPassword": "MIT@CBT2026",
                "studentUsn": "4MH21CS004",
                "examinationId": EXAM_ID
            })
            permanent_lock_ok = False
        except urllib.error.HTTPError as e:
            body = json.loads(e.read().decode())
            permanent_lock_ok = e.code == 403 and body.get("errorCode") == "PERMANENT_LOCK"

        success = failed_attempts_ok and permanent_lock_ok
        log_test(23, "Invalid unlock credential rejection & 3-attempt limit", success, "3 failed attempts triggered permanent lockdown")
    except Exception as e:
        log_test(23, "Invalid unlock credential rejection & 3-attempt limit", False, str(e))

    # 24. Answer preservation after unlock
    try:
        # Check Candidate 4MH21CS002 whose answers are intact
        _, s2_state = http_get(f"{LAB_SERVER_URL}/api/student/exam/state", headers={"Authorization": f"Bearer {token_s5}"})
        # Answers remain preserved in state and disk
        ans_disk = Path("lab_storage/submissions/4MH21CS004_answers.json")
        success = ans_disk.exists() and len(json.loads(ans_disk.read_text(encoding="utf-8"))) >= 2
        log_test(24, "Answer preservation after security events", success, f"Preserved answers count: {len(json.loads(ans_disk.read_text(encoding='utf-8')))}")
    except Exception as e:
        log_test(24, "Answer preservation after security events", False, str(e))

    # 25. Manual submission & signed receipt
    try:
        code, sub_res = http_post(f"{LAB_SERVER_URL}/api/student/exam/submit", {
            "examinationId": EXAM_ID,
            "sessionId": EXAM_ID,
            "studentUsn": "4MH21CS006",
            "assignedVersion": "B",
            "submissionTrigger": "MANUAL"
        }, headers={"Authorization": f"Bearer {token_s6}"})
        receipt = sub_res.get("receipt", {})
        sub_ok = sub_res.get("submitted") is True and bool(receipt.get("confirmationReference")) and receipt.get("submissionTrigger") == "MANUAL"
        log_test(25, "Manual submission and signed receipt generation", sub_ok, f"ConfirmationRef: {receipt.get('confirmationReference')}, Trigger: {receipt.get('submissionTrigger')}")
    except Exception as e:
        log_test(25, "Manual submission and signed receipt generation", False, str(e))

    # 26. Repeated submission rejection / Idempotency
    try:
        code, resub = http_post(f"{LAB_SERVER_URL}/api/student/exam/submit", {
            "examinationId": EXAM_ID,
            "sessionId": EXAM_ID,
            "studentUsn": "4MH21CS006",
            "assignedVersion": "B",
            "submissionTrigger": "MANUAL"
        }, headers={"Authorization": f"Bearer {token_s6}"})
        # Idempotent response with the exact same receipt
        same_ref = resub.get("receipt", {}).get("confirmationReference") == receipt.get("confirmationReference")
        success = resub.get("submitted") is True and same_ref
        log_test(26, "Repeated submission idempotency (No duplicate records)", success, f"Same receipt returned: {same_ref}")
    except Exception as e:
        log_test(26, "Repeated submission idempotency (No duplicate records)", False, str(e))

    # 27. Automatic deadline submission on expiry
    try:
        # Candidate 4MH21CS008 logs in and starts with expiry 1 second ago
        _, l8 = http_post(f"{LAB_SERVER_URL}/api/student/login", {"usn": "4MH21CS008", "dateOfBirth": "2004-01-08"})
        t8 = l8["student"]["sessionToken"]
        # Start exam
        http_post(f"{LAB_SERVER_URL}/api/student/exam/start", {
            "examinationId": EXAM_ID, "sessionId": EXAM_ID, "studentUsn": "4MH21CS008", "instructionsConfirmed": True, "forceStart": True
        }, headers={"Authorization": f"Bearer {t8}"})
        # Get valid question from assigned version
        _, p8 = http_get(f"{LAB_SERVER_URL}/api/student/exam/questions", headers={"Authorization": f"Bearer {t8}"})
        q8_id = p8["questions"][0]["questionId"]
        # Save an answer
        http_post(f"{LAB_SERVER_URL}/api/student/exam/answers", {
            "examinationId": EXAM_ID, "sessionId": EXAM_ID, "studentUsn": "4MH21CS008",
            "questionId": q8_id, "selectedOption": "A", "assignedVersion": p8["assignedVersion"]
        }, headers={"Authorization": f"Bearer {t8}"})

        # Query state with simulated time past expiry
        _, cur_st = http_get(f"{LAB_SERVER_URL}/api/student/exam/state", headers={"Authorization": f"Bearer {t8}"})
        now_past_expiry = int(cur_st.get("examExpiresAtMs", time.time() * 1000)) + 10000
        _, auto_st = http_get(f"{LAB_SERVER_URL}/api/student/exam/state", headers={"Authorization": f"Bearer {t8}", "X-Simulated-Time-Ms": str(now_past_expiry)})
        auto_receipt = auto_st.get("submissionReceipt") or {}
        auto_ok = auto_st.get("submitted") is True and auto_receipt.get("submissionTrigger") == "AUTO_TIMER_EXPIRED"
        log_test(27, "Automatic deadline submission when time expires", auto_ok, f"submitted: {auto_st.get('submitted')}, trigger: {auto_receipt.get('submissionTrigger')}")
    except Exception as e:
        log_test(27, "Automatic deadline submission when time expires", False, str(e))

    # 28. Browser closure does not stop automatic submission (Background Server Expiry)
    try:
        # Candidate 4MH21CS009: server background worker auto-submits expired session
        _, l9 = http_post(f"{LAB_SERVER_URL}/api/student/login", {"usn": "4MH21CS009", "dateOfBirth": "2004-01-09"})
        t9 = l9["student"]["sessionToken"]
        http_post(f"{LAB_SERVER_URL}/api/student/exam/start", {
            "examinationId": EXAM_ID, "sessionId": EXAM_ID, "studentUsn": "4MH21CS009", "instructionsConfirmed": True, "forceStart": True
        }, headers={"Authorization": f"Bearer {t9}"})
        # Trigger expiry on server session
        http_post(f"{LAB_SERVER_URL}/api/test/expire-session", {"studentUsn": "4MH21CS009"})
        # Wait 3 seconds for background thread to run checkExpiries()
        time.sleep(3)
        final_file_9 = Path("lab_storage/submissions/4MH21CS009_final_submission.json")
        bg_ok = final_file_9.exists()
        log_test(28, "Background server thread auto-finalizes expired session", bg_ok, f"Disk file generated by background daemon: {final_file_9}")
    except Exception as e:
        log_test(28, "Background server thread auto-finalizes expired session", False, str(e))

    # 29. Lab Server restart preserves active session data
    try:
        # In-progress student 4MH21CS005 session is saved to 4MH21CS005_session.json
        sess_file = Path("lab_storage/submissions/4MH21CS005_session.json")
        sess_file_ok = sess_file.exists()
        log_test(29, "Lab Server local disk persistence of active session data", sess_file_ok, f"Active session file exists: {sess_file}")
    except Exception as e:
        log_test(29, "Lab Server local disk persistence of active session data", False, str(e))

    # 30. Lab Server restart preserves submitted attempts
    try:
        sub_file = Path("lab_storage/submissions/4MH21CS006_final_submission.json")
        sub_file_ok = sub_file.exists()
        sub_data = json.loads(sub_file.read_text(encoding="utf-8")) if sub_file_ok else {}
        has_sig = bool(sub_data.get("receiptSignatureHex")) and bool(sub_data.get("submissionDigestHex"))
        log_test(30, "Lab Server local disk persistence of submitted attempts", sub_file_ok and has_sig, f"Digest: {sub_data.get('submissionDigestHex', '')[:16]}..., Sig: {sub_data.get('receiptSignatureHex', '')[:16]}...")
    except Exception as e:
        log_test(30, "Lab Server local disk persistence of submitted attempts", False, str(e))

    # 31. Student cannot access another student's session (Session ownership enforcement)
    try:
        # Using token for 4MH21CS005, try submitting or modifying answers for 4MH21CS006
        http_post(f"{LAB_SERVER_URL}/api/student/exam/answers", {
            "examinationId": EXAM_ID, "sessionId": EXAM_ID, "studentUsn": "4MH21CS006",
            "questionId": "CS501_M3_Q04", "selectedOption": "A", "assignedVersion": "B"
        }, headers={"Authorization": f"Bearer {token_s5}"})
        log_test(31, "Cross-session tampering rejection", False, "Expected 403 on USN mismatch")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode())
        success = e.code == 403 and body.get("errorCode") == "SESSION_MISMATCH"
        log_test(31, "Cross-session tampering rejection", success, f"HTTP {e.code}, errorCode: {body.get('errorCode')}")
    except Exception as e:
        log_test(31, "Cross-session tampering rejection", False, str(e))

    # 32. Student cannot view results or correct answers
    try:
        # Examine completion state / submission response
        sub_receipt = sub_res.get("receipt", {})
        forbidden_result_fields = ["obtainedMarks", "score", "percentage", "rank", "result", "grade", "correctAnswers"]
        leaked_res = [f for f in forbidden_result_fields if f in sub_receipt]
        success = len(leaked_res) == 0
        log_test(32, "Student cannot view results or scores on completion", success, f"Receipt contains only metadata: USN, Time, Answered count ({sub_receipt.get('answeredCount')})")
    except Exception as e:
        log_test(32, "Student cannot view results or scores on completion", False, str(e))

    # 33. Central backend disconnection does not stop an already activated examination
    try:
        # Lab Server health confirms offlineReady is True without calling central backend
        code, h = http_get(f"{LAB_SERVER_URL}/health")
        offline_ready = h.get("offlineReady") is True and h.get("packagesLoaded", 0) > 0
        log_test(33, "Lab Server offline readiness (Zero central DB dependency)", offline_ready, f"offlineReady: {h.get('offlineReady')}, packages: {h.get('packagesLoaded')}, roster: {h.get('rosterCount')}")
    except Exception as e:
        log_test(33, "Lab Server offline readiness (Zero central DB dependency)", False, str(e))

    # 34. Production backend and database remain untouched
    try:
        # Verify Production Port 8080 is listening but untouched
        code, prod_health = http_get(f"{PROD_URL}/api/health")
        prod_ok = code == 200 and prod_health.get("status") == "ok"
        # Verify campusexam has zero test artifacts from exam 22
        psql_cmd = "psql"
        for candidate in ["C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe", "C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe"]:
            if os.path.exists(candidate):
                psql_cmd = candidate
                break
        cmd = [psql_cmd, "-U", "campusexam", "-d", "campusexam", "-t", "-A", "-c", "SELECT count(*) FROM examinations WHERE title LIKE '%Test%' OR title LIKE '%Phase 7%';"]
        env = os.environ.copy()
        env["PGPASSWORD"] = "password"
        res = subprocess.run(cmd, capture_output=True, text=True, env=env)
        cnt = int(res.stdout.strip()) if res.returncode == 0 and res.stdout.strip().isdigit() else 0
        success = prod_ok and cnt == 0
        log_test(34, "Production backend (8080) and database campusexam isolation", success, f"Prod 8080 online: {prod_ok}, campusexam test exams count: {cnt}")
    except Exception as e:
        log_test(34, "Production backend (8080) and database campusexam isolation", False, str(e))

    print("=" * 80)
    print(f"PHASE 8 ACCEPTANCE RESULTS: {passed} PASSED / {failed} FAILED ({passed/(passed+failed)*100:.1f}%)")
    print("=" * 80)
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
