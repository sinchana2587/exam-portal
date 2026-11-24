-- V9: COE Laboratory Management and Examiner Allocations

CREATE TABLE IF NOT EXISTS laboratory (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    building_location TEXT NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS laboratory_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    laboratory_id BIGINT REFERENCES laboratory(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    performed_by BIGINT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial labs
INSERT INTO laboratory (code, name, building_location, capacity, status)
VALUES
    ('LAB-CSE-01', 'Computer Science Lab 301', 'CS Block - 3rd Floor', 60, 'ACTIVE'),
    ('LAB-AI-01', 'AI & Machine Learning Lab 402', 'Tech Block - 4th Floor', 60, 'ACTIVE'),
    ('LAB-ISE-01', 'Information Science Lab 201', 'Admin Block - 2nd Floor', 60, 'ACTIVE'),
    ('DEMO-LAB-A', 'DEMO LAB A', 'Examination Wing - Lab A', 4, 'ACTIVE'),
    ('DEMO-LAB-B', 'DEMO LAB B', 'Examination Wing - Lab B', 8, 'ACTIVE')
ON CONFLICT (code) DO UPDATE SET
    capacity = excluded.capacity,
    name = excluded.name,
    building_location = excluded.building_location,
    status = excluded.status;

-- Sitting Examiner Assignment Table
CREATE TABLE IF NOT EXISTS sitting_examiner (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES examination_session(id) ON DELETE CASCADE,
    sitting_name TEXT NOT NULL CHECK (sitting_name IN ('MORNING', 'AFTERNOON')),
    examiner_name TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    designation TEXT NOT NULL,
    assigned_lab TEXT NOT NULL,
    contact_number TEXT,
    is_frozen BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, sitting_name, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_sitting_examiner_sess ON sitting_examiner(session_id, sitting_name);
