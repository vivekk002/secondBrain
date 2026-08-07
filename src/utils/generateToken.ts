import jwt, { SignOptions } from "jsonwebtoken";

// Access token secret from the env file
const accessSecret: string = (() => {
    if (!process.env.JWT_ACCESS_SECRET) {
        throw new Error("Missing JWT_ACCESS_SECRET");
    }

    return process.env.JWT_ACCESS_SECRET;
})();


// Refresh token secret from the env file
const refreshSecret: string = (() => {
    if (!process.env.JWT_REFRESH_SECRET) {
        throw new Error("Missing JWT_REFRESH_SECRET");
    }

    return process.env.JWT_REFRESH_SECRET;
})();

// Access token expiry from the env file
const accessTokenExpiry: SignOptions["expiresIn"] = (() => {
    if (!process.env.ACCESS_TOKEN_EXPIRY) {
        throw new Error("Missing Access token expiry")
    }
    return process.env.ACCESS_TOKEN_EXPIRY as SignOptions["expiresIn"]
})();
// Access token expiry from the env file
const refreshTokenExpiry: SignOptions["expiresIn"] = (() => {
    if (!process.env.REFRESH_TOKEN_EXPIRY) {
        throw new Error("Missing Refresh token expiry")
    }
    return process.env.REFRESH_TOKEN_EXPIRY as SignOptions["expiresIn"]
})();




export function generateAccessToken(userId: string): string {
    return jwt.sign(
        { sub: userId, type: 'access' },
        accessSecret,
        { expiresIn: accessTokenExpiry }
    );
}


export function generateRefreshToken(userId: string): string {
    return jwt.sign(
        {
            sub: userId, type: "refresh"
        },
        refreshSecret,
        { expiresIn: refreshTokenExpiry }
    )
}

export function verifyRefreshToken(token: string): { sub: string; type: string } {
    return jwt.verify(token, refreshSecret) as { sub: string; type: string };
}
