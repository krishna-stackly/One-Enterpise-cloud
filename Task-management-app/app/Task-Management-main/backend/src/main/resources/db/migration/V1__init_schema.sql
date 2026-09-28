CREATE TABLE roles (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE permissions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL
);

CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles (id),
    CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions (id)
);

CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    title VARCHAR(120) NOT NULL,
    system_role VARCHAR(20) NOT NULL,
    avatar_hue INT NOT NULL DEFAULT 200,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles (id)
);

CREATE TABLE projects (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    status VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE project_members (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_project_member (project_id, user_id),
    CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_pm_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE teams (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_team_name (project_id, name),
    CONSTRAINT fk_team_project FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE TABLE team_members (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    team_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_team_member (team_id, user_id),
    CONSTRAINT fk_tm_team FOREIGN KEY (team_id) REFERENCES teams (id),
    CONSTRAINT fk_tm_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE project_assignments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    assignment_type VARCHAR(20) NOT NULL,
    team_id BIGINT NULL,
    poc_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pa_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_pa_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_pa_team FOREIGN KEY (team_id) REFERENCES teams (id),
    CONSTRAINT fk_pa_poc FOREIGN KEY (poc_id) REFERENCES users (id),
    INDEX idx_pa_user_project (user_id, project_id),
    INDEX idx_pa_type (assignment_type)
);

CREATE TABLE project_scrum_masters (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    UNIQUE KEY uk_psm (project_id, user_id),
    CONSTRAINT fk_psm_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_psm_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE team_mentors (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    team_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    UNIQUE KEY uk_team_mentor (team_id, user_id),
    CONSTRAINT fk_tmentor_team FOREIGN KEY (team_id) REFERENCES teams (id),
    CONSTRAINT fk_tmentor_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE team_pocs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    team_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    UNIQUE KEY uk_team_poc (team_id, user_id),
    CONSTRAINT fk_tpoc_team FOREIGN KEY (team_id) REFERENCES teams (id),
    CONSTRAINT fk_tpoc_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE poc_associates (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    poc_id BIGINT NOT NULL,
    associate_id BIGINT NOT NULL,
    UNIQUE KEY uk_poc_associate (project_id, poc_id, associate_id),
    CONSTRAINT fk_paassoc_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_paassoc_team FOREIGN KEY (team_id) REFERENCES teams (id),
    CONSTRAINT fk_paassoc_poc FOREIGN KEY (poc_id) REFERENCES users (id),
    CONSTRAINT fk_paassoc_assoc FOREIGN KEY (associate_id) REFERENCES users (id)
);

CREATE TABLE task_labels (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(40) NOT NULL UNIQUE,
    color VARCHAR(16) NOT NULL
);

CREATE TABLE tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    parent_task_id BIGINT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL,
    priority VARCHAR(10) NOT NULL,
    assigned_to BIGINT NULL,
    assigned_by BIGINT NOT NULL,
    due_date DATE NOT NULL,
    estimated_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
    actual_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
    progress_percent INT NOT NULL DEFAULT 0,
    blocked_reason VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_task_team FOREIGN KEY (team_id) REFERENCES teams (id),
    CONSTRAINT fk_task_parent FOREIGN KEY (parent_task_id) REFERENCES tasks (id),
    CONSTRAINT fk_task_assigned_to FOREIGN KEY (assigned_to) REFERENCES users (id),
    CONSTRAINT fk_task_assigned_by FOREIGN KEY (assigned_by) REFERENCES users (id),
    INDEX idx_task_project (project_id),
    INDEX idx_task_team (team_id),
    INDEX idx_task_parent (parent_task_id),
    INDEX idx_task_assigned_to (assigned_to),
    INDEX idx_task_assigned_by (assigned_by),
    INDEX idx_task_status (status),
    INDEX idx_task_priority (priority),
    INDEX idx_task_due_date (due_date)
);

CREATE TABLE task_label_mapping (
    task_id BIGINT NOT NULL,
    label_id BIGINT NOT NULL,
    PRIMARY KEY (task_id, label_id),
    CONSTRAINT fk_tlm_task FOREIGN KEY (task_id) REFERENCES tasks (id),
    CONSTRAINT fk_tlm_label FOREIGN KEY (label_id) REFERENCES task_labels (id)
);

CREATE TABLE task_comments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tc_task FOREIGN KEY (task_id) REFERENCES tasks (id),
    CONSTRAINT fk_tc_author FOREIGN KEY (author_id) REFERENCES users (id)
);

CREATE TABLE task_attachments (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(120) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    url VARCHAR(500) NOT NULL,
    uploaded_by BIGINT NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ta_task FOREIGN KEY (task_id) REFERENCES tasks (id),
    CONSTRAINT fk_ta_user FOREIGN KEY (uploaded_by) REFERENCES users (id)
);

CREATE TABLE task_reviews (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    reviewer_id BIGINT NOT NULL,
    decision VARCHAR(20) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tr_task FOREIGN KEY (task_id) REFERENCES tasks (id),
    CONSTRAINT fk_tr_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id)
);

CREATE TABLE task_work_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    task_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    work_date DATE NOT NULL,
    hours DECIMAL(6,2) NOT NULL,
    description VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wl_task FOREIGN KEY (task_id) REFERENCES tasks (id),
    CONSTRAINT fk_wl_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(160) NOT NULL,
    message VARCHAR(500) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_n_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_n_project FOREIGN KEY (project_id) REFERENCES projects (id),
    INDEX idx_n_user_read (user_id, is_read)
);

CREATE TABLE activity_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    message VARCHAR(500) NOT NULL,
    metadata_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT fk_al_project FOREIGN KEY (project_id) REFERENCES projects (id)
);

CREATE TABLE refresh_tokens (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE password_reset_tokens (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_prt_user FOREIGN KEY (user_id) REFERENCES users (id)
);
