# Livefiles

**A dead simple Node.js file manager.**

Livefiles is a lightweight file manager that serves files from a specified directory. It includes basic authentication and role-based permissions.

---

##  Features

- Serve files from a specified path
- Basic HTTP authentication
- Role-based permissions:
  - `user`: Can view and download files
  - `admin`: Can view, download, create, and delete files
- Customizable host and port

---

## Installation

Clone or install the module into your project:

```bash
npm install livefiles
```

## Usage
```bash
import Livefiles from './index.js'

const filemanager = new Livefiles({
  path: './',              // Path to serve files from (required)
  role: 'admin',           // 'admin' or 'user' (default: 'user')
  username: 'admin',     // HTTP Basic Auth username (default: 'admin')
  password: 'admin',     // HTTP Basic Auth password (default: 'admin')
  host: 'localhost',       // Host to bind to (default: '127.0.0.1')
  port: 8989               // Port to listen on (default: 5409)
})

// start the filemanager server
await filemanager.ready()
//close the server
await filemanager.close()
```
