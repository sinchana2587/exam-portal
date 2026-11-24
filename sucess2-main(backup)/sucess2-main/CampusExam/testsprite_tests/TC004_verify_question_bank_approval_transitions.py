import requests


def test_question_bank_approval_transitions():
    base_url = "http://127.0.0.1:8080/api"
    timeout = 30

    def login(username, password):
        response = requests.post(
            f"{base_url}/login",
            data={"username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=timeout,
        )
        assert response.status_code == 200, (
            f"Login failed for {username}: {response.status_code} {response.text}"
        )
        token = response.json().get("token")
        assert token, f"Login response for {username} did not include a token"
        return {"Authorization": f"Bearer {token}"}

    def post_form(path, headers, payload):
        request_headers = {
            **headers,
            "Content-Type": "application/x-www-form-urlencoded",
        }
        return requests.post(
            f"{base_url}{path}",
            data=payload,
            headers=request_headers,
            timeout=timeout,
        )

    def scope_value(scope, *keys):
        for key in keys:
            value = scope.get(key)
            if isinstance(value, dict):
                value = value.get("id")
            if value is not None:
                return value
        return None

    admin_headers = login("admin", "password1234")
    faculty_headers = login("faculty", "password1234")
    student_headers = login("student", "password1234")

    bank_id = None

    try:
        scopes_response = requests.get(
            f"{base_url}/my-scopes",
            headers=faculty_headers,
            timeout=timeout,
        )
        assert scopes_response.status_code == 200, (
            f"Unable to retrieve faculty scopes: "
            f"{scopes_response.status_code} {scopes_response.text}"
        )
        scopes_data = scopes_response.json()
        scopes = scopes_data if isinstance(scopes_data, list) else scopes_data.get("scopes", [])
        assert scopes, "Faculty account must have an assigned scope for this test"

        selected_scope = next(
            (
                scope
                for scope in scopes
                if scope_value(scope, "groupId", "group") is not None
                and scope_value(scope, "subjectId", "subject") is not None
            ),
            None,
        )
        assert selected_scope is not None, (
            f"No usable group and subject were present in faculty scopes: {scopes}"
        )

        group_id = scope_value(selected_scope, "groupId", "group")
        subject_id = scope_value(selected_scope, "subjectId", "subject")

        create_response = post_form(
            "/banks",
            faculty_headers,
            {
                "subject": str(subject_id),
                "groups": str(group_id),
                "title": "TC004 approval transitions",
            },
        )
        assert create_response.status_code == 200, (
            f"Unable to create draft bank: "
            f"{create_response.status_code} {create_response.text}"
        )
        bank_id = create_response.json().get("id")
        assert bank_id is not None, f"Bank creation response lacked an id: {create_response.text}"

        question_response = post_form(
            "/questions",
            faculty_headers,
            {
                "bank": str(bank_id),
                "prompt": "Which option is the correct answer?",
                "a": "Option A",
                "b": "Option B",
                "c": "Option C",
                "d": "Option D",
                "correct": "1",
                "explanation": "Option A is correct.",
                "topic": "Approval transitions",
                "difficulty": "EASY",
                "marks": "1",
                "penalty": "0",
            },
        )
        assert question_response.status_code == 200, (
            f"Unable to add question to draft bank: "
            f"{question_response.status_code} {question_response.text}"
        )
        assert question_response.json().get("id") is not None, (
            f"Question creation response lacked an id: {question_response.text}"
        )

        invalid_faculty_transition = post_form(
            "/bank-state",
            faculty_headers,
            {"bank": str(bank_id), "state": "APPROVED"},
        )
        assert invalid_faculty_transition.status_code == 409, (
            "Faculty approval of a bank should be rejected as an invalid or unauthorized "
            f"transition, got {invalid_faculty_transition.status_code}: "
            f"{invalid_faculty_transition.text}"
        )

        unauthorized_student_transition = post_form(
            "/bank-state",
            student_headers,
            {"bank": str(bank_id), "state": "SUBMITTED"},
        )
        assert unauthorized_student_transition.status_code in (403, 409), (
            "A student state change should be rejected, got "
            f"{unauthorized_student_transition.status_code}: "
            f"{unauthorized_student_transition.text}"
        )

        submit_response = post_form(
            "/bank-state",
            faculty_headers,
            {"bank": str(bank_id), "state": "SUBMITTED"},
        )
        assert submit_response.status_code == 200, (
            f"Faculty submission failed: {submit_response.status_code} "
            f"{submit_response.text}"
        )
        submit_transition_id = submit_response.json().get("id")
        assert submit_transition_id is not None, (
            f"Submission response lacked a transition identifier: {submit_response.text}"
        )

        approve_response = post_form(
            "/bank-state",
            admin_headers,
            {"bank": str(bank_id), "state": "APPROVED"},
        )
        assert approve_response.status_code == 200, (
            f"Admin approval failed: {approve_response.status_code} "
            f"{approve_response.text}"
        )
        approve_transition_id = approve_response.json().get("id")
        assert approve_transition_id is not None, (
            f"Approval response lacked a transition identifier: {approve_response.text}"
        )

        archive_response = post_form(
            "/bank-state",
            admin_headers,
            {"bank": str(bank_id), "state": "ARCHIVED"},
        )
        assert archive_response.status_code == 200, (
            f"Admin archiving failed: {archive_response.status_code} "
            f"{archive_response.text}"
        )
        archive_transition_id = archive_response.json().get("id")
        assert archive_transition_id is not None, (
            f"Archive response lacked a transition identifier: {archive_response.text}"
        )

        invalid_archived_transition = post_form(
            "/bank-state",
            admin_headers,
            {"bank": str(bank_id), "state": "APPROVED"},
        )
        assert invalid_archived_transition.status_code == 409, (
            "Transitioning an archived bank back to APPROVED should be rejected, got "
            f"{invalid_archived_transition.status_code}: "
            f"{invalid_archived_transition.text}"
        )

    finally:
        if bank_id is not None:
            try:
                post_form(
                    "/bank-state",
                    admin_headers,
                    {"bank": str(bank_id), "state": "ARCHIVED"},
                )
            except requests.RequestException:
                pass


if __name__ == "__main__":
    test_question_bank_approval_transitions()