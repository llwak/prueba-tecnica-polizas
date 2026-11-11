package co.prueba.polizas;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.*;
import org.springframework.test.context.jdbc.Sql;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ExtendWith(OutputCaptureExtension.class)
@Sql({"/reiniciar-datos.sql", "/data.sql"})
class PolizasApiTest {
    @Autowired
    private TestRestTemplate http;

    @Test
    void listaConFiltrosYConsultaRiesgos() {
        var polizas = request(HttpMethod.GET, "/polizas?tipo=INDIVIDUAL&estado=ACTIVA", null);
        assertThat(polizas.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(polizas.getBody().size()).isEqualTo(1);
        assertThat(polizas.getBody().get(0).get("id").asLong()).isEqualTo(1L);

        var riesgos = request(HttpMethod.GET, "/polizas/2/riesgos", null);
        assertThat(riesgos.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(riesgos.getBody().size()).isEqualTo(2);
        assertThat(request(HttpMethod.GET, "/polizas/999/riesgos", null).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void renuevaYRegistraEventoEnElMock(CapturedOutput output) {
        var response = request(HttpMethod.POST, "/polizas/1/renovar", Map.of("ipc", new BigDecimal("5.25")));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        var poliza = response.getBody();
        assertThat(poliza.get("estado").asText()).isEqualTo("RENOVADA");
        assertThat(poliza.get("canonMensual").decimalValue()).isEqualByComparingTo("1052500.00");
        assertThat(poliza.get("prima").decimalValue()).isEqualByComparingTo("12630000.00");
        assertThat(poliza.get("inicioVigencia").asText()).isEqualTo("2027-01-01");
        assertThat(poliza.get("finVigencia").asText()).isEqualTo("2028-01-01");
        assertThat(output.getAll()).contains("CORE mock recibió evento=ACTUALIZACION polizaId=1");
    }

    @Test
    void agregaSoloEnColectivaYCancelaLosRiesgos(CapturedOutput output) {
        assertThat(request(HttpMethod.POST, "/polizas/1/riesgos", Map.of("referenciaInmueble", "APTO-999"))
                .getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(request(HttpMethod.GET, "/polizas/1/riesgos", null).getBody().size()).isEqualTo(1);

        var alta = request(HttpMethod.POST, "/polizas/2/riesgos", Map.of("referenciaInmueble", "APTO-203"));
        assertThat(alta.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        long riesgoId = alta.getBody().get("id").asLong();
        var riesgoCancelado = request(HttpMethod.POST, "/riesgos/" + riesgoId + "/cancelar", null);
        assertThat(riesgoCancelado.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(riesgoCancelado.getBody().get("estado").asText()).isEqualTo("CANCELADO");

        var polizaCancelada = request(HttpMethod.POST, "/polizas/2/cancelar", null);
        assertThat(polizaCancelada.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(polizaCancelada.getBody().get("estado").asText()).isEqualTo("CANCELADA");
        var riesgos = request(HttpMethod.GET, "/polizas/2/riesgos", null);
        assertThat(riesgos.getBody().size()).isEqualTo(3);
        for (JsonNode riesgo : riesgos.getBody()) {
            assertThat(riesgo.get("estado").asText()).isEqualTo("CANCELADO");
        }

        assertThat(request(HttpMethod.POST, "/polizas/2/renovar", Map.of("ipc", 5)).getStatusCode())
                .isEqualTo(HttpStatus.CONFLICT);
        assertThat(request(HttpMethod.POST, "/polizas/2/riesgos", Map.of("referenciaInmueble", "APTO-204"))
                .getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(request(HttpMethod.POST, "/polizas/2/cancelar", null).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(output.getAll().lines()
                .filter(line -> line.contains("CORE mock recibió evento=ACTUALIZACION polizaId=2")).count())
                .isEqualTo(3L);
    }

    @Test
    void validaApiKeyYDatos() {
        assertThat(http.getForEntity("/polizas", String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        HttpHeaders invalidHeaders = new HttpHeaders();
        invalidHeaders.set("x-api-key", "incorrecta");
        assertThat(http.exchange("/polizas", HttpMethod.GET, new HttpEntity<>(invalidHeaders), String.class)
                .getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(request(HttpMethod.GET, "/polizas?tipo=OTRO", null).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(request(HttpMethod.POST, "/polizas/1/renovar", Map.of("ipc", -5)).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(request(HttpMethod.POST, "/polizas/2/riesgos", Map.of("referenciaInmueble", " "))
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(request(HttpMethod.POST, "/core-mock/evento", Map.of("evento", "ACTUALIZACION", "polizaId", 555))
                .getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    private ResponseEntity<JsonNode> request(HttpMethod method, String path, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("x-api-key", "123456");
        headers.setContentType(MediaType.APPLICATION_JSON);
        return http.exchange(path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }
}
