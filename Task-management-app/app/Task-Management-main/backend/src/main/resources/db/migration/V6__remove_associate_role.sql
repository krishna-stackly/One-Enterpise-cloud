-- Remove ASSOCIATE role: rehome tasks, delete associate-only users, drop hierarchy table.

-- Stamp done_by_name and move ownership to the Associate's POC (fallback: assigned_by).
UPDATE tasks t
INNER JOIN project_assignments pa
    ON pa.user_id = t.assigned_to
   AND pa.project_id = t.project_id
   AND pa.assignment_type = 'ASSOCIATE'
INNER JOIN users u ON u.id = t.assigned_to
SET
    t.done_by_name = COALESCE(NULLIF(TRIM(t.done_by_name), ''), CONCAT(u.first_name, ' ', u.last_name)),
    t.assigned_to = COALESCE(pa.poc_id, t.assigned_by);

-- If assigned_by pointed at an Associate, point it at the POC instead.
UPDATE tasks t
INNER JOIN project_assignments pa
    ON pa.user_id = t.assigned_by
   AND pa.project_id = t.project_id
   AND pa.assignment_type = 'ASSOCIATE'
SET t.assigned_by = COALESCE(pa.poc_id, t.assigned_by);

-- Associate-only users (had ASSOCIATE, no other assignment types).
CREATE TEMPORARY TABLE tmp_associate_only_users AS
SELECT u.id
FROM users u
WHERE EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.user_id = u.id AND pa.assignment_type = 'ASSOCIATE'
    )
  AND NOT EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.user_id = u.id AND pa.assignment_type <> 'ASSOCIATE'
    );

DELETE FROM poc_associates;

DELETE FROM project_assignments WHERE assignment_type = 'ASSOCIATE';

UPDATE project_assignments SET poc_id = NULL WHERE poc_id IS NOT NULL;

-- Clear FK references before deleting associate-only users.
UPDATE tasks SET assigned_to = NULL
WHERE assigned_to IN (SELECT id FROM tmp_associate_only_users);

DELETE tr FROM task_reviews tr
INNER JOIN tmp_associate_only_users t ON t.id = tr.reviewer_id;

DELETE tc FROM task_comments tc
INNER JOIN tmp_associate_only_users t ON t.id = tc.author_id;

DELETE ta FROM task_attachments ta
INNER JOIN tmp_associate_only_users t ON t.id = ta.uploaded_by;

DELETE tw FROM task_work_logs tw
INNER JOIN tmp_associate_only_users t ON t.id = tw.user_id;

DELETE n FROM notifications n
INNER JOIN tmp_associate_only_users t ON t.id = n.user_id;

DELETE al FROM activity_logs al
INNER JOIN tmp_associate_only_users t ON t.id = al.user_id;

DELETE rt FROM refresh_tokens rt
INNER JOIN tmp_associate_only_users t ON t.id = rt.user_id;

DELETE prt FROM password_reset_tokens prt
INNER JOIN tmp_associate_only_users t ON t.id = prt.user_id;

DELETE q FROM queries q
INNER JOIN tmp_associate_only_users t ON t.id = q.from_user_id OR t.id = q.to_user_id;

DELETE ur FROM user_roles ur
INNER JOIN tmp_associate_only_users t ON t.id = ur.user_id;

DELETE pm FROM project_members pm
INNER JOIN tmp_associate_only_users t ON t.id = pm.user_id;

DELETE tm FROM team_members tm
INNER JOIN tmp_associate_only_users t ON t.id = tm.user_id;

DELETE psm FROM project_scrum_masters psm
INNER JOIN tmp_associate_only_users t ON t.id = psm.user_id;

DELETE tmen FROM team_mentors tmen
INNER JOIN tmp_associate_only_users t ON t.id = tmen.user_id;

DELETE tp FROM team_pocs tp
INNER JOIN tmp_associate_only_users t ON t.id = tp.user_id;

-- Avoid assigned_by FK failure: remap any remaining assigned_by to a project SM if needed.
UPDATE tasks t
INNER JOIN tmp_associate_only_users a ON a.id = t.assigned_by
SET t.assigned_by = (
    SELECT pa.user_id FROM project_assignments pa
    WHERE pa.project_id = t.project_id AND pa.assignment_type = 'SCRUM_MASTER'
    LIMIT 1
);

DELETE u FROM users u
INNER JOIN tmp_associate_only_users t ON t.id = u.id;

DROP TEMPORARY TABLE IF EXISTS tmp_associate_only_users;

DROP TABLE IF EXISTS poc_associates;

-- Constrain remaining assignment types (MySQL 8.0.16+ CHECK).
ALTER TABLE project_assignments
    ADD CONSTRAINT chk_assignment_type
    CHECK (assignment_type IN ('SCRUM_MASTER', 'MENTOR', 'POC'));
