package io.github.miinhho.point.user

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PrePersist
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import java.util.UUID

@Entity
@Table(name = "users")
class User(
    @Column(nullable = false, length = 50)
    var name: String,

    @Column(nullable = false, unique = true, length = 50)
    var handle: String,

    @Column(name = "password_hash", nullable = false, length = 100)
    var passwordHash: String,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null
        protected set

    // 외부에 노출하는 id. 내부 PK 를 노출하면 순번이 새어 나간다.
    // handle 은 var 라 바뀔 수 있으므로 equals/hashCode 의 기준으로 쓰지 않는다.
    @Column(name = "public_id", nullable = false, unique = true, updatable = false)
    var publicId: UUID = UUID.randomUUID()
        protected set

    // 저장 시점에 정규화한다 — 조회만 정규화하면 @Minho 와 @minho 두 행이 공존하고,
    // 그러면 unique 제약이 정규화된 형태를 지키지 못한다 (docs/API.md 「동시에 왔을 때」).
    @PrePersist
    @PreUpdate
    protected fun normalize() {
        handle = normalizeHandle(handle)
    }

    override fun equals(other: Any?) = other is User && publicId == other.publicId
    override fun hashCode() = publicId.hashCode()
}
