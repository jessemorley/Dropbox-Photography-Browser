const express = require("express");
const axios = require("axios");
const session = require("express-session");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🛡️ Ensure cookies work properly (especially if hosted behind proxies)
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'replace-with-a-long-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // set to true when using HTTPS in production
}));

// 🏠 Homepage
app.get("/", (req, res) => {
  console.log("SESSION:", req.session); // 🔍 Debug session content

  if (req.session.accessToken) {
    res.send(`
      <h1>Enter Folder Path</h1>
      <form action="/browse" method="get">
        <input name="path" placeholder="/Photography/Inspo" />
        <button>Browse</button>
      </form>
    `);
  } else {
    res.send(`<a href="/auth/dropbox">Connect to Dropbox</a>`);
  }
});

// 🔐 Start OAuth flow
app.get("/auth/dropbox", (req, res) => {
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${process.env.DROPBOX_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}`;
  res.redirect(authUrl);
});

// 🎯 Handle Dropbox callback
app.get("/callback", async (req, res) => {
  console.log("👋 Callback route hit");

  const code = req.query.code;
  if (!code) {
    console.log("❌ No code in query");
    return res.send("No code received");
  }

  try {
    console.log("🔁 Exchanging code for token...");

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

    const accessToken = tokenRes.data.access_token;
    console.log("✅ Token received:", accessToken);

    req.session.accessToken = accessToken;
    console.log("💾 Token saved to session");

    res.redirect("/");
  } catch (err) {
    console.error("🔥 Token exchange failed:", err.response?.data || err.message);
    res.status(500).send("Token exchange failed");
  }
});

// 📁 Browse a folder and show image files
app.get("/browse", async (req, res) => {
  const accessToken = req.session.accessToken;
  const folderPath = req.query.path;

  if (!accessToken) return res.redirect("/");
  if (!folderPath) return res.send("No path specified");

  try {
    const listRes = await axios.post(
      "https://api.dropboxapi.com/2/files/list_folder",
      { path: folderPath },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const files = listRes.data.entries.filter(file =>
      file[".tag"] === "file" &&
      /\.(jpe?g|png|gif|webp)$/i.test(file.name)
    );

    res.send(`
      <h2>Files in ${folderPath}</h2>
      <ul>${files.map(f => `<li>${f.name}</li>`).join("")}</ul>
      <a href="/">Back</a>
    `);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send("Error browsing folder: " + (err.response?.data?.error_summary || err.message));
  }
});

// 🚀 Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
