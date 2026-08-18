-- 상한 변경은 되돌릴 수 없고 이력에 남는다. 그 포인트를 가진 사람이 볼 수 있어야 하므로
-- 발행자만 아는 값이 아니라 별도 테이블이다 (docs/JOURNEY.md 여정 8).
create table cap_changes (
    id              bigint      not null auto_increment,
    changed_at      datetime(6) not null,
    idempotency_key varchar(36) not null,
    issue_cap       bigint      not null,
    previous_cap    bigint      not null,
    public_id       binary(16)  not null,
    by_id           bigint      not null,
    point_type_id   bigint      not null,
    primary key (id),
    constraint uk_cap_changes_idempotency_key unique (idempotency_key),
    constraint uk_cap_changes_public_id unique (public_id),
    key ix_cap_changes_point_type (point_type_id, changed_at),
    constraint fk_cap_changes_by foreign key (by_id) references users (id),
    constraint fk_cap_changes_point_type foreign key (point_type_id) references point_types (id)
) engine = InnoDB;
