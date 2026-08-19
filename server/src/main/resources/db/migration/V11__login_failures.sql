-- 문구를 같게 두는 것은 존재를 감출 뿐 암호를 지키지 못한다. 방어는 시도 제한이 한다.

-- scope 는 「@handle」이거나 「ip:1.2.3.4」다. 둘을 한 표에 두는 이유는 세는 방식이 같아서고,
-- 나누는 이유는 대상이 달라서다 — 핸들만 세면 남의 계정을 일부러 잠글 수 있고,
-- IP 만 세면 분산 시도에 뚫린다.
create table login_failures (
    scope             varchar(120) not null,
    failures          int          not null,
    window_started_at datetime(6)  not null,
    primary key (scope)
) engine = InnoDB;
