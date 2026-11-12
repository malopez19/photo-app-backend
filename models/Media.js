import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
			maxlength: 150,
		},

		url: {
			type: String,
			required: true,
		},

		thumbnailUrl: {
			type: String,
			default: "",
		},

		fileId: {
			type: String,
			default: "",
		},

		size: {
			type: Number,
			default: 0,
			min: 0,
		},

		format: {
			type: String,
			default: "jpg",
			lowercase: true,
			trim: true,
		},

		mediaType: {
			type: String,
			enum: ["image", "video"],
			default: "image",
		},

		duration: {
			type: Number,
			default: 0,
			min: 0,
		},

		width: {
			type: Number,
			default: 1200,
			min: 0,
		},

		height: {
			type: Number,
			default: 800,
			min: 0,
		},

		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},

		isFavorite: {
			type: Boolean,
			default: false,
		},

		isTrash: {
			type: Boolean,
			default: false,
		},

		trashedAt: {
			type: Date,
			default: null,
		},

		objects: {
			type: [String],
			default: [],
		},
		deletionStatus: {
			type: String,
			enum: ["active", "pending"],
			default: "active",
		},

		deletionStartedAt: {
			type: Date,
			default: null,
		},

		fileDeletedAt: {
			type: Date,
			default: null,
		},
	},
	{
		timestamps: true,
	},
);

// Búsqueda de texto en títulos y objetos.
mediaSchema.index({
	title: "text",
	objects: "text",
});

// Índice para consultas habituales de cada usuario.
mediaSchema.index({
	owner: 1,
	isTrash: 1,
	createdAt: -1,
});

// Índice para filtrar favoritos y tipos de archivos.
mediaSchema.index({
	owner: 1,
	isTrash: 1,
	isFavorite: 1,
	mediaType: 1,
});

export const Media = mongoose.model("Media", mediaSchema);
