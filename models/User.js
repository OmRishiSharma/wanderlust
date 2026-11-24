const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");
const { Schema } = mongoose;

const userSchema = new Schema(
    {
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        role: { type: String, enum: ["user", "admin"], default: "user" },
        favourites: [{ type: Schema.Types.ObjectId, ref: "Listing" }],
    },
    { timestamps: true }
);

userSchema.plugin(passportLocalMongoose.default || passportLocalMongoose, {
    errorMessages: {
        UserExistsError: "That username is already taken.",
        IncorrectPasswordError: "Incorrect username or password.",
        IncorrectUsernameError: "Incorrect username or password.",
    },
});

module.exports = mongoose.model("User", userSchema);
