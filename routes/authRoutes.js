import { Router } from "express";

import { register, login, getMe } from "../controllers/authController.js";

import { requireAuth } from "../middleware/auth.js";

import {
	registerSchema,
	loginSchema,
	validateAuth,
} from "../validators/authValidator.js";

const router = Router();

// Registro
router.post("/register", validateAuth(registerSchema), register);

// Inicio de sesión
router.post("/login", validateAuth(loginSchema), login);

// Obtener usuario autenticado
router.get("/me", requireAuth, getMe);

export default router;
