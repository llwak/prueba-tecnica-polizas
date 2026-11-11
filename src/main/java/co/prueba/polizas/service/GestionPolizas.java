package co.prueba.polizas.service;

import co.prueba.polizas.integration.CoreClient;
import co.prueba.polizas.model.*;
import co.prueba.polizas.repository.PolizaRepository;
import co.prueba.polizas.repository.RiesgoRepository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GestionPolizas {
    private final PolizaRepository polizas;
    private final RiesgoRepository riesgos;
    private final CoreClient core;

    public GestionPolizas(PolizaRepository polizas, RiesgoRepository riesgos, CoreClient core) {
        this.polizas = polizas;
        this.riesgos = riesgos;
        this.core = core;
    }

    public List<PolizaVista> listar(TipoPoliza tipo, EstadoPoliza estado) {
        return polizas.buscar(tipo, estado).stream().map(PolizaVista::de).toList();
    }

    public List<RiesgoVista> listarRiesgos(long polizaId) {
        if (!polizas.existsById(polizaId)) {
            throw polizaNoEncontrada(polizaId);
        }
        return riesgos.findByPoliza_IdOrderById(polizaId).stream().map(RiesgoVista::de).toList();
    }

    @Transactional
    public PolizaVista renovar(long polizaId, BigDecimal ipc) {
        Poliza poliza = bloquearPoliza(polizaId);
        exigirNoCancelada(poliza);
        poliza.renovar(ipc);
        polizas.flush();
        core.enviarActualizacion(polizaId);
        return PolizaVista.de(poliza);
    }

    @Transactional
    public PolizaVista cancelar(long polizaId) {
        Poliza poliza = bloquearPoliza(polizaId);
        if (poliza.getEstado() != EstadoPoliza.CANCELADA) {
            poliza.cancelar();
            riesgos.findByPoliza_IdOrderById(polizaId).forEach(Riesgo::cancelar);
            polizas.flush();
            core.enviarActualizacion(polizaId);
        }
        return PolizaVista.de(poliza);
    }

    @Transactional
    public RiesgoVista agregarRiesgo(long polizaId, String referenciaInmueble) {
        Poliza poliza = bloquearPoliza(polizaId);
        exigirNoCancelada(poliza);
        if (poliza.getTipo() != TipoPoliza.COLECTIVA) {
            throw OperacionPolizaException.conflicto("Solo se pueden agregar riesgos a pólizas colectivas.");
        }
        Riesgo riesgo = riesgos.saveAndFlush(new Riesgo(poliza, referenciaInmueble.strip()));
        core.enviarActualizacion(polizaId);
        return RiesgoVista.de(riesgo);
    }

    @Transactional
    public RiesgoVista cancelarRiesgo(long riesgoId) {
        long polizaId = riesgos.buscarPolizaId(riesgoId).orElseThrow(() ->
                OperacionPolizaException.noEncontrado("No existe el riesgo " + riesgoId + "."));
        bloquearPoliza(polizaId);
        Riesgo riesgo = riesgos.findById(riesgoId).orElseThrow(() ->
                OperacionPolizaException.noEncontrado("No existe el riesgo " + riesgoId + "."));
        if (riesgo.getEstado() != EstadoRiesgo.CANCELADO) {
            riesgo.cancelar();
            riesgos.flush();
            core.enviarActualizacion(polizaId);
        }
        return RiesgoVista.de(riesgo);
    }

    private Poliza bloquearPoliza(long polizaId) {
        return polizas.buscarParaActualizar(polizaId).orElseThrow(() -> polizaNoEncontrada(polizaId));
    }

    private OperacionPolizaException polizaNoEncontrada(long polizaId) {
        return OperacionPolizaException.noEncontrado("No existe la póliza " + polizaId + ".");
    }

    private void exigirNoCancelada(Poliza poliza) {
        if (poliza.getEstado() == EstadoPoliza.CANCELADA) {
            throw OperacionPolizaException.conflicto("La póliza está cancelada.");
        }
    }

    public record PolizaVista(Long id, TipoPoliza tipo, EstadoPoliza estado, BigDecimal canonMensual,
                             BigDecimal prima, int mesesVigencia, LocalDate inicioVigencia,
                             LocalDate finVigencia) {
        static PolizaVista de(Poliza poliza) {
            return new PolizaVista(poliza.getId(), poliza.getTipo(), poliza.getEstado(),
                    poliza.getCanonMensual(), poliza.getPrima(), poliza.getMesesVigencia(),
                    poliza.getInicioVigencia(), poliza.getFinVigencia());
        }
    }

    public record RiesgoVista(Long id, Long polizaId, String referenciaInmueble, EstadoRiesgo estado) {
        static RiesgoVista de(Riesgo riesgo) {
            return new RiesgoVista(riesgo.getId(), riesgo.getPolizaId(),
                    riesgo.getReferenciaInmueble(), riesgo.getEstado());
        }
    }
}
