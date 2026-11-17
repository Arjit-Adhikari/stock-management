
const bcrypt = require("bcryptjs");

async function hashPassword(password) {
    return await bcrypt.hash(password, 12);
}

async function verifyPassword(password, passwordHash) {
    return await bcrypt.compare(password, passwordHash);
}

module.exports = {
    hashPassword,
    verifyPassword
};
