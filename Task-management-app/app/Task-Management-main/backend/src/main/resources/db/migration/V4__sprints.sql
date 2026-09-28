CREATE TABLE sprints (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    name VARCHAR(160) NOT NULL,
    goal VARCHAR(500) NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_sprint_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_sprint_team FOREIGN KEY (team_id) REFERENCES teams (id),
    CONSTRAINT fk_sprint_creator FOREIGN KEY (created_by) REFERENCES users (id)
);

ALTER TABLE tasks
    ADD COLUMN sprint_id BIGINT NULL,
    ADD CONSTRAINT fk_task_sprint FOREIGN KEY (sprint_id) REFERENCES sprints (id);
