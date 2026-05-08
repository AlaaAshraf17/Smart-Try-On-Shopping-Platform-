const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const authUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            gender: user.gender,
            height: user.height,
            weight: user.weight,
            isAdmin: user.isAdmin,
            token: generateToken(user._id),
        });
    } else {
        res.status(401).send('Invalid email or password');
    }
});

const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || name.trim().length === 0) {
        res.status(400);
        throw new Error('Please add a name');
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!email || !emailRegex.test(email)) {
        res.status(400);
        throw new Error('Please add a valid email address');
    }

    if (!password || password.length < 8) {
        res.status(400);
        throw new Error('Password must be at least 8 characters long');
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    const user = await User.create({
        name,
        email,
        password,
    });

    if (user) {
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            token: generateToken(user._id),
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

const authGoogleUser = asyncHandler(async (req, res) => {
    const { idToken } = req.body;

    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const { name, email, sub: googleId } = ticket.getPayload();

        let user = await User.findOne({ email });

        if (user) {
            if (!user.googleId) {
                user.googleId = googleId;
                await user.save();
            }
        } else {
            user = await User.create({
                name,
                email,
                googleId,
                password: Math.random().toString(36).slice(-10),
                isAdmin: false,
            });
        }

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            gender: user.gender,
            height: user.height,
            weight: user.weight,
            isAdmin: user.isAdmin,
            token: generateToken(user._id),
        });
    } catch (error) {
        res.status(401).json({ message: 'Google authentication failed' });
    }
});

const getUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            gender: user.gender,
            height: user.height,
            weight: user.weight,
            isAdmin: user.isAdmin,
        });
    } else {
        res.status(404).send('User not found');
    }
});

const updateUserProfile = asyncHandler(async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.gender = req.body.gender || user.gender;
            user.height = req.body.height !== undefined ? req.body.height : user.height;
            user.weight = req.body.weight !== undefined ? req.body.weight : user.weight;

            if (req.body.password) {
                user.password = req.body.password;
            }

            console.log("Attempting to save user..")
            const updatedUser = await user.save();
            console.log("User saved successfully")

            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                gender: updatedUser.gender,
                height: updatedUser.height,
                weight: updatedUser.weight,
                isAdmin: updatedUser.isAdmin,
                token: generateToken(updatedUser._id),
            });
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (err){
        console.error("Error");
        console.error(err.message);
        console.error(err.stack);
        res.status(500).json({message: err.message});
    }
});

const getUsers = asyncHandler(async (req, res) => {
    const users = await User.find({});
    res.json(users);
});

const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (user) {
        await user.deleteOne();
        res.json({ message: 'User removed' });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

const deleteUserProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        await user.deleteOne();
        res.json({ message: 'User deleted successfully' });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

module.exports = { authUser, registerUser, getUserProfile, updateUserProfile, getUsers, deleteUser, deleteUserProfile, authGoogleUser };