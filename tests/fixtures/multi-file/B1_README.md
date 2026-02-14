# Category B1: Multi-file feature (Express JWT auth)

Project structure:

```
multi-file/auth-base/
├── app.js
├── package.json
└── routes/
    └── users.js
```

app.js currently:

```javascript
const express = require('express');
const app = express();
app.use(express.json());
app.use('/users', require('./routes/users'));
module.exports = app;
```

routes/users.js:

```javascript
const router = require('express').Router();
router.get('/', (req, res) => { res.json([{id:1, name:'Alice'}]); });
module.exports = router;
```

Task:
Add JWT authentication middleware that:
- Protects all `/users` routes
- Expects `Authorization: Bearer <token>`
- Verifies token using HS256 and secret from `JWT_SECRET` env var or default 'dev-secret'
- Returns 401 if missing/invalid
- Attaches decoded payload to `req.user`

Provide:
1. `middleware/auth.js` with `authenticate` function
2. Updated `routes/users.js` to use `authenticate` before handler
3. A new route `/auth/login` that accepts `{username,password}` and returns a token if credentials match a hardcoded user (username 'admin', password 'password123')

Evaluation:
- Requests to `/users` without token → 401
- Invalid token → 401
- Valid token → 200 with user data
- `/auth/login` with valid credentials returns token; invalid returns 401
- Token payload properly attached as `req.user`
