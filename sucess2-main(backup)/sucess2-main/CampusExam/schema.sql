--
-- PostgreSQL database dump
--


-- Dumped from database version 16.16
-- Dumped by pg_dump version 16.16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.subject DROP CONSTRAINT IF EXISTS subject_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_session_result DROP CONSTRAINT IF EXISTS student_session_result_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_session_result DROP CONSTRAINT IF EXISTS student_session_result_import_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_roster_history DROP CONSTRAINT IF EXISTS student_roster_history_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_roster_history DROP CONSTRAINT IF EXISTS student_roster_history_history_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_roster_history DROP CONSTRAINT IF EXISTS student_roster_history_group_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_roster DROP CONSTRAINT IF EXISTS student_roster_group_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_roster DROP CONSTRAINT IF EXISTS student_roster_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_list_history DROP CONSTRAINT IF EXISTS student_list_history_performed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.student_list_history DROP CONSTRAINT IF EXISTS student_list_history_group_id_fkey;
ALTER TABLE IF EXISTS ONLY public.student_list_history DROP CONSTRAINT IF EXISTS student_list_history_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.sitting_examiner DROP CONSTRAINT IF EXISTS sitting_examiner_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.session_unlock_credential DROP CONSTRAINT IF EXISTS session_unlock_credential_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.session_unlock_credential DROP CONSTRAINT IF EXISTS session_unlock_credential_generated_by_fkey;
ALTER TABLE IF EXISTS ONLY public.session_transfer_history DROP CONSTRAINT IF EXISTS session_transfer_history_transferred_by_fkey;
ALTER TABLE IF EXISTS ONLY public.session_transfer_history DROP CONSTRAINT IF EXISTS session_transfer_history_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.session_transfer_history DROP CONSTRAINT IF EXISTS session_transfer_history_authorization_id_fkey;
ALTER TABLE IF EXISTS ONLY public.session_token DROP CONSTRAINT IF EXISTS session_token_account_id_fkey;
ALTER TABLE IF EXISTS ONLY public.session_roster_snapshot DROP CONSTRAINT IF EXISTS session_roster_snapshot_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.session_roster_snapshot DROP CONSTRAINT IF EXISTS session_roster_snapshot_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.security_violation_log DROP CONSTRAINT IF EXISTS security_violation_log_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.secure_package DROP CONSTRAINT IF EXISTS secure_package_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.secure_package DROP CONSTRAINT IF EXISTS secure_package_exported_by_fkey;
ALTER TABLE IF EXISTS ONLY public.relogin_authorization DROP CONSTRAINT IF EXISTS relogin_authorization_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.relogin_authorization DROP CONSTRAINT IF EXISTS relogin_authorization_authorized_by_fkey;
ALTER TABLE IF EXISTS ONLY public.question_bank DROP CONSTRAINT IF EXISTS question_bank_subject_id_fkey;
ALTER TABLE IF EXISTS ONLY public.question_bank_item DROP CONSTRAINT IF EXISTS question_bank_item_bank_id_fkey;
ALTER TABLE IF EXISTS ONLY public.question DROP CONSTRAINT IF EXISTS question_bank_id_fkey;
ALTER TABLE IF EXISTS ONLY public.question_bank DROP CONSTRAINT IF EXISTS question_bank_finalized_by_fkey;
ALTER TABLE IF EXISTS ONLY public.question_bank DROP CONSTRAINT IF EXISTS question_bank_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.question_bank DROP CONSTRAINT IF EXISTS question_bank_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.paper_version DROP CONSTRAINT IF EXISTS paper_version_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.paper_version_question DROP CONSTRAINT IF EXISTS paper_version_question_version_id_fkey;
ALTER TABLE IF EXISTS ONLY public.paper_version_question DROP CONSTRAINT IF EXISTS paper_version_question_question_id_fkey;
ALTER TABLE IF EXISTS ONLY public.paper_version DROP CONSTRAINT IF EXISTS paper_version_paper_id_fkey;
ALTER TABLE IF EXISTS ONLY public.paper_blueprint DROP CONSTRAINT IF EXISTS paper_blueprint_updated_by_fkey;
ALTER TABLE IF EXISTS ONLY public.paper_blueprint DROP CONSTRAINT IF EXISTS paper_blueprint_subject_id_fkey;
ALTER TABLE IF EXISTS ONLY public.laboratory_history DROP CONSTRAINT IF EXISTS laboratory_history_laboratory_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lab_result_import DROP CONSTRAINT IF EXISTS lab_result_import_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.lab_result_import DROP CONSTRAINT IF EXISTS lab_result_import_released_by_fkey;
ALTER TABLE IF EXISTS ONLY public.lab_result_import DROP CONSTRAINT IF EXISTS lab_result_import_imported_by_fkey;
ALTER TABLE IF EXISTS ONLY public.lab_result_import DROP CONSTRAINT IF EXISTS lab_result_import_approved_by_fkey;
ALTER TABLE IF EXISTS ONLY public.lab_package_acknowledgement DROP CONSTRAINT IF EXISTS lab_package_acknowledgement_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.hod_assignment_history DROP CONSTRAINT IF EXISTS hod_assignment_history_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.hod_assignment_history DROP CONSTRAINT IF EXISTS hod_assignment_history_assigned_by_fkey;
ALTER TABLE IF EXISTS ONLY public.hod_assignment_history DROP CONSTRAINT IF EXISTS hod_assignment_history_account_id_fkey;
ALTER TABLE IF EXISTS ONLY public.generated_paper_question DROP CONSTRAINT IF EXISTS generated_paper_question_question_id_fkey;
ALTER TABLE IF EXISTS ONLY public.generated_paper_question DROP CONSTRAINT IF EXISTS generated_paper_question_paper_id_fkey;
ALTER TABLE IF EXISTS ONLY public.generated_paper DROP CONSTRAINT IF EXISTS generated_paper_bank_id_fkey;
ALTER TABLE IF EXISTS ONLY public.faculty_scope DROP CONSTRAINT IF EXISTS faculty_scope_subject_id_fkey;
ALTER TABLE IF EXISTS ONLY public.faculty_scope DROP CONSTRAINT IF EXISTS faculty_scope_group_id_fkey;
ALTER TABLE IF EXISTS ONLY public.faculty_scope DROP CONSTRAINT IF EXISTS faculty_scope_faculty_id_fkey;
ALTER TABLE IF EXISTS ONLY public.examination_sitting DROP CONSTRAINT IF EXISTS examination_sitting_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.examination_sitting DROP CONSTRAINT IF EXISTS examination_sitting_selected_paper_id_fkey;
ALTER TABLE IF EXISTS ONLY public.examination_session DROP CONSTRAINT IF EXISTS examination_session_subject_id_fkey;
ALTER TABLE IF EXISTS ONLY public.examination_session DROP CONSTRAINT IF EXISTS examination_session_selected_paper_id_fkey;
ALTER TABLE IF EXISTS ONLY public.examination_session DROP CONSTRAINT IF EXISTS examination_session_group_id_fkey;
ALTER TABLE IF EXISTS ONLY public.examination_session DROP CONSTRAINT IF EXISTS examination_session_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.examination_session DROP CONSTRAINT IF EXISTS examination_session_cycle_id_fkey;
ALTER TABLE IF EXISTS ONLY public.examination_session DROP CONSTRAINT IF EXISTS examination_session_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.examination_cycle DROP CONSTRAINT IF EXISTS examination_cycle_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.exam_question DROP CONSTRAINT IF EXISTS exam_question_exam_id_fkey;
ALTER TABLE IF EXISTS ONLY public.exam DROP CONSTRAINT IF EXISTS exam_bank_id_fkey;
ALTER TABLE IF EXISTS ONLY public.course_outcome_submission DROP CONSTRAINT IF EXISTS course_outcome_submission_subject_id_fkey;
ALTER TABLE IF EXISTS ONLY public.course_outcome_submission DROP CONSTRAINT IF EXISTS course_outcome_submission_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.course_outcome_submission DROP CONSTRAINT IF EXISTS course_outcome_submission_created_by_fkey;
ALTER TABLE IF EXISTS ONLY public.course_outcome_statement DROP CONSTRAINT IF EXISTS course_outcome_statement_revision_id_fkey;
ALTER TABLE IF EXISTS ONLY public.course_outcome_revision DROP CONSTRAINT IF EXISTS course_outcome_revision_uploaded_by_fkey;
ALTER TABLE IF EXISTS ONLY public.course_outcome_revision DROP CONSTRAINT IF EXISTS course_outcome_revision_submission_id_fkey;
ALTER TABLE IF EXISTS ONLY public.course_outcome_review DROP CONSTRAINT IF EXISTS course_outcome_review_submission_id_fkey;
ALTER TABLE IF EXISTS ONLY public.course_outcome_review DROP CONSTRAINT IF EXISTS course_outcome_review_reviewed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.computer_assignment DROP CONSTRAINT IF EXISTS computer_assignment_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bank DROP CONSTRAINT IF EXISTS bank_subject_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bank_scope DROP CONSTRAINT IF EXISTS bank_scope_group_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bank_scope DROP CONSTRAINT IF EXISTS bank_scope_bank_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bank DROP CONSTRAINT IF EXISTS bank_owner_id_fkey;
ALTER TABLE IF EXISTS ONLY public.audit DROP CONSTRAINT IF EXISTS audit_actor_fkey;
ALTER TABLE IF EXISTS ONLY public.attempt DROP CONSTRAINT IF EXISTS attempt_exam_id_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.assignment DROP CONSTRAINT IF EXISTS assignment_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.assignment DROP CONSTRAINT IF EXISTS assignment_exam_id_fkey;
ALTER TABLE IF EXISTS ONLY public.answer_key_correction DROP CONSTRAINT IF EXISTS answer_key_correction_submitted_by_fkey;
ALTER TABLE IF EXISTS ONLY public.answer_key_correction DROP CONSTRAINT IF EXISTS answer_key_correction_subject_id_fkey;
ALTER TABLE IF EXISTS ONLY public.answer_key_correction DROP CONSTRAINT IF EXISTS answer_key_correction_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.answer_key_correction DROP CONSTRAINT IF EXISTS answer_key_correction_decided_by_fkey;
ALTER TABLE IF EXISTS ONLY public.answer DROP CONSTRAINT IF EXISTS answer_exam_id_position_fkey;
ALTER TABLE IF EXISTS ONLY public.answer DROP CONSTRAINT IF EXISTS answer_attempt_id_exam_id_fkey;
ALTER TABLE IF EXISTS ONLY public.account DROP CONSTRAINT IF EXISTS account_group_id_fkey;
ALTER TABLE IF EXISTS ONLY public.account DROP CONSTRAINT IF EXISTS account_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.academic_group DROP CONSTRAINT IF EXISTS academic_group_department_id_fkey;
DROP INDEX IF EXISTS public.uq_active_unlock_credential;
DROP INDEX IF EXISTS public.question_prompt_key;
DROP INDEX IF EXISTS public.one_active_attempt;
DROP INDEX IF EXISTS public.idx_unlock_cred_session;
DROP INDEX IF EXISTS public.idx_student_roster_history_hist;
DROP INDEX IF EXISTS public.idx_student_roster_dept_sem_sec_status;
DROP INDEX IF EXISTS public.idx_student_roster_dept_sem;
DROP INDEX IF EXISTS public.idx_student_list_history_group;
DROP INDEX IF EXISTS public.idx_ssr_session_status;
DROP INDEX IF EXISTS public.idx_sitting_examiner_sess;
DROP INDEX IF EXISTS public.idx_session_transfer_session_usn;
DROP INDEX IF EXISTS public.idx_session_roster_snap_sitting;
DROP INDEX IF EXISTS public.idx_sec_violation_session_usn;
DROP INDEX IF EXISTS public.idx_relogin_auth_session_usn;
DROP INDEX IF EXISTS public.idx_question_bank_item_bank_mod_status;
DROP INDEX IF EXISTS public.idx_qb_item_bank_mod;
DROP INDEX IF EXISTS public.idx_paper_blueprint_subject_id;
DROP INDEX IF EXISTS public.idx_lri_status_session;
DROP INDEX IF EXISTS public.idx_lab_pkg_ack_session;
DROP INDEX IF EXISTS public.idx_key_corr_session;
DROP INDEX IF EXISTS public.idx_hod_assignment_dept;
DROP INDEX IF EXISTS public.idx_hod_assignment_account;
DROP INDEX IF EXISTS public.idx_exam_sitting_session;
DROP INDEX IF EXISTS public.idx_exam_sitting_sched;
DROP INDEX IF EXISTS public.idx_exam_session_sched;
DROP INDEX IF EXISTS public.idx_exam_session_dept_status;
DROP INDEX IF EXISTS public.idx_co_submission_dept_sem;
DROP INDEX IF EXISTS public.idx_account_dept_role;
DROP INDEX IF EXISTS public.idx_academic_group_dept_sem_status;
DROP INDEX IF EXISTS public.attempt_due;
ALTER TABLE IF EXISTS ONLY public.examination_sitting DROP CONSTRAINT IF EXISTS uq_session_sitting;
ALTER TABLE IF EXISTS ONLY public.secure_package DROP CONSTRAINT IF EXISTS uq_secure_package_session_sitting;
ALTER TABLE IF EXISTS ONLY public.paper_version DROP CONSTRAINT IF EXISTS uq_paper_version_sitting;
ALTER TABLE IF EXISTS ONLY public.lab_package_acknowledgement DROP CONSTRAINT IF EXISTS uq_lab_package_ack;
ALTER TABLE IF EXISTS ONLY public.subject DROP CONSTRAINT IF EXISTS subject_pkey;
ALTER TABLE IF EXISTS ONLY public.student_session_result DROP CONSTRAINT IF EXISTS student_session_result_session_id_usn_key;
ALTER TABLE IF EXISTS ONLY public.student_session_result DROP CONSTRAINT IF EXISTS student_session_result_pkey;
ALTER TABLE IF EXISTS ONLY public.student_roster DROP CONSTRAINT IF EXISTS student_roster_usn_key;
ALTER TABLE IF EXISTS ONLY public.student_roster DROP CONSTRAINT IF EXISTS student_roster_pkey;
ALTER TABLE IF EXISTS ONLY public.student_roster_history DROP CONSTRAINT IF EXISTS student_roster_history_pkey;
ALTER TABLE IF EXISTS ONLY public.student_list_history DROP CONSTRAINT IF EXISTS student_list_history_pkey;
ALTER TABLE IF EXISTS ONLY public.sitting_examiner DROP CONSTRAINT IF EXISTS sitting_examiner_session_id_sitting_name_employee_id_key;
ALTER TABLE IF EXISTS ONLY public.sitting_examiner DROP CONSTRAINT IF EXISTS sitting_examiner_pkey;
ALTER TABLE IF EXISTS ONLY public.session_unlock_credential DROP CONSTRAINT IF EXISTS session_unlock_credential_session_id_sitting_name_revision_key;
ALTER TABLE IF EXISTS ONLY public.session_unlock_credential DROP CONSTRAINT IF EXISTS session_unlock_credential_pkey;
ALTER TABLE IF EXISTS ONLY public.session_transfer_history DROP CONSTRAINT IF EXISTS session_transfer_history_pkey;
ALTER TABLE IF EXISTS ONLY public.session_token DROP CONSTRAINT IF EXISTS session_token_pkey;
ALTER TABLE IF EXISTS ONLY public.session_roster_snapshot DROP CONSTRAINT IF EXISTS session_roster_snapshot_pkey;
ALTER TABLE IF EXISTS ONLY public.security_violation_log DROP CONSTRAINT IF EXISTS security_violation_log_pkey;
ALTER TABLE IF EXISTS ONLY public.secure_package DROP CONSTRAINT IF EXISTS secure_package_pkey;
ALTER TABLE IF EXISTS ONLY public.secure_package DROP CONSTRAINT IF EXISTS secure_package_package_uid_key;
ALTER TABLE IF EXISTS ONLY public.schema_migrations DROP CONSTRAINT IF EXISTS schema_migrations_pkey;
ALTER TABLE IF EXISTS ONLY public.relogin_authorization DROP CONSTRAINT IF EXISTS relogin_authorization_token_id_key;
ALTER TABLE IF EXISTS ONLY public.relogin_authorization DROP CONSTRAINT IF EXISTS relogin_authorization_token_hash_key;
ALTER TABLE IF EXISTS ONLY public.relogin_authorization DROP CONSTRAINT IF EXISTS relogin_authorization_pkey;
ALTER TABLE IF EXISTS ONLY public.question DROP CONSTRAINT IF EXISTS question_pkey;
ALTER TABLE IF EXISTS ONLY public.question_bank DROP CONSTRAINT IF EXISTS question_bank_pkey;
ALTER TABLE IF EXISTS ONLY public.question_bank_item DROP CONSTRAINT IF EXISTS question_bank_item_pkey;
ALTER TABLE IF EXISTS ONLY public.question_bank_item DROP CONSTRAINT IF EXISTS question_bank_item_bank_id_question_uid_key;
ALTER TABLE IF EXISTS ONLY public.paper_version_question DROP CONSTRAINT IF EXISTS paper_version_question_pkey;
ALTER TABLE IF EXISTS ONLY public.paper_version DROP CONSTRAINT IF EXISTS paper_version_pkey;
ALTER TABLE IF EXISTS ONLY public.paper_blueprint DROP CONSTRAINT IF EXISTS paper_blueprint_subject_id_key;
ALTER TABLE IF EXISTS ONLY public.paper_blueprint DROP CONSTRAINT IF EXISTS paper_blueprint_pkey;
ALTER TABLE IF EXISTS ONLY public.laboratory DROP CONSTRAINT IF EXISTS laboratory_pkey;
ALTER TABLE IF EXISTS ONLY public.laboratory_history DROP CONSTRAINT IF EXISTS laboratory_history_pkey;
ALTER TABLE IF EXISTS ONLY public.laboratory DROP CONSTRAINT IF EXISTS laboratory_code_key;
ALTER TABLE IF EXISTS ONLY public.lab_result_import DROP CONSTRAINT IF EXISTS lab_result_import_session_id_key;
ALTER TABLE IF EXISTS ONLY public.lab_result_import DROP CONSTRAINT IF EXISTS lab_result_import_pkey;
ALTER TABLE IF EXISTS ONLY public.lab_package_acknowledgement DROP CONSTRAINT IF EXISTS lab_package_acknowledgement_pkey;
ALTER TABLE IF EXISTS ONLY public.hod_assignment_history DROP CONSTRAINT IF EXISTS hod_assignment_history_pkey;
ALTER TABLE IF EXISTS ONLY public.generated_paper_question DROP CONSTRAINT IF EXISTS generated_paper_question_pkey;
ALTER TABLE IF EXISTS ONLY public.generated_paper DROP CONSTRAINT IF EXISTS generated_paper_pkey;
ALTER TABLE IF EXISTS ONLY public.generated_paper DROP CONSTRAINT IF EXISTS generated_paper_bank_id_paper_number_key;
ALTER TABLE IF EXISTS ONLY public.faculty_scope DROP CONSTRAINT IF EXISTS faculty_scope_pkey;
ALTER TABLE IF EXISTS ONLY public.examination_sitting DROP CONSTRAINT IF EXISTS examination_sitting_pkey;
ALTER TABLE IF EXISTS ONLY public.examination_session DROP CONSTRAINT IF EXISTS examination_session_pkey;
ALTER TABLE IF EXISTS ONLY public.examination_cycle DROP CONSTRAINT IF EXISTS examination_cycle_pkey;
ALTER TABLE IF EXISTS ONLY public.exam_question DROP CONSTRAINT IF EXISTS exam_question_pkey;
ALTER TABLE IF EXISTS ONLY public.exam DROP CONSTRAINT IF EXISTS exam_pkey;
ALTER TABLE IF EXISTS ONLY public.department DROP CONSTRAINT IF EXISTS department_pkey;
ALTER TABLE IF EXISTS ONLY public.department DROP CONSTRAINT IF EXISTS department_code_key;
ALTER TABLE IF EXISTS ONLY public.course_outcome_submission DROP CONSTRAINT IF EXISTS course_outcome_submission_subject_id_academic_session_key;
ALTER TABLE IF EXISTS ONLY public.course_outcome_submission DROP CONSTRAINT IF EXISTS course_outcome_submission_pkey;
ALTER TABLE IF EXISTS ONLY public.course_outcome_statement DROP CONSTRAINT IF EXISTS course_outcome_statement_revision_id_co_code_key;
ALTER TABLE IF EXISTS ONLY public.course_outcome_statement DROP CONSTRAINT IF EXISTS course_outcome_statement_pkey;
ALTER TABLE IF EXISTS ONLY public.course_outcome_revision DROP CONSTRAINT IF EXISTS course_outcome_revision_submission_id_revision_number_key;
ALTER TABLE IF EXISTS ONLY public.course_outcome_revision DROP CONSTRAINT IF EXISTS course_outcome_revision_pkey;
ALTER TABLE IF EXISTS ONLY public.course_outcome_review DROP CONSTRAINT IF EXISTS course_outcome_review_pkey;
ALTER TABLE IF EXISTS ONLY public.computer_assignment DROP CONSTRAINT IF EXISTS computer_assignment_session_id_computer_number_key;
ALTER TABLE IF EXISTS ONLY public.computer_assignment DROP CONSTRAINT IF EXISTS computer_assignment_pkey;
ALTER TABLE IF EXISTS ONLY public.subject DROP CONSTRAINT IF EXISTS chk_subject_dept_sem_code;
ALTER TABLE IF EXISTS ONLY public.bank_scope DROP CONSTRAINT IF EXISTS bank_scope_pkey;
ALTER TABLE IF EXISTS ONLY public.bank DROP CONSTRAINT IF EXISTS bank_pkey;
ALTER TABLE IF EXISTS ONLY public.audit DROP CONSTRAINT IF EXISTS audit_pkey;
ALTER TABLE IF EXISTS ONLY public.attempt DROP CONSTRAINT IF EXISTS attempt_pkey;
ALTER TABLE IF EXISTS ONLY public.attempt DROP CONSTRAINT IF EXISTS attempt_id_exam_id_key;
ALTER TABLE IF EXISTS ONLY public.assignment DROP CONSTRAINT IF EXISTS assignment_pkey;
ALTER TABLE IF EXISTS ONLY public.answer DROP CONSTRAINT IF EXISTS answer_pkey;
ALTER TABLE IF EXISTS ONLY public.answer_key_correction DROP CONSTRAINT IF EXISTS answer_key_correction_pkey;
ALTER TABLE IF EXISTS ONLY public.account DROP CONSTRAINT IF EXISTS account_username_key;
ALTER TABLE IF EXISTS ONLY public.account DROP CONSTRAINT IF EXISTS account_pkey;
ALTER TABLE IF EXISTS ONLY public.academic_group DROP CONSTRAINT IF EXISTS academic_group_pkey;
ALTER TABLE IF EXISTS ONLY public.academic_group DROP CONSTRAINT IF EXISTS academic_group_department_academic_session_study_year_semes_key;
ALTER TABLE IF EXISTS public.paper_blueprint ALTER COLUMN id DROP DEFAULT;
DROP TABLE IF EXISTS public.subject;
DROP TABLE IF EXISTS public.student_session_result;
DROP TABLE IF EXISTS public.student_roster_history;
DROP TABLE IF EXISTS public.student_roster;
DROP TABLE IF EXISTS public.student_list_history;
DROP TABLE IF EXISTS public.sitting_examiner;
DROP TABLE IF EXISTS public.session_unlock_credential;
DROP TABLE IF EXISTS public.session_transfer_history;
DROP TABLE IF EXISTS public.session_token;
DROP TABLE IF EXISTS public.session_roster_snapshot;
DROP TABLE IF EXISTS public.security_violation_log;
DROP TABLE IF EXISTS public.secure_package;
DROP TABLE IF EXISTS public.schema_migrations;
DROP TABLE IF EXISTS public.relogin_authorization;
DROP TABLE IF EXISTS public.question_bank_item;
DROP TABLE IF EXISTS public.question_bank;
DROP TABLE IF EXISTS public.question;
DROP TABLE IF EXISTS public.paper_version_question;
DROP TABLE IF EXISTS public.paper_version;
DROP SEQUENCE IF EXISTS public.paper_blueprint_id_seq;
DROP TABLE IF EXISTS public.paper_blueprint;
DROP TABLE IF EXISTS public.laboratory_history;
DROP TABLE IF EXISTS public.laboratory;
DROP TABLE IF EXISTS public.lab_result_import;
DROP TABLE IF EXISTS public.lab_package_acknowledgement;
DROP TABLE IF EXISTS public.hod_assignment_history;
DROP TABLE IF EXISTS public.generated_paper_question;
DROP TABLE IF EXISTS public.generated_paper;
DROP TABLE IF EXISTS public.faculty_scope;
DROP TABLE IF EXISTS public.examination_sitting;
DROP TABLE IF EXISTS public.examination_session;
DROP TABLE IF EXISTS public.examination_cycle;
DROP TABLE IF EXISTS public.exam_question;
DROP TABLE IF EXISTS public.exam;
DROP TABLE IF EXISTS public.department;
DROP TABLE IF EXISTS public.course_outcome_submission;
DROP TABLE IF EXISTS public.course_outcome_statement;
DROP TABLE IF EXISTS public.course_outcome_revision;
DROP TABLE IF EXISTS public.course_outcome_review;
DROP TABLE IF EXISTS public.computer_assignment;
DROP TABLE IF EXISTS public.bank_scope;
DROP TABLE IF EXISTS public.bank;
DROP TABLE IF EXISTS public.audit;
DROP TABLE IF EXISTS public.attempt;
DROP TABLE IF EXISTS public.assignment;
DROP TABLE IF EXISTS public.answer_key_correction;
DROP TABLE IF EXISTS public.answer;
DROP TABLE IF EXISTS public.account;
DROP TABLE IF EXISTS public.academic_group;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: academic_group; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.academic_group (
    id bigint NOT NULL,
    department text NOT NULL,
    academic_session text NOT NULL,
    study_year integer DEFAULT 1,
    semester integer NOT NULL,
    section text NOT NULL,
    department_id bigint,
    year integer,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    archived_at timestamp with time zone,
    CONSTRAINT academic_group_semester_check CHECK ((semester > 0)),
    CONSTRAINT academic_group_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'ARCHIVED'::text]))),
    CONSTRAINT academic_group_study_year_check CHECK ((study_year > 0))
);


--
-- Name: academic_group_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.academic_group ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.academic_group_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id bigint NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL,
    group_id bigint,
    department_id bigint,
    full_name text,
    email text,
    contact_number text,
    employee_id text,
    designation text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    last_login_at timestamp with time zone,
    theme_preference text DEFAULT 'system'::text,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT chk_account_status CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'SUSPENDED'::text])))
);


--
-- Name: account_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.account ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.account_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: answer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.answer (
    attempt_id bigint NOT NULL,
    exam_id bigint NOT NULL,
    "position" integer NOT NULL,
    choice integer,
    review boolean NOT NULL,
    version bigint NOT NULL,
    CONSTRAINT answer_choice_check CHECK (((choice >= 1) AND (choice <= 4))),
    CONSTRAINT answer_version_check CHECK ((version > 0))
);


--
-- Name: answer_key_correction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.answer_key_correction (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    subject_id bigint NOT NULL,
    question_uid text NOT NULL,
    question_text text NOT NULL,
    original_correct text NOT NULL,
    proposed_correct text NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    submitted_by bigint NOT NULL,
    submitted_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    decided_by bigint,
    decided_at timestamp with time zone,
    decision_reason text,
    CONSTRAINT answer_key_correction_original_correct_check CHECK ((original_correct = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text]))),
    CONSTRAINT answer_key_correction_proposed_correct_check CHECK ((proposed_correct = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text, 'ALL_CORRECT'::text, 'SCRAP_QUESTION'::text]))),
    CONSTRAINT answer_key_correction_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text])))
);


--
-- Name: answer_key_correction_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.answer_key_correction ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.answer_key_correction_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment (
    exam_id bigint NOT NULL,
    student_id bigint NOT NULL
);


--
-- Name: attempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attempt (
    id bigint NOT NULL,
    exam_id bigint NOT NULL,
    student_id bigint NOT NULL,
    started timestamp with time zone NOT NULL,
    deadline timestamp with time zone NOT NULL,
    last_seen timestamp with time zone NOT NULL,
    submitted timestamp with time zone,
    reason text,
    score numeric(12,2),
    pending integer DEFAULT 0 NOT NULL
);


--
-- Name: attempt_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.attempt ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.attempt_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit (
    id bigint NOT NULL,
    happened timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    actor bigint,
    action text NOT NULL,
    entity text NOT NULL,
    detail text DEFAULT ''::text NOT NULL
);


--
-- Name: audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bank; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank (
    id bigint NOT NULL,
    owner_id bigint NOT NULL,
    subject_id bigint NOT NULL,
    title text NOT NULL,
    state text DEFAULT 'DRAFT'::text NOT NULL,
    CONSTRAINT bank_state_check CHECK ((state = ANY (ARRAY['DRAFT'::text, 'SUBMITTED'::text, 'APPROVED'::text, 'REJECTED'::text, 'ARCHIVED'::text])))
);


--
-- Name: bank_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.bank ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.bank_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bank_scope; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_scope (
    bank_id bigint NOT NULL,
    group_id bigint NOT NULL
);


--
-- Name: computer_assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.computer_assignment (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    computer_number text NOT NULL,
    assigned_version_letter text NOT NULL,
    CONSTRAINT computer_assignment_assigned_version_letter_check CHECK ((assigned_version_letter = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text])))
);


--
-- Name: computer_assignment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.computer_assignment ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.computer_assignment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: course_outcome_review; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_outcome_review (
    id bigint NOT NULL,
    submission_id bigint NOT NULL,
    reviewed_by bigint NOT NULL,
    decision text NOT NULL,
    comments text NOT NULL,
    reviewed_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT course_outcome_review_decision_check CHECK ((decision = ANY (ARRAY['REVIEWED_OK'::text, 'CLARIFICATION_REQUESTED'::text])))
);


--
-- Name: course_outcome_review_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.course_outcome_review ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.course_outcome_review_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: course_outcome_revision; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_outcome_revision (
    id bigint NOT NULL,
    submission_id bigint NOT NULL,
    revision_number integer NOT NULL,
    file_name text NOT NULL,
    file_size_bytes bigint NOT NULL,
    file_hash_sha256 text NOT NULL,
    pdf_blob bytea,
    uploaded_by bigint NOT NULL,
    uploaded_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: course_outcome_revision_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.course_outcome_revision ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.course_outcome_revision_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: course_outcome_statement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_outcome_statement (
    id bigint NOT NULL,
    revision_id bigint NOT NULL,
    co_code text NOT NULL,
    description text NOT NULL,
    bloom_level text NOT NULL,
    target_percentage numeric(5,2)
);


--
-- Name: course_outcome_statement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.course_outcome_statement ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.course_outcome_statement_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: course_outcome_submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_outcome_submission (
    id bigint NOT NULL,
    subject_id bigint NOT NULL,
    department_id bigint,
    academic_session text NOT NULL,
    semester integer NOT NULL,
    current_revision integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'Under Review'::text NOT NULL,
    created_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT course_outcome_submission_semester_check CHECK (((semester >= 1) AND (semester <= 8))),
    CONSTRAINT course_outcome_submission_status_check CHECK ((status = ANY (ARRAY['Under Review'::text, 'Reviewed'::text, 'Clarification Requested'::text])))
);


--
-- Name: course_outcome_submission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.course_outcome_submission ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.course_outcome_submission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    CONSTRAINT department_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'ARCHIVED'::text, 'INACTIVE'::text])))
);


--
-- Name: department_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.department ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.department_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: exam; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam (
    id bigint NOT NULL,
    title text NOT NULL,
    instructions text NOT NULL,
    bank_id bigint NOT NULL,
    mode text NOT NULL,
    duration integer NOT NULL,
    attempt_limit integer NOT NULL,
    opens timestamp with time zone NOT NULL,
    closes timestamp with time zone NOT NULL,
    pass_marks numeric(12,2) NOT NULL,
    released boolean DEFAULT false NOT NULL,
    CONSTRAINT exam_attempt_limit_check CHECK (((attempt_limit >= 1) AND (attempt_limit <= 100))),
    CONSTRAINT exam_check CHECK ((closes > opens)),
    CONSTRAINT exam_duration_check CHECK (((duration >= 1) AND (duration <= 28800))),
    CONSTRAINT exam_mode_check CHECK ((mode = ANY (ARRAY['OFFICIAL'::text, 'PRACTICE'::text]))),
    CONSTRAINT exam_pass_marks_check CHECK ((pass_marks >= (0)::numeric))
);


--
-- Name: exam_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.exam ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.exam_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: exam_question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_question (
    exam_id bigint NOT NULL,
    "position" integer NOT NULL,
    prompt text NOT NULL,
    options text[] NOT NULL,
    correct integer NOT NULL,
    explanation text NOT NULL,
    topic text NOT NULL,
    difficulty text NOT NULL,
    marks numeric(8,2) NOT NULL,
    penalty numeric(8,2) NOT NULL,
    CONSTRAINT exam_question_position_check CHECK (("position" > 0))
);


--
-- Name: examination_cycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.examination_cycle (
    id bigint NOT NULL,
    title text NOT NULL,
    academic_session text NOT NULL,
    cycle_type text NOT NULL,
    created_by bigint NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: examination_cycle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.examination_cycle ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.examination_cycle_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: examination_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.examination_session (
    id bigint NOT NULL,
    cycle_id bigint NOT NULL,
    subject_id bigint NOT NULL,
    department_id bigint,
    group_id bigint NOT NULL,
    session_date date NOT NULL,
    sitting text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    duration_minutes integer NOT NULL,
    assigned_lab text NOT NULL,
    selected_paper_id bigint,
    status text DEFAULT 'SCHEDULED'::text NOT NULL,
    created_by bigint NOT NULL,
    frozen_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    total_marks numeric(8,2) DEFAULT 30.00 NOT NULL,
    passing_marks numeric(8,2) NOT NULL,
    cancellation_reason text,
    is_cancelled boolean DEFAULT false NOT NULL,
    package_revision integer DEFAULT 1 NOT NULL,
    participating_sections text[] DEFAULT ARRAY['A'::text] NOT NULL,
    CONSTRAINT chk_passing_marks_range CHECK (((passing_marks > (0)::numeric) AND (passing_marks <= total_marks))),
    CONSTRAINT examination_session_duration_minutes_check CHECK ((duration_minutes > 0)),
    CONSTRAINT examination_session_sitting_check CHECK ((sitting = ANY (ARRAY['MORNING'::text, 'AFTERNOON'::text]))),
    CONSTRAINT examination_session_status_check CHECK ((status = ANY (ARRAY['SCHEDULED'::text, 'FROZEN'::text, 'PACKAGE_EXPORTED'::text, 'RESULTS_IMPORTED'::text, 'APPROVED'::text, 'RELEASED'::text, 'CANCELLED'::text, 'RETIRED'::text])))
);


--
-- Name: examination_session_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.examination_session ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.examination_session_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: examination_sitting; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.examination_sitting (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    sitting_name text NOT NULL,
    exam_date date NOT NULL,
    start_time time without time zone NOT NULL,
    duration_minutes integer NOT NULL,
    assigned_lab text NOT NULL,
    lab_capacity integer DEFAULT 60 NOT NULL,
    student_count integer DEFAULT 0 NOT NULL,
    selected_paper_id bigint,
    status text DEFAULT 'SCHEDULED'::text NOT NULL,
    package_revision integer DEFAULT 1 NOT NULL,
    package_id text,
    package_status text DEFAULT 'Not Prepared'::text NOT NULL,
    transfer_status text DEFAULT 'Not Sent'::text NOT NULL,
    verification_status text DEFAULT 'Verification Pending'::text NOT NULL,
    lab_receipt_confirmed boolean DEFAULT false NOT NULL,
    signature_verified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT examination_sitting_duration_minutes_check CHECK ((duration_minutes > 0)),
    CONSTRAINT examination_sitting_sitting_name_check CHECK ((sitting_name = ANY (ARRAY['MORNING'::text, 'AFTERNOON'::text]))),
    CONSTRAINT examination_sitting_status_check CHECK ((status = ANY (ARRAY['SCHEDULED'::text, 'FROZEN'::text, 'PACKAGE_EXPORTED'::text, 'VERIFIED'::text, 'READY'::text, 'COMPLETED'::text, 'CANCELLED'::text, 'RETIRED'::text])))
);


--
-- Name: examination_sitting_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.examination_sitting ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.examination_sitting_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: faculty_scope; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faculty_scope (
    faculty_id bigint NOT NULL,
    group_id bigint NOT NULL,
    subject_id bigint NOT NULL
);


--
-- Name: generated_paper; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_paper (
    id bigint NOT NULL,
    bank_id bigint NOT NULL,
    paper_number integer NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'READY'::text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT generated_paper_paper_number_check CHECK ((paper_number >= 1)),
    CONSTRAINT generated_paper_status_check CHECK ((status = ANY (ARRAY['READY'::text, 'AVAILABLE'::text, 'SELECTED'::text, 'SCHEDULED'::text, 'RESERVED'::text, 'CONSUMED'::text, 'RETIRED'::text])))
);


--
-- Name: generated_paper_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.generated_paper ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.generated_paper_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: generated_paper_question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.generated_paper_question (
    paper_id bigint NOT NULL,
    question_id bigint NOT NULL,
    module_number integer NOT NULL,
    paper_position integer NOT NULL,
    CONSTRAINT generated_paper_question_paper_position_check CHECK ((paper_position >= 1))
);


--
-- Name: hod_assignment_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hod_assignment_history (
    id bigint NOT NULL,
    department_id bigint NOT NULL,
    account_id bigint NOT NULL,
    assigned_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    relieved_at timestamp with time zone,
    reason text DEFAULT 'Initial Assignment'::text NOT NULL,
    assigned_by bigint
);


--
-- Name: hod_assignment_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.hod_assignment_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.hod_assignment_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lab_package_acknowledgement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_package_acknowledgement (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    sitting_name text NOT NULL,
    package_uid text NOT NULL,
    package_hash text NOT NULL,
    lab_server_id text NOT NULL,
    verification_result text NOT NULL,
    receipt_status text NOT NULL,
    signature_hex text NOT NULL,
    acknowledged_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT lab_package_acknowledgement_sitting_name_check CHECK ((sitting_name = ANY (ARRAY['MORNING'::text, 'AFTERNOON'::text])))
);


--
-- Name: lab_package_acknowledgement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.lab_package_acknowledgement ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lab_package_acknowledgement_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lab_result_import; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_result_import (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    raw_payload_json text NOT NULL,
    signature_hex text NOT NULL,
    total_candidates integer NOT NULL,
    attended integer NOT NULL,
    absent integer NOT NULL,
    highest_marks numeric(8,2) DEFAULT 0 NOT NULL,
    average_marks numeric(8,2) DEFAULT 0 NOT NULL,
    pass_percentage numeric(5,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'IMPORTED'::text NOT NULL,
    imported_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    imported_by bigint NOT NULL,
    approved_at timestamp with time zone,
    approved_by bigint,
    released_at timestamp with time zone,
    released_by bigint,
    CONSTRAINT lab_result_import_status_check CHECK ((status = ANY (ARRAY['IMPORTED'::text, 'APPROVED'::text, 'RELEASED'::text])))
);


--
-- Name: lab_result_import_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.lab_result_import ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lab_result_import_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: laboratory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.laboratory (
    id bigint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    building_location text NOT NULL,
    capacity integer NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT laboratory_capacity_check CHECK ((capacity > 0)),
    CONSTRAINT laboratory_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'ARCHIVED'::text])))
);


--
-- Name: laboratory_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.laboratory_history (
    id bigint NOT NULL,
    laboratory_id bigint,
    action text NOT NULL,
    previous_state jsonb,
    new_state jsonb,
    performed_by bigint,
    recorded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: laboratory_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.laboratory_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.laboratory_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: laboratory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.laboratory ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.laboratory_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: paper_blueprint; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paper_blueprint (
    id bigint NOT NULL,
    subject_id bigint NOT NULL,
    total_questions integer NOT NULL,
    module_distribution jsonb NOT NULL,
    updated_by bigint,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT paper_blueprint_total_questions_check CHECK ((total_questions > 0))
);


--
-- Name: paper_blueprint_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.paper_blueprint_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: paper_blueprint_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.paper_blueprint_id_seq OWNED BY public.paper_blueprint.id;


--
-- Name: paper_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paper_version (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    paper_id bigint NOT NULL,
    version_letter text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    sitting_name text DEFAULT 'MORNING'::text NOT NULL,
    CONSTRAINT paper_version_sitting_name_check CHECK ((sitting_name = ANY (ARRAY['MORNING'::text, 'AFTERNOON'::text]))),
    CONSTRAINT paper_version_version_letter_check CHECK ((version_letter = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text])))
);


--
-- Name: paper_version_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.paper_version ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.paper_version_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: paper_version_question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.paper_version_question (
    version_id bigint NOT NULL,
    question_id bigint NOT NULL,
    question_uid text NOT NULL,
    display_position integer NOT NULL,
    shuffled_options text[] NOT NULL,
    shuffled_correct integer NOT NULL,
    marks numeric(8,2) DEFAULT 1.00 NOT NULL,
    CONSTRAINT paper_version_question_display_position_check CHECK (((display_position >= 1) AND (display_position <= 200))),
    CONSTRAINT paper_version_question_shuffled_correct_check CHECK (((shuffled_correct >= 1) AND (shuffled_correct <= 4)))
);


--
-- Name: question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question (
    id bigint NOT NULL,
    bank_id bigint NOT NULL,
    prompt text NOT NULL,
    options text[] NOT NULL,
    correct integer NOT NULL,
    explanation text NOT NULL,
    topic text NOT NULL,
    difficulty text NOT NULL,
    marks numeric(8,2) NOT NULL,
    penalty numeric(8,2) NOT NULL,
    CONSTRAINT question_check CHECK (((penalty >= (0)::numeric) AND (penalty <= marks))),
    CONSTRAINT question_correct_check CHECK (((correct >= 1) AND (correct <= 4))),
    CONSTRAINT question_difficulty_check CHECK ((difficulty = ANY (ARRAY['EASY'::text, 'MEDIUM'::text, 'HARD'::text]))),
    CONSTRAINT question_marks_check CHECK ((marks > (0)::numeric)),
    CONSTRAINT question_options_check CHECK ((cardinality(options) = 4))
);


--
-- Name: question_bank; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_bank (
    id bigint NOT NULL,
    department_id bigint,
    subject_id bigint NOT NULL,
    academic_session text NOT NULL,
    semester integer NOT NULL,
    title text NOT NULL,
    created_by bigint NOT NULL,
    revision_number integer DEFAULT 1 NOT NULL,
    state text DEFAULT 'DRAFT'::text NOT NULL,
    total_questions integer DEFAULT 0 NOT NULL,
    finalized_at timestamp with time zone,
    finalized_by bigint,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT question_bank_state_check CHECK ((state = ANY (ARRAY['DRAFT'::text, 'SUBMITTED'::text, 'FINALIZED'::text, 'REOPENED'::text, 'ARCHIVED'::text])))
);


--
-- Name: question_bank_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.question_bank ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.question_bank_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: question_bank_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_bank_item (
    id bigint NOT NULL,
    bank_id bigint NOT NULL,
    question_uid text NOT NULL,
    module_number integer NOT NULL,
    prompt text NOT NULL,
    options text[] NOT NULL,
    correct integer NOT NULL,
    explanation text,
    marks numeric(8,2) DEFAULT 1.00 NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    has_images boolean DEFAULT false NOT NULL,
    stem_images jsonb DEFAULT '[]'::jsonb,
    option_images jsonb DEFAULT '[]'::jsonb,
    status text DEFAULT 'Active'::text NOT NULL,
    CONSTRAINT question_bank_item_correct_check CHECK (((correct >= 1) AND (correct <= 4))),
    CONSTRAINT question_bank_item_module_number_check CHECK (((module_number >= 1) AND (module_number <= 12))),
    CONSTRAINT question_bank_item_options_check CHECK ((cardinality(options) = 4)),
    CONSTRAINT question_bank_item_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Archived'::text, 'Superseded'::text])))
);


--
-- Name: question_bank_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.question_bank_item ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.question_bank_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: question_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.question ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.question_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: relogin_authorization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.relogin_authorization (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    student_usn text NOT NULL,
    assigned_workstation_id text NOT NULL,
    target_workstation_id text DEFAULT 'Any Available PC'::text,
    token_id text NOT NULL,
    token_hash text NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    authorized_by bigint,
    authorized_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    is_one_time_used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT relogin_authorization_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'USED'::text, 'EXPIRED'::text])))
);


--
-- Name: relogin_authorization_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.relogin_authorization ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.relogin_authorization_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version text NOT NULL,
    description text NOT NULL,
    applied_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: secure_package; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.secure_package (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    package_uid text NOT NULL,
    encrypted_payload text NOT NULL,
    encrypted_key_hex text NOT NULL,
    iv_hex text NOT NULL,
    signature_hex text NOT NULL,
    digest_hex text NOT NULL,
    status text DEFAULT 'PREPARED'::text NOT NULL,
    exported_at timestamp with time zone,
    exported_by bigint,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    sitting_name text DEFAULT 'MORNING'::text NOT NULL,
    CONSTRAINT secure_package_sitting_name_check CHECK ((sitting_name = ANY (ARRAY['MORNING'::text, 'AFTERNOON'::text]))),
    CONSTRAINT secure_package_status_check CHECK ((status = ANY (ARRAY['PREPARED'::text, 'EXPORTED'::text, 'RECEIVED'::text, 'VERIFIED'::text, 'ACCEPTED'::text, 'READY'::text])))
);


--
-- Name: secure_package_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.secure_package ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.secure_package_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: security_violation_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_violation_log (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    student_usn text NOT NULL,
    workstation_id text,
    violation_type text NOT NULL,
    label text NOT NULL,
    description text NOT NULL,
    current_question_index integer,
    remaining_seconds integer,
    answered_count integer,
    logged_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    CONSTRAINT security_violation_log_violation_type_check CHECK ((violation_type = ANY (ARRAY['TAB_SWITCH'::text, 'WINDOW_BLUR'::text, 'SHORTCUT_KEY'::text, 'FULLSCREEN_EXIT'::text, 'DEVTOOLS_ATTEMPT'::text])))
);


--
-- Name: security_violation_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.security_violation_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.security_violation_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: session_roster_snapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_roster_snapshot (
    session_id bigint NOT NULL,
    student_id bigint NOT NULL,
    usn text NOT NULL,
    full_name text NOT NULL,
    date_of_birth date NOT NULL,
    assigned_version text,
    sitting_name text DEFAULT 'MORNING'::text NOT NULL,
    original_section text,
    assigned_lab text,
    CONSTRAINT session_roster_snapshot_sitting_name_check CHECK ((sitting_name = ANY (ARRAY['MORNING'::text, 'AFTERNOON'::text])))
);


--
-- Name: session_token; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_token (
    token_hash text NOT NULL,
    account_id bigint NOT NULL,
    expires timestamp with time zone NOT NULL
);


--
-- Name: session_transfer_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_transfer_history (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    student_usn text NOT NULL,
    from_workstation text NOT NULL,
    to_workstation text NOT NULL,
    authorization_id bigint,
    reason text NOT NULL,
    transferred_by bigint NOT NULL,
    transferred_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: session_transfer_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.session_transfer_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.session_transfer_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: session_unlock_credential; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_unlock_credential (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    sitting_name text NOT NULL,
    masked_preview text NOT NULL,
    verifier_hash text NOT NULL,
    salt text NOT NULL,
    iterations integer DEFAULT 600000 NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'Active'::text NOT NULL,
    generated_by bigint NOT NULL,
    generated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_synced_at timestamp with time zone,
    CONSTRAINT session_unlock_credential_sitting_name_check CHECK ((sitting_name = ANY (ARRAY['MORNING'::text, 'AFTERNOON'::text]))),
    CONSTRAINT session_unlock_credential_status_check CHECK ((status = ANY (ARRAY['Active'::text, 'Revoked'::text, 'Expired'::text, 'Superseded'::text, 'Synchronisation Failed'::text])))
);


--
-- Name: session_unlock_credential_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.session_unlock_credential ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.session_unlock_credential_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: sitting_examiner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sitting_examiner (
    id bigint NOT NULL,
    session_id bigint NOT NULL,
    sitting_name text NOT NULL,
    examiner_name text NOT NULL,
    employee_id text NOT NULL,
    designation text NOT NULL,
    assigned_lab text NOT NULL,
    contact_number text,
    is_frozen boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT sitting_examiner_sitting_name_check CHECK ((sitting_name = ANY (ARRAY['MORNING'::text, 'AFTERNOON'::text])))
);


--
-- Name: sitting_examiner_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.sitting_examiner ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sitting_examiner_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: student_list_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_list_history (
    id bigint NOT NULL,
    group_id bigint NOT NULL,
    department_id bigint NOT NULL,
    semester integer NOT NULL,
    section text NOT NULL,
    revision_number text DEFAULT 'R1'::text NOT NULL,
    file_name text,
    source_type text DEFAULT 'EXCEL_UPLOAD'::text NOT NULL,
    action_type text DEFAULT 'UPLOAD'::text NOT NULL,
    total_students integer DEFAULT 0 NOT NULL,
    valid_count integer DEFAULT 0 NOT NULL,
    invalid_count integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'Active'::text NOT NULL,
    performed_by bigint,
    performed_by_name text,
    summary jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: student_list_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.student_list_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.student_list_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: student_roster; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_roster (
    id bigint NOT NULL,
    usn text NOT NULL,
    full_name text NOT NULL,
    date_of_birth date NOT NULL,
    group_id bigint NOT NULL,
    department_id bigint,
    semester integer NOT NULL,
    section text NOT NULL,
    created_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    archived_at timestamp with time zone,
    unenroll_reason text,
    CONSTRAINT student_roster_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'INACTIVE'::text, 'ARCHIVED'::text, 'SUPERSEDED'::text])))
);


--
-- Name: student_roster_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_roster_history (
    id bigint NOT NULL,
    history_id bigint NOT NULL,
    student_id bigint NOT NULL,
    group_id bigint NOT NULL,
    usn text NOT NULL,
    full_name text NOT NULL,
    date_of_birth date NOT NULL,
    status text NOT NULL,
    snapshot_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL
);


--
-- Name: student_roster_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.student_roster_history ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.student_roster_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: student_roster_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.student_roster ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.student_roster_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: student_session_result; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_session_result (
    id bigint NOT NULL,
    import_id bigint NOT NULL,
    session_id bigint NOT NULL,
    usn text NOT NULL,
    full_name text NOT NULL,
    assigned_version text NOT NULL,
    total_questions integer NOT NULL,
    correct_count integer NOT NULL,
    incorrect_count integer NOT NULL,
    unanswered_count integer NOT NULL,
    score numeric(8,2) NOT NULL,
    passed boolean NOT NULL,
    submission_status text NOT NULL,
    response_map jsonb DEFAULT '{}'::jsonb,
    original_score numeric(8,2),
    revised_score numeric(8,2)
);


--
-- Name: student_session_result_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.student_session_result ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.student_session_result_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: subject; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subject (
    id bigint NOT NULL,
    code text,
    name text NOT NULL,
    department_id bigint,
    semester integer DEFAULT 1,
    applicable_sections text[] DEFAULT ARRAY['Section A'::text, 'Section B'::text],
    module_count integer DEFAULT 5 NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    CONSTRAINT subject_module_count_check CHECK (((module_count >= 1) AND (module_count <= 12))),
    CONSTRAINT subject_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'ARCHIVED'::text])))
);


--
-- Name: subject_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.subject ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.subject_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: paper_blueprint id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paper_blueprint ALTER COLUMN id SET DEFAULT nextval('public.paper_blueprint_id_seq'::regclass);


--
-- Name: academic_group academic_group_department_academic_session_study_year_semes_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_group
    ADD CONSTRAINT academic_group_department_academic_session_study_year_semes_key UNIQUE (department, academic_session, study_year, semester, section);


--
-- Name: academic_group academic_group_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_group
    ADD CONSTRAINT academic_group_pkey PRIMARY KEY (id);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: account account_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_username_key UNIQUE (username);


--
-- Name: answer_key_correction answer_key_correction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_key_correction
    ADD CONSTRAINT answer_key_correction_pkey PRIMARY KEY (id);


--
-- Name: answer answer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer
    ADD CONSTRAINT answer_pkey PRIMARY KEY (attempt_id, "position");


--
-- Name: assignment assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment
    ADD CONSTRAINT assignment_pkey PRIMARY KEY (exam_id, student_id);


--
-- Name: attempt attempt_id_exam_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt
    ADD CONSTRAINT attempt_id_exam_id_key UNIQUE (id, exam_id);


--
-- Name: attempt attempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt
    ADD CONSTRAINT attempt_pkey PRIMARY KEY (id);


--
-- Name: audit audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit
    ADD CONSTRAINT audit_pkey PRIMARY KEY (id);


--
-- Name: bank bank_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank
    ADD CONSTRAINT bank_pkey PRIMARY KEY (id);


--
-- Name: bank_scope bank_scope_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_scope
    ADD CONSTRAINT bank_scope_pkey PRIMARY KEY (bank_id, group_id);


--
-- Name: subject chk_subject_dept_sem_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject
    ADD CONSTRAINT chk_subject_dept_sem_code UNIQUE (department_id, semester, code);


--
-- Name: computer_assignment computer_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.computer_assignment
    ADD CONSTRAINT computer_assignment_pkey PRIMARY KEY (id);


--
-- Name: computer_assignment computer_assignment_session_id_computer_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.computer_assignment
    ADD CONSTRAINT computer_assignment_session_id_computer_number_key UNIQUE (session_id, computer_number);


--
-- Name: course_outcome_review course_outcome_review_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_review
    ADD CONSTRAINT course_outcome_review_pkey PRIMARY KEY (id);


--
-- Name: course_outcome_revision course_outcome_revision_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_revision
    ADD CONSTRAINT course_outcome_revision_pkey PRIMARY KEY (id);


--
-- Name: course_outcome_revision course_outcome_revision_submission_id_revision_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_revision
    ADD CONSTRAINT course_outcome_revision_submission_id_revision_number_key UNIQUE (submission_id, revision_number);


--
-- Name: course_outcome_statement course_outcome_statement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_statement
    ADD CONSTRAINT course_outcome_statement_pkey PRIMARY KEY (id);


--
-- Name: course_outcome_statement course_outcome_statement_revision_id_co_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_statement
    ADD CONSTRAINT course_outcome_statement_revision_id_co_code_key UNIQUE (revision_id, co_code);


--
-- Name: course_outcome_submission course_outcome_submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_submission
    ADD CONSTRAINT course_outcome_submission_pkey PRIMARY KEY (id);


--
-- Name: course_outcome_submission course_outcome_submission_subject_id_academic_session_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_submission
    ADD CONSTRAINT course_outcome_submission_subject_id_academic_session_key UNIQUE (subject_id, academic_session);


--
-- Name: department department_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_code_key UNIQUE (code);


--
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (id);


--
-- Name: exam exam_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam
    ADD CONSTRAINT exam_pkey PRIMARY KEY (id);


--
-- Name: exam_question exam_question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_question
    ADD CONSTRAINT exam_question_pkey PRIMARY KEY (exam_id, "position");


--
-- Name: examination_cycle examination_cycle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_cycle
    ADD CONSTRAINT examination_cycle_pkey PRIMARY KEY (id);


--
-- Name: examination_session examination_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_session
    ADD CONSTRAINT examination_session_pkey PRIMARY KEY (id);


--
-- Name: examination_sitting examination_sitting_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_sitting
    ADD CONSTRAINT examination_sitting_pkey PRIMARY KEY (id);


--
-- Name: faculty_scope faculty_scope_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty_scope
    ADD CONSTRAINT faculty_scope_pkey PRIMARY KEY (faculty_id, group_id, subject_id);


--
-- Name: generated_paper generated_paper_bank_id_paper_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_paper
    ADD CONSTRAINT generated_paper_bank_id_paper_number_key UNIQUE (bank_id, paper_number);


--
-- Name: generated_paper generated_paper_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_paper
    ADD CONSTRAINT generated_paper_pkey PRIMARY KEY (id);


--
-- Name: generated_paper_question generated_paper_question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_paper_question
    ADD CONSTRAINT generated_paper_question_pkey PRIMARY KEY (paper_id, paper_position);


--
-- Name: hod_assignment_history hod_assignment_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hod_assignment_history
    ADD CONSTRAINT hod_assignment_history_pkey PRIMARY KEY (id);


--
-- Name: lab_package_acknowledgement lab_package_acknowledgement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_package_acknowledgement
    ADD CONSTRAINT lab_package_acknowledgement_pkey PRIMARY KEY (id);


--
-- Name: lab_result_import lab_result_import_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_import
    ADD CONSTRAINT lab_result_import_pkey PRIMARY KEY (id);


--
-- Name: lab_result_import lab_result_import_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_import
    ADD CONSTRAINT lab_result_import_session_id_key UNIQUE (session_id);


--
-- Name: laboratory laboratory_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.laboratory
    ADD CONSTRAINT laboratory_code_key UNIQUE (code);


--
-- Name: laboratory_history laboratory_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.laboratory_history
    ADD CONSTRAINT laboratory_history_pkey PRIMARY KEY (id);


--
-- Name: laboratory laboratory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.laboratory
    ADD CONSTRAINT laboratory_pkey PRIMARY KEY (id);


--
-- Name: paper_blueprint paper_blueprint_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paper_blueprint
    ADD CONSTRAINT paper_blueprint_pkey PRIMARY KEY (id);


--
-- Name: paper_blueprint paper_blueprint_subject_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paper_blueprint
    ADD CONSTRAINT paper_blueprint_subject_id_key UNIQUE (subject_id);


--
-- Name: paper_version paper_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paper_version
    ADD CONSTRAINT paper_version_pkey PRIMARY KEY (id);


--
-- Name: paper_version_question paper_version_question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paper_version_question
    ADD CONSTRAINT paper_version_question_pkey PRIMARY KEY (version_id, display_position);


--
-- Name: question_bank_item question_bank_item_bank_id_question_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank_item
    ADD CONSTRAINT question_bank_item_bank_id_question_uid_key UNIQUE (bank_id, question_uid);


--
-- Name: question_bank_item question_bank_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank_item
    ADD CONSTRAINT question_bank_item_pkey PRIMARY KEY (id);


--
-- Name: question_bank question_bank_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank
    ADD CONSTRAINT question_bank_pkey PRIMARY KEY (id);


--
-- Name: question question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question
    ADD CONSTRAINT question_pkey PRIMARY KEY (id);


--
-- Name: relogin_authorization relogin_authorization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relogin_authorization
    ADD CONSTRAINT relogin_authorization_pkey PRIMARY KEY (id);


--
-- Name: relogin_authorization relogin_authorization_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relogin_authorization
    ADD CONSTRAINT relogin_authorization_token_hash_key UNIQUE (token_hash);


--
-- Name: relogin_authorization relogin_authorization_token_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relogin_authorization
    ADD CONSTRAINT relogin_authorization_token_id_key UNIQUE (token_id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: secure_package secure_package_package_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secure_package
    ADD CONSTRAINT secure_package_package_uid_key UNIQUE (package_uid);


--
-- Name: secure_package secure_package_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secure_package
    ADD CONSTRAINT secure_package_pkey PRIMARY KEY (id);


--
-- Name: security_violation_log security_violation_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_violation_log
    ADD CONSTRAINT security_violation_log_pkey PRIMARY KEY (id);


--
-- Name: session_roster_snapshot session_roster_snapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_roster_snapshot
    ADD CONSTRAINT session_roster_snapshot_pkey PRIMARY KEY (session_id, student_id);


--
-- Name: session_token session_token_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_token
    ADD CONSTRAINT session_token_pkey PRIMARY KEY (token_hash);


--
-- Name: session_transfer_history session_transfer_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_transfer_history
    ADD CONSTRAINT session_transfer_history_pkey PRIMARY KEY (id);


--
-- Name: session_unlock_credential session_unlock_credential_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_unlock_credential
    ADD CONSTRAINT session_unlock_credential_pkey PRIMARY KEY (id);


--
-- Name: session_unlock_credential session_unlock_credential_session_id_sitting_name_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_unlock_credential
    ADD CONSTRAINT session_unlock_credential_session_id_sitting_name_revision_key UNIQUE (session_id, sitting_name, revision);


--
-- Name: sitting_examiner sitting_examiner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sitting_examiner
    ADD CONSTRAINT sitting_examiner_pkey PRIMARY KEY (id);


--
-- Name: sitting_examiner sitting_examiner_session_id_sitting_name_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sitting_examiner
    ADD CONSTRAINT sitting_examiner_session_id_sitting_name_employee_id_key UNIQUE (session_id, sitting_name, employee_id);


--
-- Name: student_list_history student_list_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_list_history
    ADD CONSTRAINT student_list_history_pkey PRIMARY KEY (id);


--
-- Name: student_roster_history student_roster_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_roster_history
    ADD CONSTRAINT student_roster_history_pkey PRIMARY KEY (id);


--
-- Name: student_roster student_roster_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_roster
    ADD CONSTRAINT student_roster_pkey PRIMARY KEY (id);


--
-- Name: student_roster student_roster_usn_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_roster
    ADD CONSTRAINT student_roster_usn_key UNIQUE (usn);


--
-- Name: student_session_result student_session_result_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_session_result
    ADD CONSTRAINT student_session_result_pkey PRIMARY KEY (id);


--
-- Name: student_session_result student_session_result_session_id_usn_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_session_result
    ADD CONSTRAINT student_session_result_session_id_usn_key UNIQUE (session_id, usn);


--
-- Name: subject subject_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject
    ADD CONSTRAINT subject_pkey PRIMARY KEY (id);


--
-- Name: lab_package_acknowledgement uq_lab_package_ack; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_package_acknowledgement
    ADD CONSTRAINT uq_lab_package_ack UNIQUE (session_id, sitting_name, package_uid);


--
-- Name: paper_version uq_paper_version_sitting; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paper_version
    ADD CONSTRAINT uq_paper_version_sitting UNIQUE (session_id, sitting_name, version_letter);


--
-- Name: secure_package uq_secure_package_session_sitting; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secure_package
    ADD CONSTRAINT uq_secure_package_session_sitting UNIQUE (session_id, sitting_name);


--
-- Name: examination_sitting uq_session_sitting; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_sitting
    ADD CONSTRAINT uq_session_sitting UNIQUE (session_id, sitting_name);


--
-- Name: attempt_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attempt_due ON public.attempt USING btree (deadline) WHERE (submitted IS NULL);


--
-- Name: idx_academic_group_dept_sem_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_academic_group_dept_sem_status ON public.academic_group USING btree (department_id, semester, status);


--
-- Name: idx_account_dept_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_dept_role ON public.account USING btree (department_id, role);


--
-- Name: idx_co_submission_dept_sem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_co_submission_dept_sem ON public.course_outcome_submission USING btree (department_id, semester);


--
-- Name: idx_exam_session_dept_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_session_dept_status ON public.examination_session USING btree (department_id, status);


--
-- Name: idx_exam_session_sched; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_session_sched ON public.examination_session USING btree (session_date, sitting, assigned_lab);


--
-- Name: idx_exam_sitting_sched; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_sitting_sched ON public.examination_sitting USING btree (exam_date, sitting_name, assigned_lab);


--
-- Name: idx_exam_sitting_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exam_sitting_session ON public.examination_sitting USING btree (session_id);


--
-- Name: idx_hod_assignment_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hod_assignment_account ON public.hod_assignment_history USING btree (account_id);


--
-- Name: idx_hod_assignment_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_hod_assignment_dept ON public.hod_assignment_history USING btree (department_id);


--
-- Name: idx_key_corr_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_key_corr_session ON public.answer_key_correction USING btree (session_id, status);


--
-- Name: idx_lab_pkg_ack_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lab_pkg_ack_session ON public.lab_package_acknowledgement USING btree (session_id, sitting_name);


--
-- Name: idx_lri_status_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lri_status_session ON public.lab_result_import USING btree (status, session_id);


--
-- Name: idx_paper_blueprint_subject_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_paper_blueprint_subject_id ON public.paper_blueprint USING btree (subject_id);


--
-- Name: idx_qb_item_bank_mod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qb_item_bank_mod ON public.question_bank_item USING btree (bank_id, module_number);


--
-- Name: idx_question_bank_item_bank_mod_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_question_bank_item_bank_mod_status ON public.question_bank_item USING btree (bank_id, module_number, status);


--
-- Name: idx_relogin_auth_session_usn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_relogin_auth_session_usn ON public.relogin_authorization USING btree (session_id, student_usn, status);


--
-- Name: idx_sec_violation_session_usn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sec_violation_session_usn ON public.security_violation_log USING btree (session_id, student_usn);


--
-- Name: idx_session_roster_snap_sitting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_roster_snap_sitting ON public.session_roster_snapshot USING btree (session_id, sitting_name);


--
-- Name: idx_session_transfer_session_usn; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_transfer_session_usn ON public.session_transfer_history USING btree (session_id, student_usn);


--
-- Name: idx_sitting_examiner_sess; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sitting_examiner_sess ON public.sitting_examiner USING btree (session_id, sitting_name);


--
-- Name: idx_ssr_session_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ssr_session_status ON public.student_session_result USING btree (session_id, submission_status, passed);


--
-- Name: idx_student_list_history_group; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_list_history_group ON public.student_list_history USING btree (group_id, created_at DESC);


--
-- Name: idx_student_roster_dept_sem; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_roster_dept_sem ON public.student_roster USING btree (department_id, semester, section);


--
-- Name: idx_student_roster_dept_sem_sec_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_roster_dept_sem_sec_status ON public.student_roster USING btree (department_id, semester, section, status);


--
-- Name: idx_student_roster_history_hist; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_roster_history_hist ON public.student_roster_history USING btree (history_id);


--
-- Name: idx_unlock_cred_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_unlock_cred_session ON public.session_unlock_credential USING btree (session_id, status);


--
-- Name: one_active_attempt; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_active_attempt ON public.attempt USING btree (exam_id, student_id) WHERE (submitted IS NULL);


--
-- Name: question_prompt_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX question_prompt_key ON public.question USING btree (bank_id, lower(btrim(prompt)));


--
-- Name: uq_active_unlock_credential; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_active_unlock_credential ON public.session_unlock_credential USING btree (session_id, sitting_name) WHERE (status = 'Active'::text);


--
-- Name: academic_group academic_group_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_group
    ADD CONSTRAINT academic_group_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: account account_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: account account_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.academic_group(id);


--
-- Name: answer answer_attempt_id_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer
    ADD CONSTRAINT answer_attempt_id_exam_id_fkey FOREIGN KEY (attempt_id, exam_id) REFERENCES public.attempt(id, exam_id);


--
-- Name: answer answer_exam_id_position_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer
    ADD CONSTRAINT answer_exam_id_position_fkey FOREIGN KEY (exam_id, "position") REFERENCES public.exam_question(exam_id, "position");


--
-- Name: answer_key_correction answer_key_correction_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_key_correction
    ADD CONSTRAINT answer_key_correction_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.account(id);


--
-- Name: answer_key_correction answer_key_correction_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_key_correction
    ADD CONSTRAINT answer_key_correction_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id) ON DELETE CASCADE;


--
-- Name: answer_key_correction answer_key_correction_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_key_correction
    ADD CONSTRAINT answer_key_correction_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subject(id);


--
-- Name: answer_key_correction answer_key_correction_submitted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.answer_key_correction
    ADD CONSTRAINT answer_key_correction_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES public.account(id);


--
-- Name: assignment assignment_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment
    ADD CONSTRAINT assignment_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exam(id);


--
-- Name: assignment assignment_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment
    ADD CONSTRAINT assignment_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.account(id);


--
-- Name: attempt attempt_exam_id_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attempt
    ADD CONSTRAINT attempt_exam_id_student_id_fkey FOREIGN KEY (exam_id, student_id) REFERENCES public.assignment(exam_id, student_id);


--
-- Name: audit audit_actor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit
    ADD CONSTRAINT audit_actor_fkey FOREIGN KEY (actor) REFERENCES public.account(id);


--
-- Name: bank bank_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank
    ADD CONSTRAINT bank_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.account(id);


--
-- Name: bank_scope bank_scope_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_scope
    ADD CONSTRAINT bank_scope_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.bank(id);


--
-- Name: bank_scope bank_scope_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_scope
    ADD CONSTRAINT bank_scope_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.academic_group(id);


--
-- Name: bank bank_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank
    ADD CONSTRAINT bank_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subject(id);


--
-- Name: computer_assignment computer_assignment_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.computer_assignment
    ADD CONSTRAINT computer_assignment_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id) ON DELETE CASCADE;


--
-- Name: course_outcome_review course_outcome_review_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_review
    ADD CONSTRAINT course_outcome_review_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.account(id);


--
-- Name: course_outcome_review course_outcome_review_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_review
    ADD CONSTRAINT course_outcome_review_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.course_outcome_submission(id) ON DELETE CASCADE;


--
-- Name: course_outcome_revision course_outcome_revision_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_revision
    ADD CONSTRAINT course_outcome_revision_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.course_outcome_submission(id) ON DELETE CASCADE;


--
-- Name: course_outcome_revision course_outcome_revision_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_revision
    ADD CONSTRAINT course_outcome_revision_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.account(id);


--
-- Name: course_outcome_statement course_outcome_statement_revision_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_statement
    ADD CONSTRAINT course_outcome_statement_revision_id_fkey FOREIGN KEY (revision_id) REFERENCES public.course_outcome_revision(id) ON DELETE CASCADE;


--
-- Name: course_outcome_submission course_outcome_submission_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_submission
    ADD CONSTRAINT course_outcome_submission_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.account(id);


--
-- Name: course_outcome_submission course_outcome_submission_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_submission
    ADD CONSTRAINT course_outcome_submission_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: course_outcome_submission course_outcome_submission_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_outcome_submission
    ADD CONSTRAINT course_outcome_submission_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subject(id) ON DELETE CASCADE;


--
-- Name: exam exam_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam
    ADD CONSTRAINT exam_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.bank(id);


--
-- Name: exam_question exam_question_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_question
    ADD CONSTRAINT exam_question_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exam(id);


--
-- Name: examination_cycle examination_cycle_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_cycle
    ADD CONSTRAINT examination_cycle_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.account(id);


--
-- Name: examination_session examination_session_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_session
    ADD CONSTRAINT examination_session_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.account(id);


--
-- Name: examination_session examination_session_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_session
    ADD CONSTRAINT examination_session_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.examination_cycle(id);


--
-- Name: examination_session examination_session_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_session
    ADD CONSTRAINT examination_session_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: examination_session examination_session_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_session
    ADD CONSTRAINT examination_session_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.academic_group(id);


--
-- Name: examination_session examination_session_selected_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_session
    ADD CONSTRAINT examination_session_selected_paper_id_fkey FOREIGN KEY (selected_paper_id) REFERENCES public.generated_paper(id);


--
-- Name: examination_session examination_session_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_session
    ADD CONSTRAINT examination_session_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subject(id);


--
-- Name: examination_sitting examination_sitting_selected_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_sitting
    ADD CONSTRAINT examination_sitting_selected_paper_id_fkey FOREIGN KEY (selected_paper_id) REFERENCES public.generated_paper(id);


--
-- Name: examination_sitting examination_sitting_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examination_sitting
    ADD CONSTRAINT examination_sitting_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id) ON DELETE CASCADE;


--
-- Name: faculty_scope faculty_scope_faculty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty_scope
    ADD CONSTRAINT faculty_scope_faculty_id_fkey FOREIGN KEY (faculty_id) REFERENCES public.account(id);


--
-- Name: faculty_scope faculty_scope_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty_scope
    ADD CONSTRAINT faculty_scope_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.academic_group(id);


--
-- Name: faculty_scope faculty_scope_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faculty_scope
    ADD CONSTRAINT faculty_scope_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subject(id);


--
-- Name: generated_paper generated_paper_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_paper
    ADD CONSTRAINT generated_paper_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.question_bank(id);


--
-- Name: generated_paper_question generated_paper_question_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_paper_question
    ADD CONSTRAINT generated_paper_question_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.generated_paper(id) ON DELETE CASCADE;


--
-- Name: generated_paper_question generated_paper_question_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.generated_paper_question
    ADD CONSTRAINT generated_paper_question_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_bank_item(id);


--
-- Name: hod_assignment_history hod_assignment_history_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hod_assignment_history
    ADD CONSTRAINT hod_assignment_history_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id);


--
-- Name: hod_assignment_history hod_assignment_history_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hod_assignment_history
    ADD CONSTRAINT hod_assignment_history_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.account(id);


--
-- Name: hod_assignment_history hod_assignment_history_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hod_assignment_history
    ADD CONSTRAINT hod_assignment_history_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: lab_package_acknowledgement lab_package_acknowledgement_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_package_acknowledgement
    ADD CONSTRAINT lab_package_acknowledgement_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id) ON DELETE CASCADE;


--
-- Name: lab_result_import lab_result_import_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_import
    ADD CONSTRAINT lab_result_import_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.account(id);


--
-- Name: lab_result_import lab_result_import_imported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_import
    ADD CONSTRAINT lab_result_import_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES public.account(id);


--
-- Name: lab_result_import lab_result_import_released_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_import
    ADD CONSTRAINT lab_result_import_released_by_fkey FOREIGN KEY (released_by) REFERENCES public.account(id);


--
-- Name: lab_result_import lab_result_import_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_result_import
    ADD CONSTRAINT lab_result_import_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id);


--
-- Name: laboratory_history laboratory_history_laboratory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.laboratory_history
    ADD CONSTRAINT laboratory_history_laboratory_id_fkey FOREIGN KEY (laboratory_id) REFERENCES public.laboratory(id) ON DELETE CASCADE;


--
-- Name: paper_blueprint paper_blueprint_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paper_blueprint
    ADD CONSTRAINT paper_blueprint_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subject(id) ON DELETE CASCADE;


--
-- Name: paper_blueprint paper_blueprint_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paper_blueprint
    ADD CONSTRAINT paper_blueprint_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.account(id);


--
-- Name: paper_version paper_version_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paper_version
    ADD CONSTRAINT paper_version_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.generated_paper(id);


--
-- Name: paper_version_question paper_version_question_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paper_version_question
    ADD CONSTRAINT paper_version_question_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.question_bank_item(id);


--
-- Name: paper_version_question paper_version_question_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paper_version_question
    ADD CONSTRAINT paper_version_question_version_id_fkey FOREIGN KEY (version_id) REFERENCES public.paper_version(id) ON DELETE CASCADE;


--
-- Name: paper_version paper_version_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.paper_version
    ADD CONSTRAINT paper_version_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id) ON DELETE CASCADE;


--
-- Name: question_bank question_bank_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank
    ADD CONSTRAINT question_bank_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.account(id);


--
-- Name: question_bank question_bank_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank
    ADD CONSTRAINT question_bank_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: question_bank question_bank_finalized_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank
    ADD CONSTRAINT question_bank_finalized_by_fkey FOREIGN KEY (finalized_by) REFERENCES public.account(id);


--
-- Name: question question_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question
    ADD CONSTRAINT question_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.bank(id);


--
-- Name: question_bank_item question_bank_item_bank_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank_item
    ADD CONSTRAINT question_bank_item_bank_id_fkey FOREIGN KEY (bank_id) REFERENCES public.question_bank(id) ON DELETE CASCADE;


--
-- Name: question_bank question_bank_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_bank
    ADD CONSTRAINT question_bank_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subject(id);


--
-- Name: relogin_authorization relogin_authorization_authorized_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relogin_authorization
    ADD CONSTRAINT relogin_authorization_authorized_by_fkey FOREIGN KEY (authorized_by) REFERENCES public.account(id);


--
-- Name: relogin_authorization relogin_authorization_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.relogin_authorization
    ADD CONSTRAINT relogin_authorization_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id) ON DELETE CASCADE;


--
-- Name: secure_package secure_package_exported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secure_package
    ADD CONSTRAINT secure_package_exported_by_fkey FOREIGN KEY (exported_by) REFERENCES public.account(id);


--
-- Name: secure_package secure_package_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.secure_package
    ADD CONSTRAINT secure_package_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id);


--
-- Name: security_violation_log security_violation_log_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_violation_log
    ADD CONSTRAINT security_violation_log_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id) ON DELETE CASCADE;


--
-- Name: session_roster_snapshot session_roster_snapshot_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_roster_snapshot
    ADD CONSTRAINT session_roster_snapshot_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id) ON DELETE CASCADE;


--
-- Name: session_roster_snapshot session_roster_snapshot_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_roster_snapshot
    ADD CONSTRAINT session_roster_snapshot_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.student_roster(id);


--
-- Name: session_token session_token_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_token
    ADD CONSTRAINT session_token_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: session_transfer_history session_transfer_history_authorization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_transfer_history
    ADD CONSTRAINT session_transfer_history_authorization_id_fkey FOREIGN KEY (authorization_id) REFERENCES public.relogin_authorization(id);


--
-- Name: session_transfer_history session_transfer_history_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_transfer_history
    ADD CONSTRAINT session_transfer_history_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id) ON DELETE CASCADE;


--
-- Name: session_transfer_history session_transfer_history_transferred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_transfer_history
    ADD CONSTRAINT session_transfer_history_transferred_by_fkey FOREIGN KEY (transferred_by) REFERENCES public.account(id);


--
-- Name: session_unlock_credential session_unlock_credential_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_unlock_credential
    ADD CONSTRAINT session_unlock_credential_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.account(id);


--
-- Name: session_unlock_credential session_unlock_credential_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_unlock_credential
    ADD CONSTRAINT session_unlock_credential_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id) ON DELETE CASCADE;


--
-- Name: sitting_examiner sitting_examiner_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sitting_examiner
    ADD CONSTRAINT sitting_examiner_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id) ON DELETE CASCADE;


--
-- Name: student_list_history student_list_history_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_list_history
    ADD CONSTRAINT student_list_history_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: student_list_history student_list_history_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_list_history
    ADD CONSTRAINT student_list_history_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.academic_group(id);


--
-- Name: student_list_history student_list_history_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_list_history
    ADD CONSTRAINT student_list_history_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.account(id);


--
-- Name: student_roster student_roster_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_roster
    ADD CONSTRAINT student_roster_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- Name: student_roster student_roster_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_roster
    ADD CONSTRAINT student_roster_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.academic_group(id);


--
-- Name: student_roster_history student_roster_history_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_roster_history
    ADD CONSTRAINT student_roster_history_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.academic_group(id);


--
-- Name: student_roster_history student_roster_history_history_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_roster_history
    ADD CONSTRAINT student_roster_history_history_id_fkey FOREIGN KEY (history_id) REFERENCES public.student_list_history(id) ON DELETE CASCADE;


--
-- Name: student_roster_history student_roster_history_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_roster_history
    ADD CONSTRAINT student_roster_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.student_roster(id);


--
-- Name: student_session_result student_session_result_import_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_session_result
    ADD CONSTRAINT student_session_result_import_id_fkey FOREIGN KEY (import_id) REFERENCES public.lab_result_import(id) ON DELETE CASCADE;


--
-- Name: student_session_result student_session_result_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_session_result
    ADD CONSTRAINT student_session_result_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.examination_session(id);


--
-- Name: subject subject_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subject
    ADD CONSTRAINT subject_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(id);


--
-- PostgreSQL database dump complete
--


