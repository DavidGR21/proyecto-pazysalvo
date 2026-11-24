# SIGEL — Paz y salvo y liquidación laboral

Herramienta académica (Node.js + React) para registrar el expediente de desvinculación, verificar paz y salvo por departamento, adjuntar evidencias y generar los PDF de **certificado de paz y salvo** y **liquidación de haberes**, según el Código del Trabajo del Ecuador.

## Cómo ejecutar

En la raíz del proyecto:

```bash
npm install
npm run install:all
npm run dev
```

- Interfaz: http://localhost:5173
- API: http://localhost:4000

Al iniciar, se carga solo el **caso hipotético** si la base está vacía. También puede pulsar **Cargar caso hipotético** en la bandeja.

Los PDF de entrega quedan en `entregables/`.

## Caso hipotético (ficticio)

| Campo | Dato |
| --- | --- |
| Empresa | AndesLogística del Centro Cía. Ltda., Riobamba |
| RUC | 0691847365001 |
| Trabajador | Carlos Eduardo Núñez Cabrera, C.C. 0603984712 |
| Cargo | Coordinador de Bodega y Despacho |
| Ingreso / salida | 3 mar 2022 – 14 nov 2026 |
| Remuneración | USD 880,00 |
| Causa | Desahucio del trabajador (Arts. 184 y 185 CT) |
| Vacaciones pendientes | 18 días |
| Fondos de reserva | Mensualizados al IESS (no se reliquidan) |

Haberes: remuneración proporcional de noviembre, vacaciones, décimo tercero y cuarto proporcionales, y bonificación por desahucio (25% × última remuneración × años completos). Deducción: aporte personal IESS 9,45% sobre la remuneración del mes de salida.
