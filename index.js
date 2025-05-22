const express = require("express");
const axios = require("axios");
const session = require("express-session");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: "replace-with-a-long-secret",
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.get("/", async (req, res) => {
  const accessToken = req.session.accessToken;

  if (!accessToken) {
    return res.send(`<a href="/auth/dropbox">Connect to Dropbox</a>`);
  }

  const path = req.query.path || "";

  try {
    const listRes = await axios.post(
      "https://api.dropboxapi.com/2/files/list_folder",
      { path },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const entries = listRes.data.entries;
    const folders = entries.filter(e => e[".tag"] === "folder");
    const images = entries.filter(e =>
      e[".tag"] === "file" && /\.(jpe?g|png|gif|webp)$/i.test(e.name)
    );

    const html = `
      <h1>Browsing: ${path || "/"}</h1>

      ${path ? `<a href="/?path=${encodeURIComponent(path.split("/").slice(0, -1).join("/"))}">⬅️ Back</a>` : ""}

      <h2>📁 Folders</h2>
      <ul>
        ${folders.map(f => `<li><a href="/?path=${encodeURIComponent(path + "/" + f.name)}">${f.name}</a></li>`).join("")}
      </ul>

      <h2>🖼 Images</h2>
      <ul>
        ${images.map(img => `<li>${img.name}</li>`).join("")}
      </ul>

      <form action="/select" method="post">
        <input type="hidden" name="path" value="${path}" />
        <button type="submit">✅ Select This Folder</button>
      </form>
    `;

    res.send(html);
  } catch (err) {
    console.error("❌ Error loading folder:", err.response?.data || err.message);
    res.status(500).send("Error loading folder");
  }
});

app.post("/select", (req, res) => {
  const selectedPath = req.body.path;
  req.session.selectedFolder = selectedPath;
  res.send(`<h2>✅ You selected: ${selectedPath || "/"}</h2><a href="/">Back</a>`);
});

app.get("/auth/dropbox", (req, res) => {
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${process.env.DROPBOX_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}`;
  res.redirect(authUrl);
});

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
    console.log("📎 Token saved to session");

    res.redirect("/");
  } catch (err) {
    console.error("🔥 Token exchange failed:", err.response?.data || err.message);
    res.status(500).send("Token exchange failed");
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));