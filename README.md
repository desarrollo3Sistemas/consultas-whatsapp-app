# Agenda de Consultas + WhatsApp

Calendario web para agendar tus consultas. Al crear una cita, la app envía automáticamente
un mensaje de confirmación al paciente por WhatsApp usando la **Meta WhatsApp Cloud API**
(la API oficial de Meta, sin intermediarios).

## ¿Qué incluye?

- Calendario (vista mes / semana / día) para ver y crear citas arrastrando o dando clic.
- Alta, edición, cancelación y borrado de citas.
- Al agendar una cita, envío automático de un mensaje de WhatsApp de confirmación al paciente.
- Botón para reenviar el WhatsApp manualmente si falló.
- Base de datos SQLite local (un solo archivo `data.db`), sin necesidad de configurar un servidor de base de datos aparte.

No incluye (pero queda preparado para agregarse más adelante si lo necesitas): recordatorios
automáticos 24h/1h antes de la cita — se puede añadir con `node-cron` (ya está instalado como
dependencia) reutilizando la función `sendAppointmentConfirmation` de `server/whatsapp.js`.

---

## 1. Requisitos previos

- **Node.js 22.5 o superior** instalado (la app usa el módulo `node:sqlite` incluido en Node,
  así no necesitas instalar ni compilar ningún motor de base de datos aparte). Verifica tu
  versión con `node -v`; si tienes una versión anterior, actualiza Node antes de continuar.
- Una cuenta de **Meta for Developers** con una app de tipo "Business" que tenga el producto
  **WhatsApp** agregado. Guía oficial de inicio rápido:
  https://developers.facebook.com/docs/whatsapp/cloud-api/get-started

### 1.1 Obtener tus credenciales de WhatsApp Cloud API

1. Entra a https://developers.facebook.com/apps y crea (o usa) una app de tipo "Business".
2. Agrega el producto **WhatsApp** a la app.
3. En el panel de WhatsApp > API Setup encontrarás:
   - **Temporary access token** (para pruebas, dura 24h) o genera un **token permanente**
     creando un *System User* en Meta Business Suite con permiso `whatsapp_business_messaging`.
   - **Phone number ID**: el ID interno de tu número de WhatsApp Business (no es el número
     telefónico en sí).
4. Copia ambos valores en tu archivo `.env` (ver paso 3).

### 1.2 Crear la plantilla de mensaje (obligatorio)

WhatsApp exige que los mensajes que inicia el negocio (como una confirmación de cita) usen una
**plantilla previamente aprobada** por Meta. No se puede enviar texto libre para el primer
contacto.

1. Ve a Meta Business Suite > **Administrador de WhatsApp** > **Plantillas de mensajes**.
2. Crea una plantilla nueva:
   - **Nombre:** `cita_confirmacion` (o el nombre que prefieras, luego lo pones en `.env`).
   - **Categoría:** Utility (Utilidad).
   - **Idioma:** Español (MX).
   - **Cuerpo del mensaje**, con exactamente 3 variables en este orden:
     ```
     Hola {{1}}, tu cita ha sido confirmada para el {{2}} a las {{3}}. Si necesitas
     reagendar o cancelar, respóndenos por este medio.
     ```
3. Envíala a revisión. Meta normalmente aprueba plantillas de utilidad en minutos u horas.
4. Una vez **aprobada**, tu app ya puede enviar confirmaciones automáticas.

Mientras la plantilla no esté aprobada, puedes seguir usando la app para agendar citas
normalmente: el envío de WhatsApp simplemente fallará y quedará marcado como "falló" en
esa cita (puedes reenviarlo después con el botón "Reenviar WhatsApp").

---

## 2. Instalación local

```bash
cd consultas-whatsapp-app
npm install
cp .env.example .env
```

> Nota: `npm install` debe ejecutarse en tu computadora o en el servicio de hosting (Railway,
> Render, tu VPS, etc.), donde hay acceso normal a internet. El entorno donde se generó este
> proyecto tiene el acceso al registro de npm restringido por política de la organización, así
> que el propio `npm install` no se ejecutó ahí — pero el código fue probado directamente
> (base de datos y lógica de WhatsApp) y no depende de nada fuera de lo estándar.

Edita `.env` con tus datos reales:

```
WHATSAPP_TOKEN=tu_token_de_meta
WHATSAPP_PHONE_NUMBER_ID=tu_phone_number_id
WHATSAPP_TEMPLATE_NAME=cita_confirmacion
WHATSAPP_TEMPLATE_LANG=es_MX
DEFAULT_COUNTRY_CODE=52
```

Arranca el servidor:

```bash
npm start
```

Abre http://localhost:3000 en tu navegador. Ahí verás el calendario. Arriba a la derecha te
indica si WhatsApp está conectado.

---

## 3. Cómo se usa

1. Da clic en **"+ Nueva cita"** o directamente sobre un horario del calendario.
2. Llena nombre del paciente, teléfono (a 10 dígitos si es de México, la app antepone el 52
   automáticamente), fecha, hora, duración y motivo.
3. Al guardar, la app crea la cita **y** envía el WhatsApp de confirmación de inmediato.
4. Para cancelar una cita, ábrela desde el calendario y usa "Cancelar cita" (queda marcada,
   no se borra, y no se envía WhatsApp de cancelación automáticamente).
5. Si un mensaje falla (por ejemplo, plantilla aún no aprobada, o número inválido), la cita
   se guarda igual; puedes reenviar el WhatsApp desde el mismo formulario.

---

## 4. Desplegar la app (para que quede disponible siempre, no solo en tu compu)

La app es un servidor Node.js normal + un archivo SQLite, así que corre en casi cualquier
proveedor. Dos opciones sencillas y con capa gratuita:

### Opción A: Railway (recomendada, muy simple)

1. Sube esta carpeta a un repositorio de GitHub (o usa `railway up` desde tu computadora con
   la [CLI de Railway](https://docs.railway.app/guides/cli)).
2. En https://railway.app crea un nuevo proyecto → "Deploy from GitHub repo".
3. En **Variables**, agrega las mismas variables del `.env` (WHATSAPP_TOKEN,
   WHATSAPP_PHONE_NUMBER_ID, etc.).
4. Railway detecta el `package.json` y ejecuta `npm start` automáticamente.
5. Agrega un **Volume** montado en `/app/data.db` (o en la carpeta del proyecto) si quieres que
   la base de datos SQLite no se borre en cada despliegue.

### Opción B: Render

1. Sube el proyecto a GitHub.
2. En https://render.com crea un **Web Service** nuevo apuntando a ese repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Agrega las variables de entorno en la sección **Environment**.
5. Agrega un **Disk** persistente montado en la carpeta del proyecto para conservar `data.db`
   entre despliegues.

### Opción C: Tu propio VPS

1. Instala Node.js 18+ en el servidor.
2. Copia el proyecto (`git clone` o `scp`).
3. `npm install --production`
4. Configura `.env` con tus credenciales reales.
5. Usa un gestor de procesos como `pm2` para mantenerlo corriendo:
   ```bash
   npm install -g pm2
   pm2 start server/index.js --name consultas
   pm2 save
   ```
6. Pon un proxy (Nginx) con HTTPS delante si quieres acceder por dominio propio.

> Nota de seguridad: en cualquier opción, nunca subas tu archivo `.env` real a un repositorio
> público — contiene tu token de WhatsApp.

---

## 5. Estructura del proyecto

```
consultas-whatsapp-app/
├── server/
│   ├── index.js          # Servidor Express
│   ├── db.js              # Conexión SQLite + esquema
│   ├── whatsapp.js         # Integración Meta WhatsApp Cloud API
│   └── routes/
│       └── appointments.js # Endpoints REST de citas
├── public/
│   ├── index.html          # Calendario (FullCalendar)
│   ├── app.js               # Lógica del frontend
│   └── style.css
├── package.json
├── .env.example
└── data.db                  # Base de datos SQLite (se crea sola al arrancar)
```

## 6. Próximos pasos sugeridos

- Recordatorios automáticos 24h/1h antes: agregar un cron (`node-cron`) que revise citas
  próximas y llame a `sendAppointmentConfirmation` (o una plantilla de recordatorio nueva).
- Autenticación si vas a exponer la app públicamente (por ahora no tiene login).
- Registrar el número real de WhatsApp Business (salir del modo de prueba/sandbox de Meta)
  para poder enviar a cualquier número, no solo a los que agregaste como "testers".
