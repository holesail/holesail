const http = require("http");
const fs = require("fs");
const path = require("path");
const qs = require("querystring");

class Filemanager {
  constructor(basePath = "./", user, username, pass) {
    this.basePath = basePath; // Base path for file operations
    this.user = user; // User type (admin/normal)
    this.authUsername = username; // Basic auth username
    this.authPassword = pass; // Basic auth password
    this.server = http.createServer(this.handleRequest.bind(this));
  }

  start(port) {
    this.server.listen(port, (err) => {
      if (err) {
        console.error(`Failed to start server on port ${port}: ${err.message}`);
        process.exit(1);
      }
      console.log(`Server is running on port ${port}`);
    });
  }

  destroy() {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  handleRequest(req, res) {
    const urlPath = decodeURIComponent(req.url);
    const fullPath = path.join(this.basePath, urlPath);

    // Basic authentication check
    if (!this.authenticate(req)) {
      res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Filemanager"' });
      res.end("Authentication required.");
      return;
    }

    if (req.method === "GET") {
      this.handleGetRequest(fullPath, urlPath, res);
    } else if (req.method === "POST") {
      this.handlePostRequest(req, res, urlPath);
    }
  }

  authenticate(req) {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const encodedCredentials = authHeader.split(" ")[1];
      const credentials = Buffer.from(encodedCredentials, "base64").toString(
        "utf-8"
      );
      const [username, password] = credentials.split(":");
      return username === this.authUsername && password === this.authPassword;
    }
    return false;
  }

  handleGetRequest(fullPath, urlPath, res) {
    fs.stat(fullPath, (err, stats) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
        return;
      }

      if (stats.isDirectory()) {
        this.listDirectory(fullPath, urlPath, res);
      } else if (stats.isFile()) {
        this.serveFile(fullPath, res);
      }
    });
  }

  handlePostRequest(req, res, urlPath) {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const formData = qs.parse(body);
      const itemType = formData["item_type"];
      const name = formData["name"];
      const directory = formData["directory"];
      const newFullPath = path.join(this.basePath, directory, name);

      if (itemType === "folder") {
        this.createFolder(newFullPath, res, urlPath);
      } else if (itemType === "file") {
        this.createFile(newFullPath, res, urlPath);
      }
    });
  }

  listDirectory(fullPath, urlPath, res) {
    fs.readdir(fullPath, { withFileTypes: true }, (err, files) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal Server Error");
        return;
      }

      const directoryList = files
        .map((file) => {
          const filePath = path.join(urlPath, file.name);
          const safeFileName = this.escapeHtml(file.name);
          const iconHtml = file.isDirectory()
            ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4042bc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
            : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E94E47" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V9l-7-7z"/><path d="M13 3v6h6"/></svg>`;
          const downloadButton = file.isDirectory()
            ? `<a class="open--btn" href="${filePath}">Enter</a>`
            : `<a href="${filePath}" download>Download</a>`;
          return `<tr><td class="file--name">${iconHtml}<a href="${filePath}">${safeFileName}</a></td><td class="download--btn">${downloadButton}</td></tr>`;
        })
        .join("");

      let createFormHtml = "";
      if (this.user === "admin") {
        createFormHtml = `
                    <form method="POST" action="${urlPath}">
                        <div>
                            <label for="item_type">New Item Type</label>
                            <select name="item_type" id="item_type">
                                <option value="folder">Folder</option>
                                <option value="file">File</option>
                            </select>
                        </div>
                        <div>
                            <label for="name">Name</label>
                            <input type="text" name="name" id="name" placeholder="Name of the file/folder*" required>
                        </div>
                        <div>
                            <label for="directory">Select Directory</label>
                            <select name="directory" id="directory">
                                ${this.getDirectoryOptions()}
                            </select>
                        </div>
                        <button class="btn" type="submit">Create</button>
                    </form>`;
      }

      const htmlResponse = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Directory Listing | Filemanager</title>
                    <style>
                        body {
                        font-family: "Intern", sans-serif;
                        background-color: #f3f3f3;
                        margin: 0;
                        padding: 0;
                        color: #333;
                        overflow-x: hidden;
                        }
                        .hide{
                        display: none;
                        }
                        .go--back--btn{
                        text-decoration: none;
                        color: #444;
                        cursor: pointer;
                        display: flex;
                        flex-direction: row;
                        align-items: center; 
                        margin: 2rem 2rem 1rem 2rem;
                        }
                        nav{
                        padding: 0.1rem 2rem;
                        display:flex;
                        align-items: center;
                        gap: 10px;
                        border-bottom: 0.5px solid #bbb;
                        }
                        nav p{
                        font-size: 1.4rem;
                        }
                        .nav--icon{
                        width: 30px;
                        }
                    h1 {
                        color: #444;
                        font-size: 24px;
                        padding: 0 2rem;
                    }
                    a {
                        color: #333;
                        font-size: 16px;
                    }
                        .open--btn{
                        padding: 8px 14px;
                        font-size: 16px;
                        background: #fff !important;
                        border: 1px solid #242424;
                        color: #000 !important;

                        }
                       .container{
    padding: 0 2rem 2rem 2rem; 
                       }
                   table {
    width: 100%;
    max-width: 100%;
    border-collapse: collapse;
    border-radius: 15px;
    background-color: #fff;
}
    .table--container{
    border: 0.5px solid #bbb;
    border-radius: 15px;
    }

                    td {
                        text-align: left;
                        font-weight: 700;
                    }
                        td:nth-child(odd){
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        }
                        td:nth-child(odd) a{
                        width: 100%;
                        }
                    th {
                    text-align: left;
                        border-bottom: 0.5px solid #bbb;
                        font-weight: 300;
                        font-size: 14px;
                        background-color: #fff;
                    }
                          table tr:first-child th:first-child {
        border-top-left-radius: 15px;
    }

    table tr:first-child th:last-child {
        border-top-right-radius: 15px;
    }

    table tr:last-child td:first-child {
        border-bottom-left-radius: 15px;
    }

    table tr:last-child td:last-child {
        border-bottom-right-radius: 15px;
    }
                        th:nth-child(1){
                    padding: 0.5rem 2rem;
                        }
                    tr:hover {
                        background-color: #f3f3f3;
                    }
                    .btn {
                        background-color: #E94E47;
                        border: none;
                        color: #fff;
                        padding: 8px 14px;
                        text-align: center;
                        text-decoration: none;
                        display: inline-block;
                        font-size: 18px;
                        cursor: pointer;
                        border-radius: 4px;
                    }
                    .btn:hover {
                        background-color: #ca271f;
                    }
                        .download--btn{
                        width: 120px;
                        }
                        .download--btn a {
                        background-color: #E94E47;
                        padding: 10px;
                        border-radius: 7px;
                        text-decoration: none;
                        color: #fff;
                        display: flex;
                        width: 80px !important;
                        }
                        .file--name{
                        padding: 4px 14px;
                        margin: 0.5rem 0;
                        }
                        .file--name a{
                        text-decoration: none;
                        color: #555;
                        }

                        form {
                        padding: 1rem 1rem;
                        border-radius: 15px;
                        width: 340px;
                        display: flex;
                        flex-direction: column;
                        gap: 1rem;
                        background: #fff;
                        margin: 1rem 0 3rem 0;
                        border: 0.5px solid #bbb;
                        }
                        input{
                        padding: 0.8rem 1rem;
                        border-radius: 7px;
                        border: 0.5px solid #bbb;
                        outline: none;
                        }
                        form div{
                        width: 340px;
                        display: flex;
                        flex-direction: column;
                        }
                        form select{
                        padding: 0.8rem 1rem;
                        border-radius: 7px;
                        border: 0.5px solid #bbb;
                        outline: none;
                        cursor: pointer;
                        color: #777;
                        }
                        form label{
                        color: #555;
                        font-size: 14px;
                        font-weight: 700;
                        padding: 2px 10px;
                        }
                        form .btn{ 
                        width: 340px;
                        margin-top: 0rem;
                        border-radius: 7px;
                        }
                        @media screen and (max-width: 650px){
                        form{
                        width: 100%;
                        }
                        form div, form button{
                        width: 100%;
                        }
                        }
                        .auth--container{
                        width: 100vw;
                        height: 100vh;
                        position: fixed;
                        background-color: #ffffff73;
                        z-index: 999;
                        backdrop-filter: blur(30px);
                        }
                        .auth--container form{
                         position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        }
                        .auth--btn--container{
                        display: flex;
                        flex-direction: row;
                        gap: 10px;
                        }
                        .auth--btn--container button{
                        width: 100%;
                        }
                        .auth--container a {
                        font-size: 12px;
                        text-decoration: none;
                        color: blue;
                        }
                    </style>
                </head>
                <body>
                <div class="auth--container hide">
                <form>
                <div>
                    <label for="username">username</label>
                    <input type="text" name="name" id="name" placeholder="username*" required>
                </div>
                <div>
                    <label for="password">password</label>
                    <input type="text" name="name" id="name" placeholder="password*" required>
                </div>
                <div class="auth--btn--container">
                <button class="btn">Sign In</button>
                <button style="background-color: #fff; border: 0.5px solid; color: #000;" class="btn">Cancel</button>
                </div>
                <div>
                <p style="font-size: 14px;">or</p>
                <a href="https://holesail.io">Read docs</a>
                <a href="https://holesail.io">Contact Support?</a>
                </div>
                </form>
                </div>
                <nav>
                <img class="nav--icon" src="https://holesail.io/img/icons/holesail--logo.webp"></img>
                <p>holesail</p>
                </nav>
                <h1>Folder and Files: ${this.escapeHtml(urlPath)}</h1>
                <p class="go--back--btn" onclick="goback()">go back</p>
                    <div class="container">
                    <div class="table--container">
                    <table>
                        <tr>
                            <th>Name</th>
                            <th>Actions</th>
                        </tr>
                        ${directoryList}
                    </table>
                    </div>
                    ${createFormHtml}
                    </div>
                </body>
                <script>
                function goback(){
                window.history.back();
                }
                </script>
                </html>
            `;
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(htmlResponse);
    });
  }

  serveFile(fullPath, res) {
    const extension = path.extname(fullPath).toLowerCase();
    const contentType = this.getContentType(extension);
    if (contentType) {
      fs.readFile(fullPath, (err, data) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Error reading file.");
          return;
        }
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
      });
    } else {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Unsupported file type.");
    }
  }

  createFolder(newFullPath, res, urlPath) {
    fs.mkdir(newFullPath, (err) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Error creating folder.");
        return;
      }
      res.writeHead(302, { Location: urlPath });
      res.end();
    });
  }

  createFile(newFullPath, res, urlPath) {
    fs.writeFile(newFullPath, "", (err) => {
      if (err) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Error creating file.");
        return;
      }
      res.writeHead(302, { Location: urlPath });
      res.end();
    });
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  getContentType(extension) {
    const mimeTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".xml": "application/xml",
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".py": "text/x-python",
      ".c": "text/x-c",
      ".cpp": "text/x-c++src",
      ".h": "text/x-c",
      ".sh": "text/x-shellscript",
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".ico": "image/x-icon",
      ".svg": "image/svg+xml",
      ".mp3": "audio/mpeg",
      ".bmp": "image/bmp",
      ".webp": "image/webp",
      ".zip": "application/zip",
      ".rar": "application/x-rar-compressed",
      ".tar": "application/x-tar",
      ".gz": "application/x-gzip",
      ".bz2": "application/x-bzip2",
      ".7z": "application/x-7z-compressed",
      ".wav": "audio/x-wav",
      ".ogg": "audio/ogg",
      ".flac": "audio/x-flac",
      ".m4a": "audio/x-m4a",
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".ogv": "video/ogg",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      ".wmv": "video/x-ms-wmv",
      ".flv": "video/x-flv",
      ".mkv": "video/x-matroska",
    };
    return mimeTypes[extension] || null;
  }

  getDirectoryOptions() {
    const basePath = this.basePath;
    const traverseDirectory = (dir, depth = 0) => {
      let options = "";
      const items = fs.readdirSync(dir, { withFileTypes: true });
      items.forEach((item) => {
        if (item.isDirectory()) {
          const itemPath = path.join(dir, item.name);
          const displayPath = itemPath.replace(basePath, "");
          const indent = "&nbsp;".repeat(depth * 4);
          options += `<option value="${displayPath}">${indent}${item.name}</option>`;
          options += traverseDirectory(itemPath, depth + 1);
        }
      });
      return options;
    };
    return traverseDirectory(basePath);
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

module.exports = Filemanager;
