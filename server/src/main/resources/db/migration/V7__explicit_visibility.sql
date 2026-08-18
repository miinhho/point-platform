-- 창설 본문이 visibility 를 명시적으로 받는다. 기본값이 남아 있으면 검증을 건너뛴
-- 삽입 경로가 조용히 공개로 만든다 — 만든 사람이 모르는 사이에 열리는 일이다.
alter table point_types
    alter column visibility drop default;
