package io.github.miinhho.point

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import

@SpringBootTest
@Import(TestcontainersConfiguration::class)
class PointApplicationTests {

	@Test
	fun contextLoads() {
	}

}
