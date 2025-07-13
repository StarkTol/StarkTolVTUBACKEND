const { generateResponse } = require('../utils/helpers');

const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json(generateResponse(false, 'Authentication required'));
            }

            const userRole = req.user.role;

            if (!allowedRoles.includes(userRole)) {
                return res.status(403).json(generateResponse(false, 'Insufficient permissions'));
            }

            next();
        } catch (error) {
            console.error('Role middleware error:', error);
            return res.status(500).json(generateResponse(false, 'Authorization failed'));
        }
    };
};

module.exports = roleMiddleware;
