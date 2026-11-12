import mongoose from "mongoose";
import { fileTypeFromBuffer } from "file-type";

import { Media } from "../models/Media.js";
import { Album } from "../models/Album.js";

import * as imagekitService from "./imagekitService.js";

// ======================================================
// CONFIGURACIÓN
// ======================================================

const MAX_FILES = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = MAX_FILES * MAX_FILE_SIZE;
const MAX_TITLE_LENGTH = 150;
const MAX_TAG_LENGTH = 50;

// Tiempo de espera antes de permitir recuperar
// una operación de eliminación abandonada.
const DELETION_LEASE_MS = 10 * 60 * 1000;

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

// ======================================================
// UTILIDADES
// ======================================================

const createError = (message, statusCode = 500) => {
	const error = new Error(message);
	error.statusCode = statusCode;
	return error;
};

const isValidId = (id) => {
	return typeof id === "string" && mongoose.isObjectIdOrHexString(id);
};

const validateOwnerId = (ownerId) => {
	if (!isValidId(ownerId)) {
		throw createError("Usuario no válido.", 401);
	}
};

const validateMediaId = (id) => {
	if (!isValidId(id)) {
		throw createError("ID de medio inválido.", 400);
	}
};

const escapeRegex = (value) => {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Compatibilidad con documentos antiguos que no tienen
// el campo deletionStatus.
const activeDeletionFilter = {
	$or: [{ deletionStatus: "active" }, { deletionStatus: null }],
};

// Evitar exponer identificadores internos de ImageKit
// y campos utilizados exclusivamente para eliminación.
const sanitizeMedia = (media) => {
	if (!media) {
		return media;
	}

	const result =
		typeof media.toObject === "function" ? media.toObject() : { ...media };

	delete result.fileId;
	delete result.deletionStatus;
	delete result.deletionStartedAt;
	delete result.fileDeletedAt;

	return result;
};

// Normalizar el nombre original sin confiar en
// rutas o caracteres de control proporcionados por el cliente.
const sanitizeFileName = (name) => {
	if (typeof name !== "string") {
		return "Archivo sin título";
	}

	const sanitized = name
		.replace(/[\\/\u0000-\u001F\u007F]/g, "_")
		.trim()
		.slice(0, MAX_TITLE_LENGTH);

	return sanitized || "Archivo sin título";
};

// ======================================================
// VALIDACIÓN DE ARCHIVOS
// ======================================================

const validateFiles = async (files) => {
	if (!Array.isArray(files) || files.length === 0) {
		throw createError("No se enviaron archivos.", 400);
	}

	if (files.length > MAX_FILES) {
		throw createError(
			`Solo puedes subir un máximo de ${MAX_FILES} archivos.`,
			400,
		);
	}

	let totalSize = 0;

	const validatedFiles = [];

	for (const file of files) {
		if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
			throw createError("Uno de los archivos está vacío o no es válido.", 400);
		}

		if (file.buffer.length > MAX_FILE_SIZE) {
			throw createError("Uno de los archivos supera el límite de 25 MB.", 400);
		}

		totalSize += file.buffer.length;

		if (totalSize > MAX_TOTAL_SIZE) {
			throw createError(
				"El tamaño total de los archivos supera el límite permitido.",
				400,
			);
		}

		// Detectar el formato real mediante la firma del archivo.
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

// ======================================================
// ROLLBACK DE SUBIDAS
// ======================================================

const rollbackUpload = async ({
	uploadedFileIds,
	createdMediaIds,
	ownerId,
}) => {
	// Limpiar primero los registros de MongoDB.
	if (createdMediaIds.length > 0) {
		try {
			await Media.deleteMany({
				_id: { $in: createdMediaIds },
				owner: ownerId,
			});
		} catch (error) {
			console.error("Error limpiando registros de MongoDB:", error.message);
		}
	}

	// Después intentar limpiar los archivos de ImageKit.
	for (const fileId of uploadedFileIds) {
		try {
			await imagekitService.deleteFile(fileId);
		} catch (error) {
			console.error("Error limpiando archivo de ImageKit:", error.message);
		}
	}
};

// ======================================================
// SUBIR MEDIOS
// ======================================================

export const uploadMedia = async (files, ownerId) => {
	validateOwnerId(ownerId);

	// Validar todos los archivos antes de subir cualquiera.
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

			// Registrar inmediatamente el identificador
			// para intentar compensar la subida si algo falla.
			if (typeof ikResponse?.fileId === "string" && ikResponse.fileId.trim()) {
				uploadedFileIds.push(ikResponse.fileId);
			}

			if (
				!ikResponse?.fileId ||
				typeof ikResponse.url !== "string" ||
				!ikResponse.url.trim()
			) {
				throw createError("ImageKit no devolvió los datos esperados.", 502);
			}

			// Normalizar etiquetas de inteligencia artificial.
			const aiTags = Array.isArray(ikResponse.AITags)
				? ikResponse.AITags.map((tag) => {
						if (typeof tag?.name !== "string") {
							return "";
						}

						return tag.name.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
					}).filter(Boolean)
				: [];

			const thumbnailUrl =
				typeof ikResponse.thumbnailUrl === "string"
					? ikResponse.thumbnailUrl
					: ikResponse.url;

			// Crear documento en MongoDB.
			const newMedia = await Media.create({
				title: sanitizeFileName(file.originalname),

				url: ikResponse.url,
				thumbnailUrl,
				fileId: ikResponse.fileId,

				size: ikResponse.size ?? file.buffer.length,

				format: extension,
				mediaType,

				width: ikResponse.width ?? 0,
				height: ikResponse.height ?? 0,
				duration: ikResponse.duration ?? 0,

				owner: ownerId,

				objects: aiTags,

				isFavorite: false,
				isTrash: false,
				trashedAt: null,

				deletionStatus: "active",
				deletionStartedAt: null,
				fileDeletedAt: null,
			});

			createdMediaIds.push(newMedia._id);

			uploadedItems.push(sanitizeMedia(newMedia));
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

// ======================================================
// OBTENER MEDIOS
// ======================================================

export const getMedia = async (ownerId, filters = {}) => {
	validateOwnerId(ownerId);

	const { favorite, query, type, page = 1, limit = 20 } = filters;

	const filter = {
		owner: ownerId,
		isTrash: false,
		...activeDeletionFilter,
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

		filter.$and = [
			{
				$or: [{ title: searchRegex }, { objects: searchRegex }],
			},
		];
	}

	const currentPage = Number.isSafeInteger(Number(page))
		? Math.max(1, Number(page))
		: 1;

	const currentLimit = Number.isSafeInteger(Number(limit))
		? Math.min(50, Math.max(1, Number(limit)))
		: 20;

	const skip = (currentPage - 1) * currentLimit;

	if (!Number.isSafeInteger(skip)) {
		throw createError("Número de página inválido.", 400);
	}

	const [mediaList, total] = await Promise.all([
		Media.find(filter)
			.select("-fileId -deletionStatus -deletionStartedAt -fileDeletedAt")
			.sort({ createdAt: -1, _id: -1 })
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

// ======================================================
// CAMBIAR FAVORITO
// ======================================================

export const toggleFavorite = async (id, ownerId) => {
	validateOwnerId(ownerId);
	validateMediaId(id);

	// Actualización atómica para evitar problemas
	// cuando llegan dos solicitudes simultáneas.
	const media = await Media.findOneAndUpdate(
		{
			_id: id,
			owner: ownerId,
			isTrash: false,
			...activeDeletionFilter,
		},
		[
			{
				$set: {
					isFavorite: {
						$not: [
							{
								$ifNull: ["$isFavorite", false],
							},
						],
					},
				},
			},
		],
		{
			new: true,
		},
	);

	if (!media) {
		throw createError("Medio no encontrado.", 404);
	}

	return sanitizeMedia(media);
};

// ======================================================
// CAMBIAR PAPELERA
// ======================================================

export const toggleTrash = async (id, restore, ownerId) => {
	validateOwnerId(ownerId);
	validateMediaId(id);

	if (typeof restore !== "boolean") {
		throw createError("El campo restore debe ser booleano.", 400);
	}

	// Solo permite mover a papelera un medio activo,
	// o restaurar uno que realmente esté en papelera.
	const media = await Media.findOneAndUpdate(
		{
			_id: id,
			owner: ownerId,
			isTrash: restore,
			...activeDeletionFilter,
		},
		{
			$set: {
				isTrash: !restore,
				trashedAt: restore ? null : new Date(),
			},
		},
		{
			new: true,
			runValidators: true,
		},
	);

	if (!media) {
		throw createError(
			"Medio no encontrado o no disponible para esta operación.",
			404,
		);
	}

	return {
		message: restore ? "Restaurado a la galería." : "Movido a la papelera.",

		media: sanitizeMedia(media),
	};
};

// ======================================================
// OBTENER PAPELERA
// ======================================================

export const getTrash = async (ownerId) => {
	validateOwnerId(ownerId);

	const media = await Media.find({
		owner: ownerId,
		isTrash: true,
	})
		.select("-fileId -deletionStartedAt -fileDeletedAt")
		.sort({
			trashedAt: -1,
			createdAt: -1,
		})
		.lean();

	return media;
};

// ======================================================
// RECLAMAR UN MEDIO PARA ELIMINACIÓN
// ======================================================

const claimMediaForDeletion = async (id, ownerId) => {
	const now = new Date();

	const staleBefore = new Date(now.getTime() - DELETION_LEASE_MS);

	return Media.findOneAndUpdate(
		{
			_id: id,
			owner: ownerId,
			isTrash: true,

			$or: [
				{ deletionStatus: "active" },
				{ deletionStatus: null },

				{
					deletionStatus: "pending",
					deletionStartedAt: {
						$lte: staleBefore,
					},
				},
			],
		},
		{
			$set: {
				deletionStatus: "pending",
				deletionStartedAt: now,
			},
		},
		{
			new: true,
		},
	);
};

// ======================================================
// FINALIZAR ELIMINACIÓN
// ======================================================

const finalizeDeletion = async (media, ownerId) => {
	// Si ImageKit todavía no confirmó la eliminación,
	// intentar eliminar el archivo.
	if (!media.fileDeletedAt) {
		if (media.fileId) {
			await imagekitService.deleteFile(media.fileId);
		}

		// Guardar que el archivo remoto ya fue eliminado.
		const updateResult = await Media.updateOne(
			{
				_id: media._id,
				owner: ownerId,
				deletionStatus: "pending",
			},
			{
				$set: {
					fileDeletedAt: new Date(),
				},
			},
		);

		if (updateResult.matchedCount === 0) {
			throw createError("No se pudo actualizar el estado de eliminación.", 409);
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

	// Eliminar definitivamente el documento.
	const result = await Media.deleteOne({
		_id: media._id,
		owner: ownerId,
		isTrash: true,
		deletionStatus: "pending",
	});

	if (result.deletedCount === 0) {
		throw createError("No se pudo completar la eliminación del medio.", 409);
	}

	return true;
};

// ======================================================
// ELIMINAR MEDIO PERMANENTEMENTE
// ======================================================

export const deleteMediaPermanently = async (id, ownerId) => {
	validateOwnerId(ownerId);
	validateMediaId(id);

	const media = await claimMediaForDeletion(id, ownerId);

	if (!media) {
		const exists = await Media.exists({
			_id: id,
			owner: ownerId,
			isTrash: true,
		});

		if (!exists) {
			throw createError("Medio no encontrado en papelera.", 404);
		}

		throw createError(
			"El medio ya está siendo eliminado. Intenta nuevamente más tarde.",
			409,
		);
	}

	try {
		await finalizeDeletion(media, ownerId);
	} catch (error) {
		// Se conserva el estado pending para evitar
		// restaurar un archivo cuya eliminación pudo haberse completado.
		console.error("Error durante la eliminación permanente:", error.message);

		throw createError(
			"No fue posible completar la eliminación. El proceso podrá recuperarse posteriormente.",
			502,
		);
	}

	return {
		message: "Medio eliminado permanentemente.",
	};
};

// ======================================================
// VACIAR PAPELERA
// ======================================================

export const emptyTrash = async (ownerId) => {
	validateOwnerId(ownerId);

	let deletedCount = 0;
	let failedCount = 0;
	let skippedCount = 0;

	const now = new Date();

	const staleBefore = new Date(now.getTime() - DELETION_LEASE_MS);

	const cursor = Media.find({
		owner: ownerId,
		isTrash: true,

		$or: [
			{ deletionStatus: "active" },
			{ deletionStatus: null },

			{
				deletionStatus: "pending",
				deletionStartedAt: {
					$lte: staleBefore,
				},
			},
		],
	})
		.select("_id")
		.cursor();

	try {
		for await (const item of cursor) {
			// Reclamar individualmente cada registro.
			const claimedMedia = await claimMediaForDeletion(
				item._id.toString(),
				ownerId,
			);

			// Otra solicitud pudo haber reclamado el medio.
			if (!claimedMedia) {
				skippedCount++;
				continue;
			}

			try {
				await finalizeDeletion(claimedMedia, ownerId);

				deletedCount++;
			} catch (error) {
				failedCount++;

				console.error(`Error eliminando medio ${item._id}:`, error.message);
			}
		}
	} finally {
		await cursor.close();
	}

	return {
		message:
			failedCount > 0
				? "La papelera se procesó parcialmente. Algunos archivos necesitan reintento."
				: "Papelera procesada correctamente.",

		deletedCount,
		failedCount,
		skippedCount,
	};
};

// ======================================================
// ESTADÍSTICAS DE ALMACENAMIENTO
// ======================================================

export const getStorageStats = async (ownerId) => {
	validateOwnerId(ownerId);

	const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

	const [stats, albumCount] = await Promise.all([
		Media.aggregate([
			{
				$match: {
					owner: ownerObjectId,
					isTrash: false,

					$or: [{ deletionStatus: "active" }, { deletionStatus: null }],
				},
			},

			{
				$group: {
					_id: null,

					mediaCount: {
						$sum: 1,
					},

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
			owner: ownerObjectId,
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
