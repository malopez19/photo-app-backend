
import jwt from "jsonwebtoken";

export const requireAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                message: "Acceso no autorizado. Token requerido.",
            });
        }

        const match = authHeader.match(/^Bearer\s+(\S+)$/i);

        if (!match) {
            return res.status(401).json({
                message: "Formato de token inválido.",
            });
        }

        const secret = process.env.JWT_SECRET;

        if (!secret) {
            console.error("JWT_SECRET no está configurado.");

            return res.status(500).json({
                message: "Error de configuración del servidor.",
            });
        }

        const decoded = jwt.verify(match[1], secret, {
            algorithms: ["HS256"],
        });

        req.user = decoded;

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Token inválido o expirado.",
        });
    }
};
