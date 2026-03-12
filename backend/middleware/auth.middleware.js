import { ACCESS_COOKIE_NAME, verifyJwt } from "../lib/auth.js";

const authMiddleware = (req, res, next) => {
    const authHeader = req.header("Authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    const cookieToken = req.cookies?.[ACCESS_COOKIE_NAME];
    const token = bearerToken || cookieToken;

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const decoded = verifyJwt(token);
        req.user = { id: decoded.id };
        next();
    } catch (err) {
        res.status(401).json({ message: "Invalid token" });
    }
};

export default authMiddleware;
