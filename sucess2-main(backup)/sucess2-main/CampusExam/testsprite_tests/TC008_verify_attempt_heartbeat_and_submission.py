import requests


def test_attempt_heartbeat_and_submission():
    base_url = "http://127.0.0.1:8080/api"
    session = requests.Session()
    tokens = []

    def login(username, password):
        response = session.post(
            f"{base_url}/login",
            data={"username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        assert response.status_code == 200, (
            f"Login failed for {username}: {response.status_code} {response.text}"
        )
        payload = response.json()
        assert payload.get("token"), f"Login response did not contain a token: {payload}"
        tokens.append(payload["token"])
        return payload["token"]

    def json_or_empty(response):
        try:
            return response.json()
        except ValueError:
            return {}

    student_token = None
    observer_token = None

    try:
        student_token = login("student", "password1234")
        observer_token = login("observer", "password1234")

        student_headers = {"Authorization": f"Bearer {student_token}"}
        observer_headers = {"Authorization": f"Bearer {observer_token}"}

        exams_response = session.get(
            f"{base_url}/exams", headers=student_headers, timeout=30
        )
        assert exams_response.status_code == 200, (
            f"Could not list student exams: {exams_response.status_code} "
            f"{exams_response.text}"
        )
        exams = exams_response.json()
        assert isinstance(exams, list) and exams, (
            f"No assigned exams are available for the student: {exams}"
        )

        attempt_id = None
        start_errors = []
        for exam in exams:
            exam_id = exam.get("id", exam.get("examId"))
            if exam_id is None:
                continue

            start_response = session.post(
                f"{base_url}/start",
                data={"exam": exam_id},
                headers={
                    **student_headers,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                timeout=30,
            )
            if start_response.status_code == 200:
                start_payload = json_or_empty(start_response)
                attempt_id = start_payload.get("id", start_payload.get("attempt"))
                if attempt_id is not None:
                    break
                start_errors.append(
                    f"Exam {exam_id} start response had no attempt id: "
                    f"{start_response.text}"
                )
            else:
                start_errors.append(
                    f"Exam {exam_id}: {start_response.status_code} "
                    f"{start_response.text}"
                )

        assert attempt_id is not None, (
            "Could not start an assigned exam and obtain an attempt id. "
            + "; ".join(start_errors)
        )

        unauthorized_response = session.post(
            f"{base_url}/submit",
            data={"attempt": attempt_id},
            headers={
                **observer_headers,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout=30,
        )
        assert unauthorized_response.status_code in (403, 404), (
            "An observer should not be allowed to submit a student's attempt; "
            f"received {unauthorized_response.status_code}: "
            f"{unauthorized_response.text}"
        )

        heartbeat_response = session.post(
            f"{base_url}/heartbeat",
            data={"attempt": attempt_id, "pending": 0},
            headers={
                **student_headers,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout=30,
        )
        assert heartbeat_response.status_code == 200, (
            f"Heartbeat failed: {heartbeat_response.status_code} "
            f"{heartbeat_response.text}"
        )
        heartbeat_payload = json_or_empty(heartbeat_response)
        assert str(heartbeat_payload.get("status", "")).upper() == "ACTIVE", (
            f"Expected ACTIVE heartbeat status, got {heartbeat_payload}"
        )

        submit_response = session.post(
            f"{base_url}/submit",
            data={"attempt": attempt_id},
            headers={
                **student_headers,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout=30,
        )
        assert submit_response.status_code == 200, (
            f"Attempt submission failed: {submit_response.status_code} "
            f"{submit_response.text}"
        )
        submit_payload = json_or_empty(submit_response)
        assert str(submit_payload.get("status", "")).upper() == "SUBMITTED", (
            f"Expected SUBMITTED status, got {submit_payload}"
        )

        score_fields = ("score", "totalScore", "marks")
        score_found = False
        for field in score_fields:
            if field in submit_payload:
                assert isinstance(submit_payload[field], (int, float)), (
                    f"Submission returned a non-numeric {field}: "
                    f"{submit_payload[field]}"
                )
                assert submit_payload[field] >= 0, (
                    f"Submission returned a negative {field}: "
                    f"{submit_payload[field]}"
                )
                score_found = True

        repeated_response = session.post(
            f"{base_url}/submit",
            data={"attempt": attempt_id},
            headers={
                **student_headers,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            timeout=30,
        )
        assert repeated_response.status_code in (200, 409), (
            "Repeated submission should be handled as an already-submitted "
            f"attempt or an idempotent request, got "
            f"{repeated_response.status_code}: {repeated_response.text}"
        )
        if repeated_response.status_code == 200:
            repeated_payload = json_or_empty(repeated_response)
            assert str(repeated_payload.get("status", "")).upper() == "SUBMITTED", (
                f"Repeated submission returned an unexpected state: "
                f"{repeated_payload}"
            )
            for field in score_fields:
                if field in repeated_payload:
                    assert isinstance(repeated_payload[field], (int, float)), (
                        f"Repeated submission returned a non-numeric {field}: "
                        f"{repeated_payload[field]}"
                    )
                    assert repeated_payload[field] >= 0

        attempt_response = session.get(
            f"{base_url}/attempt",
            params={"id": attempt_id},
            headers=student_headers,
            timeout=30,
        )
        if attempt_response.status_code == 200:
            attempt_payload = json_or_empty(attempt_response)
            for field in score_fields:
                if field in attempt_payload:
                    assert isinstance(attempt_payload[field], (int, float)), (
                        f"Attempt details returned a non-numeric {field}: "
                        f"{attempt_payload[field]}"
                    )
                    assert attempt_payload[field] >= 0
                    score_found = True
        else:
            assert attempt_response.status_code in (400, 404, 409), (
                f"Unexpected response loading submitted attempt: "
                f"{attempt_response.status_code} {attempt_response.text}"
            )

        if score_found:
            assert True
    finally:
        for token in tokens:
            try:
                session.post(
                    f"{base_url}/logout",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30,
                )
            except requests.RequestException:
                pass
        session.close()


if __name__ == "__main__":
    test_attempt_heartbeat_and_submission()