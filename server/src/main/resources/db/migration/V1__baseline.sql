-- 기준점. 인증·지갑·이체·발행·포인트 창설까지의 스키마다.
-- 이후 변경은 전부 새 마이그레이션으로 남는다 — 한 번 나간 것은 고치지 않고 그 위에 쌓는다.

create table users (
    id            bigint       not null auto_increment,
    handle        varchar(50)  not null,
    name          varchar(50)  not null,
    password_hash varchar(100) not null,
    public_id     binary(16)   not null,
    primary key (id),
    constraint uk_users_handle unique (handle),
    constraint uk_users_public_id unique (public_id)
) engine = InnoDB;

create table point_types (
    id              bigint      not null auto_increment,
    accent          enum ('BLUE','GREEN','ORANGE','PINK','PURPLE','TEAL') not null,
    idempotency_key varchar(36) null,
    issue_cap       bigint      not null,
    name            varchar(50) not null,
    public_id       binary(16)  not null,
    symbol          varchar(10) not null,
    total_issued    bigint      not null,
    issuer_id       bigint      not null,
    primary key (id),
    constraint uk_point_types_public_id unique (public_id),
    constraint uk_point_types_symbol unique (symbol),
    constraint uk_point_types_idempotency_key unique (idempotency_key),
    constraint fk_point_types_issuer foreign key (issuer_id) references users (id)
) engine = InnoDB;

-- PK 가 (point_type_id, user_id) 순이라 "이 사용자의 잔액 전부" 가 leftmost prefix 를
-- 타지 못한다. user_id 단독 인덱스를 따로 둔다.
create table balances (
    amount        bigint not null,
    point_type_id bigint not null,
    user_id       bigint not null,
    primary key (point_type_id, user_id),
    key ix_balances_user (user_id),
    constraint fk_balances_point_type foreign key (point_type_id) references point_types (id),
    constraint fk_balances_user foreign key (user_id) references users (id)
) engine = InnoDB;

-- status 컬럼이 없다. 저장된 이체는 언제나 확정된 것이다 (docs/JOURNEY.md 「버린 것」).
create table transfers (
    id              bigint      not null auto_increment,
    amount          bigint      not null,
    confirmed_at    datetime(6) not null,
    created_at      datetime(6) not null,
    idempotency_key varchar(36) not null,
    kind            enum ('ISSUE','TRANSFER') not null,
    public_id       binary(16)  not null,
    from_id         bigint      null,
    point_type_id   bigint      not null,
    to_id           bigint      not null,
    primary key (id),
    constraint uk_transfers_idempotency_key unique (idempotency_key),
    constraint uk_transfers_public_id unique (public_id),
    key ix_transfers_from (from_id, created_at),
    key ix_transfers_to (to_id, created_at),
    constraint fk_transfers_from foreign key (from_id) references users (id),
    constraint fk_transfers_point_type foreign key (point_type_id) references point_types (id),
    constraint fk_transfers_to foreign key (to_id) references users (id)
) engine = InnoDB;

create table refresh_tokens (
    id               bigint      not null auto_increment,
    created_at       datetime(6) not null,
    expires_at       datetime(6) not null,
    family_id        binary(16)  not null,
    replaced_by_hash varchar(64) null,
    revoked_at       datetime(6) null,
    token_hash       varchar(64) not null,
    user_id          bigint      not null,
    primary key (id),
    constraint uk_refresh_tokens_token_hash unique (token_hash),
    key ix_refresh_tokens_family_active (family_id, revoked_at),
    constraint fk_refresh_tokens_user foreign key (user_id) references users (id)
) engine = InnoDB;
