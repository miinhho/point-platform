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
    -- 겹치는 이름을 그 이름으로 묻는다. 없으면 응답마다 표를 통째로 훑는다.
    key ix_users_name (name),
    -- 부분 일치 검색. like '%q%' 는 어떤 인덱스도 못 타므로 사람이 늘수록 전체를 훑는다.
    -- ngram 파서라 한글도 두 글자씩 쪼갠다 — 그래서 한 글자 검색은 이 인덱스로 못 하고,
    -- 그 갈래만 훑는다 (UserRepository.matching).
    fulltext key ft_users_search (name, handle) with parser ngram,
    constraint uk_users_public_id unique (public_id)
) engine = InnoDB;

create table point_types (
    id              bigint      not null auto_increment,
    accent          enum ('BLUE','GREEN','ORANGE','PINK','PURPLE','TEAL') not null,
    idempotency_key varchar(36) null,
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
    key ix_point_types_name (name),
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
    -- 공급의 두 값이 한 행에 있다. 발행도 상한 변경도 이 행을 잠그므로, 잠금 한 번이
    -- 발행량과 상한을 함께 현재 값으로 준다 (docs/LEDGER.md).
    issue_cap     bigint null,
    -- NULL 끼리는 unique 에서 안 부딪히므로 그대로 두면 한 포인트에 발행 계정이 둘 생긴다.
    -- 0 으로 접어서 막는다. users.id 가 AUTO_INCREMENT 라 0 을 넣어도 저장되지 않고
    -- 다음 번호가 들어가므로 보유자와 겹치지 않는다 (sql_mode 에 NO_AUTO_VALUE_ON_ZERO 가 없어야 한다).
    holder_key    bigint generated always as (coalesce(user_id, 0)) stored,
    primary key (id),
    constraint uk_accounts_point_type_holder unique (point_type_id, holder_key),
    -- kind 와 user_id 가 같은 사실을 두 번 말한다. 어긋난 행을 막지 않으면
    -- (user_id null, HOLDER) 가 holder_key 0 을 먹고 진짜 발행 계정을 밀어낸다.
    constraint ck_accounts_issuance_has_no_holder check ((user_id is null) = (kind = 'ISSUANCE')),
    -- 상한은 공급의 성질이라 보유자 계정에는 없다. 어긋나면 상한 없는 발행 계정이 생긴다.
    constraint ck_accounts_cap_only_on_issuance check ((issue_cap is null) = (kind = 'HOLDER')),
    -- 부호는 계정 유형이 정한다. 보유자 잔액은 은행이 진 빚이라 음수가 될 수 없고,
    -- 발행 계정은 그 빚의 반대편이라 음수가 정상이다 (docs/LEDGER.md).
    constraint ck_accounts_holder_not_negative check (kind = 'ISSUANCE' or balance >= 0),
    constraint ck_accounts_issuance_not_positive check (kind = 'HOLDER' or balance <= 0),
    key ix_accounts_user (user_id),
    -- postings 의 복합 FK 가 참조한다. id 가 PK 라 이미 유일하지만, MySQL 은 FK 의 부모
    -- 쪽에 unique 를 요구한다 — 인덱스만으로는 제약 생성이 거절된다. PK 를 한 벌 더
    -- 저장하는 값을 내고 전기가 사건의 포인트를 넘지 못하는 것을 산다.
    constraint uk_accounts_id_point_type unique (id, point_type_id),
    constraint fk_accounts_point_type foreign key (point_type_id) references point_types (id),
    constraint fk_accounts_user foreign key (user_id) references users (id)
) engine = InnoDB;

-- 사건을 시간순으로 적은 원본. 추가만 된다 — 정정도 새 분개다 (docs/LEDGER.md).
create table journal_entries (
    id              bigint      not null auto_increment,
    public_id       binary(16)  not null,
    -- 전기 모양에서 유추하지 않는다. 유추하면 내역을 그리는 쪽이 원장 규칙을 알아야 한다.
    kind            enum ('ISSUE','TRANSFER','CAP_CHANGE','PURCHASE') not null,
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
    -- 「내가 보낸 것」·「내가 발행한 것」이 부속 기록이 아니라 사건에서 답해진다.
    key ix_journal_entries_requester (requester_id, occurred_at),
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
-- 바깥 id 도 없다. 사건과 1:1 이라 사건의 public_id 가 곧 이 이체의 id 다.
create table transfers (
    id               bigint     not null auto_increment,
    -- 사건이 아는 것을 다시 갖지 않는다 — 포인트도 보낸 사람도 시각도 키도 사건의 것이다.
    journal_entry_id bigint     not null,
    -- 받는 사람만 사건이 모른다. 사건의 요청자가 보낸 사람이다.
    to_id            bigint     not null,
    amount           bigint     not null,
    primary key (id),
    constraint uk_transfers_journal_entry unique (journal_entry_id),
    constraint fk_transfers_journal_entry foreign key (journal_entry_id) references journal_entries (id),
    key ix_transfers_to (to_id),
    constraint fk_transfers_to foreign key (to_id) references users (id)
) engine = InnoDB;

-- 발행은 이체가 아니다. 대상이 없고, 잔액이 아니라 상한을 본다 (docs/API.md).
create table issues (
    id                 bigint     not null auto_increment,
    journal_entry_id   bigint     not null,
    amount             bigint     not null,
    -- 일어난 때의 값이다. 지금 값에서 거꾸로 계산할 수 없다.
    total_issued_after bigint     not null,
    issue_cap_at       bigint     not null,
    primary key (id),
    constraint uk_issues_journal_entry unique (journal_entry_id),
    constraint fk_issues_journal_entry foreign key (journal_entry_id) references journal_entries (id)
) engine = InnoDB;

-- 상한 변경은 그 포인트를 가진 사람이 본다 — 발행자만 아는 값이 아니라 별도 테이블이다.
create table cap_changes (
    id               bigint     not null auto_increment,
    journal_entry_id bigint     not null,
    previous_cap     bigint     not null,
    issue_cap        bigint     not null,
    primary key (id),
    constraint uk_cap_changes_journal_entry unique (journal_entry_id),
    constraint fk_cap_changes_journal_entry foreign key (journal_entry_id) references journal_entries (id)
) engine = InnoDB;

-- 상점. **품목 행이 그 품목의 뮤텍스다** — 구매·재고 수정·내리기 셋 다 이 행을 잠그고
-- 읽는다. 환불이 없으므로 여기가 마지막 방어선이다 (docs/API.md 「상점」).
create table listings (
    id               bigint       not null auto_increment,
    public_id        binary(16)   not null,
    point_type_id    bigint       not null,
    -- 이름과 값은 고치는 길이 없다. 바꾸면 이미 산 사람의 교환권이 가리키는 것이 바뀐다.
    name             varchar(80)  not null,
    description      varchar(255) null,
    price            bigint       not null,
    -- null 은 무제한이고, 기본값이 아니라 게시할 때 고른 것이다 (docs/JOURNEY.md 여정 12).
    stock            int          null,
    per_person_limit int          null,
    -- 판 수를 접어 두는 칸이 없다. 그 품목의 교환권을 센다 — 접어 둔 칸은 틀렸는지 알
    -- 방법이 없는데 그 위에 재고 판정이 선다 (docs/LEDGER.md 6 단계).
    -- 아무도 안 샀으면 행이 사라지고, 팔린 뒤에는 여기가 찍힌다.
    unlisted_at      datetime(6)  null,
    created_at       datetime(6)  not null,
    idempotency_key  varchar(36)  not null,
    primary key (id),
    constraint uk_listings_public_id unique (public_id),
    -- 요청자 열이 없다. 게시할 수 있는 사람은 그 은행의 은행장 하나뿐이라 은행이 곧 요청자다.
    constraint uk_listings_point_type_key unique (point_type_id, idempotency_key),
    constraint ck_listings_price_positive check (price > 0),
    constraint ck_listings_stock_positive check (stock is null or stock > 0),
    constraint ck_listings_limit_positive check (per_person_limit is null or per_person_limit > 0),
    key ix_listings_point_type (point_type_id, created_at),
    constraint fk_listings_point_type foreign key (point_type_id) references point_types (id)
) engine = InnoDB;

-- 구매는 원장에서 평범한 이체다 (산 사람 −N · 은행장 +N). 여기 남는 것은 사건이 모르는
-- 것 — 무엇을 몇 개 샀는가뿐이다. 산 사람도 시각도 포인트도 사건의 것이다.
create table purchases (
    id               bigint      not null auto_increment,
    journal_entry_id bigint      not null,
    listing_id       bigint      not null,
    -- 사건이 아는 것(요청자)을 다시 갖는 유일한 칸이다. 뮤텍스 안에서 「이 사람이 몇 개
    -- 샀는가」를 두 표만 보고 답하려고 둔다 — 사건까지 조인하면 그 잠금 읽기가 사건 표의
    -- 인덱스 범위를 잠그고, 그 사람의 다른 이체·발행이 그 자리에서 막힌다.
    -- 사건의 요청자와 같다는 것은 불변식이 본다 (Invariants).
    buyer_id         bigint      not null,
    -- 그때의 이름. 지금은 이름을 고치는 길이 없어 품목의 것과 늘 같지만, 이 줄이 품목보다
    -- 오래 살아야 하는 기록이라 스스로 들고 있는다 (docs/API.md 「상점」).
    listing_name     varchar(80) not null,
    quantity         int         not null,
    amount           bigint      not null,
    primary key (id),
    constraint uk_purchases_journal_entry unique (journal_entry_id),
    constraint ck_purchases_quantity_positive check (quantity > 0),
    -- 재고 판정과 1 인 한도 판정이 둘 다 이 인덱스로 그 품목의 교환권에 닿는다.
    key ix_purchases_listing_buyer (listing_id, buyer_id),
    constraint fk_purchases_journal_entry foreign key (journal_entry_id) references journal_entries (id),
    constraint fk_purchases_listing foreign key (listing_id) references listings (id),
    constraint fk_purchases_buyer foreign key (buyer_id) references users (id)
) engine = InnoDB;

-- 교환권은 원장 밖의 기록이고 **한 장이 한 개다** — 「세 잔짜리 한 장」은 없다.
-- 부분적으로 쓰인 상태를 만들지 않는다 (docs/JOURNEY.md 여정 13).
--
-- 가진 사람도 발행 시각도 품목도 여기 없다. 전부 구매와 그 사건이 아는 것이고, 「내
-- 교환권 최신순」은 ix_journal_entries_requester 로 사건에서부터 답해진다.
create table vouchers (
    id          bigint      not null auto_increment,
    public_id   binary(16)  not null,
    purchase_id bigint      not null,
    -- 두 번째 redeem 이 이 값을 덮지 않는다 — 덮으면 「커피를 건넨 때」가 거짓이 된다.
    redeemed_at datetime(6) null,
    primary key (id),
    constraint uk_vouchers_public_id unique (public_id),
    key ix_vouchers_purchase (purchase_id),
    constraint fk_vouchers_purchase foreign key (purchase_id) references purchases (id)
) engine = InnoDB;

-- 회원 자격은 비공개 은행에만 있다. 공개 은행에는 행이 생기지 않는다.
-- PK 가 (point_type_id, user_id) 라 "내가 속한 은행 전부" 가 leftmost prefix 를 못 탄다.
create table memberships (
    point_type_id bigint      not null,
    user_id       bigint      not null,
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
