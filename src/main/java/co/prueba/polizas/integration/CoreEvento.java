package co.prueba.polizas.integration;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

public record CoreEvento(
        @NotNull @Pattern(regexp = "ACTUALIZACION") String evento,
        @NotNull @Positive Long polizaId
) {}
