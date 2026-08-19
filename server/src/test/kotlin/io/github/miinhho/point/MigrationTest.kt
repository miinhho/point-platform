package io.github.miinhho.point

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.junit.jupiter.api.Test
import org.testcontainers.containers.MySQLContainer
import org.testcontainers.utility.DockerImageName
import java.sql.Connection
import java.sql.DriverManager
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * 마이그레이션은 **행이 있는 DB** 에서도 적용돼야 한다.
 *
 * 빈 DB 로만 확인하면 「기존 행에 넣을 값이 없다」를 영영 못 본다. ddl-auto 로
 * created_at 을 더하다 개발 서버가 뜨지 않았던 것이 그 경우였고, 테스트는 매번
 * 새 컨테이너라 그것을 잡지 못했다.
 *
 * 공유 스키마를 흔들지 않으려고 이 테스트만 자기 컨테이너를 쓴다.
 */
class MigrationTest {
    @Test
    fun `V4 까지 적용한 뒤 행을 넣고 V5 를 올려도 깨지지 않는다`() {
        MySQLContainer(DockerImageName.parse("mysql:8.4")).use { db ->
            db.start()
            fun flywayTo(target: String?) = Flyway.configure()
                .dataSource(db.jdbcUrl, db.username, db.password)
                .locations("classpath:db/migration")
                .apply { target?.let { target(MigrationVersion.fromVersion(it)) } }
                .load()

            flywayTo("4").migrate()

            DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { c ->
                seed(c)
                // V10 이 requester_id 와 kind 를 없앤다 — 이 테스트가 보는 것은 거기까지다.
                flywayTo("9").migrate()

                // 발행의 임자는 받는 쪽(발행자), 이체의 임자는 보낸 쪽이다.
                c.createStatement().executeQuery(
                    "select kind, requester_id = to_id, requester_id = from_id from transfers order by idempotency_key",
                ).use { rs ->
                    assertTrue(rs.next()); assertEquals("ISSUE", rs.getString(1))
                    assertTrue(rs.getBoolean(2), "발행의 임자는 받는 쪽이어야 한다")
                    assertTrue(rs.next()); assertEquals("TRANSFER", rs.getString(1))
                    assertTrue(rs.getBoolean(3), "이체의 임자는 보낸 쪽이어야 한다")
                }

                // 남의 키는 허용되고 내 키 재사용만 막힌다.
                insertTransfer(c, key = "k2", requester = "b", from = "b", to = "a")
                val reused = runCatching { insertTransfer(c, key = "k2", requester = "a", from = "a", to = "b") }
                assertTrue(reused.isFailure, "같은 사람이 같은 키를 다시 쓰면 막혀야 한다")
            }
        }
    }

    @Test
    fun `V7 까지 적용한 뒤 비공개 은행을 넣고 V8 을 올리면 은행장이 회원이 된다`() {
        MySQLContainer(DockerImageName.parse("mysql:8.4")).use { db ->
            db.start()
            fun flywayTo(target: String?) = Flyway.configure()
                .dataSource(db.jdbcUrl, db.username, db.password)
                .locations("classpath:db/migration")
                .apply { target?.let { target(MigrationVersion.fromVersion(it)) } }
                .load()

            flywayTo("7").migrate()

            DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { c ->
                c.createStatement().use { s ->
                    s.execute(
                        """insert into users (handle, name, password_hash, public_id)
                           values ('@a','A','x',unhex(replace(uuid(),'-',''))), ('@b','B','x',unhex(replace(uuid(),'-','')))""",
                    )
                    s.execute(
                        """insert into point_types (name, symbol, issuer_id, accent, issue_cap, total_issued, public_id, created_at, visibility)
                           select '동아리비','CL', id, 'BLUE', 100, 0, unhex(replace(uuid(),'-','')), now(6), 'PRIVATE'
                           from users where handle='@a'""",
                    )
                    s.execute(
                        """insert into point_types (name, symbol, issuer_id, accent, issue_cap, total_issued, public_id, created_at, visibility)
                           select '온포인트','ON', id, 'BLUE', 100, 0, unhex(replace(uuid(),'-','')), now(6), 'PUBLIC'
                           from users where handle='@b'""",
                    )
                }
                flywayTo(null).migrate()

                // 은행장은 나갈 수도 내보내질 수도 없다 — 비공개 은행에는 반드시 그 행이 있어야 한다.
                c.createStatement().executeQuery(
                    """select p.visibility, count(m.user_id)
                       from point_types p left join memberships m on m.point_type_id = p.id and m.user_id = p.issuer_id
                       group by p.id, p.visibility order by p.id""",
                ).use { rs ->
                    assertTrue(rs.next()); assertEquals("PRIVATE", rs.getString(1))
                    assertEquals(1, rs.getInt(2), "비공개 은행의 은행장은 회원이어야 한다")
                    assertTrue(rs.next()); assertEquals("PUBLIC", rs.getString(1))
                    assertEquals(0, rs.getInt(2), "공개 은행에는 회원 행이 생기지 않는다")
                }
            }
        }
    }

    @Test
    fun `V9 까지 적용한 뒤 발행을 넣고 V10 을 올리면 그때의 유통량과 상한이 복원된다`() {
        MySQLContainer(DockerImageName.parse("mysql:8.4")).use { db ->
            db.start()
            fun flywayTo(target: String?) = Flyway.configure()
                .dataSource(db.jdbcUrl, db.username, db.password)
                .locations("classpath:db/migration")
                .apply { target?.let { target(MigrationVersion.fromVersion(it)) } }
                .load()

            flywayTo("9").migrate()

            DriverManager.getConnection(db.jdbcUrl, db.username, db.password).use { c ->
                c.createStatement().use { s ->
                    s.execute(
                        """insert into users (handle, name, password_hash, public_id)
                           values ('@a','A','x',unhex(replace(uuid(),'-',''))), ('@b','B','x',unhex(replace(uuid(),'-','')))""",
                    )
                    s.execute(
                        """insert into point_types (name, emoji, issuer_id, accent, issue_cap, total_issued, public_id, created_at, visibility)
                           select 'P','🔵', id, 'BLUE', 1000, 300, unhex(replace(uuid(),'-','')), '2026-01-01', 'PUBLIC'
                           from users where handle='@a'""",
                    )
                    // 상한이 500 에서 1000 으로 바뀐 사건이 발행 둘 사이에 있다.
                    s.execute(
                        """insert into cap_changes (idempotency_key, point_type_id, by_id, previous_cap, issue_cap, changed_at, public_id)
                           select 'c1', p.id, u.id, 500, 1000, '2026-01-03', unhex(replace(uuid(),'-',''))
                           from point_types p, users u where u.handle='@a'""",
                    )
                    issue(s, key = "i1", at = "2026-01-02", amount = 100)
                    issue(s, key = "i2", at = "2026-01-04", amount = 200)
                    s.execute(
                        """insert into transfers (amount, confirmed_at, created_at, idempotency_key, kind, public_id,
                                                  from_id, point_type_id, to_id, requester_id)
                           select 10, '2026-01-05', '2026-01-05', 't1', 'TRANSFER', unhex(replace(uuid(),'-','')),
                                  a.id, p.id, b.id, a.id
                           from users a, users b, point_types p where a.handle='@a' and b.handle='@b'""",
                    )
                }
                flywayTo(null).migrate()

                // 유통량은 시간순 누적이고, 상한은 그 시각에 유효했던 값이다.
                c.createStatement().executeQuery(
                    "select idempotency_key, amount, total_issued_after, issue_cap_at from issues order by confirmed_at",
                ).use { rs ->
                    assertTrue(rs.next()); assertEquals("i1", rs.getString(1))
                    assertEquals(100, rs.getLong(3), "첫 발행 직후 유통량")
                    assertEquals(500, rs.getLong(4), "상한이 바뀌기 전이었다")
                    assertTrue(rs.next()); assertEquals("i2", rs.getString(1))
                    assertEquals(300, rs.getLong(3), "누적이다")
                    assertEquals(1000, rs.getLong(4), "바뀐 뒤의 상한이다")
                }

                // 이체 테이블에는 발행이 남지 않고, 보낸 사람 없는 줄도 없다.
                c.createStatement().executeQuery("select count(*) from transfers").use { rs ->
                    assertTrue(rs.next()); assertEquals(1, rs.getInt(1))
                }
                c.createStatement().executeQuery(
                    "select count(*) from information_schema.columns where table_name='transfers' and column_name in ('kind','requester_id')",
                ).use { rs ->
                    assertTrue(rs.next()); assertEquals(0, rs.getInt(1), "kind 와 requester_id 는 사라진다")
                }
            }
        }
    }

    private fun issue(s: java.sql.Statement, key: String, at: String, amount: Long) = s.execute(
        """insert into transfers (amount, confirmed_at, created_at, idempotency_key, kind, public_id,
                                  from_id, point_type_id, to_id, requester_id)
           select $amount, '$at', '$at', '$key', 'ISSUE', unhex(replace(uuid(),'-','')),
                  null, p.id, u.id, u.id
           from users u, point_types p where u.handle='@a'""",
    )

    private fun seed(c: Connection) = c.createStatement().use { s ->
        s.execute(
            """insert into users (handle, name, password_hash, public_id)
               values ('@a','A','x',unhex(replace(uuid(),'-',''))), ('@b','B','x',unhex(replace(uuid(),'-','')))""",
        )
        s.execute(
            """insert into point_types (name, symbol, issuer_id, accent, issue_cap, total_issued, public_id, created_at, visibility)
               select 'P','PP', id, 'BLUE', 100, 0, unhex(replace(uuid(),'-','')), now(6), 'PUBLIC'
               from users where handle='@a'""",
        )
        // 발행은 from 이 없고 이체는 있다 — 임자를 채우는 방식이 다르다.
        s.execute(
            """insert into transfers (amount, confirmed_at, created_at, idempotency_key, kind, public_id, from_id, point_type_id, to_id)
               select 10, now(6), now(6), 'k1', 'ISSUE', unhex(replace(uuid(),'-','')), null, p.id, u.id
               from users u, point_types p where u.handle='@a'""",
        )
        s.execute(
            """insert into transfers (amount, confirmed_at, created_at, idempotency_key, kind, public_id, from_id, point_type_id, to_id)
               select 10, now(6), now(6), 'k2', 'TRANSFER', unhex(replace(uuid(),'-','')), a.id, p.id, b.id
               from users a, users b, point_types p where a.handle='@a' and b.handle='@b'""",
        )
    }

    private fun insertTransfer(c: Connection, key: String, requester: String, from: String, to: String) =
        c.createStatement().use {
            it.execute(
                """insert into transfers (amount, confirmed_at, created_at, idempotency_key, kind, public_id,
                                          from_id, point_type_id, to_id, requester_id)
                   select 10, now(6), now(6), '$key', 'TRANSFER', unhex(replace(uuid(),'-','')),
                          f.id, p.id, t.id, r.id
                   from users f, users t, users r, point_types p
                   where f.handle='@$from' and t.handle='@$to' and r.handle='@$requester'""",
            )
        }
}
