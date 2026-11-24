import requests


def test_system_health_and_authenticated_identity_lifecycle():
    base_url = "http://127.0.0.1:8080/api"
    form_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    token = None
    logged_out = False

    try:
        health_response = requests.get(f"{base_url}/health", timeout=30)
        assert health_response.status_code == 200, health_response.text
        health_data = health_response.json()
        assert health_data.get("status") == "ok"

        missing_credentials_response = requests.post(
            f"{base_url}/login",
            data={},
            headers=form_headers,
            timeout=30,
        )
        assert missing_credentials_response.status_code == 400, missing_credentials_response.text

        missing_password_response = requests.post(
            f"{base_url}/login",
            data={"username": "admin"},
            headers=form_headers,
            timeout=30,
        )
        assert missing_password_response.status_code == 400, missing_password_response.text

        invalid_credentials_response = requests.post(
            f"{base_url}/login",
            data={"username": "admin", "password": "invalid-password"},
            headers=form_headers,
            timeout=30,
        )
        assert invalid_credentials_response.status_code == 401, invalid_credentials_response.text

        unauthenticated_logout_response = requests.post(
            f"{base_url}/logout",
            headers=form_headers,
            timeout=30,
        )
        assert unauthenticated_logout_response.status_code == 401, unauthenticated_logout_response.text

        login_response = requests.post(
            f"{base_url}/login",
            data={"username": "admin", "password": "password1234"},
            headers=form_headers,
            timeout=30,
        )
        assert login_response.status_code == 200, login_response.text
        login_data = login_response.json()
        token = login_data.get("token")
        assert isinstance(token, str) and token
        assert login_data.get("username") == "admin"
        assert login_data.get("role") == "ADMIN"
        assert isinstance(login_data.get("userId"), int)

        auth_headers = {"Authorization": f"Bearer {token}"}

        me_response = requests.get(
            f"{base_url}/me",
            headers=auth_headers,
            timeout=30,
        )
        assert me_response.status_code == 200, me_response.text
        me_data = me_response.json()
        assert me_data.get("id") == login_data["userId"]
        assert me_data.get("username") == login_data["username"]
        assert me_data.get("role") == login_data["role"]
        assert "departmentId" in me_data
        assert isinstance(me_data["departmentId"], str)

        audit_response = requests.get(
            f"{base_url}/audit",
            headers=auth_headers,
            timeout=30,
        )
        assert audit_response.status_code == 200, audit_response.text
        audit_records = audit_response.json()
        assert isinstance(audit_records, list)
        assert audit_records

        logout_response = requests.post(
            f"{base_url}/logout",
            headers={**form_headers, **auth_headers},
            timeout=30,
        )
        assert logout_response.status_code == 200, logout_response.text
        logged_out = True

        revoked_session_response = requests.get(
            f"{base_url}/me",
            headers=auth_headers,
            timeout=30,
        )
        assert revoked_session_response.status_code == 401, revoked_session_response.text

    except requests.RequestException as exc:
        raise AssertionError(f"HTTP request failed: {exc}") from exc
    finally:
        if token and not logged_out:
            try:
                requests.post(
                    f"{base_url}/logout",
                    headers={**form_headers, "Authorization": f"Bearer {token}"},
                    timeout=30,
                )
            except requests.RequestException:
                pass


if __name__ == "__main__":
    test_system_health_and_authenticated_identity_lifecycle()