# Boaworm Edgerunners Edition

![Python](https://img.shields.io/badge/Python-3.x-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Scrapy](https://img.shields.io/badge/Scrapy-Web%20Crawler-60A839?style=for-the-badge&logo=scrapy&logoColor=white)
![Requests](https://img.shields.io/badge/Requests-HTTP%20Client-2A6DB2?style=for-the-badge)
![BeautifulSoup](https://img.shields.io/badge/BeautifulSoup-Web%20Scraping-8B4513?style=for-the-badge)
![JSON](https://img.shields.io/badge/JSON-Data%20Format-000000?style=for-the-badge&logo=json&logoColor=white)
![License](https://img.shields.io/badge/License-All%20Rights%20Reserved-red?style=for-the-badge)

Boaworm es una reinterpretación cyberpunk del clásico juego **Snake**, inspirada en la estética de **Cyberpunk Edgerunners**.

La aplicación combina un **frontend interactivo en JavaScript** con un **backend Django** que gestiona un sistema de **leaderboard online**, persistencia de partidas y métricas de sesión.

El proyecto está diseñado como un **juego web completo listo para producción**, desplegado en **Render** y estructurado con buenas prácticas de desarrollo backend + frontend.

------------------------------------------------------------------------

## Demo

Aplicación desplegada en Render:

https://[your-app.onrender.com](https://boaworm.onrender.com/)

------------------------------------------------------------------------

## Stack tecnológico

### Frontend

-   HTML5
-   CSS3
-   JavaScript vanilla
-   Web Audio API (sonido procedural)
-   Canvas Confetti (efectos visuales)

### Backend

- Python 3
- Django (REST endpoints para leaderboard)
- Gunicorn (servidor WSGI)
- WhiteNoise (serving de archivos estáticos en producción)

### Infraestructura

-   Render (hosting)
-   GitHub (repositorio)

------------------------------------------------------------------------

## Features

### Gameplay Mechanics

El juego mantiene la lógica clásica de **Snake** con mejoras en la experiencia de usuario.

-   Movimiento con:
    -   teclado (Arrow Keys / WASD)
    -   botones en pantalla
    -   gestos táctiles en dispositivos móviles
-   Sistema de **score** y **best score**
-   **Undo** para deshacer el último movimiento
-   Persistencia automática de la partida
-   Animaciones de tiles
-   Efectos sonoros dinámicos
-   Efectos visuales al alcanzar Snake

### HUD

El HUD muestra información básica de la partida en tiempo real:

- Score
- Estado de la partida
- Identidad visual del juego

### Global Leaderboard

Sistema de ranking global:

-   Guardado automático de puntajes al finalizar la partida
-   Top players global
-   Validación básica del backend
-   Prevención de duplicados

------------------------------------------------------------------------

El proyecto sigue una arquitectura Django clásica separando lógica de backend, frontend estático y templates.

## Arquitectura del proyecto

```text
Boaworm-main/
│
├── config/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
│
├── game/
│   ├── __init__.py
│   └── views.py
│
├── templates/
│   └── index.html
│
├── static/
│   └── favicon.png
│
├── manage.py
├── requirements.txt
├── render.yaml
├── README.md
└── LICENSE

------------------------------------------------------------------------

## Variables de entorno

Ejemplo en `.env.example`

``` env
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=.onrender.com,localhost
CSRF_TRUSTED_ORIGINS=https://*.onrender.com
PORT=8000
```

------------------------------------------------------------------------

## Instalación local

Clonar el repositorio

``` bash
git clone https://github.com/tu-usuario/Boaworm.git
cd Boaworm
```

Crear entorno virtual

``` bash
python -m venv .venv
```

Activar entorno

Linux / macOS

``` bash
source .venv/bin/activate
```

Windows

``` bash
.venv\Scripts\activate
```

Instalar dependencias

``` bash
pip install -r requirements.txt
```

Aplicar migraciones

``` bash
python manage.py migrate
```

Ejecutar servidor de desarrollo

``` bash
python manage.py runserver
```

Abrir en navegador

    http://127.0.0.1:8000

------------------------------------------------------------------------

## Deployment (Render)

1.  Subir el proyecto a GitHub.
2.  Crear un **Web Service** en Render.
3.  Conectar el repositorio.
4.  Usar el archivo `render.yaml` incluido o configurar manualmente.

### Build Command

``` bash
pip install -r requirements.txt && python manage.py migrate && python manage.py collectstatic --noinput
```

### Start Command

``` bash
gunicorn gameSnake.wsgi:application
```

------------------------------------------------------------------------

## Future Improvements

Posibles mejoras futuras:

-   leaderboard en tiempo real
-   autenticación de jugadores
-   ranking semanal
-   modo hardcore
-   skins de tablero
-   multiplayer asincrónico

------------------------------------------------------------------------
