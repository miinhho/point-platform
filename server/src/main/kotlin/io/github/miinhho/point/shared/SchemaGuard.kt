package io.github.miinhho.point.shared

import jakarta.persistence.EntityManagerFactory
import org.hibernate.engine.spi.SessionFactoryImplementor
import org.hibernate.persister.entity.AbstractEntityPersister
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import javax.sql.DataSource

/**
 * 엔티티가 non-null 이라 선언한 칸이 스키마에서 널 허용이면 부팅을 막는다.
 *
 * `ddl-auto=validate` 는 테이블과 컬럼의 존재·타입만 본다. 널 허용은 보지 않으므로,
 * 엔티티를 먼저 조이고 마이그레이션이 늦게 오면 **부팅은 통과하고 그 표를 읽는 첫 요청에서**
 * 터진다. 목록 조회면 한 행이 나쁠 때 응답 전체가 사라져 그 표를 보는 사람 전원이 죽는다 —
 * 실제로 그렇게 났다 (docs/FIELD.md 「W10」).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class SchemaGuard(
    private val entityManagerFactory: EntityManagerFactory,
    private val dataSource: DataSource,
) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        val nullableInSchema = readNullableColumns()
        val wrong = expectedNotNullColumns().filter { it in nullableInSchema }
        check(wrong.isEmpty()) {
            "엔티티는 값이 있다고 하는데 스키마는 널을 허용한다: ${wrong.sorted()}. 마이그레이션이 빠졌다."
        }
    }

    private fun expectedNotNullColumns(): List<String> {
        val metamodel = entityManagerFactory.unwrap(SessionFactoryImplementor::class.java).mappingMetamodel
        val columns = mutableListOf<String>()
        metamodel.forEachEntityDescriptor { persister ->
            val table = (persister as AbstractEntityPersister).tableName.substringAfterLast('.').lowercase()
            persister.propertyNullability.forEachIndexed { i, nullable ->
                if (!nullable) persister.getPropertyColumnNames(i).forEach { columns += "$table.${it.lowercase()}" }
            }
        }
        return columns
    }

    private fun readNullableColumns(): Set<String> = dataSource.connection.use { connection ->
        connection.prepareStatement(
            "select table_name, column_name from information_schema.columns " +
                "where table_schema = database() and is_nullable = 'YES'",
        ).use { statement ->
            statement.executeQuery().use { rows ->
                buildSet { while (rows.next()) add("${rows.getString(1).lowercase()}.${rows.getString(2).lowercase()}") }
            }
        }
    }
}
