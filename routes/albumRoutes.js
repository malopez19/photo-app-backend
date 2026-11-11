
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

// Todas las rutas requieren autenticación
router.use(requireAuth);
// CREAR ÁLBUM
router.post(
    "/",
    validateAlbum(createAlbumSchema),
    createAlbum
);
// OBTENER MIS ÁLBUMES
router.get("/", getMyAlbums);
// OBTENER UN ÁLBUM
router.get("/:id", getAlbumById);
// ELIMINAR ÁLBUM
router.delete("/:id", deleteAlbum);
// AÑADIR FOTOGRAFÍAS
router.post(
    "/:id/photos",
    validateAlbum(addPhotosToAlbumSchema),
    addPhotosToAlbum
);
// QUITAR FOTOGRAFÍA
router.delete("/:id/photos/:photoId", removePhotoFromAlbum);

export default router;
