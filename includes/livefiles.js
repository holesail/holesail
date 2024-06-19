const http = require('http');
const fs = require('fs');
const path = require('path');
const qs = require('querystring');

class Filemanager {
    constructor(basePath, user, username, pass) {
        this.basePath = basePath || './'; //stores path of directory (if not then current directory)
        this.user = user;  // Store the user type (admin/normal)
        this.authUsername = username; // Username for basic auth
        this.authPassword = pass; // Password for basic auth
        this.server = http.createServer(this.handleRequest.bind(this));
    }

    start(port) {
        this.server.listen(port, (err) => {
            if (err) {
                console.error(`Failed to start server on port ${port}: ${err.message}`);
                process.exit(1);
            }
        });
    }

    destroy() {
        return new Promise((resolve, reject) => {
            this.server.close(err => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    handleRequest(req, res) {
        const urlPath = decodeURIComponent(req.url);
        const fullPath = path.join(this.basePath, urlPath);

        // Check basic authentication
        if (!this.authenticate(req)) {
            res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Filemanager"' });
            res.end('Authentication required.');
            return;
        }

        if (req.method === 'GET') {
            this.handleGetRequest(fullPath, urlPath, res);
        } else if (req.method === 'POST') {
            this.handlePostRequest(req, res, urlPath);
        }
    }

    authenticate(req) {
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const encodedCredentials = authHeader.split(' ')[1];
            const credentials = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
            const [username, password] = credentials.split(':');
            return username === this.authUsername && password === this.authPassword;
        }
        return false;
    }

    handleGetRequest(fullPath, urlPath, res) {
        fs.stat(fullPath, (err, stats) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
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
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            const formData = qs.parse(body);
            const item_type = formData['item_type'];
            const name = formData['name'];
            const directory = formData['directory'];
            const newFullPath = path.join(this.basePath, directory, name);

            if (item_type === 'folder') {
                this.createFolder(newFullPath, res, urlPath);
            } else if (item_type === 'file') {
                this.createFile(newFullPath, res, urlPath);
            }
        });
    }

    listDirectory(fullPath, urlPath, res) {
        fs.readdir(fullPath, { withFileTypes: true }, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                return;
            }
            const directoryList = files
                .map(file => {
                    const filePath = path.join(urlPath, file.name);
                    const downloadButton = `<a href="${filePath}" download>Download</a>`;
                    return `<tr><td><a href="${filePath}">${file.name}</a></td><td>${downloadButton}</td></tr>`;
                })
                .join('');

            let createFormHtml = '';
            if (this.user === 'admin') {
                createFormHtml = `
                    <form method="POST" action="${urlPath}">
                        <label for="item_type">New Item Type:</label>
                        <select name="item_type" id="item_type">
                            <option value="folder">Folder</option>
                            <option value="file">File</option>
                        </select>
                        <label for="name">Name:</label>
                        <input type="text" name="name" id="name" required>
                        <label for="directory">Select Directory:</label>
                        <select name="directory" id="directory">
                            ${this.getDirectoryOptions()}
                            <option value="." selected>Current Directory</option>
                        </select>
                        <button class="btn" type="submit">Create</button>
                    </form>`;
            }

            const htmlResponse = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Directory Listing: ${urlPath}</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            background-color: #f4f4f4;
                            margin: 0;
                            padding: 0;
                        }
                        h1 {
                            color: #333;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 20px;
                        }
                        th, td {
                            padding: 8px;
                            text-align: left;
                            border-bottom: 1px solid #ddd;
                        }
                        th {
                            background-color: #f2f2f2;
                        }
                        tr:hover {
                            background-color: #f5f5f5;
                        }
                        .btn {
                            background-color: #4CAF50;
                            border: none;
                            color: white;
                            padding: 6px 12px;
                            text-align: center;
                            text-decoration: none;
                            display: inline-block;
                            font-size: 14px;
                            margin: 2px 0;
                            cursor: pointer;
                            border-radius: 4px;
                        }
                        .btn:hover {
                            background-color: #45a049;
                        }
                    </style>
                </head>
                <body>
                    <h1>Directory Listing: ${urlPath}</h1>
                    <table>
                        <tr>
                            <th>Name</th>
                            <th>Actions</th>
                        </tr>
                        ${directoryList}
                    </table>
                    ${createFormHtml}
                </body>
                </html>
            `;
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(htmlResponse);
        });
    }

    serveFile(fullPath, res) {
        const extension = path.extname(fullPath).toLowerCase();
        const contentType = this.getContentType(extension);
        if (contentType) {
            fs.readFile(fullPath, (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error reading file.');
                    return;
                }
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            });
        } else {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Unsupported file type.');
        }
    }

    createFolder(newFullPath, res, urlPath) {
        fs.mkdir(newFullPath, err => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error creating folder.');
                return;
            }
            res.writeHead(302, { 'Location': urlPath });
            res.end();
        });
    }

    createFile(newFullPath, res, urlPath) {
        fs.writeFile(newFullPath, '', err => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error creating file.');
                return;
            }
            res.writeHead(302, { 'Location': urlPath });
            res.end();
        });
    }

    getContentType(extension) {
        const mimeTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.py': 'text/x-python',
            '.c': 'text/x-c',
            '.cpp': 'text/x-c++src',
            '.h': 'text/x-c',
            '.sh': 'text/x-shellscript',
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.ico': 'image/x-icon',
            '.svg': 'image/svg+xml',
            '.mp3': 'audio/mpeg',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp',
            '.zip': 'application/zip',
            '.rar': 'application/x-rar-compressed',
            '.tar': 'application/x-tar',
            '.gz': 'application/x-gzip',
            '.bz2': 'application/x-bzip2',
            '.7z': 'application/x-7z-compressed',
            '.wav': 'audio/x-wav',
            '.ogg': 'audio/ogg',
            '.flac': 'audio/x-flac',
            '.m4a': 'audio/x-m4a',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.ogv': 'video/ogg',
            '.avi': 'video/x-msvideo',
            '.mov': 'video/quicktime',
            '.wmv': 'video/x-ms-wmv',
            '.flv': 'video/x-flv',
            '.mkv': 'video/x-matroska',
        };
        return mimeTypes[extension] || null;
    }

    getDirectoryOptions() {
        let options = '';
        const traverseDirectory = (dir, depth) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            items.forEach(item => {
                if (item.isDirectory()) {
                    const itemPath = path.join(dir, item.name);
                    const displayPath = itemPath.replace(this.basePath, '');
                    const indent = '&nbsp;'.repeat(depth * 4);
                    options += `<option value="${displayPath}">${indent}${item.name}</option>`;
                    traverseDirectory(itemPath, depth + 1);
                }
            });
        };
        traverseDirectory(this.basePath, 0);
        return options;
    }
}

module.exports = Filemanager;
