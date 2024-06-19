
const HolesailServer = require('./index.js'); // Assuming the server module is in a file named index.js

const server1 = new HolesailServer();

server1.serve({port:5000, address:"127.0.0.1", buffSeed: "d8afd2605893ba587ffdc60044aa51ede164dbb71219d807ef55d624d8d09241",secure:true}, () => {
    console.log('Server 1 started');
    console.log(server1.getPublicKey());
  //   setTimeout(() => {
  //     server1.destroy();
  //     console.log('Server 1 destroyed');
  // }, 6000);

})
// server2.serve(5100, '127.0.0.1', () => {
//   console.log('Server 2 started');
//   console.log(server2.getPublicKey())
//   // server2.destroy()
// });

