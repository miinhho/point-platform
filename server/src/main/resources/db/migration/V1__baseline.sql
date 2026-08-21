-- 기준점. 배포 전이라 마이그레이션을 쌓지 않는다 — 스키마가 바뀌면 이 파일을 고치고
-- DB 를 다시 만든다. 그래서 여기 있는 것이 곧 지금 스키마다.

create table users (
    id            bigint       not null auto_increment,
    handle        varchar(50)  not null,
    name          varchar(50)  not null,
    password_hash varchar(100) not null,
    public_id     binary(16)   not null,
    primary key (id),
    -- 정규화된 형태에 건다. 조회만 정규화하면 @Minho 와 @minho 가 공존하고
    -- 어느 쪽이 로그인되는지가 행 순서에 달린다.
    constraint uk_users_handle unique (handle),
    constraint uk_users_public_id unique (public_id)
) engine = InnoDB;

create table point_types (
    id              bigint      not null auto_increment,
    accent          enum ('BLUE','GREEN','ORANGE','PINK','PURPLE','TEAL') not null,
    idempotency_key varchar(36) null,
    issue_cap       bigint      not null,
    name            varchar(50) not null,
    -- 결합 이모지(ZWJ·이형 선택자·피부색)는 코드포인트가 여럿이라 한 글자로 세지 않는다.
    emoji           varchar(32) not null,
    description     varchar(255) null,
    public_id       binary(16)  not null,
    created_at      datetime(6) not null,
    -- 기본값을 두지 않는다. 바꿀 수 없는 값이라 고른 적 없는 상태가 영구히 고정된다.
    visibility      enum ('PUBLIC','PRIVATE') not null,
    issuer_id       bigint      not null,
    primary key (id),
    constraint uk_point_types_public_id unique (public_id),
    constraint uk_point_types_issuer_key unique (issuer_id, idempotency_key),
    constraint fk_point_types_issuer foreign key (issuer_id) references users (id)
) engine = InnoDB;

-- 잔액은 전기의 합을 접어 둔 것이다. 판정에 쓸 수 있는 이유는 같은 트랜잭션에서 잠글 수
-- 있어서다 — 지연될 수 있는 사본은 못 쓴다 (docs/LEDGER.md).
create table accounts (
    id            bigint not null auto_increment,
    point_type_id bigint not null,
    -- 발행 계정에는 보유자가 없다.
    user_id       bigint null,
    kind          enum ('HOLDER','ISSUANCE') not null,
    balance       bigint not null,
    -- NULL 끼리는 unique 에서 안 부딪히므로 그대로 두면 한 포인트에 발행 계정이 둘 생긴다.
    -- 0 으로 접어서 막는다. users.id 가 AUTO_INCREMENT 라 0 을 넣어도 저장되지 않고
    -- 다음 번호가 들어가므로 보유자와 겹치지 않는다 (sql_mode 에 NO_AUTO_VALUE_ON_ZERO 가 없어야 한다).
    holder_key    bigint generated always as (coalesce(user_id, 0)) stored,
    primary key (id),
    constraint uk_accounts_point_type_holder unique (point_type_id, holder_key),
    -- kind 와 user_id 가 같은 사실을 두 번 말한다. 어긋난 행을 막지 않으면
    -- (user_id null, HOLDER) 가 holder_key 0 을 먹고 진짜 발행 계정을 밀어낸다.
    constraint ck_accounts_issuance_has_no_holder check ((user_id is null) = (kind = 'ISSUANCE')),
    -- 부호는 계정 유형이 정한다. 보유자 잔액은 은행이 진 빚이라 음수가 될 수 없고,
    -- 발행 계정은 그 빚의 반대편이라 음수가 정상이다 (docs/LEDGER.md).
    constraint ck_accounts_holder_not_negative check (kind = 'ISSUANCE' or balance >= 0),
    constraint ck_accounts_issuance_not_positive check (kind = 'HOLDER' or balance <= 0),
    key ix_accounts_user (user_id),
    -- postings 의 복합 FK 가 참조한다. id 가 PK 라 이미 유일하지만, MySQL 은 FK 의 부모
    -- 쪽에 unique 를 요구한다 — 인덱스만으로는 제약 생성이 거절된다.
    constraint uk_accounts_id_point_type unique (id, point_type_id),
    constraint fk_accounts_point_type foreign key (point_type_id) references point_types (id),
    constraint fk_accounts_user foreign key (user_id) references users (id)
) engine = InnoDB;

-- 사건을 시간순으로 적은 원본. 추가만 된다 — 정정도 새 분개다 (docs/LEDGER.md).
create table journal_entries (
    id              bigint      not null auto_increment,
    public_id       binary(16)  not null,
    -- 전기 모양에서 유추하지 않는다. 유추하면 내역을 그리는 쪽이 원장 규칙을 알아야 한다.
    kind            enum ('ISSUE','TRANSFER','CAP_CHANGE') not null,
    requester_id    bigint      not null,
    idempotency_key varchar(36) not null,
    point_type_id   bigint      not null,
    occurred_at     datetime(6) not null,
    primary key (id),
    constraint uk_journal_entries_public_id unique (public_id),
    -- 사건의 멱등성 키가 여기 하나로 모인다. 키는 「내가 같은 요청을 두 번 보냈나」에
    -- 답하므로 요청자와 함께 건다 — 전역 unique 는 남이 내 키를 선점하게 한다.
    constraint uk_journal_entries_requester_key unique (requester_id, idempotency_key),
    key ix_journal_entries_point_type (point_type_id, occurred_at),
    constraint uk_journal_entries_id_point_type unique (id, point_type_id),
    constraint fk_journal_entries_requester foreign key (requester_id) references users (id),
    constraint fk_journal_entries_point_type foreign key (point_type_id) references point_types (id)
) engine = InnoDB;

-- 사건을 계정에 옮겨 적은 것. 사건당 둘 이상이고 합이 0 이다.
create table postings (
    id               bigint not null auto_increment,
    journal_entry_id bigint not null,
    account_id       bigint not null,
    -- 사건과 계정이 각각 갖는 포인트를 여기 내려 적는다. 아래 복합 FK 둘이 이 한 값을
    -- 양쪽에 묶으므로, 전기가 사건의 포인트를 넘는 것을 트리거 없이 DB 가 막는다.
    point_type_id    bigint not null,
    -- 차변·대변 칸을 나누지 않고 부호 하나로 적는다 (docs/LEDGER.md).
    amount           bigint not null,
    primary key (id),
    -- 한 사건이 같은 계정을 두 번 건드리면 합이 맞아도 그 계정의 재계산과 내역 표시가 갈린다.
    constraint uk_postings_entry_account unique (journal_entry_id, account_id),
    -- 0 원 전기는 사건에 참여하지 않은 계정을 참여한 것처럼 보이게 한다.
    constraint ck_postings_amount_not_zero check (amount <> 0),
    key ix_postings_account (account_id, point_type_id),
    constraint fk_postings_entry foreign key (journal_entry_id, point_type_id)
        references journal_entries (id, point_type_id),
    constraint fk_postings_account foreign key (account_id, point_type_id)
        references accounts (id, point_type_id)
) engine = InnoDB;

-- status 컬럼이 없다. 저장된 이체는 언제나 확정된 것이다 (docs/JOURNEY.md 「버린 것」).
create table transfers (
    id              bigint      not null auto_increment,
    amount          bigint      not null,
    confirmed_at    datetime(6) not null,
    created_at      datetime(6) not null,
    journal_entry_id   bigint      not null,
    public_id       binary(16)  not null,
    from_id         bigint      not null,
    point_type_id   bigint      not null,
    to_id           bigint      not null,
    primary key (id),
    constraint uk_transfers_public_id unique (public_id),
    -- 키는 「내가 같은 요청을 두 번 보냈나」에 답한다. 전역 unique 로 두면 남이 내 키를
    -- 선점하고, 선점당한 쪽은 재조회가 비어서 끝없이 재시도한다.
    constraint uk_transfers_journal_entry unique (journal_entry_id),
    constraint fk_transfers_journal_entry foreign key (journal_entry_id) references journal_entries (id),
    -- point_type_id 를 인덱스 중간에 두면 조건 없는 조회의 정렬이 filesort 로 떨어진다.
    key ix_transfers_from (from_id, created_at),
    key ix_transfers_to (to_id, created_at),
    constraint fk_transfers_from foreign key (from_id) references users (id),
    constraint fk_transfers_point_type foreign key (point_type_id) references point_types (id),
    constraint fk_transfers_to foreign key (to_id) references users (id)
) engine = InnoDB;

-- 발행은 이체가 아니다. 대상이 없고, 잔액이 아니라 상한을 본다 (docs/API.md).
create table issues (
    id                 bigint      not null auto_increment,
    amount             bigint      not null,
    confirmed_at       datetime(6) not null,
    journal_entry_id   bigint      not null,
    -- 일어난 때의 값이다. 지금 값에서 거꾸로 계산할 수 없다.
    issue_cap_at       bigint      not null,
    total_issued_after bigint      not null,
    public_id          binary(16)  not null,
    issuer_id          bigint      not null,
    point_type_id      bigint      not null,
    primary key (id),
    constraint uk_issues_public_id unique (public_id),
    constraint uk_issues_journal_entry unique (journal_entry_id),
    constraint fk_issues_journal_entry foreign key (journal_entry_id) references journal_entries (id),
    key ix_issues_issuer (issuer_id, confirmed_at),
    key ix_issues_point_type (point_type_id, confirmed_at),
    constraint fk_issues_issuer foreign key (issuer_id) references users (id),
    constraint fk_issues_point_type foreign key (point_type_id) references point_types (id)
) engine = InnoDB;

-- 상한 변경은 그 포인트를 가진 사람이 본다 — 발행자만 아는 값이 아니라 별도 테이블이다.
create table cap_changes (
    id              bigint      not null auto_increment,
    changed_at      datetime(6) not null,
    journal_entry_id   bigint      not null,
    issue_cap       bigint      not null,
    previous_cap    bigint      not null,
    public_id       binary(16)  not null,
    by_id           bigint      not null,
    point_type_id   bigint      not null,
    primary key (id),
    constraint uk_cap_changes_public_id unique (public_id),
    constraint uk_cap_changes_journal_entry unique (journal_entry_id),
    constraint fk_cap_changes_journal_entry foreign key (journal_entry_id) references journal_entries (id),
    key ix_cap_changes_point_type (point_type_id, changed_at),
    constraint fk_cap_changes_by foreign key (by_id) references users (id),
    constraint fk_cap_changes_point_type foreign key (point_type_id) references point_types (id)
) engine = InnoDB;

-- 회원 자격은 비공개 은행에만 있다. 공개 은행에는 행이 생기지 않는다.
-- PK 가 (point_type_id, user_id) 라 "내가 속한 은행 전부" 가 leftmost prefix 를 못 탄다.
create table memberships (
    point_type_id bigint      not null,
    user_id       bigint      not null,
    joined_at     datetime(6) not null,
    primary key (point_type_id, user_id),
    key ix_memberships_user (user_id),
    constraint fk_memberships_point_type foreign key (point_type_id) references point_types (id),
    constraint fk_memberships_user foreign key (user_id) references users (id)
) engine = InnoDB;

create table invites (
    id              bigint      not null auto_increment,
    created_at      datetime(6) not null,
    -- 소진된 초대는 지우지 않는다. 지우면 다시 누른 사람에게 그 초대가 어떻게 됐는지
    -- 답할 수 없다 (docs/API.md 「회원 자격」).
    spent_at        datetime(6) null,
    idempotency_key varchar(36) not null,
    public_id       binary(16)  not null,
    by_id           bigint      not null,
    point_type_id   bigint      not null,
    user_id         bigint      not null,
    -- 살아 있는 동안만 값이 있다. MySQL 에 부분 인덱스가 없어서, 소진된 행이 재초대를
    -- 막지 않게 하려면 이 열에 unique 를 거는 수밖에 없다 — NULL 끼리는 부딪히지 않는다.
    live_user_id    bigint generated always as (if(spent_at is null, user_id, null)) stored,
    primary key (id),
    constraint uk_invites_public_id unique (public_id),
    -- 「이미 초대된 사람을 다시 초대하면 같은 초대를 돌려준다」의 방어선이다.
    -- 조회로는 동시에 온 둘이 모두 비어 있다고 본다.
    constraint uk_invites_point_type_live_user unique (point_type_id, live_user_id),
    constraint uk_invites_by_key unique (by_id, idempotency_key),
    key ix_invites_user (user_id, created_at),
    constraint fk_invites_by foreign key (by_id) references users (id),
    constraint fk_invites_point_type foreign key (point_type_id) references point_types (id),
    constraint fk_invites_user foreign key (user_id) references users (id)
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
