import * as authService from "../services/authService.js";

const cookieOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "lax",
	path: "/",
};

const setAuthCookie = (res, token) => {
	res.cookie("token", token, cookieOptions);
};

export const register = async (req, res) => {
	const result = await authService.registerUser(req.body ?? {});

	setAuthCookie(res, result.token);

	return res.status(201).json({
		user: result.user,
		message: "Registro exitoso.",
	});
};

export const login = async (req, res) => {
	const result = await authService.loginUser(req.body ?? {});

	setAuthCookie(res, result.token);

	return res.status(200).json({
		user: result.user,
		message: "Inicio de sesión exitoso.",
	});
};

export const getMe = async (req, res) => {
	const user = await authService.getAuthenticatedUser(req.user.id);

	return res.status(200).json({ user });
};

export const logout = (req, res) => {
	res.clearCookie("token", cookieOptions);

	return res.status(200).json({
		message: "Sesión cerrada correctamente.",
	});
};
