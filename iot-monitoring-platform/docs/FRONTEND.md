# Frontend Angular · Pulse

El frontend está en `apps/frontend` y utiliza Angular 21, componentes standalone, signals y formularios Angular. Su configuración y lockfile son independientes del backend NestJS.

## Abrir la presentación

Desde `iot-monitoring-platform` en la rama `feature/demo-auth-sessions`:

```powershell
docker compose -p iot-demo-auth up -d --build
```

Abre **http://localhost:5173**. Espera a que los servicios terminen de iniciar si aparece un error de conexión.

1. Selecciona **Crear mi demo**. Se registra una cuenta DEMO temporal sin correo ni contraseña, según el modelo de autenticación existente.
2. **Paso 1: Preparar mi recorrido** crea únicamente el sensor del invernadero. Se marca el sensor como completado y la regla queda como siguiente acción.
3. **Paso 2: Crear reglas del recorrido** configura tres reglas: temperatura mayor que 35 °C, humedad mayor que 70 % y presión mayor que 1050 hPa. No avanza hasta guardar las tres correctamente.
4. **Paso 3: Enviar lectura y recibir alertas** publica 42 °C, 85 % y 1080 hPa en el sensor del recorrido y espera las tres alertas reales. Solo entonces muestra **Recorrido completado** y **Ver alertas del recorrido**. Desde Alertas, pulsa **Reconocer** y luego **Resolver**.
5. Explora **Dispositivos**, **Reglas** y **Sesiones**. Puedes crear, editar o eliminar dispositivos; crear, pausar y eliminar reglas; y revocar otras sesiones.
6. Para presentar MASTER, cierra sesión, elige **Administrador** e inicia con `MASTER_USERNAME` y `MASTER_PASSWORD` del `.env` de este checkout. MASTER también puede consultar y habilitar/deshabilitar usuarios.

Cada DEMO tiene sus propios datos, un máximo de tres dispositivos y tres reglas. Su duración depende de `SESSION_EXPIRATION` (24 horas por defecto). El progreso se recupera al recargar usando únicamente el sensor, las tres reglas y sus alertas del recorrido, sin duplicarlos; si ya alcanzaste las cuotas, libera espacio o usa tus recursos existentes.

**Iniciar lecturas continuas** envía temperatura, humedad y presión normales juntas cada cinco segundos mientras la página permanece abierta. **Detener simulación** cancela los próximos envíos. Las lecturas son simuladas; las métricas y alertas usan los servicios reales.

## Sesión y comunicación

- Access token solo en memoria; refresh token en cookie HttpOnly. Recargar la página restaura la sesión mediante refresh.
- Renovación de token con una sola petición compartida entre solicitudes concurrentes de la pestaña.
- Proxy del frontend: misma procedencia para APIs, cookies y SSE; los nombres internos de Docker no se exponen como URLs al navegador.
- El endpoint de simulación valida sesión y acceso al dispositivo a través de Device Service antes de publicar en MQTT.
- Las métricas se consultan cada cinco segundos. SSE notifica alertas, se reconecta y vuelve a autenticar periódicamente.
- Errores de conexión y sesión tienen mensajes visibles. No se muestran métricas ficticias mientras faltan lecturas.

## Desarrollo local

Con Docker levantado, Node compatible con Angular 21 y desde `apps/frontend`:

```powershell
npm.cmd ci
npm.cmd start
```

Abre http://localhost:4200. El servidor de desarrollo redirige `/api` al frontend Docker en el puerto 5173. En otras plataformas usa `npm` en lugar de `npm.cmd`.

[Compatibilidad de Angular y Node](https://angular.dev/reference/versions).

## Validación

```powershell
npm.cmd run build
npm.cmd run test:e2e
```

Las pruebas Playwright usan Chrome instalado y el stack real en http://localhost:5173. `PLAYWRIGHT_CHANNEL=msedge` permite usar Edge; `FRONTEND_URL` cambia la URL de las pruebas. Las credenciales MASTER se leen del `.env` raíz sin escribirlas en los resultados.

Se crean usuarios y datos temporales para probar el recorrido; quedan sujetos a la limpieza de expiración y al límite de creación de cuentas DEMO. Las capturas y resultados se guardan en `apps/frontend/test-results` (ignorado por Git). No configures grabación de tráfico o trazas sin revisar el manejo de tokens y credenciales.

## Resultado de la verificación

Verificado el 9 de septiembre de 2026 con Chrome headless y Docker:

- Compilación Angular de producción correcta, junto a los cinco servicios NestJS.
- Tres pruebas de navegador aprobadas: recorrido DEMO, acceso MASTER y diseño móvil de 390 px.
- Recorrido DEMO: creación guiada, lectura MQTT, gráfica, notificación SSE, reconocimiento/resolución, formularios de dispositivos y reglas, restauración de sesión, cookie HttpOnly, aislamiento del simulador y logout.
- Login inválido presenta un mensaje legible; MASTER muestra la administración de usuarios.
- Las capturas de escritorio y móvil se inspeccionaron visualmente y no presentaron desbordamiento horizontal de página.

### Corrección del avance del recorrido

Cada clic ejecuta un único paso. Los recursos ajenos al recorrido no completan etapas. Mientras se espera la alerta el botón queda deshabilitado; un fallo de API o una espera sin confirmación muestra un mensaje persistente y permite reintentar. La espera de confirmación es de 30 segundos, además del tiempo de las solicitudes en curso. Una alerta que llegue tarde también puede completar el recorrido al actualizarse el panel.

Validación de esta corrección: compilación Angular correcta; pruebas de recorrido DEMO, MASTER y móvil aprobadas; prueba adicional de recursos ajenos al recorrido, fallo al guardar regla, fallo al publicar lectura, espera agotada y reintento sin duplicados aprobada. La prueba adicional se ejecutó tras reiniciar el gateway local por el límite acumulado de creación de cuentas DEMO.

## Temperaturas, sensores e historial

En **Un cambio. Una señal.** selecciona el sensor, escribe la temperatura y pulsa **Enviar lectura personalizada**. Se permiten negativos, positivos y decimales entre **−273,15 y 500 °C**, equivalentes a **−459,67 y 932 °F**. El campo vacío, los valores no numéricos y los valores fuera del intervalo bloquean el envío. El servidor también valida el valor; MQTT y el almacenamiento mantienen Celsius. Cambiar la unidad convierte el valor, la gráfica, las métricas y las lecturas de alertas. Las reglas de temperatura se configuran en Celsius.

**El pulso de tus sensores** permite seleccionar varios dispositivos, identificados por color y leyenda, y filtrar o seleccionar una zona completa. La zona corresponde al campo **Zona / ubicación** del dispositivo; los dispositivos sin ubicación aparecen en **Sin zona**.

La gráfica ofrece última hora, día, semana, últimos 30 días, fechas personalizadas y botones para acercar, alejar o desplazarse en el tiempo. Las fechas se muestran en la hora local del navegador. Se consulta el historial completo del intervalo, hasta 366 días, resumido en un máximo de 240 puntos por sensor. Cada punto contiene promedio, mínimo, máximo y cantidad de lecturas; el cursor muestra estos detalles. Acercar el intervalo aumenta el detalle. Los periodos históricos sin datos se muestran vacíos.

En **Alertas** puedes combinar zona, dispositivo, tipo de alarma (temperatura, humedad o presión), severidad, estado e intervalo. La agrupación admite dispositivo, tipo de alarma o zona. Los filtros se aplican en el servidor; las agrupaciones organizan los resultados de la página actual (50 en Alertas, 5 en el resumen). El total indica todas las coincidencias del filtro.

### Prueba de consultas históricas

Desde la raíz del proyecto, con Docker iniciado:

```powershell
docker cp scripts/exploration-e2e.cjs iot-api-gateway:/usr/src/app/exploration-e2e.cjs
docker exec iot-api-gateway node exploration-e2e.cjs
```

Esta prueba crea datos propios de varios días y zonas, valida rangos y agregación, filtros y paginación, permisos MASTER/DEMO y límites de temperatura. Elimina únicamente sus usuarios temporales y sus datos al finalizar. Las pruebas de navegador incluyen conversión °C/°F, envío personalizado, varias series, zonas, zoom y agrupación de alertas.

### Verificación de exploración — 11 de septiembre de 2026

- Stack Docker actualizado y compilación de los cinco servicios y Angular correcta.
- **37 comprobaciones de API aprobadas**: intervalos históricos, agregación, filtros, paginación, límites de temperatura y autorización MASTER/DEMO.
- **5 pruebas de Chrome aprobadas**: recorrido completo, MASTER, móvil, recuperación de errores del recorrido y exploración con temperaturas personalizadas, conversión de unidades, múltiples sensores, zonas, zoom y agrupación de alertas.
- Captura de escritorio revisada; comprobaciones de ancho móvil sin desbordamiento horizontal.

## Reglas por zona y observabilidad

En **Reglas → Nueva regla** elige una zona y marca uno o varios dispositivos. Una regla multisensor consume una sola regla de la cuota DEMO. Las selecciones son explícitas: los sensores creados después no se incorporan automáticamente. Si un sensor cambia de zona, la regla de la zona anterior deja de evaluarlo. Puedes editar la regla para ajustar su alcance, mensaje y color, o pausarla.

Condiciones disponibles:

- **Mayor que / menor que**: comparación estricta con el umbral.
- **Igual a**: comparación numérica, incluidos los decimales almacenados.
- **Dentro del rango**: incluye el límite inferior y el superior.
- **Fuera del rango**: detecta valores inferiores al mínimo o superiores al máximo con una sola regla; los límites son válidos y no disparan.

El umbral es el límite inferior en las condiciones de rango. El límite superior es obligatorio y debe ser mayor. Temperatura usa °C (−273,15 a 500); humedad permite 0 a 100 %. El mensaje personalizado admite hasta 500 caracteres y el color usa RGB hexadecimal. Se conservan en la alerta emitida aunque después edites la regla. La severidad mantiene su etiqueta: el color no la sustituye.

El **Resumen** conserva el total de dispositivos y añade activos/sin señal reciente. Activo significa que el servidor confirmó una lectura durante los últimos 10 minutos; no depende del reloj del sensor. La lista **Revisar sensores sin señal** identifica nombre, zona y última recepción. “Sin señal reciente” indica ausencia de lecturas, no demuestra que el equipo esté apagado. La vista se actualiza cada cinco segundos mientras está abierta.

Las tarjetas de temperatura y humedad identifican sensor y zona, además de su última señal. **Alertas pendientes** muestra el total y su distribución crítica/alta/media/baja. Cuenta únicamente pendientes de reconocer (`TRIGGERED`), de todas las fechas y páginas, con el mismo aislamiento MASTER/DEMO.

### Ampliación del esquema y pruebas

La migración aditiva `scripts/migrations/20260911-rule-observability.sql` incorpora las columnas de alcance, mensaje y color y la condición `OUTSIDE_RANGE`. Se aplicó al Docker local conservando sus datos. Para otro despliegue con esquema existente, ejecuta antes de reconstruir:

```powershell
docker cp scripts/migrations/20260911-rule-observability.sql iot-api-gateway:/usr/src/app/20260911-rule-observability.sql
docker cp scripts/migrate-rule-observability.cjs iot-api-gateway:/usr/src/app/migrate-rule-observability.cjs
docker exec iot-api-gateway node migrate-rule-observability.cjs
docker compose -p iot-demo-auth up -d --build
```

El script es idempotente. Usa las credenciales `DB_*` del contenedor sin imprimirlas. En instalaciones nuevas con `NODE_ENV=development`, TypeORM crea el esquema actualizado; en producción aplica las migraciones de esquema como parte del despliegue.

Prueba integral adicional, tras el arranque de los servicios:

```powershell
docker cp scripts/observability-e2e.cjs iot-api-gateway:/usr/src/app/observability-e2e.cjs
docker exec iot-api-gateway node observability-e2e.cjs
```

Crea sus propios datos temporales y los elimina al terminar. Comprueba selecciones por zona, límites de rango, edición, aislamiento, mensajes/colores históricos, conteos por severidad y recepción de señales con fecha de sensor antigua. La prueba de Chrome `observability.e2e.cjs` también comprueba la transición de activo a sin señal al superar diez minutos.

### Resultado de la verificación de reglas y resumen

Verificado el 11 de septiembre de 2026: compilación Angular y de los cinco servicios correcta; **31 pruebas unitarias** aprobadas; prueba integral nueva con **35 solicitudes verificadas** y regresión de historial/filtros con **37 comprobaciones de API** aprobadas. Los cinco recorridos de navegador anteriores pasaron; la nueva prueba de observabilidad pasó tras precisar el selector del botón de creación. Capturas del formulario y del resumen inspeccionadas, y verificación móvil sin desbordamiento de página.

### Texto legible de las alarmas

Los mensajes automáticos se generan en español con unidades y una explicación de la condición: `Temperatura: 42 °C. Supera el umbral de 35 °C.`. El nombre, el sensor y la explicación se muestran en líneas separadas. Los mensajes técnicos antiguos se presentan en español usando los valores guardados en el texto original, sin modificar los registros históricos ni sustituirlos por umbrales editados después. Los mensajes personalizados se muestran literalmente.

## Recorrido y señales de las tres métricas

El recorrido crea una regla por métrica y espera una alerta real de cada una antes de completarse. Usa las tres plazas de reglas DEMO. Si hay reglas ajenas, informa cuántas plazas debes liberar; no las elimina. Un fallo intermedio conserva las reglas ya guardadas y permite reintentar sin duplicarlas. Los recorridos antiguos con una sola regla pueden continuarse para añadir las otras dos.

En el simulador, **Métrica a enviar** permite elegir temperatura, humedad o presión. El envío manual contiene solo esa métrica: las demás no se modifican ni generan señales de relleno. Validación en navegador y servidor:

| Métrica | Unidad | Valores de la demo |
|---|---|---|
| Temperatura | °C o °F | −273,15 a 500 °C (−459,67 a 932 °F) |
| Humedad | % | 0 a 100 |
| Presión | hPa | 0 a 2000 |

Los accesos rápidos cambian según la métrica. **Iniciar lecturas continuas** envía las tres juntas cada cinco segundos: temperatura 26–31 °C, humedad 50–60 % y presión 1005–1020 hPa. **Detener simulación** cancela los siguientes envíos. El resumen muestra temperatura, humedad y presión, con unidad, sensor y zona; las métricas sin lectura permanecen vacías. La gráfica histórica sigue mostrando temperatura.

### Verificación de las tres métricas — 12 de septiembre de 2026

Compilación Angular y reconstrucción del frontend Docker correctas. Los ocho recorridos de Chrome quedaron aprobados: siete en la ejecución conjunta y el recorrido DEMO completo al repetirlo tras ajustar su espera de actualización de cuota. La prueba nueva verifica recuperación tras crear parcialmente las reglas, tres alertas confirmadas, envío manual sin métricas de relleno, límites de humedad/presión, envío automático conjunto y ancho móvil. El resumen de escritorio con las tres mediciones se inspeccionó visualmente.
