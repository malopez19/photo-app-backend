export const notFound = (req, res, next) => {
	const error = new Error(
		`Ruta no encontrada: ${req.method} ${req.originalUrl}`,
	);

	error.statusCode = 404;

	next(error);
};

export const errorHandler = (error, req, res, next) => {
	// Si la respuesta ya comenzó, delegamos el error a Express.
	if (res.headersSent) {
		return next(error);
	}

	let statusCode = error.statusCode || error.status || 500;
	let message = error.message || "Error interno del servidor.";
	let errors;

	// Error de validación de Zod
	if (error.name === "ZodError") {
		statusCode = 400;
		message = "Los datos enviados no son válidos.";

		errors = error.issues?.map((issue) => ({
			field: issue.path.join("."),
			message: issue.message,
		}));
	}

	// Error de validación de Mongoose
	if (error.name === "ValidationError") {
		statusCode = 400;
		message = "Los datos del documento no son válidos.";

		errors = Object.values(error.errors || {}).map((item) => ({
			field: item.path,
			message: item.message,
		}));
	}

	// ID de MongoDB inválido
	if (error.name === "CastError") {
		statusCode = 400;
		message = "El identificador enviado no es válido.";
	}

	// Correo u otro campo duplicado
	if (error.code === 11000) {
		statusCode = 409;
		message = "Ya existe un registro con esos datos.";
	}

	// Errores de Multer
	if (error.name === "MulterError") {
		statusCode = 400;

		if (error.code === "LIMIT_FILE_SIZE") {
			statusCode = 413;
			message = "El archivo supera el tamaño máximo permitido.";
		} else if (error.code === "LIMIT_FILE_COUNT") {
			message = "Se superó el número máximo de archivos.";
		} else if (error.code === "LIMIT_UNEXPECTED_FILE") {
			message = "Se recibió un campo de archivo inesperado.";
		} else {
			message = "Error al procesar los archivos enviados.";
		}
	}

	// JSON mal formado en el cuerpo de la petición
	if (error.type === "entity.parse.failed" && error.status === 400) {
		statusCode = 400;
		message = "El JSON enviado no tiene un formato válido.";
	}

	// Evitar enviar errores internos al cliente
	if (statusCode >= 500) {
		console.error("Error interno:", error);

		message = "Error interno del servidor.";
	}

	const response = { message };

	if (errors) {
		response.errors = errors;
	}

	if (Number.isInteger(error.deletedCount)) {
		response.deletedCount = error.deletedCount;
	}

	return res.status(statusCode).json(response);
};
