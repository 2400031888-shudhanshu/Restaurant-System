// Central place for required configuration.
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 16 || secret === "replace_with_a_long_random_secret") {
        throw new Error(
            "JWT_SECRET is missing or too weak. Set a random value of 16+ characters in backend/.env " +
            "(generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\")."
        );
    }
    return secret;
}

module.exports = { getJwtSecret };
