# Daren Customer Form

A customer expectations preparation questionnaire with multilingual support (English/Arabic).

## Features

- Bilingual form (English/Arabic)
- Service type selection (Fulfillment/Last Mile)
- Real-time form validation
- Date range validation
- Supabase integration for data storage
- Responsive design

## Deployment

### Railway Deployment

1. **Connect to Railway:**
   - Go to [Railway.app](https://railway.app)
   - Sign up/Login with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select this repository

2. **Environment Variables:**
   Set up your Supabase credentials in Railway:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anonymous key

3. **Deploy:**
   - Railway will automatically detect the Node.js project
   - It will run `npm install` and `npm start`
   - Your app will be available at the generated Railway URL

### Local Development

```bash
npm install
npm start
```

The application will be available at `http://localhost:3000`

## File Structure

- `index.html` - Landing page
- `customer.html` - Main customer form
- `admin-dashboard.html` - Admin dashboard
- `login.html` - Login page
- `thank-you.html` - Thank you page
- `assets/` - CSS and JavaScript files
- `font/` - Custom fonts
- `server.js` - Express server
- `package.json` - Node.js dependencies
