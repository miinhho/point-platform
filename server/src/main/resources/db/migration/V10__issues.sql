-- 발행은 이체가 아니다 (docs/API.md 「발행은 이체가 아니다」). 중심 필드인 to_id 가
-- 절반에서 비는 타입은 두 타입이고, 빈 칸은 뜻 없는 말로 채워진다.

create table issues (
    id                 bigint      not null auto_increment,
    amount             bigint      not null,
    confirmed_at       datetime(6) not null,
    idempotency_key    varchar(36) not null,
    issue_cap_at       bigint      not null,
    public_id          binary(16)  not null,
    total_issued_after bigint      not null,
    issuer_id          bigint      not null,
    point_type_id      bigint      not null,
    primary key (id),
    constraint uk_issues_public_id unique (public_id),
    constraint uk_issues_issuer_key unique (issuer_id, idempotency_key),
    key ix_issues_issuer (issuer_id, confirmed_at),
    key ix_issues_point_type (point_type_id, confirmed_at),
    constraint fk_issues_issuer foreign key (issuer_id) references users (id),
    constraint fk_issues_point_type foreign key (point_type_id) references point_types (id)
) engine = InnoDB;

-- 일어난 일은 일어난 때의 값을 갖는다. 지금 값에서 거꾸로 계산할 수 없으므로 옮기면서 복원한다.
-- 유통량은 시간순 누적이고, 그때의 상한은 그 시각 직전 상한 변경에서 읽는다 —
-- 변경이 없었으면 첫 변경의 previous_cap 이, 그것도 없으면 지금 상한이 그때 값이다.
insert into issues (public_id, idempotency_key, issuer_id, point_type_id, amount,
                    total_issued_after, issue_cap_at, confirmed_at)
select t.public_id,
       t.idempotency_key,
       t.to_id,
       t.point_type_id,
       t.amount,
       sum(t.amount) over (partition by t.point_type_id order by t.created_at, t.id),
       coalesce(
           (select c.issue_cap from cap_changes c
             where c.point_type_id = t.point_type_id and c.changed_at <= t.created_at
             order by c.changed_at desc, c.id desc limit 1),
           (select c.previous_cap from cap_changes c
             where c.point_type_id = t.point_type_id
             order by c.changed_at asc, c.id asc limit 1),
           p.issue_cap
       ),
       t.confirmed_at
from transfers t
         join point_types p on p.id = t.point_type_id
where t.kind = 'ISSUE';

delete from transfers where kind = 'ISSUE';

-- 이체에는 보낸 사람이 반드시 있다. 그리고 임자는 언제나 보낸 사람이라 따로 둘 이유가 없다.
alter table transfers drop foreign key fk_transfers_requester;
alter table transfers drop index uk_transfers_requester_key;
alter table transfers drop column requester_id;
alter table transfers modify column from_id bigint not null;
alter table transfers add constraint uk_transfers_from_key unique (from_id, idempotency_key);
alter table transfers drop column kind;
