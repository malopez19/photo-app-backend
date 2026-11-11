import mongoose from "mongoose";

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
        },

        photos: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Media",
            },
        ],
    },
    { timestamps: true }
);

// Optimiza la búsqueda de álbumes por usuario y fecha.
albumSchema.index({ owner: 1, updatedAt: -1 });

// Optimiza búsquedas de álbumes que contienen una foto.
albumSchema.index({ photos: 1 });

export const Album = mongoose.model("Album", albumSchema);
