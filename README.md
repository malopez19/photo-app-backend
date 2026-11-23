# MyPhotos – API (Backend)
API REST de **MyPhotos**, una aplicación para guardar y organizar fotos y videos en la nube: favoritos, álbumes, papelera, búsqueda y control de espacio de almacenamiento por usuario.

## Características
- Registro e inicio de sesión con **JWT** guardado en cookies.
- Subida de fotos y videos con validación del tipo real de archivo.
- Almacenamiento de archivos en **ImageKit**.
- Gestión de **álbumes**, **favoritos** y **papelera**.
- Límite de almacenamiento por usuario (512 MB).
- Validación de datos de entrada con **Zod**.
- Manejo centralizado de errores.

## Tecnologías
| Área | Herramientas |
| --- | --- |
| Runtime / Framework | Node.js, Express 5 |
| Base de datos | MongoDB + Mongoose |
| Autenticación | jsonwebtoken, bcryptjs, cookie-parser |
| Archivos | Multer, file-type, ImageKit |
| Validación | Zod |
| Desarrollo | Nodemon |

## Estructura del proyecto
```
server/
├── config/          # Conexión a la BD y configuración de ImageKit
├── controllers/     # Lógica de cada recurso (auth, álbumes, media)
├── middleware/      # Autenticación, subida de archivos, manejo de errores
├── models/          # Esquemas de Mongoose (User, Album, Media)
├── routes/          # Definición de rutas
├── services/        # Lógica de negocio reutilizable
├── validators/      # Esquemas de validación con Zod
├── server.js        # Punto de entrada
└── .env             # Variables de entorno (no se sube al repo)
```

## Requisitos previos
- [Node.js](https://nodejs.org/) 20 o superior
- Una base de datos MongoDB (local o [MongoDB Atlas](https://www.mongodb.com/atlas))
- Una cuenta en [ImageKit](https://imagekit.io/)

## Instalación
```bash
git clone https://github.com/malopez19/photo-app-backend.git
cd server
npm install
```

## Variables de entorno
Crea un archivo `.env` en la raíz del proyecto:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/myphotos
JWT_SECRET=una_clave_larga_y_secreta
CLIENT_URL=http://localhost:5173

IMAGEKIT_PUBLIC_KEY=tu_public_key
IMAGEKIT_PRIVATE_KEY=tu_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/tu_id
```

## Scripts
| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia el servidor con recarga automática (Nodemon) |
| `npm start` | Inicia el servidor en modo producción |

## Endpoints principales
| Recurso | Base | Descripción |
| --- | --- | --- |
| Auth | `/api/auth` | Registro, login, logout y perfil del usuario |
| Media | `/api/media` | Subir, listar, marcar favorito, mover a papelera y restaurar |
| Álbumes | `/api/albums` | Crear, listar, editar, eliminar y agregar/quitar archivos |

## Licencia
Este proyecto está bajo la licencia MIT.
