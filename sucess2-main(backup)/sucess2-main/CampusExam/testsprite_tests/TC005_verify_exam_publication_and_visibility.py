import uuid
from datetime import datetime, timedelta

import requests


def test_verify_exam_publication_and_visibility():
    base_url = "http://127.0.0.1:8080/api"
    sessions = {}

    def post_form(session, path, data, expected_status=200):
        response = session.post(
            f"{base_url}{path}",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        assert response.status_code == expected_status, (
            f"POST {path} returned {response.status_code}, expected "
            f"{expected_status}: {response.text}"
        )
        return response

    def get_json(session, path, expected_status=200, params=None):
        response = session.get(
            f"{base_url}{path}", params=params, timeout=30
        )
        assert response.status_code == expected_status, (
            f"GET {path} returned {response.status_code}, expected "
            f"{expected_status}: {response.text}"
        )
        return response.json()

    def login(username, password):
        session = requests.Session()
        response = session.post(
            f"{base_url}/login",
            data={"username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        assert response.status_code == 200, (
            f"Login for {username} failed: {response.status_code} "
            f"{response.text}"
        )
        token = response.json().get("token")
        assert token, f"Login for {username} did not return a token"
        session.headers.update({"Authorization": f"Bearer {token}"})
        sessions[username] = session
        return session

    def require_id(response, description):
        try:
            resource_id = response.json().get("id")
        except ValueError as exc:
            raise AssertionError(
                f"{description} response was not valid JSON: {response.text}"
            ) from exc
        assert resource_id is not None, (
            f"{description} response did not contain an id: {response.text}"
        )
        return resource_id

    def add_question(faculty_session, bank_id, difficulty, prompt):
        response = post_form(
            faculty_session,
            "/questions",
            {
                "bank": str(bank_id),
                "prompt": prompt,
                "a": "Choice A",
                "b": "Choice B",
                "c": "Choice C",
                "d": "Choice D",
                "correct": "1",
                "explanation": "The first choice is correct.",
                "topic": "Publication test",
                "difficulty": difficulty,
                "marks": "1",
                "penalty": "0",
            },
        )
        return require_id(response, "Question creation")

    def submit_and_approve(faculty_session, admin_session, bank_id):
        post_form(
            faculty_session,
            "/bank-state",
            {"bank": str(bank_id), "state": "SUBMITTED"},
        )
        post_form(
            admin_session,
            "/bank-state",
            {"bank": str(bank_id), "state": "APPROVED"},
        )

    try:
        admin = login("admin", "password1234")
        faculty = login("faculty", "password1234")
        observer = login("observer", "password1234")

        faculty_identity = get_json(faculty, "/me")
        faculty_id = faculty_identity.get("id")
        assert faculty_id is not None, "Faculty identity did not contain an id"

        unique = uuid.uuid4().hex[:10]
        session_name = f"TC005-{unique}"
        eligible_group_response = post_form(
            admin,
            "/groups",
            {
                "department": "TC005",
                "session": session_name,
                "year": "2098",
                "semester": "1",
                "section": f"E{unique[:6]}",
            },
        )
        eligible_group_id = require_id(
            eligible_group_response, "Eligible group creation"
        )

        empty_group_response = post_form(
            admin,
            "/groups",
            {
                "department": "TC005",
                "session": session_name,
                "year": "2098",
                "semester": "1",
                "section": f"N{unique[:6]}",
            },
        )
        empty_group_id = require_id(empty_group_response, "Empty group creation")

        subject_response = post_form(
            admin, "/subjects", {"name": f"TC005 Subject {unique}"}
        )
        subject_id = require_id(subject_response, "Subject creation")

        student_username = f"tc005_student_{unique}"
        post_form(
            admin,
            "/accounts",
            {
                "username": student_username,
                "password": "StudentPass123!",
                "role": "STUDENT",
                "group": str(eligible_group_id),
            },
        )
        student = login(student_username, "StudentPass123!")

        for group_id in (eligible_group_id, empty_group_id):
            post_form(
                admin,
                "/faculty-scopes",
                {
                    "faculty": str(faculty_id),
                    "group": str(group_id),
                    "subject": str(subject_id),
                },
            )

        def create_bank(title, group_id):
            response = post_form(
                faculty,
                "/banks",
                {
                    "subject": str(subject_id),
                    "groups": str(group_id),
                    "title": title,
                },
            )
            return require_id(response, "Question bank creation")

        valid_bank_id = create_bank(
            f"TC005 approved bank {unique}", eligible_group_id
        )
        for difficulty in ("EASY", "MEDIUM", "HARD"):
            add_question(
                faculty,
                valid_bank_id,
                difficulty,
                f"TC005 {unique} valid {difficulty} question",
            )
        submit_and_approve(faculty, admin, valid_bank_id)

        draft_bank_id = create_bank(
            f"TC005 unapproved bank {unique}", eligible_group_id
        )

        insufficient_bank_id = create_bank(
            f"TC005 insufficient bank {unique}", eligible_group_id
        )
        add_question(
            faculty,
            insufficient_bank_id,
            "EASY",
            f"TC005 {unique} insufficient mix question",
        )
        submit_and_approve(faculty, admin, insufficient_bank_id)

        empty_group_bank_id = create_bank(
            f"TC005 empty group bank {unique}", empty_group_id
        )
        for difficulty in ("EASY", "MEDIUM", "HARD"):
            add_question(
                faculty,
                empty_group_bank_id,
                difficulty,
                f"TC005 {unique} empty-group {difficulty} question",
            )
        submit_and_approve(faculty, admin, empty_group_bank_id)

        opens = (datetime.utcnow() + timedelta(hours=1)).strftime(
            "%Y-%m-%dT%H:%M:%S"
        )
        closes = (datetime.utcnow() + timedelta(hours=3)).strftime(
            "%Y-%m-%dT%H:%M:%S"
        )

        def publication_payload(bank_id, title, **overrides):
            payload = {
                "bank": str(bank_id),
                "title": title,
                "instructions": "Answer all selected questions.",
                "mode": "OFFICIAL",
                "duration": "60",
                "attempts": "1",
                "opens": opens,
                "closes": closes,
                "pass": "2",
                "easy": "1",
                "medium": "1",
                "hard": "1",
                "groups": str(eligible_group_id),
            }
            payload.update({key: str(value) for key, value in overrides.items()})
            return payload

        publish_response = post_form(
            admin,
            "/publish",
            publication_payload(valid_bank_id, f"TC005 exam {unique}"),
        )
        exam_id = require_id(publish_response, "Exam publication")

        admin_exams = get_json(admin, "/exams")
        observer_exams = get_json(observer, "/exams")
        student_exams = get_json(student, "/exams")
        assert isinstance(admin_exams, list), "Admin exam response was not a list"
        assert isinstance(observer_exams, list), (
            "Observer exam response was not a list"
        )
        assert isinstance(student_exams, list), (
            "Student exam response was not a list"
        )

        def contains_exam(exams):
            return any(
                isinstance(exam, dict)
                and str(exam.get("id")) == str(exam_id)
                for exam in exams
            )

        assert contains_exam(admin_exams), (
            f"Published exam {exam_id} was not visible to the admin"
        )
        assert contains_exam(observer_exams), (
            f"Published exam {exam_id} was not visible to the observer"
        )
        assert contains_exam(student_exams), (
            f"Published exam {exam_id} was not visible to its assigned student"
        )

        post_form(
            admin,
            "/publish",
            publication_payload(
                draft_bank_id, f"TC005 reject unapproved {unique}"
            ),
            expected_status=409,
        )
        post_form(
            admin,
            "/publish",
            publication_payload(
                valid_bank_id,
                f"TC005 reject pass mark {unique}",
                **{"pass": "4"},
            ),
            expected_status=400,
        )
        post_form(
            admin,
            "/publish",
            publication_payload(
                valid_bank_id,
                f"TC005 reject attempts {unique}",
                **{"attempts": "2"},
            ),
            expected_status=400,
        )
        post_form(
            admin,
            "/publish",
            publication_payload(
                insufficient_bank_id,
                f"TC005 reject difficulty mix {unique}",
                **{"easy": "0", "medium": "1", "hard": "0", "pass": "1"},
            ),
            expected_status=409,
        )
        post_form(
            admin,
            "/publish",
            publication_payload(
                empty_group_bank_id,
                f"TC005 reject group without students {unique}",
                **{"groups": str(empty_group_id)},
            ),
            expected_status=409,
        )
    finally:
        for session in sessions.values():
            try:
                session.post(
                    f"{base_url}/logout",
                    headers={"Authorization": session.headers.get("Authorization", "")},
                    timeout=30,
                )
            except requests.RequestException:
                pass
            finally:
                session.close()


if __name__ == "__main__":
    test_verify_exam_publication_and_visibility()