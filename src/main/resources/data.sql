INSERT INTO polizas (tipo, estado, canon_mensual, prima, meses_vigencia, inicio_vigencia, fin_vigencia)
VALUES ('INDIVIDUAL', 'ACTIVA', 1000000.00, 12000000.00, 12, DATE '2026-01-01', DATE '2027-01-01'),
       ('COLECTIVA', 'ACTIVA', 2000000.00, 12000000.00, 6, DATE '2026-07-01', DATE '2027-01-01');

INSERT INTO riesgos (poliza_id, referencia_inmueble, estado)
VALUES (1, 'APTO-101', 'ACTIVO'),
       (2, 'APTO-201', 'ACTIVO'),
       (2, 'APTO-202', 'ACTIVO');
