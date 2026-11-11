# API de Gestión de Pólizas

Prueba técnica de Desarrollo TI. API REST para consultar pólizas, gestionar sus
riesgos y simular el envío de actualizaciones a un CORE legado.

## Ejecutar

Requisitos: Java 21 y Maven 3.6.3 o posterior.

```bash
mvn clean verify
mvn spring-boot:run
```

La API escucha en `http://localhost:8080`. La base H2 en memoria carga **36 pólizas
y 71 riesgos ficticios** en cada arranque. Los endpoints de la API y el simulador
del CORE requieren el encabezado `x-api-key: 123456` con la configuración de ejemplo.

## Demostración web

Con la aplicación encendida, abre el [dashboard de cartera](http://localhost:8080/demo/index.html#dashboard).
Spring Boot sirve la interfaz y el navegador consulta la API del mismo proyecto.
Si configuras otra clave con `POLIZAS_API_KEY`, indícala en el menú **Clave de API**.

- **Dashboard** presenta cuatro gráficas de cartera. Muestra las pólizas por
  estado y tipo, los vencimientos por trimestre y el canon mensual por tipo.
  Los gráficos de vencimientos y canon incluyen las pólizas activas y renovadas.
  Pulsa una tarjeta de estado para abrir el listado con ese filtro.
- **Pólizas** permite filtrar por tipo y estado, navegar por páginas, consultar
  el detalle y gestionar renovaciones, cancelaciones y riesgos.

### Recorrido de prueba

1. En **Dashboard**, pulsa **Renovadas** para abrir las 10 pólizas que tienen ese
   estado en los datos iniciales.
2. Limpia el filtro de estado y abre la póliza individual **#1**. Renueva con
   **5,25 %** de IPC y comprueba el canon de **$1.052.500**, la prima de
   **$12.630.000** y el estado **Renovada**.
3. Vuelve al **Dashboard**. La cantidad de renovadas pasa de 10 a 11 y el canon
   mensual de la cartera sube **$52.500**.
4. En **Pólizas**, selecciona la colectiva **#2**, agrega el inmueble
   `APTO-203` y cancela ese riesgo. Luego cancela la póliza y verifica que
   todos sus riesgos queden cancelados.

**Última operación** muestra la ruta, el estado HTTP y el JSON de la respuesta.
Cada cambio aceptado queda registrado en la consola del simulador CORE.
Reinicia la aplicación para restaurar los datos de ejemplo.

## Operaciones

| Método y ruta | Entrada | Resultado |
| --- | --- | --- |
| `GET /polizas` | Filtros opcionales `tipo` y `estado` | 200 y lista |
| `GET /polizas/{id}/riesgos` | ID de la póliza | 200 y lista con el estado de cada riesgo |
| `POST /polizas/{id}/renovar` | `{"ipc":5.25}` | 200 y póliza renovada |
| `POST /polizas/{id}/cancelar` | ID de la póliza | 200 y póliza cancelada junto con sus riesgos |
| `POST /polizas/{id}/riesgos` | `{"referenciaInmueble":"APTO-203"}` | 201 y nuevo riesgo colectivo |
| `POST /riesgos/{id}/cancelar` | ID del riesgo | 200 y riesgo cancelado |
| `POST /core-mock/evento` | `{"evento":"ACTUALIZACION","polizaId":555}` | 204 y registro del evento en los logs |

Tipos: `INDIVIDUAL`, `COLECTIVA`. Estados de póliza: `ACTIVA`, `RENOVADA`,
`CANCELADA`. Estados de riesgo: `ACTIVO`, `CANCELADO`. La API responde 400 ante
datos inválidos, 401 ante clave ausente o incorrecta, 404 ante recursos ausentes,
409 ante una regla de negocio incumplida y 502 ante un fallo HTTP hacia el CORE.

### Ejemplo en PowerShell

```powershell
$base = 'http://localhost:8080'
$headers = @{ 'x-api-key' = '123456' }
Invoke-RestMethod -Uri "$base/polizas?tipo=COLECTIVA&estado=ACTIVA" -Headers $headers
Invoke-RestMethod -Uri "$base/polizas/2/riesgos" -Headers $headers
Invoke-RestMethod -Method Post -Uri "$base/polizas/1/renovar" -Headers $headers -ContentType 'application/json' -Body '{"ipc":5.25}'
$nuevo = Invoke-RestMethod -Method Post -Uri "$base/polizas/2/riesgos" -Headers $headers -ContentType 'application/json' -Body '{"referenciaInmueble":"APTO-203"}'
Invoke-RestMethod -Method Post -Uri "$base/riesgos/$($nuevo.id)/cancelar" -Headers $headers
Invoke-RestMethod -Method Post -Uri "$base/polizas/2/cancelar" -Headers $headers
Invoke-RestMethod -Uri "$base/polizas/2/riesgos" -Headers $headers
```

La renovación de ejemplo deja el canon en 1.052.500,00 y la prima en
12.630.000,00. La consola del servidor registra cada envío aceptado por el mock.

## Decisiones de implementación

- `controller` maneja HTTP y validación de entrada, `service` concentra las reglas
  y transacciones, `repository` accede a H2 mediante JPA, `model` contiene las
  entidades e `integration` encapsula el cliente HTTP del CORE.
- El IPC se recibe como porcentaje, con hasta cuatro decimales. Los importes usan
  `BigDecimal`: se redondea el canon a dos decimales y la prima se calcula con
  el canon ajustado multiplicado por los meses originales. El final de cada
  vigencia es exclusivo y coincide con el inicio de la siguiente.
- La cancelación conserva los registros y es idempotente. Los cambios sobre la
  misma póliza adquieren un bloqueo común para evitar conflictos entre agregar,
  cancelar y renovar. Cada solicitud de renovación aceptada abre una nueva
  vigencia. Evita reenviarla automáticamente tras perder una respuesta.
- Cada mutación llama por HTTP al mock y revierte sus cambios locales si falla.
  El mock registra eventos, sin actualizar un CORE real. En producción se
  necesitaría confirmar el resultado en el CORE y reconciliar reintentos.
- `POLIZAS_API_KEY` y `POLIZAS_CORE_URL` permiten cambiar la clave y el destino.
  La clave por defecto se usa para la demostración local.
