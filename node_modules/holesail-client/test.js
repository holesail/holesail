const holesailClient = require("./index.js")

let test = new holesailClient("af0449c11fa4b3c7d5f1c058bdaaa5a27bdd38c3ea807c05109fc4ba735b9186","secure")
test.connect({port:8000, address:"127.0.0.1"}, () => {
        console.log("Connected Privately")
    }
)
// setTimeout(() => {
//     console.log(test.destroy())
// }, 5000);

let test2 = new holesailClient("4c3d9d8d242e61a2490e1be54c525eaba2a0eebf735478b7f021e4a6f64f0ad7")
test2.connect({port:9000, address:"127.0.0.1"}, () => {
        console.log("Connected Publicly")
    }
)