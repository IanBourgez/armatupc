# ArmaTuPC

Página web para armar una PC: pregunta tu zona, revisa la compatibilidad de los componentes, busca precios en vivo en 3 tiendas y, al terminar, estima el rendimiento en juegos.

## Cómo abrirla
1. Instalar **Node.js** (versión 18 o más nueva): https://nodejs.org
2. Abrir una terminal en esta carpeta y escribir:
   ```
   node server.js
   ```
3. Entrar en el navegador a **http://localhost:3000**

No hace falta instalar nada más (no usa librerías externas).

## Qué hace cada archivo
| Archivo | Para qué sirve |
|---|---|
| `server.js` | Servidor en Node. Muestra la página y consulta las tiendas en vivo (Mercado Libre, Olanet y Amazon) y el valor del dólar. Guarda los precios 30 minutos en `cache-precios.json`. |
| `public/index.html` | Estructura de la página. |
| `public/styles.css` | Diseño. |
| `public/app.js` | Lógica: zona, armado, compatibilidad, precios y rendimiento. |
| `public/data/catalogo.json` | Componentes con sus datos técnicos (socket, tipo de RAM, watts, medidas, etc.). |
| `public/data/juegos.json` | Juegos y datos para estimar los FPS. |

## Las 3 opciones de compra
- **Barato pero no seguro:** el precio más bajo en Mercado Libre (cualquier vendedor).
- **Precio medio, seguridad media:** la tienda de tu ciudad (en Olavarría, Olanet). Si tu ciudad no tiene una tienda cargada, usa las tiendas oficiales de Mercado Libre.
- **Precio alto, totalmente confiable:** Amazon, pasado a pesos con el dólar tarjeta (sin envío ni impuestos de importación).

## Compatibilidad que revisa
- Socket del procesador y de la motherboard.
- Tipo de memoria (DDR4 o DDR5) y cantidad de ranuras.
- Formato de la motherboard y del gabinete.
- Largo de la placa de video y altura del cooler contra el gabinete.
- Watts de la fuente según el consumo estimado.
- Procesadores sin cooler de caja y sin gráficos integrados.

## Rendimiento en juegos
Estima los FPS con el puntaje del procesador y de la placa, la RAM y la memoria de video, en 1080p, 1440p o 4K y calidad baja a ultra. Cada juego tiene un botón a "Can You Run It" y otro a videos de pruebas reales para comparar.

## Agregar componentes nuevos
Copiar un bloque en `public/data/catalogo.json` dentro de su categoría y cambiar los datos. Con el buscador "Ver lo último que salió en las tiendas" se pueden ver los modelos nuevos que aparecen en Mercado Libre.

## Limitaciones
- Las tiendas no tienen una forma oficial y abierta de dar sus precios, así que el servidor lee sus páginas. Si una tienda cambia su página o bloquea la consulta, aparece el botón "Buscar en la tienda" y se usa el precio de referencia.
- Olanet carga sus precios con JavaScript, por eso es la tienda que más puede fallar.
- Los FPS son estimaciones, no mediciones.
