import http from "http";
import fs from "fs";
import path from "path";
import qs from "querystring";
import libKeys from 'hyper-cmd-lib-keys'; // generate a random seed
import b4a from 'b4a'; //generate random connector

//import server module
import Server from './server.js';
import * as logo from './logo.js'; // Require logo code

class Filemanager {
    constructor(options) {
        //set options specific to filemanager
        this.basePath = (typeof (options.path) != "boolean") ? options.path : "./"; // Base path for file operations
        this.role = options.role === "admin" ? "admin" : "user"; // User type (admin/normal)
        this.authUsername = (options.username && typeof (options.username) != "boolean") ? options.username : "admin"; // Basic auth username
        this.authPassword = (options.password && typeof (options.password) != "boolean") ? options.password : "admin"; // Basic auth password

        //set options specific to calling holesail-server
        this.port = (options.port && typeof (options.port) != "boolean") ? options.port : 5409;
        this.connector = (options.connector && typeof (options.connector) != "boolean") ? options.connector : false;
        this.isConnectorSet = !!(options.connector && typeof (options.connector) != "boolean");
        this.public = options.public;
        this.service = options.service;

    }

    start() {
        //initialise local http server
        this.server = http.createServer(this.handleRequest.bind(this));
        //TODO: Check if port is busy and throw error
        //start listening for requests on specified port
        this.server.listen(this.port, (err) => {
            if (err) {
                console.error(`Failed to start server on port ${this.port}: ${err.message}`);
                process.exit(1);
            }
        });

        let options = {
            port: this.port,
            host: "127.0.0.1",
            connector: this.connector,
            service: this.service,
            public: this.public,

            customText: `Username: ${this.authUsername} Password: ${this.authPassword} Role: ${this.role} \n`
        };

        //enable public mode on demand
        if (this.public) {
            options.connector = false;
        } else if (this.connector && this.isConnectorSet) { // let user use a custom connector
            options.connector = this.connector;
        } else {
            let buffer = Buffer.from(libKeys.randomBytes(32).toString('hex'), 'hex') // generate a random connector if not provided by user
            options.connector = b4a.toString(buffer, 'hex').substring(0, 60)
        }

        //expose the server with holesail-server
        const server = new Server(options);
        server.start();

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
            res.writeHead(401, {"WWW-Authenticate": 'Basic realm="Filemanager"'});
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
                res.writeHead(500, {"Content-Type": "text/plain"});
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

            // Basic validation
            if (!itemType || !name || typeof name !== "string" || !["folder", "file"].includes(itemType)) {
                res.writeHead(400, {"Content-Type": "text/plain"});
                res.end("Bad Request: Missing or invalid form data.");
                return;
            }

            // Check user type for folder creation
            if (itemType === "folder" && this.role !== "admin") {
                res.writeHead(403, {"Content-Type": "text/plain"});
                res.end("Forbidden: Only admin users can create folders.");
                return;
            }

            const newFullPath = path.join(this.basePath, directory || ".", name);

            if (itemType === "folder") {
                this.createFolder(newFullPath, res, urlPath);
            } else if (itemType === "file") {
                this.createFile(newFullPath, res, urlPath);
            }
        });
    }

    calculateDirectorySize(dirPath) {
        let totalSize = 0;

        const items = fs.readdirSync(dirPath, { withFileTypes: true });

        items.forEach((item) => {
            const itemPath = path.join(dirPath, item.name);
            if (item.isDirectory()) {
                totalSize += this.calculateDirectorySize(itemPath); // Recursively add directory size
            } else {
                totalSize += fs.statSync(itemPath).size; // Add file size
            }
        });

        return totalSize;
    }


    listDirectory(fullPath, urlPath, res) {
        fs.readdir(fullPath, {withFileTypes: true}, (err, files) => {
            if (err) {
                res.writeHead(500, {"Content-Type": "text/plain"});
                res.end("Internal Server Error");
                return;
            }

            // Separate and sort directories and files
            const folders = files.filter((file) => file.isDirectory());
            const normalFiles = files.filter((file) => !file.isDirectory());

            const directoryList = [...folders, ...normalFiles]
                .map((file) => {
                    const filePath = path.join(urlPath, file.name);
                    const safeFileName = this.escapeHtml(file.name);
                    const iconHtml = file.isDirectory()
                        ? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4042bc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`
                        : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E94E47" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V9l-7-7z"/><path d="M13 3v6h6"/></svg>`;
                    const downloadButton = file.isDirectory()
                        ? `<a class="open--btn" href="${filePath}">Enter</a>`
                        : `<a href="${filePath}" download>Download</a>`;

                           // Get file or folder size
                           const size = file.isDirectory()
                           ? this.formatBytes(this.calculateDirectorySize(path.join(fullPath, file.name)))
                           : this.formatBytes(fs.statSync(path.join(fullPath, file.name)).size);
                    return `<tr><td class="file--name">${iconHtml}<a href="${filePath}">${safeFileName}</a></td><td class="download--btn">${downloadButton}</td><td>${size}</td></tr>`;
                })
                .join("");

            let createFormHtml = "";
            if (this.role === "admin") {
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
                <option value="">Current Directory</option>
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
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Directory Listing | Filemanager</title>
                    <style>
                        body {
                        font-family: "Intern", sans-serif;
                        background-color: #f3f3f3;
                        margin: 0;
                        padding: 0;
                        color: #333;
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
                        display:flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        }
                        nav p{
                        font-size: 3.4rem;
                        font-weight: 700;
                        }
                        .nav--icon{
                        width: 60px;
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
                        width: 100%;
                        margin-top: 0rem;
                        border-radius: 7px;
                        padding: 0.6rem 0;
                        }
                        footer{
                        display: flex;
                        gap: 1rem;
                        justify-content: center;
                        margin-bottom: 2rem;
                        }
                        @media screen and (max-width: 650px){
                         nav{
                         padding: 0 1rem;
                        justify-content: start;
                        }
                        nav p{
                        font-size: 1.4rem;
                        font-weight: 700;
                        }
                        h1{
                        padding: 0 1rem;
                        margin-block: 0;
                        }
                        .go--back--btn{
                        margin: 1rem;
                        }
                        .container{
                        padding: 0 1rem;
                        }
                        .nav--icon{
                        width: 30px;
                        }
                        form{
                        width: -webkit-fill-available;
                        }
                        form div, form button{
                        width: 100%;
                        }
                         footer{
                        justify-content: flex-start;
                        padding: 0 1.4rem;
                        gap: 10px;
                        }
                        }
                    </style>
                </head>
                <body>
                <nav>
                <img class="nav--icon" src="${logo.base64Logo}"></img>
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
                            <th>Size</th>

                        </tr>
                        ${directoryList}
                    </table>
                   </div>
                    ${createFormHtml}
                    </div>
                    <footer>
                    <a>Discord</a>
                   &#183;
                    <a>Support</a>
                    &#183;
                    <a>&copy; 2024 Holesail</a>
                    </footer>
                </body>
                <script>
                function goback(){
                window.history.back();
                }
                </script>
                </html>
            `;
            res.writeHead(200, {"Content-Type": "text/html"});
            res.end(htmlResponse);
        });
    }

    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

   serveFile(fullPath, res) {
    const extension = path.extname(fullPath).toLowerCase();
    const contentType = this.getContentType(extension) || 'application/octet-stream';    if (contentType) {
        fs.stat(fullPath, (err, stats) => {
            if (err) {
                res.writeHead(500, {"Content-Type": "text/plain"});
                res.end("Error reading file.");
                return;
            }
            const fileSize = stats.size;
            res.writeHead(200, {
                "Content-Type": contentType,
                "Content-Length": fileSize,
            });

            const stream = fs.createReadStream(fullPath);
            let downloaded = 0;
            stream.on('data', (chunk) => {
                downloaded += chunk.length;
                const percentage = ((downloaded / fileSize) * 100).toFixed(2);
                console.log(`Downloaded: ${percentage}%`);
            });

            stream.pipe(res);
        });
    } else {
        res.writeHead(500, {"Content-Type": "text/plain"});
        res.end("Unsupported file type.");
    }
}

    createFolder(newFullPath, res, urlPath) {
        fs.mkdir(newFullPath, {recursive: true}, (err) => {
            if (err) {
                res.writeHead(500, {"Content-Type": "text/plain"});
                res.end("Error creating folder.");
                return;
            }
            res.writeHead(302, {Location: urlPath});
            res.end();
        });
    }

    createFile(newFullPath, res, urlPath) {
        fs.writeFile(newFullPath, "", (err) => {
            if (err) {
                res.writeHead(500, {"Content-Type": "text/plain"});
                res.end("Error creating file.");
                return;
            }
            res.writeHead(302, {Location: urlPath});
            res.end();
        });
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
            ".exe": "application/x-msdownload",
        };
        return mimeTypes[extension] || null;
    }

    getDirectoryOptions() {
        const basePath = this.basePath;
        const traverseDirectory = (dir, depth = 0) => {
            let options = "";
            const items = fs.readdirSync(dir, {withFileTypes: true});
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

export default Filemanager;
