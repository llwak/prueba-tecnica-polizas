package co.prueba.polizas.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

@Entity
@Table(name = "polizas")
public class Poliza {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoPoliza tipo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EstadoPoliza estado;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal canonMensual;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal prima;

    @Column(nullable = false)
    private int mesesVigencia;

    @Column(nullable = false)
    private LocalDate inicioVigencia;

    @Column(nullable = false)
    private LocalDate finVigencia;

    protected Poliza() {}

    public void renovar(BigDecimal ipc) {
        BigDecimal factor = BigDecimal.ONE.add(ipc.movePointLeft(2));
        canonMensual = canonMensual.multiply(factor).setScale(2, RoundingMode.HALF_UP);
        prima = canonMensual.multiply(BigDecimal.valueOf(mesesVigencia));
        inicioVigencia = finVigencia;
        finVigencia = inicioVigencia.plusMonths(mesesVigencia);
        estado = EstadoPoliza.RENOVADA;
    }

    public void cancelar() {
        estado = EstadoPoliza.CANCELADA;
    }

    public Long getId() { return id; }
    public TipoPoliza getTipo() { return tipo; }
    public EstadoPoliza getEstado() { return estado; }
    public BigDecimal getCanonMensual() { return canonMensual; }
    public BigDecimal getPrima() { return prima; }
    public int getMesesVigencia() { return mesesVigencia; }
    public LocalDate getInicioVigencia() { return inicioVigencia; }
    public LocalDate getFinVigencia() { return finVigencia; }
}
