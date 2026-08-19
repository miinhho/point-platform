-- 표식이 두 글자 약어에서 이모지로 바뀐다. 유일성은 함께 버린다 — 쓸 만한 이모지가
-- 몇백 개뿐이라 유일하게 두면 먼저 만든 사람이 차지하는 경주가 된다 (docs/API.md 창설 절).

-- 결합 이모지(ZWJ·이형 선택자·피부색)는 코드포인트가 여럿이라 한 글자로 세지 않는다.
alter table point_types
    add column emoji varchar(32) null after name;

-- 기존 행에 넣을 값이 없다. 창설에서 고르는 값이므로 컬럼 DEFAULT 로는 남기지 않는다.
update point_types set emoji = '🏦' where emoji is null;

alter table point_types
    modify column emoji varchar(32) not null;

alter table point_types drop index uk_point_types_symbol;
alter table point_types drop column symbol;

-- 소개는 약속이 아니다 — 발행자가 바꿀 수 있고 이력에 남지 않는다.
alter table point_types
    add column description varchar(255) null;
