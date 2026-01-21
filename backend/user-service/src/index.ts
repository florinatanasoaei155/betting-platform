import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import {
  query,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  authMiddleware,
  AuthenticatedRequest,
  User,
  UserDTO,
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  ApiResponse,
} from 'shared';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

app.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body as RegisterRequest;

    if (!email || !username || !password) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Email, username, and password are required',
      };
      res.status(400).json(response);
      return;
    }

    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'User with this email or username already exists',
      };
      res.status(409).json(response);
      return;
    }

    const password_hash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    const result = await query(
      `INSERT INTO users (id, email, username, password_hash, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, username, created_at`,
      [id, email, username, password_hash]
    );

    const user: UserDTO = result.rows[0];

    await query(
      `INSERT INTO wallets (id, user_id, balance, currency, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [uuidv4(), id, 100.00, 'USD']
    );

    const accessToken = generateAccessToken({ userId: id, email });
    const refreshToken = generateRefreshToken({ userId: id, email });

    const response: ApiResponse<AuthResponse> = {
      success: true,
      data: { user, accessToken, refreshToken },
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Register error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as LoginRequest;

    if (!email || !password) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Email and password are required',
      };
      res.status(400).json(response);
      return;
    }

    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid credentials',
      };
      res.status(401).json(response);
      return;
    }

    const user: User = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid credentials',
      };
      res.status(401).json(response);
      return;
    }

    const userDTO: UserDTO = {
      id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.created_at,
    };

    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

    const response: ApiResponse<AuthResponse> = {
      success: true,
      data: { user: userDTO, accessToken, refreshToken },
    };

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Refresh token is required',
      };
      res.status(400).json(response);
      return;
    }

    const payload = verifyToken(refreshToken);
    const accessToken = generateAccessToken({ userId: payload.userId, email: payload.email });

    const response: ApiResponse<{ accessToken: string }> = {
      success: true,
      data: { accessToken },
    };

    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: 'Invalid refresh token',
    };
    res.status(401).json(response);
  }
});

app.get('/profile', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await query(
      'SELECT id, email, username, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'User not found',
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<UserDTO> = {
      success: true,
      data: result.rows[0],
    };

    res.json(response);
  } catch (error) {
    console.error('Profile error:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: 'Internal server error',
    };
    res.status(500).json(response);
  }
});

app.get('/internal/user/:id', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, username, created_at FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`User service running on port ${PORT}`);
});
