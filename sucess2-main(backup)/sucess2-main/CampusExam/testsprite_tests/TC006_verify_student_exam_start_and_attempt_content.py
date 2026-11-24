import requests
from datetime import datetime, timezone


def test_student_exam_start_and_attempt_content():
    base_url = "http://127.0.0.1:8080/api"
    timeout = 30
    form_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    session = requests.Session()
    tokens = {}
    attempt_id = None
    exam_id = None

    def response_json(response):
        try:
            return response.json()
        except ValueError:
            return {}

    def extract_records(payload):
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict):
            for key in ("exams", "items", "data", "results"):
                if isinstance(payload.get(key), list):
                    return payload[key]
        return []

    def get_identifier(record):
        if isinstance(record, dict):
            return record.get("id", record.get("examId"))
        return None

    def parse_datetime(value):
        if not isinstance(value, str) or not value.strip():
            return None
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
        except ValueError:
            return None

    def masked_answer_fields(value):
        fields = {"correct", "answer", "answerkey", "correctanswer", "explanation"}
        if isinstance(value, dict):
            for key, field_value in value.items():
                normalized_key = str(key).replace("_", "").replace("-", "").lower()
                if normalized_key in fields:
                    assert field_value in (None, "", 0, False), (
                        f"Answer data must be masked before score release: {key}={field_value!r}"
                    )
                masked_answer_fields(field_value)
        elif isinstance(value, list):
            for item in value:
                masked_answer_fields(item)

    try:
        for username in ("admin", "student"):
            login_response = session.post(
                f"{base_url}/login",
                data={"username": username, "password": "password1234"},
                headers=form_headers,
                timeout=timeout,
            )
            assert login_response.status_code == 200, (
                f"Login for {username} failed: {login_response.status_code} "
                f"{login_response.text}"
            )
            login_data = response_json(login_response)
            assert login_data.get("token"), f"Login for {username} did not return a token"
            tokens[username] = login_data["token"]

        student_headers = {"Authorization": f"Bearer {tokens['student']}"}
        admin_headers = {"Authorization": f"Bearer {tokens['admin']}"}

        student_exams_response = session.get(
            f"{base_url}/exams", headers=student_headers, timeout=timeout
        )
        assert student_exams_response.status_code == 200, (
            f"Could not list student exams: {student_exams_response.status_code} "
            f"{student_exams_response.text}"
        )
        student_exams = extract_records(response_json(student_exams_response))
        assert student_exams, "Student has no assigned exams to test"

        now = datetime.now(timezone.utc)
        available_exams = []
        for exam in student_exams:
            opens = parse_datetime(exam.get("opens")) if isinstance(exam, dict) else None
            closes = parse_datetime(exam.get("closes")) if isinstance(exam, dict) else None
            if (opens is None or opens <= now) and (closes is None or closes >= now):
                available_exams.append(exam)
        assert available_exams, "No assigned exam is currently within its availability window"

        exam_id = get_identifier(available_exams[0])
        assert exam_id is not None, "Assigned exam does not contain an exam identifier"

        start_response = session.post(
            f"{base_url}/start",
            data={"exam": exam_id},
            headers={**student_headers, **form_headers},
            timeout=timeout,
        )
        assert start_response.status_code == 200, (
            f"Starting assigned exam failed: {start_response.status_code} "
            f"{start_response.text}"
        )
        start_data = response_json(start_response)
        attempt_id = start_data.get("id", start_data.get("attempt"))
        assert attempt_id is not None, "Starting the exam did not return an attempt identifier"

        attempt_response = session.get(
            f"{base_url}/attempt",
            params={"attempt": attempt_id},
            headers=student_headers,
            timeout=timeout,
        )
        assert attempt_response.status_code == 200, (
            f"Loading exam attempt failed: {attempt_response.status_code} "
            f"{attempt_response.text}"
        )
        attempt_data = response_json(attempt_response)
        assert isinstance(attempt_data, (dict, list)), "Attempt response has an invalid format"
        masked_answer_fields(attempt_data)

        all_exams_response = session.get(
            f"{base_url}/exams", headers=admin_headers, timeout=timeout
        )
        assert all_exams_response.status_code == 200, (
            f"Could not list exams as admin: {all_exams_response.status_code} "
            f"{all_exams_response.text}"
        )
        all_exams = extract_records(response_json(all_exams_response))
        student_exam_ids = {str(get_identifier(exam)) for exam in student_exams}
        unassigned_exam_id = next(
            (
                get_identifier(exam)
                for exam in all_exams
                if get_identifier(exam) is not None
                and str(get_identifier(exam)) not in student_exam_ids
            ),
            None,
        )
        if unassigned_exam_id is None:
            known_ids = [
                int(value)
                for value in student_exam_ids
                if value.isdigit()
            ]
            unassigned_exam_id = max(known_ids, default=0) + 1000000

        unassigned_response = session.post(
            f"{base_url}/start",
            data={"exam": unassigned_exam_id},
            headers={**student_headers, **form_headers},
            timeout=timeout,
        )
        assert unassigned_response.status_code == 404, (
            f"Starting an unassigned exam should return 404, got "
            f"{unassigned_response.status_code}: {unassigned_response.text}"
        )

        unavailable_exam = None
        for exam in student_exams:
            if not isinstance(exam, dict) or get_identifier(exam) is None:
                continue
            opens = parse_datetime(exam.get("opens"))
            closes = parse_datetime(exam.get("closes"))
            if (opens is not None and opens > now) or (closes is not None and closes < now):
                unavailable_exam = exam
                break

        if unavailable_exam is not None:
            unavailable_response = session.post(
                f"{base_url}/start",
                data={"exam": get_identifier(unavailable_exam)},
                headers={**student_headers, **form_headers},
                timeout=timeout,
            )
            assert unavailable_response.status_code == 409, (
                f"Starting an unavailable exam should return 409, got "
                f"{unavailable_response.status_code}: {unavailable_response.text}"
            )

    finally:
        if attempt_id is not None and "student" in tokens:
            try:
                session.post(
                    f"{base_url}/submit",
                    data={"attempt": attempt_id},
                    headers={
                        "Authorization": f"Bearer {tokens['student']}",
                        **form_headers,
                    },
                    timeout=timeout,
                )
            except requests.RequestException:
                pass

        for username, token in tokens.items():
            try:
                session.post(
                    f"{base_url}/logout",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=timeout,
                )
            except requests.RequestException:
                pass

        session.close()


if __name__ == "__main__":
    test_student_exam_start_and_attempt_content()