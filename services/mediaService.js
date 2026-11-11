import mongoose from "mongoose";
import { fileTypeFromBuffer } from "file-type";

import { Media } from "../models/Media.js";
import { Album } from "../models/Album.js";

import * as imagekitService from "./imagekitService.js";

// Formatos permitidos y sus extensiones.
const allowedMimeTypes = {
	"image/jpeg": {
		extension: "jpg",
		mediaType: "image",
	},
	"image/png": {
		extension: "png",
		mediaType: "image",
	},
	"image/webp": {
		extension: "webp",
		mediaType: "image",
	},
	"image/gif": {
		extension: "gif",
		mediaType: "image",
	},
	"image/avif": {
		extension: "avif",
		mediaType: "image",
	},
	"video/mp4": {
		extension: "mp4",
		mediaType: "video",
	},
	"video/webm": {
		extension: "webm",
		mediaType: "video",
	},
	"video/quicktime": {
		extension: "mov",
		mediaType: "video",
	},
};

// Crear errores con código HTTP.
const createError = (message, statusCode = 500) => {
	const error = new Error(message);
	error.statusCode = statusCode;
	return error;
};

// Validar identificadores de MongoDB.
const isValidId = (id) => {
	return typeof id === "string" && mongoose.isObjectIdOrHexString(id);
};

const validateMediaId = (id) => {
	if (!isValidId(id)) {
		throw createError("ID de medio inválido.", 400);
	}
};

// Escapar caracteres especiales de expresiones regulares.
const escapeRegex = (value) => {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Validar todos los archivos antes de subir cualquiera.
const validateFiles = async (files) => {
	if (!Array.isArray(files) || files.length === 0) {
		throw createError("No se enviaron archivos.", 400);
	}

	const validatedFiles = [];

	for (const file of files) {
		if (!file.buffer || file.buffer.length === 0) {
			throw createError("Uno de los archivos está vacío.", 400);
		}

		const detectedType = await fileTypeFromBuffer(file.buffer);

		const fileConfig = detectedType
			? allowedMimeTypes[detectedType.mime]
			: null;

		if (!fileConfig) {
			throw createError(
				"El contenido real del archivo no es válido o no está permitido.",
				400,
			);
		}

		validatedFiles.push({
			file,
			extension: fileConfig.extension,
			mediaType: fileConfig.mediaType,
		});
	}

	return validatedFiles;
};

// Limpiar recursos cuando falla una subida.
const rollbackUpload = async ({
	uploadedFileIds,
	createdMediaIds,
	ownerId,
}) => {
	// Eliminar registros creados en MongoDB.
	if (createdMediaIds.length > 0) {
		try {
			await Media.deleteMany({
				_id: { $in: createdMediaIds },
				owner: ownerId,
			});
		} catch (error) {
			console.error("Error limpiando registros de MongoDB:", error);
		}
	}

	// Eliminar archivos subidos a ImageKit.
	for (const fileId of uploadedFileIds) {
		try {
			await imagekitService.deleteFile(fileId);
		} catch (error) {
			console.error(`Error limpiando archivo ${fileId} de ImageKit:`, error);
		}
	}
};

// SUBIR MEDIOS
export const uploadMedia = async (files, ownerId) => {
	// Primero validar todos los archivos.
	const validatedFiles = await validateFiles(files);

	const uploadedFileIds = [];
	const createdMediaIds = [];
	const uploadedItems = [];

	try {
		for (const item of validatedFiles) {
			const { file, extension, mediaType } = item;

			// Subir archivo a ImageKit.
			const ikResponse = await imagekitService.uploadFile({
				buffer: file.buffer,
				extension,
				mediaType,
			});

			if (!ikResponse.fileId || !ikResponse.url) {
				throw new Error("ImageKit no devolvió los datos esperados.");
			}

			uploadedFileIds.push(ikResponse.fileId);

			// Obtener etiquetas de inteligencia artificial.
			const aiTags = Array.isArray(ikResponse.AITags)
				? ikResponse.AITags.map((tag) =>
						typeof tag.name === "string" ? tag.name.toLowerCase().trim() : "",
					).filter(Boolean)
				: [];

			const thumbnailUrl = ikResponse.thumbnailUrl || ikResponse.url;

			// Guardar información en MongoDB.
			const newMedia = await Media.create({
				title: (file.originalname || "Archivo sin título").trim().slice(0, 150),

				url: ikResponse.url,
				thumbnailUrl,
				fileId: ikResponse.fileId,

				size: ikResponse.size ?? file.size ?? 0,

				format: extension,
				mediaType,

				width: ikResponse.width ?? 0,
				height: ikResponse.height ?? 0,

				owner: ownerId,
				objects: aiTags,
			});

			createdMediaIds.push(newMedia._id);

			uploadedItems.push(newMedia);
		}

		return {
			media: uploadedItems,
			count: uploadedItems.length,
		};
	} catch (error) {
		await rollbackUpload({
			uploadedFileIds,
			createdMediaIds,
			ownerId,
		});

		throw error;
	}
};

// OBTENER MEDIOS
export const getMedia = async (ownerId, filters = {}) => {
	const { favorite, query, type, page, limit } = filters;

	const filter = {
		owner: ownerId,
		isTrash: false,
	};

	if (favorite === "true") {
		filter.isFavorite = true;
	}

	if (type === "image" || type === "video") {
		filter.mediaType = type;
	}

	if (typeof query === "string" && query.trim() !== "") {
		const search = query.trim().slice(0, 100);
		const searchRegex = new RegExp(escapeRegex(search), "i");

		filter.$or = [{ title: searchRegex }, { objects: searchRegex }];
	}

	const parsedPage = Number(page);
	const parsedLimit = Number(limit);

	const currentPage = Number.isSafeInteger(parsedPage)
		? Math.max(1, parsedPage)
		: 1;

	const currentLimit = Number.isSafeInteger(parsedLimit)
		? Math.min(50, Math.max(1, parsedLimit))
		: 20;

	const skip = (currentPage - 1) * currentLimit;

	if (!Number.isSafeInteger(skip)) {
		throw createError("Número de página inválido.", 400);
	}

	const [mediaList, total] = await Promise.all([
		Media.find(filter)
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(currentLimit)
			.lean(),

		Media.countDocuments(filter),
	]);

	return {
		media: mediaList,
		pagination: {
			total,
			page: currentPage,
			limit: currentLimit,
			totalPages: Math.ceil(total / currentLimit),
		},
	};
};

// CAMBIAR FAVORITO
export const toggleFavorite = async (id, ownerId) => {
	validateMediaId(id);

	const media = await Media.findOne({
		_id: id,
		owner: ownerId,
	});

	if (!media) {
		throw createError("Medio no encontrado.", 404);
	}

	media.isFavorite = !media.isFavorite;

	await media.save();

	return media;
};

// CAMBIAR PAPELERA
export const toggleTrash = async (id, restore, ownerId) => {
	validateMediaId(id);

	if (typeof restore !== "boolean") {
		throw createError("El campo restore debe ser booleano.", 400);
	}

	const media = await Media.findOne({
		_id: id,
		owner: ownerId,
	});

	if (!media) {
		throw createError("Medio no encontrado.", 404);
	}

	media.isTrash = !restore;
	media.trashedAt = restore ? null : new Date();

	await media.save();

	return {
		message: restore ? "Restaurado a la galería" : "Movido a la papelera",
		media,
	};
};

// OBTENER PAPELERA
export const getTrash = async (ownerId) => {
	return Media.find({
		owner: ownerId,
		isTrash: true,
	}).sort({
		trashedAt: -1,
	});
};

// ELIMINAR MEDIO PERMANENTEMENTE
export const deleteMediaPermanently = async (id, ownerId) => {
	validateMediaId(id);

	const media = await Media.findOne({
		_id: id,
		owner: ownerId,
		isTrash: true,
	});

	if (!media) {
		throw createError("Medio no encontrado en papelera.", 404);
	}

	// Primero eliminar el archivo de ImageKit.
	if (media.fileId) {
		try {
			await imagekitService.deleteFile(media.fileId);
		} catch (error) {
			console.error("Error eliminando archivo de ImageKit:", error);

			throw createError("No fue posible eliminar el archivo de la nube.", 502);
		}
	}

	// Retirar referencias de los álbumes del propietario.
	await Album.updateMany(
		{
			owner: ownerId,
			photos: media._id,
		},
		{
			$pull: {
				photos: media._id,
			},
		},
	);

	await Media.deleteOne({
		_id: media._id,
		owner: ownerId,
	});

	return {
		message: "Medio eliminado permanentemente.",
	};
};

// VACIAR PAPELERA
export const emptyTrash = async (ownerId) => {
	let deletedCount = 0;

	const cursor = Media.find({
		owner: ownerId,
		isTrash: true,
	})
		.select("_id title fileId")
		.cursor();

	try {
		for await (const item of cursor) {
			// Eliminar archivo de ImageKit.
			if (item.fileId) {
				try {
					await imagekitService.deleteFile(item.fileId);
				} catch (error) {
					console.error(`Error eliminando ${item.fileId}:`, error);

					const deletionError = createError(
						`No se pudo eliminar el archivo ${item.title}. La operación se detuvo.`,
						502,
					);

					deletionError.deletedCount = deletedCount;

					throw deletionError;
				}
			}

			// Eliminar referencias de álbumes.
			await Album.updateMany(
				{
					owner: ownerId,
					photos: item._id,
				},
				{
					$pull: {
						photos: item._id,
					},
				},
			);

			// Eliminar documento de MongoDB.
			const result = await Media.deleteOne({
				_id: item._id,
				owner: ownerId,
				isTrash: true,
			});

			if (result.deletedCount > 0) {
				deletedCount++;
			}
		}
	} finally {
		await cursor.close();
	}

	return {
		message: `Papelera vaciada. ${deletedCount} archivo(s) eliminados.`,
		deletedCount,
	};
};

// ESTADÍSTICAS DE ALMACENAMIENTO
export const getStorageStats = async (ownerId) => {
	if (!mongoose.isObjectIdOrHexString(ownerId)) {
		throw createError("ID de usuario inválido.", 400);
	}

	const [stats, albumCount] = await Promise.all([
		Media.aggregate([
			{
				$match: {
					owner: new mongoose.Types.ObjectId(ownerId),
					isTrash: false,
				},
			},
			{
				$group: {
					_id: null,

					mediaCount: { $sum: 1 },

					videoCount: {
						$sum: {
							$cond: [{ $eq: ["$mediaType", "video"] }, 1, 0],
						},
					},

					photoCount: {
						$sum: {
							$cond: [{ $eq: ["$mediaType", "image"] }, 1, 0],
						},
					},

					favoriteCount: {
						$sum: {
							$cond: ["$isFavorite", 1, 0],
						},
					},

					totalBytes: {
						$sum: "$size",
					},
				},
			},
		]),

		Album.countDocuments({
			owner: ownerId,
		}),
	]);

	return {
		...(stats[0] || {
			mediaCount: 0,
			videoCount: 0,
			photoCount: 0,
			favoriteCount: 0,
			totalBytes: 0,
		}),

		albumCount,
	};
};
