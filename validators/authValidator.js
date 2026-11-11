
import { z } from "zod";

// Validación para registrar usuarios
export const registerSchema = z.object({
    name: z
        .string({
            required_error: "El nombre es requerido.",
            invalid_type_error: "El nombre debe ser un texto.",
        })
        .trim()
        .min(2, "El nombre debe tener al menos 2 caracteres.")
        .max(80, "El nombre no puede superar los 80 caracteres."),

    email: z
        .string({
            required_error: "El correo electrónico es requerido.",
            invalid_type_error: "El correo debe ser un texto.",
        })
        .trim()
        .toLowerCase()
        .email("El correo electrónico no es válido.")
        .max(254, "El correo no puede superar los 254 caracteres."),

    password: z
        .string({
            required_error: "La contraseña es requerida.",
            invalid_type_error: "La contraseña debe ser un texto.",
        })
        .min(8, "La contraseña debe tener al menos 8 caracteres.")
        .refine(
            (value) => Buffer.byteLength(value, "utf8") <= 72,
            "La contraseña no puede superar los 72 bytes."
        ),
});

// Validación para iniciar sesión
export const loginSchema = z.object({
    email: z
        .string({
            required_error: "El correo electrónico es requerido.",
            invalid_type_error: "El correo debe ser un texto.",
        })
        .trim()
        .toLowerCase()
        .email("El correo electrónico no es válido.")
        .max(254, "El correo no puede superar los 254 caracteres."),

    password: z
        .string({
            required_error: "La contraseña es requerida.",
            invalid_type_error: "La contraseña debe ser un texto.",
        })
        .min(1, "La contraseña es requerida.")
        .refine(
            (value) => Buffer.byteLength(value, "utf8") <= 72,
            "La contraseña no es válida."
        ),
});

// Middleware reutilizable para validar peticiones
export const validateAuth = (schema) => {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                message: "Los datos enviados no son válidos.",
                errors: result.error.issues.map((issue) => ({
                    field: issue.path.join("."),
                    message: issue.message,
                })),
            });
        }

        // Guardamos los datos validados y transformados
        req.body = result.data;

        next();
    };
};
