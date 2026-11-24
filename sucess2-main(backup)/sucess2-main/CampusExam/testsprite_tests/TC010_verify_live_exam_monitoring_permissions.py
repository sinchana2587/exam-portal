import requests


def test_live_exam_monitoring_permissions():
    base_url = "http://127.0.0.1:8080/api"
    tokens = {}

    def login(username, password):
        response = requests.post(
            f"{base_url}/login",
            data={"username": username, "password": password},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        assert response.status_code == 200, (
            f"Login failed for {username}: {response.status_code} {response.text}"
        )
        body = response.json()
        assert body.get("token"), f"Login response did not contain a token for {username}"
        tokens[username] = body["token"]
        return body["token"]

    def get_exam_id(exam):
        return exam.get("id") or exam.get("examId")

    try:
        admin_token = login("admin", "password1234")
        exams_response = requests.get(
            f"{base_url}/exams",
            headers={"Authorization": f"Bearer {admin_token}"},
            timeout=30,
        )
        assert exams_response.status_code == 200, (
            f"Admin could not list exams: {exams_response.status_code} "
            f"{exams_response.text}"
        )
        exams = exams_response.json()
        assert isinstance(exams, list), "Expected GET /exams to return a list"
        exam = next(
            (
                item
                for item in exams
                if isinstance(item, dict) and get_exam_id(item) is not None
            ),
            None,
        )
        assert exam is not None, "No existing exam is available for monitoring"
        exam_id = get_exam_id(exam)

        observer_token = login("observer", "password1234")
        observer_exams_response = requests.get(
            f"{base_url}/exams",
            headers={"Authorization": f"Bearer {observer_token}"},
            timeout=30,
        )
        assert observer_exams_response.status_code == 200, (
            f"Observer could not list visible exams: "
            f"{observer_exams_response.status_code} {observer_exams_response.text}"
        )
        observer_exams = observer_exams_response.json()
        assert isinstance(observer_exams, list), (
            "Expected observer GET /exams to return a list"
        )
        visible_exam_ids = {
            get_exam_id(item)
            for item in observer_exams
            if isinstance(item, dict) and get_exam_id(item) is not None
        }
        assert exam_id in visible_exam_ids, (
            f"Exam {exam_id} is not visible to the observer"
        )

        monitor_response = requests.get(
            f"{base_url}/monitor",
            params={"exam": exam_id},
            headers={"Authorization": f"Bearer {observer_token}"},
            timeout=30,
        )
        assert monitor_response.status_code == 200, (
            f"Observer could not access monitoring telemetry: "
            f"{monitor_response.status_code} {monitor_response.text}"
        )
        telemetry = monitor_response.json()
        assert isinstance(telemetry, list), (
            "Expected GET /monitor to return a telemetry list"
        )

        student_token = login("student", "password1234")
        unauthorized_response = requests.get(
            f"{base_url}/monitor",
            params={"exam": exam_id},
            headers={"Authorization": f"Bearer {student_token}"},
            timeout=30,
        )
        assert unauthorized_response.status_code in (401, 403), (
            "A student without monitoring permission should not access telemetry; "
            f"received {unauthorized_response.status_code}: "
            f"{unauthorized_response.text}"
        )

    except requests.RequestException as exc:
        raise AssertionError(f"HTTP request failed during monitoring test: {exc}") from exc
    finally:
        for token in tokens.values():
            try:
                requests.post(
                    f"{base_url}/logout",
                    data={},
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    timeout=30,
                )
            except requests.RequestException:
                pass


if __name__ == "__main__":
    test_live_exam_monitoring_permissions()