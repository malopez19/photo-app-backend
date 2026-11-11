
import * as authService from "../services/authService.js";

export const register = async (req, res) => {
    const result = await authService.registerUser(
        req.body ?? {}
    );

    return res.status(201).json(result);
};

export const login = async (req, res) => {
    const result = await authService.loginUser(
        req.body ?? {}
    );

    return res.status(200).json(result);
};

export const getMe = async (req, res) => {
    const user = await authService.getAuthenticatedUser(
        req.user.id
    );

    return res.status(200).json({ user });
};
