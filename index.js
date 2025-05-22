const express = require("express");
const axios = require("axios");
require("dotenv").config();

console.log("Starting server...");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send(`<a href="/auth/dropbox">Connect to Dropbox</a>`);
});

app.get("/auth/dropbox", (req, res) => {
  const dropboxAuthUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${process.env.DROPBOX_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}`;
  res.redirect(dropboxAuthUrl);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("No code received");

  try {
    const tokenRes = await axios.post("https://api.dropboxapi.com/oauth2/token", null, {
      params: {
        code,
        grant_type: "authorization_code",
        client_id: process.env.DROPBOX_CLIENT_ID,
        client_secret: process.env.DROPBOX_CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI,
      },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    res.send(`Access token received: <pre>${JSON.stringify(tokenRes.data, null, 2)}</pre>`);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send("Token exchange failed");
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
