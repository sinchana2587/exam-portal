import time
import uuid
from datetime import datetime, timedelta
from email.utils import format_datetime

import requests


def test_score_release_prerequisites_and_answer_unmasking():
    base_url = "http://127.0.0.1:8080/api"
    timeout = 30
    tokens = []

    def post_form(path, data, token=None):
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        try:
            return requests.post(
                f"{base_url}{path}",
                data={key: str(value) for key, value in data.items()},
                headers=headers,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            raise AssertionError(f"POST {path} failed: {exc}") from exc

    def get(path, token, params=None):
        headers = {"Authorization": f"Bearer {token}"}
        try:
            return requests.get(
                f"{base_url}{path}",
                headers=headers,
                params=params,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            raise AssertionError(f"GET {path} failed: {exc}") from exc

    def login(username, password):
        response = post_form(
            "/login", {"username": username, "password": password}
        )
        assert response.status_code == 200, (
            f"Login for {username} failed: {response.status_code} {response.text}"
        )
        body = response.json()
        assert body.get("token"), f"Login response did not include a token: {body}"
        tokens.append(body["token"])
        return body["token"]

    def response_json(response, description):
        try:
            return response.json()
        except ValueError as exc:
            raise AssertionError(
                f"{description} did not return valid JSON: {response.text}"
            ) from exc

    def collect_fields(value):
        fields = {}
        if isinstance(value, dict):
            for key, nested in value.items():
                fields.setdefault(str(key).lower(), []).append(nested)
                fields.update(collect_fields(nested))
        elif isinstance(value, list):
            for nested in value:
                fields.update(collect_fields(nested))
        return fields

    try:
        admin_token = login("admin", "password1234")

        unique = uuid.uuid4().hex[:10]
        group_response = post_form(
            "/groups",
            {
                "department": "Test Department",
                "session": f"TC009-{unique}",
                "year": 2026,
                "semester": 1,
                "section": f"T{unique[:6]}",
            },
            admin_token,
        )
        assert group_response.status_code == 200, (
            f"Group creation failed: {group_response.status_code} "
            f"{group_response.text}"
        )
        group_id = response_json(group_response, "Group creation").get("id")
        assert group_id is not None, "Group creation response did not include an id"

        subject_response = post_form(
            "/subjects", {"name": f"TC009 Subject {unique}"}, admin_token
        )
        assert subject_response.status_code == 200, (
            f"Subject creation failed: {subject_response.status_code} "
            f"{subject_response.text}"
        )
        subject_id = response_json(subject_response, "Subject creation").get("id")
        assert subject_id is not None, (
            "Subject creation response did not include an id"
        )

        faculty_username = f"tc009_faculty_{unique}"
        faculty_password = f"Faculty_{unique}9"
        faculty_response = post_form(
            "/accounts",
            {
                "username": faculty_username,
                "password": faculty_password,
                "role": "FACULTY",
                "group": group_id,
            },
            admin_token,
        )
        assert faculty_response.status_code == 200, (
            f"Faculty account creation failed: {faculty_response.status_code} "
            f"{faculty_response.text}"
        )
        faculty_id = response_json(faculty_response, "Faculty account creation").get(
            "id"
        )
        assert faculty_id is not None, (
            "Faculty account response did not include an id"
        )

        student_username = f"tc009_student_{unique}"
        student_password = f"Student_{unique}9"
        student_response = post_form(
            "/accounts",
            {
                "username": student_username,
                "password": student_password,
                "role": "STUDENT",
                "group": group_id,
            },
            admin_token,
        )
        assert student_response.status_code == 200, (
            f"Student account creation failed: {student_response.status_code} "
            f"{student_response.text}"
        )
        student_id = response_json(student_response, "Student account creation").get(
            "id"
        )
        assert student_id is not None, (
            "Student account response did not include an id"
        )

        scope_response = post_form(
            "/faculty-scopes",
            {"faculty": faculty_id, "group": group_id, "subject": subject_id},
            admin_token,
        )
        assert scope_response.status_code == 200, (
            f"Faculty scope creation failed: {scope_response.status_code} "
            f"{scope_response.text}"
        )

        faculty_token = login(faculty_username, faculty_password)
        bank_response = post_form(
            "/banks",
            {
                "subject": subject_id,
                "groups": str(group_id),
                "title": f"TC009 Bank {unique}",
            },
            faculty_token,
        )
        assert bank_response.status_code == 200, (
            f"Bank creation failed: {bank_response.status_code} {bank_response.text}"
        )
        bank_id = response_json(bank_response, "Bank creation").get("id")
        assert bank_id is not None, "Bank creation response did not include an id"

        explanation = f"TC009 explanation {unique}"
        question_response = post_form(
            "/questions",
            {
                "bank": bank_id,
                "prompt": f"TC009 question {unique}: which option is correct?",
                "a": f"Correct option {unique}",
                "b": f"Incorrect option B {unique}",
                "c": f"Incorrect option C {unique}",
                "d": f"Incorrect option D {unique}",
                "correct": 1,
                "explanation": explanation,
                "topic": "Test topic",
                "difficulty": "EASY",
                "marks": 1,
                "penalty": 0,
            },
            faculty_token,
        )
        assert question_response.status_code == 200, (
            f"Question creation failed: {question_response.status_code} "
            f"{question_response.text}"
        )

        submit_bank_response = post_form(
            "/bank-state", {"bank": bank_id, "state": "SUBMITTED"}, faculty_token
        )
        assert submit_bank_response.status_code == 200, (
            f"Bank submission failed: {submit_bank_response.status_code} "
            f"{submit_bank_response.text}"
        )

        approve_response = post_form(
            "/bank-state", {"bank": bank_id, "state": "APPROVED"}, admin_token
        )
        assert approve_response.status_code == 200, (
            f"Bank approval failed: {approve_response.status_code} "
            f"{approve_response.text}"
        )

        opens = datetime.now() - timedelta(minutes=1)
        closes = datetime.now() + timedelta(seconds=20)
        publish_response = post_form(
            "/publish",
            {
                "bank": bank_id,
                "title": f"TC009 Exam {unique}",
                "instructions": "Automated score-release prerequisite test",
                "mode": "PRACTICE",
                "duration": 60,
                "attempts": 1,
                "opens": opens.strftime("%Y-%m-%dT%H:%M:%S"),
                "closes": closes.strftime("%Y-%m-%dT%H:%M:%S"),
                "pass": 1,
                "easy": 1,
                "medium": 0,
                "hard": 0,
                "groups": str(group_id),
            },
            admin_token,
        )
        assert publish_response.status_code == 200, (
            f"Exam publication failed: {publish_response.status_code} "
            f"{publish_response.text}"
        )
        exam_id = response_json(publish_response, "Exam publication").get("id")
        assert exam_id is not None, "Exam publication response did not include an id"

        student_token = login(student_username, student_password)
        start_response = post_form(
            "/start", {"exam": exam_id}, student_token
        )
        assert start_response.status_code == 200, (
            f"Starting exam failed: {start_response.status_code} "
            f"{start_response.text}"
        )
        attempt_id = response_json(start_response, "Start attempt").get("id")
        assert attempt_id is not None, "Start response did not include an attempt id"

        unsubmitted_release = post_form(
            "/release", {"exam": exam_id}, admin_token
        )
        assert unsubmitted_release.status_code == 409, (
            "Release should be rejected while the attempt is unsubmitted; "
            f"received {unsubmitted_release.status_code}: "
            f"{unsubmitted_release.text}"
        )

        attempt_response = get("/attempt", student_token, {"id": attempt_id})
        if attempt_response.status_code != 200:
            attempt_response = get(
                "/attempt", student_token, {"attempt": attempt_id}
            )
        assert attempt_response.status_code == 200, (
            f"Loading attempt failed: {attempt_response.status_code} "
            f"{attempt_response.text}"
        )

        submit_response = post_form(
            "/submit", {"attempt": attempt_id}, student_token
        )
        assert submit_response.status_code == 200, (
            f"Attempt submission failed: {submit_response.status_code} "
            f"{submit_response.text}"
        )
        submit_body = response_json(submit_response, "Attempt submission")
        assert str(submit_body.get("status", "")).upper() == "SUBMITTED", (
            f"Unexpected submission response: {submit_body}"
        )

        open_window_release = post_form(
            "/release", {"exam": exam_id}, admin_token
        )
        assert open_window_release.status_code == 409, (
            "Release should be rejected while the exam window is open even after "
            f"submission; received {open_window_release.status_code}: "
            f"{open_window_release.text}"
        )

        wait_until = closes.timestamp() + 1
        while time.time() < wait_until:
            time.sleep(min(1, wait_until - time.time()))

        release_response = post_form(
            "/release", {"exam": exam_id}, admin_token
        )
        assert release_response.status_code == 200, (
            f"Release after exam close and submission failed: "
            f"{release_response.status_code} {release_response.text}"
        )
        release_id = response_json(release_response, "Score release").get("id")
        assert release_id is not None, "Release response did not include an id"

        released_attempt_response = get(
            "/attempt", student_token, {"id": attempt_id}
        )
        if released_attempt_response.status_code != 200:
            released_attempt_response = get(
                "/attempt", student_token, {"attempt": attempt_id}
            )
        assert released_attempt_response.status_code == 200, (
            f"Loading released attempt failed: "
            f"{released_attempt_response.status_code} "
            f"{released_attempt_response.text}"
        )

        released_attempt = response_json(
            released_attempt_response, "Released attempt"
        )
        fields = collect_fields(released_attempt)
        assert explanation in released_attempt_response.text, (
            "Released attempt did not expose the question explanation"
        )
        assert any(
            key in fields for key in ("correct", "answer", "correctanswer")
        ), f"Released attempt did not expose a correct answer: {released_attempt}"
        correct_values = (
            fields.get("correct", [])
            + fields.get("answer", [])
            + fields.get("correctanswer", [])
        )
        assert any(str(value).strip() in {"1", "1.0"} for value in correct_values), (
            f"Released attempt did not expose the expected correct choice: "
            f"{correct_values}"
        )

    finally:
        for token in reversed(tokens):
            try:
                requests.post(
                    f"{base_url}/logout",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=timeout,
                )
            except requests.RequestException:
                pass


if __name__ == "__main__":
    test_score_release_prerequisites_and_answer_unmasking()