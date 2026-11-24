import uuid

import requests


def test_institutional_administration_and_access_control():
    base_url = "http://127.0.0.1:8080/api"
    timeout = 30
    tokens = []

    def request(method, path, *, token=None, data=None):
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if method.upper() == "POST":
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        try:
            return requests.request(
                method,
                f"{base_url}{path}",
                headers=headers,
                data=data,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            raise AssertionError(f"{method} {path} request failed: {exc}") from exc

    def login(username, password, expected_role):
        response = request(
            "POST",
            "/login",
            data={"username": username, "password": password},
        )
        assert response.status_code == 200, (
            f"Login for {username} failed: {response.status_code} {response.text}"
        )
        body = response.json()
        assert body.get("token"), f"Login for {username} did not return a token"
        assert body.get("role", "").upper() == expected_role
        tokens.append(body["token"])
        return body["token"]

    try:
        admin_token = login("admin", "password1234", "ADMIN")
        faculty_token = login("faculty", "password1234", "FACULTY")
        student_token = login("student", "password1234", "STUDENT")
        observer_token = login("observer", "password1234", "OBSERVER")

        unique = uuid.uuid4().hex[:10]
        group_data = {
            "department": f"QA-{unique}",
            "session": f"SESSION-{unique}",
            "year": "2",
            "semester": "1",
            "section": "A",
        }

        response = request("POST", "/groups", token=admin_token, data=group_data)
        assert response.status_code == 200, (
            f"Creating group failed: {response.status_code} {response.text}"
        )
        group_id = response.json().get("id")
        assert group_id is not None

        response = request("GET", "/groups", token=admin_token)
        assert response.status_code == 200, response.text
        groups = response.json()
        assert isinstance(groups, list)
        assert any(str(group.get("id")) == str(group_id) for group in groups)

        response = request("POST", "/groups", token=admin_token, data=group_data)
        assert response.status_code == 409, (
            f"Duplicate group should conflict, got {response.status_code}: {response.text}"
        )

        subject_name = f"QA Subject {unique}"
        response = request(
            "POST",
            "/subjects",
            token=admin_token,
            data={"name": subject_name},
        )
        assert response.status_code == 200, (
            f"Creating subject failed: {response.status_code} {response.text}"
        )
        subject_id = response.json().get("id")
        assert subject_id is not None

        response = request("GET", "/subjects", token=admin_token)
        assert response.status_code == 200, response.text
        subjects = response.json()
        assert isinstance(subjects, list)
        assert any(str(subject.get("id")) == str(subject_id) for subject in subjects)

        faculty_username = f"qa_faculty_{unique}"
        student_username = f"qa_student_{unique}"
        observer_username = f"qa_observer_{unique}"

        created_accounts = {}
        for username, role in (
            (faculty_username, "FACULTY"),
            (student_username, "STUDENT"),
            (observer_username, "OBSERVER"),
        ):
            response = request(
                "POST",
                "/accounts",
                token=admin_token,
                data={
                    "username": username,
                    "password": "password1234",
                    "role": role,
                    "group": str(group_id),
                },
            )
            assert response.status_code == 200, (
                f"Creating {role} account failed: "
                f"{response.status_code} {response.text}"
            )
            account_id = response.json().get("id")
            assert account_id is not None
            created_accounts[role] = account_id

        response = request("GET", "/accounts", token=admin_token)
        assert response.status_code == 200, response.text
        accounts = response.json()
        assert isinstance(accounts, list)
        listed_usernames = {account.get("username") for account in accounts}
        assert {faculty_username, student_username, observer_username}.issubset(
            listed_usernames
        )

        response = request(
            "POST",
            "/accounts",
            token=admin_token,
            data={
                "username": f"qa_invalid_role_{unique}",
                "password": "password1234",
                "role": "INVALID_ROLE",
                "group": str(group_id),
            },
        )
        assert response.status_code == 400, (
            f"Invalid role should be rejected, got {response.status_code}: {response.text}"
        )

        response = request(
            "POST",
            "/accounts",
            token=admin_token,
            data={
                "username": f"qa_short_password_{unique}",
                "password": "short",
                "role": "STUDENT",
                "group": str(group_id),
            },
        )
        assert response.status_code == 400, (
            f"Short password should be rejected, got {response.status_code}: {response.text}"
        )

        response = request(
            "POST",
            "/accounts",
            token=admin_token,
            data={
                "username": faculty_username,
                "password": "password1234",
                "role": "FACULTY",
                "group": str(group_id),
            },
        )
        assert response.status_code == 409, (
            f"Duplicate username should conflict, got {response.status_code}: {response.text}"
        )

        scope_data = {
            "faculty": str(created_accounts["FACULTY"]),
            "group": str(group_id),
            "subject": str(subject_id),
        }
        response = request(
            "POST",
            "/faculty-scopes",
            token=admin_token,
            data=scope_data,
        )
        assert response.status_code == 200, (
            f"Creating faculty scope failed: {response.status_code} {response.text}"
        )
        assert response.json().get("id") is not None

        response = request(
            "POST",
            "/faculty-scopes",
            token=admin_token,
            data=scope_data,
        )
        assert response.status_code == 409, (
            f"Duplicate faculty scope should conflict, got "
            f"{response.status_code}: {response.text}"
        )

        administrative_writes = (
            ("/groups", group_data),
            ("/subjects", {"name": f"Unauthorized Subject {unique}"}),
            (
                "/accounts",
                {
                    "username": f"qa_unauthorized_{unique}",
                    "password": "password1234",
                    "role": "ADMIN",
                    "group": str(group_id),
                },
            ),
            ("/faculty-scopes", scope_data),
        )
        for token in (faculty_token, student_token, observer_token):
            for path, payload in administrative_writes:
                response = request("POST", path, token=token, data=payload)
                assert response.status_code == 403, (
                    f"Unauthorized write to {path} should return 403, "
                    f"got {response.status_code}: {response.text}"
                )
    finally:
        for token in tokens:
            try:
                request("POST", "/logout", token=token)
            except AssertionError:
                pass


if __name__ == "__main__":
    test_institutional_administration_and_access_control()