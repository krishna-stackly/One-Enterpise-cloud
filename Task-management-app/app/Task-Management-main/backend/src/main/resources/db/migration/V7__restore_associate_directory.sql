-- Restore ASSOCIATE as a directory role. Associates have no app login.

ALTER TABLE project_assignments DROP CHECK chk_assignment_type;

ALTER TABLE project_assignments
    ADD CONSTRAINT chk_assignment_type
    CHECK (assignment_type IN ('SCRUM_MASTER', 'MENTOR', 'POC', 'ASSOCIATE'));
