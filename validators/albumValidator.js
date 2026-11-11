import { z } from "zod";

// Validación del formato ObjectId de MongoDB
const objectIdSchema = z
	.string()
	.regex(/^[a-fA-F0-9]{24}$/, "El identificador no es válido.");

// Validación para crear un álbum
export const createAlbumSchema = z.object({
	title: z
		.string()
		.trim()
		.min(1, "El título del álbum es requerido.")
		.max(100, "El título no puede superar los 100 caracteres."),

	description: z
		.string()
		.trim()
		.max(500, "La descripción no puede superar los 500 caracteres.")
		.optional()
		.default(""),

	photoIds: z
		.array(objectIdSchema)
		.max(100, "Un álbum no puede contener más de 100 fotografías.")
		.optional()
		.default([]),
});

// Validación para añadir fotografías a un álbum
export const addPhotosToAlbumSchema = z.object({
	photoIds: z
		.array(objectIdSchema)
		.min(1, "Debes seleccionar al menos una fotografía.")
		.max(100, "No puedes enviar más de 100 fotografías."),
});

// Middleware reutilizable para validar álbumes
export const validateAlbum = (schema) => {
	return (req, res, next) => {
		const result = schema.safeParse(req.body);

		if (!result.success) {
			return res.status(400).json({
				message: "Los datos del álbum no son válidos.",
				errors: result.error.issues.map((issue) => ({
					field: issue.path.join("."),
					message: issue.message,
				})),
			});
		}

		// Guardar los datos validados y transformados
		req.body = result.data;

		next();
	};
};
