package io.github.miinhho.point.pointtype

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class PointTypeQueryService(private val pointTypeRepository: PointTypeRepository) {
    // 이름 겹침은 한 번만 집계한다 — 포인트마다 세면 N+1 이다.
    @Transactional(readOnly = true)
    fun all(viewerId: Long): List<PointTypeResponse> {
        val sharedNames = pointTypeRepository.sharedNames()
        return pointTypeRepository.findAll().map { it.toResponse(viewerId, sharedNames) }
    }
}
