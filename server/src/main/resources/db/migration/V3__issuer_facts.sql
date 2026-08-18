-- 발행자가 정할 수 없는 사실. 누구나 포인트를 만들 수 있게 된 순간 이름·기호·색이
-- 전부 사칭 도구가 됐고, 그래서 흉내낼 수 없는 것을 함께 실어 준다 (docs/API.md).
-- 기존 행에는 지금 시각을 넣는다 — 없는 값을 만들어 낼 방법이 없다.
alter table point_types
    add column created_at datetime(6) not null default current_timestamp(6);

-- 처음 받은 뒤 확인했는가. 기존 잔액은 확인 전으로 둔다.
alter table balances
    add column acknowledged bit(1) not null default b'0';
