import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";

import { connectDB } from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import mediaRoutes from "./routes/mediaRoutes.js";
import albumRoutes from "./routes/albumRoutes.js";

import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

// Middlewares generales
app.use(
	cors({
		origin: process.env.CLIENT_URL || "http://localhost:5173",
		credentials: true,
	}),
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Ruta principal
app.get("/", (req, res) => {
	res.send("Servidor MERN MyPhotos está activo y ejecutándose 🚀");
});

// Rutas de la API
app.use("/api/auth", authRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/albums", albumRoutes);

// Manejo de rutas inexistentes
app.use(notFound);

// Manejo centralizado de errores
app.use(errorHandler);

// Iniciar servidor después de conectar MongoDB
const PORT = process.env.PORT || 3000;

const startServer = async () => {
	try {
		await connectDB();

		app.listen(PORT, () => {
			console.log(`Servidor ejecutándose en el puerto ${PORT}`);
		});
	} catch (error) {
		console.error("No se pudo iniciar el servidor:", error);
		process.exit(1);
	}
};

startServer();
