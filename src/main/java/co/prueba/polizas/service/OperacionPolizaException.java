package co.prueba.polizas.service;

public class OperacionPolizaException extends RuntimeException {
    private final boolean recursoAusente;

    private OperacionPolizaException(String mensaje, boolean recursoAusente) {
        super(mensaje);
        this.recursoAusente = recursoAusente;
    }

    public static OperacionPolizaException noEncontrado(String mensaje) {
        return new OperacionPolizaException(mensaje, true);
    }

    public static OperacionPolizaException conflicto(String mensaje) {
        return new OperacionPolizaException(mensaje, false);
    }

    public boolean recursoAusente() {
        return recursoAusente;
    }
}
