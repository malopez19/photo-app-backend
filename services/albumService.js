import mongoose from "mongoose";
import { Album } from "../models/Album.js";
import { Media } from "../models/Media.js";

const MAX_PHOTOS_PER_ALBUM = 100;

// Generar errores que el controlador pueda interpretar.
const createError = (message, statusCode) => {
	const error = new Error(message);
	error.statusCode = statusCode;
	return error;
};

// Validar identificadores de MongoDB.
const isValidId = (id) => {
	return mongoose.isObjectIdOrHexString(id);
};

// Validar el propietario de los recursos.
const validateOwnerId = (ownerId) => {
	if (!isValidId(ownerId)) {
		throw createError("Usuario no válido.", 401);
	}
};

// Validar IDs, normalizarlos y eliminar duplicados.
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

	return [...new Set(photoIds.map((id) => id.toString().toLowerCase()))];
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
		.lean()
		.exec();

	return photos.length === photoIds.length;
};

// Exigir que todas las fotografías sean del usuario.
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
	validateOwnerId(ownerId);

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
	).exec();
};

// OBTENER MIS ÁLBUMES
export const getMyAlbums = async (ownerId) => {
	validateOwnerId(ownerId);

	return populateAlbum(
		Album.find({
			owner: ownerId,
		}).sort({
			updatedAt: -1,
		}),
		ownerId,
	).exec();
};

// OBTENER UN ÁLBUM
export const getAlbumById = async (id, ownerId) => {
	validateOwnerId(ownerId);
	validateAlbumId(id);

	const album = await populateAlbum(
		Album.findOne({
			_id: id,
			owner: ownerId,
		}),
		ownerId,
	).exec();

	if (!album) {
		throw createError("Álbum no encontrado.", 404);
	}

	return album;
};

// AÑADIR FOTOGRAFÍAS
export const addPhotosToAlbum = async (id, photoIds, ownerId) => {
	validateOwnerId(ownerId);
	validateAlbumId(id);

	const validatedPhotoIds = validatePhotoIds(photoIds);

	if (validatedPhotoIds.length === 0) {
		throw createError("Se requiere una lista de fotografías.", 400);
	}

	// Buscar exclusivamente un álbum del usuario autenticado.
	const album = await Album.findOne({
		_id: id,
		owner: ownerId,
	})
		.select("photos")
		.exec();

	if (!album) {
		throw createError("Álbum no encontrado.", 404);
	}

	// Comprobar que todas las fotografías sean del usuario.
	await assertPhotoOwnership(validatedPhotoIds, ownerId);

	const currentPhotoIds = album.photos.map((photoId) =>
		photoId.toString().toLowerCase(),
	);

	// Evitar añadir fotografías que ya estén en el álbum.
	const newPhotoIds = validatedPhotoIds.filter(
		(photoId) => !currentPhotoIds.includes(photoId),
	);

	if (newPhotoIds.length === 0) {
		return populateAlbum(
			Album.findOne({
				_id: id,
				owner: ownerId,
			}),
			ownerId,
		).exec();
	}

	// Actualización atómica: vuelve a comprobar el límite
	// usando el tamaño actual del array en MongoDB.
	const updatedAlbum = await Album.findOneAndUpdate(
		{
			_id: id,
			owner: ownerId,

			$expr: {
				$lte: [
					{
						$add: [
							{
								$size: {
									$ifNull: ["$photos", []],
								},
							},
							newPhotoIds.length,
						],
					},
					MAX_PHOTOS_PER_ALBUM,
				],
			},
		},
		{
			$addToSet: {
				photos: {
					$each: newPhotoIds,
				},
			},
		},
		{
			new: true,
			runValidators: true,
		},
	).exec();

	if (!updatedAlbum) {
		// Diferenciar un álbum inexistente de un límite alcanzado.
		const albumExists = await Album.exists({
			_id: id,
			owner: ownerId,
		});

		if (!albumExists) {
			throw createError("Álbum no encontrado.", 404);
		}

		throw createError(
			`Un álbum no puede superar las ${MAX_PHOTOS_PER_ALBUM} fotografías.`,
			400,
		);
	}

	return populateAlbum(
		Album.findOne({
			_id: id,
			owner: ownerId,
		}),
		ownerId,
	).exec();
};

// QUITAR FOTOGRAFÍA
export const removePhotoFromAlbum = async (id, photoId, ownerId) => {
	validateOwnerId(ownerId);
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
				photos: new mongoose.Types.ObjectId(photoId),
			},
		},
		{
			new: true,
			runValidators: true,
		},
	).exec();

	if (!album) {
		throw createError("Álbum no encontrado.", 404);
	}

	return populateAlbum(
		Album.findOne({
			_id: album._id,
			owner: ownerId,
		}),
		ownerId,
	).exec();
};

// ELIMINAR ÁLBUM
export const deleteAlbum = async (id, ownerId) => {
	validateOwnerId(ownerId);
	validateAlbumId(id);

	const album = await Album.findOneAndDelete({
		_id: id,
		owner: ownerId,
	}).exec();

	if (!album) {
		throw createError("Álbum no encontrado.", 404);
	}

	return {
		message: "Álbum eliminado correctamente.",
	};
};
