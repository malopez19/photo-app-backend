
import * as mediaService from "../services/mediaService.js";

// SUBIR MEDIOS
export const uploadMedia = async (req, res) => {
    const result = await mediaService.uploadMedia(
        req.files,
        req.user.id
    );

    return res.status(201).json({
        message: `¡${result.count} archivo(s) subido(s) con éxito!`,
        media: result.media,
    });
};

// OBTENER MEDIOS
export const getMedia = async (req, res) => {
    const result = await mediaService.getMedia(
        req.user.id,
        req.validatedQuery
    );

    return res.status(200).json(result);
};

// CAMBIAR FAVORITO
export const toggleFavorite = async (req, res) => {
    const media = await mediaService.toggleFavorite(
        req.params.id,
        req.user.id
    );

    return res.status(200).json({ media });
};

// CAMBIAR PAPELERA
export const toggleTrash = async (req, res) => {
    const result = await mediaService.toggleTrash(
        req.params.id,
        req.body?.restore,
        req.user.id
    );

    return res.status(200).json(result);
};

// OBTENER PAPELERA
export const getTrash = async (req, res) => {
    const media = await mediaService.getTrash(
        req.user.id
    );

    return res.status(200).json({ media });
};

// ELIMINAR MEDIO PERMANENTEMENTE
export const deleteMediaPermanently = async (req, res) => {
    const result = await mediaService.deleteMediaPermanently(
        req.params.id,
        req.user.id
    );

    return res.status(200).json(result);
};

// VACIAR PAPELERA
export const emptyTrash = async (req, res) => {
    const result = await mediaService.emptyTrash(
        req.user.id
    );

    return res.status(200).json(result);
};

// ESTADÍSTICAS DE ALMACENAMIENTO
export const getStorageStats = async (req, res) => {
    const stats = await mediaService.getStorageStats(
        req.user.id
    );

    return res.status(200).json(stats);
};
