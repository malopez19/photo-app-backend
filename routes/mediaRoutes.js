
import { Router } from "express";

import {
    uploadMedia,
    getMedia,
    toggleFavorite,
    toggleTrash,
    getTrash,
    deleteMediaPermanently,
    emptyTrash,
    getStorageStats,
} from "../controllers/mediaController.js";

import { requireAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

import {
    validateMedia,
    getMediaSchema,
    mediaIdSchema,
    toggleTrashSchema,
} from "../validators/mediaValidator.js";

const router = Router();

router.use(requireAuth);
// SUBIR MEDIOS
router.post("/upload", upload.array("media", 5), uploadMedia);
// OBTENER MEDIOS
router.get("/", validateMedia(getMediaSchema, "query"), getMedia);
// OBTENER PAPELERA
router.get("/trash", getTrash);
// VACIAR PAPELERA
router.delete("/trash/empty", emptyTrash);
// ESTADÍSTICAS
router.get("/stats", getStorageStats);
// CAMBIAR FAVORITO
router.patch(
    "/:id/favorite",
    validateMedia(mediaIdSchema, "params"),
    toggleFavorite
);
// CAMBIAR PAPELERA
router.patch(
    "/:id/trash",
    validateMedia(mediaIdSchema, "params"),
    validateMedia(toggleTrashSchema),
    toggleTrash
);
// ELIMINAR PERMANENTEMENTE
router.delete(
    "/:id",
    validateMedia(mediaIdSchema, "params"),
    deleteMediaPermanently
);

export default router;
