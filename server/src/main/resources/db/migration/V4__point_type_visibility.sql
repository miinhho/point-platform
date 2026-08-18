-- 은행 하나가 포인트 하나다. 공개는 누구나 들어오고, 비공개는 초대받아 들어온다
-- (docs/JOURNEY.md). 지금 동작 — 누구나 받을 수 있다 — 이 곧 공개이므로 기존 행은 PUBLIC 이다.
alter table point_types
    add column visibility enum ('PUBLIC','PRIVATE') not null default 'PUBLIC';
