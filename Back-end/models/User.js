const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
    name: { type: String, required: [true, 'Please add a name'] },
    email: { type: String, required: [true, 'Please add an email'], unique: true, match: [/^\S+@\S+\.\S+$/, 'Please add a valid email'] },
    password: { type: String, required: [true, 'Please add a password'], minlength: [8, 'Password must be at least 8 characters'] },
    googleId: {type: String, unique: true, sparse: true,},
    isAdmin: { type: Boolean, default: false, required: true },

    avatarImage: {
        type: String,
        default: "" // URL
    },
    gender: {
        type: String,
        enum: ['Male', 'Female'],
        default: 'Male'
    },
    height: { type: Number, default: 0 }, // in cm
    weight: { type: Number, default: 0 }, // in kg

    phoneNumber: { type: String },
    address: {
        street: { type: String },
        city: { type: String },
        country: { type: String },
        zipCode: { type: String }
    },

    wishlist: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        }
    ]
}, {
    timestamps: true
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

module.exports = User;