-- 멱등성 키가 답하는 질문은 「내가 같은 요청을 두 번 보냈나」다. 남의 키와 겹치는지는
-- 그 질문과 무관하다. 전역 unique 는 남이 내 키를 선점하게 하고, 선점당한 쪽은
-- 무한 재시도에 빠지며, 「그 키는 이미 쓰였다」가 남의 활동을 알려 주는 통로가 된다.

-- 요청자는 이체면 보낸 쪽, 발행이면 발행자다 — 발행에는 from 이 없으므로 별도 컬럼이다.
alter table transfers add column requester_id bigint null;
update transfers set requester_id = coalesce(from_id, to_id);
alter table transfers modify column requester_id bigint not null;
alter table transfers add constraint fk_transfers_requester foreign key (requester_id) references users (id);

alter table transfers drop index uk_transfers_idempotency_key;
alter table transfers add constraint uk_transfers_requester_key unique (requester_id, idempotency_key);

-- 창설의 요청자는 만든 사람이고, 그것이 곧 발행자다.
alter table point_types drop index uk_point_types_idempotency_key;
alter table point_types add constraint uk_point_types_issuer_key unique (issuer_id, idempotency_key);

-- 상한 변경의 요청자는 바꾼 사람이다.
alter table cap_changes drop index uk_cap_changes_idempotency_key;
alter table cap_changes add constraint uk_cap_changes_by_key unique (by_id, idempotency_key);
