import uuid
import requests


def test_faculty_scopes_and_question_bank_authoring():
    base_url = "http://127.0.0.1:8080/api"
    timeout = 30
    form_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    created_bank_ids = []

    try:
        admin_login = requests.post(
            f"{base_url}/login",
            data={"username": "admin", "password": "password1234"},
            headers=form_headers,
            timeout=timeout,
        )
        assert admin_login.status_code == 200, (
            f"Admin login failed: {admin_login.status_code} {admin_login.text}"
        )
        admin_token = admin_login.json()["token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        groups_response = requests.get(
            f"{base_url}/groups", headers=admin_headers, timeout=timeout
        )
        assert groups_response.status_code == 200, (
            f"Could not list groups: {groups_response.status_code} "
            f"{groups_response.text}"
        )
        available_group_ids = set()
        for group in groups_response.json():
            if isinstance(group, dict):
                group_id = group.get("id", group.get("groupId"))
                if group_id is not None:
                    available_group_ids.add(str(group_id))

        faculty_login = requests.post(
            f"{base_url}/login",
            data={"username": "faculty", "password": "password1234"},
            headers=form_headers,
            timeout=timeout,
        )
        assert faculty_login.status_code == 200, (
            f"Faculty login failed: {faculty_login.status_code} "
            f"{faculty_login.text}"
        )
        faculty_token = faculty_login.json()["token"]
        faculty_headers = {"Authorization": f"Bearer {faculty_token}"}

        scopes_response = requests.get(
            f"{base_url}/my-scopes", headers=faculty_headers, timeout=timeout
        )
        assert scopes_response.status_code == 200, (
            f"Could not retrieve faculty scopes: {scopes_response.status_code} "
            f"{scopes_response.text}"
        )
        scopes = scopes_response.json()
        assert isinstance(scopes, list), f"Expected scopes list, got {scopes!r}"
        assert scopes, "Faculty account has no assigned scopes"

        scope = scopes[0]
        assert isinstance(scope, dict), f"Unexpected scope format: {scope!r}"
        group_value = scope.get("group", scope.get("groupId"))
        subject_value = scope.get("subject", scope.get("subjectId"))
        if isinstance(group_value, dict):
            group_value = group_value.get("id", group_value.get("groupId"))
        if isinstance(subject_value, dict):
            subject_value = subject_value.get("id", subject_value.get("subjectId"))
        assert group_value is not None, f"Scope has no group identifier: {scope!r}"
        assert subject_value is not None, f"Scope has no subject identifier: {scope!r}"
        scoped_group_id = str(group_value)
        subject_id = str(subject_value)

        out_of_scope_group_id = next(
            (
                group_id
                for group_id in available_group_ids
                if group_id != scoped_group_id
                and not any(
                    str(
                        (
                            item.get("group", item.get("groupId"))
                            if not isinstance(
                                item.get("group", item.get("groupId")), dict
                            )
                            else item.get("group", item.get("groupId")).get(
                                "id",
                                item.get("group", item.get("groupId")).get(
                                    "groupId"
                                ),
                            )
                        )
                    )
                    == group_id
                    for item in scopes
                    if isinstance(item, dict)
                )
            ),
            None,
        )
        if out_of_scope_group_id is None:
            out_of_scope_group_id = "2147483647"

        unique_suffix = uuid.uuid4().hex
        forbidden_bank_response = requests.post(
            f"{base_url}/banks",
            data={
                "subject": subject_id,
                "groups": out_of_scope_group_id,
                "title": f"Out of scope bank {unique_suffix}",
            },
            headers={**faculty_headers, **form_headers},
            timeout=timeout,
        )
        assert forbidden_bank_response.status_code == 403, (
            "Expected out-of-scope bank creation to be forbidden, got "
            f"{forbidden_bank_response.status_code}: "
            f"{forbidden_bank_response.text}"
        )

        bank_title = f"Faculty draft bank {unique_suffix}"
        bank_response = requests.post(
            f"{base_url}/banks",
            data={
                "subject": subject_id,
                "groups": scoped_group_id,
                "title": bank_title,
            },
            headers={**faculty_headers, **form_headers},
            timeout=timeout,
        )
        assert bank_response.status_code == 200, (
            f"Bank creation failed: {bank_response.status_code} "
            f"{bank_response.text}"
        )
        bank_id = bank_response.json()["id"]
        created_bank_ids.append(bank_id)

        banks_response = requests.get(
            f"{base_url}/banks", headers=faculty_headers, timeout=timeout
        )
        assert banks_response.status_code == 200, (
            f"Could not list banks: {banks_response.status_code} "
            f"{banks_response.text}"
        )
        banks = banks_response.json()
        assert isinstance(banks, list), f"Expected banks list, got {banks!r}"
        assert any(
            isinstance(bank, dict)
            and str(bank.get("id", bank.get("bankId"))) == str(bank_id)
            for bank in banks
        ), f"Created bank {bank_id} was not present in the bank list"

        prompt = f"Unique authoring prompt {unique_suffix}"
        question_data = {
            "bank": str(bank_id),
            "prompt": prompt,
            "a": "Option Alpha",
            "b": "Option Beta",
            "c": "Option Gamma",
            "d": "Option Delta",
            "correct": "1",
            "explanation": "Option Alpha is correct.",
            "topic": "Authoring validation",
            "difficulty": "MEDIUM",
            "marks": "1",
            "penalty": "0",
        }
        question_response = requests.post(
            f"{base_url}/questions",
            data=question_data,
            headers={**faculty_headers, **form_headers},
            timeout=timeout,
        )
        assert question_response.status_code == 200, (
            f"Question creation failed: {question_response.status_code} "
            f"{question_response.text}"
        )
        question_id = question_response.json()["id"]

        questions_response = requests.get(
            f"{base_url}/questions",
            params={"bank": bank_id},
            headers=faculty_headers,
            timeout=timeout,
        )
        assert questions_response.status_code == 200, (
            f"Could not list questions: {questions_response.status_code} "
            f"{questions_response.text}"
        )
        questions = questions_response.json()
        assert isinstance(questions, list), (
            f"Expected questions list, got {questions!r}"
        )
        assert any(
            isinstance(question, dict)
            and (
                str(question.get("id", question.get("questionId")))
                == str(question_id)
                or question.get("prompt") == prompt
            )
            for question in questions
        ), f"Created question {question_id} was not present in the question list"

        duplicate_options_data = {
            **question_data,
            "prompt": f"Duplicate options prompt {unique_suffix}",
            "a": "Same option",
            "b": "Same option",
        }
        duplicate_options_response = requests.post(
            f"{base_url}/questions",
            data=duplicate_options_data,
            headers={**faculty_headers, **form_headers},
            timeout=timeout,
        )
        assert duplicate_options_response.status_code == 400, (
            "Expected duplicate MCQ options to be rejected with 400, got "
            f"{duplicate_options_response.status_code}: "
            f"{duplicate_options_response.text}"
        )

        duplicate_prompt_response = requests.post(
            f"{base_url}/questions",
            data=question_data,
            headers={**faculty_headers, **form_headers},
            timeout=timeout,
        )
        assert duplicate_prompt_response.status_code == 409, (
            "Expected a duplicate prompt to be rejected with 409, got "
            f"{duplicate_prompt_response.status_code}: "
            f"{duplicate_prompt_response.text}"
        )

        submit_response = requests.post(
            f"{base_url}/bank-state",
            data={"bank": str(bank_id), "state": "SUBMITTED"},
            headers={**faculty_headers, **form_headers},
            timeout=timeout,
        )
        assert submit_response.status_code == 200, (
            f"Could not submit bank: {submit_response.status_code} "
            f"{submit_response.text}"
        )

        non_draft_question_response = requests.post(
            f"{base_url}/questions",
            data={
                **question_data,
                "prompt": f"Question for non-draft bank {unique_suffix}",
            },
            headers={**faculty_headers, **form_headers},
            timeout=timeout,
        )
        assert non_draft_question_response.status_code == 409, (
            "Expected adding a question to a non-draft bank to return 409, got "
            f"{non_draft_question_response.status_code}: "
            f"{non_draft_question_response.text}"
        )

    except requests.RequestException as exc:
        raise AssertionError(f"HTTP request failed: {exc}") from exc
    finally:
        for bank_id in created_bank_ids:
            try:
                requests.delete(
                    f"{base_url}/banks/{bank_id}",
                    headers=locals().get("faculty_headers", {}),
                    timeout=timeout,
                )
            except requests.RequestException:
                pass


if __name__ == "__main__":
    test_faculty_scopes_and_question_bank_authoring()