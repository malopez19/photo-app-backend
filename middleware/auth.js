import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export const requireAuth = (req, res, next) => {
	const token = req.cookies?.token;

	if (!token) {
		return res.status(401).json({
			message: "Acceso no autorizado. Sesión no encontrada.",
		});
	}

	const secret = process.env.JWT_SECRET;

	if (!secret) {
		console.error("JWT_SECRET no está configurado.");

		return res.status(500).json({
			message: "Error de configuración del servidor.",
		});
	}

	try {
		const decoded = jwt.verify(token, secret, {
			algorithms: ["HS256"],
		});

		if (
			!decoded ||
			typeof decoded !== "object" ||
			typeof decoded.id !== "string" ||
			!mongoose.isObjectIdOrHexString(decoded.id)
		) {
			return res.status(401).json({
				message: "Sesión inválida.",
			});
		}

		req.user = {
			...decoded,
			id: decoded.id,
		};

		return next();
	} catch {
		return res.status(401).json({
			message: "Sesión inválida o expirada.",
		});
	}
};
