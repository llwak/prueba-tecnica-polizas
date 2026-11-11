package co.prueba.polizas.repository;

import co.prueba.polizas.model.Riesgo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RiesgoRepository extends JpaRepository<Riesgo, Long> {
    List<Riesgo> findByPoliza_IdOrderById(long polizaId);

    @Query("select r.poliza.id from Riesgo r where r.id = :id")
    Optional<Long> buscarPolizaId(@Param("id") long id);
}
