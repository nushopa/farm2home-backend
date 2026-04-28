const requireRole = (...allowedRoles) => (req, res, next) => {
    if (!req.role || !allowedRoles.includes(req.role)) {
        return res.status(403).json({
            success: false,
            message: "Forbidden - You do not have access to this resource"
        });
    }
    next();
};

module.exports = requireRole;