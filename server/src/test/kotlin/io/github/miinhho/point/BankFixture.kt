package io.github.miinhho.point

import io.github.miinhho.point.pointtype.CreatePointTypeRequest
import io.github.miinhho.point.pointtype.PointType
import io.github.miinhho.point.pointtype.PointTypeCreateService
import io.github.miinhho.point.pointtype.PointTypeRepository
import org.springframework.stereotype.Component
import java.math.BigDecimal
import java.util.UUID

/**
 * 픽스처가 은행을 만드는 유일한 자리. **창설 서비스를 지난다** — 리포지토리로 바로 넣으면
 * 화면이 만들 수 없는 은행이 테스트에 남는다.
 *
 * 실제로 그랬다. 픽스처 다섯 클래스가 허용 목록에 없는 이모지(`🔵` · `💰`)로 은행을 만들고
 * 있었고, 창설 API 는 그 값을 거절한다. 검증을 우회한 판 위에서 도는 테스트는 통과해도
 * 사용자에게서 깨진다.
 *
 * 인자로 받는 `PointType` 은 저장되지 않는다. 무엇을 만들지 적는 데만 쓴다.
 */
@Component
class BankFixture(
    private val pointTypeRepository: PointTypeRepository,
    private val pointTypeCreateService: PointTypeCreateService,
) {
    fun open(spec: PointType, issueCap: Long = 1_000_000): PointType {
        val created = pointTypeCreateService.create(
            requireNotNull(spec.issuer.id),
            UUID.randomUUID().toString(),
            CreatePointTypeRequest(
                name = spec.name,
                emoji = spec.emoji,
                description = spec.description,
                accent = spec.accent.name.lowercase(),
                issueCap = BigDecimal(issueCap),
                visibility = spec.visibility.name.lowercase(),
            ),
        )
        return requireNotNull(pointTypeRepository.findByPublicId(UUID.fromString(created.id)))
    }
}
