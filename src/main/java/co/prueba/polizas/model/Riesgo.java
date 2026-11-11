package co.prueba.polizas.model;

import jakarta.persistence.*;

@Entity
@Table(name = "riesgos", indexes = @Index(name = "idx_riesgos_poliza", columnList = "poliza_id"))
public class Riesgo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "poliza_id", nullable = false)
    private Poliza poliza;

    @Column(nullable = false, length = 120)
    private String referenciaInmueble;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoRiesgo estado;

    protected Riesgo() {}

    public Riesgo(Poliza poliza, String referenciaInmueble) {
        this.poliza = poliza;
        this.referenciaInmueble = referenciaInmueble;
        this.estado = EstadoRiesgo.ACTIVO;
    }

    public void cancelar() {
        estado = EstadoRiesgo.CANCELADO;
    }

    public Long getId() { return id; }
    public Long getPolizaId() { return poliza.getId(); }
    public String getReferenciaInmueble() { return referenciaInmueble; }
    public EstadoRiesgo getEstado() { return estado; }
}
