import { z } from "zod";

// Validar ObjectId de MongoDB.
const objectIdSchema = z
	.string()
	.regex(/^[a-fA-F0-9]{24}$/, "El ID del medio no es válido.");

// Validar números recibidos como parámetros de URL.
const paginationNumberSchema = (
	defaultValue,
	maxValue = Number.MAX_SAFE_INTEGER,
) =>
	z
		.string()
		.regex(/^\d+$/, "Debe ser un número entero positivo.")
		.transform(Number)
		.pipe(
			z
				.number()
				.int()
				.min(1, "El valor mínimo permitido es 1.")
				.max(maxValue, `El valor máximo permitido es ${maxValue}.`),
		)
		.optional()
		.transform((value) => value ?? defaultValue);

// GET /media
export const getMediaSchema = z.object({
	favorite: z.enum(["true", "false"]).optional(),

	type: z.enum(["image", "video"]).optional(),

	query: z
		.string()
		.trim()
		.max(100, "La búsqueda no puede superar los 100 caracteres.")
		.optional(),

	page: paginationNumberSchema(1),

	limit: paginationNumberSchema(20, 50),
});

// PATCH /media/:id/favorite
// PATCH /media/:id/trash
// DELETE /media/:id
export const mediaIdSchema = z.object({
	id: objectIdSchema,
});

// PATCH /media/:id/trash
export const toggleTrashSchema = z.object({
	restore: z.boolean({
		message: "El campo restore debe ser booleano.",
	}),
});

// Middleware general para validar solicitudes.
export const validateMedia = (schema, source = "body") => {
	return (req, res, next) => {
		const result = schema.safeParse(req[source]);

		if (!result.success) {
			return res.status(400).json({
				message: "Los datos de la solicitud no son válidos.",
				errors: result.error.issues.map((issue) => ({
					field: issue.path.join("."),
					message: issue.message,
				})),
			});
		}

		const target = source === "query" ? "validatedQuery" : source;

		req[target] = result.data;

		next();
	};
};
