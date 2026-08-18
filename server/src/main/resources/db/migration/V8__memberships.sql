-- 회원 자격은 비공개 은행에만 있다 (docs/API.md 「회원 자격」). 공개 은행에는 행이 생기지 않는다.

-- PK 가 (point_type_id, user_id) 라 "내가 속한 은행 전부" 가 leftmost prefix 를 타지 못한다.
create table memberships (
    point_type_id bigint      not null,
    user_id       bigint      not null,
    joined_at     datetime(6) not null,
    primary key (point_type_id, user_id),
    key ix_memberships_user (user_id),
    constraint fk_memberships_point_type foreign key (point_type_id) references point_types (id),
    constraint fk_memberships_user foreign key (user_id) references users (id)
) engine = InnoDB;

-- 은행장은 나갈 수도 내보내질 수도 없다 — 언제나 회원이므로 기존 비공개 은행에도 행이 있어야 한다.
insert into memberships (point_type_id, user_id, joined_at)
select id, issuer_id, now(6)
from point_types
where visibility = 'PRIVATE';
