package co.prueba.polizas.integration;

import java.net.URI;
import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class CoreClient {
    private static final Logger log = LoggerFactory.getLogger(CoreClient.class);

    private final RestClient client;
    private final Environment environment;
    private final String coreUrl;
    private final String apiKey;

    public CoreClient(RestClient.Builder builder, Environment environment,
                      @Value("${app.core-url}") String coreUrl,
                      @Value("${app.api-key}") String apiKey) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(2));
        requestFactory.setReadTimeout(Duration.ofSeconds(3));
        this.client = builder.requestFactory(requestFactory).build();
        this.environment = environment;
        this.coreUrl = coreUrl;
        this.apiKey = apiKey;
    }

    public void enviarActualizacion(long polizaId) {
        String port = environment.getProperty("local.server.port", "8080");
        URI endpoint = URI.create(coreUrl.isBlank()
                ? "http://127.0.0.1:" + port + "/core-mock/evento" : coreUrl);
        log.info("Intento de integración con CORE polizaId={}", polizaId);
        try {
            client.post()
                    .uri(endpoint)
                    .header("x-api-key", apiKey)
                    .body(new CoreEvento("ACTUALIZACION", polizaId))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientException exception) {
            log.warn("Falló la integración con CORE polizaId={} causa={}",
                    polizaId, exception.getClass().getSimpleName());
            throw new CoreNoDisponibleException(exception);
        }
    }
}
