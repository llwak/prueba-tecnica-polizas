package co.prueba.polizas.controller;

import co.prueba.polizas.integration.CoreEvento;
import jakarta.validation.Valid;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class CoreMockController {
    private static final Logger log = LoggerFactory.getLogger(CoreMockController.class);

    @PostMapping("/core-mock/evento")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recibir(@RequestBody @Valid CoreEvento evento) {
        log.info("CORE mock recibió evento={} polizaId={}", evento.evento(), evento.polizaId());
    }
}
