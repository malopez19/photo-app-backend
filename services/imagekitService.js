import "dotenv/config";

import ImageKit, { toFile } from "@imagekit/nodejs";
import { randomUUID } from "node:crypto";

// Formatos permitidos.
const ALLOWED_EXTENSIONS = [
	"jpg",
	"png",
	"webp",
	"gif",
	"avif",
	"mp4",
	"webm",
	"mov",
];

// Inicializar ImageKit.
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;

if (!privateKey) {
	throw new Error(
		"Falta configurar IMAGEKIT_PRIVATE_KEY en las variables de entorno.",
	);
}

const imagekit = new ImageKit({
	privateKey,
	timeout: 60000,
	maxRetries: 2,
});

// Generar errores controlados.
const createError = (message, statusCode = 502) => {
	const error = new Error(message);
	error.statusCode = statusCode;
	return error;
};

// Validar el archivo antes de subirlo.
const validateUploadData = ({ buffer, extension, mediaType }) => {
	if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
		throw createError("El contenido del archivo no es válido.", 400);
	}

	if (!ALLOWED_EXTENSIONS.includes(extension)) {
		throw createError("Formato de archivo no permitido.", 400);
	}

	if (!["image", "video"].includes(mediaType)) {
		throw createError("Tipo de medio no permitido.", 400);
	}
};

// SUBIR ARCHIVO
export const uploadFile = async ({ buffer, extension, mediaType }) => {
	validateUploadData({
		buffer,
		extension,
		mediaType,
	});

	try {
		// Generar un nombre aleatorio para evitar colisiones
		// y no utilizar nombres proporcionados por el usuario.
		const fileName = `${randomUUID()}.${extension}`;

		// Convertir el Buffer al formato de archivo del SDK.
		const file = await toFile(buffer, fileName);

		const response = await imagekit.files.upload({
			file,
			fileName,
			useUniqueFileName: false,
		});

		if (!response.fileId || !response.url) {
			throw new Error("ImageKit no devolvió un identificador o URL válidos.");
		}

		// Normalizar la respuesta para que sea compatible
		// con mediaService.js.
		return {
			fileId: response.fileId,
			url: response.url,
			thumbnailUrl: response.thumbnail || response.url,

			size: response.size ?? buffer.length,

			width: response.width ?? 0,
			height: response.height ?? 0,
			duration: response.duration ?? 0,

			AITags: Array.isArray(response.AITags) ? response.AITags : [],
		};
	} catch (error) {
		console.error("Error durante la subida a ImageKit:", error.message);

		throw createError(
			"No fue posible subir el archivo al servicio de almacenamiento.",
			502,
		);
	}
};

// ELIMINAR ARCHIVO
export const deleteFile = async (fileId) => {
	if (typeof fileId !== "string" || fileId.trim().length === 0) {
		throw createError("Identificador de ImageKit inválido.", 400);
	}

	try {
		await imagekit.files.delete(fileId);

		return {
			success: true,
		};
	} catch (error) {
		console.error("Error eliminando archivo de ImageKit:", error.message);

		throw createError("No fue posible eliminar el archivo de ImageKit.", 502);
	}
};
