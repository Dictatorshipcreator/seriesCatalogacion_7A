# Plano — archivo personal de series

Aplicación web en español para administrar series, plataformas de streaming y valoraciones.

## Funcionalidades

- CRUD de plataformas y series, con validación para evitar nombres duplicados.
- CRUD de valoraciones con plataforma, serie, puntaje entero de 1 a 10 y observación.
- Selector de series filtrado por la plataforma elegida.
- Resumen con promedios, colección y valoraciones recientes.
- Búsqueda en las listas y diseño adaptable a móviles.
- Persistencia en `localStorage` del navegador, sin cuentas ni servicios externos.

## Ejecutar localmente

Abre `index.html` en un navegador o inicia un servidor estático desde la carpeta del proyecto, por ejemplo:

```sh
npx serve .
```

## Desplegar en Vercel

Importa el repositorio en Vercel y deja la configuración de compilación vacía: la aplicación es estática y `index.html` está en la raíz. También se puede desplegar la carpeta desde la CLI de Vercel:

```sh
vercel
```

Los registros se guardan en el almacenamiento local de cada navegador, por lo que no se comparten entre dispositivos ni usuarios. Para una colección compartida entre usuarios habría que conectar una base de datos y un servicio de autenticación.
