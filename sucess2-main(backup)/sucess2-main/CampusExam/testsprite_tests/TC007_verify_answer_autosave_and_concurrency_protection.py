import requests


def test_answer_autosave_and_concurrency_protection():
    base_url = "http://127.0.0.1:8080/api"
    session = requests.Session()
    token = None

    def response_json(response):
        try:
            return response.json()
        except ValueError:
            return {}

    def find_question_collection(payload):
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict):
            for key in ("questions", "items"):
                value = payload.get(key)
                if isinstance(value, list):
                    return value
        return []

    def find_saved_choice(payload, position):
        questions = find_question_collection(payload)
        for question in questions:
            if isinstance(question, dict) and str(question.get("position")) == str(position):
                for key in ("choice", "answer", "selectedChoice"):
                    if key in question:
                        return question[key]
        if isinstance(payload, dict):
            answers = payload.get("answers")
            if isinstance(answers, dict):
                answer = answers.get(str(position))
                if isinstance(answer, dict):
                    return answer.get("choice", answer.get("answer"))
                return answer
            if isinstance(answers, list):
                for answer in answers:
                    if isinstance(answer, dict) and str(answer.get("position")) == str(position):
                        return answer.get("choice", answer.get("answer"))
        return None

    try:
        login_response = session.post(
            f"{base_url}/login",
            data={"username": "student", "password": "password1234"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        assert login_response.status_code == 200, (
            f"Student login failed: {login_response.status_code} {login_response.text}"
        )
        login_data = response_json(login_response)
        token = login_data.get("token")
        assert token, f"Login response did not contain a token: {login_data}"
        session.headers.update({"Authorization": f"Bearer {token}"})

        exams_response = session.get(f"{base_url}/exams", timeout=30)
        assert exams_response.status_code == 200, (
            f"Could not load assigned exams: {exams_response.status_code} {exams_response.text}"
        )
        exams_data = response_json(exams_response)
        if isinstance(exams_data, list):
            exams = exams_data
        elif isinstance(exams_data, dict):
            exams = exams_data.get("exams", [])
        else:
            exams = []
        assert exams, f"No assigned exams were available: {exams_data}"

        attempt_id = None
        start_errors = []
        for exam in exams:
            if not isinstance(exam, dict):
                continue
            exam_id = exam.get("id", exam.get("exam"))
            if exam_id is None:
                continue
            start_response = session.post(
                f"{base_url}/start",
                data={"exam": exam_id},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30,
            )
            if start_response.status_code == 200:
                start_data = response_json(start_response)
                attempt_id = start_data.get("id", start_data.get("attempt"))
                if attempt_id is not None:
                    break
                start_errors.append(f"Start response omitted attempt id: {start_data}")
            else:
                start_errors.append(
                    f"Exam {exam_id}: {start_response.status_code} {start_response.text}"
                )
        assert attempt_id is not None, (
            "Could not start an assigned exam attempt. " + "; ".join(start_errors)
        )

        attempt_response = session.get(
            f"{base_url}/attempt", params={"attempt": attempt_id}, timeout=30
        )
        assert attempt_response.status_code == 200, (
            f"Could not load attempt {attempt_id}: "
            f"{attempt_response.status_code} {attempt_response.text}"
        )
        attempt_data = response_json(attempt_response)
        questions = find_question_collection(attempt_data)
        assert questions, f"Attempt did not contain any questions: {attempt_data}"

        question = questions[0]
        assert isinstance(question, dict), f"Unexpected question data: {question}"
        position = question.get("position", 1)
        current_version = question.get(
            "version",
            attempt_data.get("version", 0) if isinstance(attempt_data, dict) else 0,
        )
        if current_version is None:
            current_version = 0
        current_version = int(current_version)

        saved_choice = question.get("choice", question.get("answer"))
        try:
            choice = 1 if saved_choice is None else (int(saved_choice) % 4) + 1
        except (TypeError, ValueError):
            choice = 1

        answer_payload = {
            "attempt": attempt_id,
            "position": position,
            "choice": choice,
            "review": "false",
            "version": current_version,
        }
        save_response = session.post(
            f"{base_url}/answer",
            data=answer_payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        assert save_response.status_code == 200, (
            f"Answer autosave failed: {save_response.status_code} {save_response.text}"
        )
        save_data = response_json(save_response)
        assert str(save_data.get("status", "")).upper() == "SAVED", (
            f"Expected SAVED status, received: {save_data}"
        )
        new_version = save_data.get("version")
        assert new_version is not None, f"Autosave response omitted version: {save_data}"
        assert int(new_version) == current_version + 1, (
            f"Expected version {current_version + 1}, received {new_version}"
        )

        stale_payload = {
            "attempt": attempt_id,
            "position": position,
            "choice": (int(choice) % 4) + 1,
            "review": "false",
            "version": current_version,
        }
        stale_response = session.post(
            f"{base_url}/answer",
            data=stale_payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        assert stale_response.status_code == 409, (
            f"Expected stale-version conflict (409), received "
            f"{stale_response.status_code}: {stale_response.text}"
        )

        verification_response = session.get(
            f"{base_url}/attempt", params={"attempt": attempt_id}, timeout=30
        )
        assert verification_response.status_code == 200, (
            f"Could not reload attempt after stale update: "
            f"{verification_response.status_code} {verification_response.text}"
        )
        verification_data = response_json(verification_response)
        persisted_choice = find_saved_choice(verification_data, position)
        if persisted_choice is not None:
            assert str(persisted_choice) == str(choice), (
                f"Stale update overwrote the saved answer: expected {choice}, "
                f"found {persisted_choice}"
            )
    except requests.RequestException as exc:
        raise AssertionError(f"HTTP request failed: {exc}") from exc
    finally:
        if token:
            try:
                session.post(
                    f"{base_url}/logout",
                    timeout=30,
                )
            except requests.RequestException:
                pass
        session.close()


if __name__ == "__main__":
    test_answer_autosave_and_concurrency_protection()
