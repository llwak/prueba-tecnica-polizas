-- Datos ficticios adicionales para la demostración. Las pólizas 1 y 2
-- y sus riesgos se cargan desde data.sql.
INSERT INTO polizas (id, tipo, estado, canon_mensual, prima, meses_vigencia, inicio_vigencia, fin_vigencia)
SELECT id, tipo, estado, canon_mensual, canon_mensual * meses_vigencia, meses_vigencia,
       inicio_vigencia, DATEADD('MONTH', meses_vigencia, inicio_vigencia)
FROM (VALUES
    ( 3, 'INDIVIDUAL', 'ACTIVA', 1525000.00, 24, DATE '2026-03-20'),
    ( 4, 'INDIVIDUAL', 'RENOVADA', 2600000.00, 12, DATE '2026-10-01'),
    ( 5, 'COLECTIVA', 'ACTIVA', 6800000.00,  6, DATE '2026-07-10'),
    ( 6, 'INDIVIDUAL', 'CANCELADA', 2200000.00, 12, DATE '2026-04-15'),
    ( 7, 'COLECTIVA', 'RENOVADA', 8400000.00, 18, DATE '2026-11-20'),
    ( 8, 'INDIVIDUAL', 'ACTIVA', 1800000.00, 24, DATE '2026-08-01'),
    ( 9, 'INDIVIDUAL', 'ACTIVA', 2875000.00, 12, DATE '2026-05-10'),
    (10, 'COLECTIVA', 'RENOVADA', 4750000.00,  6, DATE '2026-06-15'),
    (11, 'INDIVIDUAL', 'ACTIVA', 2475000.00, 12, DATE '2026-09-20'),
    (12, 'COLECTIVA', 'CANCELADA', 6350000.00, 18, DATE '2026-06-01'),
    (13, 'INDIVIDUAL', 'RENOVADA', 2075000.00, 24, DATE '2026-03-10'),
    (14, 'INDIVIDUAL', 'ACTIVA', 3150000.00, 12, DATE '2026-10-15'),
    (15, 'COLECTIVA', 'ACTIVA', 8750000.00,  6, DATE '2026-07-20'),
    (16, 'INDIVIDUAL', 'ACTIVA', 2750000.00, 12, DATE '2026-04-01'),
    (17, 'COLECTIVA', 'RENOVADA', 4300000.00, 18, DATE '2026-11-10'),
    (18, 'INDIVIDUAL', 'CANCELADA', 2350000.00, 24, DATE '2026-08-15'),
    (19, 'INDIVIDUAL', 'ACTIVA',  875000.00, 12, DATE '2026-05-20'),
    (20, 'COLECTIVA', 'RENOVADA', 6700000.00,  6, DATE '2026-06-01'),
    (21, 'INDIVIDUAL', 'ACTIVA', 3025000.00, 12, DATE '2026-09-10'),
    (22, 'COLECTIVA', 'ACTIVA', 8300000.00, 18, DATE '2026-06-15'),
    (23, 'INDIVIDUAL', 'RENOVADA', 2625000.00, 24, DATE '2026-03-20'),
    (24, 'INDIVIDUAL', 'ACTIVA', 1150000.00, 12, DATE '2026-10-01'),
    (25, 'COLECTIVA', 'CANCELADA', 4650000.00,  6, DATE '2026-07-10'),
    (26, 'INDIVIDUAL', 'ACTIVA', 3300000.00, 12, DATE '2026-04-15'),
    (27, 'COLECTIVA', 'RENOVADA', 6250000.00, 18, DATE '2026-11-20'),
    (28, 'INDIVIDUAL', 'ACTIVA', 2900000.00, 24, DATE '2026-08-01'),
    (29, 'INDIVIDUAL', 'ACTIVA', 1425000.00, 12, DATE '2026-05-10'),
    (30, 'COLECTIVA', 'CANCELADA', 8650000.00,  6, DATE '2026-02-15'),
    (31, 'INDIVIDUAL', 'RENOVADA', 1025000.00, 12, DATE '2026-09-20'),
    (32, 'COLECTIVA', 'ACTIVA', 4200000.00, 18, DATE '2026-06-01'),
    (33, 'INDIVIDUAL', 'ACTIVA', 3175000.00, 24, DATE '2026-03-10'),
    (34, 'INDIVIDUAL', 'ACTIVA', 1700000.00, 12, DATE '2026-10-15'),
    (35, 'COLECTIVA', 'RENOVADA', 6600000.00,  6, DATE '2026-07-20'),
    (36, 'INDIVIDUAL', 'CANCELADA', 1300000.00, 12, DATE '2026-04-01')
) AS muestra(id, tipo, estado, canon_mensual, meses_vigencia, inicio_vigencia);

ALTER TABLE polizas ALTER COLUMN id RESTART WITH 37;

-- Cada póliza individual tiene un riesgo. Las colectivas tienen entre dos y cinco.
INSERT INTO riesgos (poliza_id, referencia_inmueble, estado)
SELECT p.id,
       CONCAT(CASE WHEN p.tipo = 'COLECTIVA' AND MOD(u.numero, 3) = 0 THEN 'LOCAL-' ELSE 'APTO-' END,
              1000 + p.id * 10 + u.numero),
       CASE WHEN p.estado = 'CANCELADA'
                 OR (p.tipo = 'COLECTIVA' AND MOD(p.id, 5) = 0 AND u.numero = 2)
            THEN 'CANCELADO' ELSE 'ACTIVO' END
FROM polizas p
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS u(numero)
WHERE p.id BETWEEN 3 AND 36
  AND u.numero <= CASE WHEN p.tipo = 'INDIVIDUAL' THEN 1 ELSE 2 + MOD(p.id, 4) END
ORDER BY p.id, u.numero;
