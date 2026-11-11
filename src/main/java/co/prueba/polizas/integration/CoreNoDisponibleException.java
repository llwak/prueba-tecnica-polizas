package co.prueba.polizas.integration;

public class CoreNoDisponibleException extends RuntimeException {
    public CoreNoDisponibleException(Throwable cause) {
        super("No se pudo registrar el evento en el CORE.", cause);
    }
}
