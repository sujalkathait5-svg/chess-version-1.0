// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  let token = req.cookies && req.cookies.kg_access_token;
  
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_signkey_production');
    req.user = {
      id: decoded.userId || decoded.id,
      userId: decoded.userId || decoded.id,
      ...decoded
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authorization token' });
  }
};

module.exports = authMiddleware;
// 
