import { Router } from "express";

import {
	createAlbum,
	getMyAlbums,
	getAlbumById,
	addPhotosToAlbum,
	removePhotoFromAlbum,
	deleteAlbum,
} from "../controllers/albumController.js";

import { requireAuth } from "../middleware/auth.js";

import {
	validateAlbum,
	createAlbumSchema,
	addPhotosToAlbumSchema,
} from "../validators/albumValidator.js";

const router = Router();

// Todas las rutas requieren autenticación.
router.use(requireAuth);
// Crear álbum.
router.post("/", validateAlbum(createAlbumSchema), createAlbum);
// Obtener los álbumes del usuario autenticado.
router.get("/", getMyAlbums);
// Obtener un álbum específico.
router.get("/:id", getAlbumById);
// Eliminar un álbum.
router.delete("/:id", deleteAlbum);
// Añadir fotografías a un álbum.
router.post(
	"/:id/photos",
	validateAlbum(addPhotosToAlbumSchema),
	addPhotosToAlbum,
);
// Quitar una fotografía de un álbum.
router.delete("/:id/photos/:photoId", removePhotoFromAlbum);

export default router;
