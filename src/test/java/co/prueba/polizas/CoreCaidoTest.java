package co.prueba.polizas;

import co.prueba.polizas.model.EstadoPoliza;
import co.prueba.polizas.model.EstadoRiesgo;
import co.prueba.polizas.repository.PolizaRepository;
import co.prueba.polizas.repository.RiesgoRepository;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "app.core-url=http://127.0.0.1:1/core-mock/evento",
        "spring.datasource.url=jdbc:h2:mem:polizas-core-caido;DB_CLOSE_DELAY=-1"
})
class CoreCaidoTest {
    @Autowired
    private TestRestTemplate http;

    @Autowired
    private PolizaRepository polizas;

    @Autowired
    private RiesgoRepository riesgos;

    @Test
    void devuelve502YRevierteLaCancelacionSiElCoreNoResponde() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", "123456");
        var response = http.exchange("/polizas/2/cancelar", HttpMethod.POST, new HttpEntity<>(headers),
                String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertThat(polizas.findById(2L).orElseThrow().getEstado()).isEqualTo(EstadoPoliza.ACTIVA);
        assertThat(riesgos.findByPoliza_IdOrderById(2L)).extracting(riesgo -> riesgo.getEstado())
                .containsExactly(EstadoRiesgo.ACTIVO, EstadoRiesgo.ACTIVO);
    }
}
