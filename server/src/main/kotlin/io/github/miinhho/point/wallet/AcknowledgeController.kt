package io.github.miinhho.point.wallet

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class AcknowledgeController(private val acknowledgeService: AcknowledgeService) {
    @PostMapping("/point-types/{id}/acknowledge")
    fun acknowledge(
        @PathVariable id: String,
        @AuthenticationPrincipal userId: Long,
    ): ResponseEntity<Unit> {
        acknowledgeService.acknowledge(userId, id)
        return ResponseEntity.noContent().build()
    }
}
