
import * as albumService from "../services/albumService.js";

// CREAR ÁLBUM
export const createAlbum = async (req, res) => {
    const album = await albumService.createAlbum({
        title: req.body?.title,
        description: req.body?.description,
        photoIds: req.body?.photoIds ?? [],
        ownerId: req.user.id,
    });

    return res.status(201).json({ album });
};

// OBTENER MIS ÁLBUMES
export const getMyAlbums = async (req, res) => {
    const albums = await albumService.getMyAlbums(
        req.user.id
    );

    return res.status(200).json({ albums });
};

// OBTENER UN ÁLBUM
export const getAlbumById = async (req, res) => {
    const album = await albumService.getAlbumById(
        req.params.id,
        req.user.id
    );

    return res.status(200).json({ album });
};

// AÑADIR FOTOGRAFÍAS
export const addPhotosToAlbum = async (req, res) => {
    const album = await albumService.addPhotosToAlbum(
        req.params.id,
        req.body?.photoIds,
        req.user.id
    );

    return res.status(200).json({ album });
};

// QUITAR FOTOGRAFÍA
export const removePhotoFromAlbum = async (req, res) => {
    const album = await albumService.removePhotoFromAlbum(
        req.params.id,
        req.params.photoId,
        req.user.id
    );

    return res.status(200).json({
        message: "Foto eliminada del álbum.",
        album,
    });
};

// ELIMINAR ÁLBUM
export const deleteAlbum = async (req, res) => {
    const result = await albumService.deleteAlbum(
        req.params.id,
        req.user.id
    );

    return res.status(200).json(result);
};
