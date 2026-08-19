package io.github.miinhho.point

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

// 예상하지 못한 예외의 응답을 확인할 길이 달리 없다. 테스트 소스에만 있다.
@RestController
class BoomController {
    @GetMapping("/api/__boom")
    fun boom(): Nothing = throw IllegalStateException("터진다")

    // 클래스가 어긋나면 실제로 오는 것이 이 종류다. Exception 이 아니다.
    @GetMapping("/api/__boom-error")
    fun linkageError(): Nothing = throw NoSuchMethodError("시그니처가 어긋났다")
}
