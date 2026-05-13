const { Client, handle_file } = require("@gradio/client");
const TryOn = require('../models/TryOn');
const User = require('../models/User')
const cloudinary = require('../config/cloudinary');
const sharp = require("sharp");

const preprocessPerson = async (imageUrl) => {
    const response = await fetch(imageUrl);
    const buffer   = Buffer.from(await response.arrayBuffer());

    const processed = await sharp(buffer)
        .resize(768, 1024, {
            fit: "contain",
            position: "center",
            // background: { r: 240, g: 240, b: 240 }
        })
        .jpeg({ quality: 95 })
        .toBuffer();

    return `data:image/jpeg;base64,${processed.toString("base64")}`;
};

const preprocessGarment = async (imageUrl) => {
    const response = await fetch(imageUrl);
    const buffer   = Buffer.from(await response.arrayBuffer());

    const processed = await sharp(buffer)
        .resize(768, 1024, {
            fit: "contain",
            position: "center",
            // background: { r: 255, g: 255, b: 255 }
        })
        .jpeg({ quality: 95 })
        .toBuffer();

    return `data:image/jpeg;base64,${processed.toString("base64")}`;
};

const wakeUpSpace = async (spaceId, maxWaitMs = 120_000, pollMs = 8_000) => {
    const [owner, spaceName] = spaceId.split("/");
    const statusUrl = `https://huggingface.co/api/spaces/${owner}/${spaceName}/runtime`;
    const wakeUrl   = `https://huggingface.co/api/spaces/${owner}/${spaceName}/restart`;
    const deadline  = Date.now() + maxWaitMs;

    console.log(`Checking Space runtime: ${spaceId}`);

    try {
        await fetch(wakeUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json"
            }
        });
        console.log("Wake-up signal sent.");
    } catch (_) {
        console.log("Wake-up signal failed (may not be needed).");
    }

    while (Date.now() < deadline) {
        try {
            const res  = await fetch(statusUrl, {
                headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` }
            });
            const json = await res.json();

            console.log(`Space stage: ${json?.stage}`);

            if (json?.stage === "RUNNING") {
                console.log("Space is RUNNING!");
                return true;
            }

            if (["STOPPED", "DELETING", "BUILD_ERROR", "RUNTIME_ERROR"].includes(json?.stage)) {
                throw new Error(`Space is in unrecoverable state: ${json.stage}`);
            }

        } catch (err) {
            if (err.message.includes("unrecoverable")) throw err;
            console.log(`Status check failed: ${err.message}`);
        }

        await new Promise(r => setTimeout(r, pollMs));
    }

    throw new Error(`Space ${spaceId} did not reach RUNNING state within ${maxWaitMs / 1000}s`);
};

const generateTryOn = async (req, res) => {
    const { personImage, garmentImage, description, roomId } = req.body;
    const SPACE_ID = "Kwai-Kolors/Kolors-Virtual-Try-On";
    const SEEDS  = [42, 123, 7];

    try {
        if (global.io) {
            global.activeRequests = (global.activeRequests || 0) + 1;
            global.io.emit("admin:updateAnalytics", {
                type: "NEW_REQUEST",
                queueLength: global.activeRequests
            });
        }

        const user = await User.findById(req.user._id);
        if (!user.height || !user.weight) {
            if (global.io) global.activeRequests--;
            return res.status(400).json({
                success: false,
                message: "Profile Incomplete",
                error: "Please enter your height and weight in your profile."
            });
        }

        // إبلاغ الأدمن إن المعالجة بدأت فعلياً
        if (global.io) {
            global.io.emit("admin:updateAnalytics", {
                type: "TRYON_STARTED",
                user: user.name
            });
        }

        console.log("Preprocessing images...");
        const [processedPerson, processedGarment] = await Promise.all([
            preprocessPerson(personImage),
            preprocessGarment(garmentImage)
        ]);

        console.log("Uploading images to Cloudinary...");
        const [personUpload, garmentUpload] = await Promise.all([
            cloudinary.uploader.upload(processedPerson, { folder: "fitme/people" }),
            cloudinary.uploader.upload(processedGarment, { folder: "fitme/garments" })
        ]);

        await wakeUpSpace(SPACE_ID);

        console.log("Connecting to AI Engine...");
        const app = await Client.connect(SPACE_ID, { token: process.env.HF_TOKEN });

        let bestResultData = null;
        for (const seed of SEEDS) {
            try {
                console.log(`Trying seed ${seed}...`);
                const result = await app.predict(2, [
                    handle_file(personUpload.secure_url),
                    handle_file(garmentUpload.secure_url),
                    seed,
                    false
                ]);

                console.log(`Seed ${seed} status: ${result.data[2]}`);

                if (result.data[0]?.url) {
                    bestResultData = result.data[0];
                    console.log(`Using seed ${seed}`);
                    break;
                }
            } catch (err) {
                console.log(`Seed ${seed} failed: ${err.message} — trying next...`);
            }
        }

        if (!bestResultData) throw new Error("All seeds failed to produce a result");
        const imageResponse = await fetch(bestResultData.url, {
            headers: { Authorization: `Bearer ${process.env.HF_TOKEN}` }
        });
        if (!imageResponse.ok) {
            throw new Error(`Failed to fetch result image: ${imageResponse.status}`);
        }
        const dataUri = `data:image/webp;base64,${Buffer.from(await imageResponse.arrayBuffer()).toString("base64")}`;
        const finalResultUpload = await cloudinary.uploader.upload(dataUri, {
            folder: "fitme/results"
        });

        const newTryOn = await TryOn.create({
            user: req.user._id,
            resultImage: finalResultUpload.secure_url,
            personImage: personUpload.secure_url,
            personImageId: personUpload.public_id,
            garmentImage: garmentUpload.secure_url,
            garmentImageId: garmentUpload.public_id,
            resultImageId: finalResultUpload.public_id,
            description
        });

        if (global.io) {
            if (roomId) {
                global.io.to(roomId).emit("tryOnCompleted", {
                    resultImage: finalResultUpload.secure_url,
                    byUser: user.name
                });
            } else {
                global.io.emit("tryOnCompleted", { resultImage: finalResultUpload.secure_url });
            }
            global.activeRequests = Math.max(0, global.activeRequests - 1);
            global.io.emit("admin:updateAnalytics", {
                type: "TRYON_SUCCESS",
                queueLength: global.activeRequests,
                totalTryOns: 1
            });
        }

        res.status(200).json(newTryOn);

    } catch (error) {
        console.error("TryOn Error:", error);

        if (global.io) {
            global.activeRequests = Math.max(0, (global.activeRequests || 1) - 1);
            global.io.emit("admin:updateAnalytics", {
                type: "TRYON_ERROR",
                queueLength: global.activeRequests
            });

            global.io.emit("admin:errorAlert", {
                user: req.user ? req.user.name : "Unknown",
                error: error.message,
                time: new Date()
            });
        }

        res.status(500).json({ message: "AI Processing Failed", error: error.message });
    }
};

const getTryOnHistory = async (req, res) => {
    try {
        const history = await TryOn.find({ user: req.user._id }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: history.length,
            data: history
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch history", error: error.message });
    }
};

const deleteTryOn = async (req, res) => {
    try {
        const tryOn = await TryOn.findById(req.params.id);
        if (!tryOn) return res.status(404).json({message: "Record not found"});
        if (tryOn.user.toString() !== req.user._id.toString()) {
            return res.status(401).json({message: "Not authorized"});
        }
        if (tryOn.personImageId) {
            await cloudinary.uploader.destroy(tryOn.personImageId);
        }
        if (tryOn.garmentImageId) {
            await cloudinary.uploader.destroy(tryOn.garmentImageId);
        }

        const idsToDelete = [tryOn.personImageId, tryOn.garmentImageId, tryOn.resultImageId].filter(id => id);
        if (idsToDelete.length > 0) {
            await cloudinary.api.delete_resources(idsToDelete);
        }

        await tryOn.deleteOne();
        res.status(200).json({success: true, message: "History and all cloud assets deleted"});
    } catch (error) {
        res.status(500).json({message: "Server Error", error: error.message});
    }
};

module.exports = { generateTryOn, getTryOnHistory, deleteTryOn };