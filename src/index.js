require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());

// Enable CORS with specific configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://gateway-dawn-wildflower-3519.fly.dev'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Access-Control-Allow-Origin']
}));

const PORT = process.env.PORT || 3001;
const KEYCLOAK_URL = process.env.KEYCLOAK_SERVER_URL;
const REALM = process.env.KEYCLOAK_REALM_NAME;
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID;
const CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET;

app.get('/api/auth', async (req, res) => {
  return res.json({
    status: 200,
    message: 'Everything is good!'
  })
});

// Token verification endpoint
app.get('/api/auth/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];

  try {
     /**
     * please make a request to get data from userinfo endpoint
     */
    const userInfoResponse = await axios.get(
      `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/userinfo`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (!userInfoResponse.data) {
      return res.status(401).json({
        valid: false,
        error: 'User info not found'
      });
    }

    return res.json({
      valid: true,
      user: {
        firstName: userInfoResponse.data.given_name,
        lastName: userInfoResponse.data.family_name,
        email: userInfoResponse.data.email,
        username: userInfoResponse.data.preferred_username,
        sub: userInfoResponse.data.sub,
        email_verified: userInfoResponse.data.email_verified,
      }
    });
  } catch (error) {
    console.error('Token verification error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    return res.status(401).json({ 
      valid: false,
      error: 'Invalid token',
      details: error.response?.data || error.message
    });
  }
});

app.post('/api/auth/login', async (req, res) => {  
  const { username, password } = req.body;
  console.log('Username:', username);
  if (!username || !password) {
    console.log('Missing credentials');
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    console.log('Attempting to get token from Keycloak:', {
      url: `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
      clientId: CLIENT_ID,
      realm: REALM,
      client_secret: CLIENT_SECRET,
    });

    const response = await axios.post(
      `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        username,
        password,
        grant_type: 'password',
        scope: 'openid profile email'
      }),
      { 
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return res.json({
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
      token_type: response.data.token_type,
    });
  } catch (error) {
    console.error('Token request error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    if (error.response?.status === 401) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    return res.status(500).json({ 
      error: 'Authentication failed',
      details: error.response?.data || error.message
    });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { firstName, username, lastName, password, email } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const tokenResponse = await axios.post(
      `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: process.env.KEYCLOAK_ADMIN_USERNAME,
        password: process.env.KEYCLOAK_ADMIN_PASSWORD,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const adminToken = tokenResponse.data.access_token;

    // Create user
    const createUserResponse = await axios.post(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
      {
        enabled: true,
        username,
        email,
        firstName,
        lastName,
        enabled: true,
        emailVerified: true,
        credentials: [
          {
            type: 'password',
            value: password,
            temporary: false,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (createUserResponse.status === 201) {
      return res.status(201).json({ message: 'User registered successfully' });
    } else {
      return res.status(createUserResponse.status).json({ error: 'Failed to register user' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Registration failed' });
  }
})

app.get('/api/auth/sessions/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const tokenResponse = await axios.post(
      `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
      new URLSearchParams({
        grant_type: 'password',
        client_id: 'admin-cli',
        username: process.env.KEYCLOAK_ADMIN_USERNAME,
        password: process.env.KEYCLOAK_ADMIN_PASSWORD,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    const adminToken = tokenResponse.data.access_token;

    const sessionsResponse = await axios.get(
      `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userId}/sessions`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );

    return res.json({ sessions: sessionsResponse.data });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to get user sessions',
      details: error.response?.data || error.message,
    });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token' });
  }
  try {
    const response = await axios.post(
      `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return res.json({
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
      token_type: response.data.token_type,
    });
  } catch (error) {
    console.error('Refresh token error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return res.status(401).json({
      error: 'Failed to refresh token',
      details: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
  console.log('Environment:', {
    keycloakUrl: KEYCLOAK_URL,
    realm: REALM,
    clientId: CLIENT_ID
  });
});