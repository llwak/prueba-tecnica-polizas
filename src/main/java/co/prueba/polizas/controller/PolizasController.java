package co.prueba.polizas.controller;

import co.prueba.polizas.model.EstadoPoliza;
import co.prueba.polizas.model.TipoPoliza;
import co.prueba.polizas.service.GestionPolizas;
import co.prueba.polizas.service.GestionPolizas.PolizaVista;
import co.prueba.polizas.service.GestionPolizas.RiesgoVista;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class PolizasController {
    private final GestionPolizas gestion;

    public PolizasController(GestionPolizas gestion) {
        this.gestion = gestion;
    }

    @GetMapping("/polizas")
    public List<PolizaVista> listar(@RequestParam(required = false) TipoPoliza tipo,
                                   @RequestParam(required = false) EstadoPoliza estado) {
        return gestion.listar(tipo, estado);
    }

    @GetMapping("/polizas/{id}/riesgos")
    public List<RiesgoVista> listarRiesgos(@PathVariable long id) {
        return gestion.listarRiesgos(id);
    }

    @PostMapping("/polizas/{id}/renovar")
    public PolizaVista renovar(@PathVariable long id, @RequestBody @Valid Renovacion datos) {
        return gestion.renovar(id, datos.ipc());
    }

    @PostMapping("/polizas/{id}/cancelar")
    public PolizaVista cancelar(@PathVariable long id) {
        return gestion.cancelar(id);
    }

    @PostMapping("/polizas/{id}/riesgos")
    @ResponseStatus(HttpStatus.CREATED)
    public RiesgoVista agregarRiesgo(@PathVariable long id, @RequestBody @Valid AltaRiesgo datos) {
        return gestion.agregarRiesgo(id, datos.referenciaInmueble());
    }

    @PostMapping("/riesgos/{id}/cancelar")
    public RiesgoVista cancelarRiesgo(@PathVariable long id) {
        return gestion.cancelarRiesgo(id);
    }

    public record Renovacion(@NotNull @PositiveOrZero @Digits(integer = 3, fraction = 4) BigDecimal ipc) {}

    public record AltaRiesgo(@NotBlank @Size(max = 120) String referenciaInmueble) {}
}
