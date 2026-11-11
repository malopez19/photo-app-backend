import mongoose from "mongoose";
import { Album } from "../models/Album.js";
import { Media } from "../models/Media.js";

const MAX_PHOTOS_PER_ALBUM = 100;

// Genera errores que el controlador puede interpretar.
const createError = (message, statusCode) => {
	const error = new Error(message);
	error.statusCode = statusCode;
	return error;
};

// Validar identificadores de MongoDB.
const isValidId = (id) => {
	return typeof id === "string" && mongoose.isObjectIdOrHexString(id);
};

// Validar y eliminar IDs duplicados.
const validatePhotoIds = (photoIds) => {
	if (!Array.isArray(photoIds)) {
		throw createError("La lista de fotografías no es válida.", 400);
	}

	if (photoIds.length > MAX_PHOTOS_PER_ALBUM) {
		throw createError("Se supera el límite de fotografías permitido.", 400);
	}

	if (!photoIds.every(isValidId)) {
		throw createError("La lista contiene identificadores inválidos.", 400);
	}

	return [...new Set(photoIds)];
};

// Validar el ID de un álbum.
const validateAlbumId = (id) => {
	if (!isValidId(id)) {
		throw createError("ID de álbum inválido.", 400);
	}
};

// Comprobar que las fotografías pertenezcan al usuario.
const verifyPhotoOwnership = async (photoIds, ownerId) => {
	if (photoIds.length === 0) {
		return true;
	}

	const photos = await Media.find({
		_id: { $in: photoIds },
		owner: ownerId,
		isTrash: false,
	})
		.select("_id")
		.lean();

	return photos.length === photoIds.length;
};

// Comprobar la propiedad de las fotografías.
const assertPhotoOwnership = async (photoIds, ownerId) => {
	const valid = await verifyPhotoOwnership(photoIds, ownerId);

	if (!valid) {
		throw createError("Una o más fotografías no están disponibles.", 400);
	}
};

// Preparar la información de las fotografías.
const populateAlbum = (query, ownerId) => {
	return query.populate({
		path: "photos",
		match: {
			owner: ownerId,
			isTrash: false,
		},
		select: "thumbnailUrl url mediaType title createdAt",
	});
};

// CREAR ÁLBUM
export const createAlbum = async ({
	title,
	description = "",
	photoIds = [],
	ownerId,
}) => {
	if (typeof title !== "string") {
		throw createError("El título del álbum es requerido.", 400);
	}

	const normalizedTitle = title.trim();

	if (normalizedTitle.length < 1 || normalizedTitle.length > 100) {
		throw createError("El título debe tener entre 1 y 100 caracteres.", 400);
	}

	if (typeof description !== "string") {
		throw createError("La descripción no es válida.", 400);
	}

	const normalizedDescription = description.trim();

	if (normalizedDescription.length > 500) {
		throw createError("La descripción no puede superar 500 caracteres.", 400);
	}

	const validatedPhotoIds = validatePhotoIds(photoIds);

	await assertPhotoOwnership(validatedPhotoIds, ownerId);

	const album = await Album.create({
		title: normalizedTitle,
		description: normalizedDescription,
		owner: ownerId,
		photos: validatedPhotoIds,
	});

	return populateAlbum(
		Album.findOne({
			_id: album._id,
			owner: ownerId,
		}),
		ownerId,
	);
};

// OBTENER MIS ÁLBUMES
export const getMyAlbums = async (ownerId) => {
	return populateAlbum(
		Album.find({ owner: ownerId }).sort({
			updatedAt: -1,
		}),
		ownerId,
	);
};

// OBTENER UN ÁLBUM
export const getAlbumById = async (id, ownerId) => {
	validateAlbumId(id);

	const album = await populateAlbum(
		Album.findOne({
			_id: id,
			owner: ownerId,
		}),
		ownerId,
	);

	if (!album) {
		throw createError("Álbum no encontrado.", 404);
	}

	return album;
};

// AÑADIR FOTOGRAFÍAS
export const addPhotosToAlbum = async (id, photoIds, ownerId) => {
	validateAlbumId(id);

	const validatedPhotoIds = validatePhotoIds(photoIds);

	if (validatedPhotoIds.length === 0) {
		throw createError("Se requiere una lista de fotografías.", 400);
	}

	const album = await Album.findOne({
		_id: id,
		owner: ownerId,
	}).select("photos");

	if (!album) {
		throw createError("Álbum no encontrado.", 404);
	}

	await assertPhotoOwnership(validatedPhotoIds, ownerId);

	const currentPhotoIds = album.photos.map((photoId) => photoId.toString());

	const newPhotoIds = validatedPhotoIds.filter(
		(photoId) => !currentPhotoIds.includes(photoId),
	);

	if (currentPhotoIds.length + newPhotoIds.length > MAX_PHOTOS_PER_ALBUM) {
		throw createError(
			`Un álbum no puede superar las ${MAX_PHOTOS_PER_ALBUM} fotografías.`,
			400,
		);
	}

	const updatedAlbum = await Album.findOneAndUpdate(
		{
			_id: id,
			owner: ownerId,
		},
		{
			$addToSet: {
				photos: { $each: validatedPhotoIds },
			},
		},
		{
			new: true,
			runValidators: true,
		},
	);

	if (!updatedAlbum) {
		throw createError("Álbum no encontrado.", 404);
	}

	return populateAlbum(
		Album.findOne({
			_id: updatedAlbum._id,
			owner: ownerId,
		}),
		ownerId,
	);
};

// QUITAR FOTOGRAFÍA
export const removePhotoFromAlbum = async (id, photoId, ownerId) => {
	validateAlbumId(id);

	if (!isValidId(photoId)) {
		throw createError("ID de fotografía inválido.", 400);
	}

	const album = await Album.findOneAndUpdate(
		{
			_id: id,
			owner: ownerId,
		},
		{
			$pull: {
				photos: photoId,
			},
		},
		{
			new: true,
			runValidators: true,
		},
	);

	if (!album) {
		throw createError("Álbum no encontrado.", 404);
	}

	return populateAlbum(
		Album.findOne({
			_id: album._id,
			owner: ownerId,
		}),
		ownerId,
	);
};

// ELIMINAR ÁLBUM
export const deleteAlbum = async (id, ownerId) => {
	validateAlbumId(id);

	const album = await Album.findOneAndDelete({
		_id: id,
		owner: ownerId,
	});

	if (!album) {
		throw createError("Álbum no encontrado.", 404);
	}

	return {
		message: "Álbum eliminado correctamente.",
	};
};
