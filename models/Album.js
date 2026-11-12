import mongoose from "mongoose";

const MAX_PHOTOS_PER_ALBUM = 100;

const albumSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 100,
		},

		description: {
			type: String,
			default: "",
			trim: true,
			maxlength: 500,
		},

		owner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},

		photos: {
			type: [
				{
					type: mongoose.Schema.Types.ObjectId,
					ref: "Media",
				},
			],
			default: [],
			validate: [
				{
					validator: (photos) => photos.length <= MAX_PHOTOS_PER_ALBUM,
					message: `Un álbum no puede superar las ${MAX_PHOTOS_PER_ALBUM} fotografías.`,
				},
				{
					validator: (photos) => {
						const ids = photos.map((photo) => photo.toString());

						return new Set(ids).size === ids.length;
					},
					message: "Un álbum no puede contener fotografías duplicadas.",
				},
			],
		},
	},
	{
		timestamps: true,
	},
);

// Optimiza la búsqueda de álbumes por usuario y fecha.
albumSchema.index({
	owner: 1,
	updatedAt: -1,
});

// Optimiza las búsquedas de álbumes por fotografía.
albumSchema.index({
	photos: 1,
});

export const Album = mongoose.model("Album", albumSchema);
