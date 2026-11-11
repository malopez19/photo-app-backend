import mongoose from "mongoose";

export const connectDB = async () => {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
        throw new Error("La variable MONGODB_URI no está configurada.");
    }

    mongoose.connection.on("connected", () => {
        console.log("✅ MongoDB Atlas conectado exitosamente");
    });

    mongoose.connection.on("error", (error) => {
        console.error("❌ Error de MongoDB:", error.message);
    });

    await mongoose.connect(mongoURI);
};
