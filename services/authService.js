
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

const createError = (message, statusCode) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const isValidEmail = (email) => {
    return (
        email.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    );
};

const signToken = (user) => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw createError(
            "La configuración de autenticación no está disponible.",
            500
        );
    }

    return jwt.sign(
        { id: user._id.toString() },
        secret,
        {
            expiresIn: "1d",
            algorithm: "HS256",
        }
    );
};

const getPublicUser = (user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
});

export const registerUser = async ({ name, email, password }) => {
    // Validar tipos
    if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string"
    ) {
        throw createError("Los datos enviados no son válidos.", 400);
    }

    const normalizedName = name.trim();
    const normalizedEmail = normalizeEmail(email);

    // Validar nombre
    if (normalizedName.length < 2 || normalizedName.length > 80) {
        throw createError(
            "El nombre debe tener entre 2 y 80 caracteres.",
            400
        );
    }

    // Validar correo
    if (!isValidEmail(normalizedEmail)) {
        throw createError("El correo electrónico no es válido.", 400);
    }

    // Validar contraseña
    if (
        password.length < 8 ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        throw createError(
            "La contraseña debe tener al menos 8 caracteres y no superar 72 bytes.",
            400
        );
    }

    // Comprobar si el usuario ya existe
    const existingUser = await User.findOne({
        email: normalizedEmail,
    });

    if (existingUser) {
        throw createError(
            "Ya existe una cuenta vinculada a este email.",
            409
        );
    }

    // Cifrar contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    try {
        const user = await User.create({
            name: normalizedName,
            email: normalizedEmail,
            password: hashedPassword,
        });

        const token = signToken(user);

        return {
            token,
            user: getPublicUser(user),
        };
    } catch (error) {
        // Protección ante registros simultáneos con el mismo email
        if (error.code === 11000) {
            throw createError(
                "Ya existe una cuenta vinculada a este email.",
                409
            );
        }

        throw error;
    }
};

export const loginUser = async ({ email, password }) => {
    if (
        typeof email !== "string" ||
        typeof password !== "string" ||
        !email.trim() ||
        !password
    ) {
        throw createError(
            "Email y contraseña son requeridos.",
            400
        );
    }

    const normalizedEmail = normalizeEmail(email);

    if (
        normalizedEmail.length > 254 ||
        Buffer.byteLength(password, "utf8") > 72
    ) {
        throw createError("Credenciales inválidas.", 401);
    }

    const user = await User.findOne({
        email: normalizedEmail,
    }).select("+password");

    if (!user) {
        throw createError("Credenciales inválidas.", 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        throw createError("Credenciales inválidas.", 401);
    }

    const token = signToken(user);

    return {
        token,
        user: getPublicUser(user),
    };
};

export const getAuthenticatedUser = async (userId) => {
    const user = await User.findById(userId)
        .select("_id name email createdAt updatedAt")
        .lean();

    if (!user) {
        throw createError("Usuario no encontrado.", 404);
    }

    return user;
};
