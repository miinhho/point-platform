-- 초대는 상태를 최소로 갖는다. 거절도 취소도 없고, 수락하면 행이 사라지고 회원이 된다
-- (docs/API.md 「회원 자격」).

-- (point_type_id, user_id) unique 가 「이미 초대된 사람을 다시 초대하면 같은 초대를 돌려준다」의
-- 방어선이다. 조회로는 동시에 온 둘이 모두 비어 있다고 본다.
create table invites (
    id              bigint      not null auto_increment,
    created_at      datetime(6) not null,
    idempotency_key varchar(36) not null,
    public_id       binary(16)  not null,
    by_id           bigint      not null,
    point_type_id   bigint      not null,
    user_id         bigint      not null,
    primary key (id),
    constraint uk_invites_public_id unique (public_id),
    constraint uk_invites_point_type_user unique (point_type_id, user_id),
    constraint uk_invites_by_key unique (by_id, idempotency_key),
    key ix_invites_user (user_id, created_at),
    constraint fk_invites_by foreign key (by_id) references users (id),
    constraint fk_invites_point_type foreign key (point_type_id) references point_types (id),
    constraint fk_invites_user foreign key (user_id) references users (id)
) engine = InnoDB;
