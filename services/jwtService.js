const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabaseClient');

class JWTService {
  constructor() {
    // Try different JWT secret sources in order of preference
    this.jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
    this.accessTokenExpiry = process.env.JWT_EXPIRES_IN || '1h';
    this.refreshTokenExpiry = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
    
    // If no JWT secret is provided, generate a secure one for this session
    // This is not ideal for production but prevents the app from crashing
    if (!this.jwtSecret) {
      console.warn('⚠️  No JWT_SECRET or SUPABASE_JWT_SECRET environment variable found. Generating a session secret.');
      console.warn('⚠️  This is not recommended for production. Please set JWT_SECRET or SUPABASE_JWT_SECRET in your environment.');
      this.jwtSecret = require('crypto').randomBytes(64).toString('hex');
    }
  }

  // Generate access and refresh tokens
  generateTokens(userId, email, userMetadata = {}) {
    const now = Math.floor(Date.now() / 1000);
    
    // Access token payload
    const accessTokenPayload = {
      sub: userId,
      email,
      aud: 'authenticated',
      role: 'authenticated',
      user_metadata: userMetadata,
      iat: now,
      exp: now + this.getExpiryInSeconds(this.accessTokenExpiry)
    };

    // Refresh token payload
    const refreshTokenPayload = {
      sub: userId,
      type: 'refresh',
      aud: 'authenticated',
      iat: now,
      exp: now + this.getExpiryInSeconds(this.refreshTokenExpiry)
    };

    const accessToken = jwt.sign(accessTokenPayload, this.jwtSecret, {
      algorithm: 'HS256'
    });

    const refreshToken = jwt.sign(refreshTokenPayload, this.jwtSecret, {
      algorithm: 'HS256'
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getExpiryInSeconds(this.accessTokenExpiry),
      tokenType: 'Bearer'
    };
  }

  // Verify JWT token
  verifyToken(token, tokenType = 'access') {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256']
      });

      // Check if it's a refresh token when expected
      if (tokenType === 'refresh' && decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Check if it's not a refresh token when access token expected
      if (tokenType === 'access' && decoded.type === 'refresh') {
        throw new Error('Invalid token type');
      }

      return {
        valid: true,
        payload: decoded
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  // Store refresh token in database
  async storeRefreshToken(userId, refreshToken, clientIP, userAgent) {
    try {
      const decoded = this.verifyToken(refreshToken, 'refresh');
      if (!decoded.valid) {
        throw new Error('Invalid refresh token');
      }

      const expiresAt = new Date(decoded.payload.exp * 1000);

      await supabaseAdmin.from('user_sessions').insert({
        user_id: userId,
        refresh_token: refreshToken,
        ip_address: clientIP,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Failed to store refresh token:', error);
      return false;
    }
  }

  // Validate and get refresh token from database
  async validateRefreshToken(refreshToken) {
    try {
      // First verify the token signature
      const decoded = this.verifyToken(refreshToken, 'refresh');
      if (!decoded.valid) {
        return { valid: false, error: 'Invalid token signature' };
      }

      // Check if token exists in database and is not expired
      const { data: sessionData, error } = await supabaseAdmin
        .from('user_sessions')
        .select('user_id, expires_at')
        .eq('refresh_token', refreshToken)
        .single();

      if (error || !sessionData) {
        return { valid: false, error: 'Token not found in database' };
      }

      // Check if token is expired
      if (new Date(sessionData.expires_at) < new Date()) {
        // Clean up expired token
        await this.revokeRefreshToken(refreshToken);
        return { valid: false, error: 'Token expired' };
      }

      return {
        valid: true,
        userId: sessionData.user_id,
        payload: decoded.payload
      };
    } catch (error) {
      console.error('Refresh token validation error:', error);
      return { valid: false, error: 'Token validation failed' };
    }
  }

  // Revoke refresh token
  async revokeRefreshToken(refreshToken) {
    try {
      await supabaseAdmin
        .from('user_sessions')
        .delete()
        .eq('refresh_token', refreshToken);
      
      return true;
    } catch (error) {
      console.error('Failed to revoke refresh token:', error);
      return false;
    }
  }

  // Revoke all user sessions
  async revokeAllUserSessions(userId) {
    try {
      await supabaseAdmin
        .from('user_sessions')
        .delete()
        .eq('user_id', userId);
      
      return true;
    } catch (error) {
      console.error('Failed to revoke all user sessions:', error);
      return false;
    }
  }

  // Clean expired tokens (should be run periodically)
  async cleanExpiredTokens() {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_sessions')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('Failed to clean expired tokens:', error);
        return false;
      }

      console.log(`Cleaned ${data?.length || 0} expired tokens`);
      return true;
    } catch (error) {
      console.error('Clean expired tokens error:', error);
      return false;
    }
  }

  // Get user active sessions
  async getUserSessions(userId) {
    try {
      const { data: sessions, error } = await supabaseAdmin
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to get user sessions:', error);
        return [];
      }

      return sessions.map(session => ({
        id: session.id,
        ip_address: session.ip_address,
        user_agent: session.user_agent,
        created_at: session.created_at,
        expires_at: session.expires_at,
        is_current: false // This would need to be determined by comparing with current token
      }));
    } catch (error) {
      console.error('Get user sessions error:', error);
      return [];
    }
  }

  // Convert expiry string to seconds
  getExpiryInSeconds(expiry) {
    const units = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
      'w': 604800
    };

    const match = expiry.match(/^(\d+)([smhdw])$/);
    if (!match) {
      throw new Error('Invalid expiry format. Use format like "1h", "30m", "7d"');
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  // Generate API key for service-to-service communication
  generateAPIKey(userId, serviceName, expiresIn = '1y') {
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      sub: userId,
      service: serviceName,
      type: 'api_key',
      iat: now,
      exp: now + this.getExpiryInSeconds(expiresIn)
    };

    return jwt.sign(payload, this.jwtSecret, {
      algorithm: 'HS256'
    });
  }

  // Verify API key
  verifyAPIKey(apiKey) {
    try {
      const decoded = jwt.verify(apiKey, this.jwtSecret, {
        algorithms: ['HS256']
      });

      if (decoded.type !== 'api_key') {
        throw new Error('Invalid API key type');
      }

      return {
        valid: true,
        payload: decoded
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = new JWTService();
